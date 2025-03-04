import { NextResponse } from 'next/server';
import { getEnvConfig } from '@/config/env';

interface MailjetMessage {
  ID: number;
  ArrivedAt: string;
  Subject: string;
  IsOpenTracked: boolean;
  Status: string;
  ContactID: number;
  UUID: string;
  FromEmail?: string;
  ToEmail?: string;
}

interface MailjetMessageDetails {
  ID: number;
  ContactID: number;
  ContactALT: string;
  Status: string;
  Subject: string;
  ArrivedAt: string;
  FromEmail: string;
  ToEmail: string;
  UUID: string;
}

async function getContactId(emailAddress: string, auth: string): Promise<number | null> {
  console.log(`[Mailjet] Looking up contact ID for email: ${emailAddress}`);
  try {
    const url = `https://api.mailjet.com/v3/REST/contactdata?ContactEmail=${encodeURIComponent(emailAddress)}&Limit=1`;
    console.log(`[Mailjet] Making request to: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });

    console.log(`[Mailjet] Contact lookup status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Mailjet] Error response body:`, errorText);
      throw new Error(`Mailjet API error: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`[Mailjet] Contact lookup response:`, data);
    
    if (data.Data && data.Data.length > 0) {
      console.log(`[Mailjet] Found contact ID: ${data.Data[0].ContactID}`);
      return data.Data[0].ContactID;
    }
    console.log(`[Mailjet] No contact found for email: ${emailAddress}`);
    return null;
  } catch (error) {
    console.error('[Mailjet] Error fetching contact ID:', error);
    return null;
  }
}

async function getMessageDetails(messageId: number, auth: string): Promise<MailjetMessageDetails | null> {
  try {
    const url = `https://api.mailjet.com/v3/REST/messagehistory/${messageId}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch message details: ${response.statusText}`);
    }

    const data = await response.json();
    return data.Data[0] || null;
  } catch (error) {
    console.error('[Mailjet] Error fetching message details:', error);
    return null;
  }
}

async function getMessages(contactId: number, auth: string): Promise<MailjetMessage[]> {
  console.log(`[Mailjet] Fetching messages for contact ID: ${contactId}`);
  try {
    const queryParams = new URLSearchParams({
      Contact: contactId.toString(),
      ShowSubject: 'true',
      Limit: '50',
      Sort: 'ArrivedAt DESC'
    });

    const url = `https://api.mailjet.com/v3/REST/message?${queryParams}`;
    console.log(`[Mailjet] Making request to: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });

    console.log(`[Mailjet] Messages fetch status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Mailjet] Error response body:`, errorText);
      throw new Error(`Mailjet API error: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`[Mailjet] Found ${data.Data?.length || 0} messages`);
    console.log('[Mailjet] First message sample:', JSON.stringify(data.Data[0], null, 2));

    // Fetch details for each message
    const messagesWithDetails = await Promise.all(
      data.Data.map(async (msg: MailjetMessage) => {
        const details = await getMessageDetails(msg.ID, auth);
        if (details) {
          msg.FromEmail = details.FromEmail;
          msg.ToEmail = details.ToEmail;
        }
        return msg;
      })
    );

    return messagesWithDetails;
  } catch (error) {
    console.error('[Mailjet] Error fetching messages:', error);
    return [];
  }
}

export async function GET(request: Request) {
  console.log('[Mailjet] Starting GET request for messages');
  try {
    const { searchParams } = new URL(request.url);
    const emailAddress = searchParams.get('emailAddress');

    if (!emailAddress) {
      console.log('[Mailjet] No email address provided');
      return NextResponse.json(
        { error: 'Email address is required' },
        { status: 400 }
      );
    }

    const config = getEnvConfig();
    console.log('[Mailjet] Config loaded, API key length:', config.MAILJET_API_KEY?.length);
    console.log('[Mailjet] Secret key length:', config.MAILJET_API_SECRET?.length);
    const auth = Buffer.from(`${config.MAILJET_API_KEY}:${config.MAILJET_API_SECRET}`).toString('base64');

    // First get the contact ID
    const contactId = await getContactId(emailAddress, auth);
    if (!contactId) {
      console.log('[Mailjet] No contact ID found, returning empty result');
      return NextResponse.json({
        messages: [],
        total: 0,
      });
    }

    // Then get messages for this contact
    const mailjetMessages = await getMessages(contactId, auth);
    
    // Format messages
    const formattedMessages = mailjetMessages.map(msg => {
      console.log('[Mailjet] Processing message:', {
        FromEmail: msg.FromEmail,
        ToEmail: msg.ToEmail,
        searchedEmail: emailAddress
      });

      // Determine direction based on the searched email
      // If the searched email is the ToEmail, it's inbound
      // If the searched email is the FromEmail or if we can't determine, assume outbound
      const direction = msg.ToEmail?.toLowerCase() === emailAddress.toLowerCase() ? 'inbound' : 'outbound';
      
      return {
        id: msg.UUID,
        timestamp: new Date(msg.ArrivedAt),
        platform: 'mailjet',
        type: 'email' as const,
        direction,
        body: msg.Subject || 'No subject',
        subject: msg.Subject,
        emailAddress,
        status: msg.Status?.toLowerCase(),
        isOpened: msg.IsOpenTracked,
      };
    });

    console.log(`[Mailjet] Returning ${formattedMessages.length} formatted messages`);
    return NextResponse.json({
      messages: formattedMessages,
      total: formattedMessages.length,
    });
  } catch (error) {
    console.error('[Mailjet] Error in GET handler:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  console.log('[Mailjet] Starting POST request to send email');
  try {
    const { to, subject, text } = await request.json();

    if (!to || !text) {
      console.log('[Mailjet] Missing required fields');
      return NextResponse.json(
        { error: 'Email address and message are required' },
        { status: 400 }
      );
    }

    const config = getEnvConfig();
    console.log('[Mailjet] Config loaded, API key length:', config.MAILJET_API_KEY?.length);
    console.log('[Mailjet] Secret key length:', config.MAILJET_API_SECRET?.length);
    const auth = Buffer.from(`${config.MAILJET_API_KEY}:${config.MAILJET_API_SECRET}`).toString('base64');

    const response = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Messages: [
          {
            From: {
              Email: config.MAILJET_SENDER_EMAIL,
            },
            To: [
              {
                Email: to,
              },
            ],
            Subject: subject || 'New Message',
            TextPart: text,
            TrackOpens: 'enabled',
          },
        ],
      }),
    });

    console.log(`[Mailjet] Send email response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Mailjet] Error response body:`, errorText);
      throw new Error(`Failed to send email: ${response.statusText}`);
    }

    const sentMessage = {
      id: Date.now().toString(),
      timestamp: new Date(),
      platform: 'mailjet' as const,
      type: 'email' as const,
      direction: 'outbound' as const,
      body: text,
      emailAddress: to,
      isOpened: false,
      status: 'sent',
    };

    console.log('[Mailjet] Returning sent message');
    return NextResponse.json(sentMessage);
  } catch (error) {
    console.error('[Mailjet] Error in POST handler:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}

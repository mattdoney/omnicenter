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
    const emailAddressesParam = searchParams.get('emailAddresses');

    if (!emailAddressesParam) {
      console.log('[Mailjet] No email addresses provided');
      return NextResponse.json(
        { error: 'Email addresses are required' },
        { status: 400 }
      );
    }

    // Parse the JSON array of email addresses
    let emailAddresses: string[];
    try {
      emailAddresses = JSON.parse(emailAddressesParam);
      if (!Array.isArray(emailAddresses) || emailAddresses.length === 0) {
        throw new Error('Invalid email addresses format');
      }
    } catch (e) {
      console.log('[Mailjet] Invalid email addresses format:', e);
      return NextResponse.json(
        { error: 'Invalid email addresses format' },
        { status: 400 }
      );
    }

    const config = getEnvConfig();
    console.log('[Mailjet] Config loaded, API key length:', config.MAILJET_API_KEY?.length);
    console.log('[Mailjet] Secret key length:', config.MAILJET_API_SECRET?.length);
    const auth = Buffer.from(`${config.MAILJET_API_KEY}:${config.MAILJET_API_SECRET}`).toString('base64');

    // Create an array to hold all messages
    let allMessages: any[] = [];

    // For each email address, fetch messages
    for (const emailAddress of emailAddresses) {
      // First get the contact ID
      const contactId = await getContactId(emailAddress, auth);
      if (!contactId) {
        console.log(`[Mailjet] No contact ID found for ${emailAddress}, skipping`);
        continue;
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

      // Add to all messages
      allMessages = [...allMessages, ...formattedMessages];
    }

    // Sort all messages by date
    allMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Remove duplicates based on ID
    const uniqueMessages = Array.from(
      new Map(allMessages.map(msg => [msg.id, msg])).values()
    );

    console.log(`[Mailjet] Returning ${uniqueMessages.length} formatted messages`);
    return NextResponse.json({
      messages: uniqueMessages,
      total: uniqueMessages.length,
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
  try {
    const { to, subject, text } = await request.json();

    if (!to || !subject || !text) {
      return NextResponse.json(
        { error: 'To, subject, and text are required' },
        { status: 400 }
      );
    }

    const config = getEnvConfig();
    const url = 'https://api.mailjet.com/v3.1/send';
    const auth = Buffer.from(`${config.MAILJET_API_KEY}:${config.MAILJET_API_SECRET}`).toString('base64');

    const payload = {
      Messages: [
        {
          From: {
            Email: config.MAILJET_SENDER_EMAIL,
            Name: "Omnicenter",
          },
          To: [
            {
              Email: to,
            },
          ],
          Subject: subject,
          TextPart: text,
        },
      ],
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errorData.error || 'Failed to send email');
    }

    const data = await response.json();
    const messageId = data.Messages?.[0]?.To?.[0]?.MessageID || 'unknown';

    return NextResponse.json({
      id: messageId,
      timestamp: new Date(),
      platform: 'mailjet',
      type: 'email',
      direction: 'outbound',
      body: text,
      subject,
      emailAddress: to,
      status: 'sent',
    });
  } catch (error) {
    console.error('Error sending Mailjet message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { getEnvConfig } from '@/config/env';

const formatPhoneNumber = (phoneNumber: string): string => {
  // Remove any non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // Handle UK numbers
  if (cleaned.startsWith('07') || cleaned.startsWith('447')) {
    // Remove leading 0 if present and add +44
    const withoutLeadingZero = cleaned.startsWith('0') ? cleaned.slice(1) : cleaned;
    return withoutLeadingZero.startsWith('44') ? `+${withoutLeadingZero}` : `+44${withoutLeadingZero}`;
  }
  
  return `+${cleaned}`;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const phoneNumbersParam = searchParams.get('phoneNumbers');

    if (!phoneNumbersParam) {
      return NextResponse.json(
        { error: 'Phone numbers are required' },
        { status: 400 }
      );
    }

    // Parse the JSON array of phone numbers
    let phoneNumbers: string[];
    try {
      phoneNumbers = JSON.parse(phoneNumbersParam);
      if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
        throw new Error('Invalid phone numbers format');
      }
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid phone numbers format' },
        { status: 400 }
      );
    }

    const config = getEnvConfig();
    const mainClient = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
    const subClient = twilio(config.TWILIO_SUB_ACCOUNT_SID, config.TWILIO_SUB_AUTH_TOKEN);
    
    // Format all phone numbers
    const formattedPhones = phoneNumbers.map(formatPhoneNumber);
    
    // Create an array to hold all messages
    let allMessages: any[] = [];

    // For each phone number, fetch messages from both accounts
    for (const formattedPhone of formattedPhones) {
      const [mainSentMessages, mainReceivedMessages, subSentMessages, subReceivedMessages] = await Promise.all([
        mainClient.messages.list({
          from: formattedPhone
        }),
        mainClient.messages.list({
          to: formattedPhone
        }),
        subClient.messages.list({
          from: formattedPhone
        }),
        subClient.messages.list({
          to: formattedPhone
        })
      ]);

      // Add messages to the combined array
      allMessages = [
        ...allMessages,
        ...mainSentMessages,
        ...mainReceivedMessages,
        ...subSentMessages,
        ...subReceivedMessages
      ];
    }

    // Sort all messages by date
    allMessages.sort((a, b) => b.dateCreated.getTime() - a.dateCreated.getTime());

    // Remove duplicates based on SID
    const uniqueMessages = Array.from(
      new Map(allMessages.map(msg => [msg.sid, msg])).values()
    );

    const formattedMessages = uniqueMessages.map(msg => ({
      id: msg.sid,
      timestamp: new Date(msg.dateCreated),
      platform: 'twilio',
      type: 'sms',
      direction: msg.direction === 'inbound' ? 'inbound' : 'outbound',
      body: msg.body,
      phoneNumber: msg.direction === 'inbound' ? msg.from : msg.to,
      status: msg.status,
    }));

    return NextResponse.json({
      messages: formattedMessages,
      total: formattedMessages.length,
    });
  } catch (error) {
    console.error('Error fetching Twilio messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { phoneNumber, message } = await request.json();

    if (!phoneNumber || !message) {
      return NextResponse.json(
        { error: 'Phone number and message are required' },
        { status: 400 }
      );
    }

    const config = getEnvConfig();
    const client = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
    const formattedPhone = formatPhoneNumber(phoneNumber);

    const sentMessage = await client.messages.create({
      body: message,
      to: formattedPhone,
      from: config.TWILIO_PHONE_NUMBER,
    });

    return NextResponse.json({
      id: sentMessage.sid,
      timestamp: new Date(sentMessage.dateCreated),
      platform: 'twilio',
      type: 'sms',
      direction: 'outbound',
      body: sentMessage.body,
      phoneNumber: sentMessage.to,
      status: sentMessage.status,
    });
  } catch (error) {
    console.error('Error sending Twilio message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}

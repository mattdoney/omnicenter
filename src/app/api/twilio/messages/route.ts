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
    const phoneNumber = searchParams.get('phoneNumber');

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    const config = getEnvConfig();
    const mainClient = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
    const subClient = twilio(config.TWILIO_SUB_ACCOUNT_SID, config.TWILIO_SUB_AUTH_TOKEN);
    const formattedPhone = formatPhoneNumber(phoneNumber);

    // Get messages from both accounts
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

    // Combine and sort messages by date
    const allMessages = [...mainSentMessages, ...mainReceivedMessages, ...subSentMessages, ...subReceivedMessages]
      .sort((a, b) => b.dateCreated.getTime() - a.dateCreated.getTime());

    const formattedMessages = allMessages.map(msg => ({
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

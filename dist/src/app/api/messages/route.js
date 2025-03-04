import { NextResponse } from 'next/server';
import { APIClient } from '@/lib/api/client';
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const phoneNumber = searchParams.get('phoneNumber');
        const emailAddress = searchParams.get('emailAddress');
        if (!phoneNumber && !emailAddress) {
            return NextResponse.json({ error: 'Phone number or email address is required' }, { status: 400 });
        }
        const client = APIClient.getInstance();
        const result = await client.getMessages({
            phoneNumber: phoneNumber || undefined,
            emailAddress: emailAddress || undefined,
        });
        return NextResponse.json(result);
    }
    catch (error) {
        console.error('Error fetching messages:', error);
        return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }
}
export async function POST(request) {
    try {
        const body = await request.json();
        const { phoneNumber, emailAddress, body: messageBody } = body;
        if ((!phoneNumber && !emailAddress) || !messageBody) {
            return NextResponse.json({ error: 'Either phoneNumber or emailAddress, and body are required' }, { status: 400 });
        }
        const client = APIClient.getInstance();
        const message = await client.sendMessage({
            phoneNumber,
            emailAddress,
            body: messageBody,
        });
        return NextResponse.json(message);
    }
    catch (error) {
        console.error('Error sending message:', error);
        return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }
}
//# sourceMappingURL=route.js.map
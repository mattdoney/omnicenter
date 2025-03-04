import { NextResponse } from 'next/server';
import { getEnvConfig } from '@/config/env';
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const identifier = searchParams.get('identifier');
        if (!identifier) {
            return NextResponse.json({ error: 'Identifier is required' }, { status: 400 });
        }
        const config = getEnvConfig();
        const type = identifier.includes('@') ? 'email' : 'phone';
        const formattedId = type === 'phone'
            ? (identifier.startsWith('+') ? identifier : `+44${identifier.replace(/^0/, '')}`)
            : identifier.toLowerCase();
        const url = `https://profiles.euw1.segment.com/v1/spaces/${config.SEGMENT_SPACE_ID}/collections/users/profiles/${type}:${encodeURIComponent(formattedId)}/external_ids`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Basic ${config.SEGMENT_AUTH_TOKEN}`,
            },
        });
        if (!response.ok) {
            throw new Error(`Segment API error: ${response.statusText}`);
        }
        const data = await response.json();
        return NextResponse.json(data);
    }
    catch (error) {
        console.error('Error fetching external IDs:', error);
        return NextResponse.json({ error: 'Failed to fetch external IDs' }, { status: 500 });
    }
}
//# sourceMappingURL=route.js.map
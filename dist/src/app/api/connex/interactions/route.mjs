import { NextResponse } from 'next/server';
import { ConnexService } from '@/lib/api/services/connexone';
// Force Node.js runtime for better API compatibility
export const runtime = 'nodejs';
export async function GET(request) {
    const startTime = Date.now();
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
        return new NextResponse(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '86400',
            },
        });
    }
    try {
        const { searchParams } = new URL(request.url);
        const phoneNumber = searchParams.get('phoneNumber');
        if (!phoneNumber) {
            return NextResponse.json({
                interactions: [],
                total: 0,
                processingTime: Date.now() - startTime,
            }, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Cache-Control': 'no-store, must-revalidate',
                },
            });
        }
        console.log(`[Connex API] Starting request for phone number ${phoneNumber}`);
        const connexService = ConnexService.getInstance();
        try {
            const interactions = await connexService.getInteractions(phoneNumber);
            const formattedInteractions = await Promise.all(interactions.map(async (interaction) => {
                const type = interaction.type_name === 'voice' ? 'call' :
                    interaction.type_name === 'sms' ? 'sms' : 'email';
                const baseMessage = {
                    id: `connex_${interaction.id}`,
                    timestamp: new Date(interaction.start_time),
                    platform: 'connex',
                    type,
                    direction: interaction.direction === 'none' ? 'outbound' :
                        interaction.direction === 'internal' ? 'outbound' : interaction.direction,
                    body: interaction.subject || `${type.toUpperCase()} Interaction`,
                    status: interaction.status_name,
                };
                if (type === 'call' && interaction.user_id) {
                    const duration = interaction.end_time
                        ? Math.round((new Date(interaction.end_time).getTime() - new Date(interaction.start_time).getTime()) / 1000)
                        : 0;
                    try {
                        const userDisplayName = await connexService.getUserDisplayName(interaction.user_id);
                        return {
                            ...baseMessage,
                            type: 'call',
                            phoneNumber: '',
                            duration,
                            userDisplayName,
                        };
                    }
                    catch (error) {
                        console.error('[Connex API] Error fetching user display name:', error);
                        return {
                            ...baseMessage,
                            type: 'call',
                            phoneNumber: '',
                            duration,
                        };
                    }
                }
                return baseMessage;
            }));
            const processingTime = Date.now() - startTime;
            console.log(`[Connex API] Request completed in ${processingTime}ms`);
            return NextResponse.json({
                interactions: formattedInteractions,
                total: formattedInteractions.length,
                processingTime,
            }, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Cache-Control': 'no-store, must-revalidate',
                },
            });
        }
        catch (error) {
            console.error('[Connex API] Error processing interactions:', error);
            return NextResponse.json({
                error: 'Request timeout or error',
                processingTime: Date.now() - startTime,
            }, {
                status: 504,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Cache-Control': 'no-store, must-revalidate',
                },
            });
        }
    }
    catch (error) {
        console.error('[Connex API] Error in GET handler:', error);
        return NextResponse.json({
            error: 'Failed to fetch interactions',
            processingTime: Date.now() - startTime,
        }, {
            status: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Cache-Control': 'no-store, must-revalidate',
            },
        });
    }
}
//# sourceMappingURL=route.js.map
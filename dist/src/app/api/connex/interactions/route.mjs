import { NextResponse } from 'next/server';
import { ConnexService } from '@/lib/api/services/connexone';
export const maxDuration = 60; // Increase max duration to 60 seconds for production
// Use nodejs runtime for better stability with external APIs
export const runtime = 'nodejs';
export const fetchCache = 'force-no-store';
export async function GET(request) {
    const startTime = Date.now();
    try {
        const { searchParams } = new URL(request.url);
        const phoneNumber = searchParams.get('phoneNumber');
        if (!phoneNumber) {
            return NextResponse.json({
                interactions: [],
                total: 0,
                processingTime: Date.now() - startTime,
            });
        }
        console.log(`[Connex API] Starting request for phone number ${phoneNumber}`);
        const connexService = ConnexService.getInstance();
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Operation timeout')), 55000);
        });
        const interactionsPromise = connexService.getInteractions(phoneNumber);
        try {
            const interactions = await Promise.any([
                interactionsPromise,
                timeoutPromise
            ]);
            const processingTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Processing timeout')), 55000));
            const processedInteractions = Promise.all(interactions.map(async (interaction) => {
                if (Date.now() - startTime > 50000) { // Leave 10s buffer
                    throw new Error('Processing time limit approaching');
                }
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
                if (type === 'call' && interaction.user_id && (Date.now() - startTime < 45000)) {
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
            const formattedInteractions = await Promise.any([
                processedInteractions,
                processingTimeout
            ]);
            const processingTime = Date.now() - startTime;
            console.log(`[Connex API] Request completed in ${processingTime}ms`);
            return NextResponse.json({
                interactions: formattedInteractions,
                total: formattedInteractions.length,
                processingTime,
            });
        }
        catch (error) {
            console.error('[Connex API] Error processing interactions:', error);
            return NextResponse.json({
                error: 'Request timeout or error',
                processingTime: Date.now() - startTime,
            }, { status: 504 });
        }
    }
    catch (error) {
        console.error('[Connex API] Error in GET handler:', error);
        return NextResponse.json({
            error: 'Failed to fetch interactions',
            processingTime: Date.now() - startTime,
        }, { status: 500 });
    }
}
//# sourceMappingURL=route.js.map
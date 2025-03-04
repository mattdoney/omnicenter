import { NextResponse } from 'next/server';
import { ConnexService } from '@/lib/api/services/connexone';
export const maxDuration = 8; // Set max duration to 8 seconds
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const phoneNumber = searchParams.get('phoneNumber');
        if (!phoneNumber) {
            return NextResponse.json({
                interactions: [],
                total: 0,
            });
        }
        const connexService = ConnexService.getInstance();
        const interactions = await connexService.getInteractions(phoneNumber);
        // Process interactions in parallel with a timeout
        const formattedInteractions = await Promise.race([
            Promise.all(interactions.map(async (interaction) => {
                const type = interaction.type_name === 'voice' ? 'call' :
                    interaction.type_name === 'sms' ? 'sms' : 'email';
                const baseMessage = {
                    id: `connex_${interaction.id}`,
                    timestamp: new Date(interaction.start_time),
                    platform: 'connex',
                    type,
                    direction: interaction.direction === 'none' ? 'outbound' : interaction.direction,
                    body: interaction.subject || `${type.toUpperCase()} Interaction`,
                    status: interaction.status_name,
                };
                // Only fetch additional data for calls
                if (type === 'call' && interaction.user_id) {
                    const duration = interaction.end_time
                        ? Math.round((new Date(interaction.end_time).getTime() - new Date(interaction.start_time).getTime()) / 1000)
                        : 0;
                    // Don't wait for user display name if it takes too long
                    const userDisplayName = await Promise.race([
                        connexService.getUserDisplayName(interaction.user_id),
                        new Promise((resolve) => setTimeout(() => resolve(undefined), 2000))
                    ]);
                    return {
                        ...baseMessage,
                        type: 'call',
                        phoneNumber: '',
                        duration,
                        userDisplayName,
                    };
                }
                return baseMessage;
            })),
            // Add a timeout for the entire operation
            new Promise((_, reject) => setTimeout(() => reject(new Error('Processing timeout')), 7000))
        ]).catch(error => {
            console.error('[Connex] Error processing interactions:', error);
            // Return partial results if we have them
            return interactions.map(interaction => ({
                id: `connex_${interaction.id}`,
                timestamp: new Date(interaction.start_time),
                platform: 'connex',
                type: interaction.type_name === 'voice' ? 'call' :
                    interaction.type_name === 'sms' ? 'sms' : 'email',
                direction: interaction.direction === 'none' ? 'outbound' : interaction.direction,
                body: interaction.subject || `${interaction.type_name.toUpperCase()} Interaction`,
                status: interaction.status_name,
            }));
        });
        return NextResponse.json({
            interactions: formattedInteractions,
            total: formattedInteractions.length,
        });
    }
    catch (error) {
        console.error('[Connex] Error in GET handler:', error);
        return NextResponse.json({ error: 'Failed to fetch interactions' }, { status: 500 });
    }
}
//# sourceMappingURL=route.js.map
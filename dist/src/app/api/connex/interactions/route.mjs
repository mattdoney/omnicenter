import { NextResponse } from 'next/server';
import { ConnexService } from '@/lib/api/services/connexone';
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
        // Process interactions in parallel
        const formattedInteractions = await Promise.all(interactions.map(async (interaction) => {
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
                const [userDisplayName] = await Promise.all([
                    connexService.getUserDisplayName(interaction.user_id),
                ]);
                const duration = interaction.end_time
                    ? Math.round((new Date(interaction.end_time).getTime() - new Date(interaction.start_time).getTime()) / 1000)
                    : 0;
                return {
                    ...baseMessage,
                    type: 'call',
                    phoneNumber: '',
                    duration,
                    userDisplayName,
                };
            }
            return baseMessage;
        }));
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
import { NextResponse } from 'next/server';
import { ConnexService } from '@/lib/api/services/connexone';
export async function GET(request) {
    console.log('[Connex] Starting GET request for interactions');
    try {
        const { searchParams } = new URL(request.url);
        const phoneNumber = searchParams.get('phoneNumber');
        if (!phoneNumber) {
            console.log('[Connex] No phone number provided');
            return NextResponse.json({
                interactions: [],
                total: 0,
            });
        }
        const connexService = ConnexService.getInstance();
        const interactions = await connexService.getInteractionsForPhoneNumber(phoneNumber);
        // Format interactions
        const formattedInteractions = await Promise.all(interactions.map(async (interaction) => {
            const type = interaction.type_name === 'voice' ? 'call' : interaction.type_name === 'sms' ? 'sms' : 'email';
            const body = interaction.subject || `${type.toUpperCase()} Interaction`;
            const baseMessage = {
                id: `connex_${interaction.id}`,
                timestamp: new Date(interaction.start_time),
                platform: 'connex',
                type,
                direction: interaction.direction === 'none' ? 'outbound' : interaction.direction,
                body,
                status: interaction.status_name,
            };
            // Add type-specific fields
            if (type === 'call') {
                const duration = interaction.end_time
                    ? Math.round((new Date(interaction.end_time).getTime() - new Date(interaction.start_time).getTime()) / 1000)
                    : 0;
                const userDisplayName = await connexService.getUserDisplayName(interaction.user_id);
                console.log(`[Connex] Call interaction ${interaction.id} has user_id:`, interaction.user_id);
                return {
                    ...baseMessage,
                    type: 'call',
                    phoneNumber: '', // We'll need to get this from another endpoint
                    duration,
                    userDisplayName,
                };
            }
            return baseMessage;
        }));
        console.log(`[Connex] Returning ${formattedInteractions.length} formatted interactions`);
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
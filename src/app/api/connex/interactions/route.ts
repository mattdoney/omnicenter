import { NextResponse } from 'next/server';
import { ConnexService } from '@/lib/api/services/connexone';
import { ConnexInteraction } from '@/types/connex';

interface BaseInteraction {
  id: string;
  timestamp: Date;
  platform: 'connex';
  type: 'call' | 'sms' | 'email';
  direction: 'inbound' | 'outbound';
  body: string;
  status: string;
}

interface CallInteraction extends BaseInteraction {
  type: 'call';
  phoneNumber: string;
  duration: number;
  userDisplayName?: string;
}

type FormattedInteraction = BaseInteraction | CallInteraction;

// Force Node.js runtime for better API compatibility
export const runtime = 'nodejs';

export async function GET(request: Request) {
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
    
    try {
      const interactions = await connexService.getInteractions(phoneNumber);
      
      const formattedInteractions = await Promise.all(
        interactions.map(async (interaction: ConnexInteraction) => {
          const type = interaction.type_name === 'voice' ? 'call' : 
                      interaction.type_name === 'sms' ? 'sms' : 'email';
          
          const baseMessage: BaseInteraction = {
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
                type: 'call' as const,
                phoneNumber: '',
                duration,
                userDisplayName,
              };
            } catch (error) {
              console.error('[Connex API] Error fetching user display name:', error);
              return {
                ...baseMessage,
                type: 'call' as const,
                phoneNumber: '',
                duration,
              };
            }
          }

          return baseMessage;
        })
      );

      const processingTime = Date.now() - startTime;
      console.log(`[Connex API] Request completed in ${processingTime}ms`);

      return NextResponse.json({
        interactions: formattedInteractions,
        total: formattedInteractions.length,
        processingTime,
      });
    } catch (error) {
      console.error('[Connex API] Error processing interactions:', error);
      return NextResponse.json(
        { 
          error: 'Request timeout or error',
          processingTime: Date.now() - startTime,
        },
        { status: 504 }
      );
    }
  } catch (error) {
    console.error('[Connex API] Error in GET handler:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch interactions',
        processingTime: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { ConnexService } from '@/lib/api/services/connexone';

interface BaseInteraction {
  id: string;
  timestamp: Date;
  platform: 'connex';
  type: 'call' | 'sms' | 'email';
  direction: string;
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

export const maxDuration = 60; // Increase max duration to 60 seconds for production

// Use nodejs runtime for better stability with external APIs
export const runtime = 'nodejs';
export const fetchCache = 'force-no-store';

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
    
    // Set a timeout for the entire operation
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Operation timeout')), 55000); // 55 second timeout
    });

    const interactionsPromise = connexService.getInteractions(phoneNumber);
    
    try {
      const interactions = await Promise.race([interactionsPromise, timeoutPromise]);
      
      // Process interactions in parallel with a timeout
      const formattedInteractions = await Promise.race<FormattedInteraction[]>([
        Promise.all(
          interactions.map(async (interaction) => {
            // Check if we're approaching the timeout
            if (Date.now() - startTime > 50000) { // Leave 10s buffer
              throw new Error('Processing time limit approaching');
            }

            const type = interaction.type_name === 'voice' ? 'call' : 
                        interaction.type_name === 'sms' ? 'sms' : 'email';
            
            const baseMessage: BaseInteraction = {
              id: `connex_${interaction.id}`,
              timestamp: new Date(interaction.start_time),
              platform: 'connex',
              type,
              direction: interaction.direction === 'none' ? 'outbound' : interaction.direction,
              body: interaction.subject || `${type.toUpperCase()} Interaction`,
              status: interaction.status_name,
            };

            // Only fetch additional data for calls if we have time
            if (type === 'call' && interaction.user_id && (Date.now() - startTime < 45000)) {
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
        ),
        new Promise<FormattedInteraction[]>((_, reject) => 
          setTimeout(() => reject(new Error('Processing timeout')), 55000)
        )
      ]).catch(error => {
        console.error('[Connex API] Error processing interactions:', error);
        // Return basic formatted interactions without additional data
        return interactions.map(interaction => ({
          id: `connex_${interaction.id}`,
          timestamp: new Date(interaction.start_time),
          platform: 'connex' as const,
          type: interaction.type_name === 'voice' ? 'call' as const : 
                interaction.type_name === 'sms' ? 'sms' as const : 'email' as const,
          direction: interaction.direction === 'none' ? 'outbound' : interaction.direction,
          body: interaction.subject || `${interaction.type_name.toUpperCase()} Interaction`,
          status: interaction.status_name,
        }));
      });

      const processingTime = Date.now() - startTime;
      console.log(`[Connex API] Request completed in ${processingTime}ms`);

      return NextResponse.json({
        interactions: formattedInteractions,
        total: formattedInteractions.length,
        processingTime,
      });
    } catch (error) {
      console.error('[Connex API] Timeout or error fetching interactions:', error);
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

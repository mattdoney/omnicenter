import { getEnvConfig } from '@/config/env';

interface ConnexInteraction {
  id: string;
  direction: 'inbound' | 'outbound' | 'internal' | 'none';
  customer_id: string;
  start_time: string;
  end_time?: string;
  subject: string;
  status_name: 'agent_reply_window_expired' | 'ended_by_customer' | 'ended' | 'new' | 'open';
  type_name: 'chat' | 'email' | 'sms' | 'voice' | 'whatsapp' | 'msteam' | 'messenger' | 'facebook_wallpost' | 'instagram_direct_message' | 'instagram_post' | 'twitter_direct_message' | 'twitter_tweet';
  user_id?: string;
}

interface ConnexResponse {
  data: ConnexInteraction[];
}

interface ConnexUser {
  data: {
    display_name: string;
    [key: string]: unknown;
  }
}

export class ConnexService {
  private static instance: ConnexService;
  private tokenCache: {
    token: string;
    expiresAt: number;
  } | null = null;
  private userDisplayNameCache: Map<string, string> = new Map();
  private API_TIMEOUT = 8000; // 8 seconds timeout
  private TOKEN_TIMEOUT: number;
  private INTERACTION_TIMEOUT: number;
  private readonly BASE_URL = 'https://hippovehicle-cxm-api.cnx1.cloud';
  private readonly AUTH_URL = 'https://apigateway-hippovehicle-cxm.cnx1.cloud';

  private constructor() {
    // Initialize timeouts based on environment
    this.TOKEN_TIMEOUT = process.env.VERCEL_ENV === 'production' ? 12000 : 8000;
    this.INTERACTION_TIMEOUT = process.env.VERCEL_ENV === 'production' ? 12000 : 8000;
    console.log(`[Connex] Initializing with timeouts - Token: ${this.TOKEN_TIMEOUT}ms, Interaction: ${this.INTERACTION_TIMEOUT}ms`);
  }

  static getInstance(): ConnexService {
    if (!ConnexService.instance) {
      ConnexService.instance = new ConnexService();
    }
    return ConnexService.instance;
  }

  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.API_TIMEOUT);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    retries = 3,
    delay = 1000,
    backoff = 1.5,
    timeout?: number
  ): Promise<T> {
    try {
      if (timeout) {
        return await Promise.race([
          operation(),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Operation timed out')), timeout)
          )
        ]);
      }
      return await operation();
    } catch (error) {
      if (retries === 0) {
        throw error;
      }
      console.log(`[Connex] Retrying operation in ${delay}ms, ${retries} retries left`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.retryWithBackoff(operation, retries - 1, delay * backoff, backoff, timeout);
    }
  }

  private async getAccessToken(): Promise<string> {
    return this.retryWithBackoff(async () => {
      console.log('[Connex] Getting access token');
      if (this.tokenCache && Date.now() < (this.tokenCache.expiresAt - 30000)) {
        console.log('[Connex] Using cached token, expires in:', Math.round((this.tokenCache.expiresAt - Date.now()) / 1000), 'seconds');
        return this.tokenCache.token;
      }

      const config = getEnvConfig();
      const clientId = config.CONNEX_CLIENT_ID;
      const clientSecret = config.CONNEX_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error('[Connex] Missing client credentials');
      }

      const tokenUrl = `${this.AUTH_URL}/oauth2/token`;
      const formData = new URLSearchParams();
      formData.append('grant_type', 'client_credentials');
      formData.append('client_id', clientId);
      formData.append('client_secret', clientSecret);

      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch access token: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.access_token || !data.expires_in) {
        throw new Error(`[Connex] Invalid token response: ${JSON.stringify(data)}`);
      }

      this.tokenCache = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in * 1000),
      };

      console.log('[Connex] Successfully retrieved new access token');
      return data.access_token;
    }, 3, 1000, 1.5, this.TOKEN_TIMEOUT);
  }

  async getUserDisplayName(userId?: string): Promise<string | undefined> {
    if (!userId) return undefined;
    
    // Check cache first
    const cachedName = this.userDisplayNameCache.get(userId);
    if (cachedName) {
      return cachedName;
    }

    try {
      const accessToken = await this.getAccessToken();
      const url = `${this.BASE_URL}/user/${userId}`;
      
      const response = await this.fetchWithTimeout(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Authorization": `Basic MjA2MzpNYW5jaGVzdGVyMSM=`,
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status !== 404) {
          console.error(`[Connex] Error fetching user ${userId}:`, response.statusText);
        }
        return undefined;
      }

      const userData: ConnexUser = await response.json();
      const displayName = userData.data.display_name;
      
      // Cache the result
      this.userDisplayNameCache.set(userId, displayName);
      
      return displayName;
    } catch (error) {
      console.error(`[Connex] Error fetching user ${userId}:`, error);
      return undefined;
    }
  }

  private formatPhoneNumber(phoneNumber: string): string {
    // Remove any spaces or special characters
    const cleaned = phoneNumber.replace(/[^\d+]/g, '');
    
    // If it already has a +, return as is
    if (cleaned.startsWith('+')) {
      return cleaned;
    }
    
    // If it starts with 00, replace with +
    if (cleaned.startsWith('00')) {
      return '+' + cleaned.slice(2);
    }
    
    // If it starts with 0, assume UK number and add +44
    if (cleaned.startsWith('0')) {
      return '+44' + cleaned.slice(1);
    }
    
    // If it starts with 44, add +
    if (cleaned.startsWith('44')) {
      return '+' + cleaned;
    }
    
    // Default case: assume UK number without leading 0
    return '+44' + cleaned;
  }

  private async makeRequest(url: string, options: RequestInit, timeout: number): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      console.log(`[Connex] Making request to ${url} with ${timeout}ms timeout`);
      const startTime = Date.now();
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      console.log(`[Connex] Request completed in ${Date.now() - startTime}ms with status ${response.status}`);
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async getInteractions(phoneNumber: string): Promise<ConnexInteraction[]> {
    return this.retryWithBackoff(async () => {
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      console.log(`[Connex] Formatted phone number from ${phoneNumber} to ${formattedNumber}`);

      const accessToken = await this.getAccessToken();
      console.log('[Connex] Successfully retrieved access token, making API request');
      
      // Try searching by phone number directly first
      const searchByPhoneUrl = `${this.BASE_URL}/interaction?filter[phone]=${encodeURIComponent(formattedNumber)}&limit=10&sort=-start_time`;
      
      try {
        const response = await this.makeRequest(searchByPhoneUrl, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "X-Authorization": "Basic MjA2MzpNYW5jaGVzdGVyMSM=",
            "Accept": "application/json",
            "Connection": "keep-alive",
            "Cache-Control": "no-cache"
          }
        }, this.INTERACTION_TIMEOUT);

        // If phone search fails, try subject search as fallback
        if (!response.ok && response.status !== 404) {
          console.log('[Connex] Phone search failed with status', response.status, 'trying subject search');
          const searchBySubjectUrl = `${this.BASE_URL}/interaction?filter[subject]=${encodeURIComponent(formattedNumber)}&limit=10&sort=-start_time`;
          
          const subjectResponse = await this.makeRequest(searchBySubjectUrl, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "X-Authorization": "Basic MjA2MzpNYW5jaGVzdGVyMSM=",
              "Accept": "application/json",
              "Connection": "keep-alive",
              "Cache-Control": "no-cache"
            }
          }, this.INTERACTION_TIMEOUT);

          if (!subjectResponse.ok) {
            if (subjectResponse.status !== 404) {
              const errorText = await subjectResponse.text();
              console.error('[Connex] Subject search failed:', subjectResponse.status, errorText);
            }
            return [];
          }

          const data: ConnexResponse = await subjectResponse.json();
          console.log(`[Connex] Subject search successful, found ${data.data?.length || 0} interactions`);
          return data.data || [];
        }

        if (!response.ok) {
          if (response.status !== 404) {
            const errorText = await response.text();
            console.error('[Connex] Phone search failed:', response.status, errorText);
          }
          return [];
        }

        const data: ConnexResponse = await response.json();
        console.log(`[Connex] Phone search successful, found ${data.data?.length || 0} interactions`);
        return data.data || [];
      } catch (error) {
        if (error instanceof Error) {
          console.error(`[Connex] Request failed: ${error.name} - ${error.message}`);
          // Rethrow to trigger retry
          throw error;
        }
        return [];
      }
    }, 3, 1000, 1.5, this.INTERACTION_TIMEOUT * 2); // Double timeout for the entire operation
  }

  async getInteractionsForPhoneNumber(phoneNumber: string): Promise<ConnexInteraction[]> {
    if (!phoneNumber) {
      console.log('[Connex] No phone number provided');
      return [];
    }

    console.log('[Connex] Fetching interactions for phone number:', phoneNumber);
    return this.getInteractions(phoneNumber);
  }

  async getInteractionsForIds(customerIds: string[]): Promise<ConnexInteraction[]> {
    console.log('[Connex] Fetching interactions for customer IDs:', customerIds);
    const allInteractions: ConnexInteraction[] = [];
    const seenInteractionIds = new Set<string>();
    
    // Process customer IDs in parallel with a concurrency limit of 5
    const batchSize = 5;
    for (let i = 0; i < customerIds.length; i += batchSize) {
      const batch = customerIds.slice(i, i + batchSize);
      console.log(`[Connex] Processing batch ${i/batchSize + 1} of ${Math.ceil(customerIds.length/batchSize)}:`, batch);
      
      const promises = batch.map(id => this.getInteractionsForCustomerId(id));
      const results = await Promise.allSettled(promises);
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const interactions = result.value;
          console.log(`[Connex] Successfully fetched ${interactions.length} interactions for customer:`, batch[index]);
          
          // Filter out duplicates
          const newInteractions = interactions.filter(interaction => {
            if (seenInteractionIds.has(interaction.id)) {
              console.log(`[Connex] Skipping duplicate interaction:`, interaction.id);
              return false;
            }
            seenInteractionIds.add(interaction.id);
            return true;
          });
          
          console.log(`[Connex] Added ${newInteractions.length} new interactions (${interactions.length - newInteractions.length} duplicates filtered)`);
          allInteractions.push(...newInteractions);
        } else {
          console.error(`[Connex] Failed to fetch interactions for customer ${batch[index]}:`, result.reason);
        }
      });
    }

    console.log(`[Connex] Total unique interactions found: ${allInteractions.length}`);
    return allInteractions;
  }

  async getInteractionsForCustomerId(customerId: string): Promise<ConnexInteraction[]> {
    console.log(`[Connex] Fetching interactions for customer ID: ${customerId}`);
    try {
      const accessToken = await this.getAccessToken();
      const url = `${this.BASE_URL}/interaction?filter[customer_id=${customerId}]`;
      console.log('[Connex] Making request to:', url);

      const response = await this.fetchWithTimeout(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Authorization": `Basic MjA2MzpNYW5jaGVzdGVyMSM=`,
          "Accept": "application/json",
        },
      });

      console.log('[Connex] Interactions response status:', response.status, response.statusText);
      const responseText = await response.text();
      console.log('[Connex] Raw response:', responseText);

      if (!response.ok) {
        if (response.status === 404) {
          console.log('[Connex] No interactions found for customer:', customerId);
          return [];
        }
        console.error('[Connex] Error response:', responseText);
        throw new Error(`Failed to fetch interactions: ${response.statusText}`);
      }

      const data: ConnexResponse = JSON.parse(responseText);
      console.log(`[Connex] Found ${data.data?.length || 0} interactions for customer:`, customerId);
      console.log('[Connex] Full response data:', JSON.stringify(data, null, 2));
      if (data.data?.length > 0) {
        console.log('[Connex] First interaction sample:', JSON.stringify(data.data[0], null, 2));
      }

      return data.data || [];
    } catch (error) {
      console.error(`[Connex] Error fetching interactions for customer ${customerId}:`, error);
      return [];
    }
  }
}

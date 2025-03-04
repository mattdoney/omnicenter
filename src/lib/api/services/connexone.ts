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

  private constructor() {}

  static getInstance(): ConnexService {
    if (!ConnexService.instance) {
      ConnexService.instance = new ConnexService();
    }
    return ConnexService.instance;
  }

  private async getAccessToken(): Promise<string> {
    console.log('[Connex] Getting access token');
    // Check if we have a valid cached token
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      console.log('[Connex] Using cached token, expires in:', Math.round((this.tokenCache.expiresAt - Date.now()) / 1000), 'seconds');
      return this.tokenCache.token;
    }

    const config = getEnvConfig();
    console.log('[Connex] Config loaded, client ID length:', config.CONNEX_CLIENT_ID?.length);
    console.log('[Connex] Config loaded, client secret length:', config.CONNEX_CLIENT_SECRET?.length);

    try {
      const tokenUrl = "https://apigateway-hippovehicle-cxm.cnx1.cloud/oauth2/token";
      console.log('[Connex] Requesting token from:', tokenUrl);
      
      const formData = new URLSearchParams();
      formData.append('grant_type', 'client_credentials');
      formData.append('client_id', config.CONNEX_CLIENT_ID || '');
      formData.append('client_secret', config.CONNEX_CLIENT_SECRET || '');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log('[Connex] Token response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Connex] Token error response:', errorText);
        throw new Error(`Failed to fetch access token: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[Connex] Token received, expires in:', data.expires_in, 'seconds');
      
      // Cache the token with expiration
      this.tokenCache = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in * 1000), // expires_in is in seconds
      };

      return data.access_token;
    } catch (error) {
      console.error("[Connex] Error fetching access token:", error);
      throw error;
    }
  }

  async getInteractions(phoneNumber: string): Promise<ConnexInteraction[]> {
    // Normalize the phone number format
    let formattedNumber = phoneNumber.replace(/^0/, '44'); // Replace leading 0 with 44
    formattedNumber = formattedNumber.replace(/^\+?44/, '44'); // Ensure consistent 44 prefix
    formattedNumber = `+${formattedNumber}`; // Add the + prefix

    console.log(`[Connex] Fetching interactions for phone number: ${formattedNumber}`);
    try {
      const accessToken = await this.getAccessToken();
      console.log('[Connex] Got access token, length:', accessToken.length);

      const encodedNumber = encodeURIComponent(formattedNumber);
      const url = `https://hippovehicle-cxm-api.cnx1.cloud/interaction?filter[subject]=${encodedNumber}`;
      console.log('[Connex] Making request to:', url);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Authorization": `Basic MjA2MzpNYW5jaGVzdGVyMSM=`,
          "Accept": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log('[Connex] Interactions response status:', response.status, response.statusText);
      const responseText = await response.text();
      console.log('[Connex] Raw response:', responseText);

      if (!response.ok) {
        if (response.status === 404) {
          console.log('[Connex] No interactions found for phone number:', formattedNumber);
          return [];
        }
        console.error('[Connex] Error response:', responseText);
        throw new Error(`Failed to fetch interactions: ${response.statusText}`);
      }

      const data: ConnexResponse = JSON.parse(responseText);
      console.log(`[Connex] Found ${data.data?.length || 0} interactions for phone number:`, formattedNumber);
      console.log('[Connex] Full response data:', JSON.stringify(data, null, 2));

      return data.data || [];
    } catch (error) {
      console.error(`[Connex] Error fetching interactions for phone number ${phoneNumber}:`, error);
      return [];
    }
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
      console.log('[Connex] Got access token, length:', accessToken.length);

      const url = `https://hippovehicle-cxm-api.cnx1.cloud/interaction?filter[customer_id=${customerId}]`;
      console.log('[Connex] Making request to:', url);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Authorization": `Basic MjA2MzpNYW5jaGVzdGVyMSM=`,
          "Accept": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

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

  async getUserDisplayName(userId: string | undefined): Promise<string | null> {
    if (!userId) {
      console.log('[Connex] No user ID provided');
      return null;
    }

    try {
      const accessToken = await this.getAccessToken();
      console.log('[Connex] Getting user info for ID:', userId);

      const url = `https://hippovehicle-cxm-api.cnx1.cloud/user/${userId}`;
      console.log('[Connex] Making request to:', url);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Authorization": `Basic MjA2MzpNYW5jaGVzdGVyMSM=`,
          "Accept": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          console.log('[Connex] No user found for ID:', userId);
          return null;
        }
        throw new Error(`Failed to fetch user: ${response.statusText}`);
      }

      const data: ConnexUser = await response.json();
      console.log('[Connex] Found user:', data);
      return data.data.display_name;
    } catch (error) {
      console.error(`[Connex] Error fetching user for ID ${userId}:`, error);
      return null;
    }
  }
}

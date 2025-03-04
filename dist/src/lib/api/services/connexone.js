import { getEnvConfig } from '@/config/env';
export class ConnexService {
    static instance;
    tokenCache = null;
    userDisplayNameCache = new Map();
    API_TIMEOUT = 8000; // 8 seconds timeout
    constructor() { }
    static getInstance() {
        if (!ConnexService.instance) {
            ConnexService.instance = new ConnexService();
        }
        return ConnexService.instance;
    }
    async fetchWithTimeout(url, options) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.API_TIMEOUT);
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            return response;
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
    async getAccessToken() {
        console.log('[Connex] Getting access token');
        // Check if we have a valid cached token with 30s buffer
        if (this.tokenCache && Date.now() < (this.tokenCache.expiresAt - 30000)) {
            console.log('[Connex] Using cached token, expires in:', Math.round((this.tokenCache.expiresAt - Date.now()) / 1000), 'seconds');
            return this.tokenCache.token;
        }
        const config = getEnvConfig();
        try {
            const tokenUrl = "https://apigateway-hippovehicle-cxm.cnx1.cloud/oauth2/token";
            const formData = new URLSearchParams();
            formData.append('grant_type', 'client_credentials');
            formData.append('client_id', config.CONNEX_CLIENT_ID || '');
            formData.append('client_secret', config.CONNEX_CLIENT_SECRET || '');
            const response = await this.fetchWithTimeout(tokenUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json",
                },
                body: formData,
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch access token: ${response.statusText}`);
            }
            const data = await response.json();
            this.tokenCache = {
                token: data.access_token,
                expiresAt: Date.now() + (data.expires_in * 1000),
            };
            return data.access_token;
        }
        catch (error) {
            console.error("[Connex] Error fetching access token:", error);
            throw error;
        }
    }
    async getUserDisplayName(userId) {
        if (!userId)
            return undefined;
        // Check cache first
        const cachedName = this.userDisplayNameCache.get(userId);
        if (cachedName) {
            return cachedName;
        }
        try {
            const accessToken = await this.getAccessToken();
            const url = `https://hippovehicle-cxm-api.cnx1.cloud/user/${userId}`;
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
            const userData = await response.json();
            const displayName = userData.data.display_name;
            // Cache the result
            this.userDisplayNameCache.set(userId, displayName);
            return displayName;
        }
        catch (error) {
            console.error(`[Connex] Error fetching user ${userId}:`, error);
            return undefined;
        }
    }
    async getInteractions(phoneNumber) {
        const formattedNumber = phoneNumber.startsWith('0')
            ? `+44${phoneNumber.substring(1)}`
            : phoneNumber.startsWith('+44')
                ? phoneNumber
                : `+44${phoneNumber}`;
        try {
            const accessToken = await this.getAccessToken();
            const encodedNumber = encodeURIComponent(formattedNumber);
            // Fix the filter syntax and add limit to speed up response
            const url = `https://hippovehicle-cxm-api.cnx1.cloud/interaction?filter[subject]=${encodedNumber}&limit=10&sort=-start_time`;
            const response = await this.fetchWithTimeout(url, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "X-Authorization": `Basic MjA2MzpNYW5jaGVzdGVyMSM=`,
                    "Accept": "application/json",
                },
            });
            if (!response.ok) {
                if (response.status === 404) {
                    return [];
                }
                const errorText = await response.text();
                console.error('[Connex] Error response:', errorText);
                throw new Error(`Failed to fetch interactions: ${response.statusText}`);
            }
            const data = await response.json();
            return data.data || [];
        }
        catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.error(`[Connex] Request timed out after ${this.API_TIMEOUT}ms`);
                return [];
            }
            console.error(`[Connex] Error fetching interactions for phone number ${phoneNumber}:`, error);
            return [];
        }
    }
    async getInteractionsForPhoneNumber(phoneNumber) {
        if (!phoneNumber) {
            console.log('[Connex] No phone number provided');
            return [];
        }
        console.log('[Connex] Fetching interactions for phone number:', phoneNumber);
        return this.getInteractions(phoneNumber);
    }
    async getInteractionsForIds(customerIds) {
        console.log('[Connex] Fetching interactions for customer IDs:', customerIds);
        const allInteractions = [];
        const seenInteractionIds = new Set();
        // Process customer IDs in parallel with a concurrency limit of 5
        const batchSize = 5;
        for (let i = 0; i < customerIds.length; i += batchSize) {
            const batch = customerIds.slice(i, i + batchSize);
            console.log(`[Connex] Processing batch ${i / batchSize + 1} of ${Math.ceil(customerIds.length / batchSize)}:`, batch);
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
                }
                else {
                    console.error(`[Connex] Failed to fetch interactions for customer ${batch[index]}:`, result.reason);
                }
            });
        }
        console.log(`[Connex] Total unique interactions found: ${allInteractions.length}`);
        return allInteractions;
    }
    async getInteractionsForCustomerId(customerId) {
        console.log(`[Connex] Fetching interactions for customer ID: ${customerId}`);
        try {
            const accessToken = await this.getAccessToken();
            const url = `https://hippovehicle-cxm-api.cnx1.cloud/interaction?filter[customer_id=${customerId}]`;
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
            const data = JSON.parse(responseText);
            console.log(`[Connex] Found ${data.data?.length || 0} interactions for customer:`, customerId);
            console.log('[Connex] Full response data:', JSON.stringify(data, null, 2));
            if (data.data?.length > 0) {
                console.log('[Connex] First interaction sample:', JSON.stringify(data.data[0], null, 2));
            }
            return data.data || [];
        }
        catch (error) {
            console.error(`[Connex] Error fetching interactions for customer ${customerId}:`, error);
            return [];
        }
    }
}
//# sourceMappingURL=connexone.js.map
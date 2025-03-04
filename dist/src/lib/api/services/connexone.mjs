import { getEnvConfig } from '@/config/env';
import axios from 'axios';
import https from 'https';
export class ConnexService {
    static instance;
    tokenCache = null;
    constructor() { }
    static getInstance() {
        if (!ConnexService.instance) {
            ConnexService.instance = new ConnexService();
        }
        return ConnexService.instance;
    }
    async getAccessToken() {
        console.log('[Connex] Getting access token');
        // Check if we have a valid cached token
        if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
            console.log('[Connex] Using cached token, expires in:', Math.round((this.tokenCache.expiresAt - Date.now()) / 1000), 'seconds');
            return this.tokenCache.token;
        }
        const config = getEnvConfig();
        if (!config.CONNEX_CLIENT_ID || !config.CONNEX_CLIENT_SECRET) {
            console.error('[Connex] Missing client credentials:', {
                hasClientId: !!config.CONNEX_CLIENT_ID,
                hasClientSecret: !!config.CONNEX_CLIENT_SECRET
            });
            throw new Error('Missing Connex client credentials');
        }
        console.log('[Connex] Config loaded, client ID length:', config.CONNEX_CLIENT_ID.length);
        console.log('[Connex] Config loaded, client secret length:', config.CONNEX_CLIENT_SECRET.length);
        try {
            const tokenUrl = "https://apigateway-hippovehicle-cxm.cnx1.cloud/oauth2/token";
            console.log('[Connex] Requesting token from:', tokenUrl);
            const formData = new URLSearchParams();
            formData.append('grant_type', 'client_credentials');
            formData.append('client_id', config.CONNEX_CLIENT_ID);
            formData.append('client_secret', config.CONNEX_CLIENT_SECRET);
            const instance = axios.create({
                timeout: 30000,
                httpsAgent: new https.Agent({
                    keepAlive: true,
                    keepAliveMsecs: 1000,
                    rejectUnauthorized: true
                }),
                validateStatus: (status) => status < 500
            });
            const response = await instance.post(tokenUrl, formData.toString(), {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json",
                }
            });
            console.log('[Connex] Token response status:', response.status);
            console.log('[Connex] Response headers:', JSON.stringify(response.headers, null, 2));
            if (!response.data) {
                console.log('[Connex] Empty response received');
                throw new Error('Empty response received');
            }
            const data = response.data;
            if (!data.access_token) {
                console.error('[Connex] No access token in response:', data);
                throw new Error('No access token in response');
            }
            console.log('[Connex] Token received, expires in:', data.expires_in, 'seconds');
            // Cache the token with expiration
            this.tokenCache = {
                token: data.access_token,
                expiresAt: Date.now() + (data.expires_in * 1000), // expires_in is in seconds
            };
            return data.access_token;
        }
        catch (error) {
            console.error("[Connex] Error fetching access token:", error);
            if (axios.isAxiosError(error)) {
                console.error('[Connex] Axios error details:', {
                    code: error.code,
                    message: error.message,
                    response: error.response?.data,
                    status: error.response?.status,
                    headers: error.response?.headers,
                });
            }
            throw error;
        }
    }
    async getInteractions(phoneNumber) {
        // Normalize the phone number format
        let formattedNumber = phoneNumber.replace(/^0/, '44'); // Replace leading 0 with 44
        formattedNumber = formattedNumber.replace(/^\+?44/, '44'); // Ensure consistent 44 prefix
        formattedNumber = `+${formattedNumber}`; // Add the + prefix
        console.log(`[Connex] Fetching interactions for phone number: ${formattedNumber}`);
        try {
            const accessToken = await this.getAccessToken();
            if (!accessToken) {
                console.error('[Connex] Failed to get access token');
                return [];
            }
            console.log('[Connex] Got access token, length:', accessToken.length);
            const encodedNumber = encodeURIComponent(formattedNumber);
            const url = `https://hippovehicle-cxm-api.cnx1.cloud/interaction?filter[subject]=${encodedNumber}`;
            console.log('[Connex] Making request to:', url);
            // Create custom axios instance with longer timeout and keepAlive
            const instance = axios.create({
                timeout: 30000,
                httpsAgent: new https.Agent({
                    keepAlive: true,
                    keepAliveMsecs: 1000,
                    rejectUnauthorized: true
                }),
                validateStatus: (status) => status < 500
            });
            // Log request details
            const headers = {
                Authorization: `Bearer ${accessToken}`,
                "X-Authorization": `Basic MjA2MzpNYW5jaGVzdGVyMSM=`,
                "Accept": "application/json",
            };
            console.log('[Connex] Request headers:', JSON.stringify(headers, null, 2));
            const response = await instance.get(url, { headers });
            console.log('[Connex] Response status:', response.status);
            console.log('[Connex] Response headers:', JSON.stringify(response.headers, null, 2));
            if (response.status === 404) {
                console.log('[Connex] No interactions found for phone number:', formattedNumber);
                return [];
            }
            if (!response.data) {
                console.log('[Connex] Empty response received');
                return [];
            }
            const data = response.data;
            console.log(`[Connex] Found ${data.data?.length || 0} interactions for phone number:`, formattedNumber);
            return data.data || [];
        }
        catch (error) {
            console.error(`[Connex] Error fetching interactions for phone number ${phoneNumber}:`, error);
            if (axios.isAxiosError(error)) {
                console.error('[Connex] Axios error details:', {
                    code: error.code,
                    message: error.message,
                    response: error.response?.data,
                    status: error.response?.status,
                    headers: error.response?.headers,
                });
            }
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
            console.log('[Connex] Got access token, length:', accessToken.length);
            const url = `https://hippovehicle-cxm-api.cnx1.cloud/interaction?filter[customer_id=${customerId}]`;
            console.log('[Connex] Making request to:', url);
            // Create custom axios instance with longer timeout and keepAlive
            const instance = axios.create({
                timeout: 30000,
                httpsAgent: new https.Agent({
                    keepAlive: true,
                    keepAliveMsecs: 1000,
                    rejectUnauthorized: true
                }),
                validateStatus: (status) => status < 500
            });
            // Log request details
            const headers = {
                Authorization: `Bearer ${accessToken}`,
                "X-Authorization": `Basic MjA2MzpNYW5jaGVzdGVyMSM=`,
                "Accept": "application/json",
            };
            console.log('[Connex] Request headers:', JSON.stringify(headers, null, 2));
            const response = await instance.get(url, { headers });
            console.log('[Connex] Response status:', response.status);
            console.log('[Connex] Response headers:', JSON.stringify(response.headers, null, 2));
            if (response.status === 404) {
                console.log('[Connex] No interactions found for customer:', customerId);
                return [];
            }
            if (!response.data) {
                console.log('[Connex] Empty response received');
                return [];
            }
            const data = response.data;
            console.log(`[Connex] Found ${data.data?.length || 0} interactions for customer:`, customerId);
            console.log('[Connex] Full response data:', JSON.stringify(data, null, 2));
            if (data.data?.length > 0) {
                console.log('[Connex] First interaction sample:', JSON.stringify(data.data[0], null, 2));
            }
            return data.data || [];
        }
        catch (error) {
            console.error(`[Connex] Error fetching interactions for customer ${customerId}:`, error);
            if (axios.isAxiosError(error)) {
                console.error('[Connex] Axios error details:', {
                    code: error.code,
                    message: error.message,
                    response: error.response?.data,
                    status: error.response?.status,
                    headers: error.response?.headers,
                });
            }
            return [];
        }
    }
    async getUserDisplayName(userId) {
        if (!userId) {
            console.log('[Connex] No user ID provided');
            return null;
        }
        try {
            const accessToken = await this.getAccessToken();
            console.log('[Connex] Getting user info for ID:', userId);
            const url = `https://hippovehicle-cxm-api.cnx1.cloud/user/${userId}`;
            console.log('[Connex] Making request to:', url);
            // Create custom axios instance with longer timeout and keepAlive
            const instance = axios.create({
                timeout: 30000,
                httpsAgent: new https.Agent({
                    keepAlive: true,
                    keepAliveMsecs: 1000,
                    rejectUnauthorized: true
                }),
                validateStatus: (status) => status < 500
            });
            // Log request details
            const headers = {
                Authorization: `Bearer ${accessToken}`,
                "X-Authorization": `Basic MjA2MzpNYW5jaGVzdGVyMSM=`,
                "Accept": "application/json",
            };
            console.log('[Connex] Request headers:', JSON.stringify(headers, null, 2));
            const response = await instance.get(url, { headers });
            console.log('[Connex] Response status:', response.status);
            console.log('[Connex] Response headers:', JSON.stringify(response.headers, null, 2));
            if (response.status === 404) {
                console.log('[Connex] No user found for ID:', userId);
                return null;
            }
            if (!response.data) {
                console.log('[Connex] Empty response received');
                return null;
            }
            const data = response.data;
            console.log('[Connex] Found user:', data);
            return data.data.display_name;
        }
        catch (error) {
            console.error(`[Connex] Error fetching user for ID ${userId}:`, error);
            if (axios.isAxiosError(error)) {
                console.error('[Connex] Axios error details:', {
                    code: error.code,
                    message: error.message,
                    response: error.response?.data,
                    status: error.response?.status,
                    headers: error.response?.headers,
                });
            }
            return null;
        }
    }
}
//# sourceMappingURL=connexone.js.map
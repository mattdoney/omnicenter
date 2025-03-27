export class TwilioService {
    static instance;
    baseUrl = '/api/twilio';
    constructor() { }
    static getInstance() {
        if (!TwilioService.instance) {
            TwilioService.instance = new TwilioService();
        }
        return TwilioService.instance;
    }
    async getMessages(params) {
        try {
            // Extract phone numbers from associated identifiers
            const phoneIdentifiers = params.associatedIdentifiers
                ?.filter(id => id.type === 'phone')
                .map(id => id.id) || [];
            // Add the direct phone number if it exists
            if (params.phoneNumber && !phoneIdentifiers.includes(params.phoneNumber)) {
                phoneIdentifiers.push(params.phoneNumber);
            }
            // If no phone numbers found, return empty array
            if (phoneIdentifiers.length === 0) {
                return [];
            }
            // Make API call with all phone numbers
            const response = await fetch(`${this.baseUrl}/messages?` +
                new URLSearchParams({
                    phoneNumbers: JSON.stringify(phoneIdentifiers)
                }));
            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: response.statusText }));
                throw new Error(error.error || 'Failed to fetch messages');
            }
            const data = await response.json();
            return data.messages;
        }
        catch (error) {
            console.error('Error fetching Twilio messages:', error);
            return [];
        }
    }
    async sendMessage(to, body) {
        try {
            const response = await fetch(`${this.baseUrl}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    phoneNumber: to,
                    message: body,
                }),
            });
            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: response.statusText }));
                throw new Error(error.error || 'Failed to send message');
            }
            return response.json();
        }
        catch (error) {
            console.error('Error sending Twilio message:', error);
            throw error;
        }
    }
}
//# sourceMappingURL=twilio.js.map
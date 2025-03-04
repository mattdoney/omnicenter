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
        if (!params.phoneNumber) {
            return [];
        }
        try {
            const response = await fetch(`${this.baseUrl}/messages?` +
                new URLSearchParams({
                    phoneNumber: params.phoneNumber
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
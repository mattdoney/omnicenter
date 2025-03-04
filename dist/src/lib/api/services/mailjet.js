export class MailjetService {
    static instance;
    baseUrl = '/api/mailjet';
    constructor() { }
    static getInstance() {
        if (!MailjetService.instance) {
            MailjetService.instance = new MailjetService();
        }
        return MailjetService.instance;
    }
    async getMessages(params) {
        if (!params.emailAddress) {
            return [];
        }
        try {
            const response = await fetch(`${this.baseUrl}/messages?` +
                new URLSearchParams({
                    emailAddress: params.emailAddress
                }));
            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: response.statusText }));
                throw new Error(error.error || 'Failed to fetch messages');
            }
            const data = await response.json();
            return data.messages;
        }
        catch (error) {
            console.error('Error fetching Mailjet messages:', error);
            return [];
        }
    }
    async sendMessage(to, subject, text) {
        try {
            const response = await fetch(`${this.baseUrl}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to,
                    subject,
                    text,
                }),
            });
            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: response.statusText }));
                throw new Error(error.error || 'Failed to send message');
            }
            return response.json();
        }
        catch (error) {
            console.error('Error sending Mailjet message:', error);
            throw error;
        }
    }
}
//# sourceMappingURL=mailjet.js.map
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
        try {
            // Extract email addresses from associated identifiers
            const emailIdentifiers = params.associatedIdentifiers
                ?.filter(id => id.type === 'email')
                .map(id => id.id) || [];
            // Add the direct email address if it exists
            if (params.emailAddress && !emailIdentifiers.includes(params.emailAddress)) {
                emailIdentifiers.push(params.emailAddress);
            }
            // If no email addresses found, return empty array
            if (emailIdentifiers.length === 0) {
                return [];
            }
            // Make API call with all email addresses
            const response = await fetch(`${this.baseUrl}/messages?` +
                new URLSearchParams({
                    emailAddresses: JSON.stringify(emailIdentifiers)
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
import { TwilioService } from './services/twilio';
import { MailjetService } from './services/mailjet';
export class APIClient {
    static instance;
    twilioService;
    mailjetService;
    constructor() {
        this.twilioService = TwilioService.getInstance();
        this.mailjetService = MailjetService.getInstance();
    }
    static getInstance() {
        if (!APIClient.instance) {
            APIClient.instance = new APIClient();
        }
        return APIClient.instance;
    }
    static async get(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    }
    static async post(url, data) {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    }
    async getMessages(params) {
        try {
            // Get messages from all services
            const [twilioMessages, mailjetMessages] = await Promise.all([
                this.twilioService.getMessages(params),
                this.mailjetService.getMessages(params)
            ]);
            // Create a Map to deduplicate messages by ID
            const messageMap = new Map();
            // Add messages from each service, ensuring no duplicates
            twilioMessages.forEach(msg => messageMap.set(msg.id, msg));
            mailjetMessages.forEach(msg => messageMap.set(msg.id, msg));
            // Convert Map back to array and sort
            const messages = Array.from(messageMap.values()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            return {
                messages,
                total: messages.length,
            };
        }
        catch (error) {
            console.error('Error fetching messages:', error);
            throw error;
        }
    }
    async sendMessage(params) {
        try {
            if (params.phoneNumber && params.body) {
                return await this.twilioService.sendMessage(params.phoneNumber, params.body);
            }
            else if (params.emailAddress && params.body) {
                return await this.mailjetService.sendMessage(params.emailAddress, params.subject || 'New Message', params.body);
            }
            else {
                throw new Error('Invalid message parameters: must include either phoneNumber or emailAddress, and body');
            }
        }
        catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }
}
//# sourceMappingURL=client.js.map
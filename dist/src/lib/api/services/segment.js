export class SegmentService {
    static instance;
    constructor() { }
    static getInstance() {
        if (!SegmentService.instance) {
            SegmentService.instance = new SegmentService();
        }
        return SegmentService.instance;
    }
    formatPhoneNumber(phoneNumber) {
        // Remove any non-digit characters except +
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
    async getExternalIds(identifier) {
        const response = await fetch(`/api/segment/external-ids?identifier=${encodeURIComponent(identifier)}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch external IDs: ${response.statusText}`);
        }
        return response.json();
    }
    async findPhoneNumberFromEmail(email) {
        try {
            const response = await this.getExternalIds(email);
            const phoneIds = response.data.filter(id => id.type === 'phone');
            // Find the first phone number that starts with +
            const formattedPhone = phoneIds.find(id => id.id.startsWith('+'));
            return formattedPhone?.id || null;
        }
        catch (error) {
            console.error('Error finding phone number:', error);
            return null;
        }
    }
    async findEmailFromPhoneNumber(phoneNumber) {
        try {
            const formattedPhone = this.formatPhoneNumber(phoneNumber);
            const response = await this.getExternalIds(formattedPhone);
            const emailIds = response.data.filter(id => id.type === 'email');
            // Return the first email found
            return emailIds[0]?.id.toLowerCase() || null;
        }
        catch (error) {
            console.error('Error finding email:', error);
            return null;
        }
    }
}
//# sourceMappingURL=segment.js.map
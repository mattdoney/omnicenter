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
        // Remove any non-digit characters
        const cleaned = phoneNumber.replace(/\D/g, '');
        // Handle UK numbers
        if (cleaned.startsWith('07') || cleaned.startsWith('447')) {
            // Remove leading 0 if present and add +44
            const withoutLeadingZero = cleaned.startsWith('0') ? cleaned.slice(1) : cleaned;
            return withoutLeadingZero.startsWith('44') ? `+${withoutLeadingZero}` : `+44${withoutLeadingZero}`;
        }
        return `+${cleaned}`;
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
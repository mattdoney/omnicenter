interface SegmentExternalId {
  id: string;
  type: string;
  source_id: string;
  collection: string;
  created_at: string;
  encoding: string;
  first_message_id: string;
}

interface SegmentResponse {
  data: SegmentExternalId[];
  cursor: {
    url: string;
    has_more: boolean;
    next: string;
    limit: number;
  };
}

export class SegmentService {
  private static instance: SegmentService;

  private constructor() {}

  static getInstance(): SegmentService {
    if (!SegmentService.instance) {
      SegmentService.instance = new SegmentService();
    }
    return SegmentService.instance;
  }

  private formatPhoneNumber(phoneNumber: string): string {
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

  async getExternalIds(identifier: string): Promise<SegmentResponse> {
    const response = await fetch(`/api/segment/external-ids?identifier=${encodeURIComponent(identifier)}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch external IDs: ${response.statusText}`);
    }

    return response.json();
  }

  async findPhoneNumberFromEmail(email: string): Promise<string | null> {
    try {
      const response = await this.getExternalIds(email);
      const phoneIds = response.data.filter(id => id.type === 'phone');
      
      // Find the first phone number that starts with +
      const formattedPhone = phoneIds.find(id => id.id.startsWith('+'));
      return formattedPhone?.id || null;
    } catch (error) {
      console.error('Error finding phone number:', error);
      return null;
    }
  }

  async findEmailFromPhoneNumber(phoneNumber: string): Promise<string | null> {
    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      const response = await this.getExternalIds(formattedPhone);
      const emailIds = response.data.filter(id => id.type === 'email');
      
      // Return the first email found
      return emailIds[0]?.id.toLowerCase() || null;
    } catch (error) {
      console.error('Error finding email:', error);
      return null;
    }
  }
}

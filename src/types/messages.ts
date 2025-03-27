export type MessageType = 'sms' | 'email' | 'whatsapp' | 'call';
export type MessageDirection = 'inbound' | 'outbound';
export type MessagePlatform = 'twilio' | 'mailjet' | 'whatsapp' | 'connexone';

export interface MessageAttachment {
  name: string;
  url: string;
  contentType?: string;
  size?: number;
}

export interface UnifiedMessage {
  id: string;
  timestamp: Date;
  platform: MessagePlatform;
  type: MessageType;
  direction: MessageDirection;
  body?: string;
  emailAddress?: string;
  phoneNumber?: string;
  status?: string;
  isOpened?: boolean;
  subject?: string;
  duration?: number;
  userDisplayName?: string;
  recordingUrl?: string;
  attachments?: MessageAttachment[];
}

export interface EmailMessage extends UnifiedMessage {
  type: 'email';
  emailAddress: string;
  subject?: string;
  isOpened?: boolean;
  body: string;
  attachments?: MessageAttachment[];
}

export interface SMSMessage extends UnifiedMessage {
  type: 'sms';
  phoneNumber: string;
  body: string;
}

export interface CallMessage extends UnifiedMessage {
  type: 'call';
  phoneNumber: string;
  duration: number;
  userDisplayName?: string;
  status: string;
  body: string;
}

export interface ExternalIdentifier {
  id: string;
  type: string;
  source_id?: string;
  collection?: string;
  created_at?: string;
  encoding?: string;
  first_message_id?: string;
}

export interface MessageQueryParams {
  phoneNumber?: string;
  emailAddress?: string;
  customerIds?: string[];
  associatedIdentifiers?: ExternalIdentifier[];
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

export interface MessageQueryResult {
  messages: UnifiedMessage[];
  total: number;
}

export interface SendMessageParams {
  phoneNumber?: string;
  emailAddress?: string;
  body: string;
  subject?: string;
}

// Twilio API Types
export interface TwilioMessage {
  account_sid: string;
  api_version: string;
  body: string;
  date_created: string;
  date_sent: string;
  date_updated: string;
  direction: 'inbound-api' | 'outbound-api' | 'inbound' | 'outbound';
  error_code: string | null;
  error_message: string | null;
  from: string;
  messaging_service_sid: string;
  num_media: string;
  num_segments: string;
  price: string | null;
  price_unit: string | null;
  sid: string;
  status: string;
  to: string;
  uri: string;
}

export interface ContactInfo {
  id: string;
  name?: string;
  phoneNumber?: string;
  emailAddress?: string;
  company?: string;
  lastContact?: Date;
  tags?: string[];
}

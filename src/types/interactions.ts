export interface BaseInteraction {
  id: string;
  timestamp: Date;
  platform: 'connex';
  type: 'call' | 'sms' | 'email';
  direction: 'inbound' | 'outbound';
  body: string;
  status: string;
}

export interface CallInteraction extends BaseInteraction {
  type: 'call';
  phoneNumber: string;
  duration: number;
  userDisplayName?: string;
}

export type FormattedInteraction = BaseInteraction | CallInteraction;

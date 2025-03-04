export interface ConnexInteraction {
  id: string;
  type_name: 'voice' | 'sms' | 'email' | 'chat' | 'whatsapp' | 'msteam' | 'messenger' | 'facebook_wallpost' | 'instagram_direct_message' | 'instagram_post' | 'twitter_direct_message' | 'twitter_tweet';
  start_time: string;
  end_time?: string;
  direction: 'inbound' | 'outbound' | 'none' | 'internal';
  subject?: string;
  status_name: string;
  user_id?: string;
}

export interface ConnexUser {
  id: string;
  display_name: string;
  email?: string;
  status?: string;
}

export interface ConnexResponse<T> {
  data: T;
  status: number;
  message?: string;
}

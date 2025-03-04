export function getEnvConfig() {
    const config = {
        // Twilio
        TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
        TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
        TWILIO_SUB_ACCOUNT_SID: process.env.TWILIO_SUB_ACCOUNT_SID || '',
        TWILIO_SUB_AUTH_TOKEN: process.env.TWILIO_SUB_AUTH_TOKEN || '',
        TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || '',
        // Mailjet
        MAILJET_API_KEY: process.env.MAILJET_API_KEY || '',
        MAILJET_API_SECRET: process.env.MAILJET_API_SECRET || '',
        MAILJET_SENDER_EMAIL: process.env.MAILJET_SENDER_EMAIL || '',
        // Connex
        CONNEX_CLIENT_ID: process.env.CONNEX_CLIENT_ID || '',
        CONNEX_CLIENT_SECRET: process.env.CONNEX_CLIENT_SECRET || '',
        // Segment
        SEGMENT_WRITE_KEY: process.env.SEGMENT_WRITE_KEY || '',
        SEGMENT_SPACE_ID: process.env.SEGMENT_SPACE_ID || '',
        SEGMENT_AUTH_TOKEN: process.env.SEGMENT_AUTH_TOKEN || '',
        // Redis
        REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    };
    return config;
}
//# sourceMappingURL=env.js.map
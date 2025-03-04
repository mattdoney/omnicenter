# OmniCenter Communication Hub

A unified communication hub that aggregates email and SMS interactions from multiple platforms (Twilio, Mailjet, Connex One, and Segment) into a single, WhatsApp-like timeline interface.

## Features

- **Unified Timeline**: View all communications (SMS, email, calls) in a single, chronological feed
- **Multi-Platform Integration**: 
  - Twilio (2 accounts) for SMS and calls
  - Mailjet for email communications
  - Connex One for omni-channel communications
  - Segment for customer data
- **Two Deployment Options**:
  - Standalone web application
  - Embeddable widget for CRM integration
- **Real-time Updates**: Live updates of new communications
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Prerequisites

Before you begin, ensure you have:
- Node.js 18.x or later
- npm or yarn package manager
- API credentials for all integrated services

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_main_account_sid
TWILIO_AUTH_TOKEN=your_main_auth_token
TWILIO_SUB_ACCOUNT_SID=your_sub_account_sid
TWILIO_SUB_AUTH_TOKEN=your_sub_auth_token

# Mailjet Configuration
MAILJET_API_KEY=your_mailjet_api_key
MAILJET_API_SECRET=your_mailjet_api_secret

# Connex One Configuration
CONNEX_ONE_API_KEY=your_connex_one_api_key
CONNEX_ONE_API_URL=your_connex_one_api_url

# Segment Configuration
SEGMENT_WRITE_KEY=your_segment_write_key
```

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```
3. Set up environment variables as described above
4. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

## Usage

### Standalone Web Application
1. Open the application in your browser
2. Enter a phone number or email address in the search field
3. View the unified timeline of all communications

### Embeddable Widget
To integrate the widget into your CRM:

1. Add the widget script to your HTML:
   ```html
   <script src="https://your-domain.com/widget.js"></script>
   ```

2. Initialize the widget with configuration:
   ```javascript
   OmniCenter.init({
     containerId: 'omnicenter-widget',
     identifier: 'user@example.com' // or phone number
   });
   ```

## Development

- Built with Next.js 14 App Router
- Uses TypeScript for type safety
- Styled with Tailwind CSS
- Real-time updates with WebSocket/SWR
- Caching with Redis

## Testing

Run the test suite:

```bash
npm test
# or
yarn test
```

## Deployment

The application can be deployed to Vercel with zero configuration:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/omnicenter)

For other platforms, build the application:

```bash
npm run build
# or
yarn build
```

## License

[MIT](LICENSE)

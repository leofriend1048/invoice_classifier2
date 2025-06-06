# Gmail Invoice Processing Setup Guide

## 🚀 Quick Start

Your Gmail webhook system is now implemented! Follow these steps to get it running:

### 1. Environment Variables

Create a `.env.local` file in your project root with:

```bash
# Google OAuth2 Credentials
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://0d58-158-62-27-143.ngrok-free.app/api/gmail/oauth2callback

# Gmail API Configuration
GMAIL_WATCH_TOPIC=projects/reel-fuse/topics/invoice-emails
GMAIL_TARGET_EMAIL=mtbinvoice@gmail.com

# Supabase Configuration (add your actual values)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# OpenAI API Key (for GPT-4o)
OPENAI_API_KEY=your_openai_api_key
```

### 2. Authentication Flow

1. **Start your development server:**

   ```bash
   npm run dev
   ```

2. **Start ngrok (in another terminal):**

   ```bash
   ngrok http 3000
   ```

3. **Initiate OAuth2 authentication:**
   Visit: `http://localhost:3000/api/gmail/oauth2initiate`

   This will redirect you to Google's OAuth consent screen.

4. **Complete authentication:**
   - Sign in with the `mtbinvoice@gmail.com` account
   - Grant the requested permissions
   - You'll be redirected back to your callback URL
   - Tokens will be stored in `gmail-tokens.json`

### 3. Verify Setup

After authentication, you can verify the setup by calling:

```bash
curl -X POST http://localhost:3000/api/gmail/setup-watch
```

This should return a success message if Gmail watch is properly configured.

## 📋 API Endpoints Created

| Endpoint                     | Method | Purpose                       |
| ---------------------------- | ------ | ----------------------------- |
| `/api/gmail/oauth2initiate`  | GET    | Start OAuth2 flow             |
| `/api/gmail/oauth2callback`  | GET    | Handle OAuth2 callback        |
| `/api/gmail/webhook`         | POST   | Receive Pub/Sub notifications |
| `/api/gmail/setup-watch`     | POST   | Manually setup Gmail watch    |
| `/api/gmail/process-invoice` | POST   | Process invoice with GPT-4o   |

## 🔧 How It Works

1. **Email Reception**: When an email with invoice attachments is sent to `mtbinvoice@gmail.com`, Gmail triggers a Pub/Sub notification.

2. **Webhook Processing**: Your `/api/gmail/webhook` endpoint receives the notification and:

   - Downloads the email and attachments
   - Filters for invoice-like files (PDFs/images with invoice keywords)
   - Uploads attachments to Supabase Storage
   - Creates initial invoice records in the database

3. **OCR & Classification**: The system can process invoices with GPT-4o by calling `/api/gmail/process-invoice` with an invoice ID.

4. **Data Storage**: All data is stored in your Supabase tables with the `invoice_class_` prefix.

## 🛠 Testing

To test the system:

1. **Send a test email** with a PDF attachment containing "invoice" in the filename to `mtbinvoice@gmail.com`

2. **Check your webhook logs** in the Next.js console to see if the notification was received

3. **Check your Supabase database** to see if a new invoice record was created

4. **Process the invoice** by calling the process-invoice API with the invoice ID

## 📁 File Structure Created

```
src/
├── lib/
│   ├── google/
│   │   ├── oauth2.ts          # OAuth2 helpers
│   │   ├── gmail.ts           # Gmail API functions
│   │   └── token-storage.ts   # Token management
│   ├── supabase.ts            # Supabase client & helpers
│   └── openai.ts              # GPT-4o OCR & classification
├── app/api/gmail/
│   ├── oauth2initiate/route.ts    # Start OAuth flow
│   ├── oauth2callback/route.ts    # OAuth callback
│   ├── webhook/route.ts           # Pub/Sub webhook receiver
│   ├── setup-watch/route.ts       # Manual watch setup
│   └── process-invoice/route.ts   # GPT-4o processing
```

## 🔒 Security Notes

- Tokens are stored locally in `gmail-tokens.json` (gitignored)
- For production, consider storing tokens in Supabase or a secure key vault
- The webhook endpoint should validate Pub/Sub messages in production
- No RLS is used as specified in your PRD

## 🚨 Troubleshooting

### Common Issues:

1. **OAuth2 fails**: Check that your redirect URI matches exactly in Google Cloud Console
2. **Webhook not receiving**: Verify Pub/Sub topic permissions and subscription endpoint
3. **File upload fails**: Check Supabase Storage bucket exists and permissions
4. **GPT-4o fails**: Verify OpenAI API key and model access

### Debug Steps:

1. Check Next.js console logs for detailed error messages
2. Verify environment variables are loaded correctly
3. Test individual API endpoints with curl or Postman
4. Check Supabase logs for database/storage errors

## 🎯 Next Steps

Now that Gmail processing is implemented, you can:

1. **Build the Dashboard UI** for reviewing invoices
2. **Implement Pattern Learning** for classification improvement
3. **Add Payment Integration** for AP email notifications
4. **Add Real-time Updates** using Supabase Channels

The core email ingestion and OCR pipeline is ready! 🎉

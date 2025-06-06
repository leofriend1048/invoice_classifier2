import { getFreshGmailClient } from '@/lib/google/gmail';
import { getStoredTokensForEmail } from '@/lib/google/token-storage';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    console.log('🧪 Testing Gmail processing with stored tokens...');

    const userEmail = 'mtbinvoice@gmail.com';

    // Get stored Gmail tokens
    const tokens = await getStoredTokensForEmail(userEmail);
    if (!tokens) {
      return NextResponse.json({
        success: false,
        error: `No Gmail tokens found for ${userEmail}`
      });
    }

    console.log('✅ Tokens found for:', userEmail);
    console.log('🔑 Access token present:', !!tokens.access_token);
    console.log('🔑 Refresh token present:', !!tokens.refresh_token);

    // Test Gmail API connection
    console.log('📧 Testing Gmail API connection...');
    const gmail = await getFreshGmailClient(tokens, userEmail);
    
    // Get user profile to test connection
    const profile = await gmail.users.getProfile({ userId: 'me' });
    console.log('✅ Gmail API connection successful');
    console.log('📊 Email address:', profile.data.emailAddress);
    console.log('📊 Messages total:', profile.data.messagesTotal);
    console.log('📊 History ID:', profile.data.historyId);

    // Get recent messages (last 10)
    console.log('📮 Fetching recent messages...');
    const messages = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 10,
      q: 'has:attachment' // Only messages with attachments
    });

    const messageList = messages.data.messages || [];
    console.log(`📨 Found ${messageList.length} recent messages with attachments`);

    return NextResponse.json({
      success: true,
      message: 'Gmail processing test completed successfully',
      data: {
        email: profile.data.emailAddress,
        messagesTotal: profile.data.messagesTotal,
        historyId: profile.data.historyId,
        recentMessagesWithAttachments: messageList.length,
        tokensValid: true
      }
    });

  } catch (error) {
    console.error('💥 Gmail test failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Gmail test failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
} 
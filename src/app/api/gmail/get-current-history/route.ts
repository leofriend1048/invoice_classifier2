import { getFreshGmailClient } from '@/lib/google/gmail';
import { getStoredTokensForEmail } from '@/lib/google/token-storage';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const userEmail = url.searchParams.get('email') || 'mtbinvoice@gmail.com';

    // Get stored Gmail tokens
    const tokens = await getStoredTokensForEmail(userEmail);
    if (!tokens) {
      return NextResponse.json(
        { error: `No stored Gmail tokens found for ${userEmail}` },
        { status: 401 }
      );
    }

    // Initialize Gmail client
    const gmail = await getFreshGmailClient(tokens, userEmail);
    
    // Get user profile to get current historyId
    const profile = await gmail.users.getProfile({ userId: 'me' });
    
    return NextResponse.json({
      success: true,
      emailAddress: profile.data.emailAddress,
      currentHistoryId: profile.data.historyId,
      messagesTotal: profile.data.messagesTotal,
      threadsTotal: profile.data.threadsTotal,
    });

  } catch (error: any) {
    console.error('Failed to get Gmail profile:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get Gmail profile', 
        details: error?.message || String(error) 
      },
      { status: 500 }
    );
  }
} 
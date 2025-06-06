import { getGmailClientForEmail } from '@/lib/google/gmail';
import { getFreshTokensForEmail, validateTokenHealth } from '@/lib/google/token-storage';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const user_email = searchParams.get('user_email');
  const detailed = searchParams.get('detailed') === 'true';
  
  if (!user_email) {
    return NextResponse.json({ 
      connected: false, 
      error: 'Missing user_email parameter' 
    }, { status: 400 });
  }

  try {
    // Check token health
    const tokenHealth = await validateTokenHealth(user_email);
    
    if (!detailed) {
      // Simple response for basic connectivity check
      return NextResponse.json({ 
        connected: tokenHealth.isValid,
        needsReauth: tokenHealth.needsReauth
      });
    }

    // Detailed response with comprehensive status
    let gmailTestResult = null;
    if (tokenHealth.isValid || tokenHealth.needsRefresh) {
      try {
        // Try to get fresh tokens and test Gmail connectivity
        const tokens = await getFreshTokensForEmail(user_email);
        if (tokens) {
          const gmail = await getGmailClientForEmail(user_email);
          const profile = await gmail.users.getProfile({ userId: 'me' });
          gmailTestResult = {
            success: true,
            emailAddress: profile.data.emailAddress,
            historyId: profile.data.historyId,
            messagesTotal: profile.data.messagesTotal,
          };
        }
      } catch (error) {
        gmailTestResult = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    return NextResponse.json({
      connected: tokenHealth.isValid,
      tokenHealth: {
        isValid: tokenHealth.isValid,
        needsRefresh: tokenHealth.needsRefresh,
        needsReauth: tokenHealth.needsReauth,
        expiresAt: tokenHealth.expiresAt,
      },
      gmail: gmailTestResult,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error checking Gmail status:', error);
    return NextResponse.json({
      connected: false,
      error: 'Failed to check Gmail status',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
} 
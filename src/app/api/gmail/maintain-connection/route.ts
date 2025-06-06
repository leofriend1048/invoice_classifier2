import { setupGmailWatch } from '@/lib/google/gmail';
import { getFreshTokensForEmail, validateTokenHealth } from '@/lib/google/token-storage';
import { supabaseServer } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { user_email } = await req.json();
    
    if (!user_email) {
      return NextResponse.json({
        success: false,
        error: 'Missing user_email parameter'
      }, { status: 400 });
    }

    console.log(`🔧 Maintaining Gmail connection for ${user_email}...`);

    // Check token health
    const tokenHealth = await validateTokenHealth(user_email);
    
    if (tokenHealth.needsReauth) {
      return NextResponse.json({
        success: false,
        needsReauth: true,
        message: 'Re-authentication required',
        authUrl: `/api/gmail/oauth2initiate?user_email=${encodeURIComponent(user_email)}`
      });
    }

    // Get fresh tokens (this will automatically refresh if needed)
    const freshTokens = await getFreshTokensForEmail(user_email);
    if (!freshTokens) {
      return NextResponse.json({
        success: false,
        needsReauth: true,
        message: 'Failed to obtain fresh tokens',
        authUrl: `/api/gmail/oauth2initiate?user_email=${encodeURIComponent(user_email)}`
      });
    }

    // Test Gmail connectivity
    let gmailStatus = null;
    try {
      const { google } = await import('googleapis');
      const { getOAuth2Client } = await import('@/lib/google/oauth2');
      
      const oAuth2Client = getOAuth2Client();
      oAuth2Client.setCredentials(freshTokens);
      const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
      
      const profile = await gmail.users.getProfile({ userId: 'me' });
      gmailStatus = {
        success: true,
        emailAddress: profile.data.emailAddress,
        historyId: profile.data.historyId,
        messagesTotal: profile.data.messagesTotal,
      };
      
      console.log(`✅ Gmail connectivity confirmed for ${user_email}`);
    } catch (error) {
      console.error(`❌ Gmail connectivity test failed for ${user_email}:`, error);
      gmailStatus = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Update last connection check timestamp
    await supabaseServer
      .from('google_tokens')
      .update({ 
        last_checked_at: new Date().toISOString(),
        connection_healthy: gmailStatus.success 
      })
      .eq('email', user_email);

    // Try to ensure Gmail watch is active (optional)
    let watchStatus = null;
    if (gmailStatus.success) {
      try {
        const watchResponse = await setupGmailWatch(freshTokens);
        watchStatus = {
          success: true,
          historyId: watchResponse.historyId,
          expiration: watchResponse.expiration
        };
        
        // Update start_history_id if we got a new one
        if (watchResponse.historyId) {
          await supabaseServer
            .from('google_tokens')
            .update({ start_history_id: watchResponse.historyId })
            .eq('email', user_email);
        }
        
        console.log(`📧 Gmail watch refreshed for ${user_email}`);
      } catch (error) {
        console.warn(`⚠️ Gmail watch setup failed for ${user_email}:`, error);
        watchStatus = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    return NextResponse.json({
      success: true,
      tokenHealth,
      gmail: gmailStatus,
      watch: watchStatus,
      timestamp: new Date().toISOString(),
      message: 'Connection maintenance completed'
    });

  } catch (error) {
    console.error('Error maintaining Gmail connection:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to maintain Gmail connection',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 
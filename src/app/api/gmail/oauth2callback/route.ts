import { setupGmailWatch } from '@/lib/google/gmail';
import { getTokensFromCode } from '@/lib/google/oauth2';
import { storeTokensForEmail } from '@/lib/google/token-storage';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    const stateRaw = url.searchParams.get('state');
    let user_email = '';
    let redirect = '/settings/users';
    if (stateRaw) {
      try {
        const stateObj = JSON.parse(Buffer.from(stateRaw, 'base64url').toString('utf-8'));
        user_email = stateObj.user_email;
        redirect = stateObj.redirect || redirect;
      } catch (e) {
        user_email = stateRaw; // fallback for old state
      }
    }

    if (error) {
      return NextResponse.json(
        { error: 'OAuth2 authentication failed', details: error },
        { status: 400 }
      );
    }

    if (!code || !user_email) {
      return NextResponse.json(
        { error: 'No authorization code or user_email received' },
        { status: 400 }
      );
    }

    // Exchange code for tokens
    const tokens = await getTokensFromCode(code);
    // Store tokens in Supabase for this user
    await storeTokensForEmail(user_email, { ...tokens, email: user_email });

    // Set up Gmail watch for push notifications
    let watchResponse = null;
    try {
      watchResponse = await setupGmailWatch(tokens);
      console.log('Gmail watch setup completed');
    } catch (watchError) {
      console.error('Failed to setup Gmail watch:', watchError);
      // Continue anyway, as OAuth was successful
    }

    // Store start_history_id if available
    if (watchResponse && watchResponse.historyId) {
      await import('@/lib/supabase-server').then(({ supabaseServer }) =>
        supabaseServer
          .from('google_tokens')
          .update({ start_history_id: watchResponse.historyId })
          .eq('email', user_email)
      );
    }

    // Redirect to settings page
    let redirectUrl = redirect;
    // If redirect is a relative path, make it absolute
    if (redirect && redirect.startsWith('/')) {
      const origin = url.origin;
      redirectUrl = origin + redirect;
    }
    // Add google_connected=1 param
    try {
      const parsed = new URL(redirectUrl);
      parsed.searchParams.set('google_connected', '1');
      redirectUrl = parsed.toString();
    } catch (e) {
      // fallback: just append param
      if (!redirectUrl.includes('google_connected')) {
        redirectUrl += (redirectUrl.includes('?') ? '&' : '?') + 'google_connected=1';
      }
    }
    return NextResponse.redirect(redirectUrl);

  } catch (error) {
    console.error('OAuth2 callback error:', error);
    return NextResponse.json(
      { error: 'Failed to complete OAuth2 authentication', details: error instanceof Error ? error.message : error },
      { status: 500 }
    );
  }
} 
import { supabaseServer } from '@/lib/supabase-server';
import { google } from 'googleapis';

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl(state: string) {
  const oAuth2Client = getOAuth2Client();
  
  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.send'
  ];

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline', // Essential for getting refresh tokens
    scope: scopes,
    prompt: 'consent', // Force re-consent to ensure we get refresh token
    include_granted_scopes: true, // Include previously granted scopes
    state
  });

  return authUrl;
}

export async function getTokensFromCode(code: string) {
  const oAuth2Client = getOAuth2Client();
  const { tokens } = await oAuth2Client.getToken(code);
  
  // Validate that we received a refresh token
  if (!tokens.refresh_token) {
    console.warn('⚠️ No refresh token received. This may cause connection issues.');
    // Still proceed, but log the warning
  }
  
  return tokens;
}

// Enhanced refresh function with better error handling and logging
export async function refreshAccessTokenForEmail(email: string, refresh_token: string) {
  const oAuth2Client = getOAuth2Client();
  oAuth2Client.setCredentials({ refresh_token });
  
  try {
    const { credentials } = await oAuth2Client.refreshAccessToken();
    console.log(`✅ Successfully refreshed access token for ${email}`);
    
    // Update tokens in Supabase with comprehensive data
    const updateData: any = {
      access_token: credentials.access_token,
      expiry_date: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
      updated_at: new Date(),
      last_token_refresh: new Date(),
    };

    // Also update refresh token if we received a new one
    if (credentials.refresh_token) {
      updateData.refresh_token = credentials.refresh_token;
      console.log(`🔄 Received new refresh token for ${email}`);
    }

    const { error } = await supabaseServer
      .from('google_tokens')
      .update(updateData)
      .eq('email', email);

    if (error) {
      console.error('Failed to update tokens in database:', error);
      throw new Error(`Database update failed: ${error.message}`);
    }

    return credentials;
  } catch (error: any) {
    console.error(`❌ Failed to refresh access token for ${email}:`, error);
    
    // Check if it's a specific OAuth error
    if (error?.response?.data?.error) {
      const oauthError = error.response.data.error;
      if (oauthError === 'invalid_grant') {
        console.error(`🔒 Refresh token is invalid or revoked for ${email}. Re-authentication required.`);
        throw new Error('Refresh token invalid. Please re-authenticate.');
      }
    }
    
    throw error;
  }
} 
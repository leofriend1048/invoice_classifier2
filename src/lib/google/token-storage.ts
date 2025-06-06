import { supabaseServer } from '@/lib/supabase-server';
import { Credentials } from 'google-auth-library';
import { refreshAccessTokenForEmail } from './oauth2';

export type GmailTokens = Credentials & { email: string };

export async function storeTokensForEmail(email: string, tokens: GmailTokens): Promise<void> {
  const { access_token, refresh_token, scope, token_type, expiry_date } = tokens;
  let finalRefreshToken: string | null | undefined = refresh_token;
  if (!finalRefreshToken) {
    const { data: existing } = await supabaseServer
      .from('google_tokens')
      .select('refresh_token')
      .eq('email', email)
      .single();
    finalRefreshToken = existing?.refresh_token || null;
  }
  const upsertData = {
    email,
    access_token,
    refresh_token: finalRefreshToken,
    scope,
    token_type,
    expiry_date: expiry_date ? new Date(expiry_date) : null,
    updated_at: new Date(),
    last_token_refresh: new Date(),
  };
  const { error } = await supabaseServer
    .from('google_tokens')
    .upsert(upsertData, { onConflict: 'email' });
  if (error) {
    console.error('Failed to store tokens in Supabase:', error);
    throw error;
  }
}

export async function getStoredTokensForEmail(email: string): Promise<GmailTokens | null> {
  const { data, error } = await supabaseServer
    .from('google_tokens')
    .select('*')
    .eq('email', email)
    .single();
  if (error || !data) {
    console.error('Failed to get tokens from Supabase:', error);
    return null;
  }
  return { ...data, email } as GmailTokens;
}

export async function getFreshTokensForEmail(email: string): Promise<GmailTokens | null> {
  const tokens = await getStoredTokensForEmail(email);
  if (!tokens) {
    console.log(`❌ No stored tokens found for ${email}`);
    return null;
  }

  const now = new Date();
  const expiryDate = tokens.expiry_date ? new Date(tokens.expiry_date) : null;
  const isExpiringSoon = expiryDate ? (expiryDate.getTime() - now.getTime()) < (5 * 60 * 1000) : false;

  if (!tokens.refresh_token) {
    console.error(`❌ No refresh token available for ${email}. Re-authentication required.`);
    return null;
  }

  if (isExpiringSoon || !tokens.access_token) {
    console.log(`🔄 Token expired or expiring soon for ${email}, refreshing...`);
    try {
      const refreshedTokens = await refreshAccessTokenForEmail(email, tokens.refresh_token);
      console.log(`✅ Successfully refreshed tokens for ${email}`);
      
      return {
        ...tokens,
        access_token: refreshedTokens.access_token,
        expiry_date: refreshedTokens.expiry_date,
      };
    } catch (error) {
      console.error(`❌ Failed to refresh token for ${email}:`, error);
      return null;
    }
  }

  return tokens;
}

export async function hasStoredTokensForEmail(email: string): Promise<boolean> {
  const { data, error } = await supabaseServer
    .from('google_tokens')
    .select('email, refresh_token')
    .eq('email', email)
    .single();
  
  return !!data && !error && !!data.refresh_token;
}

export async function validateTokenHealth(email: string): Promise<{
  isValid: boolean;
  needsRefresh: boolean;
  needsReauth: boolean;
  expiresAt?: Date;
}> {
  const tokens = await getStoredTokensForEmail(email);
  
  if (!tokens) {
    return { isValid: false, needsRefresh: false, needsReauth: true };
  }

  if (!tokens.refresh_token) {
    return { isValid: false, needsRefresh: false, needsReauth: true };
  }

  const now = new Date();
  const expiryDate = tokens.expiry_date ? new Date(tokens.expiry_date) : null;
  
  if (!expiryDate) {
    return { isValid: false, needsRefresh: true, needsReauth: false };
  }

  const isExpired = now > expiryDate;
  const isExpiringSoon = (expiryDate.getTime() - now.getTime()) < (10 * 60 * 1000);

  if (isExpired) {
    return { isValid: false, needsRefresh: true, needsReauth: false, expiresAt: expiryDate };
  }

  if (isExpiringSoon) {
    return { isValid: true, needsRefresh: true, needsReauth: false, expiresAt: expiryDate };
  }

  return { isValid: true, needsRefresh: false, needsReauth: false, expiresAt: expiryDate };
} 
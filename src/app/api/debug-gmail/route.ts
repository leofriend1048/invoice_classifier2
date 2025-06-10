// src/app/api/debug-gmail/route.ts

import { supabaseServer } from '@/lib/supabase-server';
import * as fs from 'fs';
import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import * as path from 'path';

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    // 1) Load tokens from data/gmail-tokens.json (outside of src/)
    const tokensPath = path.join(process.cwd(), 'data', 'gmail-tokens.json');
    if (!fs.existsSync(tokensPath)) {
      return NextResponse.json(
        { error: `No gmail-tokens.json found at ${tokensPath}` },
        { status: 400 }
      );
    }
    const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
    console.log('📋 Loaded tokens, expires at:', new Date(tokens.expiry_date).toISOString());

    // 2) Build OAuth2 client
    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      process.env.GOOGLE_REDIRECT_URI!
    );

    // 3) Attempt to refresh the access token (or fall back to existing)
    oAuth2Client.setCredentials({ refresh_token: tokens.refresh_token });

    try {
      console.log('🔄 Refreshing access token...');
      const { credentials } = await oAuth2Client.refreshAccessToken();
      console.log(
        '✅ Got new access token. Expires at:',
        new Date(credentials.expiry_date!).toISOString()
      );

      // Merge and rewrite tokens file in /data (won't trigger Next.js rebuild)
      const updatedTokens = {
        ...tokens,
        access_token: credentials.access_token,
        expiry_date: credentials.expiry_date,
        token_type: credentials.token_type,
        scope: credentials.scope,
      };
      fs.writeFileSync(tokensPath, JSON.stringify(updatedTokens, null, 2));
      console.log('💾 Updated tokens.json on disk (in /data/)');
      oAuth2Client.setCredentials(updatedTokens);
    } catch (refreshError: any) {
      console.warn('⚠️ Token refresh failed or still rate-limited:');
      console.warn(refreshError.response?.data || refreshError.message);
      // Fall back to existing access token
      oAuth2Client.setCredentials({ access_token: tokens.access_token });
    }

    // 4) Initialize Gmail client & fetch profile
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
    let profile;
    try {
      profile = await gmail.users.getProfile({ userId: 'me' });
    } catch (e: any) {
      console.error('❌ Gmail API getProfile failed:', e.response?.data || e.message);
      return NextResponse.json(
        { error: 'Gmail API error', details: e.response?.data || e.message },
        { status: e.response?.status || 500 }
      );
    }

    const historyId = Number(profile.data.historyId);
    const emailAddress = profile.data.emailAddress;

    // 5) Upsert that historyId into Supabase (google_tokens table)
    const { error: upsertError } = await supabaseServer
      .from('google_tokens')
      .upsert(
        [
          {
            email: emailAddress,
            start_history_id: historyId,
            last_checked_at: new Date().toISOString(),
            cooldown_until: null,
          },
        ],
        { onConflict: 'email' }
      );

    if (upsertError) {
      console.error('❌ Failed to write to Supabase:', upsertError);
      return NextResponse.json(
        { error: 'Supabase upsert failed', details: upsertError.message },
        { status: 500 }
      );
    }

    console.log(`✅ Wrote historyId=${historyId} for ${emailAddress} to Supabase`);

    // 6) Return JSON so you can inspect it
    return NextResponse.json({
      success: true,
      email: emailAddress,
      historyId,
      messagesTotal: profile.data.messagesTotal,
      threadsTotal: profile.data.threadsTotal,
      note: 'start_history_id has been upserted in Supabase',
    });
  } catch (err: any) {
    console.error('🔥 Unexpected error in /api/debug-gmail:', err);
    return NextResponse.json(
      { error: String(err.message || err), details: err.response?.data || null },
      { status: 500 }
    );
  }
}

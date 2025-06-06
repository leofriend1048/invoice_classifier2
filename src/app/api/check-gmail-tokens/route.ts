import { supabaseServer } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('🔍 Checking Gmail tokens status...');

    // Check if tokens exist for mtbinvoice@gmail.com
    const { data: tokens, error } = await supabaseServer
      .from('google_tokens')
      .select('email, access_token, refresh_token, expiry_date, updated_at')
      .eq('email', 'mtbinvoice@gmail.com')
      .single();

    if (error) {
      console.log('❌ No tokens found:', error);
      return NextResponse.json({
        success: false,
        hasTokens: false,
        message: 'No Gmail tokens found for mtbinvoice@gmail.com',
        solution: 'Please complete OAuth flow at /api/gmail/oauth2initiate',
        error: error
      });
    }

    // Check if tokens are expired
    const now = new Date();
    const expiryDate = tokens.expiry_date ? new Date(tokens.expiry_date) : null;
    const isExpired = expiryDate ? now > expiryDate : false;

    return NextResponse.json({
      success: true,
      hasTokens: true,
      email: tokens.email,
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiryDate: tokens.expiry_date,
      isExpired: isExpired,
      lastUpdated: tokens.updated_at,
      status: isExpired ? 'EXPIRED' : 'VALID'
    });

  } catch (error) {
    console.error('💥 Error checking tokens:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to check token status',
      details: error
    });
  }
} 
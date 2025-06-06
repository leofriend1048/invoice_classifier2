import { getAuthUrl } from '@/lib/google/oauth2';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const user_email = url.searchParams.get('user_email');
    const redirect = url.searchParams.get('redirect') || '/settings/users';
    if (!user_email) {
      return NextResponse.json({ error: 'Missing user_email parameter' }, { status: 400 });
    }
    // Encode state as base64url JSON
    const state = Buffer.from(JSON.stringify({ user_email, redirect })).toString('base64url');
    const authUrl = getAuthUrl(state);
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate auth URL' },
      { status: 500 }
    );
  }
} 
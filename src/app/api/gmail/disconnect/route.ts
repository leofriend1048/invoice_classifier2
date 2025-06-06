import { supabaseServer } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { user_email } = await req.json();
  if (!user_email) {
    return NextResponse.json({ success: false, error: 'Missing user_email' }, { status: 400 });
  }
  const { error } = await supabaseServer
    .from('google_tokens')
    .delete()
    .eq('email', user_email);
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
} 
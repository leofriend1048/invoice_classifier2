import { auth } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase-server";
import { getFullUrl } from "@/lib/url-utils";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  try {
    // Look up the user by email
    const { data: user, error } = await supabaseServer.from('user').select('*').eq('email', email).single();
    if (error || !user) throw new Error('User not found');
    // Generate a password reset link
    const resetUrl = getFullUrl(`/reset-password?email=${encodeURIComponent(email)}`);
    // Call Better Auth's sendResetPassword logic manually
    if (auth.options?.emailAndPassword?.sendResetPassword) {
      await auth.options.emailAndPassword.sendResetPassword({ user, url: resetUrl, token: 'dummy-token' });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
} 
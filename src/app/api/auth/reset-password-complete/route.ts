import { autoVerifyUserByEmail } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    
    const success = await autoVerifyUserByEmail(email);
    
    if (success) {
      return NextResponse.json({ success: true, message: 'User verified successfully' });
    } else {
      return NextResponse.json({ error: 'Failed to verify user' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in password reset completion:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
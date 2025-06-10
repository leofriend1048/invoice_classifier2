import { autoVerifyUser } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    const success = await autoVerifyUser(userId);
    
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
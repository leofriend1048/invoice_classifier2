import { sendEmail } from '@/lib/google/gmail';
import { NextRequest, NextResponse } from 'next/server';

function createRawEmail({ to, from, subject, body }: { to: string; from: string; subject: string; body: string; }) {
  const message = [
    `To: ${to}`,
    `From: ${from}`,
    `Subject: ${subject}`,
    '',
    body
  ].join('\n');
  return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function POST(req: NextRequest) {
  try {
    const { user_email, to, subject, body } = await req.json();
    if (!user_email || !to || !subject || !body) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    // Use the user's email as the sender
    const raw = createRawEmail({ to, from: user_email, subject, body });
    const result = await sendEmail(user_email, raw);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Failed to send test email:', error);
    return NextResponse.json({ error: 'Failed to send test email', details: String(error) }, { status: 500 });
  }
} 
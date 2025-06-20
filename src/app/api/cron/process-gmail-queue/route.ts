import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('🕐 Cron job started: Process Gmail Queue');
    
    // In production, you might want to add auth verification like in the backfill cron
    // For simplicity here, we'll proceed directly.

    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    const apiUrl = `${baseUrl}/api/gmail/process-queue`;
    console.log(`📡 Making internal call to: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // No body needed, the processor knows who to process
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Queue processor API call failed:`, errorText);
        return NextResponse.json({ success: false, error: 'Queue processor failed', details: errorText }, { status: 500 });
    }

    const result = await response.json();
    console.log('✅ Cron job completed successfully:', result);

    return NextResponse.json({
      success: true,
      message: 'Gmail queue processing triggered successfully.',
      result
    });

  } catch (error) {
    console.error('❌ Cron job error:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Cron job failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 
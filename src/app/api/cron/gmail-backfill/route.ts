import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('🕐 Cron job started: Gmail backfill');
    
    // Verify this is a legitimate cron request from Vercel
    const authHeader = request.headers.get('authorization');
    if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.log('❌ Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the base URL for internal API calls
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';

    console.log(`📡 Making internal call to: ${baseUrl}/api/gmail/backfill`);

    // Call the backfill endpoint internally
    const backfillResponse = await fetch(`${baseUrl}/api/gmail/backfill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        maxEmails: 100, // Process up to 100 emails per day
        skipProcessing: false // Include GPT-4o processing
      })
    });

    if (!backfillResponse.ok) {
      const errorText = await backfillResponse.text();
      console.error('❌ Backfill API call failed:', errorText);
      return NextResponse.json({ 
        error: 'Backfill failed', 
        details: errorText 
      }, { status: 500 });
    }

    const result = await backfillResponse.json();
    console.log('✅ Cron job completed successfully:', result);

    return NextResponse.json({
      success: true,
      message: 'Daily Gmail backfill completed',
      timestamp: new Date().toISOString(),
      result
    });

  } catch (error) {
    console.error('❌ Cron job error:', error);
    return NextResponse.json({ 
      error: 'Cron job failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 
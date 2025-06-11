import { NextRequest, NextResponse } from 'next/server';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function GET(request: NextRequest) {
  try {
    console.log('🕐 Cron job started: Gmail backfill');
    
    // Verify this is a legitimate cron request from Vercel
    if (process.env.NODE_ENV === 'production') {
      const vercelCronHeader = request.headers.get('x-vercel-cron');
      const userAgent = request.headers.get('user-agent');
      
      // Check for Vercel cron indicators
      const isVercelCron = vercelCronHeader === '1' || userAgent?.includes('vercel-cron');
      
      if (!isVercelCron) {
        console.log('❌ Unauthorized cron request', { vercelCronHeader, userAgent });
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Get the base URL for internal API calls
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://invoice-classifier-bay.vercel.app' 
      : 'http://localhost:3000';

    console.log(`📡 Making internal call to: ${baseUrl}/api/gmail/backfill`);

    // Retry logic for the internal fetch
    const maxRetries = 3;
    let attempt = 0;
    let backfillResponse: Response | null = null;
    let fetchError: any = null;
    while (attempt < maxRetries) {
      try {
        backfillResponse = await fetch(`${baseUrl}/api/gmail/backfill`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            maxEmails: 1, // Process only 1 email per cron run to avoid timeouts
            skipProcessing: false // Include GPT-4o processing
          })
        });
        if (backfillResponse.ok) break;
        fetchError = await backfillResponse.text();
        console.error(`❌ Backfill API call failed (attempt ${attempt + 1}):`, fetchError);
      } catch (err) {
        fetchError = err instanceof Error ? err.message : String(err);
        console.error(`❌ Fetch error (attempt ${attempt + 1}):`, fetchError);
      }
      attempt++;
      if (attempt < maxRetries) await sleep(1000 * attempt); // Exponential backoff
    }

    if (!backfillResponse || !backfillResponse.ok) {
      return NextResponse.json({
        success: false,
        error: 'Backfill failed',
        details: fetchError || 'Unknown error',
        attempts: attempt
      });
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
      success: false,
      error: 'Cron job failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
} 
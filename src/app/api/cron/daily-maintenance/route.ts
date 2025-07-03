import { NextResponse } from 'next/server';

async function triggerEndpoint(baseUrl: string, path: string, body: any = {}) {
    const apiUrl = `${baseUrl}${path}`;
    console.log(`📡 Triggering endpoint: ${apiUrl}`);
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ API call to ${path} failed:`, errorText);
            return { success: false, path, error: errorText };
        }

        const result = await response.json();
        console.log(`✅ Endpoint ${path} completed successfully.`);
        return { success: true, path, result };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`💥 Fetch error for ${path}:`, errorMessage);
        return { success: false, path, error: errorMessage };
    }
}


export async function GET() {
  try {
    console.log('🕐 Cron job started: Daily Maintenance');
    
    // In production, you might want to add auth verification
    // For simplicity here, we'll proceed directly.

    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    // Task 1: Trigger Gmail Backfill (reduced emails for cron timeout limits)
    const backfillResult = await triggerEndpoint(baseUrl, '/api/gmail/backfill', { maxEmails: 10 });

    // Task 2: Trigger Reprocessing of Failed Classifications
    const reprocessResult = await triggerEndpoint(baseUrl, '/api/reprocess-failed-classifications', {});

    console.log('✅ Daily maintenance cron job completed.');

    return NextResponse.json({
      success: true,
      message: 'Daily maintenance tasks triggered.',
      results: {
        backfillResult,
        reprocessResult,
      }
    });

  } catch (error) {
    console.error('❌ Daily maintenance cron job error:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Cron job failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 
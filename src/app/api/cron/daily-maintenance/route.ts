import { NextResponse } from 'next/server';

// Import the actual functions instead of making HTTP calls
async function runGmailBackfill(maxEmails: number = 10) {
    try {
        console.log('🔄 Starting Gmail backfill process...');
        
        // For now, we'll skip the backfill during build/static generation
        if (process.env.NODE_ENV === 'development' && process.env.NEXT_PHASE === 'phase-production-build') {
            console.log('⏭️ Skipping Gmail backfill during build');
            return { success: true, message: 'Skipped during build', stats: { processed: 0 } };
        }

        // Import the backfill logic dynamically to avoid build-time execution
        const { POST } = await import('../../gmail/backfill/route');
        const mockRequest = {
            json: async () => ({ maxEmails, skipProcessing: false })
        } as any;
        
        const response = await POST(mockRequest);
        const result = await response.json();
        
        console.log('✅ Gmail backfill completed successfully');
        return { success: true, result };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('💥 Gmail backfill error:', errorMessage);
        return { success: false, error: errorMessage };
    }
}

async function runReprocessFailedClassifications() {
    try {
        console.log('🔄 Starting reprocess failed classifications...');
        
        // Skip during build/static generation
        if (process.env.NODE_ENV === 'development' && process.env.NEXT_PHASE === 'phase-production-build') {
            console.log('⏭️ Skipping reprocess during build');
            return { success: true, message: 'Skipped during build', processed: 0 };
        }

        // Import the reprocess GET function dynamically
        const { GET } = await import('../../reprocess-failed-classifications/route');
        const mockRequest = {
            headers: {
                get: (key: string) => key === 'x-vercel-cron' ? '1' : 'vercel-cron internal-call'
            }
        } as any;
        
        const response = await GET(mockRequest);
        const result = await response.json();
        
        console.log('✅ Reprocess failed classifications completed successfully');
        return { success: true, result };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('💥 Reprocess failed classifications error:', errorMessage);
        return { success: false, error: errorMessage };
    }
}


export async function GET() {
  try {
    console.log('🕐 Cron job started: Daily Maintenance');
    
    // In production, you might want to add auth verification
    // For simplicity here, we'll proceed directly.

    // Task 1: Trigger Gmail Backfill (reduced emails for cron timeout limits)
    const backfillResult = await runGmailBackfill(10);

    // Task 2: Trigger Reprocessing of Failed Classifications
    const reprocessResult = await runReprocessFailedClassifications();

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
import { classifyInvoice } from '@/lib/classification';
import { supabaseServer } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

async function reprocessFailedClassifications(batchSize: number) {
  console.log('🔄 Starting failed classification reprocessing...');
  console.log(`📊 Batch size: ${batchSize}`);

  const { data: failedInvoices, error: fetchError } = await supabaseServer
    .from('failed_classifications_view')
    .select('*')
    .limit(batchSize);

  if (fetchError) {
    console.error('❌ Failed to fetch failed classifications:', fetchError);
    throw new Error('Failed to fetch failed classifications');
  }

  if (!failedInvoices || failedInvoices.length === 0) {
    return {
      success: true,
      message: 'No failed classifications to process',
      processed: { total: 0, success: 0, failed: 0 },
      details: [],
      updated_stats: []
    };
  }

  console.log(`📝 Found ${failedInvoices.length} failed classifications to process`);

  const results = {
    success: 0,
    failed: 0,
    details: [] as any[]
  };

  for (const invoice of failedInvoices) {
    try {
      console.log(`🔄 Processing invoice ${invoice.id}...`);

      if (!invoice.vendor_name || !invoice.amount || !invoice.extracted_text) {
        console.error('❌ Missing required fields for invoice:', invoice.id);
        results.failed++;
        results.details.push({
          id: invoice.id,
          status: 'failed',
          reason: 'missing_required_fields'
        });
        continue;
      }

      const classification = await classifyInvoice(
        invoice.vendor_name,
        invoice.amount,
        invoice.extracted_text
      );

      if (!classification) {
        console.error('❌ Classification failed for invoice:', invoice.id);
        results.failed++;
        results.details.push({
          id: invoice.id,
          status: 'failed',
          reason: 'classification_failed'
        });
        continue;
      }

      const { error: updateError } = await supabaseServer
        .from('invoice_class_invoices')
        .update({
          gl_account: classification.gl_account,
          branch: classification.branch,
          division: classification.division,
          payment_method: classification.payment_method,
          category: classification.category,
          subcategory: classification.subcategory,
          description: classification.description,
          classification_suggestion: {
            category: classification.category,
            subcategory: classification.subcategory,
            description: classification.description,
            confidence: classification.confidence,
            method: classification.method,
            pattern_id: classification.pattern_id
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', invoice.id);

      if (updateError) {
        console.error('❌ Failed to update invoice:', invoice.id, updateError);
        results.failed++;
        results.details.push({
          id: invoice.id,
          status: 'failed',
          reason: 'update_failed'
        });
        continue;
      }

      console.log('✅ Successfully reprocessed invoice:', invoice.id);
      results.success++;
      results.details.push({
        id: invoice.id,
        status: 'success',
        classification: {
          category: classification.category,
          subcategory: classification.subcategory,
          confidence: classification.confidence,
          method: classification.method
        }
      });

    } catch (error) {
      console.error('❌ Error processing invoice:', invoice.id, error);
      results.failed++;
      results.details.push({
        id: invoice.id,
        status: 'failed',
        reason: 'unexpected_error'
      });
    }
  }

  const { data: stats } = await supabaseServer.rpc('get_failed_classification_stats');

  return {
    success: true,
    processed: {
      total: failedInvoices.length,
      success: results.success,
      failed: results.failed
    },
    details: results.details,
    updated_stats: stats
  };
}

export async function POST(req: NextRequest) {
  try {
    const { batchSize = 10 } = await req.json().catch(() => ({ batchSize: 10 }));
    const result = await reprocessFailedClassifications(batchSize);
    return NextResponse.json(result);
  } catch (error) {
    console.error('💥 Reprocessing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to reprocess classifications';
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('🕐 Cron job started: Reprocess Failed Classifications');
    
    if (process.env.NODE_ENV === 'production') {
      const vercelCronHeader = request.headers.get('x-vercel-cron');
      const userAgent = request.headers.get('user-agent');
      
      const isVercelCron = vercelCronHeader === '1' || userAgent?.includes('vercel-cron');
      
      if (!isVercelCron) {
        console.log('❌ Unauthorized cron request', { vercelCronHeader, userAgent });
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const batchSize = 20; 
    const result = await reprocessFailedClassifications(batchSize);
    
    console.log('✅ Cron job completed successfully:', result);

    return NextResponse.json({
      success: true,
      message: 'Cron: Reprocess failed classifications completed',
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
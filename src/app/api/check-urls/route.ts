import { supabaseServer } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('🔍 Analyzing current PDF URLs in database...');

    // Get all invoices with pdf_url
    const { data: invoices, error: fetchError } = await supabaseServer
      .from('invoice_class_invoices')
      .select('id, pdf_url, created_at')
      .not('pdf_url', 'is', null)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('❌ Failed to fetch invoices:', fetchError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch invoices from database',
        details: fetchError
      });
    }

    if (!invoices || invoices.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No invoices with PDF URLs found',
        analysis: {
          total: 0,
          signedUrls: 0,
          publicUrls: 0,
          unknownUrls: 0
        }
      });
    }

    let signedUrls = 0;
    let publicUrls = 0;
    let unknownUrls = 0;
    const examples = {
      signed: [] as string[],
      public: [] as string[],
      unknown: [] as string[]
    };

    for (const invoice of invoices) {
      const { pdf_url } = invoice;
      
      if (!pdf_url) continue;

      // Check URL patterns
      const isSignedUrl = pdf_url.includes('/sign/') || 
                         pdf_url.includes('?token=') || 
                         pdf_url.includes('&token=') ||
                         pdf_url.includes('X-Amz-Algorithm') ||
                         pdf_url.includes('supabase-signed-url');

      const isPublicUrl = pdf_url.includes('/object/public/') ||
                         (pdf_url.includes('supabase') && !isSignedUrl);

      if (isSignedUrl) {
        signedUrls++;
        if (examples.signed.length < 3) {
          examples.signed.push(pdf_url);
        }
      } else if (isPublicUrl) {
        publicUrls++;
        if (examples.public.length < 3) {
          examples.public.push(pdf_url);
        }
      } else {
        unknownUrls++;
        if (examples.unknown.length < 3) {
          examples.unknown.push(pdf_url);
        }
      }
    }

    const analysis = {
      total: invoices.length,
      signedUrls,
      publicUrls,
      unknownUrls,
      needsMigration: signedUrls > 0,
      examples
    };

    console.log('📊 URL Analysis Results:', analysis);

    return NextResponse.json({
      success: true,
      message: 'URL analysis completed',
      analysis
    });

  } catch (error) {
    console.error('💥 Analysis failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Analysis failed',
      details: error
    });
  }
} 
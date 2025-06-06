import { supabaseServer } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    console.log('🔄 Starting URL migration from signed URLs to public URLs...');

    // Get all invoices with pdf_url
    const { data: invoices, error: fetchError } = await supabaseServer
      .from('invoice_class_invoices')
      .select('id, pdf_url')
      .not('pdf_url', 'is', null);

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
        updated: 0
      });
    }

    console.log(`📊 Found ${invoices.length} invoices with PDF URLs`);

    let updated = 0;
    let alreadyPublic = 0;
    let errors = 0;

    for (const invoice of invoices) {
      const { id, pdf_url } = invoice;
      
      if (!pdf_url) continue;

      // Check if URL is already a public URL (not signed)
      // Signed URLs typically contain /sign/ or have query parameters like ?token=
      const isSignedUrl = pdf_url.includes('/sign/') || 
                         pdf_url.includes('?token=') || 
                         pdf_url.includes('&token=') ||
                         pdf_url.includes('X-Amz-Algorithm') ||
                         pdf_url.includes('supabase-signed-url');

      if (!isSignedUrl) {
        alreadyPublic++;
        console.log(`⏭️  Invoice ${id}: Already using public URL`);
        continue;
      }

      try {
        // Extract the file path from the signed URL
        // Supabase signed URLs typically look like:
        // https://project.supabase.co/storage/v1/object/sign/bucket-name/file-path?token=...
        const urlParts = new URL(pdf_url);
        const pathSegments = urlParts.pathname.split('/');
        
        // Find the bucket and file path
        let bucketIndex = -1;
        for (let i = 0; i < pathSegments.length; i++) {
          if (pathSegments[i] === 'invoices-pdf') {
            bucketIndex = i;
            break;
          }
        }

        if (bucketIndex === -1) {
          console.error(`❌ Could not find bucket in URL for invoice ${id}: ${pdf_url}`);
          errors++;
          continue;
        }

        // Extract file path (everything after the bucket name)
        const filePath = pathSegments.slice(bucketIndex + 1).join('/');
        
        if (!filePath) {
          console.error(`❌ Could not extract file path for invoice ${id}: ${pdf_url}`);
          errors++;
          continue;
        }

        console.log(`🔍 Invoice ${id}: Extracted file path: ${filePath}`);

        // Generate public URL for the same file path
        const { data: publicUrlData } = supabaseServer.storage
          .from('invoices-pdf')
          .getPublicUrl(filePath);

        const newPublicUrl = publicUrlData.publicUrl;
        console.log(`🔗 Invoice ${id}: Generated public URL: ${newPublicUrl}`);

        // Update the invoice record with the new public URL
        const { error: updateError } = await supabaseServer
          .from('invoice_class_invoices')
          .update({ 
            pdf_url: newPublicUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', id);

        if (updateError) {
          console.error(`❌ Failed to update invoice ${id}:`, updateError);
          errors++;
          continue;
        }

        console.log(`✅ Invoice ${id}: Successfully migrated to public URL`);
        updated++;

      } catch (error) {
        console.error(`❌ Error processing invoice ${id}:`, error);
        errors++;
      }
    }

    const results = {
      total: invoices.length,
      updated,
      alreadyPublic,
      errors,
      success: true
    };

    console.log('🏁 Migration completed:', results);

    return NextResponse.json({
      success: true,
      message: 'URL migration completed',
      results
    });

  } catch (error) {
    console.error('💥 Migration failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Migration failed',
      details: error
    });
  }
} 
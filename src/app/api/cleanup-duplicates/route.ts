import { supabaseServer } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    console.log('🧹 Starting duplicate cleanup process...');

    // Get all invoices ordered by creation time
    const { data: allInvoices, error: fetchError } = await supabaseServer
      .from('invoice_class_invoices')
      .select('id, vendor_name, amount, invoice_date, pdf_url, created_at, attachment_filename')
      .order('created_at', { ascending: true }); // Keep the earliest ones

    if (fetchError) {
      console.error('❌ Failed to fetch invoices:', fetchError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch invoices',
        details: fetchError
      });
    }

    if (!allInvoices || allInvoices.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No invoices found',
        results: { duplicatesRemoved: 0, filesDeleted: 0 }
      });
    }

    console.log(`📊 Found ${allInvoices.length} total invoices`);

    // Track unique invoices by signature (vendor-amount-date)
    const uniqueInvoices = new Map();
    const duplicatesToDelete = [];

    for (const invoice of allInvoices) {
      const signature = `${invoice.vendor_name}-${invoice.amount}-${invoice.invoice_date}`.toLowerCase();
      
      if (uniqueInvoices.has(signature)) {
        // This is a duplicate
        console.log(`🔍 Found duplicate: ${signature} (ID: ${invoice.id})`);
        duplicatesToDelete.push(invoice);
      } else {
        // This is the first occurrence, keep it
        uniqueInvoices.set(signature, invoice);
      }
    }

    console.log(`🎯 Found ${duplicatesToDelete.length} duplicates to remove`);
    
    if (duplicatesToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No duplicates found',
        results: { duplicatesRemoved: 0, filesDeleted: 0 }
      });
    }

    let filesDeleted = 0;
    let recordsDeleted = 0;

    // Delete duplicate files and records
    for (const duplicate of duplicatesToDelete) {
      try {
        // Extract filename from URL and delete from storage
        if (duplicate.pdf_url) {
          const fileName = duplicate.pdf_url.split('/').pop();
          if (fileName) {
            try {
              // Try to decode the filename, but fall back to original if decoding fails
              const decodedFileName = decodeURIComponent(fileName);
              const { error: deleteFileError } = await supabaseServer.storage
                .from('invoices-pdf')
                .remove([decodedFileName]);
              
              if (!deleteFileError) {
                filesDeleted++;
                console.log(`🗑️ Deleted file: ${decodedFileName}`);
              } else {
                console.error(`⚠️ Failed to delete file ${decodedFileName}:`, deleteFileError);
                // Try with original filename if decoded version failed
                const { error: deleteFileError2 } = await supabaseServer.storage
                  .from('invoices-pdf')
                  .remove([fileName]);
                if (!deleteFileError2) {
                  filesDeleted++;
                  console.log(`🗑️ Deleted file (fallback): ${fileName}`);
                } else {
                  console.error(`⚠️ Failed to delete file ${fileName}:`, deleteFileError2);
                }
              }
            } catch (decodeError) {
              console.warn(`⚠️ Failed to decode filename ${fileName}, using original:`, decodeError);
              const { error: deleteFileError } = await supabaseServer.storage
                .from('invoices-pdf')
                .remove([fileName]);
              
              if (!deleteFileError) {
                filesDeleted++;
                console.log(`🗑️ Deleted file: ${fileName}`);
              } else {
                console.error(`⚠️ Failed to delete file ${fileName}:`, deleteFileError);
              }
            }
          }
        }

        // Delete the invoice record
        const { error: deleteRecordError } = await supabaseServer
          .from('invoice_class_invoices')
          .delete()
          .eq('id', duplicate.id);

        if (!deleteRecordError) {
          recordsDeleted++;
          console.log(`🗑️ Deleted invoice record: ${duplicate.id}`);
        } else {
          console.error(`⚠️ Failed to delete record ${duplicate.id}:`, deleteRecordError);
        }

      } catch (error) {
        console.error(`❌ Error deleting duplicate ${duplicate.id}:`, error);
      }
    }

    const results = {
      totalInvoices: allInvoices.length,
      uniqueInvoices: uniqueInvoices.size,
      duplicatesFound: duplicatesToDelete.length,
      recordsDeleted,
      filesDeleted,
      duplicateDetails: duplicatesToDelete.map(d => ({
        id: d.id,
        vendor: d.vendor_name,
        amount: d.amount,
        date: d.invoice_date,
        filename: d.attachment_filename
      }))
    };

    console.log('🏁 Cleanup completed:', results);

    return NextResponse.json({
      success: true,
      message: `Cleanup completed. Removed ${recordsDeleted} duplicate records and ${filesDeleted} files.`,
      results
    });

  } catch (error) {
    console.error('💥 Cleanup failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Cleanup process failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
} 
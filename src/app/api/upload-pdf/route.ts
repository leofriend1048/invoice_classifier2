export const dynamic = "force-dynamic";
import { supabaseServer, uploadFileToStorage } from '@/lib/supabase-server';
import { createSafeUniqueFilename } from '@/lib/url-utils';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const invoiceId = formData.get('invoiceId') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!invoiceId) {
      return NextResponse.json(
        { error: 'Invoice ID is required' },
        { status: 400 }
      );
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are allowed' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      );
    }

    console.log('📤 Processing PDF upload for invoice:', invoiceId);
    console.log('📄 File:', file.name, 'Size:', file.size, 'Type:', file.type);

    // Get the current invoice record
    const { data: invoice, error: fetchError } = await supabaseServer
      .from('invoice_class_invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (fetchError || !invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Create unique filename
    const uniqueFilename = createSafeUniqueFilename(file.name, uuidv4());
    console.log('📄 Generated unique filename:', uniqueFilename);

    // Upload new file
    const newPdfUrl = await uploadFileToStorage(
      fileBuffer,
      uniqueFilename,
      file.type
    );

    if (!newPdfUrl) {
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      );
    }

    console.log('✅ File uploaded successfully:', newPdfUrl);

    // Delete old file if it exists
    if (invoice.pdf_url) {
      try {
        const oldFileName = invoice.pdf_url.split('/').pop();
        if (oldFileName) {
          // Try to decode the filename, but fall back to original if decoding fails
          let fileNameToDelete = oldFileName;
          try {
            fileNameToDelete = decodeURIComponent(oldFileName);
          } catch {
            // Use original filename if decoding fails
          }
          
          const { error: deleteError } = await supabaseServer.storage
            .from('invoices-pdf')
            .remove([fileNameToDelete]);
          
          if (deleteError) {
            console.warn('⚠️ Failed to delete old file:', deleteError);
            // Don't fail the request if old file deletion fails
          } else {
            console.log('🗑️ Deleted old file:', fileNameToDelete);
          }
        }
      } catch (error) {
        console.warn('⚠️ Error deleting old file:', error);
        // Don't fail the request if old file deletion fails
      }
    }

    // Update invoice record with new PDF URL
    const { data: updatedInvoice, error: updateError } = await supabaseServer
      .from('invoice_class_invoices')
      .update({ 
        pdf_url: newPdfUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', invoiceId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Failed to update invoice record:', updateError);
      return NextResponse.json(
        { error: 'Failed to update invoice record' },
        { status: 500 }
      );
    }

    // Create audit trail entry
    await supabaseServer
      .from('invoice_class_invoice_audit_trail')
      .insert({
        invoice_id: invoiceId,
        action: 'pdf_replaced',
        performed_by: 'ui_user',
        details: {
          old_pdf_url: invoice.pdf_url,
          new_pdf_url: newPdfUrl,
          filename: file.name,
          file_size: file.size
        }
      });

    console.log('✅ Invoice PDF updated successfully');

    return NextResponse.json({
      success: true,
      message: 'PDF uploaded successfully',
      data: {
        pdf_url: newPdfUrl,
        invoice: updatedInvoice
      }
    });

  } catch (error) {
    console.error('💥 PDF upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload PDF' },
      { status: 500 }
    );
  }
}
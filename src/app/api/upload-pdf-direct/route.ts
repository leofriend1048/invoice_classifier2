export const dynamic = "force-dynamic";
import { classifyInvoice, updateVendorProfile } from '@/lib/classification';
import { extractInvoiceDataWithGPT4o } from '@/lib/openai';
import { insertInvoice, supabaseServer, uploadFileToStorage } from '@/lib/supabase-server';
import { createSafeUniqueFilename } from '@/lib/url-utils';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// API endpoint for direct PDF uploads with robust error handling and retry logic

export async function POST(req: NextRequest) {
  let invoiceRecord: any = null;
  let pdfUrl: string | null = null;
  
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Enhanced file validation
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

    // Validate file is not empty
    if (file.size === 0) {
      return NextResponse.json(
        { error: 'File is empty' },
        { status: 400 }
      );
    }

    console.log('📤 Processing direct PDF upload');
    console.log('📄 File:', file.name, 'Size:', file.size, 'Type:', file.type);

    // Convert file to buffer with error handling
    let fileBuffer: Buffer;
    try {
      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      
      // Verify buffer is not empty
      if (fileBuffer.length === 0) {
        throw new Error('File buffer is empty');
      }
    } catch (bufferError) {
      console.error('❌ Failed to process file buffer:', bufferError);
      return NextResponse.json(
        { error: 'Failed to process file' },
        { status: 400 }
      );
    }

    // Create unique filename with retry logic
    const uniqueFilename = createSafeUniqueFilename(file.name, uuidv4());
    console.log('📄 Generated unique filename:', uniqueFilename);

    // Upload file to storage with retry logic
    let uploadAttempts = 0;
    const maxUploadAttempts = 3;
    
    while (uploadAttempts < maxUploadAttempts) {
      try {
        pdfUrl = await uploadFileToStorage(
          fileBuffer,
          uniqueFilename,
          file.type
        );
        
        if (pdfUrl) {
          break;
        }
      } catch (uploadError) {
        uploadAttempts++;
        console.warn(`⚠️ Upload attempt ${uploadAttempts} failed:`, uploadError);
        
        if (uploadAttempts >= maxUploadAttempts) {
          console.error('❌ All upload attempts failed');
          return NextResponse.json(
            { error: 'Failed to upload file after multiple attempts' },
            { status: 500 }
          );
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * uploadAttempts));
      }
    }

    if (!pdfUrl) {
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      );
    }

    console.log('✅ File uploaded successfully:', pdfUrl);

    // Create initial invoice record with error handling
    const initialInvoiceData = {
      vendor_name: 'Unknown Vendor', // Will be updated after extraction
      pdf_url: pdfUrl,
      status: 'pending' as const,
      payment_status: 'not_sent' as const,
      attachment_filename: file.name,
      // No Gmail message ID for direct uploads
      gmail_message_id: null,
    };

    try {
      invoiceRecord = await insertInvoice(initialInvoiceData);
      if (!invoiceRecord) {
        throw new Error('insertInvoice returned null');
      }
    } catch (insertError) {
      console.error('❌ Failed to create invoice record:', insertError);
      return NextResponse.json(
        { error: 'Failed to create invoice record' },
        { status: 500 }
      );
    }

    console.log('💾 Created invoice record:', invoiceRecord.id);

    // Extract data using GPT-4o with timeout and retry logic
    console.log('🤖 Extracting invoice data with GPT-4o...');
    let extractedData: any = null;
    let extractionAttempts = 0;
    const maxExtractionAttempts = 2;
    
    while (extractionAttempts < maxExtractionAttempts && !extractedData) {
      try {
        // Add timeout to prevent hanging
        const extractionPromise = extractInvoiceDataWithGPT4o(pdfUrl);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Extraction timeout')), 30000) // 30 second timeout
        );
        
        extractedData = await Promise.race([extractionPromise, timeoutPromise]);
        
        if (extractedData) {
          console.log('✅ Data extracted successfully:', extractedData);
          break;
        }
      } catch (extractionError) {
        extractionAttempts++;
        console.warn(`⚠️ Extraction attempt ${extractionAttempts} failed:`, extractionError);
        
        if (extractionAttempts >= maxExtractionAttempts) {
          console.warn('⚠️ Failed to extract data from PDF after multiple attempts, proceeding with default values');
        } else {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 2000 * extractionAttempts));
        }
      }
    }
    
    // Process classification if we have extracted data
    if (extractedData) {
      try {
        // Classify the invoice with timeout
        const classificationPromise = classifyInvoice(
          extractedData.vendor_name || initialInvoiceData.vendor_name,
          extractedData.amount || 0,
          extractedData.extracted_text || ''
        );
        const classificationTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Classification timeout')), 20000) // 20 second timeout
        );
        
        const classification = await Promise.race([classificationPromise, classificationTimeoutPromise]) as any;

        // Update invoice with extracted data and classification
        const updateData = {
          ...extractedData,
          category: classification.category,
          subcategory: classification.subcategory,
          description: classification.description,
          gl_account: classification.gl_account,
          branch: classification.branch,
          division: classification.division,
          payment_method: classification.payment_method,
          confidence: classification.confidence,
          updated_at: new Date().toISOString()
        };

        const { error: updateError } = await supabaseServer
          .from('invoice_class_invoices')
          .update(updateData)
          .eq('id', invoiceRecord.id);

        if (updateError) {
          console.error('❌ Failed to update invoice with extracted data:', updateError);
          // Don't fail the request, just log the error
        } else {
          console.log('✅ Invoice updated with extracted data');
          
          // Update vendor profile if we have vendor name and amount (non-blocking)
          if (extractedData.vendor_name && extractedData.amount) {
            try {
              await updateVendorProfile(
                extractedData.vendor_name,
                classification.category,
                extractedData.amount
              );
            } catch (vendorError) {
              console.warn('⚠️ Failed to update vendor profile (non-critical):', vendorError);
            }
          }
        }
      } catch (classificationError) {
        console.error('❌ Classification failed:', classificationError);
        // Don't fail the request, just log the error
      }
    } else {
      console.warn('⚠️ Failed to extract data from PDF, invoice will remain with default values');
    }

    // Create audit trail entry (non-blocking)
    try {
      await supabaseServer
        .from('invoice_class_invoice_audit_trail')
        .insert({
          invoice_id: invoiceRecord.id,
          action: 'pdf_uploaded_direct',
          performed_by: 'ui_user',
          details: {
            filename: file.name,
            file_size: file.size,
            upload_method: 'drag_drop',
            extraction_success: !!extractedData
          }
        });
    } catch (auditError) {
      console.warn('⚠️ Failed to create audit trail (non-critical):', auditError);
    }

    console.log('✅ Direct PDF upload completed successfully');

    return NextResponse.json({
      success: true,
      message: 'PDF uploaded and processed successfully',
      invoiceId: invoiceRecord.id,
      invoice: invoiceRecord,
      extraction_success: !!extractedData
    });

  } catch (error) {
    console.error('💥 Direct PDF upload error:', error);
    
    // Cleanup: If we created an invoice record but failed later, mark it as failed
    if (invoiceRecord) {
      try {
        await supabaseServer
          .from('invoice_class_invoices')
          .update({ 
            status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', invoiceRecord.id);
      } catch (cleanupError) {
        console.error('❌ Failed to cleanup failed invoice:', cleanupError);
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to upload and process PDF' },
      { status: 500 }
    );
  }
}

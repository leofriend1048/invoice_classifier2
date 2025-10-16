export const dynamic = "force-dynamic";
import { classifyInvoice, updateVendorProfile } from '@/lib/classification';
import { extractInvoiceDataWithGPT4o } from '@/lib/openai';
import '@/lib/server-init'; // Initialize process error handlers
import { insertInvoice, supabaseServer, uploadFileToStorage } from '@/lib/supabase-server';
import { createSafeUniqueFilename } from '@/lib/url-utils';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// Enhanced timeout configuration
const EXTRACTION_TIMEOUT = 60000; // 60 seconds for complex PDFs
const CLASSIFICATION_TIMEOUT = 30000; // 30 seconds for classification
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 2000; // Base delay for exponential backoff

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

    // Extract data using GPT-4o with enhanced timeout and retry logic
    console.log('🤖 Extracting invoice data with GPT-4o...');
    let extractedData: any = null;
    let extractionAttempts = 0;
    
    while (extractionAttempts < MAX_RETRIES && !extractedData) {
      try {
        // Enhanced timeout handling with proper cleanup
        const extractionPromise = extractInvoiceDataWithGPT4o(pdfUrl);
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error(`Extraction timeout after ${EXTRACTION_TIMEOUT}ms`)), EXTRACTION_TIMEOUT)
        );
        
        extractedData = await Promise.race([extractionPromise, timeoutPromise]);
        
        if (extractedData) {
          console.log('✅ Data extracted successfully:', extractedData);
          break;
        }
      } catch (extractionError) {
        extractionAttempts++;
        const errorMessage = extractionError instanceof Error ? extractionError.message : 'Unknown extraction error';
        console.warn(`⚠️ Extraction attempt ${extractionAttempts}/${MAX_RETRIES} failed:`, errorMessage);
        
        if (extractionAttempts >= MAX_RETRIES) {
          console.warn('⚠️ Failed to extract data from PDF after multiple attempts, proceeding with default values');
          break;
        } else {
          // Exponential backoff with jitter
          const delay = RETRY_DELAY_BASE * Math.pow(2, extractionAttempts - 1) + Math.random() * 1000;
          console.log(`⏳ Waiting ${Math.round(delay)}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // Process classification if we have extracted data
    if (extractedData) {
      try {
        // Classify the invoice with enhanced timeout and retry logic
        let classification: any = null;
        let classificationAttempts = 0;
        
        while (classificationAttempts < MAX_RETRIES && !classification) {
          try {
            const classificationPromise = classifyInvoice(
              extractedData.vendor_name || initialInvoiceData.vendor_name,
              extractedData.amount || 0,
              extractedData.extracted_text || ''
            );
            const classificationTimeoutPromise = new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error(`Classification timeout after ${CLASSIFICATION_TIMEOUT}ms`)), CLASSIFICATION_TIMEOUT)
            );
            
            classification = await Promise.race([classificationPromise, classificationTimeoutPromise]);
            
            if (classification) {
              console.log('✅ Classification completed successfully');
              break;
            }
          } catch (classificationError) {
            classificationAttempts++;
            const errorMessage = classificationError instanceof Error ? classificationError.message : 'Unknown classification error';
            console.warn(`⚠️ Classification attempt ${classificationAttempts}/${MAX_RETRIES} failed:`, errorMessage);
            
            if (classificationAttempts >= MAX_RETRIES) {
              console.warn('⚠️ Failed to classify invoice after multiple attempts, using fallback values');
              // Use fallback classification
              classification = {
                category: 'Business Services',
                subcategory: 'Other',
                description: 'Requires manual classification',
                gl_account: null,
                branch: null,
                division: 'Ecommerce',
                payment_method: null,
                confidence: 0.3
              };
              break;
            } else {
              // Exponential backoff
              const delay = RETRY_DELAY_BASE * Math.pow(2, classificationAttempts - 1) + Math.random() * 1000;
              console.log(`⏳ Waiting ${Math.round(delay)}ms before classification retry...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }

        // Update invoice with extracted data and classification (with retry)
        if (classification) {
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

          // Retry database update with connection resilience
          let updateSuccess = false;
          let updateAttempts = 0;
          
          while (!updateSuccess && updateAttempts < MAX_RETRIES) {
            try {
              const { error: updateError } = await supabaseServer
                .from('invoice_class_invoices')
                .update(updateData)
                .eq('id', invoiceRecord.id);

              if (updateError) {
                throw updateError;
              }
              
              updateSuccess = true;
              console.log('✅ Invoice updated with extracted data');
            } catch (updateError) {
              updateAttempts++;
              console.warn(`⚠️ Database update attempt ${updateAttempts}/${MAX_RETRIES} failed:`, updateError);
              
              if (updateAttempts >= MAX_RETRIES) {
                console.error('❌ Failed to update invoice with extracted data after multiple attempts');
                break;
              } else {
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_BASE * updateAttempts));
              }
            }
          }
          
          // Update vendor profile if we have vendor name and amount (non-blocking with retry)
          if (extractedData.vendor_name && extractedData.amount && updateSuccess) {
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
        console.error('❌ Classification process failed:', classificationError);
        // Don't fail the request, just log the error
      }
    } else {
      console.warn('⚠️ Failed to extract data from PDF, invoice will remain with default values');
    }

    // Create audit trail entry (non-blocking with retry)
    try {
      let auditSuccess = false;
      let auditAttempts = 0;
      
      while (!auditSuccess && auditAttempts < MAX_RETRIES) {
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
          auditSuccess = true;
        } catch (auditError) {
          auditAttempts++;
          if (auditAttempts >= MAX_RETRIES) {
            console.warn('⚠️ Failed to create audit trail after multiple attempts (non-critical):', auditError);
            break;
          } else {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_BASE * auditAttempts));
          }
        }
      }
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
    
    // Enhanced cleanup with retry logic
    if (invoiceRecord) {
      let cleanupSuccess = false;
      let cleanupAttempts = 0;
      
      while (!cleanupSuccess && cleanupAttempts < MAX_RETRIES) {
        try {
          await supabaseServer
            .from('invoice_class_invoices')
            .update({ 
              status: 'failed',
              updated_at: new Date().toISOString()
            })
            .eq('id', invoiceRecord.id);
          cleanupSuccess = true;
          console.log('✅ Marked invoice as failed for cleanup');
        } catch (cleanupError) {
          cleanupAttempts++;
          console.warn(`⚠️ Cleanup attempt ${cleanupAttempts}/${MAX_RETRIES} failed:`, cleanupError);
          
          if (cleanupAttempts >= MAX_RETRIES) {
            console.error('❌ Failed to cleanup failed invoice after multiple attempts:', cleanupError);
            break;
          } else {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_BASE * cleanupAttempts));
          }
        }
      }
    }
    
    // Return appropriate error response based on error type
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isTimeoutError = errorMessage.includes('timeout');
    const isDbError = errorMessage.includes('db_termination') || errorMessage.includes('connection');
    
    let statusCode = 500;
    let userMessage = 'Failed to upload and process PDF';
    
    if (isTimeoutError) {
      statusCode = 408; // Request Timeout
      userMessage = 'Processing timeout - please try again with a smaller file';
    } else if (isDbError) {
      statusCode = 503; // Service Unavailable
      userMessage = 'Service temporarily unavailable - please try again';
    }
    
    return NextResponse.json(
      { 
        error: userMessage,
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: statusCode }
    );
  }
}

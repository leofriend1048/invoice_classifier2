export const dynamic = "force-dynamic";

import { classifyInvoice, updateVendorProfile } from '@/lib/classification';
import {
    downloadAttachment,
    extractAttachmentsFromMessage,
    getFreshGmailClient,
    getMessage,
    isInvoiceFile
} from '@/lib/google/gmail';
import { getStoredTokensForEmail } from '@/lib/google/token-storage';
import { extractInvoiceDataWithGPT4o } from '@/lib/openai';
import { insertInvoice, supabaseServer, uploadFileToStorage } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// Add type definition at the top of the file
interface InvoiceData {
  vendor_name: string;
  extracted_text: string;
  pdf_url: string;
  status: "pending";
  gmail_message_id: string;
  attachment_filename: string;
  amount?: number;
  invoice_date?: string;
  due_date?: string;
  gl_account?: string | null;
  branch?: string | null;
  division?: string | null;
  payment_method?: string | null;
  category?: string | null;
  subcategory?: string | null;
  description?: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const { maxEmails = 50, skipProcessing = false } = await req.json().catch(() => ({}));
    
    console.log('🔄 Starting Gmail backfill process...');
    console.log(`📊 Max emails to process: ${maxEmails}`);
    console.log(`⚙️ Skip GPT-4o processing: ${skipProcessing}`);

    const userEmail = 'mtbinvoice@gmail.com';

    // Get stored Gmail tokens
    const tokens = await getStoredTokensForEmail(userEmail);
    if (!tokens) {
      return NextResponse.json({
        success: false,
        error: `No Gmail tokens found for ${userEmail}`
      });
    }

    // Get Gmail client
    const gmail = await getFreshGmailClient(tokens, userEmail);

    // Get all existing invoice records to avoid duplicates
    console.log('📊 Checking existing invoices in database...');
    const { data: existingInvoices, error: dbError } = await supabaseServer
      .from('invoice_class_invoices')
      .select('gmail_message_id, attachment_filename, vendor_name, amount, invoice_date')
      .not('gmail_message_id', 'is', null);

    if (dbError) {
      console.error('❌ Failed to fetch existing invoices:', dbError);
      return NextResponse.json({
        success: false,
        error: 'Failed to check existing invoices',
        details: dbError
      });
    }

    const existingMessageIds = new Set(
      existingInvoices?.map(inv => inv.gmail_message_id).filter(Boolean) || []
    );

    // Also track existing attachments to prevent duplicate processing of same file
    const existingAttachments = new Set(
      existingInvoices?.map(inv => inv.attachment_filename).filter(Boolean) || []
    );

    // Create a more sophisticated duplicate check for similar invoices
    const existingInvoiceSignatures = new Set(
      existingInvoices?.map(inv => 
        `${inv.vendor_name}-${inv.amount}-${inv.invoice_date}`.toLowerCase()
      ).filter(sig => sig !== 'null-null-null' && sig !== '--') || []
    );
    
    console.log(`📋 Found ${existingMessageIds.size} existing processed messages`);
    console.log(`📎 Found ${existingAttachments.size} existing processed attachments`);
    console.log(`🔍 Found ${existingInvoiceSignatures.size} existing invoice signatures`);

    // Get all messages with attachments from Gmail
    console.log('📧 Fetching messages from Gmail...');
    let allMessages: any[] = [];
    let pageToken: string | undefined;
    
    do {
      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 100,
        q: 'has:attachment',
        pageToken
      });

      const messages = response.data.messages || [];
      allMessages.push(...messages);
      pageToken = response.data.nextPageToken || undefined;
      
      console.log(`📨 Fetched ${messages.length} messages (total: ${allMessages.length})`);
      
      // Respect the maxEmails limit
      if (allMessages.length >= maxEmails) {
        allMessages = allMessages.slice(0, maxEmails);
        break;
      }
    } while (pageToken);

    console.log(`📊 Total messages with attachments: ${allMessages.length}`);

    // Filter out already processed messages
    const unprocessedMessages = allMessages.filter(msg => 
      !existingMessageIds.has(msg.id)
    );

    console.log(`📋 Unprocessed messages: ${unprocessedMessages.length}`);

    if (unprocessedMessages.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new messages to process',
        stats: {
          totalMessages: allMessages.length,
          alreadyProcessed: allMessages.length,
          newlyProcessed: 0,
          errors: 0
        }
      });
    }

    // Process each unprocessed message with timeout protection
    let processed = 0;
    let errors = 0;
    const results: any[] = [];
    const startTime = Date.now();
    const maxProcessingTime = 50000; // 50 seconds (leave 10s buffer for response)

    for (const messageRef of unprocessedMessages) {
      // Check if we're approaching timeout
      if (Date.now() - startTime > maxProcessingTime) {
        console.log(`⏰ Approaching timeout, stopping after processing ${processed} messages`);
        break;
      }
      try {
        console.log(`\n🔍 Processing message ${messageRef.id} (${processed + 1}/${unprocessedMessages.length})`);

        // Get full message details
        const message = await getMessage(gmail, messageRef.id);
        if (!message) {
          console.error('❌ Failed to fetch message details');
          errors++;
          continue;
        }

        // Extract attachments
        const attachments = await extractAttachmentsFromMessage(message);
        if (!attachments || attachments.length === 0) {
          console.log('ℹ️ No valid attachments found');
          continue;
        }

        // Process each invoice attachment
        for (const attachment of attachments) {
          if (!isInvoiceFile(attachment.filename, attachment.mimeType)) {
            console.log(`⏭️ Skipping non-invoice file: ${attachment.filename}`);
            continue;
          }

          // Check for duplicate attachment filename
          if (existingAttachments.has(attachment.filename)) {
            console.log(`🔄 Skipping duplicate attachment: ${attachment.filename} (already processed)`);
            continue;
          }

          console.log(`📎 Processing attachment: ${attachment.filename}`);

          // Download attachment
          const attachmentData = await downloadAttachment(
            gmail,
            messageRef.id,
            attachment.attachmentId
          );

          if (!attachmentData || !attachmentData.data) {
            console.error('❌ Failed to download attachment');
            errors++;
            continue;
          }

          // Convert to buffer and upload
          const fileBuffer = Buffer.from(attachmentData.data, 'base64');
          const uniqueFilename = `${uuidv4()}-${attachment.filename}`;
          
          console.log('☁️ Uploading to Supabase Storage...');
          const pdfUrl = await uploadFileToStorage(
            fileBuffer,
            uniqueFilename,
            attachment.mimeType
          );

          if (!pdfUrl) {
            console.error('❌ Failed to upload file');
            errors++;
            continue;
          }

          // Create initial invoice record
          console.log('💾 Creating invoice record...');
          const initialInvoiceData: InvoiceData = {
            vendor_name: 'Unknown Vendor',
            extracted_text: '',
            pdf_url: pdfUrl,
            status: 'pending',
            gmail_message_id: messageRef.id,
            attachment_filename: attachment.filename
          };

          const invoiceRecord = await insertInvoice(initialInvoiceData);
          if (!invoiceRecord) {
            console.error('❌ Failed to create invoice record');
            errors++;
            continue;
          }

          console.log(`✅ Invoice record created: ${invoiceRecord.id}`);

          // Process with GPT-4o if not skipped
          if (!skipProcessing) {
            console.log('🤖 Processing with GPT-4o...');
            try {
              const extractedData = await extractInvoiceDataWithGPT4o(pdfUrl);
              
              if (!extractedData) {
                console.error('❌ Failed to extract data from invoice');
                continue;
              }

              // Check for duplicate invoice signature after extraction
              const invoiceSignature = `${extractedData.vendor_name}-${extractedData.amount}-${extractedData.invoice_date}`.toLowerCase();
              if (existingInvoiceSignatures.has(invoiceSignature)) {
                console.log(`🔄 Skipping duplicate invoice: ${invoiceSignature} (same vendor/amount/date already exists)`);
                
                // Delete the uploaded file since we're not using it
                const fileName = pdfUrl.split('/').pop();
                if (fileName) {
                  await supabaseServer.storage
                    .from('invoices-pdf')
                    .remove([fileName]);
                }
                
                // Delete the invoice record we just created
                await supabaseServer
                  .from('invoice_class_invoices')
                  .delete()
                  .eq('id', invoiceRecord.id);
                
                continue;
              }

              // Add this signature to our tracking set
              existingInvoiceSignatures.add(invoiceSignature);

              // Validate required fields
              if (!extractedData.vendor_name || !extractedData.amount || !extractedData.extracted_text) {
                console.error('❌ Missing required fields after extraction:', {
                  hasVendorName: !!extractedData.vendor_name,
                  hasAmount: !!extractedData.amount,
                  hasExtractedText: !!extractedData.extracted_text
                });
                continue;
              }

              console.log('✅ GPT-4o extraction successful');
              
              // Now classify the invoice using hybrid system
              console.log('🔍 Starting invoice classification...', {
                vendor: extractedData.vendor_name,
                amount: extractedData.amount,
                textLength: extractedData.extracted_text.length
              });

              const classification = await classifyInvoice(
                extractedData.vendor_name,
                extractedData.amount,
                extractedData.extracted_text
              );
              
              if (!classification) {
                console.error('❌ Classification failed');
                continue;
              }

              console.log('✅ Classification completed:', classification);

              // Update invoice with extracted data and classification
              const updateData = {
                vendor_name: extractedData.vendor_name,
                invoice_date: extractedData.invoice_date,
                due_date: extractedData.due_date,
                amount: extractedData.amount,
                extracted_text: extractedData.extracted_text,
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
              };

              await supabaseServer
                .from('invoice_class_invoices')
                .update(updateData)
                .eq('id', invoiceRecord.id);

              console.log('✅ Invoice updated with classification');

              // Update vendor profile for better future classifications
              await updateVendorProfile(
                extractedData.vendor_name,
                classification.category,
                extractedData.amount
              );
            } catch (error) {
              console.error('❌ Error processing invoice:', error);
              continue;
            }
          }

          results.push({
            messageId: messageRef.id,
            filename: attachment.filename,
            invoiceId: invoiceRecord.id,
            pdfUrl: pdfUrl,
            processed: !skipProcessing
          });

          processed++;

          // Add this attachment to our tracking set
          existingAttachments.add(attachment.filename);
        }

      } catch (error) {
        console.error(`❌ Error processing message ${messageRef.id}:`, error);
        errors++;
      }
    }

    const stats = {
      totalMessages: allMessages.length,
      alreadyProcessed: existingMessageIds.size,
      newlyProcessed: processed,
      errors: errors,
      results: results
    };

    console.log('\n🏁 Backfill completed:', stats);

    return NextResponse.json({
      success: true,
      message: `Backfill completed. Processed ${processed} new invoices.`,
      stats
    });

  } catch (error) {
    console.error('💥 Backfill failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Backfill process failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
} 
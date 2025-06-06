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

// Upsert an event into gmail_event_queue
async function queueGmailEvent(email: string, historyId: number) {
  const { error } = await supabaseServer
    .from('gmail_event_queue')
    .upsert(
      [{ email, history_id: historyId, processed: false }],
      { onConflict: 'email,history_id' }
    );
  if (error) console.error(`❌ Failed to queue Gmail event:`, error);
  else console.log(`📥 Queued Gmail event for email=${email}, historyId=${historyId}`);
}

// Mark a specific queued row as processed
async function markEventProcessed(email: string, historyId: number) {
  await supabaseServer
    .from('gmail_event_queue')
    .update({ processed: true })
    .eq('email', email)
    .eq('history_id', historyId);
  console.log(`✅ Marked event as processed for email=${email}, historyId=${historyId}`);
}

export async function POST(req: NextRequest) {
  try {
    // Log the full raw Pub/Sub event for debugging and analysis
    const body = await req.json();
    console.log('🔔 Raw Pub/Sub event:', JSON.stringify(body, null, 2));
    
    if (!body.message?.data) {
      console.log('❌ Invalid Pub/Sub message format');
      return NextResponse.json(
        { error: 'Invalid Pub/Sub message format' },
        { status: 400 }
      );
    }

    // Decode Pub/Sub data
    const messageData = Buffer.from(body.message.data, 'base64').toString('utf-8');
    const parsedData = JSON.parse(messageData);
    console.log('📧 Received Gmail webhook:', parsedData);
    
    const userEmail = parsedData.emailAddress;
    const incomingHistoryId = Number(parsedData.historyId);

    // Check environment variables
    console.log('🔍 Environment check:');
    console.log('- Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing');
    console.log('- Supabase Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing');

    // Get stored Gmail tokens
    const tokens = await getStoredTokensForEmail(userEmail);
    if (!tokens) {
      console.error(`❌ No stored Gmail tokens found for ${userEmail}`);
      return NextResponse.json(
        { error: `Gmail not authenticated for ${userEmail}` },
        { status: 401 }
      );
    }

    // 1) Fetch token row (including our lock & pending flags)
    const { data: tokenRow } = await supabaseServer
      .from('google_tokens')
      .select(
        'start_history_id, cooldown_until, last_checked_at, processing_pending, is_processing'
      )
      .eq('email', userEmail)
      .single();

    // 2) If first‐ever event, just set start_history_id and return
    if (!tokenRow?.start_history_id) {
      await supabaseServer
        .from('google_tokens')
        .update({ start_history_id: incomingHistoryId })
        .eq('email', userEmail);
      console.log('🔑 Set initial historyId, skipping processing.');
      return NextResponse.json({ success: true });
    }

    const now = new Date();
    const lastHistoryId = Number(tokenRow.start_history_id);
    console.log(`🔢 lastHistoryId: ${lastHistoryId}, currentHistoryId: ${incomingHistoryId}`);

    // ─── Step A: Prevent overlapping Gmail calls ─────────────────────────────────

    // A.1) If a worker is already in flight for this user, just exit (but mark pending if not already)
    if (tokenRow.is_processing) {
      if (!tokenRow.processing_pending) {
        await supabaseServer
          .from('google_tokens')
          .update({ processing_pending: true })
          .eq('email', userEmail);
      }
      console.log('⏭️ Another process is already handling', userEmail);
      return NextResponse.json({ success: true });
    }

    // ─── Step B: Check cooldown and minimum‐interval throttle ─────────────────────────

    // B.1) If still in cooldown, mark "pending" and exit
    if (tokenRow.cooldown_until && new Date(tokenRow.cooldown_until) > now) {
      console.log('⏸️ In cooldown until', tokenRow.cooldown_until);
      if (!tokenRow.processing_pending) {
        await supabaseServer
          .from('google_tokens')
          .update({ processing_pending: true })
          .eq('email', userEmail);
      }
      return NextResponse.json({ success: true, message: 'In cooldown.' });
    }

    // B.2) If we called Gmail less than 60s ago, throttle: mark "pending" and exit
    if (tokenRow.last_checked_at) {
      const diffMs = now.getTime() - new Date(tokenRow.last_checked_at).getTime();
      if (diffMs < 60_000) {
        console.log(`⏳ Only ${Math.round(diffMs / 1000)}s since last check—throttling.`);
        if (!tokenRow.processing_pending) {
          await supabaseServer
            .from('google_tokens')
            .update({ processing_pending: true })
            .eq('email', userEmail);
        }
        return NextResponse.json({ success: true, message: 'Throttled due to interval.' });
      }
    }

    // ─── Step C: Now we are allowed to "process" ──────────────────────────────────────

    // C.1) Acquire lock and set pending=true & update last_checked_at
    await supabaseServer
      .from('google_tokens')
      .update({
        is_processing: true,
        processing_pending: true,   // signify "there is work to do"
        last_checked_at: now.toISOString(),
      })
      .eq('email', userEmail);

    // ⚡ CRITICAL: ACK the Pub/Sub message IMMEDIATELY before heavy processing
    console.log('✅ Pub/Sub message ACK\'ed, starting background processing...');
    
    // Start background processing (don't await)
    processGmailEventInBackground(userEmail, incomingHistoryId, tokens, tokenRow, lastHistoryId)
      .catch(error => {
        console.error('💥 Background processing error:', error);
      });

    // Return 200 immediately to ACK the Pub/Sub message
    return NextResponse.json({ success: true, message: 'Processing started in background' });

  } catch (error) {
    console.error('💥 Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error },
      { status: 500 }
    );
  }
}

// Background processing function
async function processGmailEventInBackground(
  userEmail: string,
  incomingHistoryId: number,
  tokens: any,
  tokenRow: any,
  lastHistoryId: number
) {
  let succeeded = false;

  try {
    // Initialize Gmail client
    let gmail;
    try {
      gmail = await getFreshGmailClient(tokens, userEmail);
      console.log('📬 Gmail client initialized (fresh token)');
    } catch (err) {
      console.error('❌ Failed to initialize Gmail client:', err);
      return;
    }

    // ─── Step D: Determine the highest history_id in the queue (if any) ───────────────

    const { data: queued } = await supabaseServer
      .from('gmail_event_queue')
      .select('history_id')
      .eq('email', userEmail)
      .eq('processed', false)
      .order('history_id', { ascending: false })
      .limit(1);

    // Instead of picking queued[0] unconditionally, take the max(incoming, queued)
    let highestQueuedId = incomingHistoryId;
    if (queued && queued.length > 0) {
      highestQueuedId = Math.max(incomingHistoryId, Number(queued[0].history_id));
    }

    console.log('🗳️ Will process up to historyId =', highestQueuedId);

    // ─── Step E: Call Gmail History API once, using the last pointer ────────────────────

    let historyResp;
    try {
      historyResp = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: lastHistoryId.toString(),
        historyTypes: ['messageAdded'],
        maxResults: 50, // fetch up to 50 new messages
      });
      console.log('📜 Gmail History API response:', JSON.stringify(historyResp.data, null, 2));
    } catch (err: any) {
      // E.1) If we get a 429, set a longer cooldown and re-enqueue that highestQueuedId
      if (err?.response?.status === 429) {
        const retryAfterSec = parseInt(
          err?.response?.headers?.['retry-after'] || '300',
          10
        );
        const nextCooldown = new Date(Date.now() + retryAfterSec * 1000);

        // Save cooldown_until and release the lock
        await supabaseServer
          .from('google_tokens')
          .update({
            cooldown_until: nextCooldown.toISOString(),
            is_processing: false,       // release lock so next push can re-check cooldown
            // leave processing_pending = true so that the queue remains "pending" 
          })
          .eq('email', userEmail);

        // Queue exactly one retry marker
        await queueGmailEvent(userEmail, highestQueuedId);
        console.warn('⚠️ Rate limited. New cooldown until', nextCooldown.toISOString());
        return;
      }

      // If any other error, log and return
      console.error('❌ Gmail History API error:', err);
      return;
    }

    // ─── Step F: We got data back from Gmail, so process the new messages ───────────────

    const historyItems = historyResp.data?.history || [];
    const newMessageIds = historyItems
      .flatMap((h: any) => h.messagesAdded || [])
      .map((m: any) => m.message.id);

    // F.1) If no new messages, simply bump the pointer and clear the queue rows
    if (newMessageIds.length === 0) {
      console.log('✅ No new messages—bumping pointer and clearing queue.');
      await supabaseServer
        .from('google_tokens')
        .update({
          start_history_id: highestQueuedId, // advance our pointer
          cooldown_until: null,              // clear any old cooldown
        })
        .eq('email', userEmail);

      // Mark all queued rows ≤ highestQueuedId as processed
      await supabaseServer
        .from('gmail_event_queue')
        .update({ processed: true })
        .eq('email', userEmail)
        .lte('history_id', highestQueuedId);

      succeeded = true;
      return;
    }

    // F.2) Otherwise, there are actual new message IDs to go fetch & process
    console.log(`📨 Found ${newMessageIds.length} new message(s).`);

    for (const messageId of newMessageIds) {
      console.log('🆔 Processing messageId =', messageId);
      
      let message;
      try {
        message = await getMessage(gmail, messageId);
      } catch (error: any) {
        if (error?.status === 404 || error?.code === 404) {
          console.log('⚠️ Message not found, skipping:', messageId);
          continue;
        }
        console.error('❌ Error fetching message:', error);
        continue;
      }
      
      if (!message) {
        console.log('⚠️ Message is null, skipping:', messageId);
        continue;
      }
      
      const subjectHeader = message?.payload?.headers?.find((h: { name?: string; value?: string }) => h.name?.toLowerCase() === 'subject');
      console.log('📨 Email subject:', subjectHeader?.value || '(no subject)');

      // Process attachments
      const attachments = extractAttachmentsFromMessage(message);
      console.log(`📎 Found ${attachments.length} attachments:`, attachments.map(a => `${a.filename} (${a.mimeType})`));
      
      for (const attachment of attachments) {
        const attachmentFilename = attachment.filename;
        
        // Check: Has this specific attachment been processed before?
        const { data: existingAttachment } = await supabaseServer
          .from('invoice_class_invoices')
          .select('id')
          .eq('attachment_filename', attachmentFilename)
          .limit(1);
        
        if (existingAttachment && existingAttachment.length > 0) {
          console.log('⏭️ Attachment already processed, skipping:', attachmentFilename);
          continue;
        }
        
        console.log(`🔍 Checking attachment: ${attachment.filename} (${attachment.mimeType})`);
        
        // Check if this looks like an invoice file
        const isInvoice = isInvoiceFile(attachment.filename, attachment.mimeType);
        console.log(`📄 Is invoice file: ${isInvoice}`);
        
        if (!isInvoice) {
          console.log(`⏭️ Skipping non-invoice file: ${attachment.filename}`);
          continue;
        }

        console.log(`💼 Processing invoice attachment: ${attachment.filename}`);

        // Download the attachment
        const attachmentData = await downloadAttachment(
          gmail, 
          messageId, 
          attachment.attachmentId
        );
        
        if (!attachmentData || !attachmentData.data) {
          console.error('❌ Failed to download attachment data');
          continue;
        }

        console.log('✅ Attachment downloaded successfully');

        // Convert base64 to buffer
        const fileBuffer = Buffer.from(attachmentData.data, 'base64');
        console.log(`📦 File buffer created, size: ${fileBuffer.length} bytes`);
        
        // Generate unique filename
        const uniqueFilename = `${uuidv4()}-${attachment.filename}`;
        console.log('📝 Generated unique filename:', uniqueFilename);
        
        // Upload to Supabase Storage
        console.log('☁️ Uploading to Supabase Storage...');
        const pdfUrl = await uploadFileToStorage(
          fileBuffer,
          uniqueFilename,
          attachment.mimeType
        );
        
        if (!pdfUrl) {
          console.error('❌ Failed to upload file to storage');
          continue;
        }

        console.log('✅ File uploaded successfully:', pdfUrl);

        // Extract basic info from email headers
        const headers = message.payload?.headers || [];
        const fromHeader = headers.find((h: { name?: string; value?: string }) => h.name?.toLowerCase() === 'from');
        const dateHeader = headers.find((h: { name?: string; value?: string }) => h.name?.toLowerCase() === 'date');

        const emailMetadata = {
          from: fromHeader?.value || 'Unknown',
          date: dateHeader?.value || new Date().toISOString()
        };

        console.log('📧 Email metadata extracted:', emailMetadata);

        // Create initial invoice record
        console.log('💾 Creating initial invoice record...');
        const initialInvoiceData = {
          vendor_name: extractVendorFromEmail(emailMetadata.from),
          extracted_text: `Email from: ${emailMetadata.from}\nDate: ${emailMetadata.date}`,
          pdf_url: pdfUrl,
          status: 'pending' as const,
          payment_status: 'not_sent' as const,
          gmail_message_id: messageId,
          attachment_filename: attachmentFilename
        };

        let invoiceRecord;
        try {
          invoiceRecord = await insertInvoice(initialInvoiceData);
        } catch (insertError: any) {
          console.error('❌ Failed to create invoice record:', insertError);
          
          // If it's a constraint violation, it might be a race condition or database schema issue
          if (insertError?.code === '23505') {
            console.log('⚠️ Constraint violation - this might be a duplicate or schema issue');
            console.log('🔍 Constraint details:', insertError.details);
            console.log('💡 Hint:', insertError.hint);
          }
          
          // Clean up the uploaded file since we're not using it
          const fileName = pdfUrl.split('/').pop();
          if (fileName) {
            await supabaseServer.storage
              .from('invoices-pdf')
              .remove([decodeURIComponent(fileName)]);
            console.log('🗑️ Cleaned up uploaded file due to failed insert');
          }
          
          continue;
        }
        
        if (!invoiceRecord) {
          console.error('❌ Failed to create invoice record (insertInvoice returned null)');
          
          // Clean up the uploaded file since we're not using it
          const fileName = pdfUrl.split('/').pop();
          if (fileName) {
            await supabaseServer.storage
              .from('invoices-pdf')
              .remove([decodeURIComponent(fileName)]);
            console.log('🗑️ Cleaned up uploaded file due to null response');
          }
          
          continue;
        }

        console.log('✅ Initial invoice record created:', invoiceRecord.id);

        // Process with GPT-4o for data extraction
        console.log('🤖 Processing with GPT-4o...');
        const extractedData = await extractInvoiceDataWithGPT4o(pdfUrl);
        
        if (extractedData) {
          console.log('✅ GPT-4o extraction successful');
          
          // Now classify the invoice
          console.log('🔍 Starting invoice classification...');
          const classification = await classifyInvoice(
            extractedData.vendor_name || initialInvoiceData.vendor_name,
            extractedData.amount || 0,
            extractedData.extracted_text || initialInvoiceData.extracted_text
          );
          
          console.log('✅ Classification completed:', classification);

          // Update invoice with extracted data and classification
          console.log('📝 Updating invoice with extracted data and classification...');
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
            }
          };

          await supabaseServer
            .from('invoice_class_invoices')
            .update(updateData)
            .eq('id', invoiceRecord.id);

          console.log('✅ Invoice updated with classification');

          // Update vendor profile
          if (extractedData.vendor_name && extractedData.amount) {
            console.log('👤 Updating vendor profile...');
            await updateVendorProfile(
              extractedData.vendor_name,
              classification.category,
              classification.subcategory,
              extractedData.amount
            );
            console.log('✅ Vendor profile updated');
          }

        } else {
          console.log('⚠️ GPT-4o extraction failed, keeping initial record');
        }

        console.log('🎉 Invoice processing completed for:', attachment.filename);
      }
    }

    // F.3) After all messageIds are done, advance the pointer & clear queue rows
    await supabaseServer
      .from('google_tokens')
      .update({
        start_history_id: highestQueuedId,
        cooldown_until: null,      // clear any old cooldown
      })
      .eq('email', userEmail);

    await supabaseServer
      .from('gmail_event_queue')
      .update({ processed: true })
      .eq('email', userEmail)
      .lte('history_id', highestQueuedId);

    console.log('✅ Background webhook processing completed and historyId updated');
    succeeded = true;

  } finally {
    // Always release the lock. If we succeeded, clear pending; if not, keep pending = true.
    await supabaseServer
      .from('google_tokens')
      .update({
        is_processing: false,
        processing_pending: succeeded ? false : true
      })
      .eq('email', userEmail);
  }
}

// Helper function to extract vendor name from email
function extractVendorFromEmail(email: string): string {
  // Extract name from "Name <email@domain.com>" format
  const match = email.match(/^(.+?)\s*<.*>$/);
  if (match) {
    return match[1].trim();
  }
  
  // If no match, return the email as is
  return email.split('@')[0].replace(/[._]/g, ' ').trim();
} 
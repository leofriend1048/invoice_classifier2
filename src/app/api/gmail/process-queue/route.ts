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
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

function extractVendorFromEmail(email: string): string {
    const match = email.match(/^(.+?)\s*<.*>$/);
    if (match) return match[1].trim();
    return email.split('@')[0].replace(/[._]/g, ' ').trim();
}

export async function POST() {
    const userEmail = 'mtbinvoice@gmail.com'; // Hardcoded for this cron job
    let lockAcquired = false;

    try {
        // 1. Check for and acquire a process lock
        const { data: tokenRow, error: tokenError } = await supabaseServer
            .from('google_tokens')
            .select('is_processing, last_checked_at, start_history_id')
            .eq('email', userEmail)
            .single();

        if (tokenError || !tokenRow) {
            console.log('🤷 No token row found for user, exiting.');
            return NextResponse.json({ success: true, message: 'No user token row.' });
        }

        const now = new Date();
        if (tokenRow.is_processing && tokenRow.last_checked_at) {
            const lockAge = now.getTime() - new Date(tokenRow.last_checked_at).getTime();
            if (lockAge < 5 * 60 * 1000) { // 5 minute lock
                console.log('🏃 Process already running, exiting.');
                return NextResponse.json({ success: true, message: 'Process already running.' });
            }
            console.log(`🔓 Stale lock detected (${Math.round(lockAge / 1000 / 60)} min), proceeding.`);
        }
        
        await supabaseServer.from('google_tokens').update({ is_processing: true, last_checked_at: now.toISOString() }).eq('email', userEmail);
        lockAcquired = true;

        // 2. Fetch all unprocessed events from the queue
        const { data: queuedEvents, error: queueError } = await supabaseServer
            .from('gmail_event_queue')
            .select('history_id')
            .eq('email', userEmail)
            .eq('processed', false)
            .order('history_id', { ascending: true });

        if (queueError || queuedEvents.length === 0) {
            console.log('📪 Queue is empty, exiting.');
            await supabaseServer.from('google_tokens').update({ processing_pending: false }).eq('email', userEmail);
            return NextResponse.json({ success: true, message: 'Queue is empty.' });
        }

        const highestQueuedId = Math.max(...queuedEvents.map(e => Number(e.history_id)));
        const lastHistoryId = Number(tokenRow.start_history_id);

        if (highestQueuedId <= lastHistoryId) {
            console.log('✅ History ID already caught up, clearing queue.');
            await supabaseServer.from('gmail_event_queue').update({ processed: true }).eq('email', userEmail).lte('history_id', highestQueuedId);
            await supabaseServer.from('google_tokens').update({ processing_pending: false }).eq('email', userEmail);
            return NextResponse.json({ success: true, message: 'History ID up to date.' });
        }
        
        console.log(`🔄 Processing from ${lastHistoryId} to ${highestQueuedId}`);

        // 3. Initialize Gmail client
        const tokens = await getStoredTokensForEmail(userEmail);
        if (!tokens) throw new Error('No stored Gmail tokens found.');
        const gmail = await getFreshGmailClient(tokens, userEmail);

        // 4. Call Gmail History API
        const historyResp = await gmail.users.history.list({
            userId: 'me',
            startHistoryId: lastHistoryId.toString(),
            historyTypes: ['messageAdded'],
        });

        const historyItems = historyResp.data?.history || [];
        const newMessageIds = historyItems.flatMap((h: any) => h.messagesAdded || []).map((m: any) => m.message.id);

        if (newMessageIds.length === 0) {
            console.log('✅ No new messages from history, updating pointer and clearing queue.');
        } else {
            console.log(`📨 Found ${newMessageIds.length} new message(s).`);
            // Timeout protection
            const startTime = Date.now();
            const maxProcessingTime = 50000; // 50 seconds

            for (const messageId of newMessageIds) {
                if (Date.now() - startTime > maxProcessingTime) {
                    console.log('⏰ Approaching timeout, will continue on next run.');
                    break;
                }
                
                console.log('🆔 Processing messageId =', messageId);
                const message = await getMessage(gmail, messageId);
                if (!message) continue;

                const attachments = extractAttachmentsFromMessage(message);
                for (const attachment of attachments) {
                    if (!isInvoiceFile(attachment.filename, attachment.mimeType)) continue;

                    const { data: existing } = await supabaseServer.from('invoice_class_invoices').select('id').eq('attachment_filename', attachment.filename).limit(1);
                    if (existing && existing.length > 0) {
                        console.log('⏭️ Attachment already processed, skipping:', attachment.filename);
                        continue;
                    }

                    const attachmentData = await downloadAttachment(gmail, messageId, attachment.attachmentId);
                    if (!attachmentData?.data) continue;

                    const fileBuffer = Buffer.from(attachmentData.data, 'base64');
                    const uniqueFilename = `${uuidv4()}-${attachment.filename}`;
                    const pdfUrl = await uploadFileToStorage(fileBuffer, uniqueFilename, attachment.mimeType);
                    if (!pdfUrl) continue;

                    const headers = message.payload?.headers || [];
                    const from = headers.find((h: any) => h.name?.toLowerCase() === 'from')?.value || 'Unknown';

                    const initialInvoiceData = {
                        vendor_name: extractVendorFromEmail(from),
                        pdf_url: pdfUrl, status: 'pending' as const, payment_status: 'not_sent' as const,
                        gmail_message_id: messageId, attachment_filename: attachment.filename
                    };
                    const invoiceRecord = await insertInvoice(initialInvoiceData);
                    if (!invoiceRecord) {
                        // Cleanup storage?
                        continue;
                    }
                    
                    const extractedData = await extractInvoiceDataWithGPT4o(pdfUrl);
                    if (extractedData) {
                        const classification = await classifyInvoice(extractedData.vendor_name || initialInvoiceData.vendor_name, extractedData.amount || 0, extractedData.extracted_text || '');
                        const updateData = { ...extractedData, ...classification };
                        await supabaseServer.from('invoice_class_invoices').update(updateData).eq('id', invoiceRecord.id);
                        if (extractedData.vendor_name && extractedData.amount) {
                            await updateVendorProfile(extractedData.vendor_name, classification.category, extractedData.amount);
                        }
                    }
                }
            }
        }

        // 5. Update pointers and clear processed queue items
        await supabaseServer.from('google_tokens').update({ start_history_id: highestQueuedId }).eq('email', userEmail);
        await supabaseServer.from('gmail_event_queue').update({ processed: true }).eq('email', userEmail).lte('history_id', highestQueuedId);
        
        // Check if there are still pending events
        const { data: remaining } = await supabaseServer.from('gmail_event_queue').select('history_id').eq('email', userEmail).eq('processed', false).limit(1);
        if (remaining && remaining.length === 0) {
            await supabaseServer.from('google_tokens').update({ processing_pending: false }).eq('email', userEmail);
            console.log('✅ Queue empty, pending flag cleared.');
        }

        return NextResponse.json({ success: true, message: `Processed up to historyId ${highestQueuedId}` });

    } catch (error) {
        console.error('💥 Queue processing error:', error);
        return NextResponse.json({ error: 'Queue processing failed', details: error }, { status: 500 });
    } finally {
        if (lockAcquired) {
            await supabaseServer.from('google_tokens').update({ is_processing: false }).eq('email', userEmail);
            console.log('🔑 Lock released.');
        }
    }
} 
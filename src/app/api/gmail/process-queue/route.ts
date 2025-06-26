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
import { createSafeUniqueFilename } from '@/lib/url-utils';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

function extractVendorFromEmail(email: string): string {
    const match = email.match(/^(.+?)\s*<.*>$/);
    if (match) return match[1].trim();
    return email.split('@')[0].replace(/[._]/g, ' ').trim();
}

async function processUserQueue(userEmail: string) {
    console.log(`\n--- Processing queue for ${userEmail} ---`);
    let lockAcquired = false;
    try {
        const { data: tokenRow, error: tokenError } = await supabaseServer
            .from('google_tokens')
            .select('is_processing, last_checked_at, start_history_id')
            .eq('email', userEmail)
            .single();

        if (tokenError || !tokenRow) {
            console.log(`🤷 No token row found for ${userEmail}, skipping.`);
            return { success: true, message: 'No token row.' };
        }

        const now = new Date();
        if (tokenRow.is_processing && tokenRow.last_checked_at) {
            const lockAge = now.getTime() - new Date(tokenRow.last_checked_at).getTime();
            if (lockAge < 5 * 60 * 1000) { // 5 minute lock
                console.log(`🏃 Process already running for ${userEmail}, skipping.`);
                return { success: true, message: 'Process already running.' };
            }
            console.log(`🔓 Stale lock for ${userEmail} (${Math.round(lockAge / 1000 / 60)} min), proceeding.`);
        }

        await supabaseServer.from('google_tokens').update({ is_processing: true, last_checked_at: now.toISOString() }).eq('email', userEmail);
        lockAcquired = true;

        const { data: queuedEvents, error: queueError } = await supabaseServer
            .from('gmail_event_queue')
            .select('history_id')
            .eq('email', userEmail)
            .eq('processed', false)
            .order('history_id', { ascending: true });

        if (queueError || queuedEvents.length === 0) {
            console.log(`📪 Queue is empty for ${userEmail}.`);
            await supabaseServer.from('google_tokens').update({ processing_pending: false }).eq('email', userEmail);
            return { success: true, message: 'Queue is empty.' };
        }

        const highestQueuedId = Math.max(...queuedEvents.map(e => Number(e.history_id)));
        const lastHistoryId = Number(tokenRow.start_history_id);

        if (highestQueuedId <= lastHistoryId) {
            console.log(`✅ History ID already caught up for ${userEmail}, clearing queue.`);
            await supabaseServer.from('gmail_event_queue').update({ processed: true }).eq('email', userEmail).lte('history_id', highestQueuedId);
            await supabaseServer.from('google_tokens').update({ processing_pending: false }).eq('email', userEmail);
            return { success: true, message: 'History ID up to date.' };
        }

        console.log(`🔄 Processing ${userEmail} from ${lastHistoryId} to ${highestQueuedId}`);
        const tokens = await getStoredTokensForEmail(userEmail);
        if (!tokens) throw new Error(`No stored Gmail tokens for ${userEmail}.`);
        const gmail = await getFreshGmailClient(tokens, userEmail);

        const historyResp = await gmail.users.history.list({
            userId: 'me',
            startHistoryId: lastHistoryId.toString(),
            historyTypes: ['messageAdded'],
        });

        const historyItems = historyResp.data?.history || [];
        const newMessageIds = historyItems.flatMap((h: any) => h.messagesAdded || []).map((m: any) => m.message.id);

        if (newMessageIds.length > 0) {
            console.log(`📨 Found ${newMessageIds.length} new message(s) for ${userEmail}.`);
            const startTime = Date.now();
            const maxProcessingTime = 50000; // 50 seconds

            for (const messageId of newMessageIds) {
                if (Date.now() - startTime > maxProcessingTime) {
                    console.log('⏰ Approaching timeout, will continue on next run.');
                    break;
                }

                console.log(`🆔 Processing messageId ${messageId} for ${userEmail}`);
                const message = await getMessage(gmail, messageId);
                if (!message) continue;

                let invoiceProcessedForMessage = false;
                const attachments = extractAttachmentsFromMessage(message);
                for (const attachment of attachments) {
                    if (invoiceProcessedForMessage) break;
                    if (!isInvoiceFile(attachment.filename, attachment.mimeType)) continue;

                    const { data: existing } = await supabaseServer.from('invoice_class_invoices').select('id').eq('attachment_filename', attachment.filename).eq('gmail_message_id', messageId).limit(1);
                    if (existing && existing.length > 0) {
                        console.log(`⏭️ Attachment already processed: ${attachment.filename}`);
                        continue;
                    }

                    const attachmentData = await downloadAttachment(gmail, messageId, attachment.attachmentId);
                    if (!attachmentData?.data) continue;

                    const fileBuffer = Buffer.from(attachmentData.data, 'base64');
                    const uniqueFilename = createSafeUniqueFilename(attachment.filename, uuidv4());
                    console.log(`📄 Original filename: ${attachment.filename}`);
                    console.log(`📄 Safe filename: ${uniqueFilename}`);
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
                    if (!invoiceRecord) continue;

                    invoiceProcessedForMessage = true;

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
        
        await supabaseServer.from('google_tokens').update({ start_history_id: highestQueuedId }).eq('email', userEmail);
        await supabaseServer.from('gmail_event_queue').update({ processed: true }).eq('email', userEmail).lte('history_id', highestQueuedId);

        const { data: remaining } = await supabaseServer.from('gmail_event_queue').select('id').eq('email', userEmail).eq('processed', false).limit(1);
        if (!remaining || remaining.length === 0) {
            await supabaseServer.from('google_tokens').update({ processing_pending: false }).eq('email', userEmail);
            console.log(`✅ Queue empty for ${userEmail}, pending flag cleared.`);
        }

        return { success: true, message: `Processed ${userEmail} up to historyId ${highestQueuedId}` };
    } catch (error) {
        console.error(`💥 Queue processing error for ${userEmail}:`, error);
        return { success: false, error: 'Queue processing failed', details: error };
    } finally {
        if (lockAcquired) {
            await supabaseServer.from('google_tokens').update({ is_processing: false }).eq('email', userEmail);
            console.log(`🔑 Lock released for ${userEmail}.`);
        }
    }
}

export async function POST() {
    try {
        const { data: usersToProcess, error: usersError } = await supabaseServer
            .from('google_tokens')
            .select('email')
            .eq('processing_pending', true);

        if (usersError) {
            console.error('Error fetching users to process:', usersError);
            throw new Error('Could not fetch users to process.');
        }

        if (!usersToProcess || usersToProcess.length === 0) {
            return NextResponse.json({ success: true, message: 'No users to process.' });
        }

        console.log(`Found ${usersToProcess.length} user(s) to process.`);
        
        const results = [];
        for (const user of usersToProcess) {
            const result = await processUserQueue(user.email);
            results.push({ email: user.email, ...result });
        }

        return NextResponse.json({ success: true, results });

    } catch (error) {
        console.error('💥 Top-level POST error:', error);
        return NextResponse.json({ 
            success: false, 
            error: 'Failed to process queues', 
            details: error instanceof Error ? error.message : 'Unknown error' 
        }, { status: 500 });
    }
}

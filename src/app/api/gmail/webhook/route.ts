export const dynamic = "force-dynamic";
import { supabaseServer } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

// Upsert an event into gmail_event_queue
async function queueGmailEvent(email: string, historyId: number) {
  const { error } = await supabaseServer
    .from('gmail_event_queue')
    .upsert(
      [{ email, history_id: historyId, processed: false, created_at: new Date().toISOString() }],
      { onConflict: 'email,history_id' }
    );
  if (error) console.error(`❌ Failed to queue Gmail event:`, error);
  else console.log(`📥 Queued Gmail event for email=${email}, historyId=${historyId}`);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('🔔 Raw Pub/Sub event:', JSON.stringify(body, null, 2));
    
    if (!body.message?.data) {
      console.log('❌ Invalid Pub/Sub message format');
      return NextResponse.json(
        { error: 'Invalid Pub/Sub message format' },
        { status: 400 }
      );
    }

    const messageData = Buffer.from(body.message.data, 'base64').toString('utf-8');
    const parsedData = JSON.parse(messageData);
    console.log('📧 Received Gmail webhook:', parsedData);
    
    const userEmail = parsedData.emailAddress;
    const incomingHistoryId = Number(parsedData.historyId);

    // Get token row to check for locks and historyId
    const { data: tokenRow } = await supabaseServer
      .from('google_tokens')
      .select('start_history_id, cooldown_until, last_checked_at, processing_pending, is_processing')
      .eq('email', userEmail)
      .single();
      
    if (!tokenRow) {
        console.error(`❌ No google_tokens row found for ${userEmail}`);
        // Still ACK the message to prevent Pub/Sub retries for a user that doesn't exist.
        return NextResponse.json({ success: true, message: 'User not found, event ignored.' });
    }

    // If first‐ever event, just set start_history_id and return
    if (!tokenRow.start_history_id) {
      await supabaseServer
        .from('google_tokens')
        .update({ start_history_id: incomingHistoryId })
        .eq('email', userEmail);
      console.log('🔑 Set initial historyId, skipping queue.');
      return NextResponse.json({ success: true });
    }

    // Queue the event for the background processor
    await queueGmailEvent(userEmail, incomingHistoryId);
    
    // Set pending flag to indicate there is work to do
    if (!tokenRow.processing_pending) {
        await supabaseServer
            .from('google_tokens')
            .update({ processing_pending: true })
            .eq('email', userEmail);
    }

    console.log('✅ Pub/Sub message ACK\'ed, event queued for processing.');
    return NextResponse.json({ success: true, message: 'Event queued successfully' });

  } catch (error) {
    console.error('💥 Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error },
      { status: 500 }
    );
  }
} 
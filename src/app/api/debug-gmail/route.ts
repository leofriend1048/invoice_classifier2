// src/app/api/debug-gmail/route.ts

import { supabaseServer } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    // Check the current processing status
    const { data: tokenStatus } = await supabaseServer
      .from('google_tokens')
      .select('email, is_processing, processing_pending, last_checked_at, cooldown_until')
      .eq('email', 'mtbinvoice@gmail.com')
      .single();

    return NextResponse.json({
      success: true,
      status: tokenStatus,
      message: 'Current Gmail processing status'
    });

  } catch (error) {
    console.error('❌ Debug check failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to check status',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json();

    if (action === 'reset-lock') {
      // Reset the processing lock
      await supabaseServer
        .from('google_tokens')
        .update({
          is_processing: false,
          processing_pending: false,
          cooldown_until: null
        })
        .eq('email', 'mtbinvoice@gmail.com');

      return NextResponse.json({
        success: true,
        message: 'Processing lock reset successfully'
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action'
    });

  } catch (error) {
    console.error('❌ Debug reset failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to reset lock',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

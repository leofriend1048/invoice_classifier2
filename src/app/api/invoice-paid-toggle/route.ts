import { supabaseServer } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, is_paid } = body;

    if (!id || typeof is_paid !== 'boolean') {
      return NextResponse.json(
        { error: 'Invoice ID and is_paid boolean are required' },
        { status: 400 }
      );
    }

    // Update the invoice paid status
    const { error: updateError } = await supabaseServer
      .from('invoice_class_invoices')
      .update({ is_paid })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating invoice paid status:', updateError);
      return NextResponse.json(
        { error: 'Failed to update invoice paid status' },
        { status: 500 }
      );
    }

    // Log the change in audit trail
    const { error: auditError } = await supabaseServer
      .from('invoice_class_invoice_audit_trail')
      .insert({
        invoice_id: id,
        action: 'is_paid_updated',
        performed_by: 'ui_user',
        details: {
          after: { is_paid },
        },
      });

    if (auditError) {
      console.error('Error logging audit trail:', auditError);
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json({ 
      success: true, 
      message: `Invoice marked as ${is_paid ? 'paid' : 'unpaid'}` 
    });

  } catch (error) {
    console.error('Error in invoice-paid-toggle API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
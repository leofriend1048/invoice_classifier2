import { classifyInvoice, updateVendorProfile } from '@/lib/classification';
import { supabaseServer } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('🧪 Testing classification system...');

    // Get the most recent invoice from the database
    const { data: invoices, error } = await supabaseServer
      .from('invoice_class_invoices')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('❌ Database error:', error);
      return NextResponse.json({
        success: false,
        error: 'Database query failed',
        details: error
      });
    }

    if (!invoices || invoices.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No invoices found in database',
        message: 'Please send a test email with an invoice attachment first'
      });
    }

    const invoice = invoices[0];
    console.log('📄 Found invoice:', invoice.id);
    console.log('🏢 Vendor:', invoice.vendor_name);
    console.log('💰 Amount:', invoice.amount);

    if (!invoice.vendor_name || !invoice.extracted_text) {
      return NextResponse.json({
        success: false,
        error: 'Invoice missing required data for classification',
        invoice: invoice
      });
    }

    // Test classification
    console.log('🔍 Testing classification...');
    const classification = await classifyInvoice(
      invoice.vendor_name,
      invoice.amount || 0,
      invoice.extracted_text || ''
    );

    console.log('✅ Classification completed:', classification);

    // Update the invoice with classification
    const { data: updatedInvoice, error: updateError } = await supabaseServer
      .from('invoice_class_invoices')
      .update({
        classification_suggestion: {
          category: classification.category,
          subcategory: classification.subcategory,
          description: classification.description,
          confidence: classification.confidence,
          method: classification.method,
          pattern_id: classification.pattern_id,
          gl_account: classification.gl_account,
          branch: classification.branch,
          division: classification.division,
          payment_method: classification.payment_method,
        },
        // Persist classification fields to main columns
        gl_account: classification.gl_account ?? null,
        branch: classification.branch ?? null,
        division: classification.division ?? 'Ecommerce',
        payment_method: classification.payment_method ?? null,
        category: classification.category ?? null,
        subcategory: classification.subcategory ?? null,
        description: classification.description ?? null,
      })
      .eq('id', invoice.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Update error:', updateError);
      return NextResponse.json({
        success: true,
        classification: classification,
        warning: 'Classification successful but failed to update database',
        updateError
      });
    }

    // Test vendor profile update
    console.log('👤 Testing vendor profile update...');
    await updateVendorProfile(
      invoice.vendor_name,
      classification.category,
      invoice.amount || 0
    );

    return NextResponse.json({
      success: true,
      message: 'Classification system test completed successfully!',
      originalInvoice: invoice,
      classification: classification,
      updatedInvoice: updatedInvoice
    });

  } catch (error) {
    console.error('💥 Test error:', error);
    return NextResponse.json({
      success: false,
      error: 'Classification test failed',
      details: error
    });
  }
} 
import { extractInvoiceDataWithGPT4o } from '@/lib/openai';
import { supabaseServer } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('🧪 Testing GPT-4o processing with existing invoices...');

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
    console.log('🔗 PDF URL:', invoice.pdf_url);

    if (!invoice.pdf_url) {
      return NextResponse.json({
        success: false,
        error: 'No PDF URL found for this invoice',
        invoice: invoice
      });
    }

    // Test GPT-4o processing
    console.log('🤖 Testing GPT-4o processing...');
    const extractedData = await extractInvoiceDataWithGPT4o(invoice.pdf_url);

    if (!extractedData) {
      return NextResponse.json({
        success: false,
        error: 'GPT-4o processing failed',
        invoice: invoice
      });
    }

    console.log('✅ GPT-4o processing successful!');

    // Update the invoice with extracted data
    const { data: updatedInvoice, error: updateError } = await supabaseServer
      .from('invoice_class_invoices')
      .update({
        vendor_name: extractedData.vendor_name,
        invoice_date: extractedData.invoice_date,
        due_date: extractedData.due_date,
        amount: extractedData.amount,
        extracted_text: extractedData.extracted_text,
        status: 'pending'
      })
      .eq('id', invoice.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Update error:', updateError);
      return NextResponse.json({
        success: true,
        extraction: extractedData,
        warning: 'Extraction successful but failed to update database',
        updateError
      });
    }

    return NextResponse.json({
      success: true,
      message: 'GPT-4o processing completed successfully!',
      originalInvoice: invoice,
      extractedData: extractedData,
      updatedInvoice: updatedInvoice
    });

  } catch (error) {
    console.error('💥 Test error:', error);
    return NextResponse.json({
      success: false,
      error: 'Test failed',
      details: error
    });
  }
} 
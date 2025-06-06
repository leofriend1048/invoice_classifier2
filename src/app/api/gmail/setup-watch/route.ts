import { classifyInvoiceWithGPT4o, extractInvoiceDataWithGPT4o } from '@/lib/openai';
import { supabaseServer } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { invoiceId } = await req.json();
    
    if (!invoiceId) {
      return NextResponse.json(
        { error: 'Invoice ID is required' },
        { status: 400 }
      );
    }

    // Get invoice from database
    const { data: invoice, error: fetchError } = await supabaseServer
      .from('invoice_class_invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (fetchError || !invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    if (!invoice.pdf_url) {
      return NextResponse.json(
        { error: 'No PDF URL found for invoice' },
        { status: 400 }
      );
    }

    console.log('Processing invoice with GPT-4o:', invoiceId);

    // Extract data using GPT-4o OCR
    const extractedData = await extractInvoiceDataWithGPT4o(invoice.pdf_url);
    
    if (!extractedData) {
      return NextResponse.json(
        { error: 'Failed to extract data from invoice' },
        { status: 500 }
      );
    }

    // Classify the invoice
    let classificationSuggestion = null;
    if (extractedData.vendor_name && extractedData.amount && extractedData.extracted_text) {
      classificationSuggestion = await classifyInvoiceWithGPT4o(
        extractedData.vendor_name,
        extractedData.amount,
        extractedData.extracted_text
      );
    }

    // Update invoice with extracted data and classification
    const updateData = {
      vendor_name: extractedData.vendor_name || invoice.vendor_name,
      invoice_date: extractedData.invoice_date || invoice.invoice_date,
      due_date: extractedData.due_date || invoice.due_date,
      amount: extractedData.amount || invoice.amount,
      extracted_text: extractedData.extracted_text || invoice.extracted_text,
      classification_suggestion: classificationSuggestion || invoice.classification_suggestion,
      updated_at: new Date().toISOString(),
      // Persist classification fields to main columns
      gl_account: classificationSuggestion?.gl_account || null,
      branch: classificationSuggestion?.branch || null,
      division: classificationSuggestion?.division || 'Ecommerce',
      payment_method: classificationSuggestion?.payment_method || null,
      category: classificationSuggestion?.category || null,
      subcategory: classificationSuggestion?.subcategory || null,
      description: classificationSuggestion?.description || null,
    };

    const { data: updatedInvoice, error: updateError } = await supabaseServer
      .from('invoice_class_invoices')
      .update(updateData)
      .eq('id', invoiceId)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update invoice:', updateError);
      return NextResponse.json(
        { error: 'Failed to update invoice' },
        { status: 500 }
      );
    }

    // Insert audit trail entry
    await supabaseServer
      .from('invoice_class_invoice_audit_trail')
      .insert({
        invoice_id: invoiceId,
        action: 'processed_with_gpt4o',
        performed_by: 'system',
        details: {
          extracted_data: extractedData,
          classification_suggestion: classificationSuggestion
        }
      });

    return NextResponse.json({
      success: true,
      message: 'Invoice processed successfully',
      data: updatedInvoice
    });

  } catch (error) {
    console.error('Invoice processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process invoice' },
      { status: 500 }
    );
  }
} 
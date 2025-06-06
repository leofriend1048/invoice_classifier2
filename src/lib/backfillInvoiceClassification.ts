import { supabaseServer } from './supabase-server';

async function backfillInvoiceClassification() {
  console.log('🔄 Starting invoice classification backfill...');
  const { data: invoices, error } = await supabaseServer
    .from('invoice_class_invoices')
    .select('id, classification_suggestion, gl_account, branch, division, payment_method, category, subcategory, description')
    .or('gl_account.is.null,branch.is.null,division.is.null,payment_method.is.null,category.is.null,subcategory.is.null,description.is.null');

  if (error) {
    console.error('❌ Failed to fetch invoices:', error);
    return;
  }
  if (!invoices || invoices.length === 0) {
    console.log('✅ No invoices need backfill.');
    return;
  }

  let updated = 0;
  for (const invoice of invoices) {
    const suggestion = typeof invoice.classification_suggestion === 'string'
      ? JSON.parse(invoice.classification_suggestion)
      : invoice.classification_suggestion;
    if (!suggestion) continue;
    const update: any = {};
    if (!invoice.gl_account && suggestion.gl_account) update.gl_account = suggestion.gl_account;
    if (!invoice.branch && suggestion.branch) update.branch = suggestion.branch;
    if (!invoice.division && suggestion.division) update.division = suggestion.division;
    if (!invoice.payment_method && suggestion.payment_method) update.payment_method = suggestion.payment_method;
    if (!invoice.category && suggestion.category) update.category = suggestion.category;
    if (!invoice.subcategory && suggestion.subcategory) update.subcategory = suggestion.subcategory;
    if (!invoice.description && suggestion.description) update.description = suggestion.description;
    if (Object.keys(update).length > 0) {
      const { error: updateError } = await supabaseServer
        .from('invoice_class_invoices')
        .update(update)
        .eq('id', invoice.id);
      if (updateError) {
        console.error(`❌ Failed to update invoice ${invoice.id}:`, updateError);
      } else {
        updated++;
        console.log(`✅ Updated invoice ${invoice.id}`);
      }
    }
  }
  console.log(`🎉 Backfill complete. Updated ${updated} invoices.`);
}

// Only run if called directly (not imported)
if (require.main === module) {
  backfillInvoiceClassification().then(() => process.exit(0));
} 
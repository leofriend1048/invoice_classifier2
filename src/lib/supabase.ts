import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Upload file to Supabase Storage
export async function uploadFileToStorage(
  file: Buffer, 
  filename: string, 
  mimeType: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from('invoices-pdf')
      .upload(filename, file, {
        contentType: mimeType,
        upsert: true
      });

    if (error) {
      console.error('Error uploading file:', error);
      return null;
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('invoices-pdf')
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Failed to upload file:', error);
    return null;
  }
}

// Insert invoice into database
export async function insertInvoice(invoiceData: {
  vendor_name?: string;
  invoice_date?: string;
  due_date?: string;
  amount?: number;
  extracted_text?: string;
  pdf_url?: string;
  classification_suggestion?: Record<string, unknown>;
}) {
  try {
    const { data, error } = await supabase
      .from('invoice_class_invoices')
      .insert(invoiceData)
      .select()
      .single();

    if (error) {
      console.error('Error inserting invoice:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Failed to insert invoice:', error);
    return null;
  }
} 
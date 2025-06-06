import { createClient } from '@supabase/supabase-js';

// Server-side client with service role key (bypasses RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Upload file to Supabase Storage (server-side)
export async function uploadFileToStorage(
  file: Buffer, 
  filename: string, 
  mimeType: string
): Promise<string | null> {
  try {
    console.log('☁️ Uploading file to Supabase Storage...');
    console.log('📄 Filename:', filename);
    console.log('🔖 MIME type:', mimeType);
    console.log('📦 File size:', file.length, 'bytes');

    const { data, error } = await supabaseServer.storage
      .from('invoices-pdf')
      .upload(filename, file, {
        contentType: mimeType,
        upsert: true
      });

    if (error) {
      console.error('❌ Error uploading file:', error);
      return null;
    }

    console.log('✅ File uploaded successfully:', data.path);

    // Get public URL (no expiration, publicly accessible)
    console.log('🔗 Generating public URL for permanent access...');
    const { data: publicUrlData } = supabaseServer.storage
      .from('invoices-pdf')
      .getPublicUrl(data.path);

    console.log('🔗 Using public URL:', publicUrlData.publicUrl);
    return publicUrlData.publicUrl;

  } catch (error) {
    console.error('💥 Failed to upload file:', error);
    return null;
  }
}

// Insert invoice into database (server-side)
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
    const { data, error } = await supabaseServer
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
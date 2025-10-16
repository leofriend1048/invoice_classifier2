import { createClient } from '@supabase/supabase-js';

// Server-side client with service role key (bypasses RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Enhanced Supabase client configuration for production resilience
export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'X-Client-Info': 'invoice-classifier-server'
    }
  },
  // Connection pool settings for better reliability
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Upload file to Supabase Storage (server-side) with enhanced error handling
export async function uploadFileToStorage(
  file: Buffer, 
  filename: string, 
  mimeType: string
): Promise<string | null> {
  const maxRetries = 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      console.log(`☁️ Uploading file to Supabase Storage (attempt ${attempt + 1}/${maxRetries})...`);
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
        throw error;
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
      attempt++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';
      console.error(`❌ Upload attempt ${attempt}/${maxRetries} failed:`, errorMessage);
      
      if (attempt >= maxRetries) {
        console.error('💥 Failed to upload file after all retry attempts:', error);
        return null;
      }
      
      // Exponential backoff with jitter
      const delay = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 1000, 10000);
      console.log(`⏳ Waiting ${Math.round(delay)}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return null;
}

// Insert invoice into database (server-side) with enhanced error handling
export async function insertInvoice(invoiceData: {
  vendor_name?: string;
  invoice_date?: string;
  due_date?: string;
  amount?: number;
  extracted_text?: string;
  pdf_url?: string;
  classification_suggestion?: Record<string, unknown>;
  status?: string;
  payment_status?: string;
  attachment_filename?: string;
  gmail_message_id?: string | null;
}) {
  const maxRetries = 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      console.log(`💾 Inserting invoice record (attempt ${attempt + 1}/${maxRetries})...`);
      
      const { data, error } = await supabaseServer
        .from('invoice_class_invoices')
        .insert(invoiceData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      console.log('✅ Invoice record created successfully:', data.id);
      return data;
    } catch (error) {
      attempt++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown insert error';
      console.error(`❌ Insert attempt ${attempt}/${maxRetries} failed:`, errorMessage);
      
      if (attempt >= maxRetries) {
        console.error('💥 Failed to insert invoice after all retry attempts:', error);
        return null;
      }
      
      // Exponential backoff with jitter
      const delay = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 1000, 10000);
      console.log(`⏳ Waiting ${Math.round(delay)}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return null;
} 
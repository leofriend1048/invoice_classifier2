import { supabase } from '@/lib/supabase';
import { supabaseServer } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('🧪 Testing Supabase connection...');
    
    // Test 1: Check environment variables
    console.log('Environment variables:');
    console.log('- NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing');
    console.log('- NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing');
    console.log('- SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing');
    console.log('- Full URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    
    // Test 2: Check database connection (using anon client)
    console.log('📊 Testing database connection (anon client)...');
    const { data: tables, error: tablesError } = await supabase
      .from('invoice_class_invoices')
      .select('count', { count: 'exact', head: true });
    
    if (tablesError) {
      console.error('❌ Database error:', tablesError);
      return NextResponse.json({
        success: false,
        error: 'Database connection failed',
        details: tablesError
      });
    }
    
    console.log('✅ Database connection successful');
    console.log('📊 Current invoice count:', tables);
    
    // Test 3: Check storage bucket access (using server client)
    console.log('☁️ Testing storage bucket (server client)...');
    
    // First try: List all buckets with server client
    console.log('🔍 Attempting to list all buckets with server client...');
    const { data: buckets, error: bucketsError } = await supabaseServer.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Storage error:', bucketsError);
      
      // Try alternative approach: directly check if bucket exists
      console.log('🔄 Trying direct bucket access...');
      const { error: directError } = await supabaseServer.storage
        .from('invoices-pdf')
        .list('', { limit: 1 });
        
      if (directError) {
        console.error('❌ Direct bucket access failed:', directError);
        return NextResponse.json({
          success: false,
          error: 'Storage connection failed',
          details: {
            listBucketsError: bucketsError,
            directAccessError: directError
          }
        });
      } else {
        console.log('✅ Direct bucket access successful!');
      }
    } else {
      console.log('📦 Available buckets:', buckets?.map(b => b.name));
      
      const invoiceBucket = buckets?.find(b => b.name === 'invoices-pdf');
      if (!invoiceBucket) {
        console.log('⚠️ invoices-pdf bucket not found in list!');
        
        // Try direct access even if not in list
        console.log('🔄 Trying direct bucket access anyway...');
        const { error: directError } = await supabaseServer.storage
          .from('invoices-pdf')
          .list('', { limit: 1 });
          
        if (directError) {
          console.error('❌ Direct bucket access also failed:', directError);
          return NextResponse.json({
            success: false,
            error: 'invoices-pdf bucket not found and not accessible',
            buckets: buckets?.map(b => b.name),
            directAccessError: directError
          });
        } else {
          console.log('✅ Bucket accessible via direct access despite not being in list!');
        }
      } else {
        console.log('✅ invoices-pdf bucket found in list');
      }
    }
    
    // Test 4: Test file upload (small test file) with server client
    console.log('📤 Testing file upload with server client...');
    const testFile = Buffer.from('test file content', 'utf8');
    const testFilename = `test-${Date.now()}.txt`;
    
    const { data: uploadData, error: uploadError } = await supabaseServer.storage
      .from('invoices-pdf')
      .upload(testFilename, testFile, {
        contentType: 'text/plain'
      });
    
    if (uploadError) {
      console.error('❌ Upload error:', uploadError);
      return NextResponse.json({
        success: false,
        error: 'File upload failed',
        details: uploadError
      });
    }
    
    console.log('✅ File upload successful:', uploadData);
    
    // Test 5: Get public URL
    console.log('🔗 Testing public URL generation...');
    const { data: publicUrlData } = supabaseServer.storage
      .from('invoices-pdf')
      .getPublicUrl(uploadData.path);
    
    console.log('✅ Public URL generated:', publicUrlData.publicUrl);
    
    // Clean up test file
    await supabaseServer.storage
      .from('invoices-pdf')
      .remove([testFilename]);
    
    return NextResponse.json({
      success: true,
      message: 'All Supabase tests passed!',
      results: {
        database: '✅ Connected',
        storage: '✅ Connected (server client)',
        bucket: '✅ invoices-pdf exists',
        upload: '✅ Working (bypassed RLS)',
        publicUrl: '✅ Working'
      }
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
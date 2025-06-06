import { supabaseServer } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('🔍 Testing vendor table structure...');

    // Try to get table info first
    const { data: vendors, error } = await supabaseServer
      .from('invoice_class_vendors')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Vendor table error:', error);
      
      // Try to describe the table structure
      const { data: tableInfo, error: tableError } = await supabaseServer
        .rpc('describe_table', { table_name: 'invoice_class_vendors' });
      
      return NextResponse.json({
        success: false,
        error: 'Vendor table access failed',
        details: error,
        tableInfo: tableInfo,
        tableError: tableError
      });
    }

    console.log('✅ Vendor table accessible');
    console.log('📊 Sample data:', vendors);

    // Try to create a test vendor to see what columns are expected
    const testVendor = {
      name: 'Test Vendor', // might be 'name' instead of 'vendor_name'
      typical_category: 'Test Category',
      typical_subcategory: 'Test Subcategory', 
      average_amount: 100,
      invoice_count: 1,
      auto_approval_threshold: 0.8,
      last_invoice_date: new Date().toISOString()
    };

    const { data: insertResult, error: insertError } = await supabaseServer
      .from('invoice_class_vendors')
      .insert(testVendor)
      .select()
      .single();

    if (insertError) {
      console.error('❌ Insert error (shows what columns are missing):', insertError);
      
      // Try alternative column names
      const testVendor2 = {
        vendor_name: 'Test Vendor 2',
        typical_category: 'Test Category',
        typical_subcategory: 'Test Subcategory',
        average_amount: 100,
        invoice_count: 1,
        auto_approval_threshold: 0.8,
        last_invoice_date: new Date().toISOString()
      };

      const { data: insertResult2, error: insertError2 } = await supabaseServer
        .from('invoice_class_vendors')
        .insert(testVendor2)
        .select()
        .single();

      return NextResponse.json({
        success: false,
        vendorTableData: vendors,
        testInsert1: {
          data: insertResult,
          error: insertError
        },
        testInsert2: {
          data: insertResult2,
          error: insertError2
        }
      });
    }

    // Clean up test data
    if (insertResult) {
      await supabaseServer
        .from('invoice_class_vendors')
        .delete()
        .eq('id', insertResult.id);
    }

    return NextResponse.json({
      success: true,
      message: 'Vendor table test completed successfully!',
      vendorTableData: vendors,
      insertResult: insertResult
    });

  } catch (error) {
    console.error('💥 Test error:', error);
    return NextResponse.json({
      success: false,
      error: 'Vendor table test failed',
      details: error
    });
  }
} 
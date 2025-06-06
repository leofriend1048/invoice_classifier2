import { supabaseServer } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('🔍 Testing simple vendor insertion...');

    // Try with just the most basic fields
    const basicVendor = {
      name: 'Test Vendor Basic'
    };

    const { data: result1, error: error1 } = await supabaseServer
      .from('invoice_class_vendors')
      .insert(basicVendor)
      .select()
      .single();

    if (error1) {
      console.log('❌ Basic name field failed:', error1);

      // Try with vendor_name instead
      const vendorNameTest = {
        vendor_name: 'Test Vendor Name'
      };

      const { data: result2, error: error2 } = await supabaseServer
        .from('invoice_class_vendors')
        .insert(vendorNameTest)
        .select()
        .single();

      return NextResponse.json({
        success: false,
        test1: { data: result1, error: error1 },
        test2: { data: result2, error: error2 }
      });
    }

    // Clean up
    if (result1?.id) {
      await supabaseServer
        .from('invoice_class_vendors')
        .delete()
        .eq('id', result1.id);
    }

    return NextResponse.json({
      success: true,
      message: 'Basic vendor test passed!',
      result: result1
    });

  } catch (error) {
    console.error('💥 Test error:', error);
    return NextResponse.json({
      success: false,
      error: 'Simple vendor test failed',
      details: error
    });
  }
} 
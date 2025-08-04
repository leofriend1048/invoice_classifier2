import { supabaseServer } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

// API key validation against database
async function validateApiKey(request: NextRequest): Promise<boolean> {
  // Try header first, then query parameter
  let apiKey = request.headers.get('x-api-key');
  
  if (!apiKey) {
    const { searchParams } = new URL(request.url);
    apiKey = searchParams.get('api_key');
  }
  
  if (!apiKey) {
    return false;
  }
  
  try {
    // Simple, direct validation
    const { data: keyData, error } = await supabaseServer
      .from('api_keys')
      .select('id, is_active, expires_at, permissions')
      .eq('key_hash', apiKey)
      .eq('is_active', true)
      .single();

    if (error || !keyData) {
      return false;
    }

    // Check if key has expired
    if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
      return false;
    }

    // Check if key has invoice:read permission
    if (!keyData.permissions?.includes('invoice:read')) {
      return false;
    }

    // Update usage statistics (ignore errors if function doesn't exist yet)
    try {
      await supabaseServer.rpc('update_api_key_usage', { p_key_hash: apiKey });
    } catch (error) {
      // Ignore RPC errors - function might not exist yet
      console.log('Note: update_api_key_usage RPC function not available yet');
    }

    return true;
  } catch (error) {
    console.error('API key validation error:', error);
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Validate API key
    if (!(await validateApiKey(request))) {
      return NextResponse.json(
        { error: 'Invalid or missing API key' },
        { status: 401 }
      );
    }

    // Get query parameters for filtering and pagination
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '1000');
    const offset = parseInt(searchParams.get('offset') || '0');
    const fromDate = searchParams.get('from_date'); // Format: YYYY-MM-DD
    const toDate = searchParams.get('to_date'); // Format: YYYY-MM-DD
    const updatedSince = searchParams.get('updated_since'); // ISO timestamp for incremental sync

    // Validate pagination parameters
    if (limit > 10000) {
      return NextResponse.json(
        { error: 'Limit cannot exceed 10,000 records' },
        { status: 400 }
      );
    }

    // Build query
    let query = supabaseServer
      .from('invoice_class_invoices')
      .select('*')
      .order('invoice_date', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply date filters
    if (fromDate) {
      query = query.gte('invoice_date', fromDate);
    }
    
    if (toDate) {
      query = query.lte('invoice_date', toDate);
    }

    // For incremental updates - filter by updated_at timestamp
    if (updatedSince) {
      query = query.gte('updated_at', updatedSince);
    }

    // Execute query
    const { data: invoices, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Database query failed', details: error.message },
        { status: 500 }
      );
    }

    // Get total count for pagination info
    const { count: totalCount } = await supabaseServer
      .from('invoice_class_invoices')
      .select('*', { count: 'exact', head: true });

    // Transform data for BigQuery compatibility
    const transformedInvoices = invoices?.map(invoice => ({
      ...invoice,
      // Ensure proper data types for BigQuery
      amount: invoice.amount ? parseFloat(invoice.amount.toString()) : null,
      confidence: invoice.confidence ? parseFloat(invoice.confidence.toString()) : null,
      is_paid: Boolean(invoice.is_paid),
      // Parse classification_suggestion if it's a string
      classification_suggestion: typeof invoice.classification_suggestion === 'string' 
        ? JSON.parse(invoice.classification_suggestion || '{}')
        : invoice.classification_suggestion,
      // Ensure dates are in ISO format
      invoice_date: invoice.invoice_date ? new Date(invoice.invoice_date).toISOString() : null,
      due_date: invoice.due_date ? new Date(invoice.due_date).toISOString() : null,
      updated_at: invoice.updated_at ? new Date(invoice.updated_at).toISOString() : null,
      // Add sync timestamp
      exported_at: new Date().toISOString()
    })) || [];

    return NextResponse.json({
      success: true,
      data: transformedInvoices,
      pagination: {
        total_count: totalCount || 0,
        limit,
        offset,
        returned_count: transformedInvoices.length,
        has_more: (offset + limit) < (totalCount || 0)
      },
      filters_applied: {
        from_date: fromDate,
        to_date: toDate,
        updated_since: updatedSince
      },
      exported_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
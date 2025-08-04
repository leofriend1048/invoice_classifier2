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
    // Check if API key exists and is active
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
    if (!keyData.permissions.includes('invoice:read')) {
      return false;
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

    // Quick database health check
    const { count, error } = await supabaseServer
      .from('invoice_class_invoices')
      .select('*', { count: 'exact', head: true });

    if (error) {
      return NextResponse.json({
        status: 'unhealthy',
        database: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      total_invoices: count,
      api_version: '1.0',
      timestamp: new Date().toISOString(),
      features: {
        pagination: true,
        date_filtering: true,
        incremental_sync: true,
        bigquery_compatible: true
      }
    });

  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
import { getServerSession } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase-server';
import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

// GET - List all API keys for the authenticated user
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { data: apiKeys, error } = await supabaseServer
      .from('api_keys')
      .select('id, name, key_prefix, permissions, created_at, last_used_at, expires_at, is_active, description, usage_count')
      .eq('created_by', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: apiKeys || []
    });

  } catch (error) {
    console.error('Failed to fetch API keys:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch API keys', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// POST - Create a new API key
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log('Creating API key for user:', session.user.id, 'type:', typeof session.user.id);

    const body = await request.json();
    const { name, description, expires_in_days } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'API key name is required' },
        { status: 400 }
      );
    }

    // Generate a secure API key
    const apiKey = `inv_${randomBytes(32).toString('hex')}`;
    const keyPrefix = apiKey.substring(0, 12) + '...';

    // Calculate expiration date if provided
    let expiresAt = null;
    if (expires_in_days && expires_in_days > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expires_in_days);
    }

    // Store API key in database
    const { data, error } = await supabaseServer
      .from('api_keys')
      .insert({
        key_hash: apiKey,
        key_prefix: keyPrefix,
        name: name.trim(),
        description: description?.trim() || null,
        permissions: ['invoice:read'],
        created_by: session.user.id,
        expires_at: expiresAt?.toISOString() || null,
        is_active: true
      })
      .select('id, name, key_prefix, permissions, created_at, expires_at, description')
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'API key created successfully. Store this securely - it will not be shown again.',
      api_key: apiKey, // Only returned once
      data: data
    });

  } catch (error) {
    console.error('Failed to create API key:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create API key', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// DELETE - Deactivate an API key
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get('id');

    if (!keyId) {
      return NextResponse.json(
        { error: 'API key ID is required' },
        { status: 400 }
      );
    }

    // Deactivate the API key (soft delete)
    const { error } = await supabaseServer
      .from('api_keys')
      .update({ is_active: false })
      .eq('id', keyId)
      .eq('created_by', session.user.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'API key deactivated successfully'
    });

  } catch (error) {
    console.error('Failed to deactivate API key:', error);
    return NextResponse.json(
      { 
        error: 'Failed to deactivate API key', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
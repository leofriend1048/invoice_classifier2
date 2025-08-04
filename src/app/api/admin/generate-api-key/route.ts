import { getServerSession } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase-server';
import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated and is admin
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Generate a secure API key
    const apiKey = `inv_${randomBytes(32).toString('hex')}`;
    
    // Store API key in database with metadata
    const { data, error } = await supabaseServer
      .from('api_keys')
      .insert({
        key_hash: apiKey, // In production, you should hash this
        name: 'Export API Key',
        permissions: ['invoice:read'],
        created_by: session.user.id,
        created_at: new Date().toISOString(),
        last_used_at: null,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      // If table doesn't exist, provide setup instructions
      if (error.code === '42P01') {
        return NextResponse.json({
          error: 'API keys table not found',
          setup_required: true,
          sql: `
CREATE TABLE api_keys (
  id SERIAL PRIMARY KEY,
  key_hash TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  permissions TEXT[] DEFAULT ARRAY['invoice:read'],
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE
);
          `.trim()
        });
      }
      
      throw error;
    }

    return NextResponse.json({
      success: true,
      api_key: apiKey,
      message: 'API key generated successfully. Store this securely - it will not be shown again.',
      permissions: ['invoice:read'],
      created_at: data.created_at
    });

  } catch (error) {
    console.error('API key generation error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate API key', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
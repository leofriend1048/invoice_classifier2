-- Drop existing table if it exists
DROP TABLE IF EXISTS public.api_keys CASCADE;

-- Create API keys table for managing export API access
CREATE TABLE public.api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL,
  key_prefix TEXT NOT NULL, -- First 8 characters for display (e.g., "inv_1234...")
  permissions TEXT[] DEFAULT ARRAY['invoice:read'],
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  description TEXT,
  usage_count INTEGER DEFAULT 0
);

-- Create index for fast lookups
CREATE INDEX idx_api_keys_key_hash ON public.api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON public.api_keys(is_active) WHERE is_active = true;
CREATE INDEX idx_api_keys_created_by ON public.api_keys(created_by);

-- Note: We're using Better Auth instead of Supabase Auth, so we handle
-- authorization in the API routes rather than using RLS policies
-- The created_by field stores the Better Auth user ID as TEXT

-- Function to update usage statistics
CREATE OR REPLACE FUNCTION update_api_key_usage(p_key_hash TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.api_keys 
  SET 
    last_used_at = NOW(),
    usage_count = usage_count + 1
  WHERE key_hash = p_key_hash AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.api_keys TO authenticated;
GRANT EXECUTE ON FUNCTION update_api_key_usage TO authenticated;

-- Insert a comment for documentation
COMMENT ON TABLE public.api_keys IS 'Stores API keys for external integrations like Airbyte';
COMMENT ON COLUMN public.api_keys.key_hash IS 'The actual API key value';
COMMENT ON COLUMN public.api_keys.key_prefix IS 'First 8 characters for UI display';
COMMENT ON COLUMN public.api_keys.permissions IS 'Array of permissions like invoice:read, invoice:write';
COMMENT ON COLUMN public.api_keys.usage_count IS 'Number of times this key has been used';
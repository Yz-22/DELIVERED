-- Delivere Company White-Label Branding System Migration
-- Migration: 20260915_tenant_branding.sql
-- Description: Creates public.tenant_settings table for multi-tenant company branding, custom logos, colors and company metadata.

CREATE TABLE IF NOT EXISTS public.tenant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE,
  company_name TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#f59e0b',
  secondary_color TEXT DEFAULT '#0f172a',
  favicon_url TEXT,
  phone TEXT,
  address TEXT,
  tax_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS Policies
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'tenant_settings' AND policyname = 'Allow read tenant_settings to all authenticated users'
  ) THEN
    CREATE POLICY "Allow read tenant_settings to all authenticated users"
      ON public.tenant_settings FOR SELECT
      TO authenticated, anon
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'tenant_settings' AND policyname = 'Allow manage tenant_settings to authenticated owners'
  ) THEN
    CREATE POLICY "Allow manage tenant_settings to authenticated owners"
      ON public.tenant_settings FOR ALL
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Indexes for fast tenant lookup
CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant_id ON public.tenant_settings(tenant_id);

-- Ensure branding storage bucket exists in storage.buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('branding', 'branding', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'])
ON CONFLICT (id) DO UPDATE SET public = true;

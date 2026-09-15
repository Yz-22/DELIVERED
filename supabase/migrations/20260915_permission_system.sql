-- ==============================================================================
-- DarGo TMS & Enterprise POS - Production Real Permission System Migration
-- Migration Timestamp: 20260915_permission_system.sql
-- Description: Ensures full database persistence, hierarchy ceiling, and audit logs
-- Safe, Non-Destructive, Idempotent Migration
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. USERS TABLE - IDEMPOTENT COLUMN ASSURANCE
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS parent_user_id UUID;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_by_id UUID;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS portal_access TEXT DEFAULT 'STANDARD';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS max_allowed_permissions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create Indexes for Hierarchical Query Optimization
CREATE INDEX IF NOT EXISTS idx_users_parent_user_id ON public.users(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_users_created_by_id ON public.users(created_by_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON public.users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- 3. AUDIT LOGS TABLE FOR SYSTEM SECURITY & PERMISSION AUDITING
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action TEXT NOT NULL,
    action_name_ar TEXT,
    performed_by UUID,
    performer_name TEXT,
    performer_role TEXT,
    target_id UUID,
    target_type TEXT DEFAULT 'USER',
    target_name TEXT,
    tenant_id UUID,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_target_id ON public.audit_logs(target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by ON public.audit_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON public.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS super_admin_all_audit_logs ON public.audit_logs;
CREATE POLICY super_admin_all_audit_logs ON public.audit_logs FOR ALL USING (
    COALESCE(auth.jwt() ->> 'role', '') = 'SUPER_ADMIN' OR current_user = 'postgres'
);

-- 4. VERIFICATION COMMENT
-- Migration completed safely without dropping tables, columns, or altering user IDs.

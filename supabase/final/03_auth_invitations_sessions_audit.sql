-- ============================================================================
-- DELIVERE — 03_auth_invitations_sessions_audit.sql
-- Onboarding Invitations, Session Invalidation & System Audit Trail
-- ============================================================================

-- 1. Authoritative User Invitations Table
CREATE TABLE IF NOT EXISTS public.user_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash TEXT NOT NULL UNIQUE,
    email TEXT,
    phone TEXT,
    role public.user_role NOT NULL DEFAULT 'OPERATOR',
    role_name TEXT,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    parent_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    invited_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    inviter_name TEXT,
    inviter_role TEXT,
    permissions TEXT[] NOT NULL DEFAULT '{}',
    max_allowed_permissions TEXT[] NOT NULL DEFAULT '{}',
    commercial_name TEXT,
    company_name TEXT,
    branch TEXT,
    branch_id UUID,
    city TEXT,
    price_list TEXT,
    price_plan_id TEXT,
    status public.invitation_status NOT NULL DEFAULT 'PENDING',
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    accepted_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    auth_provider public.user_auth_provider NOT NULL DEFAULT 'EMAIL_PASSWORD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitations_token_hash ON public.user_invitations (token_hash);
CREATE INDEX IF NOT EXISTS idx_invitations_tenant_status ON public.user_invitations (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.user_invitations (LOWER(TRIM(email))) WHERE email IS NOT NULL;

-- 2. Persistent Revoked Sessions (JTI / Token Hash Blacklist)
CREATE TABLE IF NOT EXISTS public.revoked_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    revoked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason TEXT DEFAULT 'LOGOUT',
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_revoked_sessions_token ON public.revoked_sessions (token_hash);
CREATE INDEX IF NOT EXISTS idx_revoked_sessions_expiry ON public.revoked_sessions (expires_at);

-- 3. Comprehensive Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE RESTRICT,
    action TEXT NOT NULL,
    action_name_ar TEXT,
    performed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    performer_name TEXT,
    performer_role TEXT,
    target_id TEXT,
    target_type TEXT,
    target_name TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON public.audit_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by ON public.audit_logs (performed_by);

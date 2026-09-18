-- ============================================================================
-- DELIVERE — 02_tenants_and_users.sql
-- Multi-Tenant Foundation & Authoritative Application Identity
-- ============================================================================

-- 1. Tenants / Delivery Companies Table
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tenant Settings & Branding Table
CREATE TABLE IF NOT EXISTS public.tenant_settings (
    tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_name TEXT,
    commercial_name TEXT,
    logo_url TEXT,
    brand_color TEXT DEFAULT '#4F46E5',
    currency TEXT DEFAULT 'JOD',
    phone TEXT,
    email TEXT,
    address TEXT,
    custom_domain TEXT,
    invoice_footer TEXT,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Authoritative Application Users Table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    email TEXT,
    phone TEXT,
    name TEXT NOT NULL,
    password_hash TEXT,
    role public.user_role NOT NULL DEFAULT 'OPERATOR',
    role_name TEXT,
    portal_access TEXT,
    commercial_name TEXT,
    commercial_type TEXT,
    city TEXT DEFAULT 'عمان',
    address TEXT,
    branch TEXT,
    department TEXT,
    account_manager TEXT,
    price_list TEXT,
    price_plan_id TEXT,
    vehicle_type TEXT,
    vehicle_plate TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    parent_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_by_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    permissions TEXT[] NOT NULL DEFAULT '{}',
    max_allowed_permissions TEXT[] NOT NULL DEFAULT '{}',
    auth_provider public.user_auth_provider NOT NULL DEFAULT 'EMAIL_PASSWORD',
    auth_user_id UUID UNIQUE,
    google_id TEXT,
    google_email TEXT,
    invitation_id UUID,
    invited_by UUID,
    subscription_plan TEXT,
    subscription_plan_name TEXT,
    subscription_status TEXT,
    subscription_start_date TIMESTAMPTZ,
    subscription_end_date TIMESTAMPTZ,
    subscription_price NUMERIC(12, 3),
    subscription_billing_cycle TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Composite unique constraint to support composite Foreign Keys (merchant_id, tenant_id)
    CONSTRAINT uq_users_composite UNIQUE (id, tenant_id)
);

-- Unique index on lowercase email to prevent duplicate logins
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON public.users (LOWER(TRIM(email))) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_tenant_role ON public.users (tenant_id, role);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON public.users (google_id) WHERE google_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_parent_user ON public.users (parent_user_id);

-- ============================================================================
-- DELIVERE — 14_subscriptions.sql
-- Multi-Tenant SaaS Subscriptions & Tiered Module Entitlements
-- ============================================================================

-- 1. Master Subscription Plans
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    monthly_price_jod NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    annual_price_jod NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    max_users INTEGER NOT NULL DEFAULT 5,
    max_monthly_orders INTEGER NOT NULL DEFAULT 500,
    enabled_modules JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_public BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tenant Active Subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
    plan_code TEXT NOT NULL,
    plan_name TEXT NOT NULL,
    status public.subscription_status NOT NULL DEFAULT 'ACTIVE',
    start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    end_date TIMESTAMPTZ NOT NULL,
    trial_start_date TIMESTAMPTZ,
    trial_end_date TIMESTAMPTZ,
    price NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    currency TEXT NOT NULL DEFAULT 'JOD',
    billing_cycle public.subscription_billing_cycle NOT NULL DEFAULT 'MONTHLY',
    enabled_modules JSONB NOT NULL DEFAULT '{}'::jsonb,
    max_users INTEGER NOT NULL DEFAULT 5,
    max_monthly_orders INTEGER NOT NULL DEFAULT 500,
    auto_renew BOOLEAN NOT NULL DEFAULT true,
    suspended_reason TEXT,
    grace_period_days INTEGER DEFAULT 7,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_status 
    ON public.subscriptions (tenant_id, status);

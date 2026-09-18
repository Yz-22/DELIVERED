-- ============================================================================
-- DELIVERE — 05_merchants_branches_customers.sql
-- Normalized Merchant Branches & Customer Directory
-- ============================================================================

-- 1. Merchant Branches (Normalized Relational Architecture)
CREATE TABLE IF NOT EXISTS public.merchant_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    address TEXT,
    governorate TEXT DEFAULT 'عمان',
    area TEXT,
    phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_main BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Composite FK: branch must belong to a merchant in the same tenant
    CONSTRAINT fk_merchant_branches_merchant FOREIGN KEY (merchant_id, tenant_id)
        REFERENCES public.users(id, tenant_id) ON DELETE CASCADE,

    -- Composite unique constraints for multi-level composite referencing
    CONSTRAINT uq_merchant_branch_composite UNIQUE (id, merchant_id, tenant_id),
    CONSTRAINT uq_merchant_branch_id_tenant UNIQUE (id, tenant_id)
);

-- Maximum ONE active main branch per merchant
CREATE UNIQUE INDEX IF NOT EXISTS idx_merchant_single_main_branch 
    ON public.merchant_branches (merchant_id) 
    WHERE is_main = true AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_merchant_branches_lookup ON public.merchant_branches (tenant_id, merchant_id, is_active);

-- Link user_branch_access to merchant_branches
ALTER TABLE public.user_branch_access
    DROP CONSTRAINT IF EXISTS fk_user_branch_access_branch;

ALTER TABLE public.user_branch_access
    ADD CONSTRAINT fk_user_branch_access_branch
    FOREIGN KEY (branch_id, merchant_id, tenant_id)
    REFERENCES public.merchant_branches(id, merchant_id, tenant_id) ON DELETE CASCADE;

-- 2. Customers Table (Merchant-Scoped)
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL,
    branch_id UUID REFERENCES public.merchant_branches(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    governorate TEXT DEFAULT 'عمان',
    area TEXT,
    address TEXT,
    notes TEXT,
    total_orders INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_customers_merchant FOREIGN KEY (merchant_id, tenant_id)
        REFERENCES public.users(id, tenant_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_customers_merchant_phone ON public.customers (merchant_id, phone);
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON public.customers (tenant_id);

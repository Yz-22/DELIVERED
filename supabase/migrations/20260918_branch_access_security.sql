-- ==============================================================================
-- Delivere Logistics & Enterprise TMS/POS
-- Migration: 20260918_branch_access_security.sql
-- Name: Phase B — Normalized User Branch Access Security (Revision 3)
-- Architecture: Composite Referential Integrity Across Tenant & Merchant Ownership
-- Safe, Non-Destructive, Normalized Authorization Architecture
-- NO DATA MODIFICATION OR PRODUCTION APPLICATION IN THIS STEP
-- ==============================================================================

-- 1. NORMALIZED USER BRANCH ACCESS TABLE
-- Replaces JSONB arrays with strict relational integrity
CREATE TABLE IF NOT EXISTS public.user_branch_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    role_in_branch TEXT NOT NULL DEFAULT 'CASHIER' CHECK (role_in_branch IN ('CASHIER', 'BRANCH_MANAGER', 'STAFF')),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_user_branch_access_user 
        FOREIGN KEY (user_id, tenant_id) 
        REFERENCES public.users(id, tenant_id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_user_branch_access_branch 
        FOREIGN KEY (branch_id, tenant_id, merchant_id) 
        REFERENCES public.merchant_branches(id, tenant_id, merchant_id) 
        ON DELETE CASCADE,
    CONSTRAINT uq_user_branch_access 
        UNIQUE (user_id, branch_id)
);

-- Fast lookup indexes for security checks
CREATE INDEX IF NOT EXISTS idx_user_branch_access_user_id ON public.user_branch_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_branch_access_branch_id ON public.user_branch_access(branch_id);
CREATE INDEX IF NOT EXISTS idx_user_branch_access_merchant_id ON public.user_branch_access(merchant_id);
CREATE INDEX IF NOT EXISTS idx_user_branch_access_tenant_id ON public.user_branch_access(tenant_id);

-- One default branch per user constraint
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_default_branch 
ON public.user_branch_access(user_id) 
WHERE (is_default = TRUE);

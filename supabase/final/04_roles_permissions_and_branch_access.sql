-- ============================================================================
-- DELIVERE — 04_roles_permissions_and_branch_access.sql
-- Role Scoping, Granular Permissions & Relational User Branch Access
-- ============================================================================

-- Relational User Branch Access Table (Zero JSONB)
CREATE TABLE IF NOT EXISTS public.user_branch_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    can_pos BOOLEAN NOT NULL DEFAULT true,
    can_dispatch BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Composite FK ensuring user belongs to the same tenant
    CONSTRAINT fk_user_branch_access_user FOREIGN KEY (user_id, tenant_id) 
        REFERENCES public.users(id, tenant_id) ON DELETE CASCADE,
    
    -- Composite FK ensuring merchant belongs to the same tenant
    CONSTRAINT fk_user_branch_access_merchant FOREIGN KEY (merchant_id, tenant_id) 
        REFERENCES public.users(id, tenant_id) ON DELETE CASCADE,

    -- Unique per user and branch
    CONSTRAINT uq_user_branch_access UNIQUE (user_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_user_branch_access_user ON public.user_branch_access (user_id);
CREATE INDEX IF NOT EXISTS idx_user_branch_access_merchant ON public.user_branch_access (merchant_id);
CREATE INDEX IF NOT EXISTS idx_user_branch_access_branch ON public.user_branch_access (branch_id);

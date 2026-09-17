-- ==============================================================================
-- Delivere Logistics & Enterprise TMS/POS
-- Migration: 20260917_workspace_branch_architecture.sql
-- Name: Role Workspaces + Merchant Multi-Branch + Statements & Reports Architecture
-- Safe, Non-Destructive, Additive, Idempotent Migration
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. MERCHANT BRANCHES TABLE
CREATE TABLE IF NOT EXISTS public.merchant_branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID NOT NULL,
    tenant_id UUID,
    name TEXT NOT NULL,
    code TEXT,
    phone TEXT,
    address TEXT,
    governorate TEXT DEFAULT 'عمان',
    city TEXT DEFAULT 'عمان',
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    is_main BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for high-frequency queries
CREATE INDEX IF NOT EXISTS idx_merchant_branches_merchant_id ON public.merchant_branches(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_branches_tenant_id ON public.merchant_branches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_branches_is_main ON public.merchant_branches(is_main);
CREATE INDEX IF NOT EXISTS idx_merchant_branches_is_active ON public.merchant_branches(is_active);

-- 2. MERCHANT STOCK TRANSFERS TABLE
CREATE TABLE IF NOT EXISTS public.merchant_stock_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID NOT NULL,
    tenant_id UUID,
    product_id TEXT NOT NULL,
    product_name TEXT,
    source_branch_id UUID NOT NULL,
    dest_branch_id UUID NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'COMPLETED',
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_merchant_id ON public.merchant_stock_transfers(merchant_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_source ON public.merchant_stock_transfers(source_branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_dest ON public.merchant_stock_transfers(dest_branch_id);

-- 3. SAFE ADDITIVE COLUMNS (IDEMPOTENT)

-- Users table additions
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS branch_id UUID;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS assigned_branches JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS workspace_override TEXT;
CREATE INDEX IF NOT EXISTS idx_users_branch_id ON public.users(branch_id);

-- Invitations table additions
ALTER TABLE public.user_invitations ADD COLUMN IF NOT EXISTS branch_id UUID;
ALTER TABLE public.user_invitations ADD COLUMN IF NOT EXISTS branch_name TEXT;
CREATE INDEX IF NOT EXISTS idx_user_invitations_branch_id ON public.user_invitations(branch_id);

-- Shipments / Orders table additions
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS branch_id UUID;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS branch_name TEXT;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS pickup_address TEXT;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS pickup_phone TEXT;
CREATE INDEX IF NOT EXISTS idx_shipments_branch_id ON public.shipments(branch_id);

-- Products table additions for multi-branch stock
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS branch_stock JSONB DEFAULT '{}'::jsonb;

-- 4. SAFE BACKFILL FOR EXISTING MERCHANTS (ZERO DOWNTIME)
-- Create a default Main Branch for every existing Merchant that does not have one
INSERT INTO public.merchant_branches (id, merchant_id, tenant_id, name, code, phone, address, governorate, city, is_main, is_active)
SELECT 
    uuid_generate_v4(),
    u.id,
    u.tenant_id,
    'الفرع الرئيسي',
    'MAIN-01',
    COALESCE(u.phone, '0790000000'),
    COALESCE(u.branch, 'عمان - المقر الرئيسي'),
    COALESCE(u.city, 'عمان'),
    COALESCE(u.city, 'عمان'),
    TRUE,
    TRUE
FROM public.users u
WHERE u.role = 'MERCHANT'
  AND NOT EXISTS (
    SELECT 1 FROM public.merchant_branches mb WHERE mb.merchant_id = u.id
  );

-- Link merchant owners and cashiers to their default main branch if branch_id is null
UPDATE public.users u
SET branch_id = mb.id
FROM public.merchant_branches mb
WHERE mb.merchant_id = u.id 
  AND mb.is_main = TRUE 
  AND u.branch_id IS NULL;

-- Link cashiers whose parent is a merchant to the merchant's main branch
UPDATE public.users c
SET branch_id = mb.id
FROM public.merchant_branches mb
WHERE c.role = 'CASHIER'
  AND c.parent_user_id = mb.merchant_id
  AND mb.is_main = TRUE
  AND c.branch_id IS NULL;

-- Update legacy shipments without branch_id to link to merchant's main branch
UPDATE public.shipments s
SET branch_id = mb.id,
    branch_name = mb.name
FROM public.merchant_branches mb
WHERE s.merchant_id = mb.merchant_id
  AND mb.is_main = TRUE
  AND s.branch_id IS NULL;

-- ==============================================================================
-- End of Migration
-- Result: Fully backward-compatible, additive, idempotent.
-- ==============================================================================

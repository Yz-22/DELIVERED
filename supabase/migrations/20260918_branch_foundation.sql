-- ==============================================================================
-- Delivere Logistics & Enterprise TMS/POS
-- Migration: 20260918_branch_foundation.sql
-- Name: Phase A — Merchant Multi-Branch Foundation (Revision 3)
-- Architecture: Multi-Tenant Strict Ownership + Composite Foreign Keys
-- Safe, Non-Destructive, Additive, Idempotent Migration
-- NO DATA MODIFICATION OR PRODUCTION APPLICATION IN THIS STEP
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. BASE COMPOSITE UNIQUE CONSTRAINTS (Enables multi-tenant ownership enforcement)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_users_id_tenant_id'
    ) THEN
        ALTER TABLE public.users ADD CONSTRAINT uq_users_id_tenant_id UNIQUE (id, tenant_id);
    END IF;
EXCEPTION
    WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;

-- 2. MERCHANT BRANCHES TABLE (With strict tenant & merchant composite referential integrity)
CREATE TABLE IF NOT EXISTS public.merchant_branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    phone TEXT, -- Real phone only, nullable (NO fake defaults)
    address TEXT, -- Real address only, nullable (NO fake defaults)
    governorate TEXT,
    city TEXT,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    is_main BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_merchant_branches_merchant_tenant 
        FOREIGN KEY (merchant_id, tenant_id) 
        REFERENCES public.users(id, tenant_id) 
        ON DELETE CASCADE,
    CONSTRAINT uq_merchant_branches_id_tenant_merchant 
        UNIQUE (id, tenant_id, merchant_id),
    CONSTRAINT uq_merchant_branches_id_tenant 
        UNIQUE (id, tenant_id)
);

-- Fast lookup indexes
CREATE INDEX IF NOT EXISTS idx_merchant_branches_merchant_id ON public.merchant_branches(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_branches_tenant_id ON public.merchant_branches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_branches_is_active ON public.merchant_branches(is_active);

-- Business Rule: At most ONE active Main Branch per merchant at database level
-- (Allows zero main branches for legacy merchants without forcing blind backfills)
CREATE UNIQUE INDEX IF NOT EXISTS uq_merchant_main_branch 
ON public.merchant_branches(merchant_id) 
WHERE (is_main = TRUE AND is_active = TRUE);

-- 3. SAFE ADDITIVE COLUMNS (NON-DESTRUCTIVE, NULLABLE)
-- Historical records remain NULL if unassigned. No blind backfills.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.merchant_branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_branch_id ON public.users(branch_id);

ALTER TABLE public.user_invitations ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.merchant_branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_user_invitations_branch_id ON public.user_invitations(branch_id);

ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.merchant_branches(id) ON DELETE SET NULL;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS pickup_branch_id UUID REFERENCES public.merchant_branches(id) ON DELETE SET NULL;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS merchant_collection NUMERIC(12, 3);
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(12, 3);
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS driver_fee NUMERIC(12, 3);
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS return_fee NUMERIC(12, 3);
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS cod_amount NUMERIC(12, 3);
CREATE INDEX IF NOT EXISTS idx_shipments_branch_id ON public.shipments(branch_id);

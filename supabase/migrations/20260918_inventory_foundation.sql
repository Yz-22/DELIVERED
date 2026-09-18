-- ==============================================================================
-- Delivere Logistics & Enterprise TMS/POS
-- Migration: 20260918_inventory_foundation.sql
-- Name: Phase C — Authoritative Multi-Branch Inventory Balances (Revision 3)
-- Architecture: Guaranteed Product-to-Branch Ownership & Zero Cross-Merchant Contamination
-- Safe, Normalized Relational Inventory Source of Truth
-- NO DATA MODIFICATION OR PRODUCTION APPLICATION IN THIS STEP
-- ==============================================================================

-- 1. BASE COMPOSITE UNIQUE CONSTRAINTS ON PRODUCTS (Enables multi-tenant ownership enforcement)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_products_id_tenant_merchant'
    ) THEN
        ALTER TABLE public.products ADD CONSTRAINT uq_products_id_tenant_merchant UNIQUE (id, tenant_id, merchant_id);
    END IF;
EXCEPTION
    WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;

-- 2. AUTHORITATIVE BRANCH INVENTORY BALANCES TABLE
-- Normalized source of truth with strict composite foreign keys
CREATE TABLE IF NOT EXISTS public.branch_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    product_id UUID NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    min_stock_alert INTEGER NOT NULL DEFAULT 5 CHECK (min_stock_alert >= 0),
    shelf_location TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_branch_inventory_branch 
        FOREIGN KEY (branch_id, tenant_id, merchant_id) 
        REFERENCES public.merchant_branches(id, tenant_id, merchant_id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_branch_inventory_product 
        FOREIGN KEY (product_id, tenant_id, merchant_id) 
        REFERENCES public.products(id, tenant_id, merchant_id) 
        ON DELETE CASCADE,
    CONSTRAINT uq_branch_product 
        UNIQUE (branch_id, product_id)
);

-- Fast search and filtering indexes
CREATE INDEX IF NOT EXISTS idx_branch_inventory_branch_id ON public.branch_inventory(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_inventory_product_id ON public.branch_inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_branch_inventory_merchant_id ON public.branch_inventory(merchant_id);
CREATE INDEX IF NOT EXISTS idx_branch_inventory_tenant_id ON public.branch_inventory(tenant_id);
CREATE INDEX IF NOT EXISTS idx_branch_inventory_low_stock ON public.branch_inventory(quantity, min_stock_alert);

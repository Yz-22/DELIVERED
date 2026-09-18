-- ============================================================================
-- DELIVERE — 06_products_warehouses_inventory.sql
-- Merchant Product Master Catalog & Multi-Branch Inventory
-- ============================================================================

-- 1. Product Master Catalog (No global mutable stock JSONB)
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL,
    sku TEXT NOT NULL,
    barcode TEXT,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    cost_price NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (cost_price >= 0),
    selling_price NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (selling_price >= 0),
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (tax_rate >= 0),
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Composite FK ensuring product belongs to the merchant in the tenant
    CONSTRAINT fk_products_merchant FOREIGN KEY (merchant_id, tenant_id)
        REFERENCES public.users(id, tenant_id) ON DELETE CASCADE,

    -- Composite unique constraints for multi-level composite referencing
    CONSTRAINT uq_products_composite UNIQUE (id, merchant_id, tenant_id),
    CONSTRAINT uq_products_id_tenant UNIQUE (id, tenant_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_merchant_sku ON public.products (merchant_id, LOWER(TRIM(sku)));
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products (merchant_id, barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_tenant ON public.products (tenant_id, is_active);

-- 2. Branch-Scoped Inventory Balances (Authoritative Stock per Branch)
CREATE TABLE IF NOT EXISTS public.branch_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    product_id UUID NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
    reorder_point INTEGER NOT NULL DEFAULT 5 CHECK (reorder_point >= 0),
    location_in_branch TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Composite FK to merchant_branches
    CONSTRAINT fk_branch_inventory_branch FOREIGN KEY (branch_id, merchant_id, tenant_id)
        REFERENCES public.merchant_branches(id, merchant_id, tenant_id) ON DELETE CASCADE,

    -- Composite FK to products
    CONSTRAINT fk_branch_inventory_product FOREIGN KEY (product_id, merchant_id, tenant_id)
        REFERENCES public.products(id, merchant_id, tenant_id) ON DELETE CASCADE,

    -- Exactly one stock balance record per branch and product
    CONSTRAINT uq_branch_inventory_item UNIQUE (branch_id, product_id),

    -- Invariant: Reserved quantity must never exceed on-hand quantity
    CONSTRAINT chk_branch_inventory_reserved_limit CHECK (reserved_quantity <= quantity)
);

CREATE INDEX IF NOT EXISTS idx_branch_inventory_lookup ON public.branch_inventory (tenant_id, merchant_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_inventory_product ON public.branch_inventory (product_id);

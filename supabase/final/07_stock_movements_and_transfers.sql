-- ============================================================================
-- DELIVERE — 07_stock_movements_and_transfers.sql
-- Immutable Stock Movement Ledger & Multi-Branch Stock Transfers
-- ============================================================================

-- 1. Immutable Stock Movements Ledger
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    merchant_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    product_id UUID NOT NULL,
    movement_type public.stock_movement_type NOT NULL,
    quantity INTEGER NOT NULL, -- Positive for additions, negative for reductions
    balance_before INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    unit_cost NUMERIC(12, 3) DEFAULT 0.000,
    reference_type TEXT,
    reference_id TEXT,
    notes TEXT,
    performed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Composite FK to merchant_branches
    CONSTRAINT fk_stock_movements_branch FOREIGN KEY (branch_id, merchant_id, tenant_id)
        REFERENCES public.merchant_branches(id, merchant_id, tenant_id) ON DELETE RESTRICT,

    -- Composite FK to products
    CONSTRAINT fk_stock_movements_product FOREIGN KEY (product_id, merchant_id, tenant_id)
        REFERENCES public.products(id, merchant_id, tenant_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_lookup 
    ON public.stock_movements (tenant_id, merchant_id, branch_id, product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference 
    ON public.stock_movements (reference_type, reference_id);

-- 2. Inter-Branch Stock Transfers (Authoritative Header Only)
CREATE TABLE IF NOT EXISTS public.merchant_stock_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL,
    source_branch_id UUID NOT NULL,
    destination_branch_id UUID NOT NULL,
    status public.stock_transfer_status NOT NULL DEFAULT 'PENDING',
    transfer_number TEXT,
    notes TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    received_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Different source and destination required
    CONSTRAINT chk_different_transfer_branches CHECK (source_branch_id <> destination_branch_id),

    -- Composite FKs to branches
    CONSTRAINT fk_stock_transfer_source FOREIGN KEY (source_branch_id, merchant_id, tenant_id)
        REFERENCES public.merchant_branches(id, merchant_id, tenant_id) ON DELETE RESTRICT,

    CONSTRAINT fk_stock_transfer_dest FOREIGN KEY (destination_branch_id, merchant_id, tenant_id)
        REFERENCES public.merchant_branches(id, merchant_id, tenant_id) ON DELETE RESTRICT,

    -- Composite Unique constraint for child items foreign key referencing
    CONSTRAINT uq_merchant_stock_transfers_composite UNIQUE (id, merchant_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_lookup 
    ON public.merchant_stock_transfers (tenant_id, merchant_id, status);

-- 3. Stock Transfer Authoritative Items Table
CREATE TABLE IF NOT EXISTS public.merchant_stock_transfer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL,
    transfer_id UUID NOT NULL,
    product_id UUID NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(12, 3) DEFAULT 0.000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Composite FK to transfer header
    CONSTRAINT fk_stock_transfer_items_transfer FOREIGN KEY (transfer_id, merchant_id, tenant_id)
        REFERENCES public.merchant_stock_transfers(id, merchant_id, tenant_id) ON DELETE CASCADE,

    -- Composite FK to products catalog
    CONSTRAINT fk_stock_transfer_items_product FOREIGN KEY (product_id, merchant_id, tenant_id)
        REFERENCES public.products(id, merchant_id, tenant_id) ON DELETE RESTRICT,

    -- Disallow duplicate product entries per transfer header
    CONSTRAINT uq_stock_transfer_items_product UNIQUE (transfer_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_transfer ON public.merchant_stock_transfer_items (transfer_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_tenant ON public.merchant_stock_transfer_items (tenant_id, merchant_id);

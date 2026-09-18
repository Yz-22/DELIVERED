-- ==============================================================================
-- Delivere Logistics & Enterprise TMS/POS
-- Migration: 20260918_stock_movements.sql
-- Name: Phase D — Auditable Stock Movements & Hardened Atomic Stock Transfer Engine (Revision 3)
-- Architecture: Guaranteed Ownership + Single-Transaction Atomic Execution Engine + Security Definer Hardening
-- Complete Lifecycle & Double-Movement Atomicity
-- NO DATA MODIFICATION OR PRODUCTION APPLICATION IN THIS STEP
-- ==============================================================================

-- 1. EXTEND INVENTORY TRANSACTIONS TABLE WITH BRANCH & TRANSFER DIMENSIONS
ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.merchant_branches(id) ON DELETE SET NULL;
ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS reference_type TEXT;
ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS batch_number TEXT;
ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS transfer_id UUID;
CREATE INDEX IF NOT EXISTS idx_inventory_tx_branch_id ON public.inventory_transactions(branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_tx_ref_type ON public.inventory_transactions(reference_type);
CREATE INDEX IF NOT EXISTS idx_inventory_tx_transfer_id ON public.inventory_transactions(transfer_id);

-- 2. MERCHANT STOCK TRANSFERS TABLE (With composite foreign keys ensuring same tenant & merchant)
CREATE TABLE IF NOT EXISTS public.merchant_stock_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL,
    product_id UUID NOT NULL,
    source_branch_id UUID NOT NULL,
    dest_branch_id UUID NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED')),
    notes TEXT,
    transfer_number TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    received_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_stock_transfers_product 
        FOREIGN KEY (product_id, tenant_id, merchant_id) 
        REFERENCES public.products(id, tenant_id, merchant_id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_stock_transfers_source 
        FOREIGN KEY (source_branch_id, tenant_id, merchant_id) 
        REFERENCES public.merchant_branches(id, tenant_id, merchant_id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_stock_transfers_dest 
        FOREIGN KEY (dest_branch_id, tenant_id, merchant_id) 
        REFERENCES public.merchant_branches(id, tenant_id, merchant_id) 
        ON DELETE CASCADE,
    CONSTRAINT chk_diff_branches CHECK (source_branch_id <> dest_branch_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_merchant_id ON public.merchant_stock_transfers(merchant_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_tenant_id ON public.merchant_stock_transfers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_source ON public.merchant_stock_transfers(source_branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_dest ON public.merchant_stock_transfers(dest_branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status ON public.merchant_stock_transfers(status);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_product_id ON public.merchant_stock_transfers(product_id);

-- 3. HARDENED ATOMIC STOCK TRANSFER COMPLETION STORED PROCEDURE
-- Guaranteed single-transaction execution: Locks rows, validates actor, deducts source, credits destination, logs 2 movements
-- Secured with explicit search_path and restricted exclusively to service_role
CREATE OR REPLACE FUNCTION public.execute_stock_transfer_completion(
    p_transfer_id UUID,
    p_received_by_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_transfer RECORD;
    v_recipient RECORD;
    v_src_qty INTEGER;
BEGIN
    -- 1. Lock transfer row and validate status
    SELECT * INTO v_transfer 
    FROM public.merchant_stock_transfers 
    WHERE id = p_transfer_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Stock transfer record % not found', p_transfer_id;
    END IF;

    IF v_transfer.status NOT IN ('APPROVED', 'IN_TRANSIT') THEN
        RAISE EXCEPTION 'Transfer % cannot be completed because current status is % (must be APPROVED or IN_TRANSIT)', 
            p_transfer_id, v_transfer.status;
    END IF;

    -- 2. Validate receiving actor identity and tenant scoping
    IF p_received_by_id IS NOT NULL THEN
        SELECT id, tenant_id INTO v_recipient
        FROM public.users
        WHERE id = p_received_by_id;

        IF NOT FOUND OR v_recipient.tenant_id <> v_transfer.tenant_id THEN
            RAISE EXCEPTION 'Receiving actor % is invalid or does not belong to tenant %', 
                p_received_by_id, v_transfer.tenant_id;
        END IF;
    END IF;

    -- 3. Lock and verify source branch inventory
    SELECT quantity INTO v_src_qty 
    FROM public.branch_inventory 
    WHERE branch_id = v_transfer.source_branch_id 
      AND product_id = v_transfer.product_id 
    FOR UPDATE;

    IF v_src_qty IS NULL OR v_src_qty < v_transfer.quantity THEN
        RAISE EXCEPTION 'Insufficient stock in source branch %. Available: %, Requested: %', 
            v_transfer.source_branch_id, COALESCE(v_src_qty, 0), v_transfer.quantity;
    END IF;

    -- 4. Deduct stock from source branch
    UPDATE public.branch_inventory 
    SET quantity = quantity - v_transfer.quantity,
        updated_at = NOW()
    WHERE branch_id = v_transfer.source_branch_id 
      AND product_id = v_transfer.product_id;

    -- 5. Ensure and credit destination branch inventory
    INSERT INTO public.branch_inventory (tenant_id, merchant_id, branch_id, product_id, quantity, updated_at)
    VALUES (v_transfer.tenant_id, v_transfer.merchant_id, v_transfer.dest_branch_id, v_transfer.product_id, v_transfer.quantity, NOW())
    ON CONFLICT (branch_id, product_id) 
    DO UPDATE SET 
        quantity = public.branch_inventory.quantity + EXCLUDED.quantity,
        updated_at = NOW();

    -- 6. Create auditable TRANSFER_OUT inventory transaction
    INSERT INTO public.inventory_transactions (
        tenant_id, product_id, branch_id, type, quantity, reference_type, transfer_id, notes, created_at
    ) VALUES (
        v_transfer.tenant_id, v_transfer.product_id, v_transfer.source_branch_id, 'TRANSFER_OUT',
        -v_transfer.quantity, 'STOCK_TRANSFER', v_transfer.id, 'نقل مخزني صادر للفرع المستلم', NOW()
    );

    -- 7. Create auditable TRANSFER_IN inventory transaction
    INSERT INTO public.inventory_transactions (
        tenant_id, product_id, branch_id, type, quantity, reference_type, transfer_id, notes, created_at
    ) VALUES (
        v_transfer.tenant_id, v_transfer.product_id, v_transfer.dest_branch_id, 'TRANSFER_IN',
        v_transfer.quantity, 'STOCK_TRANSFER', v_transfer.id, 'استلام مخزني وارد من الفرع المصدر', NOW()
    );

    -- 8. Mark transfer as COMPLETED atomically
    UPDATE public.merchant_stock_transfers 
    SET status = 'COMPLETED',
        received_by = p_received_by_id,
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_transfer_id;

    RETURN jsonb_build_object(
        'success', true,
        'transfer_id', p_transfer_id,
        'quantity', v_transfer.quantity,
        'status', 'COMPLETED'
    );
END;
$$;

-- 4. STRICT EXECUTION GRANTS: Service Role Only
REVOKE ALL ON FUNCTION public.execute_stock_transfer_completion(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.execute_stock_transfer_completion(UUID, UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_stock_transfer_completion(UUID, UUID) TO service_role;

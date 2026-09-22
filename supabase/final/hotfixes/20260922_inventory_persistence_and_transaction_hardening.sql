-- ============================================================================
-- DELIVERE ENTERPRISE — TARGETED DATABASE HOTFIX
-- TARGET ENVIRONMENT: DEVELOPMENT_STAGING / SUPABASE SQL EDITOR
-- SCRIPT ID: 20260922_inventory_persistence_and_transaction_hardening.sql
--
-- DESCRIPTION:
-- Step 6.3H: Authoritative Inventory Persistence, Transaction & Transfer Hardening.
-- Establishes PostgreSQL / Supabase as the single authoritative source of truth
-- for merchant products, multi-branch stock balances, atomic stock adjustments,
-- and atomic inter-branch stock transfers.
--
-- INVARIANTS ENFORCED:
-- 1. Single Authoritative Truth:
--    - Stock balances reside in public.branch_inventory.
--    - No in-memory/fallback mutations permitted.
-- 2. Concurrency & Atomicity:
--    - Row-level locking (SELECT ... FOR UPDATE) on products and branch_inventory
--      prevents race conditions and lost updates during concurrent mutations.
--    - Safe first-row initialization with ON CONFLICT (branch_id, product_id) DO NOTHING.
-- 3. Invariant Stock Protection:
--    - Negative stock balances are strictly prohibited (quantity >= 0).
--    - Insufficient stock errors raised if an adjustment or transfer would breach zero.
-- 4. Idempotency & Concurrency:
--    - Serialization occurs BEFORE authoritative mutations via transaction-scoped
--      PostgreSQL advisory lock: pg_advisory_xact_lock(v_lock_key).
--    - Lock key derived deterministically from (tenant_id, merchant_id, request_type, idempotency_key).
--    - Cross-product same-key concurrent executions are safely serialized before any stock mutation.
--    - Replay returns identical response payload; mismatched payload raises IDEMPOTENCY_REPLAY_MISMATCH.
--    - Defense-in-depth unique constraint uq_inventory_idempotency preserved.
-- 5. Inter-Branch Transfer Atomicity & Canonical Movement Semantics:
--    - Source and destination branches must differ (chk_different_transfer_branches).
--    - Both branches must exist and belong to the authenticated tenant and merchant.
--    - In a single atomic transaction: source balance is decremented, destination
--      balance is incremented, transfer header + item are recorded, and two
--      canonical audit movements (TRANSFER_OUT and TRANSFER_IN) are appended to stock_movements.
-- 6. Audit Immutability & Canonical Adjustment Semantics:
--    - Positive manual adjustment generates ADJUSTMENT_ADD.
--    - Negative manual adjustment generates ADJUSTMENT_REMOVE.
--    - All adjustments and transfers generate immutable stock_movements ledger entries.
-- 7. Security & Privilege Hardening:
--    - Functions run with SECURITY DEFINER and SET search_path = public, pg_temp.
--    - Public / anon / authenticated EXECUTE revoked; restricted strictly to service_role.
--    - Idempotency table protected with RLS and restricted to service_role.
--
-- SAFETY & COMPLIANCE:
-- - ZERO table drops, ZERO column drops, ZERO destructive operations.
-- - Atomic transaction wrapper (BEGIN ... COMMIT).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- PREFLIGHT CHECK: Verify core tables exist
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
        RAISE EXCEPTION 'PREFLIGHT CHECK FAILED: public.products table does not exist.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'merchant_branches') THEN
        RAISE EXCEPTION 'PREFLIGHT CHECK FAILED: public.merchant_branches table does not exist.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'branch_inventory') THEN
        RAISE EXCEPTION 'PREFLIGHT CHECK FAILED: public.branch_inventory table does not exist.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stock_movements') THEN
        RAISE EXCEPTION 'PREFLIGHT CHECK FAILED: public.stock_movements table does not exist.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'merchant_stock_transfers') THEN
        RAISE EXCEPTION 'PREFLIGHT CHECK FAILED: public.merchant_stock_transfers table does not exist.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'merchant_stock_transfer_items') THEN
        RAISE EXCEPTION 'PREFLIGHT CHECK FAILED: public.merchant_stock_transfer_items table does not exist.';
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1. Ensure Products Table has Complete Inventory Attributes
-- ----------------------------------------------------------------------------
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_stock_alert INTEGER DEFAULT 5;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'قطعة';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS location_rack TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS notes TEXT;

-- ----------------------------------------------------------------------------
-- 2. Ensure Stock Movements has reference_number
-- ----------------------------------------------------------------------------
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS reference_number TEXT;

-- ----------------------------------------------------------------------------
-- 3. Inventory Idempotency Table & Strict Access Control
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    merchant_id UUID NOT NULL,
    idempotency_key TEXT NOT NULL,
    request_type TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    response_payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_inventory_idempotency UNIQUE (tenant_id, merchant_id, idempotency_key, request_type)
);

CREATE INDEX IF NOT EXISTS idx_inventory_idempotency_lookup 
    ON public.inventory_idempotency_keys (tenant_id, merchant_id, idempotency_key);

ALTER TABLE public.inventory_idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Drop permissive public policy if previously created
DROP POLICY IF EXISTS inventory_idempotency_service_policy ON public.inventory_idempotency_keys;

-- Secure access: internal infrastructure restricted to service_role only
REVOKE ALL ON TABLE public.inventory_idempotency_keys FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.inventory_idempotency_keys TO service_role;

-- ----------------------------------------------------------------------------
-- 4. Atomic Transactional Stock Adjustment RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.execute_stock_adjustment(
    p_tenant_id UUID,
    p_merchant_id UUID,
    p_branch_id UUID,
    p_product_id UUID,
    p_quantity_change INTEGER,
    p_movement_type TEXT DEFAULT NULL,
    p_reference_number TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_performed_by UUID DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_lock_key BIGINT;
    v_payload_hash TEXT;
    v_existing_key RECORD;
    v_product RECORD;
    v_current_stock INTEGER := 0;
    v_new_stock INTEGER;
    v_branch_id UUID;
    v_movement_id UUID := gen_random_uuid();
    v_movement_type public.stock_movement_type;
    v_res JSONB;
BEGIN
    -- 1. Input Validation
    IF p_quantity_change IS NULL OR p_quantity_change = 0 THEN
        RAISE EXCEPTION 'INVALID_QUANTITY: Adjustment quantity change must be non-zero';
    END IF;

    -- 2. Validate Branch Ownership (Zero merchant_id as branch_id fallback)
    IF p_branch_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.merchant_branches
            WHERE id = p_branch_id AND merchant_id = p_merchant_id AND tenant_id = p_tenant_id AND is_active = true
        ) THEN
            RAISE EXCEPTION 'BRANCH_NOT_FOUND: Branch % does not exist or does not belong to merchant %', p_branch_id, p_merchant_id;
        END IF;
        v_branch_id := p_branch_id;
    ELSE
        SELECT id INTO v_branch_id FROM public.merchant_branches
        WHERE merchant_id = p_merchant_id AND tenant_id = p_tenant_id AND is_active = true
        ORDER BY is_main DESC, created_at ASC LIMIT 1;

        IF v_branch_id IS NULL THEN
            RAISE EXCEPTION 'BRANCH_REQUIRED: No active branch found for merchant %', p_merchant_id;
        END IF;
    END IF;

    -- 3. Idempotency Claim & Serialization (BEFORE any stock mutation or product locking)
    IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
        -- Deterministically derive 64-bit transaction-scoped advisory lock: (tenant_id, merchant_id, request_type, idempotency_key)
        v_lock_key := ('x' || substr(md5(concat_ws(':', p_tenant_id::text, p_merchant_id::text, 'ADJUSTMENT', p_idempotency_key)), 1, 16))::bit(64)::bigint;
        PERFORM pg_advisory_xact_lock(v_lock_key);

        v_payload_hash := md5(concat_ws(':', p_tenant_id::text, p_merchant_id::text, v_branch_id::text, p_product_id::text, p_quantity_change::text));
        
        -- Query completed idempotency record under acquired lock
        SELECT * INTO v_existing_key
        FROM public.inventory_idempotency_keys
        WHERE tenant_id = p_tenant_id AND merchant_id = p_merchant_id AND idempotency_key = p_idempotency_key AND request_type = 'ADJUSTMENT';

        IF FOUND THEN
            IF v_existing_key.payload_hash = v_payload_hash THEN
                RETURN v_existing_key.response_payload;
            ELSE
                RAISE EXCEPTION 'IDEMPOTENCY_REPLAY_MISMATCH: Idempotency key % already used for different adjustment payload', p_idempotency_key;
            END IF;
        END IF;
    END IF;

    -- 4. Lock Product Record
    SELECT * INTO v_product FROM public.products
    WHERE id = p_product_id AND merchant_id = p_merchant_id AND tenant_id = p_tenant_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'PRODUCT_NOT_FOUND: Product % not found for merchant %', p_product_id, p_merchant_id;
    END IF;

    -- 5. Lock & Initialize Branch Stock Balance (First-row race safe)
    INSERT INTO public.branch_inventory (tenant_id, merchant_id, branch_id, product_id, quantity)
    VALUES (p_tenant_id, p_merchant_id, v_branch_id, p_product_id, 0)
    ON CONFLICT (branch_id, product_id) DO NOTHING;

    SELECT quantity INTO v_current_stock FROM public.branch_inventory
    WHERE branch_id = v_branch_id AND product_id = p_product_id AND tenant_id = p_tenant_id FOR UPDATE;

    v_new_stock := v_current_stock + p_quantity_change;
    IF v_new_stock < 0 THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK: Adjustment would result in negative stock balance (% < 0)', v_new_stock;
    END IF;

    -- 6. Update Branch Stock Balance
    UPDATE public.branch_inventory
    SET quantity = v_new_stock, updated_at = now()
    WHERE branch_id = v_branch_id AND product_id = p_product_id AND tenant_id = p_tenant_id;

    -- 7. Resolve Canonical Stock Movement Type
    IF p_movement_type IS NOT NULL AND TRIM(p_movement_type) <> '' THEN
        v_movement_type := p_movement_type::public.stock_movement_type;
    ELSE
        IF p_quantity_change > 0 THEN
            v_movement_type := 'ADJUSTMENT_ADD'::public.stock_movement_type;
        ELSE
            v_movement_type := 'ADJUSTMENT_REMOVE'::public.stock_movement_type;
        END IF;
    END IF;

    -- 8. Insert Immutable Stock Movement Audit Record
    INSERT INTO public.stock_movements (
        id, tenant_id, merchant_id, branch_id, product_id,
        movement_type, quantity, balance_before, balance_after,
        unit_cost, reference_type, reference_id, reference_number, notes, performed_by, created_at
    ) VALUES (
        v_movement_id, p_tenant_id, p_merchant_id, v_branch_id, p_product_id,
        v_movement_type, p_quantity_change, v_current_stock, v_new_stock,
        v_product.cost_price, 'ADJUSTMENT', COALESCE(p_reference_number, 'ADJ-MANUAL'), COALESCE(p_reference_number, 'ADJ-MANUAL'),
        COALESCE(p_notes, 'تعديل جرد يدوي بالمستودع'), p_performed_by, now()
    );

    -- 9. Build Response Object
    v_res := jsonb_build_object(
        'success', true,
        'productId', p_product_id,
        'branchId', v_branch_id,
        'previousStock', v_current_stock,
        'newStock', v_new_stock,
        'quantityChange', p_quantity_change,
        'movementId', v_movement_id
    );

    -- 10. Persist Idempotency Record (Serialized by advisory lock; unique constraint as defense-in-depth)
    IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
        INSERT INTO public.inventory_idempotency_keys (
            tenant_id, merchant_id, idempotency_key, request_type, payload_hash, response_payload
        ) VALUES (
            p_tenant_id, p_merchant_id, p_idempotency_key, 'ADJUSTMENT', v_payload_hash, v_res
        );
    END IF;

    RETURN v_res;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Atomic Inter-Branch Stock Transfer RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.execute_stock_transfer(
    p_tenant_id UUID,
    p_merchant_id UUID,
    p_source_branch_id UUID,
    p_destination_branch_id UUID,
    p_product_id UUID,
    p_quantity INTEGER,
    p_notes TEXT DEFAULT NULL,
    p_performed_by UUID DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_lock_key BIGINT;
    v_payload_hash TEXT;
    v_existing_key RECORD;
    v_product RECORD;
    v_src_stock INTEGER := 0;
    v_dst_stock INTEGER := 0;
    v_new_src_stock INTEGER;
    v_new_dst_stock INTEGER;
    v_transfer_id UUID := gen_random_uuid();
    v_out_mvt_id UUID := gen_random_uuid();
    v_in_mvt_id UUID := gen_random_uuid();
    v_res JSONB;
BEGIN
    -- 1. Validation
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'INVALID_QUANTITY: Transfer quantity must be greater than zero';
    END IF;

    IF p_source_branch_id = p_destination_branch_id THEN
        RAISE EXCEPTION 'SAME_BRANCH_TRANSFER: Source and destination branches must be different';
    END IF;

    -- 2. Validate Branch Ownership for Source & Destination
    IF NOT EXISTS (
        SELECT 1 FROM public.merchant_branches
        WHERE id = p_source_branch_id AND merchant_id = p_merchant_id AND tenant_id = p_tenant_id AND is_active = true
    ) THEN
        RAISE EXCEPTION 'SOURCE_BRANCH_NOT_FOUND: Source branch % does not exist or does not belong to merchant %', p_source_branch_id, p_merchant_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.merchant_branches
        WHERE id = p_destination_branch_id AND merchant_id = p_merchant_id AND tenant_id = p_tenant_id AND is_active = true
    ) THEN
        RAISE EXCEPTION 'DESTINATION_BRANCH_NOT_FOUND: Destination branch % does not exist or does not belong to merchant %', p_destination_branch_id, p_merchant_id;
    END IF;

    -- 3. Idempotency Claim & Serialization (BEFORE any stock mutation, transfer header insert, or product locking)
    IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
        -- Deterministically derive 64-bit transaction-scoped advisory lock: (tenant_id, merchant_id, request_type, idempotency_key)
        v_lock_key := ('x' || substr(md5(concat_ws(':', p_tenant_id::text, p_merchant_id::text, 'TRANSFER', p_idempotency_key)), 1, 16))::bit(64)::bigint;
        PERFORM pg_advisory_xact_lock(v_lock_key);

        v_payload_hash := md5(concat_ws(':', p_tenant_id::text, p_merchant_id::text, p_source_branch_id::text, p_destination_branch_id::text, p_product_id::text, p_quantity::text));
        
        -- Query completed idempotency record under acquired lock
        SELECT * INTO v_existing_key
        FROM public.inventory_idempotency_keys
        WHERE tenant_id = p_tenant_id AND merchant_id = p_merchant_id AND idempotency_key = p_idempotency_key AND request_type = 'TRANSFER';

        IF FOUND THEN
            IF v_existing_key.payload_hash = v_payload_hash THEN
                RETURN v_existing_key.response_payload;
            ELSE
                RAISE EXCEPTION 'IDEMPOTENCY_REPLAY_MISMATCH: Idempotency key % already used for different transfer payload', p_idempotency_key;
            END IF;
        END IF;
    END IF;

    -- 4. Lock Product Record
    SELECT * INTO v_product FROM public.products
    WHERE id = p_product_id AND merchant_id = p_merchant_id AND tenant_id = p_tenant_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'PRODUCT_NOT_FOUND: Product % not found for merchant %', p_product_id, p_merchant_id;
    END IF;

    -- 5. Lock Source Branch Stock & Verify Balance
    SELECT quantity INTO v_src_stock FROM public.branch_inventory
    WHERE branch_id = p_source_branch_id AND product_id = p_product_id AND tenant_id = p_tenant_id FOR UPDATE;

    IF NOT FOUND OR v_src_stock < p_quantity THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK: Source branch has insufficient stock (% available, % requested)', COALESCE(v_src_stock, 0), p_quantity;
    END IF;

    -- 6. Lock or Initialize Destination Branch Stock (First-row race safe)
    INSERT INTO public.branch_inventory (tenant_id, merchant_id, branch_id, product_id, quantity)
    VALUES (p_tenant_id, p_merchant_id, p_destination_branch_id, p_product_id, 0)
    ON CONFLICT (branch_id, product_id) DO NOTHING;

    SELECT quantity INTO v_dst_stock FROM public.branch_inventory
    WHERE branch_id = p_destination_branch_id AND product_id = p_product_id AND tenant_id = p_tenant_id FOR UPDATE;

    -- 7. Calculate Mutated Balances
    v_new_src_stock := v_src_stock - p_quantity;
    v_new_dst_stock := v_dst_stock + p_quantity;

    -- 8. Mutate Source Branch Stock (DECREMENT)
    UPDATE public.branch_inventory
    SET quantity = v_new_src_stock, updated_at = now()
    WHERE branch_id = p_source_branch_id AND product_id = p_product_id AND tenant_id = p_tenant_id;

    -- 9. Mutate Destination Branch Stock (INCREMENT)
    UPDATE public.branch_inventory
    SET quantity = v_new_dst_stock, updated_at = now()
    WHERE branch_id = p_destination_branch_id AND product_id = p_product_id AND tenant_id = p_tenant_id;

    -- 10. Insert Stock Transfer Header Record
    INSERT INTO public.merchant_stock_transfers (
        id, tenant_id, merchant_id, source_branch_id, destination_branch_id, status, notes, created_by, created_at, updated_at
    ) VALUES (
        v_transfer_id, p_tenant_id, p_merchant_id, p_source_branch_id, p_destination_branch_id, 'COMPLETED', COALESCE(p_notes, 'مناقلة مخزنية بين الفروع'), p_performed_by, now(), now()
    );

    -- 11. Insert Stock Transfer Item Record
    INSERT INTO public.merchant_stock_transfer_items (
        id, tenant_id, merchant_id, transfer_id, product_id, quantity, unit_cost, created_at
    ) VALUES (
        gen_random_uuid(), p_tenant_id, p_merchant_id, v_transfer_id, p_product_id, p_quantity, v_product.cost_price, now()
    );

    -- 12. Insert Canonical OUT Movement for Source Branch (TRANSFER_OUT)
    INSERT INTO public.stock_movements (
        id, tenant_id, merchant_id, branch_id, product_id,
        movement_type, quantity, balance_before, balance_after,
        unit_cost, reference_type, reference_id, reference_number, notes, performed_by, created_at
    ) VALUES (
        v_out_mvt_id, p_tenant_id, p_merchant_id, p_source_branch_id, p_product_id,
        'TRANSFER_OUT'::public.stock_movement_type, -p_quantity, v_src_stock, v_new_src_stock,
        v_product.cost_price, 'STOCK_TRANSFER', v_transfer_id::text, v_transfer_id::text,
        p_notes, p_performed_by, now()
    );

    -- 13. Insert Canonical IN Movement for Destination Branch (TRANSFER_IN)
    INSERT INTO public.stock_movements (
        id, tenant_id, merchant_id, branch_id, product_id,
        movement_type, quantity, balance_before, balance_after,
        unit_cost, reference_type, reference_id, reference_number, notes, performed_by, created_at
    ) VALUES (
        v_in_mvt_id, p_tenant_id, p_merchant_id, p_destination_branch_id, p_product_id,
        'TRANSFER_IN'::public.stock_movement_type, p_quantity, v_dst_stock, v_new_dst_stock,
        v_product.cost_price, 'STOCK_TRANSFER', v_transfer_id::text, v_transfer_id::text,
        p_notes, p_performed_by, now()
    );

    v_res := jsonb_build_object(
        'success', true,
        'transferId', v_transfer_id,
        'productId', p_product_id,
        'sourceBranchId', p_source_branch_id,
        'destinationBranchId', p_destination_branch_id,
        'quantity', p_quantity,
        'sourceStockAfter', v_new_src_stock,
        'destinationStockAfter', v_new_dst_stock
    );

    -- 14. Persist Idempotency Record (Serialized by advisory lock; unique constraint as defense-in-depth)
    IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
        INSERT INTO public.inventory_idempotency_keys (
            tenant_id, merchant_id, idempotency_key, request_type, payload_hash, response_payload
        ) VALUES (
            p_tenant_id, p_merchant_id, p_idempotency_key, 'TRANSFER', v_payload_hash, v_res
        );
    END IF;

    RETURN v_res;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. RPC Execution Privileges (Restricted to service_role)
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.execute_stock_adjustment(UUID, UUID, UUID, UUID, INTEGER, TEXT, TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_stock_adjustment(UUID, UUID, UUID, UUID, INTEGER, TEXT, TEXT, TEXT, UUID, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.execute_stock_transfer(UUID, UUID, UUID, UUID, UUID, INTEGER, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_stock_transfer(UUID, UUID, UUID, UUID, UUID, INTEGER, TEXT, UUID, TEXT) TO service_role;

COMMIT;

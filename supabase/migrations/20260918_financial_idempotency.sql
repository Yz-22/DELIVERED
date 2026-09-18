-- ==============================================================================
-- Delivere Logistics & Enterprise TMS/POS
-- Migration: 20260918_financial_idempotency.sql
-- Name: Phase F — Authoritative Financial Obligations & Lifecycle-Driven Settlement Ledger (Revision 3.2)
-- Architecture: Normalized Obligations + Composite Integrity + Lifecycle State Synchronization
-- Concurrency Row-Locking, Guaranteed Recalculation on Header/Line State Transitions, & Zero Cross-Entity Contamination
-- NO DATA MODIFICATION OR PRODUCTION APPLICATION IN THIS STEP
-- ==============================================================================

-- 1. ADD IDEMPOTENCY KEY TO FINANCIAL POSTINGS
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_journal_entries_idempotency 
ON public.journal_entries (tenant_id, idempotency_key) 
WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_vouchers_idempotency 
ON public.vouchers (tenant_id, idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- 2. AUTHORITATIVE FINANCIAL OBLIGATIONS TABLE
CREATE TABLE IF NOT EXISTS public.financial_obligations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE RESTRICT,
    beneficiary_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    obligation_type TEXT NOT NULL CHECK (obligation_type IN ('MERCHANT_COD', 'DRIVER_EARNING', 'DRIVER_COMMISSION')),
    original_amount NUMERIC(12, 3) NOT NULL CHECK (original_amount >= 0),
    currency TEXT NOT NULL DEFAULT 'JOD',
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'PARTIALLY_SETTLED', 'SETTLED', 'CANCELLED', 'LEGACY_RECONCILIATION_REQUIRED')),
    source_reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_obligation_shipment_type UNIQUE (shipment_id, obligation_type),
    CONSTRAINT uq_obligation_id_tenant UNIQUE (id, tenant_id),
    CONSTRAINT uq_obligation_composite UNIQUE (id, tenant_id, shipment_id, beneficiary_id, obligation_type)
);

CREATE INDEX IF NOT EXISTS idx_obligations_tenant ON public.financial_obligations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_obligations_shipment ON public.financial_obligations(shipment_id);
CREATE INDEX IF NOT EXISTS idx_obligations_beneficiary ON public.financial_obligations(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_obligations_status ON public.financial_obligations(status);
CREATE INDEX IF NOT EXISTS idx_obligations_type ON public.financial_obligations(obligation_type);

-- 3. AUTHORITATIVE SETTLEMENT RECORDS HEADER TABLE
CREATE TABLE IF NOT EXISTS public.settlement_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    settlement_number TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('MERCHANT', 'DRIVER')),
    beneficiary_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    total_amount NUMERIC(12, 3) NOT NULL CHECK (total_amount >= 0),
    payment_method TEXT NOT NULL DEFAULT 'CASH' CHECK (payment_method IN ('CASH', 'CLIQ', 'BANK_TRANSFER', 'CHEQUE')),
    voucher_id UUID REFERENCES public.vouchers(id) ON DELETE SET NULL,
    journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    idempotency_key TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'POSTED', 'CANCELLED', 'REVERSED')),
    notes TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Maker
    approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Checker
    posted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_settlement_tenant_number UNIQUE (tenant_id, settlement_number),
    CONSTRAINT uq_settlement_id_tenant UNIQUE (id, tenant_id),
    CONSTRAINT uq_settlement_composite_header UNIQUE (id, tenant_id, beneficiary_id, type)
);

CREATE INDEX IF NOT EXISTS idx_settlement_records_tenant ON public.settlement_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_settlement_records_beneficiary ON public.settlement_records(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_settlement_records_status ON public.settlement_records(status);
CREATE INDEX IF NOT EXISTS idx_settlement_records_type ON public.settlement_records(type);

-- 4. NORMALIZED SETTLEMENT ITEMS DETAIL TABLE (With strict composite foreign keys)
CREATE TABLE IF NOT EXISTS public.settlement_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    settlement_id UUID NOT NULL,
    obligation_id UUID NOT NULL,
    shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE RESTRICT,
    beneficiary_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    obligation_type TEXT NOT NULL CHECK (obligation_type IN ('MERCHANT_COD', 'DRIVER_EARNING', 'DRIVER_COMMISSION')),
    allocated_amount NUMERIC(12, 3) NOT NULL CHECK (allocated_amount > 0),
    total_cod_collected NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    delivery_fee_deducted NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    driver_fee_paid NUMERIC(12, 3) DEFAULT 0.000,
    net_settled_amount NUMERIC(12, 3) NOT NULL,
    allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_settlement_items_settlement_tenant 
        FOREIGN KEY (settlement_id, tenant_id) 
        REFERENCES public.settlement_records(id, tenant_id) 
        ON DELETE CASCADE,
    -- Composite FK guarantees 100% agreement between item fields and authoritative obligation
    CONSTRAINT fk_settlement_items_obligation_composite 
        FOREIGN KEY (obligation_id, tenant_id, shipment_id, beneficiary_id, obligation_type) 
        REFERENCES public.financial_obligations(id, tenant_id, shipment_id, beneficiary_id, obligation_type) 
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_settlement_items_settlement_id ON public.settlement_items(settlement_id);
CREATE INDEX IF NOT EXISTS idx_settlement_items_obligation_id ON public.settlement_items(obligation_id);
CREATE INDEX IF NOT EXISTS idx_settlement_items_shipment_id ON public.settlement_items(shipment_id);
CREATE INDEX IF NOT EXISTS idx_settlement_items_tenant_id ON public.settlement_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_settlement_items_obligation_type ON public.settlement_items(obligation_type, shipment_id);

-- 5. FUNCTION: ENFORCE HEADER BENEFICIARY & TYPE COMPATIBILITY WITH SETTLEMENT ITEMS
CREATE OR REPLACE FUNCTION public.check_settlement_item_header_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_header RECORD;
BEGIN
    SELECT * INTO v_header
    FROM public.settlement_records
    WHERE id = NEW.settlement_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Parent settlement record % not found.', NEW.settlement_id;
    END IF;

    IF v_header.beneficiary_id <> NEW.beneficiary_id THEN
        RAISE EXCEPTION 'Beneficiary mismatch: Settlement % is for beneficiary %, but item specifies beneficiary %',
            NEW.settlement_id, v_header.beneficiary_id, NEW.beneficiary_id;
    END IF;

    IF (v_header.type = 'MERCHANT' AND NEW.obligation_type <> 'MERCHANT_COD') OR
       (v_header.type = 'DRIVER' AND NEW.obligation_type NOT IN ('DRIVER_EARNING', 'DRIVER_COMMISSION')) THEN
        RAISE EXCEPTION 'Type mismatch: Settlement % type "%" cannot allocate obligation type "%"',
            NEW.settlement_id, v_header.type, NEW.obligation_type;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_settlement_item_header_match ON public.settlement_items;
CREATE TRIGGER trg_check_settlement_item_header_match
    BEFORE INSERT OR UPDATE ON public.settlement_items
    FOR EACH ROW
    EXECUTE FUNCTION public.check_settlement_item_header_match();

-- 6. AUTHORITATIVE FUNCTION: RECALCULATE FINANCIAL OBLIGATION STATUS
-- Locks the obligation row FOR UPDATE and synchronizes status with active allocations
CREATE OR REPLACE FUNCTION public.recalculate_financial_obligation_status(
    p_obligation_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_obligation RECORD;
    v_total_active_allocated NUMERIC(12, 3);
BEGIN
    -- 1. Row-lock the obligation
    SELECT * INTO v_obligation
    FROM public.financial_obligations
    WHERE id = p_obligation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Do not alter explicit reconciliation or cancelled status on the obligation itself
    IF v_obligation.status IN ('CANCELLED', 'LEGACY_RECONCILIATION_REQUIRED') THEN
        RETURN;
    END IF;

    -- 2. Sum allocations belonging ONLY to active settlement headers (DRAFT, APPROVED, POSTED)
    SELECT COALESCE(SUM(si.allocated_amount), 0.000) INTO v_total_active_allocated
    FROM public.settlement_items si
    JOIN public.settlement_records sr ON si.settlement_id = sr.id
    WHERE si.obligation_id = p_obligation_id
      AND sr.status IN ('DRAFT', 'APPROVED', 'POSTED');

    -- 3. Transition status accurately
    IF v_total_active_allocated <= 0.0001 THEN
        UPDATE public.financial_obligations
        SET status = 'OPEN', updated_at = NOW()
        WHERE id = p_obligation_id;
    ELSIF v_total_active_allocated >= v_obligation.original_amount THEN
        UPDATE public.financial_obligations
        SET status = 'SETTLED', updated_at = NOW()
        WHERE id = p_obligation_id;
    ELSE
        UPDATE public.financial_obligations
        SET status = 'PARTIALLY_SETTLED', updated_at = NOW()
        WHERE id = p_obligation_id;
    END IF;
END;
$$;

-- 7. TRIGGER: ALLOCATION UPPER BOUND CHECK BEFORE INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.check_settlement_obligation_allocation_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_obligation RECORD;
    v_other_allocated NUMERIC(12, 3);
    v_new_total NUMERIC(12, 3);
    v_remaining NUMERIC(12, 3);
BEGIN
    SELECT * INTO v_obligation
    FROM public.financial_obligations
    WHERE id = NEW.obligation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Financial Obligation % not found.', NEW.obligation_id;
    END IF;

    IF v_obligation.status IN ('CANCELLED', 'LEGACY_RECONCILIATION_REQUIRED') THEN
        RAISE EXCEPTION 'Financial Obligation % has status "%" and cannot accept settlement allocations.', 
            NEW.obligation_id, v_obligation.status;
    END IF;

    SELECT COALESCE(SUM(si.allocated_amount), 0.000) INTO v_other_allocated
    FROM public.settlement_items si
    JOIN public.settlement_records sr ON si.settlement_id = sr.id
    WHERE si.obligation_id = NEW.obligation_id
      AND si.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND sr.status IN ('DRAFT', 'APPROVED', 'POSTED');

    v_new_total := v_other_allocated + NEW.allocated_amount;
    v_remaining := v_obligation.original_amount - v_other_allocated;

    IF v_new_total > v_obligation.original_amount THEN
        RAISE EXCEPTION 'Settlement allocation exceeded for obligation % (Shipment %, Type %): Original = %, Already Allocated = %, Remaining = %, Requested = %',
            NEW.obligation_id, v_obligation.shipment_id, v_obligation.obligation_type, 
            v_obligation.original_amount, v_other_allocated, v_remaining, NEW.allocated_amount;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_settlement_obligation_allocation_limit ON public.settlement_items;
CREATE TRIGGER trg_check_settlement_obligation_allocation_limit
    BEFORE INSERT OR UPDATE ON public.settlement_items
    FOR EACH ROW
    EXECUTE FUNCTION public.check_settlement_obligation_allocation_limit();

-- 8. TRIGGERS: RECALCULATE OBLIGATION ON SETTLEMENT_ITEMS MUTATION
CREATE OR REPLACE FUNCTION public.trg_settlement_item_lifecycle_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM public.recalculate_financial_obligation_status(NEW.obligation_id);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.obligation_id <> NEW.obligation_id THEN
            PERFORM public.recalculate_financial_obligation_status(OLD.obligation_id);
        END IF;
        PERFORM public.recalculate_financial_obligation_status(NEW.obligation_id);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM public.recalculate_financial_obligation_status(OLD.obligation_id);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_settlement_item_lifecycle_sync ON public.settlement_items;
CREATE TRIGGER trg_settlement_item_lifecycle_sync
    AFTER INSERT OR UPDATE OR DELETE ON public.settlement_items
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_settlement_item_lifecycle_sync();

-- 9. TRIGGERS: RECALCULATE OBLIGATIONS ON SETTLEMENT_RECORDS STATUS TRANSITIONS
-- Automatically frees up capacity when a settlement is CANCELLED or REVERSED
CREATE OR REPLACE FUNCTION public.trg_settlement_record_status_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_item RECORD;
BEGIN
    IF (OLD.status <> NEW.status) THEN
        FOR v_item IN 
            SELECT DISTINCT obligation_id 
            FROM public.settlement_items 
            WHERE settlement_id = NEW.id
        LOOP
            PERFORM public.recalculate_financial_obligation_status(v_item.obligation_id);
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_settlement_record_status_sync ON public.settlement_records;
CREATE TRIGGER trg_settlement_record_status_sync
    AFTER UPDATE OF status ON public.settlement_records
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_settlement_record_status_sync();

-- 10. STRICT EXECUTION GRANTS: Service Role Only
REVOKE ALL ON FUNCTION public.recalculate_financial_obligation_status(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalculate_financial_obligation_status(UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_financial_obligation_status(UUID) TO service_role;

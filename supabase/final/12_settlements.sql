-- ============================================================================
-- DELIVERE — 12_settlements.sql
-- Merchant & Driver Settlement Records with Partial Allocation Control
-- ============================================================================

-- 1. Settlement Records Header Table
CREATE TABLE IF NOT EXISTS public.settlement_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    settlement_number TEXT NOT NULL,
    type public.settlement_type NOT NULL,
    beneficiary_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    beneficiary_name TEXT,
    status public.settlement_status NOT NULL DEFAULT 'DRAFT',
    total_amount NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (total_amount >= 0),
    net_payout NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (net_payout >= 0),
    currency TEXT NOT NULL DEFAULT 'JOD',
    payment_method TEXT DEFAULT 'CASH',
    payment_reference TEXT,
    journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    settled_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_settlements_number UNIQUE (tenant_id, settlement_number),
    CONSTRAINT uq_settlements_composite UNIQUE (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_settlements_lookup 
    ON public.settlement_records (tenant_id, beneficiary_id, status, type);

-- 2. Settlement Items (Line-level obligation allocations)
CREATE TABLE IF NOT EXISTS public.settlement_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    settlement_id UUID NOT NULL,
    obligation_id UUID NOT NULL,
    allocated_amount NUMERIC(12, 3) NOT NULL CHECK (allocated_amount > 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_settlement_items_pair UNIQUE (settlement_id, obligation_id),

    -- Composite FK to settlement header (tenant isolated)
    CONSTRAINT fk_settlement_items_settlement_composite FOREIGN KEY (settlement_id, tenant_id)
        REFERENCES public.settlement_records(id, tenant_id) ON DELETE RESTRICT,

    -- Composite FK to financial obligations (tenant isolated)
    CONSTRAINT fk_settlement_items_obligation_composite FOREIGN KEY (obligation_id, tenant_id)
        REFERENCES public.financial_obligations(id, tenant_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_settlement_items_obligation 
    ON public.settlement_items (obligation_id);

-- View: Backward-compatible 'settlements' query interface
CREATE OR REPLACE VIEW public.settlements AS
    SELECT * FROM public.settlement_records;

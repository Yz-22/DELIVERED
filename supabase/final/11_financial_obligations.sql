-- ============================================================================
-- DELIVERE — 11_financial_obligations.sql
-- Financial Obligations Register (Authoritative Source for COD & Compensation)
-- ============================================================================

-- 1. Financial Obligations Register Table
CREATE TABLE IF NOT EXISTS public.financial_obligations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    obligation_type public.financial_obligation_type NOT NULL,
    beneficiary_type TEXT NOT NULL, -- 'MERCHANT', 'DRIVER', 'COMPANY'
    beneficiary_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    shipment_id UUID REFERENCES public.shipments(id) ON DELETE RESTRICT,
    order_id UUID, -- Synonym for backward compatibility
    shipment_sequence TEXT,
    original_amount NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (original_amount >= 0),
    allocated_amount NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (allocated_amount >= 0),
    remaining_amount NUMERIC(12, 3) GENERATED ALWAYS AS (original_amount - allocated_amount) STORED,
    currency TEXT NOT NULL DEFAULT 'JOD',
    status public.financial_obligation_status NOT NULL DEFAULT 'PENDING',
    due_date DATE,
    idempotency_key TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Upper-bound allocation rule
    CONSTRAINT chk_obligation_allocation_limit CHECK (allocated_amount <= original_amount),

    -- Unique idempotency per tenant
    CONSTRAINT uq_obligations_idempotency UNIQUE (tenant_id, idempotency_key),

    -- Exactly one active obligation of each type per shipment
    CONSTRAINT uq_obligations_shipment_type UNIQUE (shipment_id, obligation_type),

    CONSTRAINT uq_obligations_composite UNIQUE (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_obligations_beneficiary 
    ON public.financial_obligations (tenant_id, beneficiary_id, status, obligation_type);
CREATE INDEX IF NOT EXISTS idx_obligations_shipment 
    ON public.financial_obligations (shipment_id);

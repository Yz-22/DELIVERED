-- ============================================================================
-- DELIVERE — 09_delivery_history_and_driver_operations.sql
-- Immutable Shipment Lifecycle Audit Trail & Driver Operations
-- ============================================================================

-- 1. Shipment Status History (Complete Lifecycle Audit Log)
CREATE TABLE IF NOT EXISTS public.shipment_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE RESTRICT,
    previous_status public.shipment_status,
    new_status public.shipment_status NOT NULL,
    actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    actor_name TEXT,
    actor_role TEXT,
    notes TEXT,
    location_lat NUMERIC(10, 7),
    location_lng NUMERIC(10, 7),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipment_history_lookup 
    ON public.shipment_status_history (shipment_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_shipment_history_tenant 
    ON public.shipment_status_history (tenant_id, created_at DESC);

-- 2. Driver Operational Cash Limits & Status
CREATE TABLE IF NOT EXISTS public.driver_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL,
    cash_on_hand NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    current_balance NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    max_cash_limit NUMERIC(12, 3) NOT NULL DEFAULT 150.000,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_driver_wallets_driver FOREIGN KEY (driver_id, tenant_id)
        REFERENCES public.users(id, tenant_id) ON DELETE CASCADE,
    CONSTRAINT uq_driver_wallet UNIQUE (driver_id)
);

CREATE INDEX IF NOT EXISTS idx_driver_wallets_tenant ON public.driver_wallets (tenant_id);

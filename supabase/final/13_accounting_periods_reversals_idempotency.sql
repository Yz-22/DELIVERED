-- ============================================================================
-- DELIVERE — 13_accounting_periods_reversals_idempotency.sql
-- Accounting Periods, Period Closure Controls & Reversal Infrastructure
-- ============================================================================

-- 1. Accounting Periods Table
CREATE TABLE IF NOT EXISTS public.accounting_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    period_name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status public.accounting_period_status NOT NULL DEFAULT 'OPEN',
    closed_at TIMESTAMPTZ,
    closed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reopened_at TIMESTAMPTZ,
    reopened_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reopen_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_period_dates CHECK (start_date <= end_date),
    CONSTRAINT uq_accounting_periods_name UNIQUE (tenant_id, period_name),
    CONSTRAINT excl_accounting_periods_range EXCLUDE USING gist (
        tenant_id WITH =,
        (daterange(start_date, end_date, '[]')) WITH &&
    )
);

CREATE INDEX IF NOT EXISTS idx_accounting_periods_range 
    ON public.accounting_periods (tenant_id, start_date, end_date, status);

-- 2. Database-Level Prevention of Overlapping Accounting Periods per Tenant
CREATE OR REPLACE FUNCTION public.check_accounting_period_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.start_date > NEW.end_date THEN
        RAISE EXCEPTION 'start_date (%) must be less than or equal to end_date (%)', NEW.start_date, NEW.end_date;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.accounting_periods
        WHERE tenant_id = NEW.tenant_id
          AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
          AND (start_date, end_date) OVERLAPS (NEW.start_date, NEW.end_date)
    ) THEN
        RAISE EXCEPTION 'Accounting period date range % to % overlaps with an existing accounting period for tenant %',
            NEW.start_date, NEW.end_date, NEW.tenant_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounting_period_overlap ON public.accounting_periods;
CREATE TRIGGER trg_accounting_period_overlap
    BEFORE INSERT OR UPDATE ON public.accounting_periods
    FOR EACH ROW
    EXECUTE FUNCTION public.check_accounting_period_overlap();


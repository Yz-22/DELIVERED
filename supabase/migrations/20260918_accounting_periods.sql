-- ==============================================================================
-- Delivere Logistics & Enterprise TMS/POS
-- Migration: 20260918_accounting_periods.sql
-- Name: Phase G — Accounting Period Controls & Backdating Prevention (Revision 3)
-- Architecture: Database-Level Period Locking (INSERT/UPDATE/DELETE) & Audited Safe Reopening
-- Immutable Closed Periods & Reopening Security Definer Hardening
-- NO DATA MODIFICATION OR PRODUCTION APPLICATION IN THIS STEP
-- ==============================================================================

-- 1. ACCOUNTING PERIODS TABLE
CREATE TABLE IF NOT EXISTS public.accounting_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_name TEXT NOT NULL, -- e.g. '2026-Q1', '2026-09'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'LOCKED')),
    closed_at TIMESTAMPTZ,
    closed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reopened_at TIMESTAMPTZ,
    reopened_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reopen_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_period_tenant_name UNIQUE (tenant_id, period_name),
    CONSTRAINT chk_period_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_accounting_periods_tenant ON public.accounting_periods(tenant_id);
CREATE INDEX IF NOT EXISTS idx_accounting_periods_status ON public.accounting_periods(status);
CREATE INDEX IF NOT EXISTS idx_accounting_periods_dates ON public.accounting_periods(start_date, end_date);

-- 2. TRIGGER FUNCTION: PREVENT POSTING / MODIFYING / DELETING FINANCIAL ENTRIES IN CLOSED PERIODS
CREATE OR REPLACE FUNCTION public.check_accounting_period_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tenant_id UUID;
    v_date DATE;
    v_closed_period_name TEXT;
BEGIN
    -- 1. Check OLD record on UPDATE or DELETE (Prevents deleting from or moving entries out of closed periods)
    IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
        IF TG_TABLE_NAME = 'journal_entries' THEN
            v_tenant_id := OLD.tenant_id;
            v_date := OLD.date::DATE;
        ELSIF TG_TABLE_NAME = 'journal_lines' THEN
            SELECT tenant_id, date::DATE INTO v_tenant_id, v_date 
            FROM public.journal_entries 
            WHERE id = OLD.entry_id;
        END IF;

        IF v_tenant_id IS NOT NULL AND v_date IS NOT NULL THEN
            SELECT period_name INTO v_closed_period_name
            FROM public.accounting_periods
            WHERE tenant_id = v_tenant_id
              AND v_date BETWEEN start_date AND end_date
              AND status IN ('CLOSED', 'LOCKED')
            LIMIT 1;

            IF v_closed_period_name IS NOT NULL THEN
                RAISE EXCEPTION 'Financial operation (%) rejected: Original date % falls within closed/locked period "%".',
                    TG_OP, v_date, v_closed_period_name;
            END IF;
        END IF;
    END IF;

    -- 2. Check NEW record on INSERT or UPDATE (Prevents creating new entries or moving entries into closed periods)
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        IF TG_TABLE_NAME = 'journal_entries' THEN
            v_tenant_id := NEW.tenant_id;
            v_date := NEW.date::DATE;
        ELSIF TG_TABLE_NAME = 'journal_lines' THEN
            SELECT tenant_id, date::DATE INTO v_tenant_id, v_date 
            FROM public.journal_entries 
            WHERE id = NEW.entry_id;
        END IF;

        IF v_tenant_id IS NOT NULL AND v_date IS NOT NULL THEN
            SELECT period_name INTO v_closed_period_name
            FROM public.accounting_periods
            WHERE tenant_id = v_tenant_id
              AND v_date BETWEEN start_date AND end_date
              AND status IN ('CLOSED', 'LOCKED')
            LIMIT 1;

            IF v_closed_period_name IS NOT NULL THEN
                RAISE EXCEPTION 'Financial operation (%) rejected: Target date % falls within closed/locked period "%".',
                    TG_OP, v_date, v_closed_period_name;
            END IF;
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_journal_entry_period_lock ON public.journal_entries;
CREATE TRIGGER trg_journal_entry_period_lock
    BEFORE INSERT OR UPDATE OR DELETE ON public.journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.check_accounting_period_lock();

DROP TRIGGER IF EXISTS trg_journal_line_period_lock ON public.journal_lines;
CREATE TRIGGER trg_journal_line_period_lock
    BEFORE INSERT OR UPDATE OR DELETE ON public.journal_lines
    FOR EACH ROW
    EXECUTE FUNCTION public.check_accounting_period_lock();

-- 3. HARDENED AUDITED PERIOD REOPENING STORED PROCEDURE
CREATE OR REPLACE FUNCTION public.reopen_accounting_period(
    p_period_id UUID,
    p_reopened_by UUID,
    p_reason TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_period RECORD;
    v_user RECORD;
BEGIN
    IF p_reason IS NULL OR length(trim(p_reason)) < 10 THEN
        RAISE EXCEPTION 'Reopening an accounting period requires a detailed audit reason (minimum 10 characters).';
    END IF;

    SELECT * INTO v_period 
    FROM public.accounting_periods 
    WHERE id = p_period_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Accounting period % not found.', p_period_id;
    END IF;

    IF p_reopened_by IS NOT NULL THEN
        SELECT id, tenant_id INTO v_user 
        FROM public.users 
        WHERE id = p_reopened_by;

        IF NOT FOUND OR v_user.tenant_id <> v_period.tenant_id THEN
            RAISE EXCEPTION 'User % is not authorized to reopen period for tenant %.', p_reopened_by, v_period.tenant_id;
        END IF;
    END IF;

    UPDATE public.accounting_periods
    SET status = 'OPEN',
        reopened_at = NOW(),
        reopened_by = p_reopened_by,
        reopen_reason = trim(p_reason),
        updated_at = NOW()
    WHERE id = p_period_id;

    RETURN jsonb_build_object(
        'success', true, 
        'period_id', p_period_id, 
        'period_name', v_period.period_name, 
        'status', 'OPEN'
    );
END;
$$;

-- 4. STRICT EXECUTION GRANTS: Service Role Only
REVOKE ALL ON FUNCTION public.reopen_accounting_period(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reopen_accounting_period(UUID, UUID, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_accounting_period(UUID, UUID, TEXT) TO service_role;

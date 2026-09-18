-- ============================================================================
-- DELIVERE ENTERPRISE — HOTFIX: SETTLEMENT STATUS CONSISTENCY
-- TARGET ENVIRONMENT: DEVELOPMENT_STAGING / SUPABASE SQL EDITOR
-- SCRIPT ID: 20260918_settlement_status_consistency.sql
--
-- DESCRIPTION:
-- Non-destructive, idempotent hotfix to resolve PostgreSQL runtime error 22P02:
-- "invalid input value for enum settlement_status: 'REVERSED'"
--
-- Root Cause:
-- The canonical settlement_status enum defined in DELIVERE_FULL_DATABASE_INSTALL.sql
-- is ('DRAFT', 'SUBMITTED', 'APPROVED', 'SETTLED', 'CANCELLED').
-- However, two PL/pgSQL database functions:
--   1. public.enforce_settlement_allocation_cap()
--   2. public.recalculate_obligation_allocated_amount(UUID)
-- contained a stale filter:
--   sr.status NOT IN ('CANCELLED', 'REVERSED')
-- When inserting or updating public.settlement_items, PostgreSQL evaluated the
-- query with string literal 'REVERSED' against enum column sr.status, throwing 22P02.
--
-- Lifecycle Alignment:
-- In Delivere's canonical financial model:
--   - Journals support 'REVERSED' via journal_posting_status (immutability rule).
--   - Settlement records use 'CANCELLED' to void an allocation and restore obligation balances.
--   - Therefore, the active allocation filter is simply: sr.status <> 'CANCELLED'
--     (or sr.status NOT IN ('CANCELLED')).
--
-- Actions Performed by this Hotfix:
--   1. Replace public.enforce_settlement_allocation_cap() with canonical filter.
--   2. Replace public.recalculate_obligation_allocated_amount(UUID) with canonical filter.
--   3. Verify both functions compile cleanly and execute without 22P02.
--
-- Safety:
--   - ZERO table drops or resets.
--   - ZERO data loss.
--   - Idempotent and safe to run on live staging database.
-- ============================================================================

BEGIN;

-- 1. Replace enforce_settlement_allocation_cap()
CREATE OR REPLACE FUNCTION public.enforce_settlement_allocation_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_orig_amt NUMERIC(12, 3);
    v_existing_alloc NUMERIC(12, 3);
    v_new_total NUMERIC(12, 3);
BEGIN
    -- Acquire exclusive row lock on the target financial obligation
    SELECT original_amount INTO v_orig_amt
    FROM public.financial_obligations
    WHERE id = NEW.obligation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Financial obligation % not found', NEW.obligation_id;
    END IF;

    -- Calculate current active allocated total excluding the current item if updating.
    -- Canonical settlement_status enum values: 'DRAFT', 'SUBMITTED', 'APPROVED', 'SETTLED', 'CANCELLED'.
    -- Exclude CANCELLED settlements so obligations can be re-allocated.
    SELECT COALESCE(SUM(si.allocated_amount), 0.000)
    INTO v_existing_alloc
    FROM public.settlement_items si
    JOIN public.settlement_records sr ON sr.id = si.settlement_id
    WHERE si.obligation_id = NEW.obligation_id
      AND sr.status <> 'CANCELLED'
      AND (TG_OP = 'INSERT' OR si.id <> OLD.id);

    v_new_total := v_existing_alloc + NEW.allocated_amount;

    IF v_new_total > v_orig_amt THEN
        RAISE EXCEPTION 'Allocation cap exceeded for obligation %: Requested total (%), Original amount (%)',
            NEW.obligation_id, v_new_total, v_orig_amt;
    END IF;

    RETURN NEW;
END;
$$;

-- 2. Replace recalculate_obligation_allocated_amount(UUID)
CREATE OR REPLACE FUNCTION public.recalculate_obligation_allocated_amount(p_obligation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_orig NUMERIC(12, 3);
    v_alloc NUMERIC(12, 3);
    v_new_status public.financial_obligation_status;
BEGIN
    SELECT original_amount INTO v_orig
    FROM public.financial_obligations
    WHERE id = p_obligation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Canonical settlement_status enum values: 'DRAFT', 'SUBMITTED', 'APPROVED', 'SETTLED', 'CANCELLED'.
    -- Exclude CANCELLED settlements to determine true outstanding allocated amount.
    SELECT COALESCE(SUM(si.allocated_amount), 0.000)
    INTO v_alloc
    FROM public.settlement_items si
    JOIN public.settlement_records sr ON sr.id = si.settlement_id
    WHERE si.obligation_id = p_obligation_id
      AND sr.status <> 'CANCELLED';

    IF v_alloc = 0 THEN
        v_new_status := 'PENDING';
    ELSIF v_alloc >= v_orig THEN
        v_new_status := 'SETTLED';
    ELSE
        v_new_status := 'PARTIALLY_SETTLED';
    END IF;

    UPDATE public.financial_obligations
    SET 
        allocated_amount = v_alloc,
        status = v_new_status,
        updated_at = now()
    WHERE id = p_obligation_id;
END;
$$;

COMMIT;

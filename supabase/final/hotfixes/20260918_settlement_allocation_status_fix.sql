-- ============================================================================
-- DELIVERE ENTERPRISE — TARGETED DATABASE HOTFIX
-- TARGET ENVIRONMENT: DEVELOPMENT_STAGING / SUPABASE SQL EDITOR
-- SCRIPT ID: 20260918_settlement_allocation_status_fix.sql
--
-- DESCRIPTION:
-- Targeted, non-destructive, transaction-wrapped hotfix to repair the installed
-- public.enforce_settlement_allocation_cap() trigger function.
--
-- ROOT CAUSE:
-- The database function in the installed staging database contained a predicate:
--   sr.status NOT IN ('CANCELLED', 'REVERSED')
-- Because 'REVERSED' is not a member of public.settlement_status enum ('DRAFT',
-- 'SUBMITTED', 'APPROVED', 'SETTLED', 'CANCELLED'), PostgreSQL raised ERROR 22P02.
--
-- CANONICAL FIX:
-- Replace the predicate with:
--   sr.status <> 'CANCELLED'
--
-- CONSTRAINTS & PRESERVATION:
-- - Preserves exact function signature: public.enforce_settlement_allocation_cap()
-- - Preserves SECURITY DEFINER behavior
-- - Preserves search_path = public, pg_temp
-- - Preserves all existing grants and revocations
-- - ZERO table drops, zero data deletion, zero database resets
-- - Wrapped in a transactional BEGIN ... COMMIT block for atomic staging deployment
-- ============================================================================

BEGIN;

-- 1. Redefine public.enforce_settlement_allocation_cap() with canonical predicate
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
    -- Exclude CANCELLED settlements so voided allocations do not consume obligation cap.
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

-- 2. Ensure public.recalculate_obligation_allocated_amount(UUID) is also aligned
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

-- 3. Preserve Security and Permissions
REVOKE EXECUTE ON FUNCTION public.enforce_settlement_allocation_cap() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_obligation_allocated_amount(UUID) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_obligation_allocated_amount(UUID) TO service_role;

COMMIT;

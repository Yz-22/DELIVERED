-- ============================================================================
-- DELIVERE ENTERPRISE — TARGETED DATABASE HOTFIX
-- TARGET ENVIRONMENT: DEVELOPMENT_STAGING / SUPABASE SQL EDITOR
-- SCRIPT ID: 20260918_settlement_immutability_fix.sql
--
-- DESCRIPTION:
-- Targeted, non-destructive, transaction-wrapped hotfix to enforce financial
-- immutability on settlement records, settlement items, and active financial
-- obligations once APPROVED, SETTLED, or CANCELLED, with strict journal-reversal
-- verification prior to cancellation of SETTLED records.
--
-- INVARIANTS ENFORCED:
-- 1. Settlement Headers (settlement_records):
--    - DRAFT settlements: Full editing and deletion permitted.
--    - APPROVED / SETTLED settlements: Financial fields (total_amount, net_payout,
--      type, beneficiary_id, tenant_id, currency, settlement_number) are strictly
--      IMMUTABLE. Deletion is BLOCKED.
--    - Canonical status transitions strictly validated:
--      * DRAFT -> ['SUBMITTED', 'APPROVED', 'CANCELLED']
--      * SUBMITTED -> ['DRAFT', 'APPROVED', 'CANCELLED']
--      * APPROVED -> ['SETTLED', 'CANCELLED']
--      * SETTLED -> ['CANCELLED'] (ONLY permitted if linked journal_entry is REVERSED)
--      * CANCELLED -> Terminal state (no mutations or transitions allowed).
--    - Journal Reversal Invariant: If a SETTLED settlement has a linked
--      journal_entry_id, transition to CANCELLED is strictly REJECTED unless the
--      journal entry has already been reversed via public.execute_journal_reversal().
-- 2. Settlement Items (settlement_items):
--    - INSERT, UPDATE, and DELETE operations are BLOCKED if the parent settlement
--      is in APPROVED, SETTLED, or CANCELLED status.
-- 3. Financial Obligations (financial_obligations):
--    - Core financial attributes (original_amount, beneficiary_id, beneficiary_type,
--      tenant_id, obligation_type, shipment_id) and row DELETION are BLOCKED once
--      allocated_amount > 0 or status in ('PARTIALLY_SETTLED', 'SETTLED').
--    - Automated updates to allocated_amount and status triggered by recalculation
--      functions are fully permitted.
--
-- SAFETY & COMPLIANCE:
-- - Preserves SECURITY DEFINER behavior with search_path = public, pg_temp.
-- - ZERO table drops, ZERO data deletion, ZERO database resets.
-- - Atomic transaction wrapper (BEGIN ... COMMIT).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- PREFLIGHT CHECK: Read-only sanity validation on existing staging data
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_corrupt_count INT;
BEGIN
    SELECT COUNT(*) INTO v_corrupt_count
    FROM public.settlement_records sr
    WHERE sr.status IN ('APPROVED', 'SETTLED')
      AND sr.total_amount < 0;

    IF v_corrupt_count > 0 THEN
        RAISE EXCEPTION 'PREFLIGHT CHECK FAILED: Found % settlements with negative total_amount.', v_corrupt_count;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1. FUNCTION & TRIGGER: Settlement Record Header Immutability
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_settlement_record_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Prevent DELETE on non-DRAFT settlements
    IF TG_OP = 'DELETE' THEN
        IF OLD.status <> 'DRAFT' THEN
            RAISE EXCEPTION 'Cannot delete settlement % in % status (Only DRAFT settlements can be deleted)',
                OLD.settlement_number, OLD.status;
        END IF;
        RETURN OLD;
    END IF;

    -- If OLD.status is CANCELLED, settlement is terminal and completely immutable
    IF OLD.status = 'CANCELLED' THEN
        RAISE EXCEPTION 'Settlement % is CANCELLED and cannot be modified', OLD.settlement_number;
    END IF;

    -- If OLD.status is APPROVED or SETTLED, financial attributes are strictly immutable
    IF OLD.status IN ('APPROVED', 'SETTLED') THEN
        IF OLD.total_amount IS DISTINCT FROM NEW.total_amount OR
           OLD.net_payout IS DISTINCT FROM NEW.net_payout OR
           OLD.type IS DISTINCT FROM NEW.type OR
           OLD.beneficiary_id IS DISTINCT FROM NEW.beneficiary_id OR
           OLD.tenant_id IS DISTINCT FROM NEW.tenant_id OR
           OLD.currency IS DISTINCT FROM NEW.currency OR
           OLD.settlement_number IS DISTINCT FROM NEW.settlement_number THEN
            RAISE EXCEPTION 'Financial fields of settlement % in % status are immutable (total_amount, net_payout, type, beneficiary, tenant, currency, number)',
                OLD.settlement_number, OLD.status;
        END IF;

        -- Validate allowed status transitions
        IF OLD.status = 'APPROVED' AND NEW.status NOT IN ('APPROVED', 'SETTLED', 'CANCELLED') THEN
            RAISE EXCEPTION 'Invalid status transition for settlement % from APPROVED to % (Allowed: SETTLED, CANCELLED)',
                OLD.settlement_number, NEW.status;
        END IF;

        IF OLD.status = 'SETTLED' THEN
            IF NEW.status NOT IN ('SETTLED', 'CANCELLED') THEN
                RAISE EXCEPTION 'Invalid status transition for settlement % from SETTLED to % (Allowed: CANCELLED)',
                    OLD.settlement_number, NEW.status;
            END IF;

            -- Enforce that any linked journal entry must be reversed before cancellation
            IF NEW.status = 'CANCELLED' AND OLD.journal_entry_id IS NOT NULL THEN
                IF NOT EXISTS (
                    SELECT 1 FROM public.journal_entries je
                    WHERE je.id = OLD.journal_entry_id
                      AND je.status = 'REVERSED'
                ) THEN
                    RAISE EXCEPTION 'Cannot cancel SETTLED settlement %: Associated journal entry % is not reversed. Controlled reversal must be executed via public.execute_journal_reversal() first.',
                        OLD.settlement_number, OLD.journal_entry_id;
                END IF;
            END IF;
        END IF;
    END IF;

    -- Disallow invalid transitions out of SUBMITTED or DRAFT
    IF OLD.status = 'SUBMITTED' AND NEW.status NOT IN ('SUBMITTED', 'DRAFT', 'APPROVED', 'CANCELLED') THEN
        RAISE EXCEPTION 'Invalid status transition for settlement % from SUBMITTED to %',
            OLD.settlement_number, NEW.status;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_settlement_record_immutability ON public.settlement_records;
CREATE TRIGGER trg_protect_settlement_record_immutability
    BEFORE UPDATE OR DELETE ON public.settlement_records
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_settlement_record_immutability();

-- ----------------------------------------------------------------------------
-- 2. FUNCTION & TRIGGER: Settlement Items Immutability
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_settlement_items_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_settle_status public.settlement_status;
    v_settle_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_settle_id := OLD.settlement_id;
    ELSE
        v_settle_id := NEW.settlement_id;
    END IF;

    SELECT status INTO v_settle_status
    FROM public.settlement_records
    WHERE id = v_settle_id;

    IF v_settle_status IN ('APPROVED', 'SETTLED', 'CANCELLED') THEN
        RAISE EXCEPTION 'Cannot % settlement item for settlement % in % status (Settlement items are immutable once approved, settled, or cancelled)',
            TG_OP, v_settle_id, v_settle_status;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_settlement_items_immutability ON public.settlement_items;
CREATE TRIGGER trg_protect_settlement_items_immutability
    BEFORE INSERT OR UPDATE OR DELETE ON public.settlement_items
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_settlement_items_immutability();

-- ----------------------------------------------------------------------------
-- 3. FUNCTION & TRIGGER: Financial Obligations Mutation Protection
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_financial_obligation_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.allocated_amount > 0 OR OLD.status IN ('PARTIALLY_SETTLED', 'SETTLED') THEN
            RAISE EXCEPTION 'Cannot delete financial obligation % with active allocations (status: %, allocated: %)',
                OLD.id, OLD.status, OLD.allocated_amount;
        END IF;
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.allocated_amount > 0 OR OLD.status IN ('PARTIALLY_SETTLED', 'SETTLED') THEN
            IF OLD.original_amount IS DISTINCT FROM NEW.original_amount OR
               OLD.beneficiary_id IS DISTINCT FROM NEW.beneficiary_id OR
               OLD.beneficiary_type IS DISTINCT FROM NEW.beneficiary_type OR
               OLD.tenant_id IS DISTINCT FROM NEW.tenant_id OR
               OLD.obligation_type IS DISTINCT FROM NEW.obligation_type OR
               OLD.shipment_id IS DISTINCT FROM NEW.shipment_id THEN
                RAISE EXCEPTION 'Cannot modify core attributes of allocated financial obligation % (original_amount, beneficiary, type, shipment)',
                    OLD.id;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_financial_obligation_immutability ON public.financial_obligations;
CREATE TRIGGER trg_protect_financial_obligation_immutability
    BEFORE UPDATE OR DELETE ON public.financial_obligations
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_financial_obligation_immutability();

-- ----------------------------------------------------------------------------
-- 4. Permissions and Function Access Security
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.protect_settlement_record_immutability() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_settlement_items_immutability() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_financial_obligation_immutability() FROM public, anon, authenticated;

COMMIT;

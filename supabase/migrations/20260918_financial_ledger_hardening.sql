-- ==============================================================================
-- Delivere Logistics & Enterprise TMS/POS
-- Migration: 20260918_financial_ledger_hardening.sql
-- Name: Phase E — Authoritative Double-Entry Financial Ledger Hardening (Revision 3.1)
-- Architecture: Complete Posted Journal Immutability + NOT VALID Backward Compatibility + Controlled Reversal Engine
-- Double-Entry Balance Verification, JOD 3-Decimal Precision, & Zero Direct Header Mutation
-- NO DATA MODIFICATION OR PRODUCTION APPLICATION IN THIS STEP
-- ==============================================================================

-- 1. EXTEND JOURNAL ENTRIES WITH BRANCH DIMENSION, REVERSAL AUDIT, & SAFE POSTING STATUS
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.merchant_branches(id) ON DELETE SET NULL;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'JOD';
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS posting_status TEXT NOT NULL DEFAULT 'LEGACY_UNVERIFIED' CHECK (posting_status IN ('LEGACY_UNVERIFIED', 'DRAFT', 'POSTED', 'REVERSED'));
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS is_posted BOOLEAN DEFAULT NULL; -- Nullable: No automatic retroactive verification
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS is_reversed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS reversal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS total_debit NUMERIC(12, 3) NOT NULL DEFAULT 0.000;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS total_credit NUMERIC(12, 3) NOT NULL DEFAULT 0.000;
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ DEFAULT NULL; -- Nullable: Set only on explicit posting

CREATE INDEX IF NOT EXISTS idx_journal_entries_branch_id ON public.journal_entries(branch_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_reference ON public.journal_entries(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_posting_status ON public.journal_entries(posting_status);
CREATE INDEX IF NOT EXISTS idx_journal_entries_is_reversed ON public.journal_entries(is_reversed);

-- 2. EXTEND JOURNAL LINES WITH 3-DECIMAL MONEY PRECISION, LINE ORDER, & NOT VALID SANITY CONSTRAINTS
-- Uses NOT VALID to ensure pre-existing legacy lines do not abort DDL execution
ALTER TABLE public.journal_lines ADD COLUMN IF NOT EXISTS line_order INTEGER DEFAULT 0;
ALTER TABLE public.journal_lines ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'JOD';
ALTER TABLE public.journal_lines ADD COLUMN IF NOT EXISTS entity_type TEXT; -- 'MERCHANT', 'DRIVER', 'CUSTOMER'
ALTER TABLE public.journal_lines ADD COLUMN IF NOT EXISTS entity_id UUID;
ALTER TABLE public.journal_lines ALTER COLUMN debit TYPE NUMERIC(12, 3);
ALTER TABLE public.journal_lines ALTER COLUMN credit TYPE NUMERIC(12, 3);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entity ON public.journal_lines(entity_type, entity_id);

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_journal_lines_debit_nonneg') THEN
        ALTER TABLE public.journal_lines ADD CONSTRAINT chk_journal_lines_debit_nonneg CHECK (debit >= 0) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_journal_lines_credit_nonneg') THEN
        ALTER TABLE public.journal_lines ADD CONSTRAINT chk_journal_lines_credit_nonneg CHECK (credit >= 0) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_journal_lines_not_both_positive') THEN
        ALTER TABLE public.journal_lines ADD CONSTRAINT chk_journal_lines_not_both_positive CHECK (NOT (debit > 0 AND credit > 0)) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_journal_lines_has_amount') THEN
        ALTER TABLE public.journal_lines ADD CONSTRAINT chk_journal_lines_has_amount CHECK (debit > 0 OR credit > 0) NOT VALID;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 3. EXTEND VOUCHERS WITH BRANCH DIMENSION & SAFE LEGACY CLASSIFICATION (NO BLIND POSTING)
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.merchant_branches(id) ON DELETE SET NULL;
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'JOD';
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'LEGACY_UNVERIFIED' CHECK (status IN ('LEGACY_UNVERIFIED', 'DRAFT', 'POSTED', 'CANCELLED', 'REVERSED'));
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS contra_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS reference_type TEXT;
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS reference_id TEXT;
ALTER TABLE public.vouchers ALTER COLUMN amount TYPE NUMERIC(12, 3);
CREATE INDEX IF NOT EXISTS idx_vouchers_branch_id ON public.vouchers(branch_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_status ON public.vouchers(status);

-- 4. FUNCTION & TRIGGER: ENFORCE MATHEMATICAL DOUBLE-ENTRY BALANCE BEFORE POSTING
CREATE OR REPLACE FUNCTION public.check_journal_posting_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_total_debit NUMERIC(12, 3);
    v_total_credit NUMERIC(12, 3);
    v_line_count INTEGER;
BEGIN
    -- Only enforce balance check when transitioning to POSTED
    IF NEW.posting_status = 'POSTED' AND (OLD.posting_status IS NULL OR OLD.posting_status <> 'POSTED') THEN
        SELECT 
            COALESCE(SUM(ROUND(debit, 3)), 0.000),
            COALESCE(SUM(ROUND(credit, 3)), 0.000),
            COUNT(*)
        INTO v_total_debit, v_total_credit, v_line_count
        FROM public.journal_lines
        WHERE entry_id = NEW.id;

        IF v_line_count < 2 THEN
            RAISE EXCEPTION 'Cannot post Journal Entry %: Minimum 2 journal lines required.', NEW.id;
        END IF;

        IF ABS(v_total_debit - v_total_credit) > 0.0001 THEN
            RAISE EXCEPTION 'Cannot post Journal Entry %: Mathematical imbalance detected. Total Debit: %, Total Credit: %',
                NEW.id, v_total_debit, v_total_credit;
        END IF;

        NEW.total_debit := v_total_debit;
        NEW.total_credit := v_total_credit;
        NEW.is_posted := TRUE;
        NEW.posted_at := COALESCE(NEW.posted_at, NOW());
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_journal_posting_balance ON public.journal_entries;
CREATE TRIGGER trg_check_journal_posting_balance
    BEFORE UPDATE OR INSERT ON public.journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.check_journal_posting_balance();

-- 5. FUNCTION & TRIGGER: ABSOLUTE IMMUTABILITY OF POSTED AND REVERSED JOURNAL ENTRIES AND LINES
CREATE OR REPLACE FUNCTION public.prevent_posted_journal_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_entry_status TEXT;
    v_entry_id UUID;
BEGIN
    IF TG_TABLE_NAME = 'journal_entries' THEN
        -- Prevent DELETE of POSTED or REVERSED entries
        IF TG_OP = 'DELETE' AND OLD.posting_status IN ('POSTED', 'REVERSED') THEN
            RAISE EXCEPTION 'Posted or Reversed Journal Entry % is permanently immutable and cannot be deleted.', OLD.id;
        END IF;

        -- Prevent UPDATE of POSTED or REVERSED entries
        IF TG_OP = 'UPDATE' AND OLD.posting_status IN ('POSTED', 'REVERSED') THEN
            -- Disallow status downgrade (POSTED -> DRAFT or POSTED -> LEGACY_UNVERIFIED)
            IF OLD.posting_status = 'POSTED' AND NEW.posting_status NOT IN ('POSTED', 'REVERSED') THEN
                RAISE EXCEPTION 'Posted Journal Entry % cannot be downgraded to status "%".', OLD.id, NEW.posting_status;
            END IF;

            IF OLD.posting_status = 'REVERSED' AND NEW.posting_status <> 'REVERSED' THEN
                RAISE EXCEPTION 'Reversed Journal Entry % status is terminal and immutable.', OLD.id;
            END IF;

            -- Check all accounting-significant header fields
            IF (OLD.tenant_id <> NEW.tenant_id OR 
                COALESCE(OLD.branch_id, '00000000-0000-0000-0000-000000000000'::uuid) <> COALESCE(NEW.branch_id, '00000000-0000-0000-0000-000000000000'::uuid) OR
                OLD.date <> NEW.date OR 
                OLD.entry_number <> NEW.entry_number OR
                OLD.currency <> NEW.currency OR
                COALESCE(OLD.reference_type, '') <> COALESCE(NEW.reference_type, '') OR
                COALESCE(OLD.reference_id, '') <> COALESCE(NEW.reference_id, '') OR
                COALESCE(OLD.description, '') <> COALESCE(NEW.description, '') OR
                OLD.total_debit <> NEW.total_debit OR
                OLD.total_credit <> NEW.total_credit OR
                OLD.posted_at <> NEW.posted_at OR
                COALESCE(OLD.idempotency_key, '') <> COALESCE(NEW.idempotency_key, '')) THEN
                RAISE EXCEPTION 'Posted Journal Entry % header is strictly immutable. Field modifications are prohibited.', OLD.id;
            END IF;

            -- Only permit reversal linkage transition (POSTED -> REVERSED with valid reversal_entry_id)
            IF OLD.posting_status = 'POSTED' AND NEW.posting_status = 'REVERSED' THEN
                IF NEW.is_reversed <> TRUE OR NEW.reversal_entry_id IS NULL THEN
                    RAISE EXCEPTION 'Reversing Journal Entry % requires is_reversed = TRUE and a valid reversal_entry_id.', OLD.id;
                END IF;
            END IF;
        END IF;

        RETURN COALESCE(NEW, OLD);

    ELSIF TG_TABLE_NAME = 'journal_lines' THEN
        v_entry_id := COALESCE(NEW.entry_id, OLD.entry_id);

        SELECT posting_status INTO v_entry_status 
        FROM public.journal_entries 
        WHERE id = v_entry_id;

        IF v_entry_status IN ('POSTED', 'REVERSED') THEN
            RAISE EXCEPTION 'Journal lines belonging to % Journal Entry % are strictly immutable (% blocked). Adjustments require a reversal entry.',
                v_entry_status, v_entry_id, TG_OP;
        END IF;

        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_posted_journal_entry_immutability ON public.journal_entries;
CREATE TRIGGER trg_posted_journal_entry_immutability
    BEFORE UPDATE OR DELETE ON public.journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_posted_journal_mutation();

DROP TRIGGER IF EXISTS trg_posted_journal_line_immutability ON public.journal_lines;
CREATE TRIGGER trg_posted_journal_line_immutability
    BEFORE INSERT OR UPDATE OR DELETE ON public.journal_lines
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_posted_journal_mutation();

-- 6. HARDENED AUTHORITATIVE JOURNAL ENTRY REVERSAL ENGINE
-- Atomic transaction: Creates opposite lines, posts reversal entry, links original entry
CREATE OR REPLACE FUNCTION public.execute_journal_entry_reversal(
    p_entry_id UUID,
    p_reversed_by UUID,
    p_reason TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_orig RECORD;
    v_new_entry_id UUID;
    v_new_entry_num TEXT;
    v_line RECORD;
BEGIN
    IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
        RAISE EXCEPTION 'Journal entry reversal requires an audit reason (minimum 5 characters).';
    END IF;

    -- 1. Lock original entry and verify POSTED status
    SELECT * INTO v_orig 
    FROM public.journal_entries 
    WHERE id = p_entry_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Journal Entry % not found.', p_entry_id;
    END IF;

    IF v_orig.posting_status <> 'POSTED' THEN
        RAISE EXCEPTION 'Cannot reverse Journal Entry % with status "%" (must be POSTED).', p_entry_id, v_orig.posting_status;
    END IF;

    IF v_orig.is_reversed = TRUE THEN
        RAISE EXCEPTION 'Journal Entry % has already been reversed by Entry %.', p_entry_id, v_orig.reversal_entry_id;
    END IF;

    -- 2. Generate unique reversal entry number
    v_new_entry_id := uuid_generate_v4();
    v_new_entry_num := 'REV-' || v_orig.entry_number;

    -- 3. Create reversal entry header in DRAFT first to populate lines
    INSERT INTO public.journal_entries (
        id, tenant_id, branch_id, entry_number, date, description, 
        reference_type, reference_id, posting_status, currency, 
        total_debit, total_credit, created_at
    ) VALUES (
        v_new_entry_id, v_orig.tenant_id, v_orig.branch_id, v_new_entry_num, CURRENT_DATE,
        'عكس القيد ' || v_orig.entry_number || ': ' || trim(p_reason),
        'REVERSAL', v_orig.id::TEXT, 'DRAFT', v_orig.currency,
        v_orig.total_credit, v_orig.total_debit, NOW()
    );

    -- 4. Replicate lines with inverted debit and credit
    FOR v_line IN 
        SELECT * FROM public.journal_lines WHERE entry_id = p_entry_id ORDER BY line_order ASC
    LOOP
        INSERT INTO public.journal_lines (
            entry_id, account_id, debit, credit, description, entity_type, entity_id, line_order, currency
        ) VALUES (
            v_new_entry_id, v_line.account_id, v_line.credit, v_line.debit,
            'عكس: ' || COALESCE(v_line.description, ''), v_line.entity_type, v_line.entity_id, v_line.line_order, v_line.currency
        );
    END LOOP;

    -- 5. Transition reversal entry to POSTED (Triggers balance validation)
    UPDATE public.journal_entries
    SET posting_status = 'POSTED',
        posted_at = NOW()
    WHERE id = v_new_entry_id;

    -- 6. Link and mark original entry as REVERSED
    UPDATE public.journal_entries 
    SET is_reversed = TRUE,
        reversal_entry_id = v_new_entry_id,
        posting_status = 'REVERSED'
    WHERE id = p_entry_id;

    RETURN jsonb_build_object(
        'success', true,
        'original_entry_id', p_entry_id,
        'reversal_entry_id', v_new_entry_id,
        'reversal_entry_number', v_new_entry_num,
        'status', 'REVERSED'
    );
END;
$$;

-- 7. STRICT EXECUTION GRANTS: Service Role Only
REVOKE ALL ON FUNCTION public.execute_journal_entry_reversal(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.execute_journal_entry_reversal(UUID, UUID, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_journal_entry_reversal(UUID, UUID, TEXT) TO service_role;

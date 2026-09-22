-- ============================================================================
-- DELIVERE ENTERPRISE — TARGETED DATABASE HOTFIX
-- TARGET ENVIRONMENT: DEVELOPMENT_STAGING / SUPABASE SQL EDITOR
-- SCRIPT ID: 20260922_order_persistence_and_idempotency_hardening.sql
--
-- DESCRIPTION:
-- Step 6.3P.1: Authoritative Order Persistence, Concurrency & Idempotency Hardening.
-- Establishes PostgreSQL / Supabase as the single authoritative source of truth
-- for delivery orders (shipments), status history, payment methods, and
-- concurrent idempotent order registration.
--
-- INVARIANTS ENFORCED:
-- 1. Single Authoritative Truth:
--    - Canonical order registry resides in public.shipments.
--    - No in-memory/fallback mutations permitted.
-- 2. Concurrency & Idempotency:
--    - Deterministic transaction-scoped advisory locking via pg_advisory_xact_lock.
--    - Derived from (tenant_id, merchant_id, request_type, idempotency_key).
--    - Replay with identical payload returns committed order row without duplicate inserts.
--    - Replay with mismatched payload raises IDEMPOTENCY_REPLAY_MISMATCH.
--    - Defense-in-depth unique constraint uq_order_idempotency on:
--      (tenant_id, merchant_id, request_type, idempotency_key).
-- 3. Atomic Order Creation:
--    - Atomically creates public.shipments row and initial public.shipment_status_history row ('CREATED').
--    - NO shipment_leg created at registration (legs remain strictly governed by operational dispatch).
--    - NO custody events or premature financial postings created at registration.
-- 4. Payment & CliQ Storage:
--    - Add payment_method and cliq_reference to public.shipments.
--    - Preserves existing public.payment_type ('COD', 'PREPAID', 'POSTPAID').
--    - CliQ is represented as payment_type = 'PREPAID', payment_method = 'CLIQ'.
--    - Zero cash custody for drivers on digital CliQ payments.
-- 5. Safe Sequence Generation:
--    - Dynamic sequence formatting ('ORD-YYYY-NNNN') with advisory lock / sequence counter.
-- 6. Canonical Jordan Phone Contract:
--    - Validates Jordan mobile prefix contract (077, 078, 079 / +96277, +96278, +96279).
--    - Normalizes storage strictly to +9627XXXXXXXX.
--    - Optional secondary phone validated with identical contract or persisted as NULL.
-- 7. Data Loss Protection:
--    - Full persistence of sub_area and reference_number.
-- 8. Security & Privilege Hardening:
--    - Functions run with SECURITY DEFINER and SET search_path = public, pg_temp.
--    - Public / anon / authenticated EXECUTE revoked targeting exact function signature.
--    - Strictly granted to service_role.
--    - Idempotency table protected with RLS and restricted to service_role.
--
-- SAFETY & COMPLIANCE:
-- - ZERO table drops, ZERO column drops, ZERO destructive operations.
-- - Atomic transaction wrapper (BEGIN ... COMMIT).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- PREFLIGHT CHECK: Verify core tables exist
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shipments') THEN
        RAISE EXCEPTION 'PREFLIGHT CHECK FAILED: public.shipments table does not exist.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shipment_status_history') THEN
        RAISE EXCEPTION 'PREFLIGHT CHECK FAILED: public.shipment_status_history table does not exist.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        RAISE EXCEPTION 'PREFLIGHT CHECK FAILED: public.users table does not exist.';
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1. Ensure Shipments Table has Complete Payment & Attribute Columns
-- ----------------------------------------------------------------------------
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS cliq_reference TEXT;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS reference_number TEXT;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS sub_area TEXT;

-- Safe additive backfill: preserve semantic integrity for historical rows
UPDATE public.shipments 
SET payment_method = CASE 
    WHEN payment_type = 'COD' THEN 'CASH'
    WHEN payment_type = 'PREPAID' THEN 'UNSPECIFIED'
    WHEN payment_type = 'POSTPAID' THEN 'UNSPECIFIED'
    ELSE 'CASH'
END
WHERE payment_method IS NULL;

-- Enforce default and NOT NULL constraint after safe backfill
ALTER TABLE public.shipments ALTER COLUMN payment_method SET DEFAULT 'CASH';
ALTER TABLE public.shipments ALTER COLUMN payment_method SET NOT NULL;

-- Indexes for queries and audit lookups
CREATE INDEX IF NOT EXISTS idx_shipments_payment_method 
    ON public.shipments (tenant_id, payment_method) WHERE payment_method <> 'CASH';

CREATE INDEX IF NOT EXISTS idx_shipments_reference_number 
    ON public.shipments (tenant_id, reference_number) WHERE reference_number IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. Order Idempotency Keys Table & Strict Access Control
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL,
    request_type TEXT NOT NULL DEFAULT 'ORDER_CREATE',
    idempotency_key TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    shipment_id UUID REFERENCES public.shipments(id) ON DELETE SET NULL,
    response_snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Enforce uniqueness strictly scoped by tenant, merchant, request type, and key
    CONSTRAINT uq_order_idempotency UNIQUE (tenant_id, merchant_id, request_type, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_order_idempotency_lookup 
    ON public.order_idempotency_keys (tenant_id, merchant_id, request_type, idempotency_key);

ALTER TABLE public.order_idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Drop permissive policies if any existed
DROP POLICY IF EXISTS order_idempotency_service_policy ON public.order_idempotency_keys;

-- Secure access: internal infrastructure restricted strictly to service_role
REVOKE ALL ON TABLE public.order_idempotency_keys FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.order_idempotency_keys TO service_role;

-- ----------------------------------------------------------------------------
-- 3. Atomic Idempotent Order Creation RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order_idempotent(
    p_tenant_id UUID,
    p_merchant_id UUID,
    p_branch_id UUID,
    p_request_type TEXT,
    p_idempotency_key TEXT,
    p_payload_hash TEXT,
    p_recipient_name TEXT,
    p_recipient_phone TEXT,
    p_recipient_phone2 TEXT,
    p_governorate TEXT,
    p_area TEXT,
    p_sub_area TEXT,
    p_address TEXT,
    p_package_details TEXT,
    p_notes TEXT,
    p_payment_type TEXT,
    p_payment_method TEXT,
    p_cliq_reference TEXT,
    p_weight NUMERIC,
    p_pieces INTEGER,
    p_reference_number TEXT,
    p_delivery_fee NUMERIC,
    p_merchant_collection NUMERIC,
    p_total_collection NUMERIC,
    p_actor_id UUID,
    p_actor_name TEXT,
    p_actor_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_lock_key BIGINT;
    v_existing RECORD;
    v_shipment_id UUID;
    v_year TEXT;
    v_prefix TEXT;
    v_sequence TEXT;
    v_seq_num BIGINT;
    v_status public.shipment_status := 'CREATED';
    v_created_shipment RECORD;
    v_response JSONB;
    v_cleaned_phone TEXT;
    v_cleaned_phone2 TEXT;
    v_norm_phone TEXT;
    v_norm_phone2 TEXT;
    v_payment_type TEXT;
    v_payment_method TEXT;
BEGIN
    -- 1. Input Validation
    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_TENANT: tenant_id cannot be null';
    END IF;
    IF p_merchant_id IS NULL THEN
        RAISE EXCEPTION 'INVALID_MERCHANT: merchant_id cannot be null';
    END IF;
    IF p_recipient_name IS NULL OR TRIM(p_recipient_name) = '' THEN
        RAISE EXCEPTION 'INVALID_RECIPIENT: recipient_name is required';
    END IF;
    IF p_recipient_phone IS NULL OR TRIM(p_recipient_phone) = '' THEN
        RAISE EXCEPTION 'INVALID_RECIPIENT_PHONE: recipient_phone is required';
    END IF;

    -- 2. Canonical Jordan Phone Validation & Normalization
    v_cleaned_phone := regexp_replace(TRIM(p_recipient_phone), '[\s-]', '', 'g');
    
    IF v_cleaned_phone ~ '^\+9627[789][0-9]{7}$' THEN
        v_norm_phone := v_cleaned_phone;
    ELSIF v_cleaned_phone ~ '^009627[789][0-9]{7}$' THEN
        v_norm_phone := '+962' || substr(v_cleaned_phone, 6);
    ELSIF v_cleaned_phone ~ '^9627[789][0-9]{7}$' THEN
        v_norm_phone := '+962' || substr(v_cleaned_phone, 4);
    ELSIF v_cleaned_phone ~ '^07[789][0-9]{7}$' THEN
        v_norm_phone := '+962' || substr(v_cleaned_phone, 2);
    ELSE
        RAISE EXCEPTION 'INVALID_RECIPIENT_PHONE: % is not a valid Jordanian mobile number (077/078/079)', p_recipient_phone;
    END IF;

    -- Optional Secondary Phone Validation
    IF p_recipient_phone2 IS NOT NULL AND TRIM(p_recipient_phone2) <> '' THEN
        v_cleaned_phone2 := regexp_replace(TRIM(p_recipient_phone2), '[\s-]', '', 'g');
        IF v_cleaned_phone2 ~ '^\+9627[789][0-9]{7}$' THEN
            v_norm_phone2 := v_cleaned_phone2;
        ELSIF v_cleaned_phone2 ~ '^009627[789][0-9]{7}$' THEN
            v_norm_phone2 := '+962' || substr(v_cleaned_phone2, 6);
        ELSIF v_cleaned_phone2 ~ '^9627[789][0-9]{7}$' THEN
            v_norm_phone2 := '+962' || substr(v_cleaned_phone2, 4);
        ELSIF v_cleaned_phone2 ~ '^07[789][0-9]{7}$' THEN
            v_norm_phone2 := '+962' || substr(v_cleaned_phone2, 2);
        ELSE
            RAISE EXCEPTION 'INVALID_SECONDARY_PHONE: % is not a valid Jordanian mobile number (077/078/079)', p_recipient_phone2;
        END IF;
    ELSE
        v_norm_phone2 := NULL;
    END IF;

    -- 3. Payment Contract & Defense-in-Depth Validation
    v_payment_type := COALESCE(NULLIF(TRIM(p_payment_type), ''), 'COD');
    v_payment_method := COALESCE(NULLIF(TRIM(p_payment_method), ''), 'CASH');

    IF v_payment_type = 'COD' AND v_payment_method = 'CLIQ' THEN
        RAISE EXCEPTION 'INVALID_PAYMENT_COMBINATION: COD cannot be paired with CLIQ';
    END IF;
    IF v_payment_type = 'PREPAID' AND v_payment_method = 'CASH' THEN
        RAISE EXCEPTION 'INVALID_PAYMENT_COMBINATION: PREPAID cannot be paired with CASH';
    END IF;

    -- 4. Transaction-Scoped Advisory Lock for Concurrency Protection
    -- Deterministically derive 64-bit transaction-scoped advisory lock: (tenant_id, merchant_id, request_type, idempotency_key)
    IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
        v_lock_key := ('x' || substr(md5(concat_ws(':', p_tenant_id::text, p_merchant_id::text, COALESCE(p_request_type, 'ORDER_CREATE'), TRIM(p_idempotency_key))), 1, 16))::bit(64)::bigint;
        PERFORM pg_advisory_xact_lock(v_lock_key);

        -- Query existing completed idempotency record under acquired lock
        SELECT * INTO v_existing
        FROM public.order_idempotency_keys
        WHERE tenant_id = p_tenant_id
          AND merchant_id = p_merchant_id
          AND request_type = COALESCE(p_request_type, 'ORDER_CREATE')
          AND idempotency_key = TRIM(p_idempotency_key);

        IF FOUND THEN
            IF v_existing.payload_hash = p_payload_hash THEN
                -- Exact replay: return cached committed response snapshot (sanitized, zero OTP)
                RETURN v_existing.response_snapshot;
            ELSE
                RAISE EXCEPTION 'IDEMPOTENCY_REPLAY_MISMATCH: Idempotency key % already used for a materially different order payload', p_idempotency_key;
            END IF;
        END IF;
    END IF;

    -- 5. Generate Sequence Number Safely for this Tenant & Current Year
    -- Derive calendar year dynamically from current transaction timestamp in Jordan timezone
    v_year := TO_CHAR(now() AT TIME ZONE 'Asia/Amman', 'YYYY');
    v_prefix := 'ORD-' || v_year || '-';

    -- Lock advisory key for tenant & year sequence to prevent concurrent sequence collisions
    PERFORM pg_advisory_xact_lock(('x' || substr(md5(concat_ws(':', p_tenant_id::text, 'SHIPMENT_SEQUENCE', v_year)), 1, 16))::bit(64)::bigint);

    -- Calculate next sequence scoped strictly to tenant and current year prefix
    SELECT COALESCE(MAX(SUBSTRING(sequence FROM '[0-9]+$')::BIGINT), 1000) + 1
    INTO v_seq_num
    FROM public.shipments
    WHERE tenant_id = p_tenant_id
      AND sequence LIKE (v_prefix || '%');

    v_sequence := v_prefix || LPAD(v_seq_num::text, 4, '0');
    v_shipment_id := gen_random_uuid();

    -- 6. Atomic Insert into public.shipments
    -- Canonical Invariant: Registration creates ZERO legs and driver_id = NULL.
    -- Authoritative driver assignment is managed strictly through operational dispatch / shipment_legs.
    -- OTP generation is disabled for this product phase (otp column defaults to NULL).
    INSERT INTO public.shipments (
        id,
        tenant_id,
        sequence,
        merchant_id,
        branch_id,
        driver_id,
        recipient_name,
        recipient_phone,
        recipient_phone2,
        governorate,
        area,
        sub_area,
        address,
        package_details,
        notes,
        status,
        payment_type,
        payment_method,
        cliq_reference,
        weight,
        pieces,
        reference_number,
        barcode,
        cod_amount,
        merchant_collection,
        delivery_fee,
        driver_fee,
        return_fee,
        extra_weight_fee,
        currency,
        created_at,
        updated_at
    ) VALUES (
        v_shipment_id,
        p_tenant_id,
        v_sequence,
        p_merchant_id,
        p_branch_id,
        NULL,
        TRIM(p_recipient_name),
        v_norm_phone,
        v_norm_phone2,
        COALESCE(NULLIF(TRIM(p_governorate), ''), 'عمان'),
        COALESCE(NULLIF(TRIM(p_area), ''), 'عمان'),
        NULLIF(TRIM(p_sub_area), ''),
        COALESCE(NULLIF(TRIM(p_address), ''), COALESCE(p_governorate, 'عمان') || ' - ' || COALESCE(p_area, 'عمان')),
        p_package_details,
        p_notes,
        v_status,
        COALESCE(v_payment_type::public.payment_type, 'COD'::public.payment_type),
        v_payment_method,
        NULLIF(TRIM(p_cliq_reference), ''),
        COALESCE(p_weight, 1.00),
        COALESCE(p_pieces, 1),
        NULLIF(TRIM(p_reference_number), ''),
        v_sequence,
        COALESCE(p_total_collection, 0.000),
        COALESCE(p_merchant_collection, 0.000),
        COALESCE(p_delivery_fee, 0.000),
        0.000,
        0.000,
        0.000,
        'JOD',
        now(),
        now()
    )
    RETURNING * INTO v_created_shipment;

    -- 7. Atomic Insert into public.shipment_status_history (Initial Audit Trail)
    INSERT INTO public.shipment_status_history (
        tenant_id,
        shipment_id,
        previous_status,
        new_status,
        actor_id,
        actor_name,
        actor_role,
        notes,
        created_at
    ) VALUES (
        p_tenant_id,
        v_shipment_id,
        NULL,
        v_status,
        p_actor_id,
        COALESCE(p_actor_name, 'النظام'),
        COALESCE(p_actor_role, 'OPERATOR'),
        'تم تسجيل الشحنة وإنشاؤها بنجاح في النظام',
        now()
    );

    -- 8. Build Standard Response Payload (Sanitized: zero OTP exposure, explicit allowlisted fields)
    v_response := jsonb_build_object(
        'success', true,
        'shipment_id', v_shipment_id,
        'sequence', v_sequence,
        'status', v_status,
        'payment_type', v_created_shipment.payment_type,
        'payment_method', v_created_shipment.payment_method,
        'cliq_reference', v_created_shipment.cliq_reference,
        'reference_number', v_created_shipment.reference_number,
        'cod_amount', v_created_shipment.cod_amount,
        'merchant_collection', v_created_shipment.merchant_collection,
        'delivery_fee', v_created_shipment.delivery_fee,
        'driver_fee', v_created_shipment.driver_fee,
        'created_at', v_created_shipment.created_at,
        'shipment', jsonb_build_object(
            'id', v_created_shipment.id,
            'sequence', v_created_shipment.sequence,
            'merchant_id', v_created_shipment.merchant_id,
            'branch_id', v_created_shipment.branch_id,
            'recipient_name', v_created_shipment.recipient_name,
            'recipient_phone', v_created_shipment.recipient_phone,
            'recipient_phone2', v_created_shipment.recipient_phone2,
            'governorate', v_created_shipment.governorate,
            'area', v_created_shipment.area,
            'sub_area', v_created_shipment.sub_area,
            'address', v_created_shipment.address,
            'package_details', v_created_shipment.package_details,
            'notes', v_created_shipment.notes,
            'status', v_created_shipment.status,
            'payment_type', v_created_shipment.payment_type,
            'payment_method', v_created_shipment.payment_method,
            'cliq_reference', v_created_shipment.cliq_reference,
            'reference_number', v_created_shipment.reference_number,
            'weight', v_created_shipment.weight,
            'pieces', v_created_shipment.pieces,
            'barcode', v_created_shipment.barcode,
            'cod_amount', v_created_shipment.cod_amount,
            'merchant_collection', v_created_shipment.merchant_collection,
            'delivery_fee', v_created_shipment.delivery_fee,
            'driver_fee', v_created_shipment.driver_fee,
            'currency', v_created_shipment.currency,
            'created_at', v_created_shipment.created_at,
            'updated_at', v_created_shipment.updated_at
        )
    );

    -- 9. Persist Idempotency Record if key provided
    IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
        INSERT INTO public.order_idempotency_keys (
            tenant_id,
            merchant_id,
            request_type,
            idempotency_key,
            payload_hash,
            shipment_id,
            response_snapshot,
            created_at
        ) VALUES (
            p_tenant_id,
            p_merchant_id,
            COALESCE(p_request_type, 'ORDER_CREATE'),
            TRIM(p_idempotency_key),
            p_payload_hash,
            v_shipment_id,
            v_response,
            now()
        );
    END IF;

    RETURN v_response;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Security & Privilege Hardening on RPC targeting exact argument signature
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_order_idempotent(
    UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, 
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, INTEGER, 
    TEXT, NUMERIC, NUMERIC, NUMERIC, UUID, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_order_idempotent(
    UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, 
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, INTEGER, 
    TEXT, NUMERIC, NUMERIC, NUMERIC, UUID, TEXT, TEXT
) TO service_role;

COMMIT;

-- ============================================================================
-- DELIVERE — PHASE 3C / STEP 1.2: TARGETED RPC TENANT-STATE HOTFIX
-- Migration Name: 20260922_phase3c_rpc_tenant_state_hotfix.sql
-- Status: PROPOSAL ONLY (DO NOT APPLY REMOTELY WITHOUT USER AUTHORIZATION)
--
-- Objective:
--   Safely CREATE OR REPLACE all 6 Phase 3C operational RPCs to fix the
--   tenant validation check:
--     Replaces non-existent `v_tenant.status = 'SUSPENDED'`
--     With canonical `NOT v_tenant.is_active`
--
-- Affected Functions:
--   1. public.execute_confirm_merchant_pickup
--   2. public.execute_confirm_facility_intake
--   3. public.execute_confirm_facility_release
--   4. public.execute_complete_customer_delivery
--   5. public.execute_record_delivery_failure
--   6. public.execute_seal_manifest
--
-- Security & Transactionality:
--   - Wrapped in atomic BEGIN ... COMMIT
--   - Search path pinned to public, pg_temp
--   - Preserves all idempotency, concurrency locks, financial and custody invariant logic
--   - Re-applies strict REVOKE from PUBLIC/anon/authenticated and GRANT to service_role
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. RPC: execute_confirm_merchant_pickup
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.execute_confirm_merchant_pickup(
    p_tenant_id UUID,
    p_actor_user_id UUID,
    p_shipment_id UUID,
    p_leg_id UUID,
    p_merchant_branch_id UUID DEFAULT NULL,
    p_evidence_barcode TEXT DEFAULT NULL,
    p_evidence_otp TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL,
    p_latitude NUMERIC DEFAULT NULL,
    p_longitude NUMERIC DEFAULT NULL,
    p_evidence_type public.custody_evidence_type DEFAULT 'BARCODE_SCAN'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tenant RECORD;
    v_actor RECORD;
    v_shipment RECORD;
    v_leg RECORD;
    v_custody RECORD;
    v_existing_event RECORD;
    v_event_id UUID;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_branch_id UUID;
BEGIN
    -- 1. Actor & Tenant Independent Validation
    SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'TENANT_NOT_FOUND: Tenant % does not exist', p_tenant_id USING ERRCODE = '42501';
    END IF;
    IF NOT v_tenant.is_active THEN
        RAISE EXCEPTION 'TENANT_SUSPENDED: Tenant % is suspended or inactive', p_tenant_id USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_actor FROM public.users WHERE id = p_actor_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ACTOR_NOT_FOUND: Actor % does not exist', p_actor_user_id USING ERRCODE = 'P0002';
    END IF;
    IF v_actor.is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'ACTOR_INACTIVE: Actor % is deactivated', p_actor_user_id USING ERRCODE = '42501';
    END IF;
    IF v_actor.tenant_id IS DISTINCT FROM p_tenant_id AND v_actor.role <> 'SUPER_ADMIN' THEN
        RAISE EXCEPTION 'ACTOR_TENANT_MISMATCH: Actor % does not belong to tenant %', p_actor_user_id, p_tenant_id USING ERRCODE = '42501';
    END IF;

    -- 2. Context-Verified Idempotency Replay
    IF p_idempotency_key IS NOT NULL THEN
        SELECT * INTO v_existing_event
        FROM public.custody_events
        WHERE tenant_id = p_tenant_id AND idempotency_key = p_idempotency_key;

        IF FOUND THEN
            IF v_existing_event.shipment_id IS DISTINCT FROM p_shipment_id OR
               v_existing_event.leg_id IS DISTINCT FROM p_leg_id OR
               v_existing_event.event_type <> 'HANDOFF' THEN
                RAISE EXCEPTION 'IDEMPOTENCY_REPLAY_MISMATCH: Idempotency key % already used for different context', p_idempotency_key
                    USING ERRCODE = '23505';
            END IF;
            RETURN jsonb_build_object(
                'success', true,
                'idempotent', true,
                'custody_event_id', v_existing_event.id,
                'message', 'Operation already processed'
            );
        END IF;
    END IF;

    -- 3. Deterministic Concurrency Locks: 1. Shipment -> 2. Leg -> 3. Custody
    SELECT * INTO v_shipment
    FROM public.shipments
    WHERE id = p_shipment_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'SHIPMENT_NOT_FOUND: Shipment % does not exist', p_shipment_id USING ERRCODE = 'P0002';
    END IF;
    IF v_shipment.status = 'CANCELLED' THEN
        RAISE EXCEPTION 'INVALID_SHIPMENT_STATE: Shipment % is cancelled', p_shipment_id USING ERRCODE = '23514';
    END IF;

    SELECT * INTO v_leg
    FROM public.shipment_legs
    WHERE id = p_leg_id AND shipment_id = p_shipment_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'LEG_NOT_FOUND: Leg % does not exist for shipment %', p_leg_id, p_shipment_id USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_custody
    FROM public.shipment_current_custody
    WHERE shipment_id = p_shipment_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    -- 4. Business Invariant Checks
    IF v_leg.leg_type NOT IN ('PICKUP', 'DIRECT') THEN
        RAISE EXCEPTION 'INVALID_LEG_TYPE: Merchant pickup requires PICKUP or DIRECT leg, got %', v_leg.leg_type USING ERRCODE = '23514';
    END IF;

    IF v_leg.status NOT IN ('READY', 'ASSIGNED', 'ACCEPTED') THEN
        RAISE EXCEPTION 'INVALID_LEG_STATE: Leg % cannot be picked up in status %', p_leg_id, v_leg.status USING ERRCODE = '23514';
    END IF;

    IF v_leg.assigned_driver_id IS NULL THEN
        RAISE EXCEPTION 'DRIVER_NOT_ASSIGNED: Leg % has no assigned driver', p_leg_id USING ERRCODE = '23514';
    END IF;

    v_branch_id := COALESCE(p_merchant_branch_id, v_leg.origin_merchant_branch_id);
    IF v_leg.origin_merchant_branch_id IS NOT NULL AND p_merchant_branch_id IS NOT NULL AND p_merchant_branch_id IS DISTINCT FROM v_leg.origin_merchant_branch_id THEN
        RAISE EXCEPTION 'BRANCH_MISMATCH: Requested branch % does not match leg origin branch %', p_merchant_branch_id, v_leg.origin_merchant_branch_id USING ERRCODE = '23514';
    END IF;

    IF v_custody.shipment_id IS NOT NULL THEN
        IF v_custody.current_holder_type <> 'MERCHANT' THEN
            RAISE EXCEPTION 'CUSTODY_MISMATCH: Shipment is in custody of %, not MERCHANT', v_custody.current_holder_type USING ERRCODE = '23514';
        END IF;
        IF v_custody.current_merchant_branch_id IS NOT NULL AND v_branch_id IS NOT NULL AND v_custody.current_merchant_branch_id IS DISTINCT FROM v_branch_id THEN
            RAISE EXCEPTION 'CUSTODY_BRANCH_MISMATCH: Shipment is at branch %, not %', v_custody.current_merchant_branch_id, v_branch_id USING ERRCODE = '23514';
        END IF;
    END IF;

    -- Actor authorization: must be assigned driver OR authorized operator/dispatcher/admin
    IF v_actor.role NOT IN ('ADMIN', 'SUPER_ADMIN', 'DISPATCHER', 'OPERATOR') AND v_actor.id <> v_leg.assigned_driver_id THEN
        RAISE EXCEPTION 'ACTOR_NOT_AUTHORIZED: Actor % is not assigned driver or authorized dispatcher', p_actor_user_id USING ERRCODE = '42501';
    END IF;

    -- Physical Evidence Validation
    IF p_evidence_type = 'BARCODE_SCAN' AND (p_evidence_barcode IS NULL OR trim(p_evidence_barcode) = '') THEN
        RAISE EXCEPTION 'EVIDENCE_REQUIRED: BARCODE_SCAN requires a non-empty barcode' USING ERRCODE = '23514';
    END IF;
    IF p_evidence_type = 'OTP_CODE' AND (p_evidence_otp IS NULL OR trim(p_evidence_otp) = '') THEN
        RAISE EXCEPTION 'EVIDENCE_REQUIRED: OTP_CODE requires a non-empty OTP' USING ERRCODE = '23514';
    END IF;

    -- 5. Atomic Mutations
    -- 5a. Append Custody Event (MERCHANT -> DRIVER)
    INSERT INTO public.custody_events (
        tenant_id, shipment_id, leg_id, event_type,
        from_merchant_branch_id, to_driver_id,
        performed_by_user_id, occurred_at,
        evidence_type, evidence_reference, notes,
        idempotency_key, created_at
    ) VALUES (
        p_tenant_id, p_shipment_id, p_leg_id, 'HANDOFF',
        v_branch_id, v_leg.assigned_driver_id,
        p_actor_user_id, v_now,
        p_evidence_type, COALESCE(p_evidence_barcode, p_evidence_otp), p_notes,
        COALESCE(p_idempotency_key, gen_random_uuid()::text), v_now
    ) RETURNING id INTO v_event_id;

    -- 5b. Update/Upsert Shipment Current Custody Projection
    INSERT INTO public.shipment_current_custody (
        shipment_id, tenant_id, current_holder_type,
        current_driver_id, current_facility_id, current_merchant_branch_id,
        is_with_customer, is_verified_custody, latest_custody_event_id,
        version, updated_at
    ) VALUES (
        p_shipment_id, p_tenant_id, 'DRIVER',
        v_leg.assigned_driver_id, NULL, NULL,
        false, true, v_event_id,
        1, v_now
    )
    ON CONFLICT (shipment_id) DO UPDATE SET
        current_holder_type = 'DRIVER',
        current_driver_id = v_leg.assigned_driver_id,
        current_facility_id = NULL,
        current_merchant_branch_id = NULL,
        is_with_customer = false,
        is_verified_custody = true,
        latest_custody_event_id = v_event_id,
        version = public.shipment_current_custody.version + 1,
        updated_at = v_now;

    -- 5c. Update Leg status
    UPDATE public.shipment_legs
    SET status = 'IN_TRANSIT',
        started_at = COALESCE(started_at, v_now),
        updated_at = v_now
    WHERE id = p_leg_id AND tenant_id = p_tenant_id;

    -- 5d. Update Shipment operational status (non-financial)
    UPDATE public.shipments
    SET status = 'OUT_FOR_DELIVERY',
        updated_at = v_now
    WHERE id = p_shipment_id AND tenant_id = p_tenant_id;

    -- 5e. Append Shipment Domain Event
    INSERT INTO public.shipment_events (
        tenant_id, shipment_id, leg_id, event_type,
        actor_user_id, actor_role, driver_id,
        occurred_at, idempotency_key, payload, created_at
    ) VALUES (
        p_tenant_id, p_shipment_id, p_leg_id, 'LEG_PICKUP_COMPLETED',
        p_actor_user_id, v_actor.role, v_leg.assigned_driver_id,
        v_now, COALESCE(p_idempotency_key, gen_random_uuid()::text) || ':evt',
        jsonb_build_object('custody_event_id', v_event_id, 'driver_id', v_leg.assigned_driver_id),
        v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'custody_event_id', v_event_id,
        'current_holder', 'DRIVER',
        'driver_id', v_leg.assigned_driver_id
    );
END;
$$;


-- ----------------------------------------------------------------------------
-- 2. RPC: execute_confirm_facility_intake
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.execute_confirm_facility_intake(
    p_tenant_id UUID,
    p_actor_user_id UUID,
    p_shipment_id UUID,
    p_leg_id UUID,
    p_facility_id UUID,
    p_driver_id UUID DEFAULT NULL,
    p_evidence_barcode TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL,
    p_latitude NUMERIC DEFAULT NULL,
    p_longitude NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tenant RECORD;
    v_actor RECORD;
    v_shipment RECORD;
    v_leg RECORD;
    v_custody RECORD;
    v_next_leg RECORD;
    v_existing_event RECORD;
    v_event_id UUID;
    v_from_driver_id UUID;
    v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
    -- 1. Actor & Tenant Validation
    SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'TENANT_NOT_FOUND: Tenant % does not exist', p_tenant_id USING ERRCODE = '42501';
    END IF;
    IF NOT v_tenant.is_active THEN
        RAISE EXCEPTION 'TENANT_SUSPENDED: Tenant % is suspended or inactive', p_tenant_id USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_actor FROM public.users WHERE id = p_actor_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ACTOR_NOT_FOUND: Actor % does not exist', p_actor_user_id USING ERRCODE = 'P0002';
    END IF;
    IF v_actor.is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'ACTOR_INACTIVE: Actor % is deactivated', p_actor_user_id USING ERRCODE = '42501';
    END IF;
    IF v_actor.tenant_id IS DISTINCT FROM p_tenant_id AND v_actor.role <> 'SUPER_ADMIN' THEN
        RAISE EXCEPTION 'ACTOR_TENANT_MISMATCH: Actor % does not belong to tenant %', p_actor_user_id, p_tenant_id USING ERRCODE = '42501';
    END IF;

    -- Actor Facility Access Check: user must have can_receive or be ADMIN / SUPER_ADMIN
    IF v_actor.role NOT IN ('ADMIN', 'SUPER_ADMIN') THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.user_facility_access
            WHERE user_id = p_actor_user_id AND facility_id = p_facility_id AND tenant_id = p_tenant_id AND can_receive = true
        ) THEN
            RAISE EXCEPTION 'ACTOR_FACILITY_ACCESS_DENIED: Actor % does not have intake access (can_receive) to facility %', p_actor_user_id, p_facility_id
                USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 2. Context-Verified Idempotency Replay
    IF p_idempotency_key IS NOT NULL THEN
        SELECT * INTO v_existing_event
        FROM public.custody_events
        WHERE tenant_id = p_tenant_id AND idempotency_key = p_idempotency_key;

        IF FOUND THEN
            IF v_existing_event.shipment_id IS DISTINCT FROM p_shipment_id OR
               v_existing_event.leg_id IS DISTINCT FROM p_leg_id OR
               v_existing_event.event_type <> 'INTAKE' OR
               v_existing_event.to_facility_id IS DISTINCT FROM p_facility_id THEN
                RAISE EXCEPTION 'IDEMPOTENCY_REPLAY_MISMATCH: Idempotency key % already used for different context', p_idempotency_key
                    USING ERRCODE = '23505';
            END IF;
            RETURN jsonb_build_object(
                'success', true,
                'idempotent', true,
                'custody_event_id', v_existing_event.id,
                'message', 'Operation already processed'
            );
        END IF;
    END IF;

    -- 3. Deterministic Concurrency Locks: 1. Shipment -> 2. Leg -> 3. Custody
    SELECT * INTO v_shipment
    FROM public.shipments
    WHERE id = p_shipment_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'SHIPMENT_NOT_FOUND: Shipment % does not exist', p_shipment_id USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_leg
    FROM public.shipment_legs
    WHERE id = p_leg_id AND shipment_id = p_shipment_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'LEG_NOT_FOUND: Leg % does not exist for shipment %', p_leg_id, p_shipment_id USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_custody
    FROM public.shipment_current_custody
    WHERE shipment_id = p_shipment_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    -- 4. Business Invariant Checks
    IF v_leg.destination_facility_id IS DISTINCT FROM p_facility_id THEN
        RAISE EXCEPTION 'DESTINATION_FACILITY_MISMATCH: Leg destination is %, not %', v_leg.destination_facility_id, p_facility_id
            USING ERRCODE = '23514';
    END IF;

    IF v_leg.status IN ('COMPLETED', 'CANCELLED', 'FAILED') THEN
        RAISE EXCEPTION 'INVALID_LEG_STATE: Cannot intake leg % in state %', p_leg_id, v_leg.status
            USING ERRCODE = '23514';
    END IF;

    IF v_custody.shipment_id IS NULL OR v_custody.current_holder_type <> 'DRIVER' OR v_custody.current_driver_id IS NULL THEN
        RAISE EXCEPTION 'CUSTODY_MISMATCH: Parcel is in custody of %, expected DRIVER', v_custody.current_holder_type
            USING ERRCODE = '23514';
    END IF;

    -- Defensive Driver Verification: FROM driver MUST equal locked canonical custody
    v_from_driver_id := v_custody.current_driver_id;
    IF p_driver_id IS NOT NULL AND p_driver_id IS DISTINCT FROM v_from_driver_id THEN
        RAISE EXCEPTION 'DRIVER_MISMATCH: Supplied driver % does not match actual custody driver %', p_driver_id, v_from_driver_id
            USING ERRCODE = '23514';
    END IF;

    -- 5. Atomic Mutations
    -- 5a. Append Custody Event (DRIVER -> FACILITY)
    INSERT INTO public.custody_events (
        tenant_id, shipment_id, leg_id, event_type,
        from_driver_id, to_facility_id,
        performed_by_user_id, occurred_at,
        evidence_type, evidence_reference, notes,
        idempotency_key, created_at
    ) VALUES (
        p_tenant_id, p_shipment_id, p_leg_id, 'INTAKE',
        v_from_driver_id, p_facility_id,
        p_actor_user_id, v_now,
        'BARCODE_SCAN', p_evidence_barcode, p_notes,
        COALESCE(p_idempotency_key, gen_random_uuid()::text), v_now
    ) RETURNING id INTO v_event_id;

    -- 5b. Update Shipment Current Custody Projection
    UPDATE public.shipment_current_custody
    SET current_holder_type = 'FACILITY',
        current_facility_id = p_facility_id,
        current_driver_id = NULL,
        current_merchant_branch_id = NULL,
        is_with_customer = false,
        is_verified_custody = true,
        latest_custody_event_id = v_event_id,
        version = version + 1,
        updated_at = v_now
    WHERE shipment_id = p_shipment_id AND tenant_id = p_tenant_id;

    -- 5c. Complete Current Leg
    UPDATE public.shipment_legs
    SET status = 'COMPLETED',
        completed_at = v_now,
        updated_at = v_now
    WHERE id = p_leg_id AND tenant_id = p_tenant_id;

    -- 5d. Advance next leg in sequence to READY if planned
    SELECT * INTO v_next_leg
    FROM public.shipment_legs
    WHERE shipment_id = p_shipment_id AND tenant_id = p_tenant_id AND sequence = v_leg.sequence + 1
    FOR UPDATE;

    IF FOUND AND v_next_leg.status = 'PLANNED' THEN
        UPDATE public.shipment_legs
        SET status = 'READY',
            updated_at = v_now
        WHERE id = v_next_leg.id;
    END IF;

    -- 5e. Append Domain Event
    INSERT INTO public.shipment_events (
        tenant_id, shipment_id, leg_id, event_type,
        actor_user_id, actor_role, facility_id, driver_id,
        occurred_at, idempotency_key, payload, created_at
    ) VALUES (
        p_tenant_id, p_shipment_id, p_leg_id, 'FACILITY_INTAKE_COMPLETED',
        p_actor_user_id, v_actor.role, p_facility_id, v_from_driver_id,
        v_now, COALESCE(p_idempotency_key, gen_random_uuid()::text) || ':evt',
        jsonb_build_object('custody_event_id', v_event_id, 'facility_id', p_facility_id),
        v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'custody_event_id', v_event_id,
        'current_holder', 'FACILITY',
        'facility_id', p_facility_id
    );
END;
$$;


-- ----------------------------------------------------------------------------
-- 3. RPC: execute_confirm_facility_release
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.execute_confirm_facility_release(
    p_tenant_id UUID,
    p_actor_user_id UUID,
    p_shipment_id UUID,
    p_leg_id UUID,
    p_facility_id UUID,
    p_target_driver_id UUID,
    p_evidence_barcode TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tenant RECORD;
    v_actor RECORD;
    v_target_driver RECORD;
    v_shipment RECORD;
    v_leg RECORD;
    v_custody RECORD;
    v_existing_event RECORD;
    v_event_id UUID;
    v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
    -- 1. Actor & Tenant Validation
    SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'TENANT_NOT_FOUND: Tenant % does not exist', p_tenant_id USING ERRCODE = '42501';
    END IF;
    IF NOT v_tenant.is_active THEN
        RAISE EXCEPTION 'TENANT_SUSPENDED: Tenant % is suspended or inactive', p_tenant_id USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_actor FROM public.users WHERE id = p_actor_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ACTOR_NOT_FOUND: Actor % does not exist', p_actor_user_id USING ERRCODE = 'P0002';
    END IF;
    IF v_actor.is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'ACTOR_INACTIVE: Actor % is deactivated', p_actor_user_id USING ERRCODE = '42501';
    END IF;
    IF v_actor.tenant_id IS DISTINCT FROM p_tenant_id AND v_actor.role <> 'SUPER_ADMIN' THEN
        RAISE EXCEPTION 'ACTOR_TENANT_MISMATCH: Actor % does not belong to tenant %', p_actor_user_id, p_tenant_id USING ERRCODE = '42501';
    END IF;

    -- Actor Facility Access Check: user must have can_dispatch or be ADMIN / SUPER_ADMIN
    IF v_actor.role NOT IN ('ADMIN', 'SUPER_ADMIN') THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.user_facility_access
            WHERE user_id = p_actor_user_id AND facility_id = p_facility_id AND tenant_id = p_tenant_id AND can_dispatch = true
        ) THEN
            RAISE EXCEPTION 'ACTOR_FACILITY_ACCESS_DENIED: Actor % does not have dispatch access (can_dispatch) to facility %', p_actor_user_id, p_facility_id
                USING ERRCODE = '42501';
        END IF;
    END IF;

    -- Target Driver Validation: must be active driver belonging to same tenant
    SELECT * INTO v_target_driver
    FROM public.users
    WHERE id = p_target_driver_id AND tenant_id = p_tenant_id;

    IF NOT FOUND OR v_target_driver.is_active IS NOT TRUE OR v_target_driver.role <> 'DRIVER' THEN
        RAISE EXCEPTION 'TARGET_DRIVER_INVALID: Driver % does not exist, is inactive, or is not a driver', p_target_driver_id
            USING ERRCODE = '23514';
    END IF;

    -- 2. Context-Verified Idempotency Replay
    IF p_idempotency_key IS NOT NULL THEN
        SELECT * INTO v_existing_event
        FROM public.custody_events
        WHERE tenant_id = p_tenant_id AND idempotency_key = p_idempotency_key;

        IF FOUND THEN
            IF v_existing_event.shipment_id IS DISTINCT FROM p_shipment_id OR
               v_existing_event.leg_id IS DISTINCT FROM p_leg_id OR
               v_existing_event.event_type <> 'OUTBOUND' OR
               v_existing_event.from_facility_id IS DISTINCT FROM p_facility_id OR
               v_existing_event.to_driver_id IS DISTINCT FROM p_target_driver_id THEN
                RAISE EXCEPTION 'IDEMPOTENCY_REPLAY_MISMATCH: Idempotency key % already used for different context', p_idempotency_key
                    USING ERRCODE = '23505';
            END IF;
            RETURN jsonb_build_object(
                'success', true,
                'idempotent', true,
                'custody_event_id', v_existing_event.id,
                'message', 'Operation already processed'
            );
        END IF;
    END IF;

    -- 3. Deterministic Concurrency Locks: 1. Shipment -> 2. Leg -> 3. Custody
    SELECT * INTO v_shipment
    FROM public.shipments
    WHERE id = p_shipment_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'SHIPMENT_NOT_FOUND: Shipment % does not exist', p_shipment_id USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_leg
    FROM public.shipment_legs
    WHERE id = p_leg_id AND shipment_id = p_shipment_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'LEG_NOT_FOUND: Leg % does not exist for shipment %', p_leg_id, p_shipment_id USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_custody
    FROM public.shipment_current_custody
    WHERE shipment_id = p_shipment_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    -- 4. Business Invariant Checks
    IF v_leg.assigned_driver_id IS NULL THEN
        RAISE EXCEPTION 'DRIVER_NOT_ASSIGNED: Leg % has no assigned driver; physical release requires pre-existing assignment', p_leg_id
            USING ERRCODE = '23514';
    END IF;

    IF v_leg.assigned_driver_id IS DISTINCT FROM p_target_driver_id THEN
        RAISE EXCEPTION 'DRIVER_MISMATCH: Target driver % does not match canonical assigned driver % on leg %', p_target_driver_id, v_leg.assigned_driver_id, p_leg_id
            USING ERRCODE = '23514';
    END IF;

    IF v_leg.origin_facility_id IS DISTINCT FROM p_facility_id THEN
        RAISE EXCEPTION 'ORIGIN_FACILITY_MISMATCH: Leg origin is %, not %', v_leg.origin_facility_id, p_facility_id
            USING ERRCODE = '23514';
    END IF;

    IF v_leg.status NOT IN ('READY', 'ASSIGNED', 'ACCEPTED') THEN
        RAISE EXCEPTION 'INVALID_LEG_STATE: Leg % cannot be released in status %', p_leg_id, v_leg.status
            USING ERRCODE = '23514';
    END IF;

    IF v_custody.shipment_id IS NULL OR v_custody.current_holder_type <> 'FACILITY' OR v_custody.current_facility_id IS DISTINCT FROM p_facility_id THEN
        RAISE EXCEPTION 'CUSTODY_MISMATCH: Shipment is not in custody of facility % (current holder: %)', p_facility_id, v_custody.current_holder_type
            USING ERRCODE = '23514';
    END IF;

    -- 5. Atomic Mutations
    -- 5a. Append Custody Event (FACILITY -> DRIVER)
    INSERT INTO public.custody_events (
        tenant_id, shipment_id, leg_id, event_type,
        from_facility_id, to_driver_id,
        performed_by_user_id, occurred_at,
        evidence_type, evidence_reference, notes,
        idempotency_key, created_at
    ) VALUES (
        p_tenant_id, p_shipment_id, p_leg_id, 'OUTBOUND',
        p_facility_id, p_target_driver_id,
        p_actor_user_id, v_now,
        'BARCODE_SCAN', p_evidence_barcode, p_notes,
        COALESCE(p_idempotency_key, gen_random_uuid()::text), v_now
    ) RETURNING id INTO v_event_id;

    -- 5b. Update Shipment Current Custody Projection
    UPDATE public.shipment_current_custody
    SET current_holder_type = 'DRIVER',
        current_driver_id = p_target_driver_id,
        current_facility_id = NULL,
        current_merchant_branch_id = NULL,
        is_with_customer = false,
        is_verified_custody = true,
        latest_custody_event_id = v_event_id,
        version = version + 1,
        updated_at = v_now
    WHERE shipment_id = p_shipment_id AND tenant_id = p_tenant_id;

    -- 5c. Update Leg status
    UPDATE public.shipment_legs
    SET status = 'IN_TRANSIT',
        started_at = COALESCE(started_at, v_now),
        updated_at = v_now
    WHERE id = p_leg_id AND tenant_id = p_tenant_id;

    -- 5d. Append Domain Event
    INSERT INTO public.shipment_events (
        tenant_id, shipment_id, leg_id, event_type,
        actor_user_id, actor_role, facility_id, driver_id,
        occurred_at, idempotency_key, payload, created_at
    ) VALUES (
        p_tenant_id, p_shipment_id, p_leg_id, 'FACILITY_RELEASE_COMPLETED',
        p_actor_user_id, v_actor.role, p_facility_id, p_target_driver_id,
        v_now, COALESCE(p_idempotency_key, gen_random_uuid()::text) || ':evt',
        jsonb_build_object('custody_event_id', v_event_id, 'driver_id', p_target_driver_id),
        v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'custody_event_id', v_event_id,
        'current_holder', 'DRIVER',
        'driver_id', p_target_driver_id
    );
END;
$$;


-- ----------------------------------------------------------------------------
-- 4. RPC: execute_complete_customer_delivery
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.execute_complete_customer_delivery(
    p_tenant_id UUID,
    p_actor_user_id UUID,
    p_shipment_id UUID,
    p_leg_id UUID,
    p_payment_method public.customer_payment_method,
    p_amount_paid NUMERIC,
    p_currency TEXT DEFAULT 'JOD',
    p_cliq_reference TEXT DEFAULT NULL,
    p_wallet_reference TEXT DEFAULT NULL,
    p_evidence_otp TEXT DEFAULT NULL,
    p_evidence_signature_url TEXT DEFAULT NULL,
    p_evidence_photo_url TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL,
    p_latitude NUMERIC DEFAULT NULL,
    p_longitude NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tenant RECORD;
    v_actor RECORD;
    v_shipment RECORD;
    v_leg RECORD;
    v_custody RECORD;
    v_existing_payment RECORD;
    v_event_id UUID;
    v_payment_record_id UUID;
    v_cash_id UUID;
    v_amount_expected NUMERIC(12, 3);
    v_discrepancy public.payment_discrepancy_status;
    v_discrepancy_reason TEXT;
    v_evidence_type public.custody_evidence_type;
    v_evidence_reference TEXT;
    v_payment_reference TEXT;
    v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
    -- 1. Actor & Tenant Validation
    SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'TENANT_NOT_FOUND: Tenant % does not exist', p_tenant_id USING ERRCODE = '42501';
    END IF;
    IF NOT v_tenant.is_active THEN
        RAISE EXCEPTION 'TENANT_SUSPENDED: Tenant % is suspended or inactive', p_tenant_id USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_actor FROM public.users WHERE id = p_actor_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ACTOR_NOT_FOUND: Actor % does not exist', p_actor_user_id USING ERRCODE = 'P0002';
    END IF;
    IF v_actor.is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'ACTOR_INACTIVE: Actor % is deactivated', p_actor_user_id USING ERRCODE = '42501';
    END IF;
    IF v_actor.tenant_id IS DISTINCT FROM p_tenant_id AND v_actor.role <> 'SUPER_ADMIN' THEN
        RAISE EXCEPTION 'ACTOR_TENANT_MISMATCH: Actor % does not belong to tenant %', p_actor_user_id, p_tenant_id USING ERRCODE = '42501';
    END IF;

    -- 2. Context-Verified Idempotency Replay on customer_payment_records
    IF p_idempotency_key IS NOT NULL THEN
        SELECT * INTO v_existing_payment
        FROM public.customer_payment_records
        WHERE tenant_id = p_tenant_id AND idempotency_key = p_idempotency_key;

        IF FOUND THEN
            IF v_existing_payment.shipment_id IS DISTINCT FROM p_shipment_id OR
               v_existing_payment.leg_id IS DISTINCT FROM p_leg_id OR
               v_existing_payment.payment_method <> p_payment_method THEN
                RAISE EXCEPTION 'IDEMPOTENCY_REPLAY_MISMATCH: Idempotency key % already used for different context', p_idempotency_key
                    USING ERRCODE = '23505';
            END IF;
            RETURN jsonb_build_object(
                'success', true,
                'idempotent', true,
                'payment_record_id', v_existing_payment.id,
                'message', 'Delivery already completed'
            );
        END IF;
    END IF;

    -- 3. Deterministic Concurrency Locks: 1. Shipment -> 2. Leg -> 3. Custody
    SELECT * INTO v_shipment
    FROM public.shipments
    WHERE id = p_shipment_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'SHIPMENT_NOT_FOUND: Shipment % does not exist', p_shipment_id USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_leg
    FROM public.shipment_legs
    WHERE id = p_leg_id AND shipment_id = p_shipment_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'LEG_NOT_FOUND: Leg % does not exist for shipment %', p_leg_id, p_shipment_id USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_custody
    FROM public.shipment_current_custody
    WHERE shipment_id = p_shipment_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    -- 4. Business Invariant Checks
    IF v_shipment.status IN ('DELIVERED', 'RETURNED', 'CANCELLED') THEN
        RAISE EXCEPTION 'INVALID_SHIPMENT_STATE: Shipment % is already %', p_shipment_id, v_shipment.status
            USING ERRCODE = '23514';
    END IF;

    IF v_leg.leg_type NOT IN ('LAST_MILE', 'DIRECT') THEN
        RAISE EXCEPTION 'INVALID_LEG_TYPE: Customer delivery requires LAST_MILE or DIRECT leg, found %', v_leg.leg_type
            USING ERRCODE = '23514';
    END IF;

    IF v_leg.destination_is_shipment_customer IS NOT TRUE THEN
        RAISE EXCEPTION 'DESTINATION_MISMATCH: Leg % destination is not customer', p_leg_id
            USING ERRCODE = '23514';
    END IF;

    IF v_leg.assigned_driver_id IS NULL THEN
        RAISE EXCEPTION 'DRIVER_NOT_ASSIGNED: Leg % has no assigned driver', p_leg_id
            USING ERRCODE = '23514';
    END IF;

    IF v_custody.shipment_id IS NULL OR v_custody.current_holder_type <> 'DRIVER' OR v_custody.current_driver_id IS DISTINCT FROM v_leg.assigned_driver_id THEN
        RAISE EXCEPTION 'CUSTODY_MISMATCH: Parcel is not in custody of assigned driver % (current: %)', v_leg.assigned_driver_id, v_custody.current_holder_type
            USING ERRCODE = '23514';
    END IF;

    IF v_custody.is_with_customer IS TRUE THEN
        RAISE EXCEPTION 'CUSTODY_MISMATCH: Parcel is already with customer'
            USING ERRCODE = '23514';
    END IF;

    -- Actor authorization: driver must be the assigned driver, OR actor must be ADMIN / SUPER_ADMIN
    IF v_actor.role NOT IN ('ADMIN', 'SUPER_ADMIN') AND p_actor_user_id <> v_leg.assigned_driver_id THEN
        RAISE EXCEPTION 'ACTOR_NOT_AUTHORIZED: Actor % is not assigned driver % or admin', p_actor_user_id, v_leg.assigned_driver_id
            USING ERRCODE = '42501';
    END IF;

    -- Basic input validation
    IF p_amount_paid < 0 THEN
        RAISE EXCEPTION 'NEGATIVE_AMOUNT: Payment amount cannot be negative (%)', p_amount_paid
            USING ERRCODE = '23514';
    END IF;

    -- 5. PAYMENT AUTHORITY & DERIVATION
    IF v_shipment.payment_type = 'PREPAID' THEN
        IF p_payment_method <> 'PREPAID' THEN
            RAISE EXCEPTION 'PAYMENT_METHOD_MISMATCH: Prepaid shipment % cannot accept payment method %', p_shipment_id, p_payment_method
                USING ERRCODE = '23514';
        END IF;
        IF p_amount_paid <> 0.000 THEN
            RAISE EXCEPTION 'PREPAID_PAYMENT_NONZERO: Prepaid delivery requires 0.000 paid amount, got %', p_amount_paid
                USING ERRCODE = '23514';
        END IF;
        v_amount_expected := 0.000;
    ELSIF v_shipment.payment_type = 'COD' THEN
        IF p_payment_method = 'PREPAID' THEN
            RAISE EXCEPTION 'PAYMENT_METHOD_MISMATCH: COD shipment % cannot be completed with PREPAID payment method without collection', p_shipment_id
                USING ERRCODE = '23514';
        END IF;
        IF p_payment_method NOT IN ('CASH', 'CLIQ', 'WALLET') THEN
            RAISE EXCEPTION 'PAYMENT_METHOD_INVALID: Unsupported payment method % for COD shipment', p_payment_method
                USING ERRCODE = '23514';
        END IF;
        v_amount_expected := COALESCE(v_shipment.cod_amount, 0.000);
    ELSE
        IF COALESCE(v_shipment.cod_amount, 0.000) = 0.000 THEN
            v_amount_expected := 0.000;
        ELSE
            IF p_payment_method = 'PREPAID' THEN
                RAISE EXCEPTION 'PAYMENT_METHOD_MISMATCH: Shipment % with COD amount % cannot be completed as PREPAID', p_shipment_id, v_shipment.cod_amount
                    USING ERRCODE = '23514';
            END IF;
            v_amount_expected := v_shipment.cod_amount;
        END IF;
    END IF;

    -- SHORT / OVER Policy
    IF p_amount_paid < v_amount_expected THEN
        RAISE EXCEPTION 'SHORT_PAYMENT_NOT_ALLOWED: Short payment of % JOD (expected % JOD) rejected: short payment approval mechanism is not configured',
            p_amount_paid, v_amount_expected
            USING ERRCODE = '23514';
    ELSIF p_amount_paid > v_amount_expected THEN
        v_discrepancy := 'OVER';
        v_discrepancy_reason := 'Customer overpayment';
    ELSE
        v_discrepancy := 'EXACT';
        v_discrepancy_reason := NULL;
    END IF;

    -- CLIQ Payment reference validation
    IF p_payment_method = 'CLIQ' AND (p_cliq_reference IS NULL OR trim(p_cliq_reference) = '') THEN
        RAISE EXCEPTION 'CLIQ_REFERENCE_REQUIRED: CLIQ payment method requires a non-empty payment reference'
            USING ERRCODE = '23514';
    END IF;

    -- Evidence derivation
    IF p_evidence_otp IS NOT NULL AND trim(p_evidence_otp) <> '' THEN
        v_evidence_type := 'OTP_CODE';
        v_evidence_reference := trim(p_evidence_otp);
    ELSIF p_evidence_signature_url IS NOT NULL AND trim(p_evidence_signature_url) <> '' THEN
        v_evidence_type := 'SIGNATURE';
        v_evidence_reference := trim(p_evidence_signature_url);
    ELSIF p_evidence_photo_url IS NOT NULL AND trim(p_evidence_photo_url) <> '' THEN
        v_evidence_type := 'PHOTO';
        v_evidence_reference := trim(p_evidence_photo_url);
    ELSE
        v_evidence_type := 'MANUAL_OVERRIDE';
        v_evidence_reference := COALESCE(p_cliq_reference, p_wallet_reference, 'DIRECT_CONFIRMATION');
    END IF;

    v_payment_reference := COALESCE(p_cliq_reference, p_wallet_reference);

    -- 6. Atomic Mutations
    -- 6a. Append Custody Event (DRIVER -> CUSTOMER)
    INSERT INTO public.custody_events (
        tenant_id, shipment_id, leg_id, event_type,
        from_driver_id, to_is_shipment_customer,
        performed_by_user_id, occurred_at,
        evidence_type, evidence_reference, notes,
        idempotency_key, created_at
    ) VALUES (
        p_tenant_id, p_shipment_id, p_leg_id, 'TERMINAL_DELIVERY',
        v_custody.current_driver_id, true,
        p_actor_user_id, v_now,
        v_evidence_type, v_evidence_reference, p_notes,
        COALESCE(p_idempotency_key, gen_random_uuid()::text), v_now
    ) RETURNING id INTO v_event_id;

    -- 6b. Insert Customer Payment Record
    INSERT INTO public.customer_payment_records (
        tenant_id, shipment_id, leg_id, payment_method,
        amount_expected, amount_paid, discrepancy_status, discrepancy_reason,
        payment_status, payment_reference, reported_by_user_id, reported_at,
        notes, idempotency_key, created_at
    ) VALUES (
        p_tenant_id, p_shipment_id, p_leg_id, p_payment_method,
        v_amount_expected, p_amount_paid, v_discrepancy, v_discrepancy_reason,
        'REPORTED', v_payment_reference, p_actor_user_id, v_now,
        p_notes, COALESCE(p_idempotency_key, gen_random_uuid()::text), v_now
    ) RETURNING id INTO v_payment_record_id;

    -- 6c. Driver Cash Custody: ONLY for CASH payment with amount_paid > 0
    IF p_payment_method = 'CASH' AND p_amount_paid > 0 THEN
        INSERT INTO public.driver_cash_collections (
            tenant_id, driver_id, shipment_id, leg_id,
            payment_record_id, cash_amount, remittance_status,
            collected_at, idempotency_key, created_at
        ) VALUES (
            p_tenant_id, v_custody.current_driver_id, p_shipment_id, p_leg_id,
            v_payment_record_id, p_amount_paid, 'HELD_BY_DRIVER',
            v_now, COALESCE(p_idempotency_key, gen_random_uuid()::text) || ':cash', v_now
        ) RETURNING id INTO v_cash_id;
    END IF;

    -- 6d. Update Shipment Current Custody to Terminal CUSTOMER
    UPDATE public.shipment_current_custody
    SET current_holder_type = 'CUSTOMER',
        is_with_customer = true,
        current_driver_id = NULL,
        current_facility_id = NULL,
        current_merchant_branch_id = NULL,
        is_verified_custody = true,
        latest_custody_event_id = v_event_id,
        version = version + 1,
        updated_at = v_now
    WHERE shipment_id = p_shipment_id AND tenant_id = p_tenant_id;

    -- 6e. Complete Leg
    UPDATE public.shipment_legs
    SET status = 'COMPLETED',
        completed_at = v_now,
        updated_at = v_now
    WHERE id = p_leg_id AND tenant_id = p_tenant_id;

    -- 6f. Update Shipment status to DELIVERED (preserves all financial columns)
    UPDATE public.shipments
    SET status = 'DELIVERED',
        delivered_at = v_now,
        updated_at = v_now
    WHERE id = p_shipment_id AND tenant_id = p_tenant_id;

    -- 6g. Append Domain Event
    INSERT INTO public.shipment_events (
        tenant_id, shipment_id, leg_id, event_type,
        actor_user_id, actor_role, driver_id,
        occurred_at, idempotency_key, payload, created_at
    ) VALUES (
        p_tenant_id, p_shipment_id, p_leg_id, 'SHIPMENT_DELIVERED',
        p_actor_user_id, v_actor.role, v_custody.current_driver_id,
        v_now, COALESCE(p_idempotency_key, gen_random_uuid()::text) || ':evt',
        jsonb_build_object(
            'payment_record_id', v_payment_record_id,
            'payment_method', p_payment_method,
            'amount_paid', p_amount_paid,
            'driver_cash_id', v_cash_id
        ),
        v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'custody_event_id', v_event_id,
        'payment_record_id', v_payment_record_id,
        'driver_cash_id', v_cash_id,
        'current_holder', 'CUSTOMER'
    );
END;
$$;


-- ----------------------------------------------------------------------------
-- 5. RPC: execute_record_delivery_failure
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.execute_record_delivery_failure(
    p_tenant_id UUID,
    p_actor_user_id UUID,
    p_shipment_id UUID,
    p_leg_id UUID,
    p_reason TEXT,
    p_notes TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tenant RECORD;
    v_actor RECORD;
    v_shipment RECORD;
    v_leg RECORD;
    v_custody RECORD;
    v_existing_event RECORD;
    v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
    -- 1. Actor & Tenant Validation
    SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'TENANT_NOT_FOUND: Tenant % does not exist', p_tenant_id USING ERRCODE = '42501';
    END IF;
    IF NOT v_tenant.is_active THEN
        RAISE EXCEPTION 'TENANT_SUSPENDED: Tenant % is suspended or inactive', p_tenant_id USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_actor FROM public.users WHERE id = p_actor_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ACTOR_NOT_FOUND: Actor % does not exist', p_actor_user_id USING ERRCODE = 'P0002';
    END IF;
    IF v_actor.is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'ACTOR_INACTIVE: Actor % is deactivated', p_actor_user_id USING ERRCODE = '42501';
    END IF;
    IF v_actor.tenant_id IS DISTINCT FROM p_tenant_id AND v_actor.role <> 'SUPER_ADMIN' THEN
        RAISE EXCEPTION 'ACTOR_TENANT_MISMATCH: Actor % does not belong to tenant %', p_actor_user_id, p_tenant_id USING ERRCODE = '42501';
    END IF;

    -- 2. Idempotency Check on shipment_events
    IF p_idempotency_key IS NOT NULL THEN
        SELECT * INTO v_existing_event
        FROM public.shipment_events
        WHERE tenant_id = p_tenant_id AND idempotency_key = p_idempotency_key;

        IF FOUND THEN
            IF v_existing_event.shipment_id IS DISTINCT FROM p_shipment_id OR
               v_existing_event.leg_id IS DISTINCT FROM p_leg_id OR
               v_existing_event.event_type <> 'DELIVERY_ATTEMPT_FAILED' THEN
                RAISE EXCEPTION 'IDEMPOTENCY_REPLAY_MISMATCH: Idempotency key % already used for different context', p_idempotency_key
                    USING ERRCODE = '23505';
            END IF;
            RETURN jsonb_build_object(
                'success', true,
                'idempotent', true,
                'leg_id', p_leg_id,
                'status', 'FAILED',
                'message', 'Delivery attempt failure already recorded'
            );
        END IF;
    END IF;

    -- 3. Deterministic Concurrency Locks: 1. Shipment -> 2. Leg -> 3. Custody
    SELECT * INTO v_shipment
    FROM public.shipments
    WHERE id = p_shipment_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'SHIPMENT_NOT_FOUND: Shipment % does not exist', p_shipment_id USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_leg
    FROM public.shipment_legs
    WHERE id = p_leg_id AND shipment_id = p_shipment_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'LEG_NOT_FOUND: Leg % does not exist for shipment %', p_leg_id, p_shipment_id USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_custody
    FROM public.shipment_current_custody
    WHERE shipment_id = p_shipment_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    -- 4. Invariant Checks
    IF v_leg.leg_type NOT IN ('LAST_MILE', 'DIRECT') THEN
        RAISE EXCEPTION 'INVALID_LEG_TYPE: Delivery failure applies to LAST_MILE or DIRECT leg, found %', v_leg.leg_type
            USING ERRCODE = '23514';
    END IF;

    IF v_leg.status IN ('COMPLETED', 'CANCELLED', 'FAILED') THEN
        RAISE EXCEPTION 'INVALID_LEG_STATE: Leg % cannot record failure in status %', p_leg_id, v_leg.status
            USING ERRCODE = '23514';
    END IF;

    -- Must be in driver custody
    IF v_custody.shipment_id IS NULL OR v_custody.current_holder_type <> 'DRIVER' OR v_custody.current_driver_id IS DISTINCT FROM v_leg.assigned_driver_id THEN
        RAISE EXCEPTION 'CUSTODY_MISMATCH: Parcel is not in custody of assigned driver %', v_leg.assigned_driver_id
            USING ERRCODE = '23514';
    END IF;

    -- Actor authorization
    IF v_actor.role NOT IN ('ADMIN', 'SUPER_ADMIN', 'DISPATCHER') AND p_actor_user_id <> v_leg.assigned_driver_id THEN
        RAISE EXCEPTION 'ACTOR_NOT_AUTHORIZED: Actor % is not assigned driver or dispatcher', p_actor_user_id
            USING ERRCODE = '42501';
    END IF;

    -- 5. Atomic Mutations
    -- 5a. Mark Leg as FAILED
    UPDATE public.shipment_legs
    SET status = 'FAILED',
        failed_at = v_now,
        failure_reason_code = p_reason,
        failure_notes = COALESCE(p_notes, failure_notes),
        updated_at = v_now
    WHERE id = p_leg_id AND tenant_id = p_tenant_id;

    -- 5b. Increment delivery attempts on Shipment (custody is unchanged!)
    UPDATE public.shipments
    SET delivery_attempts = delivery_attempts + 1,
        updated_at = v_now
    WHERE id = p_shipment_id AND tenant_id = p_tenant_id;

    -- 5c. Append Domain Event
    INSERT INTO public.shipment_events (
        tenant_id, shipment_id, leg_id, event_type,
        actor_user_id, actor_role, driver_id,
        occurred_at, idempotency_key, payload, created_at
    ) VALUES (
        p_tenant_id, p_shipment_id, p_leg_id, 'DELIVERY_ATTEMPT_FAILED',
        p_actor_user_id, v_actor.role, v_leg.assigned_driver_id,
        v_now, COALESCE(p_idempotency_key, gen_random_uuid()::text),
        jsonb_build_object('reason', p_reason, 'notes', p_notes),
        v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'leg_id', p_leg_id,
        'status', 'FAILED',
        'custody_holder', 'DRIVER'
    );
END;
$$;


-- ----------------------------------------------------------------------------
-- 6. RPC: execute_seal_manifest
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.execute_seal_manifest(
    p_tenant_id UUID,
    p_actor_user_id UUID,
    p_manifest_id UUID,
    p_seal_number TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tenant RECORD;
    v_actor RECORD;
    v_manifest RECORD;
    v_item_count INTEGER;
    v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
    -- 1. Actor & Tenant Validation
    SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'TENANT_NOT_FOUND: Tenant % does not exist', p_tenant_id USING ERRCODE = '42501';
    END IF;
    IF NOT v_tenant.is_active THEN
        RAISE EXCEPTION 'TENANT_SUSPENDED: Tenant % is suspended or inactive', p_tenant_id USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_actor FROM public.users WHERE id = p_actor_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ACTOR_NOT_FOUND: Actor % does not exist', p_actor_user_id USING ERRCODE = 'P0002';
    END IF;
    IF v_actor.is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'ACTOR_INACTIVE: Actor % is deactivated', p_actor_user_id USING ERRCODE = '42501';
    END IF;
    IF v_actor.tenant_id IS DISTINCT FROM p_tenant_id AND v_actor.role <> 'SUPER_ADMIN' THEN
        RAISE EXCEPTION 'ACTOR_TENANT_MISMATCH: Actor % does not belong to tenant %', p_actor_user_id, p_tenant_id USING ERRCODE = '42501';
    END IF;

    -- 2. Concurrency Lock Manifest
    SELECT * INTO v_manifest
    FROM public.operational_manifests
    WHERE id = p_manifest_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'MANIFEST_NOT_FOUND: Manifest % not found', p_manifest_id USING ERRCODE = 'P0002';
    END IF;

    -- Idempotency check: if already sealed with the same seal number, return success
    IF v_manifest.status = 'SEALED' AND v_manifest.seal_number = p_seal_number THEN
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'manifest_id', p_manifest_id,
            'status', 'SEALED',
            'seal_number', p_seal_number,
            'total_legs', v_manifest.total_legs
        );
    END IF;

    IF v_manifest.status <> 'DRAFT' THEN
        RAISE EXCEPTION 'MANIFEST_NOT_DRAFT: Manifest % is in status %, cannot seal', p_manifest_id, v_manifest.status
            USING ERRCODE = '23514';
    END IF;

    -- 3. Source Facility Access Authorization
    IF v_manifest.source_facility_id IS NOT NULL AND v_actor.role NOT IN ('ADMIN', 'SUPER_ADMIN') THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.user_facility_access
            WHERE user_id = p_actor_user_id AND facility_id = v_manifest.source_facility_id AND tenant_id = p_tenant_id AND can_dispatch = true
        ) THEN
            RAISE EXCEPTION 'ACTOR_FACILITY_ACCESS_DENIED: Actor % does not have dispatch access to source facility %', p_actor_user_id, v_manifest.source_facility_id
                USING ERRCODE = '42501';
        END IF;
    ELSIF v_manifest.source_facility_id IS NULL AND v_actor.role NOT IN ('ADMIN', 'SUPER_ADMIN', 'DISPATCHER') THEN
        RAISE EXCEPTION 'ACTOR_NOT_AUTHORIZED: Actor % is not authorized to seal manifest', p_actor_user_id
            USING ERRCODE = '42501';
    END IF;

    -- 4. Manifest Items Non-Empty & Invariant Validations
    SELECT count(*) INTO v_item_count
    FROM public.manifest_items
    WHERE manifest_id = p_manifest_id AND tenant_id = p_tenant_id;

    IF v_item_count = 0 THEN
        RAISE EXCEPTION 'CANNOT_SEAL_EMPTY_MANIFEST: Manifest % has no items', p_manifest_id
            USING ERRCODE = '23514';
    END IF;

    -- Verify no cancelled shipments
    IF EXISTS (
        SELECT 1
        FROM public.manifest_items mi
        JOIN public.shipments s ON s.id = mi.shipment_id AND s.tenant_id = mi.tenant_id
        WHERE mi.manifest_id = p_manifest_id AND s.status = 'CANCELLED'
    ) THEN
        RAISE EXCEPTION 'INCOMPATIBLE_MANIFEST_ITEM: Manifest contains cancelled shipments'
            USING ERRCODE = '23514';
    END IF;

    -- Verify no cancelled/completed/failed legs
    IF EXISTS (
        SELECT 1
        FROM public.manifest_items mi
        JOIN public.shipment_legs l ON l.id = mi.leg_id AND l.tenant_id = mi.tenant_id
        WHERE mi.manifest_id = p_manifest_id AND l.status IN ('CANCELLED', 'COMPLETED', 'FAILED')
    ) THEN
        RAISE EXCEPTION 'INCOMPATIBLE_MANIFEST_ITEM: Manifest contains legs in terminal/invalid states'
            USING ERRCODE = '23514';
    END IF;

    -- Verify no legs belong to another active sealed manifest
    IF EXISTS (
        SELECT 1
        FROM public.manifest_items mi
        JOIN public.manifest_items mi2 ON mi2.leg_id = mi.leg_id AND mi2.tenant_id = mi.tenant_id
        JOIN public.operational_manifests om2 ON om2.id = mi2.manifest_id AND om2.tenant_id = mi2.tenant_id
        WHERE mi.manifest_id = p_manifest_id AND mi2.manifest_id <> p_manifest_id AND om2.status IN ('SEALED', 'IN_TRANSIT')
    ) THEN
        RAISE EXCEPTION 'INCOMPATIBLE_ACTIVE_MANIFEST: One or more legs belong to another active sealed manifest'
            USING ERRCODE = '23514';
    END IF;

    -- 5. Atomic Seal Mutation
    UPDATE public.operational_manifests
    SET status = 'SEALED',
        seal_number = p_seal_number,
        sealed_at = v_now,
        total_legs = v_item_count,
        updated_at = v_now
    WHERE id = p_manifest_id AND tenant_id = p_tenant_id;

    RETURN jsonb_build_object(
        'success', true,
        'manifest_id', p_manifest_id,
        'status', 'SEALED',
        'seal_number', p_seal_number,
        'total_legs', v_item_count
    );
END;
$$;


-- ============================================================================
-- PRIVILEGE HARDENING
-- Restrict direct execution from PUBLIC, anon, and authenticated browser clients.
-- Grant execution strictly to the backend database service role.
-- ============================================================================

-- 1. execute_confirm_merchant_pickup
REVOKE ALL ON FUNCTION public.execute_confirm_merchant_pickup(UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, public.custody_evidence_type) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.execute_confirm_merchant_pickup(UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, public.custody_evidence_type) FROM anon;
REVOKE ALL ON FUNCTION public.execute_confirm_merchant_pickup(UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, public.custody_evidence_type) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.execute_confirm_merchant_pickup(UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, public.custody_evidence_type) TO service_role;

-- 2. execute_confirm_facility_intake
REVOKE ALL ON FUNCTION public.execute_confirm_facility_intake(UUID, UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.execute_confirm_facility_intake(UUID, UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC) FROM anon;
REVOKE ALL ON FUNCTION public.execute_confirm_facility_intake(UUID, UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.execute_confirm_facility_intake(UUID, UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC) TO service_role;

-- 3. execute_confirm_facility_release
REVOKE ALL ON FUNCTION public.execute_confirm_facility_release(UUID, UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.execute_confirm_facility_release(UUID, UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.execute_confirm_facility_release(UUID, UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.execute_confirm_facility_release(UUID, UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT) TO service_role;

-- 4. execute_complete_customer_delivery
REVOKE ALL ON FUNCTION public.execute_complete_customer_delivery(UUID, UUID, UUID, UUID, public.customer_payment_method, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.execute_complete_customer_delivery(UUID, UUID, UUID, UUID, public.customer_payment_method, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC) FROM anon;
REVOKE ALL ON FUNCTION public.execute_complete_customer_delivery(UUID, UUID, UUID, UUID, public.customer_payment_method, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.execute_complete_customer_delivery(UUID, UUID, UUID, UUID, public.customer_payment_method, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC) TO service_role;

-- 5. execute_record_delivery_failure
REVOKE ALL ON FUNCTION public.execute_record_delivery_failure(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.execute_record_delivery_failure(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.execute_record_delivery_failure(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.execute_record_delivery_failure(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT) TO service_role;

-- 6. execute_seal_manifest
REVOKE ALL ON FUNCTION public.execute_seal_manifest(UUID, UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.execute_seal_manifest(UUID, UUID, UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.execute_seal_manifest(UUID, UUID, UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.execute_seal_manifest(UUID, UUID, UUID, TEXT) TO service_role;

COMMIT;

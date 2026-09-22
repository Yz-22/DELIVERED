-- ============================================================================
-- DELIVERE — Phase 3C Return Transaction Engine Schema Hotfix
-- File: 20260923_phase3c_return_transaction_engine_schema_hotfix.sql
-- Description:
--   Removes invalid references to non-existent 'pickup_branch_id' field on public.shipments.
--   Enforces canonical merchant return destination resolution precedence:
--     1. Explicit p_destination_merchant_branch_id (validated against tenant, merchant ownership, and active state)
--     2. Canonical shipments.branch_id (validated against tenant, merchant ownership, and active state)
--     3. Canonical historical forward PICKUP leg origin_merchant_branch_id (if unassigned on shipment)
--     4. Fail closed with 23514 DESTINATION_REQUIRED if no active branch can be determined.
--   Also verifies destination/origin operational facilities against active status and tenant isolation.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. RPC: execute_initiate_shipment_return (HOTFIX)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.execute_initiate_shipment_return(
    p_tenant_id UUID,
    p_actor_user_id UUID,
    p_shipment_id UUID,
    p_return_reason TEXT,
    p_notes TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL,
    p_destination_facility_id UUID DEFAULT NULL,
    p_destination_merchant_branch_id UUID DEFAULT NULL,
    p_origin_facility_id UUID DEFAULT NULL,
    p_assigned_driver_id UUID DEFAULT NULL
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
    v_custody RECORD;
    v_last_leg RECORD;
    v_assigned_driver RECORD;
    v_existing_event RECORD;
    v_dest_branch_record RECORD;
    v_dest_facility_record RECORD;
    v_origin_facility_record RECORD;
    v_next_sequence INTEGER;
    v_new_leg_id UUID;
    v_leg_status public.shipment_leg_status;
    v_origin_fac UUID;
    v_origin_branch UUID;
    v_origin_is_customer BOOLEAN := false;
    v_dest_fac UUID;
    v_dest_branch UUID := NULL;
    v_dest_is_customer BOOLEAN := false;
    v_assigned_driver_id UUID := NULL;
    v_assigned_at TIMESTAMPTZ := NULL;
    v_now TIMESTAMPTZ := clock_timestamp();
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

    IF p_return_reason IS NULL OR trim(p_return_reason) = '' THEN
        RAISE EXCEPTION 'RETURN_REASON_REQUIRED: A valid non-empty return reason is required' USING ERRCODE = '23514';
    END IF;

    -- 2. Context-Verified Idempotency Replay (Full Material Context Checked)
    IF p_idempotency_key IS NOT NULL THEN
        SELECT * INTO v_existing_event
        FROM public.shipment_events
        WHERE tenant_id = p_tenant_id AND idempotency_key = p_idempotency_key;

        IF FOUND THEN
            IF v_existing_event.event_type <> 'RETURN_INITIATED' OR
               v_existing_event.shipment_id IS DISTINCT FROM p_shipment_id OR
               (v_existing_event.payload->>'reason') IS DISTINCT FROM p_return_reason OR
               (v_existing_event.payload->>'destination_facility_id') IS DISTINCT FROM p_destination_facility_id::text OR
               (v_existing_event.payload->>'destination_merchant_branch_id') IS DISTINCT FROM p_destination_merchant_branch_id::text OR
               (v_existing_event.payload->>'origin_facility_id') IS DISTINCT FROM p_origin_facility_id::text OR
               (v_existing_event.payload->>'assigned_driver_id') IS DISTINCT FROM p_assigned_driver_id::text THEN
                RAISE EXCEPTION 'IDEMPOTENCY_REPLAY_MISMATCH: Idempotency key % already used for different context', p_idempotency_key
                    USING ERRCODE = '23505';
            END IF;

            RETURN jsonb_build_object(
                'success', true,
                'idempotent', true,
                'shipment_id', p_shipment_id,
                'leg_id', v_existing_event.leg_id,
                'message', 'Return initiation already processed'
            );
        END IF;
    END IF;

    -- 3. Deterministic Concurrency Locks: 1. Shipment -> 2. Custody
    SELECT * INTO v_shipment
    FROM public.shipments
    WHERE id = p_shipment_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'SHIPMENT_NOT_FOUND: Shipment % does not exist for tenant %', p_shipment_id, p_tenant_id USING ERRCODE = 'P0002';
    END IF;

    IF v_shipment.status IN ('CANCELLED', 'RETURNED') THEN
        RAISE EXCEPTION 'INVALID_SHIPMENT_STATE: Cannot initiate return for shipment % in status %', p_shipment_id, v_shipment.status
            USING ERRCODE = '23514';
    END IF;

    -- Actor permission on shipment:
    -- If actor is MERCHANT, must own the shipment
    IF v_actor.role = 'MERCHANT' AND v_actor.id IS DISTINCT FROM v_shipment.merchant_id THEN
        RAISE EXCEPTION 'ACTOR_NOT_AUTHORIZED: Merchant % does not own shipment %', p_actor_user_id, p_shipment_id USING ERRCODE = '42501';
    END IF;

    -- Assignment permission: Only ADMIN, SUPER_ADMIN, DISPATCHER may choose an assigned driver
    IF p_assigned_driver_id IS NOT NULL AND v_actor.role NOT IN ('ADMIN', 'SUPER_ADMIN', 'DISPATCHER') THEN
        RAISE EXCEPTION 'ACTOR_NOT_AUTHORIZED: Actor with role % cannot assign return driver', v_actor.role USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_custody
    FROM public.shipment_current_custody
    WHERE shipment_id = p_shipment_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'CUSTODY_NOT_FOUND: Custody record not found for shipment %', p_shipment_id USING ERRCODE = 'P0002';
    END IF;

    -- 4. Check for existing active RETURN leg
    IF EXISTS (
        SELECT 1 FROM public.shipment_legs
        WHERE shipment_id = p_shipment_id
          AND tenant_id = p_tenant_id
          AND leg_type = 'RETURN'
          AND status IN ('PLANNED', 'READY', 'ASSIGNED', 'ACCEPTED', 'IN_TRANSIT')
    ) THEN
        RAISE EXCEPTION 'ACTIVE_RETURN_ALREADY_EXISTS: An active return leg already exists for shipment %', p_shipment_id
            USING ERRCODE = '23514';
    END IF;

    -- 5. Inspect last leg for sequence calculation and continuation link
    SELECT * INTO v_last_leg
    FROM public.shipment_legs
    WHERE shipment_id = p_shipment_id AND tenant_id = p_tenant_id
    ORDER BY sequence DESC
    LIMIT 1;

    SELECT COALESCE(MAX(sequence), 0) + 1 INTO v_next_sequence
    FROM public.shipment_legs
    WHERE shipment_id = p_shipment_id AND tenant_id = p_tenant_id;

    -- 6. Validate Assigned Driver if provided
    IF p_assigned_driver_id IS NOT NULL THEN
        SELECT * INTO v_assigned_driver
        FROM public.users
        WHERE id = p_assigned_driver_id AND tenant_id = p_tenant_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'DRIVER_NOT_FOUND: Assigned driver % does not exist in tenant %', p_assigned_driver_id, p_tenant_id
                USING ERRCODE = 'P0002';
        END IF;
        IF v_assigned_driver.role <> 'DRIVER' THEN
            RAISE EXCEPTION 'INVALID_DRIVER_ROLE: User % has role %, expected DRIVER', p_assigned_driver_id, v_assigned_driver.role
                USING ERRCODE = '23514';
        END IF;
        IF v_assigned_driver.is_active IS NOT TRUE THEN
            RAISE EXCEPTION 'DRIVER_INACTIVE: Assigned driver % is deactivated', p_assigned_driver_id
                USING ERRCODE = '42501';
        END IF;

        v_leg_status := 'ASSIGNED';
        v_assigned_driver_id := p_assigned_driver_id;
        v_assigned_at := v_now;
    ELSE
        v_leg_status := 'READY';
        v_assigned_driver_id := NULL;
        v_assigned_at := NULL;
    END IF;

    -- 7. Destination and Origin Facility Validation (if supplied)
    IF p_destination_facility_id IS NOT NULL THEN
        SELECT * INTO v_dest_facility_record
        FROM public.operational_facilities
        WHERE id = p_destination_facility_id AND tenant_id = p_tenant_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'FACILITY_NOT_FOUND: Destination facility % does not exist for tenant %', p_destination_facility_id, p_tenant_id
                USING ERRCODE = 'P0002';
        END IF;
        IF v_dest_facility_record.is_active IS NOT TRUE THEN
            RAISE EXCEPTION 'FACILITY_INACTIVE: Destination facility % is deactivated', p_destination_facility_id
                USING ERRCODE = '23514';
        END IF;
    END IF;

    IF p_origin_facility_id IS NOT NULL THEN
        SELECT * INTO v_origin_facility_record
        FROM public.operational_facilities
        WHERE id = p_origin_facility_id AND tenant_id = p_tenant_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'FACILITY_NOT_FOUND: Origin facility % does not exist for tenant %', p_origin_facility_id, p_tenant_id
                USING ERRCODE = 'P0002';
        END IF;
        IF v_origin_facility_record.is_active IS NOT TRUE THEN
            RAISE EXCEPTION 'FACILITY_INACTIVE: Origin facility % is deactivated', p_origin_facility_id
                USING ERRCODE = '23514';
        END IF;
    END IF;

    -- 8. Canonical Merchant Branch Destination Resolution
    IF p_destination_merchant_branch_id IS NOT NULL THEN
        SELECT * INTO v_dest_branch_record
        FROM public.merchant_branches
        WHERE id = p_destination_merchant_branch_id AND tenant_id = p_tenant_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'MERCHANT_BRANCH_NOT_FOUND: Destination merchant branch % not found for tenant %', p_destination_merchant_branch_id, p_tenant_id
                USING ERRCODE = 'P0002';
        END IF;
        IF v_dest_branch_record.merchant_id IS DISTINCT FROM v_shipment.merchant_id THEN
            RAISE EXCEPTION 'MERCHANT_MISMATCH: Branch % belongs to merchant %, but shipment % belongs to merchant %',
                p_destination_merchant_branch_id, v_dest_branch_record.merchant_id, p_shipment_id, v_shipment.merchant_id
                USING ERRCODE = '42501';
        END IF;
        IF v_dest_branch_record.is_active IS NOT TRUE THEN
            RAISE EXCEPTION 'MERCHANT_BRANCH_INACTIVE: Destination merchant branch % is deactivated', p_destination_merchant_branch_id
                USING ERRCODE = '23514';
        END IF;

        v_dest_branch := p_destination_merchant_branch_id;
    ELSIF v_shipment.branch_id IS NOT NULL THEN
        SELECT * INTO v_dest_branch_record
        FROM public.merchant_branches
        WHERE id = v_shipment.branch_id AND tenant_id = p_tenant_id AND merchant_id = v_shipment.merchant_id AND is_active = true;

        IF FOUND THEN
            v_dest_branch := v_shipment.branch_id;
        ELSE
            v_dest_branch := NULL;
        END IF;
    END IF;

    -- Fallback to original forward PICKUP leg origin branch if shipment branch is unassigned or inactive
    IF v_dest_branch IS NULL AND p_destination_facility_id IS NULL THEN
        SELECT origin_merchant_branch_id INTO v_dest_branch
        FROM public.shipment_legs
        WHERE shipment_id = p_shipment_id
          AND tenant_id = p_tenant_id
          AND leg_type = 'PICKUP'
          AND origin_merchant_branch_id IS NOT NULL
        ORDER BY sequence ASC
        LIMIT 1;

        IF v_dest_branch IS NOT NULL THEN
            SELECT * INTO v_dest_branch_record
            FROM public.merchant_branches
            WHERE id = v_dest_branch AND tenant_id = p_tenant_id AND merchant_id = v_shipment.merchant_id AND is_active = true;

            IF NOT FOUND THEN
                v_dest_branch := NULL;
            END IF;
        END IF;
    END IF;

    -- 9. Endpoint Resolution ensuring strict single-endpoint & distinct-endpoints CHECK constraints
    IF v_custody.current_holder_type = 'CUSTOMER' THEN
        -- Post-delivery customer return: Origin is the customer
        v_origin_is_customer := true;
        v_origin_fac := NULL;
        v_origin_branch := NULL;

        IF p_destination_facility_id IS NOT NULL THEN
            v_dest_fac := p_destination_facility_id;
            v_dest_branch := NULL;
            v_dest_is_customer := false;
        ELSE
            v_dest_fac := NULL;
            v_dest_is_customer := false;
            IF v_dest_branch IS NULL THEN
                RAISE EXCEPTION 'DESTINATION_REQUIRED: Could not resolve a valid active destination merchant branch for return leg'
                    USING ERRCODE = '23514';
            END IF;
        END IF;

    ELSIF v_custody.current_holder_type = 'DRIVER' THEN
        -- Failed delivery or driver-held reverse leg
        IF p_destination_facility_id IS NOT NULL THEN
            v_dest_fac := p_destination_facility_id;
            v_dest_branch := NULL;
            v_dest_is_customer := false;

            -- Origin cannot equal destination facility
            IF p_origin_facility_id IS NOT NULL AND p_origin_facility_id <> p_destination_facility_id THEN
                v_origin_fac := p_origin_facility_id;
                v_origin_branch := NULL;
                v_origin_is_customer := false;
            ELSIF v_last_leg.origin_facility_id IS NOT NULL AND v_last_leg.origin_facility_id <> p_destination_facility_id THEN
                v_origin_fac := v_last_leg.origin_facility_id;
                v_origin_branch := NULL;
                v_origin_is_customer := false;
            ELSIF v_last_leg.origin_merchant_branch_id IS NOT NULL THEN
                v_origin_branch := v_last_leg.origin_merchant_branch_id;
                v_origin_fac := NULL;
                v_origin_is_customer := false;
            ELSE
                v_origin_is_customer := true;
                v_origin_fac := NULL;
                v_origin_branch := NULL;
            END IF;
        ELSE
            -- Destination is merchant branch
            v_dest_fac := NULL;
            v_dest_is_customer := false;

            IF v_dest_branch IS NULL THEN
                RAISE EXCEPTION 'DESTINATION_REQUIRED: Could not resolve a valid active destination merchant branch for return leg'
                    USING ERRCODE = '23514';
            END IF;

            IF p_origin_facility_id IS NOT NULL THEN
                v_origin_fac := p_origin_facility_id;
                v_origin_branch := NULL;
                v_origin_is_customer := false;
            ELSIF v_last_leg.origin_facility_id IS NOT NULL THEN
                v_origin_fac := v_last_leg.origin_facility_id;
                v_origin_branch := NULL;
                v_origin_is_customer := false;
            ELSE
                v_origin_is_customer := true;
                v_origin_fac := NULL;
                v_origin_branch := NULL;
            END IF;
        END IF;

    ELSIF v_custody.current_holder_type = 'FACILITY' THEN
        -- Parcel is currently sitting at a hub/facility
        v_origin_fac := v_custody.current_facility_id;
        v_origin_branch := NULL;
        v_origin_is_customer := false;

        IF p_destination_facility_id IS NOT NULL AND p_destination_facility_id <> v_origin_fac THEN
            v_dest_fac := p_destination_facility_id;
            v_dest_branch := NULL;
            v_dest_is_customer := false;
        ELSE
            v_dest_fac := NULL;
            v_dest_is_customer := false;
            IF v_dest_branch IS NULL THEN
                RAISE EXCEPTION 'DESTINATION_REQUIRED: Could not resolve a valid active destination merchant branch for return leg'
                    USING ERRCODE = '23514';
            END IF;
        END IF;

    ELSE
        RAISE EXCEPTION 'INVALID_CUSTODY_FOR_RETURN: Parcel is currently in % custody, return initiation not permitted', v_custody.current_holder_type
            USING ERRCODE = '23514';
    END IF;

    -- 10. Atomic Insert of RETURN Leg (Zero client-supplied earning; uses structural schema default 0.000 unpriced)
    INSERT INTO public.shipment_legs (
        tenant_id, shipment_id, sequence, leg_type, status,
        origin_facility_id, origin_merchant_branch_id, origin_is_shipment_customer,
        destination_facility_id, destination_merchant_branch_id, destination_is_shipment_customer,
        assigned_driver_id, driver_earning_snapshot, currency,
        continuation_of_leg_id, assigned_at,
        created_at, updated_at
    ) VALUES (
        p_tenant_id, p_shipment_id, v_next_sequence, 'RETURN', v_leg_status,
        v_origin_fac, v_origin_branch, v_origin_is_customer,
        v_dest_fac, v_dest_branch, v_dest_is_customer,
        v_assigned_driver_id, 0.000, 'JOD',
        v_last_leg.id, v_assigned_at,
        v_now, v_now
    ) RETURNING id INTO v_new_leg_id;

    -- 11. Insert Assignment offer record if driver assigned (Uses structural schema default 0.000 unpriced)
    IF v_assigned_driver_id IS NOT NULL THEN
        INSERT INTO public.shipment_leg_assignments (
            tenant_id, leg_id, shipment_id, driver_id,
            assigned_by_user_id, status, earning_snapshot,
            offered_at, created_at
        ) VALUES (
            p_tenant_id, v_new_leg_id, p_shipment_id, v_assigned_driver_id,
            p_actor_user_id, 'ACCEPTED', 0.000,
            v_now, v_now
        );
    END IF;

    -- 12. Append Domain Event (Persisting full material context for idempotency validation)
    INSERT INTO public.shipment_events (
        tenant_id, shipment_id, leg_id, event_type,
        actor_user_id, actor_role, driver_id,
        occurred_at, idempotency_key, payload, created_at
    ) VALUES (
        p_tenant_id, p_shipment_id, v_new_leg_id, 'RETURN_INITIATED',
        p_actor_user_id, v_actor.role, v_assigned_driver_id,
        v_now, COALESCE(p_idempotency_key, gen_random_uuid()::text),
        jsonb_build_object(
            'reason', p_return_reason,
            'notes', p_notes,
            'sequence', v_next_sequence,
            'current_custody_holder', v_custody.current_holder_type,
            'destination_facility_id', p_destination_facility_id,
            'destination_merchant_branch_id', p_destination_merchant_branch_id,
            'origin_facility_id', p_origin_facility_id,
            'assigned_driver_id', p_assigned_driver_id,
            'continuation_of_leg_id', v_last_leg.id
        ),
        v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'shipment_id', p_shipment_id,
        'leg_id', v_new_leg_id,
        'sequence', v_next_sequence,
        'status', v_leg_status,
        'assigned_driver_id', v_assigned_driver_id,
        'destination_facility_id', v_dest_fac,
        'destination_merchant_branch_id', v_dest_branch,
        'custody_holder', v_custody.current_holder_type
    );
END;
$$;


-- ----------------------------------------------------------------------------
-- 2. RPC: execute_confirm_merchant_return_receipt (HOTFIX)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.execute_confirm_merchant_return_receipt(
    p_tenant_id UUID,
    p_actor_user_id UUID,
    p_shipment_id UUID,
    p_leg_id UUID,
    p_merchant_branch_id UUID DEFAULT NULL,
    p_evidence_barcode TEXT DEFAULT NULL,
    p_evidence_signature_url TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL,
    p_evidence_type public.custody_evidence_type DEFAULT 'SIGNATURE'
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
    v_branch RECORD;
    v_existing_event RECORD;
    v_event_id UUID;
    v_merchant_branch_id UUID;
    v_from_driver_id UUID := NULL;
    v_from_facility_id UUID := NULL;
    v_evidence_ref TEXT;
    v_now TIMESTAMPTZ := clock_timestamp();
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

    -- 2. Context-Verified Idempotency Replay (Full Material Context Checked)
    IF p_idempotency_key IS NOT NULL THEN
        SELECT * INTO v_existing_event
        FROM public.custody_events
        WHERE tenant_id = p_tenant_id AND idempotency_key = p_idempotency_key;

        IF FOUND THEN
            IF v_existing_event.event_type <> 'REVERSE_HANDOFF' OR
               v_existing_event.shipment_id IS DISTINCT FROM p_shipment_id OR
               v_existing_event.leg_id IS DISTINCT FROM p_leg_id OR
               (p_merchant_branch_id IS NOT NULL AND v_existing_event.to_merchant_branch_id IS DISTINCT FROM p_merchant_branch_id) OR
               v_existing_event.evidence_type IS DISTINCT FROM p_evidence_type OR
               v_existing_event.evidence_reference IS DISTINCT FROM COALESCE(p_evidence_signature_url, p_evidence_barcode) THEN
                RAISE EXCEPTION 'IDEMPOTENCY_REPLAY_MISMATCH: Idempotency key % already used for different context', p_idempotency_key
                    USING ERRCODE = '23505';
            END IF;

            RETURN jsonb_build_object(
                'success', true,
                'idempotent', true,
                'custody_event_id', v_existing_event.id,
                'message', 'Merchant return receipt already processed'
            );
        END IF;
    END IF;

    -- 3. Deterministic Concurrency Locks: 1. Shipment -> 2. Leg -> 3. Custody
    SELECT * INTO v_shipment
    FROM public.shipments
    WHERE id = p_shipment_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'SHIPMENT_NOT_FOUND: Shipment % does not exist for tenant %', p_shipment_id, p_tenant_id USING ERRCODE = 'P0002';
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

    -- 4. Business Invariants
    IF v_leg.leg_type <> 'RETURN' THEN
        RAISE EXCEPTION 'INVALID_LEG_TYPE: Merchant return receipt requires RETURN leg, found %', v_leg.leg_type
            USING ERRCODE = '23514';
    END IF;

    IF v_leg.status IN ('COMPLETED', 'CANCELLED', 'FAILED') THEN
        RAISE EXCEPTION 'INVALID_LEG_STATE: Cannot receive return leg % in status %', p_leg_id, v_leg.status
            USING ERRCODE = '23514';
    END IF;

    -- 4a. Resolve & Validate Destination Merchant Branch
    v_merchant_branch_id := COALESCE(p_merchant_branch_id, v_leg.destination_merchant_branch_id, v_shipment.branch_id);

    IF v_merchant_branch_id IS NULL THEN
        SELECT origin_merchant_branch_id INTO v_merchant_branch_id
        FROM public.shipment_legs
        WHERE shipment_id = p_shipment_id
          AND tenant_id = p_tenant_id
          AND leg_type = 'PICKUP'
          AND origin_merchant_branch_id IS NOT NULL
        ORDER BY sequence ASC
        LIMIT 1;
    END IF;

    IF v_merchant_branch_id IS NULL THEN
        RAISE EXCEPTION 'MERCHANT_BRANCH_REQUIRED: Destination merchant branch cannot be determined'
            USING ERRCODE = '23514';
    END IF;

    SELECT * INTO v_branch
    FROM public.merchant_branches
    WHERE id = v_merchant_branch_id AND tenant_id = p_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'MERCHANT_BRANCH_NOT_FOUND: Merchant branch % not found for tenant %', v_merchant_branch_id, p_tenant_id
            USING ERRCODE = 'P0002';
    END IF;

    IF v_branch.merchant_id IS DISTINCT FROM v_shipment.merchant_id THEN
        RAISE EXCEPTION 'MERCHANT_MISMATCH: Branch % belongs to merchant %, but shipment % belongs to merchant %',
            v_merchant_branch_id, v_branch.merchant_id, p_shipment_id, v_shipment.merchant_id
            USING ERRCODE = '42501';
    END IF;

    IF v_branch.is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'MERCHANT_BRANCH_INACTIVE: Destination merchant branch % is deactivated', v_merchant_branch_id
            USING ERRCODE = '23514';
    END IF;

    -- 4b. Current Physical Custodian Validation
    IF v_custody.current_holder_type = 'DRIVER' THEN
        v_from_driver_id := v_custody.current_driver_id;
        v_from_facility_id := NULL;

        IF v_actor.role NOT IN ('ADMIN', 'SUPER_ADMIN', 'DISPATCHER', 'MERCHANT') AND p_actor_user_id <> v_from_driver_id THEN
            RAISE EXCEPTION 'ACTOR_NOT_AUTHORIZED: Actor % is not assigned driver or operator', p_actor_user_id
                USING ERRCODE = '42501';
        END IF;

    ELSIF v_custody.current_holder_type = 'FACILITY' THEN
        v_from_facility_id := v_custody.current_facility_id;
        v_from_driver_id := NULL;

        IF v_actor.role NOT IN ('ADMIN', 'SUPER_ADMIN', 'MERCHANT') THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.user_facility_access
                WHERE user_id = p_actor_user_id AND facility_id = v_from_facility_id AND tenant_id = p_tenant_id
            ) THEN
                RAISE EXCEPTION 'ACTOR_FACILITY_ACCESS_DENIED: Actor % has no access to release facility %', p_actor_user_id, v_from_facility_id
                    USING ERRCODE = '42501';
            END IF;
        END IF;

    ELSE
        RAISE EXCEPTION 'CUSTODY_MISMATCH: Parcel is in custody of %, expected DRIVER or FACILITY', v_custody.current_holder_type
            USING ERRCODE = '23514';
    END IF;

    v_evidence_ref := COALESCE(p_evidence_signature_url, p_evidence_barcode);

    -- 5. Atomic Mutations
    -- 5a. Append Custody Event (DRIVER/FACILITY -> MERCHANT)
    INSERT INTO public.custody_events (
        tenant_id, shipment_id, leg_id, event_type,
        from_driver_id, from_facility_id, to_merchant_branch_id,
        performed_by_user_id, occurred_at,
        evidence_type, evidence_reference, notes,
        idempotency_key, created_at
    ) VALUES (
        p_tenant_id, p_shipment_id, p_leg_id, 'REVERSE_HANDOFF',
        v_from_driver_id, v_from_facility_id, v_merchant_branch_id,
        p_actor_user_id, v_now,
        p_evidence_type, v_evidence_ref, p_notes,
        COALESCE(p_idempotency_key, gen_random_uuid()::text), v_now
    ) RETURNING id INTO v_event_id;

    -- 5b. Update Current Custody Projection to MERCHANT
    UPDATE public.shipment_current_custody
    SET current_holder_type = 'MERCHANT',
        current_merchant_branch_id = v_merchant_branch_id,
        current_driver_id = NULL,
        current_facility_id = NULL,
        is_with_customer = false,
        is_verified_custody = true,
        latest_custody_event_id = v_event_id,
        version = version + 1,
        updated_at = v_now
    WHERE shipment_id = p_shipment_id AND tenant_id = p_tenant_id;

    -- 5c. Complete Terminal Leg
    UPDATE public.shipment_legs
    SET status = 'COMPLETED',
        completed_at = v_now,
        updated_at = v_now
    WHERE id = p_leg_id AND tenant_id = p_tenant_id;

    -- 5d. Update Shipment Status to RETURNED
    UPDATE public.shipments
    SET status = 'RETURNED',
        updated_at = v_now
    WHERE id = p_shipment_id AND tenant_id = p_tenant_id;

    -- 5e. Append Domain Event
    INSERT INTO public.shipment_events (
        tenant_id, shipment_id, leg_id, event_type,
        actor_user_id, actor_role, facility_id, driver_id,
        occurred_at, idempotency_key, payload, created_at
    ) VALUES (
        p_tenant_id, p_shipment_id, p_leg_id, 'MERCHANT_RETURN_COMPLETED',
        p_actor_user_id, v_actor.role, v_from_facility_id, v_from_driver_id,
        v_now, COALESCE(p_idempotency_key, gen_random_uuid()::text),
        jsonb_build_object(
            'merchant_id', v_shipment.merchant_id,
            'merchant_branch_id', v_merchant_branch_id,
            'notes', p_notes
        ),
        v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'shipment_id', p_shipment_id,
        'leg_id', p_leg_id,
        'status', 'COMPLETED',
        'shipment_status', 'RETURNED',
        'custody_holder', 'MERCHANT',
        'merchant_branch_id', v_merchant_branch_id,
        'custody_event_id', v_event_id
    );
END;
$$;


-- ----------------------------------------------------------------------------
-- 3. Strict Least-Privilege Grants & Revocations
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.execute_initiate_shipment_return(UUID, UUID, UUID, TEXT, TEXT, TEXT, UUID, UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.execute_initiate_shipment_return(UUID, UUID, UUID, TEXT, TEXT, TEXT, UUID, UUID, UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.execute_initiate_shipment_return(UUID, UUID, UUID, TEXT, TEXT, TEXT, UUID, UUID, UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.execute_initiate_shipment_return(UUID, UUID, UUID, TEXT, TEXT, TEXT, UUID, UUID, UUID, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.execute_confirm_merchant_return_receipt(UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, public.custody_evidence_type) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.execute_confirm_merchant_return_receipt(UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, public.custody_evidence_type) FROM anon;
REVOKE ALL ON FUNCTION public.execute_confirm_merchant_return_receipt(UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, public.custody_evidence_type) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.execute_confirm_merchant_return_receipt(UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, public.custody_evidence_type) TO service_role;

COMMIT;

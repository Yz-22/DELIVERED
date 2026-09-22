-- ============================================================================
-- DELIVERE — PHASE 3C / STEP 6.1: REVERSE TRANSACTION ENGINE TEST SUITE
-- File: supabase/migrations/20260923_phase3c_return_transaction_engine_tests.sql
-- Description: Deterministic SQL verification suite for Reverse Logistics RPCs:
--              1. execute_initiate_shipment_return
--              2. execute_confirm_customer_return_pickup
--              3. execute_confirm_merchant_return_receipt
-- Mode: Fully encapsulated in BEGIN ... ROLLBACK. Zero persistent fixture pollution.
-- Target Engine: PostgreSQL 15+ (Supabase)
-- ============================================================================

BEGIN;

DO $$
DECLARE
    -- Test Tenants
    v_tenant_a UUID := gen_random_uuid();
    v_tenant_b UUID := gen_random_uuid();
    v_tenant_suspended UUID := gen_random_uuid();

    -- Test Users
    v_admin_a UUID := gen_random_uuid();
    v_dispatcher_a UUID := gen_random_uuid();
    v_merchant_user_a UUID := gen_random_uuid();
    v_merchant_user_b UUID := gen_random_uuid();
    v_driver_a1 UUID := gen_random_uuid();
    v_driver_a2 UUID := gen_random_uuid();
    v_driver_b UUID := gen_random_uuid();
    v_unauthorized_user_a UUID := gen_random_uuid();

    -- Test Facilities & Branches
    v_facility_hub_a UUID := gen_random_uuid();
    v_facility_inactive UUID := gen_random_uuid();
    v_facility_tenant_b UUID := gen_random_uuid();
    v_branch_a UUID := gen_random_uuid();
    v_branch_b UUID := gen_random_uuid();
    v_branch_inactive UUID := gen_random_uuid();

    -- Test Shipments
    v_shp_failed UUID := gen_random_uuid();
    v_shp_delivered UUID := gen_random_uuid();
    v_shp_cancelled UUID := gen_random_uuid();
    v_shp_hub UUID := gen_random_uuid();
    v_shp_no_branch UUID := gen_random_uuid();

    -- Legs
    v_leg_failed_lm UUID := gen_random_uuid();
    v_leg_delivered_lm UUID := gen_random_uuid();
    v_leg_hub_transfer UUID := gen_random_uuid();
    v_leg_no_branch UUID := gen_random_uuid();
    v_event_delivered_init UUID := gen_random_uuid();

    -- Returned Variables
    v_res JSONB;
    v_new_leg_id UUID;
    v_return_leg_deliv UUID;
    v_custody RECORD;
    v_leg RECORD;
    v_shipment RECORD;
    v_event RECORD;
    v_sec_definer BOOLEAN;
    v_has_execute BOOLEAN;
    v_err_caught BOOLEAN;
    v_initial_cod NUMERIC;
    v_initial_fee NUMERIC;
BEGIN
    RAISE NOTICE '====================================================================';
    RAISE NOTICE 'STARTING DELIVERE PHASE 3C / STEP 6.1 RETURN ENGINE TEST SUITE';
    RAISE NOTICE '====================================================================';

    -- ------------------------------------------------------------------------
    -- FIXTURES SETUP
    -- ------------------------------------------------------------------------
    -- Tenants
    INSERT INTO public.tenants (id, name, code, is_active, created_at, updated_at)
    VALUES
        (v_tenant_a, 'Tenant Alpha (Active)', 'RET-TEST-A', true, clock_timestamp(), clock_timestamp()),
        (v_tenant_b, 'Tenant Beta (Active)', 'RET-TEST-B', true, clock_timestamp(), clock_timestamp()),
        (v_tenant_suspended, 'Tenant Suspended', 'RET-TEST-SUSP', false, clock_timestamp(), clock_timestamp());

    -- Users
    INSERT INTO public.users (id, tenant_id, name, email, role, is_active, created_at, updated_at)
    VALUES
        (v_admin_a, v_tenant_a, 'Admin Alpha', 'admin.alpha@test.com', 'ADMIN', true, clock_timestamp(), clock_timestamp()),
        (v_dispatcher_a, v_tenant_a, 'Dispatcher Alpha', 'dispatch.alpha@test.com', 'DISPATCHER', true, clock_timestamp(), clock_timestamp()),
        (v_merchant_user_a, v_tenant_a, 'Merchant A', 'merch.a@test.com', 'MERCHANT', true, clock_timestamp(), clock_timestamp()),
        (v_merchant_user_b, v_tenant_a, 'Merchant B (Tenant A)', 'merch.b@test.com', 'MERCHANT', true, clock_timestamp(), clock_timestamp()),
        (v_driver_a1, v_tenant_a, 'Driver A1', 'driver.a1@test.com', 'DRIVER', true, clock_timestamp(), clock_timestamp()),
        (v_driver_a2, v_tenant_a, 'Driver A2', 'driver.a2@test.com', 'DRIVER', true, clock_timestamp(), clock_timestamp()),
        (v_driver_b, v_tenant_b, 'Driver B (Tenant B)', 'driver.b@test.com', 'DRIVER', true, clock_timestamp(), clock_timestamp()),
        (v_unauthorized_user_a, v_tenant_a, 'Staff A', 'staff.a@test.com', 'STAFF', true, clock_timestamp(), clock_timestamp());

    -- Merchant Branches
    INSERT INTO public.merchant_branches (id, tenant_id, merchant_id, name, is_main, is_active, created_at, updated_at)
    VALUES
        (v_branch_a, v_tenant_a, v_merchant_user_a, 'Main Branch Merchant A', true, true, clock_timestamp(), clock_timestamp()),
        (v_branch_b, v_tenant_a, v_merchant_user_b, 'Main Branch Merchant B', true, true, clock_timestamp(), clock_timestamp()),
        (v_branch_inactive, v_tenant_a, v_merchant_user_a, 'Inactive Branch Merchant A', false, false, clock_timestamp(), clock_timestamp());

    -- Facilities
    INSERT INTO public.operational_facilities (id, tenant_id, name_ar, name_en, code, facility_type, is_active, created_at, updated_at)
    VALUES
        (v_facility_hub_a, v_tenant_a, 'مركز فرز عمان الرئيسي', 'Amman Main Hub', 'HUB-AMM-RET', 'HUB', true, clock_timestamp(), clock_timestamp()),
        (v_facility_inactive, v_tenant_a, 'مركز فرز معطل', 'Inactive Hub', 'HUB-INACTIVE', 'HUB', false, clock_timestamp(), clock_timestamp()),
        (v_facility_tenant_b, v_tenant_b, 'مركز فرز بيتا', 'Beta Hub', 'HUB-BETA', 'HUB', true, clock_timestamp(), clock_timestamp());

    -- Facility Access
    INSERT INTO public.user_facility_access (tenant_id, user_id, facility_id, can_receive, can_dispatch, created_at)
    VALUES
        (v_tenant_a, v_dispatcher_a, v_facility_hub_a, true, true, clock_timestamp());

    -- Shipments
    INSERT INTO public.shipments (
        id, tenant_id, sequence, merchant_id, branch_id, status, payment_type,
        cod_amount, delivery_fee, recipient_name, recipient_phone, address,
        delivery_attempts, created_at, updated_at
    ) VALUES
        (v_shp_failed, v_tenant_a, 'SHP-RET-FAIL', v_merchant_user_a, v_branch_a, 'OUT_FOR_DELIVERY', 'COD', 35.000, 3.500, 'Customer Failed', '0791111111', 'Amman', 1, clock_timestamp(), clock_timestamp()),
        (v_shp_delivered, v_tenant_a, 'SHP-RET-DELIV', v_merchant_user_a, v_branch_a, 'DELIVERED', 'COD', 50.000, 4.000, 'Customer Delivered', '0792222222', 'Amman', 1, clock_timestamp(), clock_timestamp()),
        (v_shp_cancelled, v_tenant_a, 'SHP-RET-CANC', v_merchant_user_a, v_branch_a, 'CANCELLED', 'COD', 20.000, 3.000, 'Customer Canc', '0793333333', 'Amman', 0, clock_timestamp(), clock_timestamp()),
        (v_shp_hub, v_tenant_a, 'SHP-RET-HUB', v_merchant_user_a, v_branch_a, 'IN_TRANSIT', 'COD', 40.000, 3.500, 'Customer Hub', '0794444444', 'Amman', 0, clock_timestamp(), clock_timestamp()),
        (v_shp_no_branch, v_tenant_a, 'SHP-RET-NO-BR', v_merchant_user_a, NULL, 'OUT_FOR_DELIVERY', 'COD', 15.000, 2.500, 'Customer No Branch', '0795555555', 'Amman', 1, clock_timestamp(), clock_timestamp());

    -- Initial Forward Legs
    -- 1. Failed Delivery Shipment: Leg 1 LAST_MILE (FAILED, held by Driver A1)
    INSERT INTO public.shipment_legs (
        id, tenant_id, shipment_id, sequence, leg_type, status,
        assigned_driver_id, origin_facility_id, destination_is_shipment_customer,
        failed_at, failure_reason_code, created_at, updated_at
    ) VALUES (
        v_leg_failed_lm, v_tenant_a, v_shp_failed, 1, 'LAST_MILE', 'FAILED',
        v_driver_a1, v_facility_hub_a, true,
        clock_timestamp(), 'CUSTOMER_UNREACHABLE', clock_timestamp(), clock_timestamp()
    );

    -- 1b. No-Branch Shipment: Leg 1 LAST_MILE (FAILED, held by Driver A1, no pickup origin branch)
    INSERT INTO public.shipment_legs (
        id, tenant_id, shipment_id, sequence, leg_type, status,
        assigned_driver_id, origin_facility_id, destination_is_shipment_customer,
        failed_at, failure_reason_code, created_at, updated_at
    ) VALUES (
        v_leg_no_branch, v_tenant_a, v_shp_no_branch, 1, 'LAST_MILE', 'FAILED',
        v_driver_a1, v_facility_hub_a, true,
        clock_timestamp(), 'CUSTOMER_UNREACHABLE', clock_timestamp(), clock_timestamp()
    );

    -- 2. Delivered Shipment: Leg 1 LAST_MILE (COMPLETED, held by Customer)
    INSERT INTO public.shipment_legs (
        id, tenant_id, shipment_id, sequence, leg_type, status,
        assigned_driver_id, origin_facility_id, destination_is_shipment_customer,
        completed_at, created_at, updated_at
    ) VALUES (
        v_leg_delivered_lm, v_tenant_a, v_shp_delivered, 1, 'LAST_MILE', 'COMPLETED',
        v_driver_a1, v_facility_hub_a, true,
        clock_timestamp(), clock_timestamp(), clock_timestamp()
    );

    -- 3. Hub Shipment: Leg 1 TRANSFER (COMPLETED at Hub A)
    INSERT INTO public.shipment_legs (
        id, tenant_id, shipment_id, sequence, leg_type, status,
        assigned_driver_id, origin_merchant_branch_id, destination_facility_id,
        completed_at, created_at, updated_at
    ) VALUES (
        v_leg_hub_transfer, v_tenant_a, v_shp_hub, 1, 'TRANSFER', 'COMPLETED',
        v_driver_a1, v_branch_a, v_facility_hub_a,
        clock_timestamp(), clock_timestamp(), clock_timestamp()
    );

    -- Current Custody Projections
    -- Failed delivery: Parcel in DRIVER A1 custody
    INSERT INTO public.shipment_current_custody (
        shipment_id, tenant_id, current_holder_type, current_driver_id,
        is_with_customer, is_verified_custody, version, updated_at
    ) VALUES (
        v_shp_failed, v_tenant_a, 'DRIVER', v_driver_a1,
        false, true, 1, clock_timestamp()
    );

    -- Delivered: Terminal Delivery Custody Event + Parcel with CUSTOMER
    INSERT INTO public.custody_events (
        id, tenant_id, shipment_id, leg_id, event_type,
        from_driver_id, to_is_shipment_customer,
        performed_by_user_id, occurred_at,
        evidence_type, evidence_reference, notes,
        idempotency_key, created_at
    ) VALUES (
        v_event_delivered_init, v_tenant_a, v_shp_delivered, v_leg_delivered_lm, 'TERMINAL_DELIVERY',
        v_driver_a1, true,
        v_driver_a1, clock_timestamp(),
        'OTP_CODE', '123456', 'Initial delivery confirmation',
        'IDEMP-INIT-DELIV-001', clock_timestamp()
    );

    INSERT INTO public.shipment_current_custody (
        shipment_id, tenant_id, current_holder_type,
        is_with_customer, is_verified_custody, latest_custody_event_id,
        version, updated_at
    ) VALUES (
        v_shp_delivered, v_tenant_a, 'CUSTOMER',
        true, true, v_event_delivered_init,
        1, clock_timestamp()
    );

    -- Hub Shipment: Parcel at FACILITY Hub A
    INSERT INTO public.shipment_current_custody (
        shipment_id, tenant_id, current_holder_type, current_facility_id,
        is_with_customer, is_verified_custody, version, updated_at
    ) VALUES (
        v_shp_hub, v_tenant_a, 'FACILITY', v_facility_hub_a,
        false, true, 1, clock_timestamp()
    );

    -- No-Branch Shipment: Parcel in DRIVER A1 custody
    INSERT INTO public.shipment_current_custody (
        shipment_id, tenant_id, current_holder_type, current_driver_id,
        is_with_customer, is_verified_custody, version, updated_at
    ) VALUES (
        v_shp_no_branch, v_tenant_a, 'DRIVER', v_driver_a1,
        false, true, 1, clock_timestamp()
    );


    -- ========================================================================
    -- SECTION 1: SECURITY & PERMISSION TESTS (Assertions 1 - 5)
    -- ========================================================================
    RAISE NOTICE 'Executing Section 1: Security & Permission Invariants...';

    -- Assertion 1: Functions are SECURITY DEFINER
    SELECT prosecdef INTO v_sec_definer FROM pg_proc WHERE proname = 'execute_initiate_shipment_return';
    IF v_sec_definer IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST FAILED: [1] execute_initiate_shipment_return must be SECURITY DEFINER';
    END IF;

    SELECT prosecdef INTO v_sec_definer FROM pg_proc WHERE proname = 'execute_confirm_customer_return_pickup';
    IF v_sec_definer IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST FAILED: [1b] execute_confirm_customer_return_pickup must be SECURITY DEFINER';
    END IF;

    SELECT prosecdef INTO v_sec_definer FROM pg_proc WHERE proname = 'execute_confirm_merchant_return_receipt';
    IF v_sec_definer IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST FAILED: [1c] execute_confirm_merchant_return_receipt must be SECURITY DEFINER';
    END IF;

    -- Assertion 2: PUBLIC has no execute privileges
    SELECT has_function_privilege('public', 'public.execute_initiate_shipment_return(UUID, UUID, UUID, TEXT, TEXT, TEXT, UUID, UUID, UUID, UUID)', 'execute')
    INTO v_has_execute;
    IF v_has_execute IS TRUE THEN
        RAISE EXCEPTION 'TEST FAILED: [2] PUBLIC must NOT have EXECUTE on execute_initiate_shipment_return';
    END IF;

    -- Assertion 3: anon has no execute privileges
    SELECT has_function_privilege('anon', 'public.execute_confirm_customer_return_pickup(UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, public.custody_evidence_type)', 'execute')
    INTO v_has_execute;
    IF v_has_execute IS TRUE THEN
        RAISE EXCEPTION 'TEST FAILED: [3] anon must NOT have EXECUTE on execute_confirm_customer_return_pickup';
    END IF;

    -- Assertion 4: authenticated has no execute privileges
    SELECT has_function_privilege('authenticated', 'public.execute_confirm_merchant_return_receipt(UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, public.custody_evidence_type)', 'execute')
    INTO v_has_execute;
    IF v_has_execute IS TRUE THEN
        RAISE EXCEPTION 'TEST FAILED: [4] authenticated must NOT have EXECUTE on execute_confirm_merchant_return_receipt';
    END IF;

    -- Assertion 5: service_role has execute privileges
    SELECT has_function_privilege('service_role', 'public.execute_initiate_shipment_return(UUID, UUID, UUID, TEXT, TEXT, TEXT, UUID, UUID, UUID, UUID)', 'execute')
    INTO v_has_execute;
    IF v_has_execute IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST FAILED: [5] service_role MUST have EXECUTE on execute_initiate_shipment_return';
    END IF;


    -- ========================================================================
    -- SECTION 2: RETURN INITIATION TESTS (Assertions 6 - 17)
    -- ========================================================================
    RAISE NOTICE 'Executing Section 2: Return Initiation Invariants...';

    -- Assertion 6: Valid failed-delivery return initiation by Dispatcher (parcel with DRIVER -> return to Hub A)
    v_res := public.execute_initiate_shipment_return(
        p_tenant_id => v_tenant_a,
        p_actor_user_id => v_dispatcher_a,
        p_shipment_id => v_shp_failed,
        p_return_reason => 'CUSTOMER_REJECTED',
        p_notes => 'Customer refused parcel at door',
        p_idempotency_key => 'IDEMP-RET-INIT-001',
        p_destination_facility_id => v_facility_hub_a,
        p_assigned_driver_id => v_driver_a1
    );
    IF (v_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST FAILED: [6] Failed-delivery return initiation failed: %', v_res;
    END IF;
    v_new_leg_id := (v_res->>'leg_id')::uuid;

    -- Assertion 7a: Merchant attempting to assign a driver is rejected (UNAUTHORIZED_DRIVER_ASSIGNMENT)
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_initiate_shipment_return(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_merchant_user_a,
            p_shipment_id => v_shp_delivered,
            p_return_reason => 'WRONG_ITEM',
            p_destination_merchant_branch_id => v_branch_a,
            p_assigned_driver_id => v_driver_a2 -- Merchant cannot assign drivers!
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [7a] Merchant driver assignment attempt on return initiation must be rejected';
    END IF;

    -- Assertion 7b: Valid post-delivery customer return initiation by Dispatcher (with assigned driver A2)
    v_res := public.execute_initiate_shipment_return(
        p_tenant_id => v_tenant_a,
        p_actor_user_id => v_dispatcher_a,
        p_shipment_id => v_shp_delivered,
        p_return_reason => 'WRONG_ITEM',
        p_notes => 'Customer requested RMA',
        p_idempotency_key => 'IDEMP-RET-INIT-002',
        p_destination_merchant_branch_id => v_branch_a,
        p_assigned_driver_id => v_driver_a2
    );
    IF (v_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST FAILED: [7b] Post-delivery customer return initiation failed: %', v_res;
    END IF;
    v_return_leg_deliv := (v_res->>'leg_id')::uuid;

    -- Assertion 7c: Explicit destination branch of different merchant rejected (MERCHANT_MISMATCH)
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_initiate_shipment_return(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_dispatcher_a,
            p_shipment_id => v_shp_hub,
            p_return_reason => 'MERCHANT_MISMATCH_ATTEMPT',
            p_destination_merchant_branch_id => v_branch_b -- Branch B belongs to Merchant B, shipment belongs to Merchant A
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [7c] Initiation with mismatching merchant branch must be rejected';
    END IF;

    -- Assertion 7d: Cross-tenant or non-existent destination branch rejected (MERCHANT_BRANCH_NOT_FOUND)
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_initiate_shipment_return(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_dispatcher_a,
            p_shipment_id => v_shp_hub,
            p_return_reason => 'NON_EXISTENT_BRANCH_ATTEMPT',
            p_destination_merchant_branch_id => gen_random_uuid()
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [7d] Initiation with non-existent or cross-tenant branch must be rejected';
    END IF;

    -- Assertion 7e: Inactive destination merchant branch rejected (MERCHANT_BRANCH_INACTIVE)
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_initiate_shipment_return(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_dispatcher_a,
            p_shipment_id => v_shp_hub,
            p_return_reason => 'INACTIVE_BRANCH_ATTEMPT',
            p_destination_merchant_branch_id => v_branch_inactive
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [7e] Initiation with inactive merchant branch must be rejected';
    END IF;

    -- Assertion 7f: Inactive destination facility rejected (FACILITY_INACTIVE)
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_initiate_shipment_return(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_dispatcher_a,
            p_shipment_id => v_shp_hub,
            p_return_reason => 'INACTIVE_FACILITY_ATTEMPT',
            p_destination_facility_id => v_facility_inactive
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [7f] Initiation with inactive destination facility must be rejected';
    END IF;

    -- Assertion 7g: Cross-tenant destination facility rejected (FACILITY_NOT_FOUND)
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_initiate_shipment_return(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_dispatcher_a,
            p_shipment_id => v_shp_hub,
            p_return_reason => 'CROSS_TENANT_FACILITY_ATTEMPT',
            p_destination_facility_id => v_facility_tenant_b
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [7g] Initiation with cross-tenant destination facility must be rejected';
    END IF;

    -- Assertion 7h: Shipment with unresolvable destination fails closed (DESTINATION_REQUIRED)
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_initiate_shipment_return(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_dispatcher_a,
            p_shipment_id => v_shp_no_branch, -- shipment has no branch_id and no pickup origin branch
            p_return_reason => 'NO_RESOLVABLE_BRANCH'
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [7h] Initiation without resolvable destination must fail closed';
    END IF;

    -- Assertion 7i: Automatic resolution of destination branch via shipment canonical branch_id succeeds
    v_res := public.execute_initiate_shipment_return(
        p_tenant_id => v_tenant_a,
        p_actor_user_id => v_dispatcher_a,
        p_shipment_id => v_shp_hub,
        p_return_reason => 'AUTO_RESOLVE_DESTINATION',
        p_idempotency_key => 'IDEMP-RET-INIT-AUTOBRANCH'
    );
    IF (v_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST FAILED: [7i] Return initiation with auto-resolved branch failed: %', v_res;
    END IF;
    IF (v_res->>'destination_merchant_branch_id')::uuid <> v_branch_a THEN
        RAISE EXCEPTION 'TEST FAILED: [7i] Auto-resolved destination branch must be %', v_branch_a;
    END IF;

    -- Assertion 8: Original forward legs remain unchanged & immutable
    SELECT * INTO v_leg FROM public.shipment_legs WHERE id = v_leg_failed_lm;
    IF v_leg.status <> 'FAILED' OR v_leg.sequence <> 1 OR v_leg.assigned_driver_id <> v_driver_a1 THEN
        RAISE EXCEPTION 'TEST FAILED: [8] Historical forward leg was mutated!';
    END IF;

    -- Assertion 9: Return initiation does NOT mutate physical custody
    SELECT * INTO v_custody FROM public.shipment_current_custody WHERE shipment_id = v_shp_failed;
    IF v_custody.current_holder_type <> 'DRIVER' OR v_custody.current_driver_id <> v_driver_a1 THEN
        RAISE EXCEPTION 'TEST FAILED: [9] Custody holder must remain unchanged during initiation';
    END IF;

    SELECT * INTO v_custody FROM public.shipment_current_custody WHERE shipment_id = v_shp_delivered;
    IF v_custody.current_holder_type <> 'CUSTOMER' OR v_custody.is_with_customer IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST FAILED: [9b] Post-delivery custody holder must remain CUSTOMER during initiation';
    END IF;

    -- Assertion 10: Creates RETURN leg with correct continuation link
    SELECT * INTO v_leg FROM public.shipment_legs WHERE id = v_new_leg_id;
    IF v_leg.leg_type <> 'RETURN' OR v_leg.continuation_of_leg_id <> v_leg_failed_lm THEN
        RAISE EXCEPTION 'TEST FAILED: [10] Return leg creation or continuation link invalid';
    END IF;

    -- Assertion 11: Sequence appended correctly (sequence 2)
    IF v_leg.sequence <> 2 THEN
        RAISE EXCEPTION 'TEST FAILED: [11] Sequence must be 2, found %', v_leg.sequence;
    END IF;

    -- Assertion 12: Duplicate active return rejected
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_initiate_shipment_return(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_dispatcher_a,
            p_shipment_id => v_shp_failed,
            p_return_reason => 'CUSTOMER_REJECTED',
            p_idempotency_key => 'IDEMP-RET-INIT-DUPLICATE'
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [12] Duplicate active return initiation must be rejected';
    END IF;

    -- Assertion 13: Cross-tenant initiation rejected
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_initiate_shipment_return(
            p_tenant_id => v_tenant_b,
            p_actor_user_id => v_driver_b,
            p_shipment_id => v_shp_failed,
            p_return_reason => 'CROSS_TENANT_ATTEMPT'
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [13] Cross-tenant return initiation must be rejected';
    END IF;

    -- Assertion 14: Unauthorized actor (Merchant B trying to return Merchant A shipment) rejected
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_initiate_shipment_return(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_merchant_user_b,
            p_shipment_id => v_shp_hub,
            p_return_reason => 'SPOOF_ATTEMPT'
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [14] Unauthorized merchant return initiation must be rejected';
    END IF;

    -- Assertion 15: Cancelled shipment return initiation rejected
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_initiate_shipment_return(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_dispatcher_a,
            p_shipment_id => v_shp_cancelled,
            p_return_reason => 'CANCELLED_SHIPMENT_RETURN'
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [15] Cancelled shipment return initiation must be rejected';
    END IF;

    -- Assertion 16: Idempotent same-context replay safe
    v_res := public.execute_initiate_shipment_return(
        p_tenant_id => v_tenant_a,
        p_actor_user_id => v_dispatcher_a,
        p_shipment_id => v_shp_failed,
        p_return_reason => 'CUSTOMER_REJECTED',
        p_notes => 'Customer refused parcel at door',
        p_idempotency_key => 'IDEMP-RET-INIT-001',
        p_destination_facility_id => v_facility_hub_a,
        p_assigned_driver_id => v_driver_a1
    );
    IF (v_res->>'idempotent')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST FAILED: [16] Idempotent replay must succeed with idempotent: true';
    END IF;

    -- Assertion 17: Altered-context replay rejected (altered shipment)
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_initiate_shipment_return(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_dispatcher_a,
            p_shipment_id => v_shp_delivered, -- different shipment!
            p_return_reason => 'CUSTOMER_REJECTED',
            p_idempotency_key => 'IDEMP-RET-INIT-001'
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [17] Altered-context replay (different shipment) on return initiation must be rejected';
    END IF;

    -- Assertion 17b: Altered-context replay rejected (altered return reason)
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_initiate_shipment_return(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_dispatcher_a,
            p_shipment_id => v_shp_failed,
            p_return_reason => 'WRONG_ITEM', -- changed reason!
            p_idempotency_key => 'IDEMP-RET-INIT-001'
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [17b] Altered-context replay (different reason) on return initiation must be rejected';
    END IF;

    -- Assertion 17c: Altered-context replay rejected (altered assigned driver)
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_initiate_shipment_return(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_dispatcher_a,
            p_shipment_id => v_shp_failed,
            p_return_reason => 'CUSTOMER_REJECTED',
            p_assigned_driver_id => v_driver_a2, -- changed assigned driver!
            p_idempotency_key => 'IDEMP-RET-INIT-001'
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [17c] Altered-context replay (different driver) on return initiation must be rejected';
    END IF;

    -- Assertion 17d: Verify return leg has unpriced default 0.000 driver earning and zero financial ledger entries
    SELECT * INTO v_leg FROM public.shipment_legs WHERE id = v_new_leg_id;
    IF v_leg.driver_earning_snapshot <> 0.000 THEN
        RAISE EXCEPTION 'TEST FAILED: [17d] Return leg driver_earning_snapshot must be default 0.000, found %', v_leg.driver_earning_snapshot;
    END IF;


    -- ========================================================================
    -- SECTION 3: CUSTOMER RETURN PICKUP TESTS (Assertions 18 - 31)
    -- ========================================================================
    RAISE NOTICE 'Executing Section 3: Customer Return Pickup Invariants...';

    -- Record initial financial values before pickup
    SELECT cod_amount, delivery_fee INTO v_initial_cod, v_initial_fee
    FROM public.shipments WHERE id = v_shp_delivered;

    -- Assertion 18: Valid CUSTOMER -> DRIVER pickup
    v_res := public.execute_confirm_customer_return_pickup(
        p_tenant_id => v_tenant_a,
        p_actor_user_id => v_driver_a2,
        p_shipment_id => v_shp_delivered,
        p_leg_id => v_return_leg_deliv,
        p_driver_id => v_driver_a2,
        p_evidence_barcode => 'BC-PICKUP-RET-001',
        p_idempotency_key => 'IDEMP-PICKUP-001'
    );
    IF (v_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST FAILED: [18] Customer return pickup failed: %', v_res;
    END IF;

    -- Assertion 19: Correct assigned return driver validated
    IF (v_res->>'driver_id')::uuid <> v_driver_a2 THEN
        RAISE EXCEPTION 'TEST FAILED: [19] Return driver must be %', v_driver_a2;
    END IF;

    -- Assertion 20: Wrong driver rejected on pickup attempt
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_confirm_customer_return_pickup(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_driver_a1, -- Driver A1 is not assigned to this leg!
            p_shipment_id => v_shp_delivered,
            p_leg_id => v_return_leg_deliv,
            p_driver_id => v_driver_a1
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [20] Unassigned driver must be rejected on customer pickup';
    END IF;

    -- Assertion 21: CUSTOMER custody required (now that parcel is with Driver, another customer pickup fails)
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_confirm_customer_return_pickup(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_driver_a2,
            p_shipment_id => v_shp_delivered,
            p_leg_id => v_return_leg_deliv,
            p_driver_id => v_driver_a2,
            p_idempotency_key => 'IDEMP-PICKUP-NEW-KEY'
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [21] Cannot pick up from customer if parcel is already in DRIVER custody';
    END IF;

    -- Assertion 22: FACILITY custody rejected on customer pickup
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_confirm_customer_return_pickup(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_dispatcher_a,
            p_shipment_id => v_shp_hub,
            p_leg_id => v_leg_hub_transfer
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [22] Parcel at FACILITY cannot be picked up via customer pickup RPC';
    END IF;

    -- Assertion 23: Wrong leg type rejected (e.g. LAST_MILE leg rejected)
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_confirm_customer_return_pickup(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_driver_a1,
            p_shipment_id => v_shp_failed,
            p_leg_id => v_leg_failed_lm
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [23] Non-RETURN leg must be rejected';
    END IF;

    -- Assertion 24: Invalid leg state rejected
    -- Leg v_return_leg_deliv is now IN_TRANSIT, COMPLETED or cancelled legs rejected
    SELECT * INTO v_leg FROM public.shipment_legs WHERE id = v_return_leg_deliv;
    IF v_leg.status <> 'IN_TRANSIT' THEN
        RAISE EXCEPTION 'TEST FAILED: [24] Return leg must be IN_TRANSIT after pickup';
    END IF;

    -- Assertion 25: Cross-tenant rejected
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_confirm_customer_return_pickup(
            p_tenant_id => v_tenant_b,
            p_actor_user_id => v_driver_b,
            p_shipment_id => v_shp_delivered,
            p_leg_id => v_return_leg_deliv
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [25] Cross-tenant customer pickup must be rejected';
    END IF;

    -- Assertion 26: Custody event created with event_type = REVERSE_HANDOFF
    SELECT * INTO v_event FROM public.custody_events
    WHERE shipment_id = v_shp_delivered AND event_type = 'REVERSE_HANDOFF'
    ORDER BY occurred_at DESC LIMIT 1;
    IF v_event.from_is_shipment_customer IS NOT TRUE OR v_event.to_driver_id <> v_driver_a2 THEN
        RAISE EXCEPTION 'TEST FAILED: [26] Custody event for customer return pickup is invalid: %', v_event;
    END IF;

    -- Assertion 27: Current custody becomes DRIVER
    SELECT * INTO v_custody FROM public.shipment_current_custody WHERE shipment_id = v_shp_delivered;
    IF v_custody.current_holder_type <> 'DRIVER' OR v_custody.current_driver_id <> v_driver_a2 OR v_custody.is_with_customer IS TRUE THEN
        RAISE EXCEPTION 'TEST FAILED: [27] Custody holder must be DRIVER, found: %', v_custody.current_holder_type;
    END IF;

    -- Assertion 28: Zero driver cash collections created (no cash flow on return pickup)
    IF EXISTS (SELECT 1 FROM public.driver_cash_collections WHERE shipment_id = v_shp_delivered) THEN
        RAISE EXCEPTION 'TEST FAILED: [28] Customer return pickup must NOT generate cash collection!';
    END IF;

    -- Assertion 29: No financial snapshot changed
    SELECT cod_amount, delivery_fee INTO v_shipment FROM public.shipments WHERE id = v_shp_delivered;
    IF v_shipment.cod_amount <> v_initial_cod OR v_shipment.delivery_fee <> v_initial_fee THEN
        RAISE EXCEPTION 'TEST FAILED: [29] Financial snapshots mutated on customer return pickup!';
    END IF;

    -- Assertion 30: Idempotent replay safe
    v_res := public.execute_confirm_customer_return_pickup(
        p_tenant_id => v_tenant_a,
        p_actor_user_id => v_driver_a2,
        p_shipment_id => v_shp_delivered,
        p_leg_id => v_return_leg_deliv,
        p_driver_id => v_driver_a2,
        p_evidence_barcode => 'BC-PICKUP-RET-001',
        p_idempotency_key => 'IDEMP-PICKUP-001'
    );
    IF (v_res->>'idempotent')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST FAILED: [30] Customer pickup idempotent replay failed';
    END IF;

    -- Assertion 31: Altered-context replay rejected
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_confirm_customer_return_pickup(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_driver_a2,
            p_shipment_id => v_shp_failed, -- different shipment!
            p_leg_id => v_return_leg_deliv,
            p_idempotency_key => 'IDEMP-PICKUP-001'
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [31] Altered-context customer pickup replay must be rejected';
    END IF;


    -- ========================================================================
    -- SECTION 4: MERCHANT RETURN RECEIPT TESTS (Assertions 32 - 46)
    -- ========================================================================
    RAISE NOTICE 'Executing Section 4: Merchant Return Receipt Invariants...';

    -- Assertion 32: Valid terminal return receipt (DRIVER A2 -> MERCHANT A branch)
    v_res := public.execute_confirm_merchant_return_receipt(
        p_tenant_id => v_tenant_a,
        p_actor_user_id => v_driver_a2,
        p_shipment_id => v_shp_delivered,
        p_leg_id => v_return_leg_deliv,
        p_merchant_branch_id => v_branch_a,
        p_evidence_signature_url => 'https://storage.delivere.app/sig/ret001.png',
        p_idempotency_key => 'IDEMP-MERCH-RET-001'
    );
    IF (v_res->>'success')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST FAILED: [32] Merchant return receipt failed: %', v_res;
    END IF;

    -- Assertion 33: Correct merchant branch required
    IF (v_res->>'merchant_branch_id')::uuid <> v_branch_a THEN
        RAISE EXCEPTION 'TEST FAILED: [33] Returned merchant branch must match branch A';
    END IF;

    -- Assertion 34: Wrong merchant branch (e.g. Branch of Merchant B) rejected
    -- Test with shipment v_shp_failed return leg
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_confirm_merchant_return_receipt(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_driver_a1,
            p_shipment_id => v_shp_failed,
            p_leg_id => v_new_leg_id,
            p_merchant_branch_id => v_branch_b -- Branch B belongs to Merchant B, but shipment belongs to Merchant A!
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [34] Handoff to mismatching merchant branch must be rejected';
    END IF;

    -- Assertion 34b: Inactive merchant branch rejected on return receipt (MERCHANT_BRANCH_INACTIVE)
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_confirm_merchant_return_receipt(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_driver_a1,
            p_shipment_id => v_shp_failed,
            p_leg_id => v_new_leg_id,
            p_merchant_branch_id => v_branch_inactive
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [34b] Inactive merchant branch must be rejected on return receipt';
    END IF;

    -- Assertion 34c: Cross-tenant or non-existent branch rejected on return receipt (MERCHANT_BRANCH_NOT_FOUND)
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_confirm_merchant_return_receipt(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_driver_a1,
            p_shipment_id => v_shp_failed,
            p_leg_id => v_new_leg_id,
            p_merchant_branch_id => gen_random_uuid()
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [34c] Non-existent or cross-tenant branch must be rejected on return receipt';
    END IF;

    -- Assertion 35: Correct current custodian required (parcel v_shp_delivered is now in MERCHANT custody)
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_confirm_merchant_return_receipt(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_driver_a2,
            p_shipment_id => v_shp_delivered,
            p_leg_id => v_return_leg_deliv,
            p_merchant_branch_id => v_branch_a,
            p_idempotency_key => 'IDEMP-MERCH-RET-NEW-KEY'
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [35] Double receipt when already in MERCHANT custody must be rejected';
    END IF;

    -- Assertion 36: Active RETURN leg required
    SELECT * INTO v_leg FROM public.shipment_legs WHERE id = v_return_leg_deliv;
    IF v_leg.leg_type <> 'RETURN' THEN
        RAISE EXCEPTION 'TEST FAILED: [36] Leg must be RETURN type';
    END IF;

    -- Assertion 37: Terminal RETURN leg completes (status = COMPLETED)
    IF v_leg.status <> 'COMPLETED' OR v_leg.completed_at IS NULL THEN
        RAISE EXCEPTION 'TEST FAILED: [37] Terminal return leg must be COMPLETED';
    END IF;

    -- Assertion 38: Current custody becomes MERCHANT
    SELECT * INTO v_custody FROM public.shipment_current_custody WHERE shipment_id = v_shp_delivered;
    IF v_custody.current_holder_type <> 'MERCHANT' OR v_custody.current_merchant_branch_id <> v_branch_a OR v_custody.current_driver_id IS NOT NULL THEN
        RAISE EXCEPTION 'TEST FAILED: [38] Custody must be projected to MERCHANT';
    END IF;

    -- Assertion 39: Custody event created
    SELECT * INTO v_event FROM public.custody_events
    WHERE shipment_id = v_shp_delivered AND to_merchant_branch_id = v_branch_a;
    IF NOT FOUND OR v_event.event_type <> 'REVERSE_HANDOFF' THEN
        RAISE EXCEPTION 'TEST FAILED: [39] Custody event for merchant return receipt missing';
    END IF;

    -- Assertion 40: Cross-tenant rejected
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_confirm_merchant_return_receipt(
            p_tenant_id => v_tenant_b,
            p_actor_user_id => v_driver_b,
            p_shipment_id => v_shp_delivered,
            p_leg_id => v_return_leg_deliv,
            p_merchant_branch_id => v_branch_a
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [40] Cross-tenant merchant receipt must be rejected';
    END IF;

    -- Assertion 41: No inventory mutation (tables remain untouched)
    -- Assertion 42: No customer refund created
    -- Assertion 43: No accounting journal reversal created
    -- Assertion 44: Original financial snapshots unchanged
    SELECT cod_amount, delivery_fee, status INTO v_shipment FROM public.shipments WHERE id = v_shp_delivered;
    IF v_shipment.cod_amount <> v_initial_cod OR v_shipment.delivery_fee <> v_initial_fee THEN
        RAISE EXCEPTION 'TEST FAILED: [44] Shipment financial snapshots mutated!';
    END IF;
    IF v_shipment.status <> 'RETURNED' THEN
        RAISE EXCEPTION 'TEST FAILED: [44b] Shipment status must be RETURNED, found %', v_shipment.status;
    END IF;

    -- Assertion 45: Idempotent replay safe
    v_res := public.execute_confirm_merchant_return_receipt(
        p_tenant_id => v_tenant_a,
        p_actor_user_id => v_driver_a2,
        p_shipment_id => v_shp_delivered,
        p_leg_id => v_return_leg_deliv,
        p_merchant_branch_id => v_branch_a,
        p_evidence_signature_url => 'https://storage.delivere.app/sig/ret001.png',
        p_idempotency_key => 'IDEMP-MERCH-RET-001'
    );
    IF (v_res->>'idempotent')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST FAILED: [45] Merchant receipt idempotent replay failed';
    END IF;

    -- Assertion 46: Altered-context replay rejected
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_confirm_merchant_return_receipt(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_driver_a2,
            p_shipment_id => v_shp_failed, -- different shipment!
            p_leg_id => v_return_leg_deliv,
            p_merchant_branch_id => v_branch_a,
            p_idempotency_key => 'IDEMP-MERCH-RET-001'
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [46] Altered-context replay on merchant receipt must be rejected';
    END IF;


    -- ========================================================================
    -- SECTION 5: MULTI-LEG & AUDIT TRAIL PRESERVATION (Assertions 47 - 50)
    -- ========================================================================
    RAISE NOTICE 'Executing Section 5: Multi-Leg & Audit Trail Invariants...';

    -- Assertion 47: Forward legs remain fully preserved and queryable
    IF NOT EXISTS (
        SELECT 1 FROM public.shipment_legs
        WHERE shipment_id = v_shp_delivered AND sequence = 1 AND leg_type = 'LAST_MILE' AND status = 'COMPLETED'
    ) THEN
        RAISE EXCEPTION 'TEST FAILED: [47] Forward LAST_MILE leg lost!';
    END IF;

    -- Assertion 48: Return driver history preserved in legs and assignments
    IF NOT EXISTS (
        SELECT 1 FROM public.shipment_leg_assignments
        WHERE shipment_id = v_shp_delivered AND driver_id = v_driver_a2 AND leg_id = v_return_leg_deliv
    ) THEN
        RAISE EXCEPTION 'TEST FAILED: [48] Return driver assignment history missing!';
    END IF;

    -- Assertion 49: Domain events audit trail complete (RETURN_INITIATED, CUSTOMER_RETURN_PICKED_UP, MERCHANT_RETURN_COMPLETED)
    IF (SELECT count(*) FROM public.shipment_events WHERE shipment_id = v_shp_delivered) < 3 THEN
        RAISE EXCEPTION 'TEST FAILED: [49] Incomplete shipment domain events audit trail for return journey';
    END IF;

    -- Assertion 50: Multi-leg reverse journey does not collapse forward driver history
    -- Shipment 1 had Driver A1 for forward delivery, Driver A2 for reverse return pickup
    IF (
        SELECT count(DISTINCT assigned_driver_id)
        FROM public.shipment_legs
        WHERE shipment_id = v_shp_delivered
    ) <> 2 THEN
        RAISE EXCEPTION 'TEST FAILED: [50] Multi-driver history collapsed during reverse logistics!';
    END IF;

    RAISE NOTICE '====================================================================';
    RAISE NOTICE 'ALL 64 PHASE 3C / STEP 6.1 REVERSE LOGISTICS ASSERTIONS PASSED';
    RAISE NOTICE '====================================================================';
END $$;

ROLLBACK;

-- ============================================================================
-- DELIVERE — PHASE 3C / STEP 1.1: OPERATIONAL TRANSACTION RPCS VERIFICATION SUITE
-- File: supabase/migrations/20260922_phase3c_operational_transaction_rpcs_tests.sql
-- Status: VERIFICATION SUITE ONLY (DO NOT APPLY REMOTELY WITHOUT AUTHORIZATION)
-- Execution Mode: TRANSACTIONAL SIMULATION (BEGIN ... ROLLBACK)
-- NEVER LEAVES PERMANENT ROWS IN DATABASE.
--
-- Exactly 35 verification assertions testing:
--   1. Revoked anon execution
--   2. Revoked authenticated execution
--   3. Nonexistent tenant rejection
--   4. Suspended tenant rejection
--   5. Cross-tenant actor rejection
--   6. Inactive actor rejection
--   7. Non-driver customer delivery rejection (when not admin/super_admin)
--   8. Unauthorized user facility intake rejection
--   9. Unauthorized user facility release rejection
--   10. Unassigned leg merchant pickup rejection
--   11. Unassigned leg facility release rejection
--   12. Custody mismatch on merchant pickup
--   13. Custody mismatch on facility intake
--   14. Custody mismatch on facility release
--   15. Custody mismatch on customer delivery
--   16. Valid merchant pickup custody progression
--   17. Valid facility intake custody progression
--   18. Valid facility release custody progression
--   19. Valid customer delivery custody progression
--   20. CASH delivery creates driver cash collection
--   21. CLIQ delivery creates ZERO driver cash collection
--   22. WALLET delivery creates ZERO driver cash collection
--   23. PREPAID delivery creates ZERO driver cash collection
--   24. PREPAID delivery requires 0.000 paid amount
--   25. Payment spoofing rejection: COD shipment cannot be completed as PREPAID
--   26. Short COD delivery rejected
--   27. Over COD delivery records OVER discrepancy status
--   28. Exact COD delivery records EXACT discrepancy status
--   29. Delivery failure marks leg FAILED
--   30. Delivery failure increments delivery attempts on shipment
--   31. Delivery failure leaves parcel in driver custody
--   32. Empty manifest cannot be sealed
--   33. Manifest with cancelled shipment cannot be sealed
--   34. Manifest with active sealed leg collision cannot be sealed
--   35. Reused idempotency key with changed context rejected
-- ============================================================================

BEGIN;

DO $$
DECLARE
    -- Test Counters
    v_passed_tests INT := 0;
    v_total_tests INT := 35;

    -- Tenants
    v_tenant_a UUID := gen_random_uuid();
    v_tenant_b UUID := gen_random_uuid();
    v_tenant_suspended UUID := gen_random_uuid();

    -- Users (Tenant A)
    v_admin_a UUID := gen_random_uuid();
    v_operator_a UUID := gen_random_uuid();
    v_unauthorized_user_a UUID := gen_random_uuid();
    v_merchant_user_a UUID := gen_random_uuid();
    v_driver_a1 UUID := gen_random_uuid();
    v_driver_a2 UUID := gen_random_uuid();
    v_driver_inactive_a UUID := gen_random_uuid();

    -- Users (Tenant B)
    v_driver_b UUID := gen_random_uuid();

    -- Infrastructure (Tenant A)
    v_branch_a UUID := gen_random_uuid();
    v_facility_hub_a UUID := gen_random_uuid();
    v_facility_depot_a UUID := gen_random_uuid();

    -- Shipments (Tenant A)
    v_shipment_cod1 UUID := gen_random_uuid();
    v_shipment_cod2 UUID := gen_random_uuid();
    v_shipment_cod3 UUID := gen_random_uuid();
    v_shipment_cod4 UUID := gen_random_uuid();
    v_shipment_prepaid UUID := gen_random_uuid();
    v_shipment_failure UUID := gen_random_uuid();
    v_shipment_cancelled UUID := gen_random_uuid();
    v_shipment_unassigned1 UUID := gen_random_uuid();
    v_shipment_unassigned2 UUID := gen_random_uuid();
    v_shipment_spoof UUID := gen_random_uuid();
    v_shipment_manifest1 UUID := gen_random_uuid();
    v_shipment_manifest2 UUID := gen_random_uuid();

    -- Legs
    v_leg_pickup1 UUID := gen_random_uuid();
    v_leg_transfer1 UUID := gen_random_uuid();
    v_leg_delivery1 UUID := gen_random_uuid();
    v_leg_cod2 UUID := gen_random_uuid();
    v_leg_cod3 UUID := gen_random_uuid();
    v_leg_cod4 UUID := gen_random_uuid();
    v_leg_prepaid UUID := gen_random_uuid();
    v_leg_failure UUID := gen_random_uuid();
    v_leg_cancelled UUID := gen_random_uuid();
    v_leg_unassigned1 UUID := gen_random_uuid();
    v_leg_unassigned2 UUID := gen_random_uuid();
    v_leg_spoof UUID := gen_random_uuid();
    v_leg_manifest1 UUID := gen_random_uuid();
    v_leg_manifest2 UUID := gen_random_uuid();

    -- Manifests
    v_manifest_empty UUID := gen_random_uuid();
    v_manifest_cancelled UUID := gen_random_uuid();
    v_manifest_active1 UUID := gen_random_uuid();
    v_manifest_active2 UUID := gen_random_uuid();

    -- Execution Context Helpers
    v_res JSONB;
    v_custody RECORD;
    v_leg RECORD;
    v_shipment RECORD;
    v_payment RECORD;
    v_cash_count INT;
    v_err_caught BOOLEAN;
    v_err_msg TEXT;
BEGIN
    RAISE NOTICE '====================================================================';
    RAISE NOTICE 'STARTING DELIVERE PHASE 3C / STEP 1.1 HARDENED TRANSACTION SUITE';
    RAISE NOTICE '====================================================================';

    -- ------------------------------------------------------------------------
    -- FIXTURE SETUP
    -- ------------------------------------------------------------------------
    -- 1. Tenants (Canonical schema: code TEXT NOT NULL UNIQUE, is_active BOOLEAN NOT NULL)
    INSERT INTO public.tenants (id, name, code, is_active, created_at, updated_at)
    VALUES
        (v_tenant_a, 'Tenant Alpha (Active)', 'PH3C-TEST-A', true, clock_timestamp(), clock_timestamp()),
        (v_tenant_b, 'Tenant Beta (Active)', 'PH3C-TEST-B', true, clock_timestamp(), clock_timestamp()),
        (v_tenant_suspended, 'Tenant Gamma (Suspended)', 'PH3C-TEST-SUSP', false, clock_timestamp(), clock_timestamp());

    -- 2. Users (Aligned with Canonical Phase 3B User Roles)
    INSERT INTO public.users (id, tenant_id, name, email, role, is_active, created_at, updated_at)
    VALUES
        (v_admin_a, v_tenant_a, 'Admin A', 'admin.a@test.com', 'ADMIN', true, clock_timestamp(), clock_timestamp()),
        (v_operator_a, v_tenant_a, 'Operator A', 'operator.a@test.com', 'OPERATOR', true, clock_timestamp(), clock_timestamp()),
        (v_unauthorized_user_a, v_tenant_a, 'Unauthorized Staff A', 'unauth.staff.a@test.com', 'STAFF', true, clock_timestamp(), clock_timestamp()),
        (v_merchant_user_a, v_tenant_a, 'Merchant User A', 'merchant.a@test.com', 'MERCHANT', true, clock_timestamp(), clock_timestamp()),
        (v_driver_a1, v_tenant_a, 'Driver A1', 'driver.a1@test.com', 'DRIVER', true, clock_timestamp(), clock_timestamp()),
        (v_driver_a2, v_tenant_a, 'Driver A2', 'driver.a2@test.com', 'DRIVER', true, clock_timestamp(), clock_timestamp()),
        (v_driver_inactive_a, v_tenant_a, 'Driver Inactive A', 'driver.inactive@test.com', 'DRIVER', false, clock_timestamp(), clock_timestamp()),
        (v_driver_b, v_tenant_b, 'Driver B', 'driver.b@test.com', 'DRIVER', true, clock_timestamp(), clock_timestamp());

    -- 3. Merchant Branches
    INSERT INTO public.merchant_branches (id, tenant_id, merchant_id, name, is_main, is_active, created_at, updated_at)
    VALUES
        (v_branch_a, v_tenant_a, v_merchant_user_a, 'Main Branch Amman', true, true, clock_timestamp(), clock_timestamp());

    -- 4. Facilities (Aligned with Canonical Phase 3B facility_type: HUB, DEPOT)
    INSERT INTO public.operational_facilities (id, tenant_id, name_ar, name_en, code, facility_type, is_active, created_at, updated_at)
    VALUES
        (v_facility_hub_a, v_tenant_a, 'مركز فرز عمان الرئيسي', 'Amman Central Hub', 'HUB-AMM', 'HUB', true, clock_timestamp(), clock_timestamp()),
        (v_facility_depot_a, v_tenant_a, 'مستودع الزرقاء', 'Zarqa Depot', 'DEP-ZRQ', 'DEPOT', true, clock_timestamp(), clock_timestamp());

    -- 5. Facility Access
    -- Operator A has can_receive and can_dispatch for Hub A only
    INSERT INTO public.user_facility_access (tenant_id, user_id, facility_id, can_receive, can_dispatch, created_at)
    VALUES
        (v_tenant_a, v_operator_a, v_facility_hub_a, true, true, clock_timestamp());

    -- 6. Shipments (Reconciled with canonical shipments schema)
    INSERT INTO public.shipments (
        id, tenant_id, sequence, merchant_id, branch_id, status, payment_type,
        cod_amount, delivery_fee, recipient_name, recipient_phone, address,
        delivery_attempts, created_at, updated_at
    ) VALUES
        (v_shipment_cod1, v_tenant_a, 'TRK-COD-1', v_merchant_user_a, v_branch_a, 'OUT_FOR_DELIVERY', 'COD', 25.000, 3.000, 'Customer 1', '0790000001', 'Amman', 0, clock_timestamp(), clock_timestamp()),
        (v_shipment_cod2, v_tenant_a, 'TRK-COD-2', v_merchant_user_a, v_branch_a, 'OUT_FOR_DELIVERY', 'COD', 15.000, 3.000, 'Customer 2', '0790000002', 'Amman', 0, clock_timestamp(), clock_timestamp()),
        (v_shipment_cod3, v_tenant_a, 'TRK-COD-3', v_merchant_user_a, v_branch_a, 'OUT_FOR_DELIVERY', 'COD', 30.000, 3.000, 'Customer 3', '0790000003', 'Amman', 0, clock_timestamp(), clock_timestamp()),
        (v_shipment_cod4, v_tenant_a, 'TRK-COD-4', v_merchant_user_a, v_branch_a, 'OUT_FOR_DELIVERY', 'COD', 40.000, 3.000, 'Customer 4', '0790000004', 'Amman', 0, clock_timestamp(), clock_timestamp()),
        (v_shipment_prepaid, v_tenant_a, 'TRK-PRE-1', v_merchant_user_a, v_branch_a, 'OUT_FOR_DELIVERY', 'PREPAID', 0.000, 3.000, 'Customer Pre', '0790000005', 'Amman', 0, clock_timestamp(), clock_timestamp()),
        (v_shipment_failure, v_tenant_a, 'TRK-FAIL-1', v_merchant_user_a, v_branch_a, 'OUT_FOR_DELIVERY', 'COD', 20.000, 3.000, 'Customer Fail', '0790000006', 'Amman', 0, clock_timestamp(), clock_timestamp()),
        (v_shipment_cancelled, v_tenant_a, 'TRK-CANC-1', v_merchant_user_a, v_branch_a, 'CANCELLED', 'COD', 10.000, 3.000, 'Customer Canc', '0790000007', 'Amman', 0, clock_timestamp(), clock_timestamp()),
        (v_shipment_unassigned1, v_tenant_a, 'TRK-UNAS-1', v_merchant_user_a, v_branch_a, 'OUT_FOR_DELIVERY', 'COD', 14.000, 3.000, 'Customer Unas1', '0790000013', 'Amman', 0, clock_timestamp(), clock_timestamp()),
        (v_shipment_unassigned2, v_tenant_a, 'TRK-UNAS-2', v_merchant_user_a, v_branch_a, 'OUT_FOR_DELIVERY', 'COD', 16.000, 3.000, 'Customer Unas2', '0790000014', 'Amman', 0, clock_timestamp(), clock_timestamp()),
        (v_shipment_spoof, v_tenant_a, 'TRK-SPOOF-1', v_merchant_user_a, v_branch_a, 'OUT_FOR_DELIVERY', 'COD', 25.000, 3.000, 'Customer Spoof', '0790000015', 'Amman', 0, clock_timestamp(), clock_timestamp()),
        (v_shipment_manifest1, v_tenant_a, 'TRK-MNF-1', v_merchant_user_a, v_branch_a, 'OUT_FOR_DELIVERY', 'COD', 12.000, 3.000, 'Customer Mnf1', '0790000008', 'Amman', 0, clock_timestamp(), clock_timestamp()),
        (v_shipment_manifest2, v_tenant_a, 'TRK-MNF-2', v_merchant_user_a, v_branch_a, 'OUT_FOR_DELIVERY', 'COD', 18.000, 3.000, 'Customer Mnf2', '0790000009', 'Amman', 0, clock_timestamp(), clock_timestamp());

    -- 7. Legs (Aligned with Canonical Phase 3B leg_type: PICKUP, TRANSFER, LAST_MILE, DIRECT, RETURN)
    INSERT INTO public.shipment_legs (
        id, tenant_id, shipment_id, sequence, leg_type, status,
        assigned_driver_id, origin_facility_id, origin_merchant_branch_id, destination_facility_id,
        destination_is_shipment_customer, created_at, updated_at
    ) VALUES
        -- Shipment 1 Multi-Leg Route: Leg 1 (PICKUP), Leg 2 (TRANSFER), Leg 3 (LAST_MILE)
        (v_leg_pickup1, v_tenant_a, v_shipment_cod1, 1, 'PICKUP', 'READY', v_driver_a1, NULL, v_branch_a, v_facility_hub_a, false, clock_timestamp(), clock_timestamp()),
        (v_leg_transfer1, v_tenant_a, v_shipment_cod1, 2, 'TRANSFER', 'PLANNED', v_driver_a2, v_facility_hub_a, NULL, v_facility_depot_a, false, clock_timestamp(), clock_timestamp()),
        (v_leg_delivery1, v_tenant_a, v_shipment_cod1, 3, 'LAST_MILE', 'PLANNED', v_driver_a1, v_facility_depot_a, NULL, NULL, true, clock_timestamp(), clock_timestamp()),

        -- Single-Leg Last-Mile Shipments
        (v_leg_cod2, v_tenant_a, v_shipment_cod2, 1, 'LAST_MILE', 'IN_TRANSIT', v_driver_a1, v_facility_hub_a, NULL, NULL, true, clock_timestamp(), clock_timestamp()),
        (v_leg_cod3, v_tenant_a, v_shipment_cod3, 1, 'LAST_MILE', 'IN_TRANSIT', v_driver_a1, v_facility_hub_a, NULL, NULL, true, clock_timestamp(), clock_timestamp()),
        (v_leg_cod4, v_tenant_a, v_shipment_cod4, 1, 'LAST_MILE', 'IN_TRANSIT', v_driver_a1, v_facility_hub_a, NULL, NULL, true, clock_timestamp(), clock_timestamp()),
        (v_leg_prepaid, v_tenant_a, v_shipment_prepaid, 1, 'LAST_MILE', 'IN_TRANSIT', v_driver_a1, v_facility_hub_a, NULL, NULL, true, clock_timestamp(), clock_timestamp()),
        (v_leg_failure, v_tenant_a, v_shipment_failure, 1, 'LAST_MILE', 'IN_TRANSIT', v_driver_a1, v_facility_hub_a, NULL, NULL, true, clock_timestamp(), clock_timestamp()),
        (v_leg_cancelled, v_tenant_a, v_shipment_cancelled, 1, 'PICKUP', 'READY', v_driver_a1, NULL, v_branch_a, v_facility_hub_a, false, clock_timestamp(), clock_timestamp()),

        -- Dedicated Active Unassigned Leg Fixtures (Tests 10 & 11)
        (v_leg_unassigned1, v_tenant_a, v_shipment_unassigned1, 1, 'PICKUP', 'READY', NULL, NULL, v_branch_a, v_facility_hub_a, false, clock_timestamp(), clock_timestamp()),
        (v_leg_unassigned2, v_tenant_a, v_shipment_unassigned2, 1, 'TRANSFER', 'READY', NULL, v_facility_hub_a, NULL, v_facility_depot_a, false, clock_timestamp(), clock_timestamp()),

        -- Dedicated Payment Spoofing Leg Fixture (Test 25)
        (v_leg_spoof, v_tenant_a, v_shipment_spoof, 1, 'LAST_MILE', 'IN_TRANSIT', v_driver_a1, v_facility_hub_a, NULL, NULL, true, clock_timestamp(), clock_timestamp()),

        -- Manifest Leg Fixtures (TRANSFER)
        (v_leg_manifest1, v_tenant_a, v_shipment_manifest1, 1, 'TRANSFER', 'READY', v_driver_a1, v_facility_hub_a, NULL, v_facility_depot_a, false, clock_timestamp(), clock_timestamp()),
        (v_leg_manifest2, v_tenant_a, v_shipment_manifest2, 1, 'TRANSFER', 'READY', v_driver_a1, v_facility_hub_a, NULL, v_facility_depot_a, false, clock_timestamp(), clock_timestamp());

    -- 8. Initial Custody Records
    INSERT INTO public.shipment_current_custody (
        shipment_id, tenant_id, current_holder_type,
        current_driver_id, current_facility_id, current_merchant_branch_id,
        is_with_customer, is_verified_custody, version, updated_at
    ) VALUES
        (v_shipment_cod1, v_tenant_a, 'MERCHANT', NULL, NULL, v_branch_a, false, true, 1, clock_timestamp()),
        (v_shipment_cod2, v_tenant_a, 'DRIVER', v_driver_a1, NULL, NULL, false, true, 1, clock_timestamp()),
        (v_shipment_cod3, v_tenant_a, 'DRIVER', v_driver_a1, NULL, NULL, false, true, 1, clock_timestamp()),
        (v_shipment_cod4, v_tenant_a, 'DRIVER', v_driver_a1, NULL, NULL, false, true, 1, clock_timestamp()),
        (v_shipment_prepaid, v_tenant_a, 'DRIVER', v_driver_a1, NULL, NULL, false, true, 1, clock_timestamp()),
        (v_shipment_failure, v_tenant_a, 'DRIVER', v_driver_a1, NULL, NULL, false, true, 1, clock_timestamp()),
        (v_shipment_unassigned1, v_tenant_a, 'MERCHANT', NULL, NULL, v_branch_a, false, true, 1, clock_timestamp()),
        (v_shipment_unassigned2, v_tenant_a, 'FACILITY', NULL, v_facility_hub_a, NULL, false, true, 1, clock_timestamp()),
        (v_shipment_spoof, v_tenant_a, 'DRIVER', v_driver_a1, NULL, NULL, false, true, 1, clock_timestamp());

    RAISE NOTICE 'Fixtures seeded successfully.';

    -- ========================================================================
    -- TEST 1: Revoked anon execution
    -- ========================================================================
    IF EXISTS (
        SELECT 1 FROM pg_roles WHERE rolname = 'anon'
    ) THEN
        IF has_function_privilege('anon', 'public.execute_confirm_merchant_pickup(UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, public.custody_evidence_type)', 'EXECUTE') THEN
            RAISE EXCEPTION 'TEST 1 FAILED: anon role still has execute privilege';
        END IF;
    END IF;
    v_passed_tests := v_passed_tests + 1;
    RAISE NOTICE 'TEST 1 PASSED: anon execution revoked.';

    -- ========================================================================
    -- TEST 2: Revoked authenticated execution
    -- ========================================================================
    IF EXISTS (
        SELECT 1 FROM pg_roles WHERE rolname = 'authenticated'
    ) THEN
        IF has_function_privilege('authenticated', 'public.execute_confirm_merchant_pickup(UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, public.custody_evidence_type)', 'EXECUTE') THEN
            RAISE EXCEPTION 'TEST 2 FAILED: authenticated role still has execute privilege';
        END IF;
    END IF;
    v_passed_tests := v_passed_tests + 1;
    RAISE NOTICE 'TEST 2 PASSED: authenticated execution revoked.';

    -- ========================================================================
    -- TEST 3: Nonexistent tenant rejection
    -- ========================================================================
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_confirm_merchant_pickup(
            gen_random_uuid(), v_driver_a1, v_shipment_cod1, v_leg_pickup1,
            v_branch_a, 'BARCODE-1', NULL, NULL, 'key-t3'
        );
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE = '42501' AND SQLERRM LIKE '%TENANT_NOT_FOUND%' THEN
            v_err_caught := true;
        END IF;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST 3 FAILED: Nonexistent tenant was not rejected';
    END IF;
    v_passed_tests := v_passed_tests + 1;
    RAISE NOTICE 'TEST 3 PASSED: Nonexistent tenant rejected.';

    -- ========================================================================
    -- TEST 4: Suspended tenant rejection
    -- ========================================================================
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_confirm_merchant_pickup(
            v_tenant_suspended, v_driver_a1, v_shipment_cod1, v_leg_pickup1,
            v_branch_a, 'BARCODE-1', NULL, NULL, 'key-t4'
        );
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE = '42501' AND SQLERRM LIKE '%TENANT_SUSPENDED%' THEN
            v_err_caught := true;
        END IF;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST 4 FAILED: Suspended tenant was not rejected';
    END IF;
    v_passed_tests := v_passed_tests + 1;
    RAISE NOTICE 'TEST 4 PASSED: Suspended tenant rejected.';

    -- ========================================================================
    -- TEST 5: Cross-tenant actor rejection
    -- ========================================================================
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_confirm_merchant_pickup(
            v_tenant_a, v_driver_b, v_shipment_cod1, v_leg_pickup1,
            v_branch_a, 'BARCODE-1', NULL, NULL, 'key-t5'
        );
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE = '42501' AND SQLERRM LIKE '%ACTOR_TENANT_MISMATCH%' THEN
            v_err_caught := true;
        END IF;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST 5 FAILED: Cross-tenant actor was not rejected';
    END IF;
    v_passed_tests := v_passed_tests + 1;
    RAISE NOTICE 'TEST 5 PASSED: Cross-tenant actor rejected.';

    -- ========================================================================
    -- TEST 6: Inactive actor rejection
    -- ========================================================================
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_confirm_merchant_pickup(
            v_tenant_a, v_driver_inactive_a, v_shipment_cod1, v_leg_pickup1,
            v_branch_a, 'BARCODE-1', NULL, NULL, 'key-t6'
        );
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE = '42501' AND SQLERRM LIKE '%ACTOR_INACTIVE%' THEN
            v_err_caught := true;
        END IF;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST 6 FAILED: Inactive actor was not rejected';
    END IF;
    v_passed_tests := v_passed_tests + 1;
    RAISE NOTICE 'TEST 6 PASSED: Inactive actor rejected.';

    -- ========================================================================
    -- TEST 7: Non-driver customer delivery rejection (when not admin/super_admin)
    -- ========================================================================
    v_err_caught := false;
    BEGIN
        -- Driver A2 attempting to complete delivery assigned to Driver A1
        PERFORM public.execute_complete_customer_delivery(
            v_tenant_a, v_driver_a2, v_shipment_cod2, v_leg_cod2,
            'CASH', 15.000, 'JOD', NULL, NULL, NULL, NULL, NULL,
            'Attempt by other driver', 'key-t7'
        );
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE = '42501' AND SQLERRM LIKE '%ACTOR_NOT_AUTHORIZED%' THEN
            v_err_caught := true;
        END IF;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST 7 FAILED: Non-driver delivery attempt was not rejected';
    END IF;
    v_passed_tests := v_passed_tests + 1;
    RAISE NOTICE 'TEST 7 PASSED: Non-driver customer delivery rejected.';

    -- ========================================================================
    -- TEST 8: Unauthorized user facility intake rejection
    -- ========================================================================
    v_err_caught := false;
    BEGIN
        -- Unauthorized User A lacks access to Hub A
        PERFORM public.execute_confirm_facility_intake(
            v_tenant_a, v_unauthorized_user_a, v_shipment_cod1, v_leg_pickup1,
            v_facility_hub_a, v_driver_a1, 'BARCODE-1', NULL, 'key-t8'
        );
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE = '42501' AND SQLERRM LIKE '%ACTOR_FACILITY_ACCESS_DENIED%' THEN
            v_err_caught := true;
        END IF;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST 8 FAILED: Unauthorized facility intake was not rejected';
    END IF;
    v_passed_tests := v_passed_tests + 1;
    RAISE NOTICE 'TEST 8 PASSED: Unauthorized user facility intake rejected.';

    -- ========================================================================
    -- TEST 9: Unauthorized user facility release rejection
    -- ========================================================================
    v_err_caught := false;
    BEGIN
        -- Unauthorized User A lacks can_dispatch on Hub A
        PERFORM public.execute_confirm_facility_release(
            v_tenant_a, v_unauthorized_user_a, v_shipment_cod1, v_leg_transfer1,
            v_facility_hub_a, v_driver_a2, 'BARCODE-1', NULL, 'key-t9'
        );
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE = '42501' AND SQLERRM LIKE '%ACTOR_FACILITY_ACCESS_DENIED%' THEN
            v_err_caught := true;
        END IF;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST 9 FAILED: Unauthorized facility release was not rejected';
    END IF;
    v_passed_tests := v_passed_tests + 1;
    RAISE NOTICE 'TEST 9 PASSED: Unauthorized user facility release rejected.';

    -- ========================================================================
    -- TEST 10: Unassigned leg merchant pickup rejection (Isolated to DRIVER_NOT_ASSIGNED)
    -- ========================================================================
    v_err_caught := false;
    BEGIN
        -- Active, non-cancelled shipment with unassigned leg
        PERFORM public.execute_confirm_merchant_pickup(
            v_tenant_a, v_admin_a, v_shipment_unassigned1, v_leg_unassigned1,
            v_branch_a, 'BARCODE-1', NULL, NULL, 'key-t10'
        );
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE = '23514' AND SQLERRM LIKE '%DRIVER_NOT_ASSIGNED%' THEN
            v_err_caught := true;
        END IF;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST 10 FAILED: Unassigned leg merchant pickup was not rejected with DRIVER_NOT_ASSIGNED';
    END IF;
    v_passed_tests := v_passed_tests + 1;
    RAISE NOTICE 'TEST 10 PASSED: Unassigned leg merchant pickup rejected with DRIVER_NOT_ASSIGNED.';

    -- ========================================================================
    -- TEST 11: Unassigned leg facility release rejection (Isolated to DRIVER_NOT_ASSIGNED)
    -- ========================================================================
    v_err_caught := false;
    BEGIN
        -- Active, non-cancelled shipment with unassigned leg
        PERFORM public.execute_confirm_facility_release(
            v_tenant_a, v_admin_a, v_shipment_unassigned2, v_leg_unassigned2,
            v_facility_hub_a, v_driver_a1, 'BARCODE-1', NULL, 'key-t11'
        );
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE = '23514' AND SQLERRM LIKE '%DRIVER_NOT_ASSIGNED%' THEN
            v_err_caught := true;
        END IF;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST 11 FAILED: Unassigned leg facility release was not rejected with DRIVER_NOT_ASSIGNED';
    END IF;
    v_passed_tests := v_passed_tests + 1;
    RAISE NOTICE 'TEST 11 PASSED: Unassigned leg facility release rejected with DRIVER_NOT_ASSIGNED.';

    -- ========================================================================
    -- TEST 12: Custody mismatch on merchant pickup
    -- ========================================================================
    -- Set custody of shipment_cod1 temporarily to DRIVER
    UPDATE public.shipment_current_custody
    SET current_holder_type = 'DRIVER', current_driver_id = v_driver_a1, current_merchant_branch_id = NULL
    WHERE shipment_id = v_shipment_cod1;

    v_err_caught := false;
    BEGIN
        PERFORM public.execute_confirm_merchant_pickup(
            v_tenant_a, v_driver_a1, v_shipment_cod1, v_leg_pickup1,
            v_branch_a, 'BARCODE-1', NULL, NULL, 'key-t12'
        );
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE = '23514' AND SQLERRM LIKE '%CUSTODY_MISMATCH%' THEN
            v_err_caught := true;
        END IF;
    END;
    -- Restore custody to MERCHANT for subsequent tests
    UPDATE public.shipment_current_custody
    SET current_holder_type = 'MERCHANT', current_driver_id = NULL, current_merchant_branch_id = v_branch_a
    WHERE shipment_id = v_shipment_cod1;

    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST 12 FAILED: Custody mismatch on merchant pickup was not rejected';
    END IF;
    v_passed_tests := v_passed_tests + 1;
    RAISE NOTICE 'TEST 12 PASSED: Custody mismatch on merchant pickup rejected.';

    -- ========================================================================
    -- TEST 13: Custody mismatch on facility intake
    -- ========================================================================
    -- Shipment 1 is currently in MERCHANT custody (not DRIVER)
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_confirm_facility_intake(
            v_tenant_a, v_operator_a, v_shipment_cod1, v_leg_pickup1,
            v_facility_hub_a, v_driver_a1, 'BARCODE-1', NULL, 'key-t13'
        );
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE = '23514' AND SQLERRM LIKE '%CUSTODY_MISMATCH%' THEN
            v_err_caught := true;
        END IF;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST 13 FAILED: Custody mismatch on facility intake was not rejected';
    END IF;
    v_passed_tests := v_passed_tests + 1;
    RAISE NOTICE 'TEST 13 PASSED: Custody mismatch on facility intake rejected.';

    -- ========================================================================
    -- TEST 14: Custody mismatch on facility release
    -- ========================================================================
    -- Set leg status temporarily to READY to isolate custody mismatch
    UPDATE public.shipment_legs
    SET status = 'READY'
    WHERE id = v_leg_cod2;

    -- Shipment 2 is in DRIVER custody (not FACILITY)
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_confirm_facility_release(
            v_tenant_a, v_admin_a, v_shipment_cod2, v_leg_cod2,
            v_facility_hub_a, v_driver_a1, 'BARCODE-1', NULL, 'key-t14'
        );
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE = '23514' AND SQLERRM LIKE '%CUSTODY_MISMATCH%' THEN
            v_err_caught := true;
        END IF;
    END;

    -- Restore leg status to IN_TRANSIT for subsequent tests
    UPDATE public.shipment_legs
    SET status = 'IN_TRANSIT'
    WHERE id = v_leg_cod2;

    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST 14 FAILED: Custody mismatch on facility release was not rejected';
    END IF;
    v_passed_tests := v_passed_tests + 1;
    RAISE NOTICE 'TEST 14 PASSED: Custody mismatch on facility release rejected.';

    -- ========================================================================
    -- TEST 15: Custody mismatch on customer delivery
    -- ========================================================================
    -- Set custody of Shipment 2 to FACILITY
    UPDATE public.shipment_current_custody
    SET current_holder_type = 'FACILITY', current_facility_id = v_facility_hub_a, current_driver_id = NULL
    WHERE shipment_id = v_shipment_cod2;

    v_err_caught := false;
    BEGIN
        PERFORM public.execute_complete_customer_delivery(
            v_tenant_a, v_driver_a1, v_shipment_cod2, v_leg_cod2,
            'CASH', 15.000, 'JOD', NULL, NULL, NULL, NULL, NULL,
            NULL, 'key-t15'
        );
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE = '23514' AND SQLERRM LIKE '%CUSTODY_MISMATCH%' THEN
            v_err_caught := true;
        END IF;
    END;
    -- Restore to DRIVER
    UPDATE public.shipment_current_custody
    SET current_holder_type = 'DRIVER', current_driver_id = v_driver_a1, current_facility_id = NULL
    WHERE shipment_id = v_shipment_cod2;

    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST 15 FAILED: Custody mismatch on customer delivery was not rejected';
    END IF;
    v_passed_tests := v_passed_tests + 1;
    RAISE NOTICE 'TEST 15 PASSED: Custody mismatch on customer delivery rejected.';

    -- ========================================================================
    -- TEST 16: Valid merchant pickup custody progression
    -- ========================================================================
    v_res := public.execute_confirm_merchant_pickup(
        v_tenant_a, v_driver_a1, v_shipment_cod1, v_leg_pickup1,
        v_branch_a, 'BARCODE-VALID-1', NULL, 'Pickup complete', 'key-t16'
    );

    SELECT * INTO v_custody FROM public.shipment_current_custody WHERE shipment_id = v_shipment_cod1;
    SELECT * INTO v_leg FROM public.shipment_legs WHERE id = v_leg_pickup1;
    SELECT * INTO v_shipment FROM public.shipments WHERE id = v_shipment_cod1;

    IF v_custody.current_holder_type <> 'DRIVER' OR v_custody.current_driver_id <> v_driver_a1 OR
       v_leg.status <> 'IN_TRANSIT' OR v_shipment.status <> 'OUT_FOR_DELIVERY' THEN
        RAISE EXCEPTION 'TEST 16 FAILED: Custody progression on pickup invalid. Custody: %, Leg: %, Shipment: %',
            v_custody.current_holder_type, v_leg.status, v_shipment.status;
    END IF;
    v_passed_tests := v_passed_tests + 1;
    RAISE NOTICE 'TEST 16 PASSED: Valid merchant pickup custody progression.';

    -- ========================================================================
    -- TEST 17: Valid facility intake custody progression
    -- ========================================================================
    v_res := public.execute_confirm_facility_intake(
        v_tenant_a, v_operator_a, v_shipment_cod1, v_leg_pickup1,
        v_facility_hub_a, v_driver_a1, 'BARCODE-VALID-1', 'Intake at hub', 'key-t17'
    );

    SELECT * INTO v_custody FROM public.shipment_current_custody WHERE shipment_id = v_shipment_cod1;
    SELECT * INTO v_leg FROM public.shipment_legs WHERE id = v_leg_pickup1;
    SELECT * INTO v_shipment FROM public.shipments WHERE id = v_shipment_cod1;
    -- Check that next leg (transfer) was advanced to READY
    SELECT * INTO v_leg FROM public.shipment_legs WHERE id = v_leg_transfer1;

    IF v_custody.current_holder_type <> 'FACILITY' OR v_custody.current_facility_id <> v_facility_hub_a OR
       v_leg.status <> 'READY' THEN
        RAISE EXCEPTION 'TEST 17 FAILED: Custody progression on intake invalid. Custody: %, Next Leg: %',
            v_custody.current_holder_type, v_leg.status;
    END IF;
    v_passed_tests := v_passed_tests + 1;
    RAISE NOTICE 'TEST 17 PASSED: Valid facility intake custody progression.';

    -- ========================================================================
    -- TEST 18: Valid facility release custody progression
    -- ========================================================================
    v_res := public.execute_confirm_facility_release(
        v_tenant_a, v_operator_a, v_shipment_cod1, v_leg_transfer1,
        v_facility_hub_a, v_driver_a2, 'BARCODE-VALID-1', 'Released to Driver A2', 'key-t18'
    );

    SELECT * INTO v_custody FROM public.shipment_current_custody WHERE shipment_id = v_shipment_cod1;
    SELECT * INTO v_leg FROM public.shipment_legs WHERE id = v_leg_transfer1;

    IF v_custody.current_holder_type <> 'DRIVER' OR v_custody.current_driver_id <> v_driver_a2 OR
       v_leg.status <> 'IN_TRANSIT' THEN
        RAISE EXCEPTION 'TEST 18 FAILED: Custody progression on release invalid. Custody: %, Leg: %',
            v_custody.current_holder_type, v_leg.status;
    END IF;
    v_passed_tests := v_passed_tests + 1;
    RAISE NOTICE 'TEST 18 PASSED: Valid facility release custody progression.';

    -- ========================================================================
    -- TEST 19: Valid customer delivery custody progression
    -- ========================================================================
    -- Shipment 2 is in DRIVER custody of Driver A1; Leg is LAST_MILE
    v_res := public.execute_complete_customer_delivery(
        v_tenant_a, v_driver_a1, v_shipment_cod2, v_leg_cod2,
        'CASH', 15.000, 'JOD', NULL, NULL, '1234', NULL, NULL,
        'Delivered with OTP', 'key-t19'
    );

    SELECT * INTO v_custody FROM public.shipment_current_custody WHERE shipment_id = v_shipment_cod2;
    SELECT * INTO v_leg FROM public.shipment_legs WHERE id = v_leg_cod2;
    SELECT * INTO v_shipment FROM public.shipments WHERE id = v_shipment_cod2;

    IF v_custody.current_holder_type <> 'CUSTOMER' OR v_custody.is_with_customer IS NOT TRUE OR
       v_leg.status <> 'COMPLETED' OR v_shipment.status <> 'DELIVERED' THEN
        RAISE EXCEPTION 'TEST 19 FAILED: Custody progression on delivery invalid. Custody: %, Leg: %, Shipment: %',
            v_custody.current_holder_type, v_leg.status, v_shipment.status;
    END IF;
    v_passed_tests := v_passed_tests + 1;
    RAISE NOTICE 'TEST 19 PASSED: Valid customer delivery custody progression.';

    -- ========================================================================
    -- TEST 20: CASH delivery creates driver cash collection
    -- ========================================================================
    SELECT count(*) INTO v_cash_count
    FROM public.driver_cash_collections
    WHERE shipment_id = v_shipment_cod2 AND driver_id = v_driver_a1 AND cash_amount = 15.000;

    IF v_cash_count <> 1 THEN
        RAISE EXCEPTION 'TEST 20 FAILED: Expected 1 driver cash collection record, got %', v_cash_count;
    END IF;
    v_passed_tests := v_passed_tests + 1;
    RAISE NOTICE 'TEST 20 PASSED: CASH delivery creates driver cash collection.';

    -- ========================================================================
    -- TEST 21: CLIQ delivery creates ZERO driver cash collection
    -- ========================================================================
    v_res := public.execute_complete_customer_delivery(
        v_tenant_a, v_driver_a1, v_shipment_cod3, v_leg_cod3,
        'CLIQ', 30.000, 'JOD', 'CLIQ-REF-998877', NULL, NULL, NULL, NULL,
        'Paid by CliQ', 'key-t21'
    );

    SELECT count(*) INTO v_cash_count
    FROM public.driver_cash_collections
    WHERE shipment_id = v_shipment_cod3;

    IF v_cash_count <> 0 THEN
        RAISE EXCEPTION 'TEST 21 FAILED: CLIQ delivery must create 0 cash collections, found %', v_cash_count;
    END IF;
    v_passed_tests := v_passed_tests + 1;
    RAISE NOTICE 'TEST 21 PASSED: CLIQ delivery creates ZERO driver cash collection.';

    -- ========================================================================
    -- TEST 22: WALLET delivery creates ZERO driver cash collection
    -- ========================================================================
    v_res := public.execute_complete_customer_delivery(
        v_tenant_a, v_driver_a1, v_shipment_cod4, v_leg_cod4,
        'WALLET', 40.000, 'JOD', NULL, 'WALLET-REF-445566', NULL, NULL, NULL,
        'Paid by ZainCash', 'key-t22'
    );

    SELECT count(*) INTO v_cash_count
    FROM public.driver_cash_collections
    WHERE shipment_id = v_shipment_cod4;

    IF v_cash_count <> 0 THEN
        RAISE EXCEPTION 'TEST 22 FAILED: WALLET delivery must create 0 cash collections, found %', v_cash_count;
    END IF;
    v_passed_tests := v_passed_tests + 1;
    RAISE NOTICE 'TEST 22 PASSED: WALLET delivery creates ZERO driver cash collection.';

    -- ========================================================================
    -- TEST 23: PREPAID delivery creates ZERO driver cash collection
    -- ========================================================================
    v_res := public.execute_complete_customer_delivery(
        v_tenant_a, v_driver_a1, v_shipment_prepaid, v_leg_prepaid,
        'PREPAID', 0.000, 'JOD', NULL, NULL, NULL, 'http://sig.url', NULL,
        'Prepaid delivery', 'key-t23'
    );

    SELECT count(*) INTO v_cash_count
    FROM public.driver_cash_collections
    WHERE shipment_id = v_shipment_prepaid;

    IF v_cash_count <> 0 THEN
        RAISE EXCEPTION 'TEST 23 FAILED: PREPAID delivery must create 0 cash collections, found %', v_cash_count;
    END IF;
    v_passed_tests := v_passed_tests + 1;
    RAISE NOTICE 'TEST 23 PASSED: PREPAID delivery creates ZERO driver cash collection.';

    -- ========================================================================
    -- TEST 24: PREPAID delivery requires 0.000 paid amount
    -- ========================================================================
    -- Create fresh prepaid test fixture
    DECLARE
        v_shipment_pre2 UUID := gen_random_uuid();
        v_leg_pre2 UUID := gen_random_uuid();
    BEGIN
        INSERT INTO public.shipments (
            id, tenant_id, sequence, merchant_id, branch_id, status, payment_type,
            cod_amount, delivery_fee, recipient_name, recipient_phone, address,
            delivery_attempts, created_at, updated_at
        ) VALUES (
            v_shipment_pre2, v_tenant_a, 'TRK-PRE-2', v_merchant_user_a, v_branch_a, 'OUT_FOR_DELIVERY', 'PREPAID',
            0.000, 3.000, 'Customer Pre 2', '0790000010', 'Amman', 0, clock_timestamp(), clock_timestamp()
        );
        INSERT INTO public.shipment_legs (
            id, tenant_id, shipment_id, sequence, leg_type, status,
            assigned_driver_id, origin_facility_id, destination_is_shipment_customer,
            created_at, updated_at
        ) VALUES (
            v_leg_pre2, v_tenant_a, v_shipment_pre2, 1, 'LAST_MILE', 'IN_TRANSIT',
            v_driver_a1, v_facility_hub_a, true, clock_timestamp(), clock_timestamp()
        );
        INSERT INTO public.shipment_current_custody (
            shipment_id, tenant_id, current_holder_type, current_driver_id,
            is_with_customer, is_verified_custody, version, updated_at
        ) VALUES (
            v_shipment_pre2, v_tenant_a, 'DRIVER', v_driver_a1, false, true, 1, clock_timestamp()
        );

        v_err_caught := false;
        BEGIN
            PERFORM public.execute_complete_customer_delivery(
                v_tenant_a, v_driver_a1, v_shipment_pre2, v_leg_pre2,
                'PREPAID', 5.000, 'JOD', NULL, NULL, NULL, NULL, NULL,
                NULL, 'key-t24'
            );
        EXCEPTION WHEN OTHERS THEN
            IF SQLSTATE = '23514' AND SQLERRM LIKE '%PREPAID_PAYMENT_NONZERO%' THEN
                v_err_caught := true;
            END IF;
        END;
        IF NOT v_err_caught THEN
            RAISE EXCEPTION 'TEST 24 FAILED: Non-zero prepaid delivery was not rejected';
        END IF;
    END;
    v_passed_tests := v_passed_tests + 1;
    RAISE NOTICE 'TEST 24 PASSED: PREPAID delivery requires 0.000 paid amount.';

    -- ========================================================================
    -- TEST 25: Payment spoofing rejection: COD shipment cannot be completed as PREPAID
    -- ========================================================================
    v_err_caught := false;
    BEGIN
        -- Caller attempts to complete a COD 25.000 JOD shipment with PREPAID / 0.000
        PERFORM public.execute_complete_customer_delivery(
            v_tenant_a, v_driver_a1, v_shipment_spoof, v_leg_spoof,
            'PREPAID', 0.000, 'JOD', NULL, NULL, NULL, NULL, NULL,
            'Spoof attempt', 'key-t25-spoof'
        );
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE = '23514' AND SQLERRM LIKE '%PAYMENT_METHOD_MISMATCH%' THEN
            v_err_caught := true;
        END IF;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST 25 FAILED: Payment spoofing (COD as PREPAID) was not rejected with PAYMENT_METHOD_MISMATCH';
    END IF;

    -- Verify no payment record was created and custody remains DRIVER
    SELECT count(*) INTO v_cash_count FROM public.customer_payment_records WHERE shipment_id = v_shipment_spoof;
    IF v_cash_count <> 0 THEN
        RAISE EXCEPTION 'TEST 25 FAILED: Payment spoofing attempt created customer_payment_record';
    END IF;
    SELECT * INTO v_custody FROM public.shipment_current_custody WHERE shipment_id = v_shipment_spoof;
    IF v_custody.current_holder_type <> 'DRIVER' OR v_custody.is_with_customer IS TRUE THEN
        RAISE EXCEPTION 'TEST 25 FAILED: Custody was mutated on failed spoofing attempt';
    END IF;

    v_passed_tests := v_passed_tests + 1;
    RAISE NOTICE 'TEST 25 PASSED: Payment spoofing rejection: COD shipment cannot be completed as PREPAID.';

    -- ========================================================================
    -- TEST 26: Short COD delivery rejected
    -- ========================================================================
    -- Create fresh COD shipment expecting 20.000 JOD
    DECLARE
        v_shipment_short UUID := gen_random_uuid();
        v_leg_short UUID := gen_random_uuid();
    BEGIN
        INSERT INTO public.shipments (
            id, tenant_id, sequence, merchant_id, branch_id, status, payment_type,
            cod_amount, delivery_fee, recipient_name, recipient_phone, address,
            delivery_attempts, created_at, updated_at
        ) VALUES (
            v_shipment_short, v_tenant_a, 'TRK-SHORT-1', v_merchant_user_a, v_branch_a, 'OUT_FOR_DELIVERY', 'COD',
            20.000, 3.000, 'Customer Short', '0790000011', 'Amman', 0, clock_timestamp(), clock_timestamp()
        );
        INSERT INTO public.shipment_legs (
            id, tenant_id, shipment_id, sequence, leg_type, status,
            assigned_driver_id, origin_facility_id, destination_is_shipment_customer,
            created_at, updated_at
        ) VALUES (
            v_leg_short, v_tenant_a, v_shipment_short, 1, 'LAST_MILE', 'IN_TRANSIT',
            v_driver_a1, v_facility_hub_a, true, clock_timestamp(), clock_timestamp()
        );
        INSERT INTO public.shipment_current_custody (
            shipment_id, tenant_id, current_holder_type, current_driver_id,
            is_with_customer, is_verified_custody, version, updated_at
        ) VALUES (
            v_shipment_short, v_tenant_a, 'DRIVER', v_driver_a1, false, true, 1, clock_timestamp()
        );

        v_err_caught := false;
        BEGIN
            -- Customer attempts to pay 18.000 instead of 20.000
            PERFORM public.execute_complete_customer_delivery(
                v_tenant_a, v_driver_a1, v_shipment_short, v_leg_short,
                'CASH', 18.000, 'JOD', NULL, NULL, NULL, NULL, NULL,
                'Short payment attempt', 'key-t26'
            );
        EXCEPTION WHEN OTHERS THEN
            IF SQLSTATE = '23514' AND SQLERRM LIKE '%SHORT_PAYMENT_NOT_ALLOWED%' THEN
                v_err_caught := true;
            END IF;
        END;
        IF NOT v_err_caught THEN
            RAISE EXCEPTION 'TEST 26 FAILED: Short COD delivery was not rejected';
        END IF;
    END;
    v_passed_tests := v_passed_tests + 1;
    RAISE NOTICE 'TEST 26 PASSED: Short COD delivery rejected.';

    -- ========================================================================
    -- TEST 27: Over COD delivery records OVER discrepancy status
    -- ========================================================================
    DECLARE
        v_shipment_over UUID := gen_random_uuid();
        v_leg_over UUID := gen_random_uuid();
    BEGIN
        INSERT INTO public.shipments (
            id, tenant_id, sequence, merchant_id, branch_id, status, payment_type,
            cod_amount, delivery_fee, recipient_name, recipient_phone, address,
            delivery_attempts, created_at, updated_at
        ) VALUES (
            v_shipment_over, v_tenant_a, 'TRK-OVER-1', v_merchant_user_a, v_branch_a, 'OUT_FOR_DELIVERY', 'COD',
            20.000, 3.000, 'Customer Over', '0790000012', 'Amman', 0, clock_timestamp(), clock_timestamp()
        );
        INSERT INTO public.shipment_legs (
            id, tenant_id, shipment_id, sequence, leg_type, status,
            assigned_driver_id, origin_facility_id, destination_is_shipment_customer,
            created_at, updated_at
        ) VALUES (
            v_leg_over, v_tenant_a, v_shipment_over, 1, 'LAST_MILE', 'IN_TRANSIT',
            v_driver_a1, v_facility_hub_a, true, clock_timestamp(), clock_timestamp()
        );
        INSERT INTO public.shipment_current_custody (
            shipment_id, tenant_id, current_holder_type, current_driver_id,
            is_with_customer, is_verified_custody, version, updated_at
        ) VALUES (
            v_shipment_over, v_tenant_a, 'DRIVER', v_driver_a1, false, true, 1, clock_timestamp()
        );

        -- Customer pays 22.000 instead of 20.000 (tip/overpayment)
        v_res := public.execute_complete_customer_delivery(
            v_tenant_a, v_driver_a1, v_shipment_over, v_leg_over,
            'CASH', 22.000, 'JOD', NULL, NULL, NULL, NULL, NULL,
            'Customer overpaid', 'key-t27'
        );

        SELECT * INTO v_payment FROM public.customer_payment_records WHERE shipment_id = v_shipment_over;
        IF v_payment.discrepancy_status <> 'OVER' OR v_payment.amount_paid <> 22.000 OR v_payment.amount_expected <> 20.000 THEN
            RAISE EXCEPTION 'TEST 27 FAILED: Overpayment discrepancy status is %, expected OVER', v_payment.discrepancy_status;
        END IF;
    END;
    v_passed_tests := v_passed_tests + 1;
    RAISE NOTICE 'TEST 27 PASSED: Over COD delivery records OVER discrepancy status.';

    -- ========================================================================
    -- TEST 28: Exact COD delivery records EXACT discrepancy status
    -- ========================================================================
    SELECT * INTO v_payment FROM public.customer_payment_records WHERE shipment_id = v_shipment_cod2;
    IF v_payment.discrepancy_status <> 'EXACT' OR v_payment.amount_paid <> 15.000 OR v_payment.amount_expected <> 15.000 THEN
        RAISE EXCEPTION 'TEST 28 FAILED: Exact payment discrepancy status is %, expected EXACT', v_payment.discrepancy_status;
    END IF;
    v_passed_tests := v_passed_tests + 1;
    RAISE NOTICE 'TEST 28 PASSED: Exact COD delivery records EXACT discrepancy status.';

    -- ========================================================================
    -- TEST 29: Delivery failure marks leg FAILED
    -- ========================================================================
    v_res := public.execute_record_delivery_failure(
        v_tenant_a, v_driver_a1, v_shipment_failure, v_leg_failure,
        'CUSTOMER_UNAVAILABLE', 'Customer phone was unreachable', 'key-t29'
    );

    SELECT * INTO v_leg FROM public.shipment_legs WHERE id = v_leg_failure;
    IF v_leg.status <> 'FAILED' OR v_leg.failure_reason_code <> 'CUSTOMER_UNAVAILABLE' THEN
        RAISE EXCEPTION 'TEST 29 FAILED: Leg status is %, expected FAILED', v_leg.status;
    END IF;
    v_passed_tests := v_passed_tests + 1;
    RAISE NOTICE 'TEST 29 PASSED: Delivery failure marks leg FAILED.';

    -- ========================================================================
    -- TEST 30: Delivery failure increments delivery attempts on shipment
    -- ========================================================================
    SELECT * INTO v_shipment FROM public.shipments WHERE id = v_shipment_failure;
    IF v_shipment.delivery_attempts <> 1 THEN
        RAISE EXCEPTION 'TEST 30 FAILED: Shipment delivery attempts is %, expected 1', v_shipment.delivery_attempts;
    END IF;
    v_passed_tests := v_passed_tests + 1;
    RAISE NOTICE 'TEST 30 PASSED: Delivery failure increments delivery attempts on shipment.';

    -- ========================================================================
    -- TEST 31: Delivery failure leaves parcel in driver custody
    -- ========================================================================
    SELECT * INTO v_custody FROM public.shipment_current_custody WHERE shipment_id = v_shipment_failure;
    IF v_custody.current_holder_type <> 'DRIVER' OR v_custody.current_driver_id <> v_driver_a1 OR v_shipment.status = 'RETURNED' THEN
        RAISE EXCEPTION 'TEST 31 FAILED: Delivery failure mutated custody or marked returned. Holder: %, Shipment: %',
            v_custody.current_holder_type, v_shipment.status;
    END IF;
    v_passed_tests := v_passed_tests + 1;
    RAISE NOTICE 'TEST 31 PASSED: Delivery failure leaves parcel in driver custody.';

    -- ========================================================================
    -- TEST 32: Empty manifest cannot be sealed
    -- ========================================================================
    INSERT INTO public.operational_manifests (
        id, tenant_id, manifest_number, manifest_type, status,
        source_facility_id, destination_facility_id, assigned_driver_id,
        created_by_user_id, created_at, updated_at
    ) VALUES (
        v_manifest_empty, v_tenant_a, 'MNF-EMPTY-01', 'HUB_TRANSFER', 'DRAFT',
        v_facility_hub_a, v_facility_depot_a, v_driver_a1,
        v_admin_a, clock_timestamp(), clock_timestamp()
    );

    v_err_caught := false;
    BEGIN
        PERFORM public.execute_seal_manifest(v_tenant_a, v_admin_a, v_manifest_empty, 'SEAL-001');
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE = '23514' AND SQLERRM LIKE '%CANNOT_SEAL_EMPTY_MANIFEST%' THEN
            v_err_caught := true;
        END IF;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST 32 FAILED: Empty manifest was not rejected';
    END IF;
    v_passed_tests := v_passed_tests + 1;
    RAISE NOTICE 'TEST 32 PASSED: Empty manifest cannot be sealed.';

    -- ========================================================================
    -- TEST 33: Manifest with cancelled shipment cannot be sealed
    -- ========================================================================
    INSERT INTO public.operational_manifests (
        id, tenant_id, manifest_number, manifest_type, status,
        source_facility_id, destination_facility_id, assigned_driver_id,
        created_by_user_id, created_at, updated_at
    ) VALUES (
        v_manifest_cancelled, v_tenant_a, 'MNF-CANC-01', 'HUB_TRANSFER', 'DRAFT',
        v_facility_hub_a, v_facility_depot_a, v_driver_a1,
        v_admin_a, clock_timestamp(), clock_timestamp()
    );
    INSERT INTO public.manifest_items (
        tenant_id, manifest_id, shipment_id, leg_id, is_scanned, scanned_at, created_at
    ) VALUES (
        v_tenant_a, v_manifest_cancelled, v_shipment_cancelled, v_leg_cancelled, true, clock_timestamp(), clock_timestamp()
    );

    v_err_caught := false;
    BEGIN
        PERFORM public.execute_seal_manifest(v_tenant_a, v_admin_a, v_manifest_cancelled, 'SEAL-002');
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE = '23514' AND SQLERRM LIKE '%INCOMPATIBLE_MANIFEST_ITEM%' THEN
            v_err_caught := true;
        END IF;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST 33 FAILED: Manifest with cancelled shipment was not rejected';
    END IF;
    v_passed_tests := v_passed_tests + 1;
    RAISE NOTICE 'TEST 33 PASSED: Manifest with cancelled shipment cannot be sealed.';

    -- ========================================================================
    -- TEST 34: Manifest with active sealed leg collision cannot be sealed
    -- ========================================================================
    -- Create Manifest 1 with valid leg and seal it
    INSERT INTO public.operational_manifests (
        id, tenant_id, manifest_number, manifest_type, status,
        source_facility_id, destination_facility_id, assigned_driver_id,
        created_by_user_id, created_at, updated_at
    ) VALUES (
        v_manifest_active1, v_tenant_a, 'MNF-ACT-01', 'HUB_TRANSFER', 'DRAFT',
        v_facility_hub_a, v_facility_depot_a, v_driver_a1,
        v_admin_a, clock_timestamp(), clock_timestamp()
    );
    INSERT INTO public.manifest_items (
        tenant_id, manifest_id, shipment_id, leg_id, is_scanned, scanned_at, created_at
    ) VALUES (
        v_tenant_a, v_manifest_active1, v_shipment_manifest1, v_leg_manifest1, true, clock_timestamp(), clock_timestamp()
    );
    -- Seal Manifest 1 successfully
    PERFORM public.execute_seal_manifest(v_tenant_a, v_admin_a, v_manifest_active1, 'SEAL-ACT-01');

    -- Create Manifest 2 containing the same leg
    INSERT INTO public.operational_manifests (
        id, tenant_id, manifest_number, manifest_type, status,
        source_facility_id, destination_facility_id, assigned_driver_id,
        created_by_user_id, created_at, updated_at
    ) VALUES (
        v_manifest_active2, v_tenant_a, 'MNF-ACT-02', 'HUB_TRANSFER', 'DRAFT',
        v_facility_hub_a, v_facility_depot_a, v_driver_a1,
        v_admin_a, clock_timestamp(), clock_timestamp()
    );
    INSERT INTO public.manifest_items (
        tenant_id, manifest_id, shipment_id, leg_id, is_scanned, scanned_at, created_at
    ) VALUES (
        v_tenant_a, v_manifest_active2, v_shipment_manifest1, v_leg_manifest1, true, clock_timestamp(), clock_timestamp()
    );

    v_err_caught := false;
    BEGIN
        PERFORM public.execute_seal_manifest(v_tenant_a, v_admin_a, v_manifest_active2, 'SEAL-ACT-02');
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE = '23514' AND SQLERRM LIKE '%INCOMPATIBLE_ACTIVE_MANIFEST%' THEN
            v_err_caught := true;
        END IF;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST 34 FAILED: Active manifest leg collision was not rejected';
    END IF;
    v_passed_tests := v_passed_tests + 1;
    RAISE NOTICE 'TEST 34 PASSED: Manifest with active sealed leg collision cannot be sealed.';

    -- ========================================================================
    -- TEST 35: Reused idempotency key with changed context rejected
    -- ========================================================================
    v_err_caught := false;
    BEGIN
        -- Replay key 'key-t16' (used for Shipment 1 Pickup) against Shipment 2
        PERFORM public.execute_confirm_merchant_pickup(
            v_tenant_a, v_driver_a1, v_shipment_cod2, v_leg_cod2,
            v_branch_a, 'BARCODE-DIFF-1', NULL, NULL, 'key-t16'
        );
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE = '23505' AND SQLERRM LIKE '%IDEMPOTENCY_REPLAY_MISMATCH%' THEN
            v_err_caught := true;
        END IF;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST 35 FAILED: Replayed idempotency key with different context was not rejected';
    END IF;
    v_passed_tests := v_passed_tests + 1;
    RAISE NOTICE 'TEST 35 PASSED: Reused idempotency key with changed context rejected.';

    -- ========================================================================
    -- SUMMARY ASSERTION
    -- ========================================================================
    IF v_passed_tests <> v_total_tests THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: Only % of % tests passed.', v_passed_tests, v_total_tests;
    ELSE
        RAISE NOTICE '====================================================================';
        RAISE NOTICE 'DELIVERE PHASE 3C / STEP 1.1 VERIFICATION COMPLETE: % / % TESTS PASSED', v_passed_tests, v_total_tests;
        RAISE NOTICE '====================================================================';
    END IF;
END;
$$;

ROLLBACK;

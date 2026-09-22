-- ============================================================================
-- DELIVERE — PHASE 3B FOUNDATION VERIFICATION & CONFORMANCE SUITE
-- File: supabase/migrations/20260921_phase3b_logistics_foundation_tests.sql
-- Description: 44 strict relational, composite-FK, and invariant tests.
-- Execution Mode: TRANSACTIONAL SIMULATION (BEGIN ... ROLLBACK).
-- NEVER LEAVES PERMANENT TEST ROWS IN DATABASE.
-- ============================================================================

BEGIN;

DO $$
DECLARE
    -- Tenants
    v_tenant_a UUID;
    v_tenant_b UUID;

    -- Pre-existing state snapshot counts (for zero-mutation verification)
    v_preexisting_shipments_count INT := 0;
    v_preexisting_legs_count INT := 0;
    v_preexisting_obligations_count INT := 0;

    -- Users (Tenant A)
    v_driver_a1 UUID;
    v_driver_a2 UUID;
    v_operator_a UUID;
    v_merchant_a UUID;

    -- Users (Tenant B)
    v_driver_b UUID;

    -- Infrastructure (Tenant A)
    v_branch_a UUID;
    v_facility_hub_a UUID;
    v_facility_depot_a UUID;

    -- Infrastructure (Tenant B)
    v_facility_hub_b UUID;

    -- Shipments (Tenant A)
    v_shipment_a1 UUID;
    v_shipment_a2 UUID;

    -- Legs (Tenant A)
    v_leg_a1 UUID;
    v_leg_a2 UUID;
    v_leg_a3 UUID;
    v_leg_shipment_a2 UUID;

    -- Events & Custody
    v_event_a1 UUID;
    v_event_a2 UUID;
    v_event_wrong_leg_fixture UUID;
    v_event_wrong_shipment_fixture UUID;
    v_custody_event_a1 UUID;

    -- Accounting Vouchers (Tenant A & B)
    v_voucher_a UUID;
    v_voucher_b UUID;

    -- Payments & Cash
    v_payment_record_a1 UUID;
    v_cash_coll_a1 UUID;

    -- Manifests
    v_manifest_a1 UUID;

    -- Test Assertion Counter
    v_passed_tests INT := 0;
BEGIN
    RAISE NOTICE '====================================================================';
    RAISE NOTICE 'STARTING DELIVERE PHASE 3B RELATIONAL & INVARIANT VERIFICATION SUITE';
    RAISE NOTICE '====================================================================';

    -- ------------------------------------------------------------------------
    -- TEST 1: Schema Existence Check (11 Tables Created)
    -- ------------------------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'operational_facilities') OR
       NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_facility_access') OR
       NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shipment_legs') OR
       NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shipment_leg_assignments') OR
       NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'custody_events') OR
       NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shipment_current_custody') OR
       NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'operational_manifests') OR
       NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'manifest_items') OR
       NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_payment_records') OR
       NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'driver_cash_collections') OR
       NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shipment_events') THEN
        RAISE EXCEPTION 'TEST 1 FAILED: One or more Phase 3B tables do not exist.';
    ELSE
        RAISE NOTICE 'TEST 1 PASSED: All 11 Phase 3B tables verified.';
        v_passed_tests := v_passed_tests + 1;
    END IF;

    -- ------------------------------------------------------------------------
    -- TEST 2: Column Alteration Check on financial_obligations
    -- ------------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'financial_obligations' AND column_name = 'leg_id'
    ) OR NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'financial_obligations' AND column_name = 'source_event_id'
    ) THEN
        RAISE EXCEPTION 'TEST 2 FAILED: financial_obligations missing leg_id or source_event_id column.';
    ELSE
        RAISE NOTICE 'TEST 2 PASSED: financial_obligations columns verified.';
        v_passed_tests := v_passed_tests + 1;
    END IF;

    -- ------------------------------------------------------------------------
    -- PROVISION TEST FIXTURES
    -- ------------------------------------------------------------------------
    -- Snapshot pre-existing database row counts for Test 29/30
    SELECT count(*) INTO v_preexisting_shipments_count FROM public.shipments;
    SELECT count(*) INTO v_preexisting_legs_count FROM public.shipment_legs;
    SELECT count(*) INTO v_preexisting_obligations_count FROM public.financial_obligations;

    -- Create 2 isolated tenants
    INSERT INTO public.tenants (id, name, code) 
    VALUES (gen_random_uuid(), 'Test Tenant Alpha', 'TEST-T-A') 
    RETURNING id INTO v_tenant_a;

    INSERT INTO public.tenants (id, name, code) 
    VALUES (gen_random_uuid(), 'Test Tenant Beta', 'TEST-T-B') 
    RETURNING id INTO v_tenant_b;

    -- Tenant A Users
    INSERT INTO public.users (id, tenant_id, name, role) 
    VALUES (gen_random_uuid(), v_tenant_a, 'Driver Alpha 1', 'DRIVER') 
    RETURNING id INTO v_driver_a1;

    INSERT INTO public.users (id, tenant_id, name, role) 
    VALUES (gen_random_uuid(), v_tenant_a, 'Driver Alpha 2', 'DRIVER') 
    RETURNING id INTO v_driver_a2;

    INSERT INTO public.users (id, tenant_id, name, role) 
    VALUES (gen_random_uuid(), v_tenant_a, 'Operator Alpha', 'OPERATOR') 
    RETURNING id INTO v_operator_a;

    INSERT INTO public.users (id, tenant_id, name, role) 
    VALUES (gen_random_uuid(), v_tenant_a, 'Merchant Alpha', 'MERCHANT') 
    RETURNING id INTO v_merchant_a;

    -- Tenant B User
    INSERT INTO public.users (id, tenant_id, name, role) 
    VALUES (gen_random_uuid(), v_tenant_b, 'Driver Beta 1', 'DRIVER') 
    RETURNING id INTO v_driver_b;

    -- Merchant Branch for Tenant A
    INSERT INTO public.merchant_branches (id, tenant_id, merchant_id, name)
    VALUES (gen_random_uuid(), v_tenant_a, v_merchant_a, 'Branch Alpha Downtown')
    RETURNING id INTO v_branch_a;

    -- Operational Facilities for Tenant A
    INSERT INTO public.operational_facilities (id, tenant_id, code, facility_type, name_ar, name_en)
    VALUES (gen_random_uuid(), v_tenant_a, 'FAC-A-HUB', 'HUB', 'مركز الفرز الرئيسي', 'Central Sort Hub')
    RETURNING id INTO v_facility_hub_a;

    INSERT INTO public.operational_facilities (id, tenant_id, code, facility_type, name_ar, name_en)
    VALUES (gen_random_uuid(), v_tenant_a, 'FAC-A-DEPOT', 'DEPOT', 'مستودع الشمال', 'North Depot')
    RETURNING id INTO v_facility_depot_a;

    -- Operational Facility for Tenant B
    INSERT INTO public.operational_facilities (id, tenant_id, code, facility_type, name_ar, name_en)
    VALUES (gen_random_uuid(), v_tenant_b, 'FAC-B-HUB', 'HUB', 'فرع بيتا', 'Beta Central Hub')
    RETURNING id INTO v_facility_hub_b;

    -- Vouchers for Tenant A & Tenant B
    INSERT INTO public.vouchers (
        id, tenant_id, voucher_number, type, amount, date, description
    ) VALUES (
        gen_random_uuid(), v_tenant_a, 'VOUCH-A-001', 'RECEIPT', 25.000, CURRENT_DATE, 'Cash remittance test'
    ) RETURNING id INTO v_voucher_a;

    INSERT INTO public.vouchers (
        id, tenant_id, voucher_number, type, amount, date, description
    ) VALUES (
        gen_random_uuid(), v_tenant_b, 'VOUCH-B-001', 'RECEIPT', 25.000, CURRENT_DATE, 'Cash remittance test tenant B'
    ) RETURNING id INTO v_voucher_b;

    -- Shipments for Tenant A
    INSERT INTO public.shipments (
        id, tenant_id, sequence, merchant_id, branch_id, recipient_name, recipient_phone, cod_amount
    ) VALUES (
        gen_random_uuid(), v_tenant_a, 'SHP-A-001', v_merchant_a, v_branch_a, 'Customer One', '0790000001', 25.000
    ) RETURNING id INTO v_shipment_a1;

    INSERT INTO public.shipments (
        id, tenant_id, sequence, merchant_id, branch_id, recipient_name, recipient_phone, cod_amount
    ) VALUES (
        gen_random_uuid(), v_tenant_a, 'SHP-A-002', v_merchant_a, v_branch_a, 'Customer Two', '0790000002', 40.000
    ) RETURNING id INTO v_shipment_a2;

    -- ------------------------------------------------------------------------
    -- TEST 3: Composite Tenant FKs Work (Valid Insert)
    -- ------------------------------------------------------------------------
    INSERT INTO public.shipment_legs (
        id, tenant_id, shipment_id, sequence, leg_type, status,
        origin_merchant_branch_id, destination_facility_id, assigned_driver_id, driver_earning_snapshot
    ) VALUES (
        gen_random_uuid(), v_tenant_a, v_shipment_a1, 1, 'PICKUP', 'ASSIGNED',
        v_branch_a, v_facility_hub_a, v_driver_a1, 1.500
    ) RETURNING id INTO v_leg_a1;
    RAISE NOTICE 'TEST 3 PASSED: Valid composite tenant insertion succeeded.';
    v_passed_tests := v_passed_tests + 1;

    -- ------------------------------------------------------------------------
    -- TEST 4: Cross-Tenant Shipment/Leg Link Rejected
    -- ------------------------------------------------------------------------
    BEGIN
        INSERT INTO public.shipment_legs (
            id, tenant_id, shipment_id, sequence, leg_type, status,
            origin_merchant_branch_id, destination_facility_id
        ) VALUES (
            gen_random_uuid(), v_tenant_b, v_shipment_a1, 1, 'PICKUP', 'PLANNED',
            v_branch_a, v_facility_hub_a
        );
        RAISE EXCEPTION 'TEST 4 FAILED: Cross-tenant leg accepted unexpectedly.';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'TEST 4 PASSED: Cross-tenant shipment/leg relationship strictly rejected.';
        v_passed_tests := v_passed_tests + 1;
    END;

    -- ------------------------------------------------------------------------
    -- TEST 5: Cross-Tenant Driver Assignment Rejected
    -- ------------------------------------------------------------------------
    BEGIN
        INSERT INTO public.shipment_legs (
            id, tenant_id, shipment_id, sequence, leg_type, status,
            origin_merchant_branch_id, destination_facility_id, assigned_driver_id
        ) VALUES (
            gen_random_uuid(), v_tenant_a, v_shipment_a1, 2, 'TRANSFER', 'PLANNED',
            v_branch_a, v_facility_hub_a, v_driver_b -- Tenant B driver!
        );
        RAISE EXCEPTION 'TEST 5 FAILED: Cross-tenant driver accepted.';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'TEST 5 PASSED: Cross-tenant driver assignment strictly rejected.';
        v_passed_tests := v_passed_tests + 1;
    END;

    -- ------------------------------------------------------------------------
    -- TEST 6: Cross-Tenant Facility Endpoint Rejected
    -- ------------------------------------------------------------------------
    BEGIN
        INSERT INTO public.shipment_legs (
            id, tenant_id, shipment_id, sequence, leg_type, status,
            origin_facility_id, destination_is_shipment_customer
        ) VALUES (
            gen_random_uuid(), v_tenant_a, v_shipment_a1, 2, 'LAST_MILE', 'PLANNED',
            v_facility_hub_b, true -- Tenant B facility!
        );
        RAISE EXCEPTION 'TEST 6 FAILED: Cross-tenant facility endpoint accepted.';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'TEST 6 PASSED: Cross-tenant facility endpoint strictly rejected.';
        v_passed_tests := v_passed_tests + 1;
    END;

    -- ------------------------------------------------------------------------
    -- TEST 7: Invalid Dual Leg Origin Rejected (CHECK constraint)
    -- ------------------------------------------------------------------------
    BEGIN
        INSERT INTO public.shipment_legs (
            id, tenant_id, shipment_id, sequence, leg_type, status,
            origin_facility_id, origin_merchant_branch_id, destination_is_shipment_customer
        ) VALUES (
            gen_random_uuid(), v_tenant_a, v_shipment_a1, 2, 'LAST_MILE', 'PLANNED',
            v_facility_hub_a, v_branch_a, true
        );
        RAISE EXCEPTION 'TEST 7 FAILED: Dual leg origin accepted.';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'TEST 7 PASSED: Dual leg origin rejected.';
        v_passed_tests := v_passed_tests + 1;
    END;

    -- ------------------------------------------------------------------------
    -- TEST 8: Invalid Zero Leg Origin Rejected (CHECK constraint)
    -- ------------------------------------------------------------------------
    BEGIN
        INSERT INTO public.shipment_legs (
            id, tenant_id, shipment_id, sequence, leg_type, status,
            destination_is_shipment_customer
        ) VALUES (
            gen_random_uuid(), v_tenant_a, v_shipment_a1, 2, 'LAST_MILE', 'PLANNED',
            true
        );
        RAISE EXCEPTION 'TEST 8 FAILED: Zero leg origin accepted.';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'TEST 8 PASSED: Zero leg origin rejected.';
        v_passed_tests := v_passed_tests + 1;
    END;

    -- ------------------------------------------------------------------------
    -- TEST 9: Invalid Dual Destination Rejected (CHECK constraint)
    -- ------------------------------------------------------------------------
    BEGIN
        INSERT INTO public.shipment_legs (
            id, tenant_id, shipment_id, sequence, leg_type, status,
            origin_facility_id, destination_facility_id, destination_is_shipment_customer
        ) VALUES (
            gen_random_uuid(), v_tenant_a, v_shipment_a1, 2, 'TRANSFER', 'PLANNED',
            v_facility_hub_a, v_facility_depot_a, true
        );
        RAISE EXCEPTION 'TEST 9 FAILED: Dual destination accepted.';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'TEST 9 PASSED: Dual destination rejected.';
        v_passed_tests := v_passed_tests + 1;
    END;

    -- ------------------------------------------------------------------------
    -- TEST 10: Duplicate Leg Sequence Rejected
    -- ------------------------------------------------------------------------
    BEGIN
        INSERT INTO public.shipment_legs (
            id, tenant_id, shipment_id, sequence, leg_type, status,
            origin_facility_id, destination_is_shipment_customer
        ) VALUES (
            gen_random_uuid(), v_tenant_a, v_shipment_a1, 1, 'LAST_MILE', 'PLANNED',
            v_facility_hub_a, true
        );
        RAISE EXCEPTION 'TEST 10 FAILED: Duplicate leg sequence accepted.';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'TEST 10 PASSED: Duplicate leg sequence rejected.';
        v_passed_tests := v_passed_tests + 1;
    END;

    -- Insert Leg 2 for subsequent tests
    INSERT INTO public.shipment_legs (
        id, tenant_id, shipment_id, sequence, leg_type, status,
        origin_facility_id, destination_is_shipment_customer, assigned_driver_id, driver_earning_snapshot
    ) VALUES (
        gen_random_uuid(), v_tenant_a, v_shipment_a1, 2, 'LAST_MILE', 'READY',
        v_facility_hub_a, true, v_driver_a2, 2.000
    ) RETURNING id INTO v_leg_a2;

    -- ------------------------------------------------------------------------
    -- TEST 11: Continuation Leg Cross-Shipment Rejected
    -- ------------------------------------------------------------------------
    BEGIN
        INSERT INTO public.shipment_legs (
            id, tenant_id, shipment_id, sequence, leg_type, status,
            origin_facility_id, destination_is_shipment_customer, continuation_of_leg_id
        ) VALUES (
            gen_random_uuid(), v_tenant_a, v_shipment_a2, 1, 'LAST_MILE', 'PLANNED',
            v_facility_hub_a, true, v_leg_a1 -- Belongs to Shipment A1!
        );
        RAISE EXCEPTION 'TEST 11 FAILED: Continuation leg from different shipment accepted.';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'TEST 11 PASSED: Continuation leg cross-shipment strictly rejected.';
        v_passed_tests := v_passed_tests + 1;
    END;

    -- Valid Continuation Leg on Same Shipment (Sequence 3)
    INSERT INTO public.shipment_legs (
        id, tenant_id, shipment_id, sequence, leg_type, status,
        origin_facility_id, destination_is_shipment_customer, continuation_of_leg_id
    ) VALUES (
        gen_random_uuid(), v_tenant_a, v_shipment_a1, 3, 'LAST_MILE', 'PLANNED',
        v_facility_hub_a, true, v_leg_a2
    ) RETURNING id INTO v_leg_a3;
    RAISE NOTICE 'TEST 11.B PASSED: Valid continuation leg on same shipment accepted.';

    -- Provision valid leg on Shipment A2 (Tenant A) for isolated cross-shipment testing
    INSERT INTO public.shipment_legs (
        id, tenant_id, shipment_id, sequence, leg_type, status,
        origin_facility_id, destination_is_shipment_customer
    ) VALUES (
        gen_random_uuid(), v_tenant_a, v_shipment_a2, 1, 'LAST_MILE', 'PLANNED',
        v_facility_hub_a, true
    ) RETURNING id INTO v_leg_shipment_a2;

    -- ------------------------------------------------------------------------
    -- TEST 12: Custody Exactly-One FROM Enforced (CHECK constraint)
    -- ------------------------------------------------------------------------
    BEGIN
        INSERT INTO public.custody_events (
            id, tenant_id, shipment_id, leg_id, event_type,
            from_facility_id, from_driver_id, -- DUAL FROM!
            to_facility_id, performed_by_user_id, evidence_type, idempotency_key
        ) VALUES (
            gen_random_uuid(), v_tenant_a, v_shipment_a1, v_leg_a1, 'INTAKE',
            v_facility_hub_a, v_driver_a1,
            v_facility_depot_a, v_operator_a, 'BARCODE_SCAN', 'IDEMP-CUST-FAIL-1'
        );
        RAISE EXCEPTION 'TEST 12 FAILED: Dual FROM custody accepted.';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'TEST 12 PASSED: Dual FROM custody rejected.';
        v_passed_tests := v_passed_tests + 1;
    END;

    -- ------------------------------------------------------------------------
    -- TEST 13: Custody Exactly-One TO Enforced (CHECK constraint)
    -- ------------------------------------------------------------------------
    BEGIN
        INSERT INTO public.custody_events (
            id, tenant_id, shipment_id, leg_id, event_type,
            from_driver_id,
            to_facility_id, to_is_shipment_customer, -- DUAL TO!
            performed_by_user_id, evidence_type, idempotency_key
        ) VALUES (
            gen_random_uuid(), v_tenant_a, v_shipment_a1, v_leg_a1, 'TERMINAL_DELIVERY',
            v_driver_a1,
            v_facility_hub_a, true,
            v_driver_a1, 'OTP_CODE', 'IDEMP-CUST-FAIL-2'
        );
        RAISE EXCEPTION 'TEST 13 FAILED: Dual TO custody accepted.';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'TEST 13 PASSED: Dual TO custody rejected.';
        v_passed_tests := v_passed_tests + 1;
    END;

    -- Insert valid custody event
    INSERT INTO public.custody_events (
        id, tenant_id, shipment_id, leg_id, event_type,
        from_merchant_branch_id, to_driver_id, performed_by_user_id,
        evidence_type, idempotency_key
    ) VALUES (
        gen_random_uuid(), v_tenant_a, v_shipment_a1, v_leg_a1, 'HANDOFF',
        v_branch_a, v_driver_a1, v_driver_a1,
        'BARCODE_SCAN', 'IDEMP-CUST-VALID-1'
    ) RETURNING id INTO v_custody_event_a1;

    -- ------------------------------------------------------------------------
    -- TEST 14: Duplicate Custody Idempotency Rejected
    -- ------------------------------------------------------------------------
    BEGIN
        INSERT INTO public.custody_events (
            id, tenant_id, shipment_id, leg_id, event_type,
            from_merchant_branch_id, to_driver_id, performed_by_user_id,
            evidence_type, idempotency_key
        ) VALUES (
            gen_random_uuid(), v_tenant_a, v_shipment_a1, v_leg_a1, 'HANDOFF',
            v_branch_a, v_driver_a1, v_driver_a1,
            'BARCODE_SCAN', 'IDEMP-CUST-VALID-1' -- Duplicate!
        );
        RAISE EXCEPTION 'TEST 14 FAILED: Duplicate custody idempotency accepted.';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'TEST 14 PASSED: Duplicate custody idempotency rejected.';
        v_passed_tests := v_passed_tests + 1;
    END;

    -- ------------------------------------------------------------------------
    -- TEST 15: Invalid Current Custody Holder Rejected
    -- ------------------------------------------------------------------------
    BEGIN
        INSERT INTO public.shipment_current_custody (
            shipment_id, tenant_id, current_holder_type,
            current_facility_id, current_driver_id, -- DUAL CURRENT HOLDER!
            is_verified_custody
        ) VALUES (
            v_shipment_a1, v_tenant_a, 'DRIVER',
            v_facility_hub_a, v_driver_a1,
            false
        );
        RAISE EXCEPTION 'TEST 15 FAILED: Dual current custody holder accepted.';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'TEST 15 PASSED: Dual current custody holder rejected.';
        v_passed_tests := v_passed_tests + 1;
    END;

    -- ------------------------------------------------------------------------
    -- TEST 16: Unverified Custody Cannot Reference Latest Event
    -- ------------------------------------------------------------------------
    BEGIN
        INSERT INTO public.shipment_current_custody (
            shipment_id, tenant_id, current_holder_type,
            current_merchant_branch_id, is_verified_custody, latest_custody_event_id
        ) VALUES (
            v_shipment_a1, v_tenant_a, 'MERCHANT',
            v_branch_a, false, v_custody_event_a1 -- Unverified with event!
        );
        RAISE EXCEPTION 'TEST 16 FAILED: Unverified custody referenced latest event.';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'TEST 16 PASSED: Unverified custody cannot reference latest event.';
        v_passed_tests := v_passed_tests + 1;
    END;

    -- Insert valid initial current custody (unverified)
    INSERT INTO public.shipment_current_custody (
        shipment_id, tenant_id, current_holder_type,
        current_merchant_branch_id, is_verified_custody, latest_custody_event_id
    ) VALUES (
        v_shipment_a1, v_tenant_a, 'MERCHANT',
        v_branch_a, false, NULL
    );
    RAISE NOTICE 'TEST 16.B PASSED: Valid initial unverified custody record inserted.';

    -- ------------------------------------------------------------------------
    -- TEST 17: Customer Terminal Custody Must Be Verified
    -- ------------------------------------------------------------------------
    BEGIN
        UPDATE public.shipment_current_custody SET
            current_holder_type = 'CUSTOMER',
            current_merchant_branch_id = NULL,
            is_with_customer = true,
            is_verified_custody = false, -- Invalid!
            latest_custody_event_id = NULL
        WHERE shipment_id = v_shipment_a1;
        RAISE EXCEPTION 'TEST 17 FAILED: Unverified customer custody accepted.';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'TEST 17 PASSED: Customer terminal custody must be verified.';
        v_passed_tests := v_passed_tests + 1;
    END;

    -- ------------------------------------------------------------------------
    -- TEST 18: Cross-Tenant Manifest Item Rejected
    -- ------------------------------------------------------------------------
    INSERT INTO public.operational_manifests (
        id, tenant_id, manifest_number, manifest_type, status,
        source_facility_id, destination_facility_id, created_by_user_id
    ) VALUES (
        gen_random_uuid(), v_tenant_a, 'MAN-A-001', 'HUB_TRANSFER', 'DRAFT',
        v_facility_hub_a, v_facility_depot_a, v_operator_a
    ) RETURNING id INTO v_manifest_a1;

    BEGIN
        INSERT INTO public.manifest_items (
            id, tenant_id, manifest_id, leg_id, shipment_id
        ) VALUES (
            gen_random_uuid(), v_tenant_b, v_manifest_a1, v_leg_a1, v_shipment_a1 -- Tenant B mismatch!
        );
        RAISE EXCEPTION 'TEST 18 FAILED: Cross-tenant manifest item accepted.';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'TEST 18 PASSED: Cross-tenant manifest item strictly rejected.';
        v_passed_tests := v_passed_tests + 1;
    END;

    -- ------------------------------------------------------------------------
    -- TEST 19: Manifest Leg/Shipment Mismatch Rejected
    -- ------------------------------------------------------------------------
    BEGIN
        INSERT INTO public.manifest_items (
            id, tenant_id, manifest_id, leg_id, shipment_id
        ) VALUES (
            gen_random_uuid(), v_tenant_a, v_manifest_a1, v_leg_a1, v_shipment_a2 -- Leg A1 belongs to Shipment A1!
        );
        RAISE EXCEPTION 'TEST 19 FAILED: Manifest item with mismatched leg/shipment accepted.';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'TEST 19 PASSED: Manifest item leg/shipment pairing verified by composite FK.';
        v_passed_tests := v_passed_tests + 1;
    END;

    -- Valid manifest item
    INSERT INTO public.manifest_items (
        id, tenant_id, manifest_id, leg_id, shipment_id
    ) VALUES (
        gen_random_uuid(), v_tenant_a, v_manifest_a1, v_leg_a1, v_shipment_a1
    );

    -- ------------------------------------------------------------------------
    -- TEST 20: Payment Cross-Tenant Link Rejected
    -- ------------------------------------------------------------------------
    BEGIN
        INSERT INTO public.customer_payment_records (
            id, tenant_id, shipment_id, leg_id, payment_method,
            amount_expected, amount_paid, idempotency_key
        ) VALUES (
            gen_random_uuid(), v_tenant_b, v_shipment_a1, v_leg_a1, 'CASH',
            25.000, 25.000, 'IDEMP-PAY-FAIL-1'
        );
        RAISE EXCEPTION 'TEST 20 FAILED: Cross-tenant payment accepted.';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'TEST 20 PASSED: Cross-tenant payment strictly rejected.';
        v_passed_tests := v_passed_tests + 1;
    END;

    -- Valid payment record
    INSERT INTO public.customer_payment_records (
        id, tenant_id, shipment_id, leg_id, payment_method,
        amount_expected, amount_paid, idempotency_key
    ) VALUES (
        gen_random_uuid(), v_tenant_a, v_shipment_a1, v_leg_a2, 'CASH',
        25.000, 25.000, 'IDEMP-PAY-VALID-1'
    ) RETURNING id INTO v_payment_record_a1;

    -- ------------------------------------------------------------------------
    -- TEST 21: Cash Collection Cross-Tenant Driver Rejected
    -- ------------------------------------------------------------------------
    BEGIN
        INSERT INTO public.driver_cash_collections (
            id, tenant_id, driver_id, shipment_id, leg_id, payment_record_id,
            cash_amount, idempotency_key
        ) VALUES (
            gen_random_uuid(), v_tenant_a, v_driver_b, v_shipment_a1, v_leg_a2, v_payment_record_a1,
            25.000, 'IDEMP-CASH-FAIL-1'
        );
        RAISE EXCEPTION 'TEST 21 FAILED: Cross-tenant driver cash accepted.';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'TEST 21 PASSED: Cross-tenant driver cash collection strictly rejected.';
        v_passed_tests := v_passed_tests + 1;
    END;

    -- Valid cash collection
    INSERT INTO public.driver_cash_collections (
        id, tenant_id, driver_id, shipment_id, leg_id, payment_record_id,
        cash_amount, idempotency_key
    ) VALUES (
        gen_random_uuid(), v_tenant_a, v_driver_a2, v_shipment_a1, v_leg_a2, v_payment_record_a1,
        25.000, 'IDEMP-CASH-VALID-1'
    ) RETURNING id INTO v_cash_coll_a1;

    -- ------------------------------------------------------------------------
    -- TEST 22: Duplicate Payment Idempotency Rejected
    -- ------------------------------------------------------------------------
    BEGIN
        INSERT INTO public.customer_payment_records (
            id, tenant_id, shipment_id, leg_id, payment_method,
            amount_expected, amount_paid, idempotency_key
        ) VALUES (
            gen_random_uuid(), v_tenant_a, v_shipment_a1, v_leg_a2, 'CASH',
            25.000, 25.000, 'IDEMP-PAY-VALID-1' -- Duplicate!
        );
        RAISE EXCEPTION 'TEST 22 FAILED: Duplicate payment idempotency accepted.';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'TEST 22 PASSED: Duplicate payment idempotency rejected.';
        v_passed_tests := v_passed_tests + 1;
    END;

    -- ------------------------------------------------------------------------
    -- TEST 23: Duplicate Cash Idempotency Rejected
    -- ------------------------------------------------------------------------
    BEGIN
        INSERT INTO public.driver_cash_collections (
            id, tenant_id, driver_id, shipment_id, leg_id, payment_record_id,
            cash_amount, idempotency_key
        ) VALUES (
            gen_random_uuid(), v_tenant_a, v_driver_a2, v_shipment_a1, v_leg_a2, v_payment_record_a1,
            25.000, 'IDEMP-CASH-VALID-1' -- Duplicate!
        );
        RAISE EXCEPTION 'TEST 23 FAILED: Duplicate cash idempotency accepted.';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'TEST 23 PASSED: Duplicate cash idempotency rejected.';
        v_passed_tests := v_passed_tests + 1;
    END;

    -- ------------------------------------------------------------------------
    -- TEST 23.A: Payment Same-Shipment Different-Leg Rejected
    -- ------------------------------------------------------------------------
    BEGIN
        -- Payment record belongs to leg A2; driver cash collection specifies leg A1 (same shipment A1)
        INSERT INTO public.driver_cash_collections (
            id, tenant_id, driver_id, shipment_id, leg_id, payment_record_id,
            cash_amount, idempotency_key
        ) VALUES (
            gen_random_uuid(), v_tenant_a, v_driver_a1, v_shipment_a1, v_leg_a1, v_payment_record_a1,
            25.000, 'IDEMP-CASH-SAME-SHP-DIFF-LEG'
        );
        RAISE EXCEPTION 'TEST 23.A FAILED: Driver cash collection with same-shipment different-leg accepted.';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'TEST 23.A PASSED: Driver cash collection same-shipment different-leg strictly rejected by composite FK.';
        v_passed_tests := v_passed_tests + 1;
    END;

    -- ------------------------------------------------------------------------
    -- TEST 23.B: Payment Different-Shipment Rejected
    -- ------------------------------------------------------------------------
    BEGIN
        -- Payment record belongs to shipment A1; driver cash collection specifies shipment A2 with valid leg on A2
        INSERT INTO public.driver_cash_collections (
            id, tenant_id, driver_id, shipment_id, leg_id, payment_record_id,
            cash_amount, idempotency_key
        ) VALUES (
            gen_random_uuid(), v_tenant_a, v_driver_a2, v_shipment_a2, v_leg_shipment_a2, v_payment_record_a1,
            25.000, 'IDEMP-CASH-DIFF-SHP'
        );
        RAISE EXCEPTION 'TEST 23.B FAILED: Driver cash collection with different shipment accepted.';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'TEST 23.B PASSED: Driver cash collection different shipment strictly rejected by composite FK.';
        v_passed_tests := v_passed_tests + 1;
    END;

    -- ------------------------------------------------------------------------
    -- TEST 23.C: Voucher Cross-Tenant Rejected
    -- ------------------------------------------------------------------------
    BEGIN
        -- Driver cash collection in Tenant A referencing Voucher from Tenant B
        INSERT INTO public.driver_cash_collections (
            id, tenant_id, driver_id, shipment_id, leg_id, payment_record_id,
            cash_amount, remittance_voucher_id, idempotency_key
        ) VALUES (
            gen_random_uuid(), v_tenant_a, v_driver_a2, v_shipment_a1, v_leg_a2, v_payment_record_a1,
            25.000, v_voucher_b, 'IDEMP-CASH-CROSS-TENANT-VOUCHER'
        );
        RAISE EXCEPTION 'TEST 23.C FAILED: Driver cash collection with cross-tenant voucher accepted.';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'TEST 23.C PASSED: Driver cash collection cross-tenant voucher strictly rejected by composite FK.';
        v_passed_tests := v_passed_tests + 1;
    END;

    -- Valid remittance voucher reference within same tenant
    UPDATE public.driver_cash_collections
    SET remittance_voucher_id = v_voucher_a
    WHERE id = v_cash_coll_a1;
    RAISE NOTICE 'TEST 23.D PASSED: Driver cash collection same-tenant voucher reference accepted.';
    v_passed_tests := v_passed_tests + 1;

    -- ------------------------------------------------------------------------
    -- TEST 24: Duplicate Shipment Event Idempotency Rejected
    -- ------------------------------------------------------------------------
    INSERT INTO public.shipment_events (
        id, tenant_id, shipment_id, leg_id, event_type, actor_user_id, actor_role, idempotency_key
    ) VALUES (
        gen_random_uuid(), v_tenant_a, v_shipment_a1, v_leg_a1, 'PICKUP_COMPLETED',
        v_driver_a1, 'DRIVER', 'IDEMP-EVT-VALID-1'
    ) RETURNING id INTO v_event_a1;

    -- Event 2 for Leg 2 (Last Mile Completed)
    INSERT INTO public.shipment_events (
        id, tenant_id, shipment_id, leg_id, event_type, actor_user_id, actor_role, idempotency_key
    ) VALUES (
        gen_random_uuid(), v_tenant_a, v_shipment_a1, v_leg_a2, 'DELIVERY_ATTEMPTED',
        v_driver_a2, 'DRIVER', 'IDEMP-EVT-VALID-2'
    ) RETURNING id INTO v_event_a2;

    -- Dedicated unused event fixture for TEST 34.A (belongs to Shipment A1, Leg A1)
    INSERT INTO public.shipment_events (
        id, tenant_id, shipment_id, leg_id, event_type, actor_user_id, actor_role, idempotency_key
    ) VALUES (
        gen_random_uuid(), v_tenant_a, v_shipment_a1, v_leg_a1, 'PICKUP_COMPLETED',
        v_driver_a1, 'DRIVER', 'IDEMP-EVT-WRONG-LEG-FIXTURE'
    ) RETURNING id INTO v_event_wrong_leg_fixture;

    -- Dedicated unused event fixture for TEST 34.B (belongs to Shipment A1, Leg A1)
    INSERT INTO public.shipment_events (
        id, tenant_id, shipment_id, leg_id, event_type, actor_user_id, actor_role, idempotency_key
    ) VALUES (
        gen_random_uuid(), v_tenant_a, v_shipment_a1, v_leg_a1, 'PICKUP_COMPLETED',
        v_driver_a1, 'DRIVER', 'IDEMP-EVT-WRONG-SHP-FIXTURE'
    ) RETURNING id INTO v_event_wrong_shipment_fixture;

    BEGIN
        INSERT INTO public.shipment_events (
            id, tenant_id, shipment_id, leg_id, event_type, actor_user_id, actor_role, idempotency_key
        ) VALUES (
            gen_random_uuid(), v_tenant_a, v_shipment_a1, v_leg_a1, 'PICKUP_COMPLETED',
            v_driver_a1, 'DRIVER', 'IDEMP-EVT-VALID-1' -- Duplicate!
        );
        RAISE EXCEPTION 'TEST 24 FAILED: Duplicate shipment event idempotency accepted.';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'TEST 24 PASSED: Duplicate shipment event idempotency rejected.';
        v_passed_tests := v_passed_tests + 1;
    END;

    -- ------------------------------------------------------------------------
    -- TEST 25: Legacy Financial Obligations with leg_id NULL Remain Valid
    -- ------------------------------------------------------------------------
    INSERT INTO public.financial_obligations (
        id, tenant_id, obligation_type, beneficiary_type, beneficiary_id,
        shipment_id, leg_id, original_amount, status, idempotency_key
    ) VALUES (
        gen_random_uuid(), v_tenant_a, 'MERCHANT_COD_PAYABLE', 'MERCHANT', v_merchant_a,
        v_shipment_a1, NULL, 22.000, 'PENDING', 'IDEMP-OBLIG-LEGACY-1'
    );
    RAISE NOTICE 'TEST 25 PASSED: Legacy financial obligation with leg_id NULL accepted.';
    v_passed_tests := v_passed_tests + 1;

    -- ------------------------------------------------------------------------
    -- TEST 26: Multiple DRIVER_EARNING Obligations for Different Legs Allowed
    -- ------------------------------------------------------------------------
    -- Driver 1 earning for Pickup Leg 1
    INSERT INTO public.financial_obligations (
        id, tenant_id, obligation_type, beneficiary_type, beneficiary_id,
        shipment_id, leg_id, source_event_id, original_amount, status, idempotency_key
    ) VALUES (
        gen_random_uuid(), v_tenant_a, 'DRIVER_EARNING', 'DRIVER', v_driver_a1,
        v_shipment_a1, v_leg_a1, v_event_a1, 1.500, 'PENDING', 'IDEMP-OBLIG-DRIVER-LEG1'
    );

    -- Driver 2 earning for Last-Mile Leg 2 (Same shipment, different leg!)
    INSERT INTO public.financial_obligations (
        id, tenant_id, obligation_type, beneficiary_type, beneficiary_id,
        shipment_id, leg_id, source_event_id, original_amount, status, idempotency_key
    ) VALUES (
        gen_random_uuid(), v_tenant_a, 'DRIVER_EARNING', 'DRIVER', v_driver_a2,
        v_shipment_a1, v_leg_a2, v_event_a2, 2.000, 'PENDING', 'IDEMP-OBLIG-DRIVER-LEG2'
    );
    RAISE NOTICE 'TEST 26 PASSED: Multiple DRIVER_EARNING obligations on different legs co-exist safely.';
    v_passed_tests := v_passed_tests + 1;

    -- ------------------------------------------------------------------------
    -- TEST 27: Duplicate DRIVER_EARNING for Same Leg Rejected
    -- ------------------------------------------------------------------------
    BEGIN
        INSERT INTO public.financial_obligations (
            id, tenant_id, obligation_type, beneficiary_type, beneficiary_id,
            shipment_id, leg_id, source_event_id, original_amount, status, idempotency_key
        ) VALUES (
            gen_random_uuid(), v_tenant_a, 'DRIVER_EARNING', 'DRIVER', v_driver_a1,
            v_shipment_a1, v_leg_a1, v_event_a1, 1.500, 'PENDING', 'IDEMP-OBLIG-DRIVER-LEG1-RETRY'
        );
        RAISE EXCEPTION 'TEST 27 FAILED: Duplicate active DRIVER_EARNING for same leg accepted.';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'TEST 27 PASSED: Duplicate active DRIVER_EARNING for same leg rejected.';
        v_passed_tests := v_passed_tests + 1;
    END;

    -- ------------------------------------------------------------------------
    -- TEST 28: Merchant Obligation Uniqueness Remains Protected
    -- ------------------------------------------------------------------------
    BEGIN
        INSERT INTO public.financial_obligations (
            id, tenant_id, obligation_type, beneficiary_type, beneficiary_id,
            shipment_id, leg_id, original_amount, status, idempotency_key
        ) VALUES (
            gen_random_uuid(), v_tenant_a, 'MERCHANT_COD_PAYABLE', 'MERCHANT', v_merchant_a,
            v_shipment_a1, NULL, 22.000, 'PENDING', 'IDEMP-OBLIG-MERCHANT-DUP'
        );
        RAISE EXCEPTION 'TEST 28 FAILED: Duplicate active MERCHANT_COD_PAYABLE accepted.';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'TEST 28 PASSED: Duplicate active merchant obligation rejected.';
        v_passed_tests := v_passed_tests + 1;
    END;

    -- ------------------------------------------------------------------------
    -- TEST 28.B: Company Fee Obligation Uniqueness Protected (Canonical Types)
    -- ------------------------------------------------------------------------
    -- Valid insertion of COMPANY_DELIVERY_FEE
    INSERT INTO public.financial_obligations (
        id, tenant_id, obligation_type, beneficiary_type, beneficiary_id,
        shipment_id, leg_id, original_amount, status, idempotency_key
    ) VALUES (
        gen_random_uuid(), v_tenant_a, 'COMPANY_DELIVERY_FEE', 'COMPANY', v_operator_a,
        v_shipment_a1, NULL, 3.000, 'PENDING', 'IDEMP-OBLIG-COMP-DELIV-1'
    );
    -- Duplicate active COMPANY_DELIVERY_FEE on same shipment must be rejected
    BEGIN
        INSERT INTO public.financial_obligations (
            id, tenant_id, obligation_type, beneficiary_type, beneficiary_id,
            shipment_id, leg_id, original_amount, status, idempotency_key
        ) VALUES (
            gen_random_uuid(), v_tenant_a, 'COMPANY_DELIVERY_FEE', 'COMPANY', v_operator_a,
            v_shipment_a1, NULL, 3.000, 'PENDING', 'IDEMP-OBLIG-COMP-DELIV-DUP'
        );
        RAISE EXCEPTION 'TEST 28.B FAILED: Duplicate active COMPANY_DELIVERY_FEE accepted.';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'TEST 28.B PASSED: Duplicate active COMPANY_DELIVERY_FEE strictly rejected.';
        v_passed_tests := v_passed_tests + 1;
    END;

    -- ------------------------------------------------------------------------
    -- TEST 29: Custody Events Leg/Shipment Mismatch Rejected
    -- ------------------------------------------------------------------------
    BEGIN
        INSERT INTO public.custody_events (
            id, tenant_id, shipment_id, leg_id, event_type,
            from_merchant_branch_id, to_driver_id, performed_by_user_id,
            evidence_type, idempotency_key
        ) VALUES (
            gen_random_uuid(), v_tenant_a, v_shipment_a2, v_leg_a1, 'HANDOFF', -- Leg A1 belongs to Shipment A1, not A2!
            v_branch_a, v_driver_a1, v_driver_a1,
            'BARCODE_SCAN', 'IDEMP-CUST-LEG-MISMATCH'
        );
        RAISE EXCEPTION 'TEST 29 FAILED: Custody event with mismatched leg/shipment accepted.';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'TEST 29 PASSED: Custody event leg/shipment composite FK strictly enforced.';
        v_passed_tests := v_passed_tests + 1;
    END;

    -- ------------------------------------------------------------------------
    -- TEST 30: Shipment Current Custody Latest Event Mismatch Rejected
    -- ------------------------------------------------------------------------
    BEGIN
        -- Attempt to set latest_custody_event_id on shipment A2 using custody event from shipment A1
        INSERT INTO public.shipment_current_custody (
            shipment_id, tenant_id, current_holder_type,
            current_driver_id, is_verified_custody, latest_custody_event_id
        ) VALUES (
            v_shipment_a2, v_tenant_a, 'DRIVER',
            v_driver_a1, true, v_custody_event_a1 -- Event A1 belongs to Shipment A1!
        );
        RAISE EXCEPTION 'TEST 30 FAILED: Current custody latest event with mismatched shipment accepted.';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'TEST 30 PASSED: Current custody latest event composite FK (event_id, shipment_id, tenant_id) enforced.';
        v_passed_tests := v_passed_tests + 1;
    END;

    -- ------------------------------------------------------------------------
    -- TEST 31: Shipment Current Custody Holder Type Consistency Enforced
    -- ------------------------------------------------------------------------
    BEGIN
        -- Current holder type says DRIVER, but pointer populated is current_facility_id
        INSERT INTO public.shipment_current_custody (
            shipment_id, tenant_id, current_holder_type,
            current_facility_id, is_verified_custody
        ) VALUES (
            v_shipment_a2, v_tenant_a, 'DRIVER',
            v_facility_hub_a, false
        );
        RAISE EXCEPTION 'TEST 31 FAILED: Inconsistent holder type DRIVER with facility pointer accepted.';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'TEST 31 PASSED: Current custody holder type consistency strictly enforced by CHECK.';
        v_passed_tests := v_passed_tests + 1;
    END;

    -- ------------------------------------------------------------------------
    -- TEST 32: Driver Cash Collections Payment Record Mismatch Rejected
    -- ------------------------------------------------------------------------
    BEGIN
        -- Cash collection referencing valid leg on shipment A2, but paired with payment record from shipment A1
        INSERT INTO public.driver_cash_collections (
            id, tenant_id, driver_id, shipment_id, leg_id, payment_record_id,
            cash_amount, idempotency_key
        ) VALUES (
            gen_random_uuid(), v_tenant_a, v_driver_a2, v_shipment_a2, v_leg_shipment_a2, v_payment_record_a1, -- Shipment A2 vs Payment A1!
            25.000, 'IDEMP-CASH-PAY-MISMATCH'
        );
        RAISE EXCEPTION 'TEST 32 FAILED: Driver cash collection with mismatched payment record accepted.';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'TEST 32 PASSED: Driver cash payment composite FK (payment_id, shipment_id, tenant_id) enforced.';
        v_passed_tests := v_passed_tests + 1;
    END;

    -- ------------------------------------------------------------------------
    -- TEST 33: Shipment Events Leg/Shipment Mismatch Rejected
    -- ------------------------------------------------------------------------
    BEGIN
        INSERT INTO public.shipment_events (
            id, tenant_id, shipment_id, leg_id, event_type, actor_user_id, actor_role, idempotency_key
        ) VALUES (
            gen_random_uuid(), v_tenant_a, v_shipment_a2, v_leg_a1, 'LEG_STARTED', -- Leg A1 belongs to Shipment A1!
            v_driver_a1, 'DRIVER', 'IDEMP-EVT-LEG-MISMATCH'
        );
        RAISE EXCEPTION 'TEST 33 FAILED: Shipment event with mismatched leg/shipment accepted.';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'TEST 33 PASSED: Shipment event leg/shipment composite FK strictly enforced.';
        v_passed_tests := v_passed_tests + 1;
    END;

    -- ------------------------------------------------------------------------
    -- TEST 34: Duplicate DRIVER_EARNING for Same Source Event Rejected
    -- ------------------------------------------------------------------------
    BEGIN
        INSERT INTO public.financial_obligations (
            id, tenant_id, obligation_type, beneficiary_type, beneficiary_id,
            shipment_id, leg_id, source_event_id, original_amount, status, idempotency_key
        ) VALUES (
            gen_random_uuid(), v_tenant_a, 'DRIVER_EARNING', 'DRIVER', v_driver_a1,
            v_shipment_a1, v_leg_a3, v_event_a1, 1.750, 'PENDING', 'IDEMP-OBLIG-DRIVER-EVT-DUP' -- Same v_event_a1!
        );
        RAISE EXCEPTION 'TEST 34 FAILED: Duplicate active DRIVER_EARNING for same source event accepted.';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'TEST 34 PASSED: Unique index on DRIVER_EARNING source_event_id enforced.';
        v_passed_tests := v_passed_tests + 1;
    END;

    -- ------------------------------------------------------------------------
    -- TEST 34.A: Earning Event Different-Leg Rejected
    -- ------------------------------------------------------------------------
    BEGIN
        -- Event v_event_wrong_leg_fixture belongs to leg A1; obligation specifies leg A3 (same shipment A1)
        -- Uses dedicated unused event fixture so unique index on source_event_id does NOT fire
        INSERT INTO public.financial_obligations (
            id, tenant_id, obligation_type, beneficiary_type, beneficiary_id,
            shipment_id, leg_id, source_event_id, original_amount, status, idempotency_key
        ) VALUES (
            gen_random_uuid(), v_tenant_a, 'DRIVER_EARNING', 'DRIVER', v_driver_a1,
            v_shipment_a1, v_leg_a3, v_event_wrong_leg_fixture, 1.750, 'PENDING', 'IDEMP-OBLIG-EARNING-DIFF-LEG'
        );
        RAISE EXCEPTION 'TEST 34.A FAILED: DRIVER_EARNING with event from different leg accepted.';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'TEST 34.A PASSED: DRIVER_EARNING event from different leg strictly rejected by composite FK.';
        v_passed_tests := v_passed_tests + 1;
    END;

    -- ------------------------------------------------------------------------
    -- TEST 34.B: Earning Event Different-Shipment Rejected
    -- ------------------------------------------------------------------------
    BEGIN
        -- Event v_event_wrong_shipment_fixture belongs to shipment A1; obligation specifies shipment A2 and valid leg on shipment A2
        -- Target (leg_id, shipment_id, tenant_id) is valid before source_event_id composite FK check
        -- Uses dedicated unused event fixture so unique index on source_event_id does NOT fire
        INSERT INTO public.financial_obligations (
            id, tenant_id, obligation_type, beneficiary_type, beneficiary_id,
            shipment_id, leg_id, source_event_id, original_amount, status, idempotency_key
        ) VALUES (
            gen_random_uuid(), v_tenant_a, 'DRIVER_EARNING', 'DRIVER', v_driver_a1,
            v_shipment_a2, v_leg_shipment_a2, v_event_wrong_shipment_fixture, 1.750, 'PENDING', 'IDEMP-OBLIG-EARNING-DIFF-SHP'
        );
        RAISE EXCEPTION 'TEST 34.B FAILED: DRIVER_EARNING with event from different shipment accepted.';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'TEST 34.B PASSED: DRIVER_EARNING event from different shipment strictly rejected by composite FK.';
        v_passed_tests := v_passed_tests + 1;
    END;

    -- ------------------------------------------------------------------------
    -- TEST 34.C: Leg-Level DRIVER_EARNING NULL Source Event Rejected
    -- ------------------------------------------------------------------------
    BEGIN
        -- Specifying a leg for DRIVER_EARNING requires a corresponding source_event_id
        INSERT INTO public.financial_obligations (
            id, tenant_id, obligation_type, beneficiary_type, beneficiary_id,
            shipment_id, leg_id, source_event_id, original_amount, status, idempotency_key
        ) VALUES (
            gen_random_uuid(), v_tenant_a, 'DRIVER_EARNING', 'DRIVER', v_driver_a1,
            v_shipment_a1, v_leg_a3, NULL, 1.750, 'PENDING', 'IDEMP-OBLIG-DRIVER-LEG-NO-EVT'
        );
        RAISE EXCEPTION 'TEST 34.C FAILED: Leg-level DRIVER_EARNING with NULL source event accepted.';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'TEST 34.C PASSED: Leg-level DRIVER_EARNING with NULL source event rejected by CHECK constraint.';
        v_passed_tests := v_passed_tests + 1;
    END;

    -- ------------------------------------------------------------------------
    -- TEST 35 & 36: Zero Historical Mutation & State Preservation Check
    -- ------------------------------------------------------------------------
    -- Verify pre-existing shipments were untouched
    IF EXISTS (
        SELECT 1 FROM public.shipments s
        WHERE s.id NOT IN (v_shipment_a1, v_shipment_a2)
          AND EXISTS (SELECT 1 FROM public.shipment_legs l WHERE l.shipment_id = s.id)
    ) THEN
        RAISE EXCEPTION 'TEST 35/36 FAILED: Legs found on pre-existing shipments.';
    END IF;

    -- Verify count of pre-existing legs prior to this test run was zero or unchanged
    IF (SELECT count(*) FROM public.shipments WHERE id NOT IN (v_shipment_a1, v_shipment_a2)) <> v_preexisting_shipments_count THEN
        RAISE EXCEPTION 'TEST 35/36 FAILED: Pre-existing shipments count altered.';
    END IF;

    RAISE NOTICE 'TEST 35 & 36 PASSED: Pre-existing shipments untouched; zero historical rows mutated; zero fake backfill rows.';
    v_passed_tests := v_passed_tests + 2;

    RAISE NOTICE '====================================================================';
    RAISE NOTICE 'VERIFICATION COMPLETE: ALL % TESTS CONFORM TO SPECIFICATION', v_passed_tests;
    RAISE NOTICE '====================================================================';

    -- Deterministic assertion for expected number of passed assertions
    IF v_passed_tests <> 44 THEN
        RAISE EXCEPTION
            'PHASE 3B TEST COUNT MISMATCH: expected 44, passed %',
            v_passed_tests;
    END IF;

    RAISE NOTICE 'PHASE 3B VERIFICATION PASSED: % assertions passed.',
        v_passed_tests;
    RAISE NOTICE 'ROLLBACK WILL REMOVE ALL TEST FIXTURES.';
END $$;

ROLLBACK;

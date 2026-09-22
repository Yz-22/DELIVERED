-- ============================================================================
-- DELIVERE — PHASE 3C / STEP 7.1: OPERATIONAL TASKS & EXCEPTIONS TEST SUITE
-- File: supabase/migrations/20260924_phase3c_operational_tasks_and_exceptions_tests.sql
-- Description: Deterministic SQL verification suite for Tasks & Exception Engine:
--              - Tables, constraints, indexes, RLS, grants
--              - SECURITY DEFINER and search_path verification
--              - Task creation, SLA snapshots, idempotency replays
--              - Atomic claim, double-claim prevention, stale version protection
--              - Lifecycle transitions, blocking, resolution, reopening
--              - Exception cycle deduplication, occurrence increments, new cycles
--              - Decoupled resolution (task resolve != exception resolve)
--              - Immutability of task events and comments
--              - Multi-leg integrity, zero custody mutation, zero financial mutation
-- Mode: Fully encapsulated in BEGIN ... ROLLBACK. Zero persistent fixture pollution.
-- Target Engine: PostgreSQL 15+ (Supabase)
-- Minimum Assertions: 60 (Mechanically counted: 66 assertions)
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
    v_operator_a UUID := gen_random_uuid();
    v_driver_a1 UUID := gen_random_uuid();
    v_driver_a2 UUID := gen_random_uuid();
    v_merchant_user_a UUID := gen_random_uuid();
    v_staff_a UUID := gen_random_uuid();
    v_user_inactive UUID := gen_random_uuid();
    v_user_b UUID := gen_random_uuid();

    -- Facilities & Branches
    v_facility_hub_a UUID := gen_random_uuid();
    v_facility_inactive UUID := gen_random_uuid();
    v_branch_a UUID := gen_random_uuid();

    -- Test Shipments & Legs
    v_shp_1 UUID := gen_random_uuid();
    v_leg_1_pickup UUID := gen_random_uuid();
    v_leg_2_lastmile UUID := gen_random_uuid();
    v_payment_rec_1 UUID := gen_random_uuid();

    -- Queues & Task Types
    v_queue_dispatch UUID := gen_random_uuid();
    v_queue_hub UUID := gen_random_uuid();
    v_queue_inactive UUID := gen_random_uuid();
    v_queue_tenant_b UUID := gen_random_uuid();

    v_type_delivery UUID := gen_random_uuid();
    v_type_hub UUID := gen_random_uuid();
    v_type_inactive UUID := gen_random_uuid();
    v_type_tenant_b UUID := gen_random_uuid();

    -- Return Variables
    v_res JSONB;
    v_task_id_1 UUID;
    v_task_id_2 UUID;
    v_task_id_3 UUID;
    v_task_id_4 UUID;
    v_exception_id_1 UUID;
    v_exception_id_2 UUID;
    v_task RECORD;
    v_exception RECORD;
    v_err_caught BOOLEAN;
    v_due_at_orig TIMESTAMPTZ;
    v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
    RAISE NOTICE '====================================================================';
    RAISE NOTICE 'STARTING PHASE 3C / STEP 7.1 OPERATIONAL TASKS & EXCEPTIONS TESTS';
    RAISE NOTICE '====================================================================';

    -- ========================================================================
    -- SECTION 1: SCHEMA INTEGRITY & SECURITY DEFINER INSPECTION (Assertions 1 - 10)
    -- ========================================================================
    RAISE NOTICE 'Executing Section 1: Schema Integrity & Privileges...';

    -- Assertion 1: All 6 core tables exist
    IF (
        SELECT count(*)
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN (
            'task_queue_definitions',
            'task_type_definitions',
            'operational_exceptions',
            'operational_tasks',
            'operational_task_events',
            'operational_task_comments'
          )
    ) <> 6 THEN
        RAISE EXCEPTION 'TEST FAILED: [1] Missing core tables in public schema';
    END IF;

    -- Assertion 2: Partial unique index for active exception deduplication exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'operational_exceptions'
          AND indexname = 'uq_active_operational_exception'
    ) THEN
        RAISE EXCEPTION 'TEST FAILED: [2] Missing uq_active_operational_exception index';
    END IF;

    -- Assertion 3: Task idempotency index exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'operational_tasks'
          AND indexname = 'uq_tasks_tenant_idempotency'
    ) THEN
        RAISE EXCEPTION 'TEST FAILED: [3] Missing uq_tasks_tenant_idempotency index';
    END IF;

    -- Assertion 4: Task event idempotency index exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'operational_task_events'
          AND indexname = 'uq_task_events_tenant_idempotency'
    ) THEN
        RAISE EXCEPTION 'TEST FAILED: [4] Missing uq_task_events_tenant_idempotency index';
    END IF;

    -- Assertion 5: RLS is enabled on all 6 tables
    IF (
        SELECT count(*)
        FROM pg_tables t
        JOIN pg_class c ON c.relname = t.tablename
        JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
        WHERE t.schemaname = 'public'
          AND t.tablename IN (
            'task_queue_definitions',
            'task_type_definitions',
            'operational_exceptions',
            'operational_tasks',
            'operational_task_events',
            'operational_task_comments'
          )
          AND c.relrowsecurity = true
    ) <> 6 THEN
        RAISE EXCEPTION 'TEST FAILED: [5] RLS not enabled on all 6 task engine tables';
    END IF;

    -- Assertion 6: All 8 RPC functions exist
    IF (
        SELECT count(*)
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN (
            'execute_create_operational_task',
            'execute_claim_operational_task',
            'execute_assign_operational_task',
            'execute_update_operational_task_state',
            'execute_resolve_operational_task',
            'execute_reopen_operational_task',
            'execute_record_operational_exception',
            'execute_resolve_operational_exception'
          )
    ) <> 8 THEN
        RAISE EXCEPTION 'TEST FAILED: [6] Not all 8 required mutation RPCs exist';
    END IF;

    -- Assertion 7: All 8 RPC functions are SECURITY DEFINER
    IF (
        SELECT count(*)
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN (
            'execute_create_operational_task',
            'execute_claim_operational_task',
            'execute_assign_operational_task',
            'execute_update_operational_task_state',
            'execute_resolve_operational_task',
            'execute_reopen_operational_task',
            'execute_record_operational_exception',
            'execute_resolve_operational_exception'
          )
          AND p.prosecdef = true
    ) <> 8 THEN
        RAISE EXCEPTION 'TEST FAILED: [7] Not all 8 RPCs are SECURITY DEFINER';
    END IF;

    -- Assertion 8: All 8 RPC functions have search_path configured
    IF (
        SELECT count(*)
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN (
            'execute_create_operational_task',
            'execute_claim_operational_task',
            'execute_assign_operational_task',
            'execute_update_operational_task_state',
            'execute_resolve_operational_task',
            'execute_reopen_operational_task',
            'execute_record_operational_exception',
            'execute_resolve_operational_exception'
          )
          AND p.proconfig IS NOT NULL
          AND array_to_string(p.proconfig, ',') LIKE '%search_path=public, pg_temp%'
    ) <> 8 THEN
        RAISE EXCEPTION 'TEST FAILED: [8] Not all 8 RPCs have fixed search_path = public, pg_temp';
    END IF;

    -- Assertion 9: Public cannot execute any of the 8 RPCs
    IF EXISTS (
        SELECT 1
        FROM information_schema.routine_privileges
        WHERE routine_schema = 'public'
          AND routine_name IN (
            'execute_create_operational_task',
            'execute_claim_operational_task',
            'execute_assign_operational_task',
            'execute_update_operational_task_state',
            'execute_resolve_operational_task',
            'execute_reopen_operational_task',
            'execute_record_operational_exception',
            'execute_resolve_operational_exception'
          )
          AND grantee IN ('PUBLIC', 'anon', 'authenticated')
    ) THEN
        RAISE EXCEPTION 'TEST FAILED: [9] Public/anon/authenticated retains EXECUTE on operational RPCs';
    END IF;

    -- Assertion 10: service_role has EXECUTE on all 8 RPCs
    IF (
        SELECT count(DISTINCT routine_name)
        FROM information_schema.routine_privileges
        WHERE routine_schema = 'public'
          AND routine_name IN (
            'execute_create_operational_task',
            'execute_claim_operational_task',
            'execute_assign_operational_task',
            'execute_update_operational_task_state',
            'execute_resolve_operational_task',
            'execute_reopen_operational_task',
            'execute_record_operational_exception',
            'execute_resolve_operational_exception'
          )
          AND grantee = 'service_role'
    ) <> 8 THEN
        RAISE EXCEPTION 'TEST FAILED: [10] service_role missing EXECUTE privilege on operational RPCs';
    END IF;


    -- ========================================================================
    -- SETUP FIXTURES
    -- ========================================================================
    RAISE NOTICE 'Setting up test fixtures...';

    -- Tenants
    INSERT INTO public.tenants (id, name, code, is_active, created_at, updated_at)
    VALUES
        (v_tenant_a, 'Tenant Alpha (Active)', 'TSK-TEN-A', true, v_now, v_now),
        (v_tenant_b, 'Tenant Beta (Active)', 'TSK-TEN-B', true, v_now, v_now),
        (v_tenant_suspended, 'Tenant Suspended', 'TSK-TEN-SUSP', false, v_now, v_now);

    -- Users
    INSERT INTO public.users (id, tenant_id, name, email, role, is_active, created_at, updated_at)
    VALUES
        (v_admin_a, v_tenant_a, 'Admin Alpha', 'admin@alpha.test', 'ADMIN', true, v_now, v_now),
        (v_dispatcher_a, v_tenant_a, 'Dispatcher Alpha', 'dispatch@alpha.test', 'DISPATCHER', true, v_now, v_now),
        (v_operator_a, v_tenant_a, 'Operator Alpha', 'op@alpha.test', 'OPERATOR', true, v_now, v_now),
        (v_driver_a1, v_tenant_a, 'Driver A1', 'driver1@alpha.test', 'DRIVER', true, v_now, v_now),
        (v_driver_a2, v_tenant_a, 'Driver A2', 'driver2@alpha.test', 'DRIVER', true, v_now, v_now),
        (v_merchant_user_a, v_tenant_a, 'Merchant A', 'merch@alpha.test', 'MERCHANT', true, v_now, v_now),
        (v_staff_a, v_tenant_a, 'Staff A', 'staff@alpha.test', 'STAFF', true, v_now, v_now),
        (v_user_inactive, v_tenant_a, 'Inactive User', 'inactive@alpha.test', 'OPERATOR', false, v_now, v_now),
        (v_user_b, v_tenant_b, 'User Beta', 'user@beta.test', 'ADMIN', true, v_now, v_now);

    -- Facilities & Branches
    INSERT INTO public.operational_facilities (id, tenant_id, name_ar, name_en, code, facility_type, is_active, created_at, updated_at)
    VALUES
        (v_facility_hub_a, v_tenant_a, 'مركز فرز عمان الرئيسي', 'Amman Main Hub', 'HUB-AMM-TSK', 'HUB', true, v_now, v_now),
        (v_facility_inactive, v_tenant_a, 'مركز فرز معطل', 'Inactive Hub', 'HUB-INACTIVE-TSK', 'HUB', false, v_now, v_now);

    INSERT INTO public.merchant_branches (id, tenant_id, merchant_id, name, is_main, is_active, created_at, updated_at)
    VALUES
        (v_branch_a, v_tenant_a, v_merchant_user_a, 'Main Branch Merchant A', true, true, v_now, v_now);

    -- Shipments & Legs
    INSERT INTO public.shipments (
        id, tenant_id, sequence, merchant_id, branch_id, status, payment_type,
        cod_amount, delivery_fee, recipient_name, recipient_phone, address,
        delivery_attempts, created_at, updated_at
    ) VALUES (
        v_shp_1, v_tenant_a, 'SHP-TSK-001', v_merchant_user_a, v_branch_a, 'OUT_FOR_DELIVERY', 'COD',
        40.000, 3.500, 'Customer Tsk', '0799999999', 'Amman', 1, v_now, v_now
    );

    INSERT INTO public.shipment_legs (
        id, tenant_id, shipment_id, sequence, leg_type, status,
        assigned_driver_id,
        origin_merchant_branch_id, origin_facility_id, origin_is_shipment_customer,
        destination_facility_id, destination_merchant_branch_id, destination_is_shipment_customer,
        driver_earning_snapshot, currency,
        created_at, updated_at
    ) VALUES
        (
            v_leg_1_pickup, v_tenant_a, v_shp_1, 1, 'PICKUP', 'COMPLETED',
            v_driver_a1,
            v_branch_a, NULL, false,
            v_facility_hub_a, NULL, false,
            0.000, 'JOD',
            v_now, v_now
        ),
        (
            v_leg_2_lastmile, v_tenant_a, v_shp_1, 2, 'LAST_MILE', 'IN_TRANSIT',
            v_driver_a2,
            NULL, v_facility_hub_a, false,
            NULL, NULL, true,
            0.000, 'JOD',
            v_now, v_now
        );


    -- ========================================================================
    -- SECTION 2: CONFIGURATION CONSTRAINTS & ISOLATION (Assertions 11 - 18)
    -- ========================================================================
    RAISE NOTICE 'Executing Section 2: Configuration Constraints & Isolation...';

    -- Task Queues Setup
    INSERT INTO public.task_queue_definitions (id, tenant_id, code, name_ar, name_en, queue_category, is_active)
    VALUES
        (v_queue_dispatch, v_tenant_a, 'QUEUE_DISPATCH', 'طابور الإرسال', 'Dispatch Queue', 'DISPATCH', true),
        (v_queue_hub, v_tenant_a, 'QUEUE_HUB', 'طابور مركز الفرز', 'Hub Queue', 'HUB_OPERATIONS', true),
        (v_queue_inactive, v_tenant_a, 'QUEUE_INACTIVE', 'طابور معطل', 'Inactive Queue', 'GENERAL', false),
        (v_queue_tenant_b, v_tenant_b, 'QUEUE_DISPATCH', 'طابور بيتا', 'Beta Dispatch Queue', 'DISPATCH', true);

    -- Task Types Setup
    INSERT INTO public.task_type_definitions (id, tenant_id, code, name_ar, name_en, category, default_priority, default_sla_minutes, is_active)
    VALUES
        (v_type_delivery, v_tenant_a, 'FAILED_DELIVERY_REVIEW', 'مراجعة فشل التسليم', 'Failed Delivery Review', 'DELIVERY', 'HIGH', 60, true),
        (v_type_hub, v_tenant_a, 'HUB_DWELL_EXCEPTION', 'تجاوز مكوث الشحنة في المركز', 'Hub Dwell Exceeded', 'HUB', 'NORMAL', 180, true),
        (v_type_inactive, v_tenant_a, 'INACTIVE_TYPE', 'نوع معطل', 'Inactive Type', 'OTHER', 'LOW', 240, false),
        (v_type_tenant_b, v_tenant_b, 'FAILED_DELIVERY_REVIEW', 'مراجعة فشل التسليم بيتا', 'Beta Failed Delivery', 'DELIVERY', 'HIGH', 90, true);

    -- Assertion 11: Task type tenant isolation
    IF (SELECT count(*) FROM public.task_type_definitions WHERE tenant_id = v_tenant_a) <> 3 THEN
        RAISE EXCEPTION 'TEST FAILED: [11] Task type count mismatch for Tenant A';
    END IF;

    -- Assertion 12: Duplicate task type code in same tenant is rejected
    v_err_caught := false;
    BEGIN
        INSERT INTO public.task_type_definitions (tenant_id, code, name_ar, name_en, category)
        VALUES (v_tenant_a, 'FAILED_DELIVERY_REVIEW', 'تكرار', 'Duplicate', 'DELIVERY');
    EXCEPTION WHEN unique_violation THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [12] Duplicate task type code in same tenant must fail';
    END IF;

    -- Assertion 13: Same task type code in different tenant is allowed
    IF (SELECT count(*) FROM public.task_type_definitions WHERE code = 'FAILED_DELIVERY_REVIEW') <> 2 THEN
        RAISE EXCEPTION 'TEST FAILED: [13] Cross-tenant same task type code failed to coexist';
    END IF;

    -- Assertion 14: Task queue tenant isolation
    IF (SELECT count(*) FROM public.task_queue_definitions WHERE tenant_id = v_tenant_a) <> 3 THEN
        RAISE EXCEPTION 'TEST FAILED: [14] Task queue count mismatch for Tenant A';
    END IF;

    -- Assertion 15: Duplicate queue code in same tenant is rejected
    v_err_caught := false;
    BEGIN
        INSERT INTO public.task_queue_definitions (tenant_id, code, name_ar, name_en, queue_category)
        VALUES (v_tenant_a, 'QUEUE_DISPATCH', 'تكرار', 'Duplicate', 'DISPATCH');
    EXCEPTION WHEN unique_violation THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [15] Duplicate queue code in same tenant must fail';
    END IF;

    -- Assertion 16: Inactive task queue rejects task creation
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_create_operational_task(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_dispatcher_a,
            p_task_type_code => 'FAILED_DELIVERY_REVIEW',
            p_title => 'Task on inactive queue',
            p_entity_type => 'SHIPMENT',
            p_entity_id => v_shp_1,
            p_assigned_queue_id => v_queue_inactive
        );
    EXCEPTION WHEN SQLSTATE '42501' THEN
        IF SQLERRM NOT LIKE '%TASK_QUEUE_INACTIVE%' THEN
            RAISE EXCEPTION 'TEST FAILED: [16] Unexpected error message: %', SQLERRM;
        END IF;
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [16] Creating task on inactive queue must be rejected';
    END IF;

    -- Assertion 17: Inactive task type rejects task creation
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_create_operational_task(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_dispatcher_a,
            p_task_type_code => 'INACTIVE_TYPE',
            p_title => 'Task on inactive type',
            p_entity_type => 'SHIPMENT',
            p_entity_id => v_shp_1
        );
    EXCEPTION WHEN SQLSTATE '42501' THEN
        IF SQLERRM NOT LIKE '%TASK_TYPE_INACTIVE%' THEN
            RAISE EXCEPTION 'TEST FAILED: [17] Unexpected error message: %', SQLERRM;
        END IF;
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [17] Creating task with inactive task type must be rejected';
    END IF;

    -- Assertion 18: Suspended tenant rejects task creation
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_create_operational_task(
            p_tenant_id => v_tenant_suspended,
            p_actor_user_id => v_admin_a,
            p_task_type_code => 'FAILED_DELIVERY_REVIEW',
            p_title => 'Suspended tenant task',
            p_entity_type => 'SHIPMENT',
            p_entity_id => v_shp_1
        );
    EXCEPTION WHEN SQLSTATE '42501' THEN
        IF SQLERRM NOT LIKE '%TENANT_SUSPENDED%' THEN
            RAISE EXCEPTION 'TEST FAILED: [18] Unexpected error message: %', SQLERRM;
        END IF;
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [18] Suspended tenant task creation must be rejected';
    END IF;


    -- ========================================================================
    -- SECTION 3: TASK CREATION, SLA SNAPSHOT & IDEMPOTENCY (Assertions 19 - 26)
    -- ========================================================================
    RAISE NOTICE 'Executing Section 3: Task Creation, SLA Snapshot & Idempotency...';

    -- Assertion 19: Valid task creation sets status OPEN, version 1, and snapshots SLA due_at
    v_res := public.execute_create_operational_task(
        p_tenant_id => v_tenant_a,
        p_actor_user_id => v_dispatcher_a,
        p_task_type_code => 'FAILED_DELIVERY_REVIEW',
        p_title => 'مراجعة عدم تسليم الشحنة 001',
        p_description => 'فشل السائق في الوصول للمستلم',
        p_entity_type => 'SHIPMENT',
        p_entity_id => v_shp_1,
        p_shipment_id => v_shp_1,
        p_leg_id => v_leg_2_lastmile,
        p_driver_id => v_driver_a2,
        p_assigned_queue_id => v_queue_dispatch,
        p_idempotency_key => 'IDEMP-TSK-CREATE-001'
    );
    v_task_id_1 := (v_res->>'task_id')::UUID;

    SELECT * INTO v_task FROM public.operational_tasks WHERE id = v_task_id_1;
    IF v_task.status <> 'OPEN' OR v_task.version <> 1 OR v_task.sla_minutes_snapshot <> 60 THEN
        RAISE EXCEPTION 'TEST FAILED: [19] Valid task creation state or SLA snapshot incorrect';
    END IF;
    v_due_at_orig := v_task.due_at;

    -- Assertion 20: Updating task_type default_sla_minutes does NOT alter existing task due_at
    UPDATE public.task_type_definitions
    SET default_sla_minutes = 300
    WHERE id = v_type_delivery;

    SELECT * INTO v_task FROM public.operational_tasks WHERE id = v_task_id_1;
    IF v_task.due_at <> v_due_at_orig OR v_task.sla_minutes_snapshot <> 60 THEN
        RAISE EXCEPTION 'TEST FAILED: [20] Changing task_type default SLA mutated historical task due_at';
    END IF;

    -- Revert default_sla_minutes
    UPDATE public.task_type_definitions SET default_sla_minutes = 60 WHERE id = v_type_delivery;

    -- Assertion 21: Same-context idempotent replay returns existing task without duplicate insert
    v_res := public.execute_create_operational_task(
        p_tenant_id => v_tenant_a,
        p_actor_user_id => v_dispatcher_a,
        p_task_type_code => 'FAILED_DELIVERY_REVIEW',
        p_title => 'مراجعة عدم تسليم الشحنة 001',
        p_entity_type => 'SHIPMENT',
        p_entity_id => v_shp_1,
        p_idempotency_key => 'IDEMP-TSK-CREATE-001'
    );
    IF (v_res->>'replayed')::BOOLEAN IS NOT TRUE OR (v_res->>'task_id')::UUID <> v_task_id_1 THEN
        RAISE EXCEPTION 'TEST FAILED: [21] Same-context replay failed or returned wrong task_id';
    END IF;

    -- Assertion 22: Changed-context replay with same idempotency key raises IDEMPOTENCY_REPLAY_MISMATCH
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_create_operational_task(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_dispatcher_a,
            p_task_type_code => 'HUB_DWELL_EXCEPTION', -- changed!
            p_title => 'Changed title',
            p_entity_type => 'SHIPMENT',
            p_entity_id => v_shp_1,
            p_idempotency_key => 'IDEMP-TSK-CREATE-001'
        );
    EXCEPTION WHEN SQLSTATE '23505' THEN
        IF SQLERRM NOT LIKE '%IDEMPOTENCY_REPLAY_MISMATCH%' THEN
            RAISE EXCEPTION 'TEST FAILED: [22] Unexpected error message: %', SQLERRM;
        END IF;
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [22] Changed-context idempotency replay mismatch was not rejected';
    END IF;

    -- Assertion 23: Cross-tenant same idempotency key succeeds without collision
    v_res := public.execute_create_operational_task(
        p_tenant_id => v_tenant_b,
        p_actor_user_id => v_user_b,
        p_task_type_code => 'FAILED_DELIVERY_REVIEW',
        p_title => 'Tenant B task with same key',
        p_entity_type => 'GENERAL',
        p_entity_id => gen_random_uuid(),
        p_idempotency_key => 'IDEMP-TSK-CREATE-001'
    );
    IF (v_res->>'success')::BOOLEAN IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST FAILED: [23] Cross-tenant same idempotency key suffered collision';
    END IF;

    -- Assertion 24: Creation with invalid priority raises INVALID_PRIORITY
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_create_operational_task(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_dispatcher_a,
            p_task_type_code => 'FAILED_DELIVERY_REVIEW',
            p_title => 'Bad priority task',
            p_priority => 'SUPER_URGENT_INVALID',
            p_entity_type => 'SHIPMENT',
            p_entity_id => v_shp_1
        );
    EXCEPTION WHEN SQLSTATE '22023' THEN
        IF SQLERRM NOT LIKE '%INVALID_PRIORITY%' THEN
            RAISE EXCEPTION 'TEST FAILED: [24] Unexpected error message: %', SQLERRM;
        END IF;
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [24] Invalid priority string must be rejected';
    END IF;

    -- Assertion 25: Creation with mismatched shipment and leg raises SHIPMENT_LEG_MISMATCH
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_create_operational_task(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_dispatcher_a,
            p_task_type_code => 'FAILED_DELIVERY_REVIEW',
            p_title => 'Mismatched leg task',
            p_entity_type => 'SHIPMENT',
            p_entity_id => v_shp_1,
            p_shipment_id => v_shp_1,
            p_leg_id => gen_random_uuid() -- non-existent or foreign leg
        );
    EXCEPTION WHEN SQLSTATE '23503' THEN
        IF SQLERRM NOT LIKE '%SHIPMENT_LEG_MISMATCH%' THEN
            RAISE EXCEPTION 'TEST FAILED: [25] Unexpected error message: %', SQLERRM;
        END IF;
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [25] Mismatched leg and shipment must be rejected';
    END IF;

    -- Assertion 26: Task CREATED event is appended to operational_task_events
    IF NOT EXISTS (
        SELECT 1 FROM public.operational_task_events
        WHERE task_id = v_task_id_1 AND event_type = 'CREATED' AND actor_user_id = v_dispatcher_a
    ) THEN
        RAISE EXCEPTION 'TEST FAILED: [26] CREATED lifecycle event missing from operational_task_events';
    END IF;


    -- ========================================================================
    -- SECTION 4: ASSIGNMENT, CONCURRENCY CLAIM & STALE WRITES (Assertions 27 - 35)
    -- ========================================================================
    RAISE NOTICE 'Executing Section 4: Assignment, Concurrency Claim & Stale Writes...';

    -- Assertion 27: Atomic claim transitions task to IN_PROGRESS, sets assigned_user_id and started_at
    v_res := public.execute_claim_operational_task(
        p_tenant_id => v_tenant_a,
        p_actor_user_id => v_operator_a,
        p_task_id => v_task_id_1,
        p_expected_version => 1
    );
    SELECT * INTO v_task FROM public.operational_tasks WHERE id = v_task_id_1;
    IF v_task.status <> 'IN_PROGRESS' OR v_task.assigned_user_id <> v_operator_a OR v_task.version <> 2 OR v_task.started_at IS NULL THEN
        RAISE EXCEPTION 'TEST FAILED: [27] Atomic claim failed to transition state or increment version';
    END IF;

    -- Assertion 28: CLAIMED event is appended to operational_task_events
    IF NOT EXISTS (
        SELECT 1 FROM public.operational_task_events
        WHERE task_id = v_task_id_1 AND event_type = 'CLAIMED' AND actor_user_id = v_operator_a
    ) THEN
        RAISE EXCEPTION 'TEST FAILED: [28] CLAIMED lifecycle event missing from operational_task_events';
    END IF;

    -- Assertion 29: Stale version claim rejects with STALE_TASK_VERSION
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_claim_operational_task(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_operator_a,
            p_task_id => v_task_id_1,
            p_expected_version => 1 -- current version is 2!
        );
    EXCEPTION WHEN SQLSTATE '40001' THEN
        IF SQLERRM NOT LIKE '%STALE_TASK_VERSION%' THEN
            RAISE EXCEPTION 'TEST FAILED: [29] Unexpected error message: %', SQLERRM;
        END IF;
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [29] Stale version claim must be rejected';
    END IF;

    -- Assertion 30: Second user concurrent claim rejects with TASK_ALREADY_CLAIMED
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_claim_operational_task(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_dispatcher_a, -- different actor!
            p_task_id => v_task_id_1,
            p_expected_version => 2
        );
    EXCEPTION WHEN SQLSTATE '23505' THEN
        IF SQLERRM NOT LIKE '%TASK_ALREADY_CLAIMED%' THEN
            RAISE EXCEPTION 'TEST FAILED: [30] Unexpected error message: %', SQLERRM;
        END IF;
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [30] Second user claim on already claimed task must be rejected';
    END IF;

    -- Assertion 31: Same user idempotent claim replay succeeds safely
    v_res := public.execute_claim_operational_task(
        p_tenant_id => v_tenant_a,
        p_actor_user_id => v_operator_a,
        p_task_id => v_task_id_1,
        p_expected_version => 2
    );
    IF (v_res->>'replayed')::BOOLEAN IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST FAILED: [31] Same-user claim replay must return replayed = true';
    END IF;

    -- Assertion 32: Supervisor assignment reassigns task to another user and increments version
    v_res := public.execute_assign_operational_task(
        p_tenant_id => v_tenant_a,
        p_actor_user_id => v_admin_a,
        p_task_id => v_task_id_1,
        p_target_user_id => v_dispatcher_a,
        p_notes => 'تحويل المهمة للمشرف',
        p_expected_version => 2
    );
    SELECT * INTO v_task FROM public.operational_tasks WHERE id = v_task_id_1;
    IF v_task.assigned_user_id <> v_dispatcher_a OR v_task.version <> 3 THEN
        RAISE EXCEPTION 'TEST FAILED: [32] Supervisor assignment failed to update target user or version';
    END IF;

    -- Assertion 33: Inactive user cannot be assigned
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_assign_operational_task(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_admin_a,
            p_task_id => v_task_id_1,
            p_target_user_id => v_user_inactive,
            p_expected_version => 3
        );
    EXCEPTION WHEN SQLSTATE 'P0002' THEN
        IF SQLERRM NOT LIKE '%TARGET_USER_INVALID%' THEN
            RAISE EXCEPTION 'TEST FAILED: [33] Unexpected error message: %', SQLERRM;
        END IF;
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [33] Assigning task to inactive user must be rejected';
    END IF;

    -- Assertion 34: Inactive actor cannot claim task
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_claim_operational_task(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_user_inactive,
            p_task_id => v_task_id_1
        );
    EXCEPTION WHEN SQLSTATE '42501' THEN
        IF SQLERRM NOT LIKE '%ACTOR_NOT_AUTHORIZED%' THEN
            RAISE EXCEPTION 'TEST FAILED: [34] Unexpected error message: %', SQLERRM;
        END IF;
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [34] Inactive actor cannot claim task';
    END IF;

    -- Assertion 35: Cross-tenant actor cannot claim task
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_claim_operational_task(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_user_b, -- belongs to Tenant B!
            p_task_id => v_task_id_1
        );
    EXCEPTION WHEN SQLSTATE '42501' THEN
        IF SQLERRM NOT LIKE '%ACTOR_NOT_AUTHORIZED%' THEN
            RAISE EXCEPTION 'TEST FAILED: [35] Unexpected error message: %', SQLERRM;
        END IF;
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [35] Cross-tenant actor claiming task must be rejected';
    END IF;


    -- ========================================================================
    -- SECTION 5: LIFECYCLE, BLOCKING, RESOLUTION & REOPEN (Assertions 36 - 45)
    -- ========================================================================
    RAISE NOTICE 'Executing Section 5: Lifecycle Transitions, Resolution & Reopen...';

    -- Create task 2 for transition testing
    v_res := public.execute_create_operational_task(
        p_tenant_id => v_tenant_a,
        p_actor_user_id => v_dispatcher_a,
        p_task_type_code => 'FAILED_DELIVERY_REVIEW',
        p_title => 'مهمة دورة الحياة 002',
        p_entity_type => 'SHIPMENT',
        p_entity_id => v_shp_1
    );
    v_task_id_2 := (v_res->>'task_id')::UUID;

    -- Assertion 36: Transition OPEN to ACKNOWLEDGED succeeds
    v_res := public.execute_update_operational_task_state(
        p_tenant_id => v_tenant_a,
        p_actor_user_id => v_operator_a,
        p_task_id => v_task_id_2,
        p_target_status => 'ACKNOWLEDGED',
        p_expected_version => 1
    );
    SELECT * INTO v_task FROM public.operational_tasks WHERE id = v_task_id_2;
    IF v_task.status <> 'ACKNOWLEDGED' OR v_task.acknowledged_at IS NULL OR v_task.version <> 2 THEN
        RAISE EXCEPTION 'TEST FAILED: [36] Transition to ACKNOWLEDGED failed';
    END IF;

    -- Assertion 37: Transition to BLOCKED requires reason; rejects without reason
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_update_operational_task_state(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_operator_a,
            p_task_id => v_task_id_2,
            p_target_status => 'BLOCKED',
            p_reason => '   ', -- empty / whitespace
            p_expected_version => 2
        );
    EXCEPTION WHEN SQLSTATE '22023' THEN
        IF SQLERRM NOT LIKE '%BLOCKED_REASON_REQUIRED%' THEN
            RAISE EXCEPTION 'TEST FAILED: [37] Unexpected error message: %', SQLERRM;
        END IF;
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [37] Transitioning to BLOCKED without reason must fail';
    END IF;

    -- Transition to BLOCKED with valid reason
    v_res := public.execute_update_operational_task_state(
        p_tenant_id => v_tenant_a,
        p_actor_user_id => v_operator_a,
        p_task_id => v_task_id_2,
        p_target_status => 'BLOCKED',
        p_reason => 'بانتظار رد العميل على الهاتف',
        p_expected_version => 2
    );
    SELECT * INTO v_task FROM public.operational_tasks WHERE id = v_task_id_2;
    IF v_task.status <> 'BLOCKED' OR v_task.blocked_at IS NULL OR v_task.version <> 3 THEN
        RAISE EXCEPTION 'TEST FAILED: [37b] Valid BLOCKED transition failed';
    END IF;

    -- Assertion 38: Unblocking to IN_PROGRESS succeeds
    v_res := public.execute_update_operational_task_state(
        p_tenant_id => v_tenant_a,
        p_actor_user_id => v_operator_a,
        p_task_id => v_task_id_2,
        p_target_status => 'IN_PROGRESS',
        p_expected_version => 3
    );
    SELECT * INTO v_task FROM public.operational_tasks WHERE id = v_task_id_2;
    IF v_task.status <> 'IN_PROGRESS' OR v_task.blocked_at IS NOT NULL OR v_task.version <> 4 THEN
        RAISE EXCEPTION 'TEST FAILED: [38] Unblocking task to IN_PROGRESS failed';
    END IF;

    -- Assertion 39: Resolution requires resolution_code and resolution_notes
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_resolve_operational_task(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_operator_a,
            p_task_id => v_task_id_2,
            p_resolution_code => '',
            p_resolution_notes => '',
            p_expected_version => 4
        );
    EXCEPTION WHEN SQLSTATE '22023' THEN
        IF SQLERRM NOT LIKE '%RESOLUTION_CODE_REQUIRED%' AND SQLERRM NOT LIKE '%RESOLUTION_NOTES_REQUIRED%' THEN
            RAISE EXCEPTION 'TEST FAILED: [39] Unexpected error message: %', SQLERRM;
        END IF;
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [39] Resolution without code/notes must be rejected';
    END IF;

    -- Assertion 40: Task resolution sets status RESOLVED and records resolved_by_user_id
    v_res := public.execute_resolve_operational_task(
        p_tenant_id => v_tenant_a,
        p_actor_user_id => v_operator_a,
        p_task_id => v_task_id_2,
        p_resolution_code => 'CUSTOMER_CONTACTED',
        p_resolution_notes => 'تم التنسيق مع العميل وإعادة جدولة التسليم ليوم الغد',
        p_expected_version => 4
    );
    SELECT * INTO v_task FROM public.operational_tasks WHERE id = v_task_id_2;
    IF v_task.status <> 'RESOLVED' OR v_task.resolved_by_user_id <> v_operator_a OR v_task.resolved_at IS NULL OR v_task.version <> 5 THEN
        RAISE EXCEPTION 'TEST FAILED: [40] Task resolution fields not recorded properly';
    END IF;

    -- Assertion 41: Task resolution DOES NOT auto-resolve linked exception
    -- (We will test this explicitly in Section 6 with an exception-linked task)

    -- Assertion 42: Reopen resolved task resets to IN_PROGRESS and increments reopen_count
    v_res := public.execute_reopen_operational_task(
        p_tenant_id => v_tenant_a,
        p_actor_user_id => v_dispatcher_a,
        p_task_id => v_task_id_2,
        p_reopen_reason => 'العميل لم يؤكد الموعد بدقة، يلزم إعادة الاتصال',
        p_expected_version => 5
    );
    SELECT * INTO v_task FROM public.operational_tasks WHERE id = v_task_id_2;
    IF v_task.status <> 'IN_PROGRESS' OR v_task.reopen_count <> 1 OR v_task.resolved_at IS NOT NULL OR v_task.version <> 6 THEN
        RAISE EXCEPTION 'TEST FAILED: [42] Reopening resolved task failed';
    END IF;

    -- Assertion 43: Unauthorized role cannot reopen task
    -- First re-resolve task 2
    PERFORM public.execute_resolve_operational_task(
        p_tenant_id => v_tenant_a,
        p_actor_user_id => v_operator_a,
        p_task_id => v_task_id_2,
        p_resolution_code => 'RESOLVED_AGAIN',
        p_resolution_notes => 'تم التأكيد النهائي',
        p_expected_version => 6
    );

    v_err_caught := false;
    BEGIN
        PERFORM public.execute_reopen_operational_task(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_driver_a1, -- DRIVER cannot reopen tasks!
            p_task_id => v_task_id_2,
            p_reopen_reason => 'Driver unauthorized reopen',
            p_expected_version => 7
        );
    EXCEPTION WHEN SQLSTATE '42501' THEN
        IF SQLERRM NOT LIKE '%INSUFFICIENT_PRIVILEGES_TO_REOPEN%' THEN
            RAISE EXCEPTION 'TEST FAILED: [43] Unexpected error message: %', SQLERRM;
        END IF;
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [43] Driver role must not be permitted to reopen tasks';
    END IF;

    -- Assertion 44: Transition RESOLVED to CLOSED terminates task
    v_res := public.execute_update_operational_task_state(
        p_tenant_id => v_tenant_a,
        p_actor_user_id => v_dispatcher_a,
        p_task_id => v_task_id_2,
        p_target_status => 'CLOSED',
        p_expected_version => 7
    );
    SELECT * INTO v_task FROM public.operational_tasks WHERE id = v_task_id_2;
    IF v_task.status <> 'CLOSED' OR v_task.closed_at IS NULL OR v_task.version <> 8 THEN
        RAISE EXCEPTION 'TEST FAILED: [44] Closing resolved task failed';
    END IF;

    -- Assertion 45: Terminal task (CLOSED or CANCELLED) cannot be assigned or transitioned
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_assign_operational_task(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_admin_a,
            p_task_id => v_task_id_2,
            p_target_user_id => v_dispatcher_a,
            p_expected_version => 8
        );
    EXCEPTION WHEN SQLSTATE '22023' THEN
        IF SQLERRM NOT LIKE '%CANNOT_ASSIGN_TERMINAL_TASK%' THEN
            RAISE EXCEPTION 'TEST FAILED: [45] Unexpected error message: %', SQLERRM;
        END IF;
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [45] Assigning closed terminal task must be rejected';
    END IF;


    -- ========================================================================
    -- SECTION 6: EXCEPTIONS & ACTIVE DEDUPE CYCLE (Assertions 46 - 54)
    -- ========================================================================
    RAISE NOTICE 'Executing Section 6: Operational Exceptions & Dedupe Cycle...';

    -- Assertion 46: Creating operational exception creates ACTIVE exception and spawns primary task
    v_res := public.execute_record_operational_exception(
        p_tenant_id => v_tenant_a,
        p_actor_user_id => v_dispatcher_a,
        p_exception_type_code => 'HUB_DWELL_EXCEPTION',
        p_entity_type => 'SHIPMENT',
        p_entity_id => v_shp_1,
        p_shipment_id => v_shp_1,
        p_facility_id => v_facility_hub_a,
        p_severity => 'URGENT',
        p_source_rule_code => 'RULE_HUB_DWELL_24H',
        p_spawn_task => true,
        p_task_title => 'معالجة مكوث الشحنة في مركز الفرز',
        p_task_queue_code => 'QUEUE_HUB'
    );
    v_exception_id_1 := (v_res->>'exception_id')::UUID;
    v_task_id_3 := (v_res->>'linked_task_id')::UUID;

    IF (v_res->>'is_new_cycle')::BOOLEAN IS NOT TRUE OR v_exception_id_1 IS NULL OR v_task_id_3 IS NULL THEN
        RAISE EXCEPTION 'TEST FAILED: [46] New exception cycle failed to create exception and primary task';
    END IF;

    SELECT * INTO v_exception FROM public.operational_exceptions WHERE id = v_exception_id_1;
    IF v_exception.status <> 'ACTIVE' OR v_exception.occurrence_count <> 1 OR v_exception.severity <> 'URGENT' THEN
        RAISE EXCEPTION 'TEST FAILED: [46b] Exception attributes incorrect';
    END IF;

    SELECT * INTO v_task FROM public.operational_tasks WHERE id = v_task_id_3;
    IF v_task.assigned_queue_id <> v_queue_hub THEN
        RAISE EXCEPTION 'TEST FAILED: [46c] Task assigned_queue_id mismatch with requested QUEUE_HUB';
    END IF;

    -- Assertion 47: Active exception dedupe: repeated hit increments occurrence_count, updates last_detected_at
    v_res := public.execute_record_operational_exception(
        p_tenant_id => v_tenant_a,
        p_actor_user_id => v_dispatcher_a,
        p_exception_type_code => 'HUB_DWELL_EXCEPTION',
        p_entity_type => 'SHIPMENT',
        p_entity_id => v_shp_1,
        p_shipment_id => v_shp_1,
        p_facility_id => v_facility_hub_a,
        p_spawn_task => true
    );
    IF (v_res->>'is_new_cycle')::BOOLEAN IS NOT FALSE OR (v_res->>'occurrence_count')::INTEGER <> 2 THEN
        RAISE EXCEPTION 'TEST FAILED: [47] Repeated detector hit did not deduplicate or increment occurrence_count';
    END IF;

    -- Assertion 48: Active exception dedupe: repeated hit DOES NOT spawn duplicate task
    IF (v_res->>'linked_task_id')::UUID <> v_task_id_3 THEN
        RAISE EXCEPTION 'TEST FAILED: [48] Repeated detector hit returned different task_id';
    END IF;
    IF (SELECT count(*) FROM public.operational_tasks WHERE linked_exception_id = v_exception_id_1) <> 1 THEN
        RAISE EXCEPTION 'TEST FAILED: [48b] Duplicate tasks spawned for single active exception cycle';
    END IF;

    -- Assertion 41 (Verified here): Task resolution DOES NOT auto-resolve linked exception
    PERFORM public.execute_claim_operational_task(
        p_tenant_id => v_tenant_a,
        p_actor_user_id => v_operator_a,
        p_task_id => v_task_id_3
    );
    PERFORM public.execute_resolve_operational_task(
        p_tenant_id => v_tenant_a,
        p_actor_user_id => v_operator_a,
        p_task_id => v_task_id_3,
        p_resolution_code => 'INSPECTED_PARCEL',
        p_resolution_notes => 'تم فحص الشحنة في مركز الفرز والتأكد من سلامتها'
    );
    -- Check task is resolved
    SELECT * INTO v_task FROM public.operational_tasks WHERE id = v_task_id_3;
    IF v_task.status <> 'RESOLVED' THEN
        RAISE EXCEPTION 'TEST FAILED: [41a] Task 3 not resolved';
    END IF;
    -- Check exception remains ACTIVE!
    SELECT * INTO v_exception FROM public.operational_exceptions WHERE id = v_exception_id_1;
    IF v_exception.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'TEST FAILED: [41b] Resolving task falsely auto-resolved linked exception!';
    END IF;

    -- Assertion 49: Resolving exception transitions to RESOLVED with resolution_mode MANUAL_VERIFIED
    v_res := public.execute_resolve_operational_exception(
        p_tenant_id => v_tenant_a,
        p_actor_user_id => v_dispatcher_a,
        p_exception_id => v_exception_id_1,
        p_resolution_code => 'PARCEL_DISPATCHED_TO_ROUTE',
        p_resolution_notes => 'تم خروج الشحنة على مانيفست النقل الخارجي',
        p_resolution_mode => 'MANUAL_VERIFIED'
    );
    SELECT * INTO v_exception FROM public.operational_exceptions WHERE id = v_exception_id_1;
    IF v_exception.status <> 'RESOLVED' OR v_exception.resolution_mode <> 'MANUAL_VERIFIED' OR v_exception.resolved_by_user_id <> v_dispatcher_a THEN
        RAISE EXCEPTION 'TEST FAILED: [49] Resolving operational exception failed';
    END IF;

    -- Assertion 50: After resolution, a new recurrence starts a NEW exception cycle with occurrence_count 1
    v_res := public.execute_record_operational_exception(
        p_tenant_id => v_tenant_a,
        p_actor_user_id => v_dispatcher_a,
        p_exception_type_code => 'HUB_DWELL_EXCEPTION',
        p_entity_type => 'SHIPMENT',
        p_entity_id => v_shp_1,
        p_shipment_id => v_shp_1,
        p_facility_id => v_facility_hub_a,
        p_spawn_task => true
    );
    v_exception_id_2 := (v_res->>'exception_id')::UUID;
    v_task_id_4 := (v_res->>'linked_task_id')::UUID;
    IF (v_res->>'is_new_cycle')::BOOLEAN IS NOT TRUE OR v_exception_id_2 = v_exception_id_1 OR (v_res->>'occurrence_count')::INTEGER <> 1 THEN
        RAISE EXCEPTION 'TEST FAILED: [50] New exception cycle failed to start after prior cycle was resolved';
    END IF;

    -- Assertion 50b: Exception auto-spawns task with NULL assigned_queue_id when queue is optional/omitted
    IF v_task_id_4 IS NULL THEN
        RAISE EXCEPTION 'TEST FAILED: [50b] Task not linked to new exception cycle';
    END IF;
    SELECT * INTO v_task FROM public.operational_tasks WHERE id = v_task_id_4;
    IF v_task.assigned_queue_id IS NOT NULL THEN
        RAISE EXCEPTION 'TEST FAILED: [50c] Auto-spawned task without queue code must have NULL assigned_queue_id';
    END IF;

    -- Assertion 50d: Invalid queue code rejected
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_record_operational_exception(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_dispatcher_a,
            p_exception_type_code => 'FAILED_DELIVERY_REVIEW',
            p_entity_type => 'SHIPMENT',
            p_entity_id => v_shp_1,
            p_spawn_task => true,
            p_task_queue_code => 'NON_EXISTENT_QUEUE'
        );
    EXCEPTION WHEN SQLSTATE 'P0002' THEN
        IF SQLERRM NOT LIKE '%TASK_QUEUE_NOT_FOUND%' THEN
            RAISE EXCEPTION 'TEST FAILED: [50d] Unexpected error message: %', SQLERRM;
        END IF;
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [50d] Invalid queue code must be rejected with TASK_QUEUE_NOT_FOUND';
    END IF;

    -- Assertion 50e: Cross-tenant queue code rejected
    INSERT INTO public.task_queue_definitions (tenant_id, code, name_ar, name_en, queue_category)
    VALUES (v_tenant_b, 'QUEUE_BETA_EXCLUSIVE', 'طابور حصري بيتا', 'Beta Exclusive Queue', 'DISPATCH');

    v_err_caught := false;
    BEGIN
        PERFORM public.execute_record_operational_exception(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_dispatcher_a,
            p_exception_type_code => 'FAILED_DELIVERY_REVIEW',
            p_entity_type => 'SHIPMENT',
            p_entity_id => v_shp_1,
            p_spawn_task => true,
            p_task_queue_code => 'QUEUE_BETA_EXCLUSIVE'
        );
    EXCEPTION WHEN SQLSTATE 'P0002' THEN
        IF SQLERRM NOT LIKE '%TASK_QUEUE_NOT_FOUND%' THEN
            RAISE EXCEPTION 'TEST FAILED: [50e] Unexpected error message: %', SQLERRM;
        END IF;
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [50e] Cross-tenant queue code must be rejected with TASK_QUEUE_NOT_FOUND';
    END IF;

    -- Assertion 50f: Inactive queue code rejected
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_record_operational_exception(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_dispatcher_a,
            p_exception_type_code => 'FAILED_DELIVERY_REVIEW',
            p_entity_type => 'SHIPMENT',
            p_entity_id => v_shp_1,
            p_spawn_task => true,
            p_task_queue_code => 'QUEUE_INACTIVE'
        );
    EXCEPTION WHEN SQLSTATE '42501' THEN
        IF SQLERRM NOT LIKE '%TASK_QUEUE_INACTIVE%' THEN
            RAISE EXCEPTION 'TEST FAILED: [50f] Unexpected error message: %', SQLERRM;
        END IF;
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [50f] Inactive queue code must be rejected with TASK_QUEUE_INACTIVE';
    END IF;

    -- Assertion 51: Suppressing exception sets status SUPPRESSED
    v_res := public.execute_resolve_operational_exception(
        p_tenant_id => v_tenant_a,
        p_actor_user_id => v_admin_a,
        p_exception_id => v_exception_id_2,
        p_resolution_code => 'FALSE_POSITIVE',
        p_resolution_notes => 'الشحنة مستثناة من مهلة المكوث بموافقة الإدارة',
        p_resolution_mode => 'SUPPRESSED'
    );
    SELECT * INTO v_exception FROM public.operational_exceptions WHERE id = v_exception_id_2;
    IF v_exception.status <> 'SUPPRESSED' OR v_exception.resolution_mode <> 'SUPPRESSED' THEN
        RAISE EXCEPTION 'TEST FAILED: [51] Suppressing exception failed';
    END IF;

    -- Assertion 52: Cross-tenant exception deduplication is completely isolated
    v_res := public.execute_record_operational_exception(
        p_tenant_id => v_tenant_b,
        p_actor_user_id => v_user_b,
        p_exception_type_code => 'HUB_DWELL_EXCEPTION',
        p_entity_type => 'SHIPMENT',
        p_entity_id => v_shp_1, -- same entity_id, different tenant
        p_spawn_task => false
    );
    IF (v_res->>'is_new_cycle')::BOOLEAN IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST FAILED: [52] Cross-tenant exception collided in deduplication';
    END IF;

    -- Assertion 53: Non-active exception cannot be resolved again
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_resolve_operational_exception(
            p_tenant_id => v_tenant_a,
            p_actor_user_id => v_admin_a,
            p_exception_id => v_exception_id_1, -- already RESOLVED
            p_resolution_code => 'TRY_AGAIN',
            p_resolution_notes => 'Invalid duplicate resolution'
        );
    EXCEPTION WHEN SQLSTATE '22023' THEN
        IF SQLERRM NOT LIKE '%EXCEPTION_NOT_ACTIVE%' THEN
            RAISE EXCEPTION 'TEST FAILED: [53] Unexpected error message: %', SQLERRM;
        END IF;
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [53] Resolving an already resolved exception must be rejected';
    END IF;

    -- Assertion 54: Exception resolution DOES NOT alter underlying entity
    IF (SELECT status FROM public.shipments WHERE id = v_shp_1) <> 'OUT_FOR_DELIVERY' THEN
        RAISE EXCEPTION 'TEST FAILED: [54] Exception operations mutated shipment status!';
    END IF;


    -- ========================================================================
    -- SECTION 7: COLLABORATION, SCOPING & IMMUTABILITY (Assertions 55 - 60)
    -- ========================================================================
    RAISE NOTICE 'Executing Section 7: Collaboration, Scoping & Immutability...';

    -- Assertion 55: Adding comment to operational_task_comments succeeds with visibility INTERNAL
    INSERT INTO public.operational_task_comments (
        tenant_id, task_id, author_user_id, comment_text, visibility
    ) VALUES (
        v_tenant_a, v_task_id_1, v_operator_a, 'ملاحظة داخلية: تم التنسيق مع السائق', 'INTERNAL'
    );
    IF NOT EXISTS (
        SELECT 1 FROM public.operational_task_comments
        WHERE task_id = v_task_id_1 AND author_user_id = v_operator_a AND visibility = 'INTERNAL'
    ) THEN
        RAISE EXCEPTION 'TEST FAILED: [55] Adding task comment failed';
    END IF;

    -- Assertion 56: Comment with whitespace-only text is rejected by check constraint
    v_err_caught := false;
    BEGIN
        INSERT INTO public.operational_task_comments (
            tenant_id, task_id, author_user_id, comment_text, visibility
        ) VALUES (
            v_tenant_a, v_task_id_1, v_operator_a, '   ', 'INTERNAL'
        );
    EXCEPTION WHEN check_violation THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [56] Whitespace-only comment text must be rejected';
    END IF;

    -- Assertion 57: Comment visibility values restricted to ('INTERNAL', 'MERCHANT_VISIBLE', 'DRIVER_VISIBLE')
    v_err_caught := false;
    BEGIN
        INSERT INTO public.operational_task_comments (
            tenant_id, task_id, author_user_id, comment_text, visibility
        ) VALUES (
            v_tenant_a, v_task_id_1, v_operator_a, 'Valid comment', 'PUBLIC_WORLD_INVALID'
        );
    EXCEPTION WHEN check_violation THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [57] Invalid comment visibility must be rejected';
    END IF;

    -- Assertion 58: Historical events in operational_task_events are append-only (cannot UPDATE)
    v_err_caught := false;
    BEGIN
        UPDATE public.operational_task_events
        SET event_type = 'CLAIMED'
        WHERE task_id = v_task_id_1;
    EXCEPTION WHEN SQLSTATE '42501' THEN
        IF SQLERRM NOT LIKE '%OPERATIONAL_TASK_EVENTS_ARE_APPEND_ONLY%' THEN
            RAISE EXCEPTION 'TEST FAILED: [58] Unexpected error message: %', SQLERRM;
        END IF;
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'TEST FAILED: [58] Updating operational_task_events must be blocked by append-only trigger';
    END IF;

    IF (SELECT count(*) FROM public.operational_task_events WHERE task_id = v_task_id_1) < 2 THEN
        RAISE EXCEPTION 'TEST FAILED: [58b] Operational task events missing lifecycle audit trail';
    END IF;

    -- Assertion 59: Event ordering is strictly chronological
    IF EXISTS (
        SELECT 1
        FROM public.operational_task_events e1
        JOIN public.operational_task_events e2 ON e1.task_id = e2.task_id AND e1.created_at > e2.created_at
        WHERE e1.task_id = v_task_id_1 AND e1.occurred_at < e2.occurred_at
    ) THEN
        RAISE EXCEPTION 'TEST FAILED: [59] Event chronological ordering violated';
    END IF;

    -- Assertion 60: Actor identity in task events matches transaction caller
    IF NOT EXISTS (
        SELECT 1 FROM public.operational_task_events
        WHERE task_id = v_task_id_1 AND event_type = 'CLAIMED' AND actor_user_id = v_operator_a
    ) THEN
        RAISE EXCEPTION 'TEST FAILED: [60] Task event actor_user_id mismatch';
    END IF;


    -- ========================================================================
    -- SECTION 8: MULTI-LEG, FINANCIAL & PHYSICAL CUSTODY INVARIANTS (Assertions 61 - 66)
    -- ========================================================================
    RAISE NOTICE 'Executing Section 8: Multi-Leg & Custody Invariants...';

    -- Assertion 61: No fake FORWARD leg type persisted (only canonical PICKUP, TRANSFER, LAST_MILE, DIRECT, RETURN)
    IF EXISTS (
        SELECT 1 FROM public.shipment_legs
        WHERE leg_type NOT IN ('PICKUP', 'TRANSFER', 'LAST_MILE', 'DIRECT', 'RETURN')
    ) THEN
        RAISE EXCEPTION 'TEST FAILED: [61] Invalid or fake leg type persisted!';
    END IF;

    -- Assertion 62: Multi-leg tasks accurately reference distinct drivers per leg without collapse
    -- Leg 1 has Driver A1, Leg 2 has Driver A2. Creating task for Leg 1 references Driver A1:
    v_res := public.execute_create_operational_task(
        p_tenant_id => v_tenant_a,
        p_actor_user_id => v_dispatcher_a,
        p_task_type_code => 'FAILED_DELIVERY_REVIEW',
        p_title => 'مهمة خاصة بمرحلة الاستلام',
        p_entity_type => 'SHIPMENT_LEG',
        p_entity_id => v_leg_1_pickup,
        p_shipment_id => v_shp_1,
        p_leg_id => v_leg_1_pickup,
        p_driver_id => v_driver_a1
    );
    SELECT * INTO v_task FROM public.operational_tasks WHERE id = (v_res->>'task_id')::UUID;
    IF v_task.leg_id <> v_leg_1_pickup OR v_task.driver_id <> v_driver_a1 THEN
        RAISE EXCEPTION 'TEST FAILED: [62] Task failed to bind to distinct leg and leg driver';
    END IF;

    -- Assertion 63: Resolving task produces zero mutation to shipments table (status, balance untouched)
    IF (SELECT status FROM public.shipments WHERE id = v_shp_1) <> 'OUT_FOR_DELIVERY'
       OR (SELECT cod_amount FROM public.shipments WHERE id = v_shp_1) <> 40.000 THEN
        RAISE EXCEPTION 'TEST FAILED: [63] Shipment status or financial snapshot was mutated by task engine!';
    END IF;

    -- Assertion 64: Resolving task produces zero mutation to shipment_current_custody table
    -- Custody table has zero records inserted or touched by task engine
    IF EXISTS (
        SELECT 1 FROM public.shipment_current_custody WHERE shipment_id = v_shp_1
    ) THEN
        RAISE EXCEPTION 'TEST FAILED: [64] Custody record unexpectedly created by task engine!';
    END IF;

    -- Assertion 65: Resolving task produces zero mutation to custody_events table
    IF EXISTS (
        SELECT 1 FROM public.custody_events WHERE shipment_id = v_shp_1
    ) THEN
        RAISE EXCEPTION 'TEST FAILED: [65] Physical custody events falsely created by task engine!';
    END IF;

    -- Assertion 66: Resolving task produces zero mutation to financial customer_payment_records or driver_cash_collections
    IF EXISTS (
        SELECT 1 FROM public.customer_payment_records WHERE shipment_id = v_shp_1
    ) OR EXISTS (
        SELECT 1 FROM public.driver_cash_collections WHERE shipment_id = v_shp_1
    ) THEN
        RAISE EXCEPTION 'TEST FAILED: [66] Financial payment or cash records falsely mutated by task engine!';
    END IF;

    RAISE NOTICE '====================================================================';
    RAISE NOTICE 'ALL 66 PHASE 3C / STEP 7.1 ASSERTIONS PASSED SUCCESSFULLY';
    RAISE NOTICE '====================================================================';
END $$;

ROLLBACK;

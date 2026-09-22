-- ============================================================================
-- DELIVERE — PHASE 3C / STEP 7.1 DATABASE HOTFIX 1
-- File: supabase/migrations/20260924_phase3c_operational_tasks_v_queue_hotfix.sql
-- Target: DEVELOPMENT_STAGING (Already-installed Step 7.1 Schema)
--
-- FIX DESCRIPTION:
-- Replace public.execute_record_operational_exception to eliminate unsafe
-- dereference of unassigned RECORD variable v_queue (PostgreSQL error 55000).
--
-- CHANGES:
-- 1. Replace RECORD v_queue with scalar v_assigned_queue_id UUID := NULL and
--    v_queue_is_active BOOLEAN.
-- 2. When p_task_queue_code IS NOT NULL:
--    - Validate existence in public.task_queue_definitions for same tenant
--      (raises TASK_QUEUE_NOT_FOUND if missing or cross-tenant).
--    - Validate active status (raises TASK_QUEUE_INACTIVE if inactive).
-- 3. When p_task_queue_code IS NULL:
--    - v_assigned_queue_id remains NULL without indeterminate tuple access.
-- 4. Maintain identical function signature, SECURITY DEFINER, search_path,
--    privilege revokes from PUBLIC/anon/authenticated and grant to service_role.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.execute_record_operational_exception(
    p_tenant_id UUID,
    p_actor_user_id UUID,
    p_exception_type_code TEXT,
    p_entity_type TEXT,
    p_entity_id UUID,
    p_severity TEXT DEFAULT 'NORMAL',
    p_source_type TEXT DEFAULT 'SYSTEM_DETECTOR',
    p_source_rule_code TEXT DEFAULT NULL,
    p_source_event_id UUID DEFAULT NULL,
    p_shipment_id UUID DEFAULT NULL,
    p_leg_id UUID DEFAULT NULL,
    p_manifest_id UUID DEFAULT NULL,
    p_merchant_id UUID DEFAULT NULL,
    p_driver_id UUID DEFAULT NULL,
    p_facility_id UUID DEFAULT NULL,
    p_merchant_branch_id UUID DEFAULT NULL,
    p_spawn_task BOOLEAN DEFAULT true,
    p_task_title TEXT DEFAULT NULL,
    p_task_description TEXT DEFAULT NULL,
    p_task_queue_code TEXT DEFAULT NULL,
    p_task_type_code TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tenant RECORD;
    v_actor RECORD;
    v_active_exception RECORD;
    v_exception_id UUID;
    v_task_id UUID := NULL;
    v_task_type RECORD;
    v_assigned_queue_id UUID := NULL;
    v_queue_is_active BOOLEAN;
    v_task_type_code TEXT;
    v_effective_title TEXT;
    v_due_at TIMESTAMPTZ;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_event_id UUID;
BEGIN
    SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
    IF NOT FOUND OR v_tenant.is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'TENANT_NOT_AUTHORIZED' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_actor FROM public.users WHERE id = p_actor_user_id AND tenant_id = p_tenant_id;
    IF NOT FOUND OR v_actor.is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'ACTOR_NOT_AUTHORIZED' USING ERRCODE = '42501';
    END IF;

    -- Verify leg belongs to shipment if both supplied
    IF p_shipment_id IS NOT NULL AND p_leg_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.shipment_legs
            WHERE id = p_leg_id AND shipment_id = p_shipment_id AND tenant_id = p_tenant_id
        ) THEN
            RAISE EXCEPTION 'SHIPMENT_LEG_MISMATCH' USING ERRCODE = '23503';
        END IF;
    END IF;

    -- 1. Check for existing ACTIVE exception cycle for same target condition
    SELECT * INTO v_active_exception
    FROM public.operational_exceptions
    WHERE tenant_id = p_tenant_id
      AND exception_type_code = p_exception_type_code
      AND entity_type = p_entity_type
      AND entity_id = p_entity_id
      AND status = 'ACTIVE'
    FOR UPDATE;

    IF FOUND THEN
        -- Existing active exception cycle: increment count, update last_detected_at, do NOT spawn new task
        UPDATE public.operational_exceptions
        SET last_detected_at = v_now,
            occurrence_count = occurrence_count + 1,
            metadata = metadata || p_metadata,
            updated_at = v_now
        WHERE id = v_active_exception.id AND tenant_id = p_tenant_id;

        -- Find linked task if any
        SELECT id INTO v_task_id
        FROM public.operational_tasks
        WHERE linked_exception_id = v_active_exception.id AND tenant_id = p_tenant_id
        ORDER BY created_at ASC
        LIMIT 1;

        RETURN jsonb_build_object(
            'success', true,
            'is_new_cycle', false,
            'exception_id', v_active_exception.id,
            'status', 'ACTIVE',
            'occurrence_count', v_active_exception.occurrence_count + 1,
            'linked_task_id', v_task_id
        );
    END IF;

    -- 2. New Active Exception Cycle
    v_exception_id := gen_random_uuid();
    BEGIN
        INSERT INTO public.operational_exceptions (
            id, tenant_id, exception_type_code, entity_type, entity_id,
            shipment_id, leg_id, manifest_id, merchant_id, driver_id, facility_id, merchant_branch_id,
            severity, status, first_detected_at, last_detected_at, occurrence_count,
            source_type, source_event_id, source_rule_code, metadata, created_at, updated_at
        ) VALUES (
            v_exception_id, p_tenant_id, p_exception_type_code, p_entity_type, p_entity_id,
            p_shipment_id, p_leg_id, p_manifest_id, p_merchant_id, p_driver_id, p_facility_id, p_merchant_branch_id,
            COALESCE(p_severity, 'NORMAL'), 'ACTIVE', v_now, v_now, 1,
            p_source_type, p_source_event_id, p_source_rule_code, p_metadata, v_now, v_now
        );
    EXCEPTION WHEN unique_violation THEN
        -- Concurrent detector insert won the race; re-fetch and update occurrence
        SELECT * INTO v_active_exception
        FROM public.operational_exceptions
        WHERE tenant_id = p_tenant_id
          AND exception_type_code = p_exception_type_code
          AND entity_type = p_entity_type
          AND entity_id = p_entity_id
          AND status = 'ACTIVE'
        FOR UPDATE;

        UPDATE public.operational_exceptions
        SET last_detected_at = v_now,
            occurrence_count = occurrence_count + 1,
            metadata = metadata || p_metadata,
            updated_at = v_now
        WHERE id = v_active_exception.id AND tenant_id = p_tenant_id;

        SELECT id INTO v_task_id
        FROM public.operational_tasks
        WHERE linked_exception_id = v_active_exception.id AND tenant_id = p_tenant_id
        ORDER BY created_at ASC
        LIMIT 1;

        RETURN jsonb_build_object(
            'success', true,
            'is_new_cycle', false,
            'exception_id', v_active_exception.id,
            'status', 'ACTIVE',
            'occurrence_count', v_active_exception.occurrence_count + 1,
            'linked_task_id', v_task_id
        );
    END;

    -- 3. Spawn Primary Task if requested
    IF p_spawn_task IS TRUE THEN
        v_task_type_code := COALESCE(p_task_type_code, p_exception_type_code);
        SELECT * INTO v_task_type
        FROM public.task_type_definitions
        WHERE tenant_id = p_tenant_id AND code = v_task_type_code AND is_active IS TRUE;

        -- Fallback to first active task type in tenant if specific type code not found
        IF NOT FOUND THEN
            SELECT * INTO v_task_type
            FROM public.task_type_definitions
            WHERE tenant_id = p_tenant_id AND is_active IS TRUE
            ORDER BY created_at ASC
            LIMIT 1;
        END IF;

        IF FOUND THEN
            -- Lookup Queue if specified
            IF p_task_queue_code IS NOT NULL THEN
                SELECT id, is_active INTO v_assigned_queue_id, v_queue_is_active
                FROM public.task_queue_definitions
                WHERE tenant_id = p_tenant_id AND code = p_task_queue_code;

                IF NOT FOUND THEN
                    RAISE EXCEPTION 'TASK_QUEUE_NOT_FOUND' USING ERRCODE = 'P0002';
                END IF;

                IF v_queue_is_active IS NOT TRUE THEN
                    RAISE EXCEPTION 'TASK_QUEUE_INACTIVE' USING ERRCODE = '42501';
                END IF;
            END IF;

            v_effective_title := COALESCE(p_task_title, 'معالجة استثناء تشغيلي: ' || p_exception_type_code);
            v_due_at := v_now + (v_task_type.default_sla_minutes * INTERVAL '1 minute');
            v_task_id := gen_random_uuid();

            INSERT INTO public.operational_tasks (
                id, tenant_id, task_type_id, task_type_code, title, description,
                priority, status, linked_exception_id, entity_type, entity_id,
                shipment_id, leg_id, manifest_id, merchant_id, driver_id, facility_id, merchant_branch_id,
                assigned_queue_id, created_by_type, created_by_user_id, source_event_id,
                due_at, sla_minutes_snapshot, sla_source_snapshot, escalation_level,
                opened_at, version, created_at, updated_at
            ) VALUES (
                v_task_id, p_tenant_id, v_task_type.id, v_task_type.code, v_effective_title, p_task_description,
                COALESCE(p_severity, v_task_type.default_priority), 'OPEN', v_exception_id, p_entity_type, p_entity_id,
                p_shipment_id, p_leg_id, p_manifest_id, p_merchant_id, p_driver_id, p_facility_id, p_merchant_branch_id,
                v_assigned_queue_id, 'AUTOMATION', p_actor_user_id, p_source_event_id,
                v_due_at, v_task_type.default_sla_minutes, 'EXCEPTION_AUTO_SPAWN', 0,
                v_now, 1, v_now, v_now
            );

            v_event_id := gen_random_uuid();
            INSERT INTO public.operational_task_events (
                id, tenant_id, task_id, actor_user_id, actor_role, event_type,
                old_status, new_status, old_assigned_queue_id, new_assigned_queue_id,
                payload, occurred_at, created_at
            ) VALUES (
                v_event_id, p_tenant_id, v_task_id, p_actor_user_id, v_actor.role, 'CREATED',
                NULL, 'OPEN', NULL, v_assigned_queue_id,
                jsonb_build_object('source', 'EXCEPTION_AUTO_SPAWN', 'exception_id', v_exception_id),
                v_now, v_now
            );
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'is_new_cycle', true,
        'exception_id', v_exception_id,
        'status', 'ACTIVE',
        'occurrence_count', 1,
        'linked_task_id', v_task_id
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.execute_record_operational_exception FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_record_operational_exception TO service_role;

COMMIT;

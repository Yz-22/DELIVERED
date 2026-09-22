-- ============================================================================
-- DELIVERE — PHASE 3C / STEP 7.1 DATABASE HOTFIX 2
-- File: supabase/migrations/20260924_phase3c_operational_tasks_claim_guard_hotfix.sql
-- Target: DEVELOPMENT_STAGING (Step 7.1 Schema)
--
-- FIX DESCRIPTION:
-- Correct guard evaluation precedence in public.execute_claim_operational_task
-- so that:
-- 1. Idempotent replay succeeds for same actor on IN_PROGRESS task.
-- 2. Non-claimable terminal states (RESOLVED, CLOSED, CANCELLED) raise
--    TASK_NOT_CLAIMABLE (22023).
-- 3. Conflicting claims by a different actor on an already claimed / assigned task
--    raise TASK_ALREADY_CLAIMED (23505).
-- 4. Status eligibility for unassigned tasks requires OPEN or ACKNOWLEDGED;
--    otherwise raises TASK_NOT_CLAIMABLE (22023).
--
-- STATUS: PROPOSED HOTFIX — NOT EXECUTED BY AI — PENDING USER MANUAL EXECUTION
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.execute_claim_operational_task(
    p_tenant_id UUID,
    p_actor_user_id UUID,
    p_task_id UUID,
    p_expected_version INTEGER DEFAULT NULL,
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
    v_task RECORD;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_event_id UUID;
BEGIN
    -- 1. Validate Tenant & Actor
    SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
    IF NOT FOUND OR v_tenant.is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'TENANT_NOT_AUTHORIZED' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_actor FROM public.users WHERE id = p_actor_user_id AND tenant_id = p_tenant_id;
    IF NOT FOUND OR v_actor.is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'ACTOR_NOT_AUTHORIZED' USING ERRCODE = '42501';
    END IF;

    IF v_actor.role NOT IN ('SUPER_ADMIN', 'ADMIN', 'DISPATCHER', 'OPERATOR') THEN
        RAISE EXCEPTION 'INSUFFICIENT_PRIVILEGES_TO_CLAIM' USING ERRCODE = '42501';
    END IF;

    -- 2. Lock Task Row FOR UPDATE
    SELECT * INTO v_task
    FROM public.operational_tasks
    WHERE id = p_task_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'TASK_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    -- 3. Stale Write Protection
    IF p_expected_version IS NOT NULL AND v_task.version <> p_expected_version THEN
        RAISE EXCEPTION 'STALE_TASK_VERSION' USING ERRCODE = '40001';
    END IF;

    -- 4. Idempotent check (if already claimed by this exact actor)
    IF v_task.assigned_user_id = p_actor_user_id AND v_task.status = 'IN_PROGRESS' THEN
        RETURN jsonb_build_object(
            'success', true,
            'replayed', true,
            'task_id', v_task.id,
            'status', v_task.status,
            'assigned_user_id', v_task.assigned_user_id,
            'version', v_task.version
        );
    END IF;

    -- 5. Terminal State Guard
    IF v_task.status IN ('RESOLVED', 'CLOSED', 'CANCELLED') THEN
        RAISE EXCEPTION 'TASK_NOT_CLAIMABLE' USING ERRCODE = '22023';
    END IF;

    -- 6. Conflicting Assignment Guard (already claimed / assigned to another user)
    IF v_task.assigned_user_id IS NOT NULL AND v_task.assigned_user_id <> p_actor_user_id THEN
        RAISE EXCEPTION 'TASK_ALREADY_CLAIMED' USING ERRCODE = '23505';
    END IF;

    -- 7. Claimability Status Guard (must be OPEN or ACKNOWLEDGED)
    IF v_task.status NOT IN ('OPEN', 'ACKNOWLEDGED') THEN
        RAISE EXCEPTION 'TASK_NOT_CLAIMABLE' USING ERRCODE = '22023';
    END IF;

    -- 8. Execute Claim
    UPDATE public.operational_tasks
    SET assigned_user_id = p_actor_user_id,
        status = 'IN_PROGRESS',
        started_at = COALESCE(started_at, v_now),
        version = version + 1,
        updated_at = v_now
    WHERE id = p_task_id AND tenant_id = p_tenant_id;

    -- 9. Append Event
    v_event_id := gen_random_uuid();
    INSERT INTO public.operational_task_events (
        id, tenant_id, task_id, actor_user_id, actor_role, event_type,
        old_status, new_status, old_assigned_user_id, new_assigned_user_id,
        payload, idempotency_key, occurred_at, created_at
    ) VALUES (
        v_event_id, p_tenant_id, p_task_id, p_actor_user_id, v_actor.role, 'CLAIMED',
        v_task.status, 'IN_PROGRESS', v_task.assigned_user_id, p_actor_user_id,
        jsonb_build_object('claimed_at', v_now), p_idempotency_key, v_now, v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'task_id', p_task_id,
        'status', 'IN_PROGRESS',
        'assigned_user_id', p_actor_user_id,
        'version', v_task.version + 1
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.execute_claim_operational_task FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_claim_operational_task TO service_role;

COMMIT;

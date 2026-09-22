-- ============================================================================
-- DELIVERE — PHASE 3C / STEP 7.1: OPERATIONAL TASKS & EXCEPTIONS FOUNDATION
-- File: supabase/migrations/20260924_phase3c_operational_tasks_and_exceptions.sql
-- Description: Authoritative operational work-management & exception engine:
--              1. Tables:
--                 - public.task_queue_definitions
--                 - public.task_type_definitions
--                 - public.operational_exceptions
--                 - public.operational_tasks
--                 - public.operational_task_events
--                 - public.operational_task_comments
--              2. Transaction RPCs (SECURITY DEFINER, service_role only):
--                 - public.execute_create_operational_task
--                 - public.execute_claim_operational_task
--                 - public.execute_assign_operational_task
--                 - public.execute_update_operational_task_state
--                 - public.execute_resolve_operational_task
--                 - public.execute_reopen_operational_task
--                 - public.execute_record_operational_exception
--                 - public.execute_resolve_operational_exception
-- Target Engine: PostgreSQL 15+ (Supabase)
-- Mode: Zero mutation of canonical shipment, custody, or financial tables.
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: QUEUE & TASK TYPE DEFINITIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Task Queue Definitions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_queue_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    code TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    description_ar TEXT,
    description_en TEXT,
    queue_category TEXT NOT NULL CHECK (queue_category IN (
        'DISPATCH', 'HUB_OPERATIONS', 'DELIVERY_SUPPORT',
        'FINANCIAL_RECONCILIATION', 'MERCHANT_SUPPORT', 'GENERAL'
    )),
    facility_id UUID,
    merchant_branch_id UUID,
    allowed_roles public.user_role[] DEFAULT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_task_queues_facility FOREIGN KEY (facility_id, tenant_id)
        REFERENCES public.operational_facilities(id, tenant_id) ON DELETE RESTRICT,
    CONSTRAINT fk_task_queues_branch FOREIGN KEY (merchant_branch_id, tenant_id)
        REFERENCES public.merchant_branches(id, tenant_id) ON DELETE RESTRICT,
    CONSTRAINT uq_task_queue_code UNIQUE (tenant_id, code),
    CONSTRAINT uq_task_queue_composite UNIQUE (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_task_queues_tenant_active
    ON public.task_queue_definitions (tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_task_queues_facility
    ON public.task_queue_definitions (tenant_id, facility_id) WHERE facility_id IS NOT NULL;


-- ----------------------------------------------------------------------------
-- 2. Task Type Definitions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_type_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    code TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    description_ar TEXT,
    description_en TEXT,
    category TEXT NOT NULL CHECK (category IN (
        'DISPATCH', 'DELIVERY', 'HUB', 'COD_PAYMENT',
        'RETURN', 'CUSTOMER_SERVICE', 'COMPLIANCE', 'OTHER'
    )),
    default_priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (default_priority IN (
        'LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL'
    )),
    default_sla_minutes INTEGER NOT NULL DEFAULT 120 CHECK (default_sla_minutes > 0),
    allowed_roles public.user_role[] DEFAULT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_task_type_code UNIQUE (tenant_id, code),
    CONSTRAINT uq_task_type_composite UNIQUE (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_task_types_tenant_active
    ON public.task_type_definitions (tenant_id, is_active);


-- ============================================================================
-- SECTION 2: OPERATIONAL EXCEPTIONS & TASKS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3. Operational Exceptions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.operational_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    exception_type_code TEXT NOT NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN (
        'SHIPMENT', 'SHIPMENT_LEG', 'MANIFEST', 'PAYMENT_RECORD',
        'DRIVER_CASH', 'SETTLEMENT', 'FACILITY', 'DRIVER',
        'MERCHANT_BRANCH', 'GENERAL'
    )),
    entity_id UUID NOT NULL,

    shipment_id UUID,
    leg_id UUID,
    manifest_id UUID,
    merchant_id UUID,
    driver_id UUID,
    facility_id UUID,
    merchant_branch_id UUID,

    severity TEXT NOT NULL DEFAULT 'NORMAL' CHECK (severity IN (
        'LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL'
    )),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN (
        'ACTIVE', 'RESOLVED', 'SUPPRESSED'
    )),

    first_detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    occurrence_count INTEGER NOT NULL DEFAULT 1 CHECK (occurrence_count >= 1),

    source_type TEXT NOT NULL DEFAULT 'SYSTEM_DETECTOR' CHECK (source_type IN (
        'SYSTEM_DETECTOR', 'CANONICAL_EVENT', 'MANUAL_USER'
    )),
    source_event_id UUID,
    source_rule_code TEXT,

    resolution_code TEXT,
    resolution_notes TEXT,
    resolution_mode TEXT CHECK (resolution_mode IN ('MANUAL_VERIFIED', 'SUPPRESSED') OR resolution_mode IS NULL),
    resolved_by_user_id UUID,
    resolved_at TIMESTAMPTZ,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_exceptions_shipment FOREIGN KEY (shipment_id, tenant_id)
        REFERENCES public.shipments(id, tenant_id) ON DELETE RESTRICT,
    CONSTRAINT fk_exceptions_leg FOREIGN KEY (leg_id, shipment_id, tenant_id)
        REFERENCES public.shipment_legs(id, shipment_id, tenant_id) ON DELETE RESTRICT,
    CONSTRAINT fk_exceptions_manifest FOREIGN KEY (manifest_id, tenant_id)
        REFERENCES public.operational_manifests(id, tenant_id) ON DELETE RESTRICT,
    CONSTRAINT fk_exceptions_facility FOREIGN KEY (facility_id, tenant_id)
        REFERENCES public.operational_facilities(id, tenant_id) ON DELETE RESTRICT,
    CONSTRAINT fk_exceptions_branch FOREIGN KEY (merchant_branch_id, tenant_id)
        REFERENCES public.merchant_branches(id, tenant_id) ON DELETE RESTRICT,
    CONSTRAINT fk_exceptions_driver FOREIGN KEY (driver_id, tenant_id)
        REFERENCES public.users(id, tenant_id) ON DELETE RESTRICT,
    CONSTRAINT fk_exceptions_merchant FOREIGN KEY (merchant_id, tenant_id)
        REFERENCES public.users(id, tenant_id) ON DELETE RESTRICT,
    CONSTRAINT fk_exceptions_resolver FOREIGN KEY (resolved_by_user_id, tenant_id)
        REFERENCES public.users(id, tenant_id) ON DELETE RESTRICT,
    CONSTRAINT uq_operational_exceptions_composite UNIQUE (id, tenant_id)
);

-- Active exception deduplication index: exactly one active cycle per target condition
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_operational_exception
    ON public.operational_exceptions (tenant_id, exception_type_code, entity_type, entity_id)
    WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_operational_exceptions_tenant_status
    ON public.operational_exceptions (tenant_id, status, severity, last_detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_operational_exceptions_shipment
    ON public.operational_exceptions (tenant_id, shipment_id) WHERE shipment_id IS NOT NULL;


-- ----------------------------------------------------------------------------
-- 4. Operational Tasks
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.operational_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,

    task_type_id UUID NOT NULL,
    task_type_code TEXT NOT NULL,

    title TEXT NOT NULL,
    description TEXT,

    priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN (
        'LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL'
    )),
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN (
        'OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'BLOCKED', 'RESOLVED', 'CLOSED', 'CANCELLED'
    )),

    linked_exception_id UUID,

    entity_type TEXT NOT NULL CHECK (entity_type IN (
        'SHIPMENT', 'SHIPMENT_LEG', 'MANIFEST', 'PAYMENT_RECORD',
        'DRIVER_CASH', 'SETTLEMENT', 'FACILITY', 'DRIVER',
        'MERCHANT_BRANCH', 'GENERAL'
    )),
    entity_id UUID NOT NULL,

    shipment_id UUID,
    leg_id UUID,
    manifest_id UUID,
    merchant_id UUID,
    driver_id UUID,
    facility_id UUID,
    merchant_branch_id UUID,

    assigned_queue_id UUID,
    assigned_user_id UUID,

    created_by_type TEXT NOT NULL DEFAULT 'SYSTEM' CHECK (created_by_type IN (
        'SYSTEM', 'USER', 'AUTOMATION'
    )),
    created_by_user_id UUID,
    source_event_id UUID,

    due_at TIMESTAMPTZ,
    sla_minutes_snapshot INTEGER,
    sla_source_snapshot TEXT,

    escalation_level INTEGER NOT NULL DEFAULT 0 CHECK (escalation_level >= 0),

    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    acknowledged_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    blocked_at TIMESTAMPTZ,
    blocked_reason TEXT,
    resolved_at TIMESTAMPTZ,
    resolution_code TEXT,
    resolution_notes TEXT,
    resolved_by_user_id UUID,
    closed_at TIMESTAMPTZ,
    closed_by_user_id UUID,
    cancelled_at TIMESTAMPTZ,
    cancelled_by_user_id UUID,
    cancellation_reason TEXT,

    reopen_count INTEGER NOT NULL DEFAULT 0 CHECK (reopen_count >= 0),
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    idempotency_key TEXT,

    allowed_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_tasks_type FOREIGN KEY (task_type_id, tenant_id)
        REFERENCES public.task_type_definitions(id, tenant_id) ON DELETE RESTRICT,
    CONSTRAINT fk_tasks_queue FOREIGN KEY (assigned_queue_id, tenant_id)
        REFERENCES public.task_queue_definitions(id, tenant_id) ON DELETE RESTRICT,
    CONSTRAINT fk_tasks_exception FOREIGN KEY (linked_exception_id, tenant_id)
        REFERENCES public.operational_exceptions(id, tenant_id) ON DELETE RESTRICT,
    CONSTRAINT fk_tasks_shipment FOREIGN KEY (shipment_id, tenant_id)
        REFERENCES public.shipments(id, tenant_id) ON DELETE RESTRICT,
    CONSTRAINT fk_tasks_leg FOREIGN KEY (leg_id, shipment_id, tenant_id)
        REFERENCES public.shipment_legs(id, shipment_id, tenant_id) ON DELETE RESTRICT,
    CONSTRAINT fk_tasks_manifest FOREIGN KEY (manifest_id, tenant_id)
        REFERENCES public.operational_manifests(id, tenant_id) ON DELETE RESTRICT,
    CONSTRAINT fk_tasks_facility FOREIGN KEY (facility_id, tenant_id)
        REFERENCES public.operational_facilities(id, tenant_id) ON DELETE RESTRICT,
    CONSTRAINT fk_tasks_branch FOREIGN KEY (merchant_branch_id, tenant_id)
        REFERENCES public.merchant_branches(id, tenant_id) ON DELETE RESTRICT,
    CONSTRAINT fk_tasks_driver FOREIGN KEY (driver_id, tenant_id)
        REFERENCES public.users(id, tenant_id) ON DELETE RESTRICT,
    CONSTRAINT fk_tasks_merchant FOREIGN KEY (merchant_id, tenant_id)
        REFERENCES public.users(id, tenant_id) ON DELETE RESTRICT,
    CONSTRAINT fk_tasks_assigned_user FOREIGN KEY (assigned_user_id, tenant_id)
        REFERENCES public.users(id, tenant_id) ON DELETE RESTRICT,
    CONSTRAINT fk_tasks_creator FOREIGN KEY (created_by_user_id, tenant_id)
        REFERENCES public.users(id, tenant_id) ON DELETE RESTRICT,
    CONSTRAINT fk_tasks_resolver FOREIGN KEY (resolved_by_user_id, tenant_id)
        REFERENCES public.users(id, tenant_id) ON DELETE RESTRICT,

    CONSTRAINT uq_tasks_tenant_idempotency UNIQUE (tenant_id, idempotency_key),
    CONSTRAINT uq_operational_tasks_composite UNIQUE (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_operational_tasks_tenant_status
    ON public.operational_tasks (tenant_id, status, priority, due_at);
CREATE INDEX IF NOT EXISTS idx_operational_tasks_assigned_user
    ON public.operational_tasks (tenant_id, assigned_user_id, status);
CREATE INDEX IF NOT EXISTS idx_operational_tasks_queue
    ON public.operational_tasks (tenant_id, assigned_queue_id, status);
CREATE INDEX IF NOT EXISTS idx_operational_tasks_shipment
    ON public.operational_tasks (tenant_id, shipment_id) WHERE shipment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_operational_tasks_linked_exception
    ON public.operational_tasks (tenant_id, linked_exception_id) WHERE linked_exception_id IS NOT NULL;


-- ----------------------------------------------------------------------------
-- 5. Operational Task Events (Append-Only Lifecycle History)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.operational_task_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    task_id UUID NOT NULL,
    actor_user_id UUID NOT NULL,
    actor_role public.user_role NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'CREATED', 'ASSIGNED', 'CLAIMED', 'REASSIGNED', 'UNASSIGNED',
        'ACKNOWLEDGED', 'STARTED', 'BLOCKED', 'UNBLOCKED',
        'PRIORITY_CHANGED', 'DUE_DATE_CHANGED', 'ESCALATED',
        'RESOLVED', 'REOPENED', 'CLOSED', 'CANCELLED', 'COMMENT_ADDED'
    )),
    old_status TEXT,
    new_status TEXT,
    old_assigned_user_id UUID,
    new_assigned_user_id UUID,
    old_assigned_queue_id UUID,
    new_assigned_queue_id UUID,
    old_priority TEXT,
    new_priority TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    idempotency_key TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_task_events_task FOREIGN KEY (task_id, tenant_id)
        REFERENCES public.operational_tasks(id, tenant_id) ON DELETE RESTRICT,
    CONSTRAINT fk_task_events_actor FOREIGN KEY (actor_user_id, tenant_id)
        REFERENCES public.users(id, tenant_id) ON DELETE RESTRICT,
    CONSTRAINT uq_task_events_tenant_idempotency UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_task_events_task_occurred
    ON public.operational_task_events (tenant_id, task_id, occurred_at DESC);


-- ----------------------------------------------------------------------------
-- 6. Operational Task Comments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.operational_task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    task_id UUID NOT NULL,
    author_user_id UUID NOT NULL,
    comment_text TEXT NOT NULL CHECK (trim(comment_text) <> ''),
    visibility TEXT NOT NULL DEFAULT 'INTERNAL' CHECK (visibility IN (
        'INTERNAL', 'MERCHANT_VISIBLE', 'DRIVER_VISIBLE'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_task_comments_task FOREIGN KEY (task_id, tenant_id)
        REFERENCES public.operational_tasks(id, tenant_id) ON DELETE RESTRICT,
    CONSTRAINT fk_task_comments_author FOREIGN KEY (author_user_id, tenant_id)
        REFERENCES public.users(id, tenant_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task
    ON public.operational_task_comments (tenant_id, task_id, created_at ASC);

-- Enforce strict append-only immutability for task events
CREATE OR REPLACE FUNCTION public.fn_prevent_operational_task_events_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'OPERATIONAL_TASK_EVENTS_ARE_APPEND_ONLY' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_mutation_task_events ON public.operational_task_events;
CREATE TRIGGER trg_prevent_mutation_task_events
    BEFORE UPDATE OR DELETE ON public.operational_task_events
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_prevent_operational_task_events_mutation();

-- Enforce strict append-only immutability for task comments
CREATE OR REPLACE FUNCTION public.fn_prevent_operational_task_comments_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'OPERATIONAL_TASK_COMMENTS_ARE_APPEND_ONLY' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_mutation_task_comments ON public.operational_task_comments;
CREATE TRIGGER trg_prevent_mutation_task_comments
    BEFORE UPDATE OR DELETE ON public.operational_task_comments
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_prevent_operational_task_comments_mutation();


-- ============================================================================
-- SECTION 3: RLS HARDENING (FAIL-CLOSED)
-- ============================================================================

ALTER TABLE public.task_queue_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_type_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_task_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_task_comments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.task_queue_definitions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.task_type_definitions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.operational_exceptions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.operational_tasks FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.operational_task_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.operational_task_comments FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.task_queue_definitions TO service_role;
GRANT ALL ON TABLE public.task_type_definitions TO service_role;
GRANT ALL ON TABLE public.operational_exceptions TO service_role;
GRANT ALL ON TABLE public.operational_tasks TO service_role;
GRANT ALL ON TABLE public.operational_task_events TO service_role;
GRANT ALL ON TABLE public.operational_task_comments TO service_role;


-- ============================================================================
-- SECTION 4: TRANSACTIONAL MUTATION RPCS (SECURITY DEFINER)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- RPC 1: execute_create_operational_task
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.execute_create_operational_task(
    p_tenant_id UUID,
    p_actor_user_id UUID,
    p_task_type_code TEXT,
    p_title TEXT,
    p_entity_type TEXT,
    p_entity_id UUID,
    p_description TEXT DEFAULT NULL,
    p_priority TEXT DEFAULT NULL,
    p_assigned_queue_id UUID DEFAULT NULL,
    p_assigned_user_id UUID DEFAULT NULL,
    p_shipment_id UUID DEFAULT NULL,
    p_leg_id UUID DEFAULT NULL,
    p_manifest_id UUID DEFAULT NULL,
    p_merchant_id UUID DEFAULT NULL,
    p_driver_id UUID DEFAULT NULL,
    p_facility_id UUID DEFAULT NULL,
    p_merchant_branch_id UUID DEFAULT NULL,
    p_linked_exception_id UUID DEFAULT NULL,
    p_source_event_id UUID DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL,
    p_allowed_actions JSONB DEFAULT '[]'::jsonb,
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
    v_task_type RECORD;
    v_queue RECORD;
    v_assigned_user RECORD;
    v_effective_priority TEXT;
    v_due_at TIMESTAMPTZ;
    v_existing_task RECORD;
    v_task_id UUID;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_event_id UUID;
BEGIN
    -- 1. Validate Tenant
    SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'TENANT_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    IF v_tenant.is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'TENANT_SUSPENDED' USING ERRCODE = '42501';
    END IF;

    -- 2. Validate Actor
    SELECT * INTO v_actor FROM public.users WHERE id = p_actor_user_id AND tenant_id = p_tenant_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ACTOR_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    IF v_actor.is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'ACTOR_INACTIVE' USING ERRCODE = '42501';
    END IF;

    -- 3. Idempotency Check
    IF p_idempotency_key IS NOT NULL THEN
        SELECT * INTO v_existing_task
        FROM public.operational_tasks
        WHERE tenant_id = p_tenant_id AND idempotency_key = p_idempotency_key;

        IF FOUND THEN
            -- Check material context
            IF v_existing_task.task_type_code = p_task_type_code
               AND v_existing_task.entity_type = p_entity_type
               AND v_existing_task.entity_id = p_entity_id THEN
                RETURN jsonb_build_object(
                    'success', true,
                    'replayed', true,
                    'task_id', v_existing_task.id,
                    'status', v_existing_task.status,
                    'due_at', v_existing_task.due_at,
                    'version', v_existing_task.version
                );
            ELSE
                RAISE EXCEPTION 'IDEMPOTENCY_REPLAY_MISMATCH' USING ERRCODE = '23505';
            END IF;
        END IF;
    END IF;

    -- 4. Validate Task Type
    SELECT * INTO v_task_type
    FROM public.task_type_definitions
    WHERE tenant_id = p_tenant_id AND code = p_task_type_code;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'TASK_TYPE_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    IF v_task_type.is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'TASK_TYPE_INACTIVE' USING ERRCODE = '42501';
    END IF;

    -- 5. Validate Queue (if specified)
    IF p_assigned_queue_id IS NOT NULL THEN
        SELECT * INTO v_queue
        FROM public.task_queue_definitions
        WHERE id = p_assigned_queue_id AND tenant_id = p_tenant_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'TASK_QUEUE_NOT_FOUND' USING ERRCODE = 'P0002';
        END IF;
        IF v_queue.is_active IS NOT TRUE THEN
            RAISE EXCEPTION 'TASK_QUEUE_INACTIVE' USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 6. Validate Assigned User (if specified)
    IF p_assigned_user_id IS NOT NULL THEN
        SELECT * INTO v_assigned_user
        FROM public.users
        WHERE id = p_assigned_user_id AND tenant_id = p_tenant_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'ASSIGNED_USER_NOT_FOUND' USING ERRCODE = 'P0002';
        END IF;
        IF v_assigned_user.is_active IS NOT TRUE THEN
            RAISE EXCEPTION 'ASSIGNED_USER_INACTIVE' USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 7. Validate Priority & Snapshot SLA
    v_effective_priority := COALESCE(p_priority, v_task_type.default_priority);
    IF v_effective_priority NOT IN ('LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL') THEN
        RAISE EXCEPTION 'INVALID_PRIORITY' USING ERRCODE = '22023';
    END IF;

    -- SLA Snapshot calculation (calendar elapsed minutes)
    v_due_at := v_now + (v_task_type.default_sla_minutes * INTERVAL '1 minute');

    -- 8. Verify leg belongs to shipment if both are supplied
    IF p_shipment_id IS NOT NULL AND p_leg_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.shipment_legs
            WHERE id = p_leg_id AND shipment_id = p_shipment_id AND tenant_id = p_tenant_id
        ) THEN
            RAISE EXCEPTION 'SHIPMENT_LEG_MISMATCH' USING ERRCODE = '23503';
        END IF;
    END IF;

    -- 9. Insert Task
    v_task_id := gen_random_uuid();
    INSERT INTO public.operational_tasks (
        id, tenant_id, task_type_id, task_type_code, title, description,
        priority, status, linked_exception_id, entity_type, entity_id,
        shipment_id, leg_id, manifest_id, merchant_id, driver_id, facility_id, merchant_branch_id,
        assigned_queue_id, assigned_user_id, created_by_type, created_by_user_id, source_event_id,
        due_at, sla_minutes_snapshot, sla_source_snapshot, escalation_level,
        opened_at, version, idempotency_key, allowed_actions, metadata, created_at, updated_at
    ) VALUES (
        v_task_id, p_tenant_id, v_task_type.id, v_task_type.code, p_title, p_description,
        v_effective_priority, 'OPEN', p_linked_exception_id, p_entity_type, p_entity_id,
        p_shipment_id, p_leg_id, p_manifest_id, p_merchant_id, p_driver_id, p_facility_id, p_merchant_branch_id,
        p_assigned_queue_id, p_assigned_user_id, 'USER', p_actor_user_id, p_source_event_id,
        v_due_at, v_task_type.default_sla_minutes, 'TASK_TYPE_DEFAULT', 0,
        v_now, 1, p_idempotency_key, p_allowed_actions, p_metadata, v_now, v_now
    );

    -- 10. Append Lifecycle Event
    v_event_id := gen_random_uuid();
    INSERT INTO public.operational_task_events (
        id, tenant_id, task_id, actor_user_id, actor_role, event_type,
        old_status, new_status, old_assigned_user_id, new_assigned_user_id,
        old_assigned_queue_id, new_assigned_queue_id, old_priority, new_priority,
        payload, idempotency_key, occurred_at, created_at
    ) VALUES (
        v_event_id, p_tenant_id, v_task_id, p_actor_user_id, v_actor.role, 'CREATED',
        NULL, 'OPEN', NULL, p_assigned_user_id,
        NULL, p_assigned_queue_id, NULL, v_effective_priority,
        jsonb_build_object('title', p_title, 'entity_type', p_entity_type, 'entity_id', p_entity_id),
        p_idempotency_key, v_now, v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'task_id', v_task_id,
        'status', 'OPEN',
        'priority', v_effective_priority,
        'due_at', v_due_at,
        'version', 1
    );
END;
$$;


-- ----------------------------------------------------------------------------
-- RPC 2: execute_claim_operational_task
-- ----------------------------------------------------------------------------
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

    -- 5. Claimability Guards
    IF v_task.status NOT IN ('OPEN', 'ACKNOWLEDGED') THEN
        RAISE EXCEPTION 'TASK_NOT_CLAIMABLE' USING ERRCODE = '22023';
    END IF;

    IF v_task.assigned_user_id IS NOT NULL AND v_task.assigned_user_id <> p_actor_user_id THEN
        RAISE EXCEPTION 'TASK_ALREADY_CLAIMED' USING ERRCODE = '23505';
    END IF;

    -- 6. Execute Claim
    UPDATE public.operational_tasks
    SET assigned_user_id = p_actor_user_id,
        status = 'IN_PROGRESS',
        started_at = COALESCE(started_at, v_now),
        version = version + 1,
        updated_at = v_now
    WHERE id = p_task_id AND tenant_id = p_tenant_id;

    -- 7. Append Event
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


-- ----------------------------------------------------------------------------
-- RPC 3: execute_assign_operational_task
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.execute_assign_operational_task(
    p_tenant_id UUID,
    p_actor_user_id UUID,
    p_task_id UUID,
    p_target_user_id UUID DEFAULT NULL,
    p_target_queue_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
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
    v_target_user RECORD;
    v_target_queue RECORD;
    v_event_type TEXT;
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
        RAISE EXCEPTION 'INSUFFICIENT_PRIVILEGES_TO_ASSIGN' USING ERRCODE = '42501';
    END IF;

    -- 2. Lock Task Row FOR UPDATE
    SELECT * INTO v_task
    FROM public.operational_tasks
    WHERE id = p_task_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'TASK_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF v_task.status IN ('CLOSED', 'CANCELLED') THEN
        RAISE EXCEPTION 'CANNOT_ASSIGN_TERMINAL_TASK' USING ERRCODE = '22023';
    END IF;

    -- Stale Write Check
    IF p_expected_version IS NOT NULL AND v_task.version <> p_expected_version THEN
        RAISE EXCEPTION 'STALE_TASK_VERSION' USING ERRCODE = '40001';
    END IF;

    -- 3. Validate Target User (if provided)
    IF p_target_user_id IS NOT NULL THEN
        SELECT * INTO v_target_user
        FROM public.users
        WHERE id = p_target_user_id AND tenant_id = p_tenant_id;
        IF NOT FOUND OR v_target_user.is_active IS NOT TRUE THEN
            RAISE EXCEPTION 'TARGET_USER_INVALID' USING ERRCODE = 'P0002';
        END IF;
    END IF;

    -- 4. Validate Target Queue (if provided)
    IF p_target_queue_id IS NOT NULL THEN
        SELECT * INTO v_target_queue
        FROM public.task_queue_definitions
        WHERE id = p_target_queue_id AND tenant_id = p_tenant_id;
        IF NOT FOUND OR v_target_queue.is_active IS NOT TRUE THEN
            RAISE EXCEPTION 'TARGET_QUEUE_INVALID' USING ERRCODE = 'P0002';
        END IF;
    END IF;

    -- Determine event type
    IF p_target_user_id IS NULL AND v_task.assigned_user_id IS NOT NULL THEN
        v_event_type := 'UNASSIGNED';
    ELSIF v_task.assigned_user_id IS NOT NULL AND p_target_user_id <> v_task.assigned_user_id THEN
        v_event_type := 'REASSIGNED';
    ELSE
        v_event_type := 'ASSIGNED';
    END IF;

    -- Update Task
    UPDATE public.operational_tasks
    SET assigned_user_id = p_target_user_id,
        assigned_queue_id = COALESCE(p_target_queue_id, assigned_queue_id),
        version = version + 1,
        updated_at = v_now
    WHERE id = p_task_id AND tenant_id = p_tenant_id;

    -- Append Event
    v_event_id := gen_random_uuid();
    INSERT INTO public.operational_task_events (
        id, tenant_id, task_id, actor_user_id, actor_role, event_type,
        old_assigned_user_id, new_assigned_user_id, old_assigned_queue_id, new_assigned_queue_id,
        payload, idempotency_key, occurred_at, created_at
    ) VALUES (
        v_event_id, p_tenant_id, p_task_id, p_actor_user_id, v_actor.role, v_event_type,
        v_task.assigned_user_id, p_target_user_id, v_task.assigned_queue_id, COALESCE(p_target_queue_id, v_task.assigned_queue_id),
        jsonb_build_object('notes', p_notes), p_idempotency_key, v_now, v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'task_id', p_task_id,
        'assigned_user_id', p_target_user_id,
        'assigned_queue_id', COALESCE(p_target_queue_id, v_task.assigned_queue_id),
        'version', v_task.version + 1
    );
END;
$$;


-- ----------------------------------------------------------------------------
-- RPC 4: execute_update_operational_task_state
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.execute_update_operational_task_state(
    p_tenant_id UUID,
    p_actor_user_id UUID,
    p_task_id UUID,
    p_target_status TEXT,
    p_reason TEXT DEFAULT NULL,
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
    v_event_type TEXT;
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

    -- Lock Task
    SELECT * INTO v_task
    FROM public.operational_tasks
    WHERE id = p_task_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'TASK_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF p_expected_version IS NOT NULL AND v_task.version <> p_expected_version THEN
        RAISE EXCEPTION 'STALE_TASK_VERSION' USING ERRCODE = '40001';
    END IF;

    -- Valid status transitions
    IF p_target_status = 'ACKNOWLEDGED' THEN
        IF v_task.status <> 'OPEN' THEN
            RAISE EXCEPTION 'INVALID_TASK_TRANSITION' USING ERRCODE = '22023';
        END IF;
        v_event_type := 'ACKNOWLEDGED';
    ELSIF p_target_status = 'IN_PROGRESS' THEN
        IF v_task.status NOT IN ('OPEN', 'ACKNOWLEDGED', 'BLOCKED') THEN
            RAISE EXCEPTION 'INVALID_TASK_TRANSITION' USING ERRCODE = '22023';
        END IF;
        v_event_type := CASE WHEN v_task.status = 'BLOCKED' THEN 'UNBLOCKED' ELSE 'STARTED' END;
    ELSIF p_target_status = 'BLOCKED' THEN
        IF v_task.status NOT IN ('ACKNOWLEDGED', 'IN_PROGRESS') THEN
            RAISE EXCEPTION 'INVALID_TASK_TRANSITION' USING ERRCODE = '22023';
        END IF;
        IF p_reason IS NULL OR trim(p_reason) = '' THEN
            RAISE EXCEPTION 'BLOCKED_REASON_REQUIRED' USING ERRCODE = '22023';
        END IF;
        v_event_type := 'BLOCKED';
    ELSIF p_target_status = 'CLOSED' THEN
        IF v_task.status <> 'RESOLVED' THEN
            RAISE EXCEPTION 'CANNOT_CLOSE_UNRESOLVED_TASK' USING ERRCODE = '22023';
        END IF;
        v_event_type := 'CLOSED';
    ELSIF p_target_status = 'CANCELLED' THEN
        IF v_task.status IN ('RESOLVED', 'CLOSED', 'CANCELLED') THEN
            RAISE EXCEPTION 'CANNOT_CANCEL_COMPLETED_TASK' USING ERRCODE = '22023';
        END IF;
        IF p_reason IS NULL OR trim(p_reason) = '' THEN
            RAISE EXCEPTION 'CANCELLATION_REASON_REQUIRED' USING ERRCODE = '22023';
        END IF;
        v_event_type := 'CANCELLED';
    ELSE
        RAISE EXCEPTION 'UNSUPPORTED_STATUS_UPDATE' USING ERRCODE = '22023';
    END IF;

    -- Perform State Update
    UPDATE public.operational_tasks
    SET status = p_target_status,
        acknowledged_at = CASE WHEN p_target_status = 'ACKNOWLEDGED' THEN v_now ELSE acknowledged_at END,
        started_at = CASE WHEN p_target_status = 'IN_PROGRESS' AND started_at IS NULL THEN v_now ELSE started_at END,
        blocked_at = CASE WHEN p_target_status = 'BLOCKED' THEN v_now ELSE (CASE WHEN p_target_status = 'IN_PROGRESS' THEN NULL ELSE blocked_at END) END,
        blocked_reason = CASE WHEN p_target_status = 'BLOCKED' THEN p_reason ELSE (CASE WHEN p_target_status = 'IN_PROGRESS' THEN NULL ELSE blocked_reason END) END,
        closed_at = CASE WHEN p_target_status = 'CLOSED' THEN v_now ELSE closed_at END,
        closed_by_user_id = CASE WHEN p_target_status = 'CLOSED' THEN p_actor_user_id ELSE closed_by_user_id END,
        cancelled_at = CASE WHEN p_target_status = 'CANCELLED' THEN v_now ELSE cancelled_at END,
        cancelled_by_user_id = CASE WHEN p_target_status = 'CANCELLED' THEN p_actor_user_id ELSE cancelled_by_user_id END,
        cancellation_reason = CASE WHEN p_target_status = 'CANCELLED' THEN p_reason ELSE cancellation_reason END,
        version = version + 1,
        updated_at = v_now
    WHERE id = p_task_id AND tenant_id = p_tenant_id;

    -- Event
    v_event_id := gen_random_uuid();
    INSERT INTO public.operational_task_events (
        id, tenant_id, task_id, actor_user_id, actor_role, event_type,
        old_status, new_status, payload, idempotency_key, occurred_at, created_at
    ) VALUES (
        v_event_id, p_tenant_id, p_task_id, p_actor_user_id, v_actor.role, v_event_type,
        v_task.status, p_target_status, jsonb_build_object('reason', p_reason), p_idempotency_key, v_now, v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'task_id', p_task_id,
        'old_status', v_task.status,
        'status', p_target_status,
        'version', v_task.version + 1
    );
END;
$$;


-- ----------------------------------------------------------------------------
-- RPC 5: execute_resolve_operational_task
-- Note: Resolves TASK ONLY. Does NOT auto-resolve linked exception.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.execute_resolve_operational_task(
    p_tenant_id UUID,
    p_actor_user_id UUID,
    p_task_id UUID,
    p_resolution_code TEXT,
    p_resolution_notes TEXT,
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
    SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
    IF NOT FOUND OR v_tenant.is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'TENANT_NOT_AUTHORIZED' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_actor FROM public.users WHERE id = p_actor_user_id AND tenant_id = p_tenant_id;
    IF NOT FOUND OR v_actor.is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'ACTOR_NOT_AUTHORIZED' USING ERRCODE = '42501';
    END IF;

    -- Lock Task
    SELECT * INTO v_task
    FROM public.operational_tasks
    WHERE id = p_task_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'TASK_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF p_expected_version IS NOT NULL AND v_task.version <> p_expected_version THEN
        RAISE EXCEPTION 'STALE_TASK_VERSION' USING ERRCODE = '40001';
    END IF;

    IF v_task.status NOT IN ('IN_PROGRESS', 'BLOCKED') THEN
        RAISE EXCEPTION 'CANNOT_RESOLVE_TASK_IN_CURRENT_STATUS' USING ERRCODE = '22023';
    END IF;

    IF p_resolution_code IS NULL OR trim(p_resolution_code) = '' THEN
        RAISE EXCEPTION 'RESOLUTION_CODE_REQUIRED' USING ERRCODE = '22023';
    END IF;
    IF p_resolution_notes IS NULL OR trim(p_resolution_notes) = '' THEN
        RAISE EXCEPTION 'RESOLUTION_NOTES_REQUIRED' USING ERRCODE = '22023';
    END IF;

    -- Update Task to RESOLVED
    UPDATE public.operational_tasks
    SET status = 'RESOLVED',
        resolved_at = v_now,
        resolved_by_user_id = p_actor_user_id,
        resolution_code = p_resolution_code,
        resolution_notes = p_resolution_notes,
        version = version + 1,
        updated_at = v_now
    WHERE id = p_task_id AND tenant_id = p_tenant_id;

    -- Append RESOLVED Event
    v_event_id := gen_random_uuid();
    INSERT INTO public.operational_task_events (
        id, tenant_id, task_id, actor_user_id, actor_role, event_type,
        old_status, new_status, payload, idempotency_key, occurred_at, created_at
    ) VALUES (
        v_event_id, p_tenant_id, p_task_id, p_actor_user_id, v_actor.role, 'RESOLVED',
        v_task.status, 'RESOLVED',
        jsonb_build_object('resolution_code', p_resolution_code, 'resolution_notes', p_resolution_notes),
        p_idempotency_key, v_now, v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'task_id', p_task_id,
        'status', 'RESOLVED',
        'resolved_at', v_now,
        'linked_exception_id', v_task.linked_exception_id,
        'exception_remains_active', (v_task.linked_exception_id IS NOT NULL),
        'version', v_task.version + 1
    );
END;
$$;


-- ----------------------------------------------------------------------------
-- RPC 6: execute_reopen_operational_task
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.execute_reopen_operational_task(
    p_tenant_id UUID,
    p_actor_user_id UUID,
    p_task_id UUID,
    p_reopen_reason TEXT,
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
    SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
    IF NOT FOUND OR v_tenant.is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'TENANT_NOT_AUTHORIZED' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_actor FROM public.users WHERE id = p_actor_user_id AND tenant_id = p_tenant_id;
    IF NOT FOUND OR v_actor.is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'ACTOR_NOT_AUTHORIZED' USING ERRCODE = '42501';
    END IF;

    -- Only supervisors / dispatchers / admins can reopen
    IF v_actor.role NOT IN ('SUPER_ADMIN', 'ADMIN', 'DISPATCHER', 'OPERATOR') THEN
        RAISE EXCEPTION 'INSUFFICIENT_PRIVILEGES_TO_REOPEN' USING ERRCODE = '42501';
    END IF;

    -- Lock Task
    SELECT * INTO v_task
    FROM public.operational_tasks
    WHERE id = p_task_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'TASK_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF p_expected_version IS NOT NULL AND v_task.version <> p_expected_version THEN
        RAISE EXCEPTION 'STALE_TASK_VERSION' USING ERRCODE = '40001';
    END IF;

    IF v_task.status <> 'RESOLVED' THEN
        RAISE EXCEPTION 'ONLY_RESOLVED_TASKS_CAN_BE_REOPENED' USING ERRCODE = '22023';
    END IF;

    IF p_reopen_reason IS NULL OR trim(p_reopen_reason) = '' THEN
        RAISE EXCEPTION 'REOPEN_REASON_REQUIRED' USING ERRCODE = '22023';
    END IF;

    UPDATE public.operational_tasks
    SET status = 'IN_PROGRESS',
        reopen_count = reopen_count + 1,
        resolved_at = NULL,
        resolution_code = NULL,
        resolution_notes = NULL,
        resolved_by_user_id = NULL,
        version = version + 1,
        updated_at = v_now
    WHERE id = p_task_id AND tenant_id = p_tenant_id;

    v_event_id := gen_random_uuid();
    INSERT INTO public.operational_task_events (
        id, tenant_id, task_id, actor_user_id, actor_role, event_type,
        old_status, new_status, payload, idempotency_key, occurred_at, created_at
    ) VALUES (
        v_event_id, p_tenant_id, p_task_id, p_actor_user_id, v_actor.role, 'REOPENED',
        'RESOLVED', 'IN_PROGRESS',
        jsonb_build_object('reopen_reason', p_reopen_reason, 'reopen_count', v_task.reopen_count + 1),
        p_idempotency_key, v_now, v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'task_id', p_task_id,
        'status', 'IN_PROGRESS',
        'reopen_count', v_task.reopen_count + 1,
        'version', v_task.version + 1
    );
END;
$$;


-- ----------------------------------------------------------------------------
-- RPC 7: execute_record_operational_exception
-- Note: Deduplicates active exception cycle. Does NOT spawn duplicate tasks.
-- ----------------------------------------------------------------------------
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


-- ----------------------------------------------------------------------------
-- RPC 8: execute_resolve_operational_exception
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.execute_resolve_operational_exception(
    p_tenant_id UUID,
    p_actor_user_id UUID,
    p_exception_id UUID,
    p_resolution_code TEXT,
    p_resolution_notes TEXT,
    p_resolution_mode TEXT DEFAULT 'MANUAL_VERIFIED'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tenant RECORD;
    v_actor RECORD;
    v_exception RECORD;
    v_target_status TEXT;
    v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
    SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
    IF NOT FOUND OR v_tenant.is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'TENANT_NOT_AUTHORIZED' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_actor FROM public.users WHERE id = p_actor_user_id AND tenant_id = p_tenant_id;
    IF NOT FOUND OR v_actor.is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'ACTOR_NOT_AUTHORIZED' USING ERRCODE = '42501';
    END IF;

    IF v_actor.role NOT IN ('SUPER_ADMIN', 'ADMIN', 'DISPATCHER', 'OPERATOR') THEN
        RAISE EXCEPTION 'INSUFFICIENT_PRIVILEGES_TO_RESOLVE_EXCEPTION' USING ERRCODE = '42501';
    END IF;

    -- Lock Exception Row FOR UPDATE
    SELECT * INTO v_exception
    FROM public.operational_exceptions
    WHERE id = p_exception_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'EXCEPTION_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF v_exception.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'EXCEPTION_NOT_ACTIVE' USING ERRCODE = '22023';
    END IF;

    IF p_resolution_code IS NULL OR trim(p_resolution_code) = '' THEN
        RAISE EXCEPTION 'RESOLUTION_CODE_REQUIRED' USING ERRCODE = '22023';
    END IF;

    IF p_resolution_notes IS NULL OR trim(p_resolution_notes) = '' THEN
        RAISE EXCEPTION 'RESOLUTION_NOTES_REQUIRED' USING ERRCODE = '22023';
    END IF;

    IF p_resolution_mode NOT IN ('MANUAL_VERIFIED', 'SUPPRESSED') THEN
        RAISE EXCEPTION 'INVALID_RESOLUTION_MODE' USING ERRCODE = '22023';
    END IF;

    v_target_status := CASE WHEN p_resolution_mode = 'SUPPRESSED' THEN 'SUPPRESSED' ELSE 'RESOLVED' END;

    UPDATE public.operational_exceptions
    SET status = v_target_status,
        resolution_code = p_resolution_code,
        resolution_notes = p_resolution_notes,
        resolution_mode = p_resolution_mode,
        resolved_by_user_id = p_actor_user_id,
        resolved_at = v_now,
        updated_at = v_now
    WHERE id = p_exception_id AND tenant_id = p_tenant_id;

    RETURN jsonb_build_object(
        'success', true,
        'exception_id', p_exception_id,
        'status', v_target_status,
        'resolution_mode', p_resolution_mode,
        'resolved_at', v_now
    );
END;
$$;


-- ============================================================================
-- SECTION 5: PRIVILEGE HARDENING FOR RPCS
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.execute_create_operational_task FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.execute_claim_operational_task FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.execute_assign_operational_task FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.execute_update_operational_task_state FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.execute_resolve_operational_task FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.execute_reopen_operational_task FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.execute_record_operational_exception FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.execute_resolve_operational_exception FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.execute_create_operational_task TO service_role;
GRANT EXECUTE ON FUNCTION public.execute_claim_operational_task TO service_role;
GRANT EXECUTE ON FUNCTION public.execute_assign_operational_task TO service_role;
GRANT EXECUTE ON FUNCTION public.execute_update_operational_task_state TO service_role;
GRANT EXECUTE ON FUNCTION public.execute_resolve_operational_task TO service_role;
GRANT EXECUTE ON FUNCTION public.execute_reopen_operational_task TO service_role;
GRANT EXECUTE ON FUNCTION public.execute_record_operational_exception TO service_role;
GRANT EXECUTE ON FUNCTION public.execute_resolve_operational_exception TO service_role;

COMMIT;

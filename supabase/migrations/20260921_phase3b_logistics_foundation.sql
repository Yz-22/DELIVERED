-- ============================================================================
-- DELIVERE — PHASE 3B FOUNDATION MIGRATION
-- File: supabase/migrations/20260921_phase3b_logistics_foundation.sql
-- Description: Physical logistics, multi-leg, custody, manifest & payment foundation.
-- Target Engine: PostgreSQL 15+ (Supabase)
-- Mode: Additive DDL. Zero legacy data mutation. Zero fake backfill.
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: ENUMS & DOMAIN TYPES
-- ============================================================================

-- Operational Facility Classification
DO $$ BEGIN
    CREATE TYPE public.facility_type AS ENUM (
        'HUB',
        'BRANCH',
        'SORTING_CENTER',
        'DEPOT',
        'WAREHOUSE',
        'RETURN_CENTER',
        'CROSS_DOCK'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Shipment Leg Operational Types
DO $$ BEGIN
    CREATE TYPE public.shipment_leg_type AS ENUM (
        'PICKUP',
        'TRANSFER',
        'LAST_MILE',
        'DIRECT',
        'RETURN'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Shipment Leg Lifecycle Status
DO $$ BEGIN
    CREATE TYPE public.shipment_leg_status AS ENUM (
        'PLANNED',
        'READY',
        'ASSIGNED',
        'ACCEPTED',
        'IN_TRANSIT',
        'COMPLETED',
        'FAILED',
        'CANCELLED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Leg Assignment Offer Status
DO $$ BEGIN
    CREATE TYPE public.leg_assignment_status AS ENUM (
        'OFFERED',
        'ACCEPTED',
        'REJECTED',
        'EXPIRED',
        'CANCELLED',
        'SUPERSEDED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Physical Custody Event Classification
DO $$ BEGIN
    CREATE TYPE public.custody_event_type AS ENUM (
        'HANDOFF',
        'INTAKE',
        'OUTBOUND',
        'TERMINAL_DELIVERY',
        'REVERSE_HANDOFF',
        'MANUAL_OVERRIDE'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Physical Custody Evidence Verification Method
DO $$ BEGIN
    CREATE TYPE public.custody_evidence_type AS ENUM (
        'BARCODE_SCAN',
        'OTP_CODE',
        'SIGNATURE',
        'PHOTO',
        'MANUAL_OVERRIDE'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Current Custody Entity Classification
DO $$ BEGIN
    CREATE TYPE public.custody_holder_type AS ENUM (
        'MERCHANT',
        'DRIVER',
        'FACILITY',
        'CUSTOMER'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Operational Transport Manifest Types
DO $$ BEGIN
    CREATE TYPE public.manifest_type AS ENUM (
        'PICKUP',
        'HUB_TRANSFER',
        'DRIVER_RUNSHEET',
        'RETURN'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Operational Transport Manifest Status
DO $$ BEGIN
    CREATE TYPE public.manifest_status AS ENUM (
        'DRAFT',
        'SEALED',
        'IN_TRANSIT',
        'RECEIVED',
        'RECONCILED',
        'CANCELLED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Customer Commercial Payment Method (Actual payment rail used by customer)
DO $$ BEGIN
    CREATE TYPE public.customer_payment_method AS ENUM (
        'CASH',
        'CLIQ',
        'PREPAID',
        'WALLET'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Customer Commercial Payment Status
DO $$ BEGIN
    CREATE TYPE public.payment_record_status AS ENUM (
        'REPORTED',
        'PENDING_VERIFICATION',
        'VERIFIED',
        'REJECTED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- COD Customer Collection Discrepancy Classification
DO $$ BEGIN
    CREATE TYPE public.payment_discrepancy_status AS ENUM (
        'EXACT',
        'SHORT',
        'OVER',
        'PARTIAL_APPROVED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Physical Cash Custody Remittance Status
DO $$ BEGIN
    CREATE TYPE public.cash_remittance_status AS ENUM (
        'HELD_BY_DRIVER',
        'REMITTED_TO_CASHIER',
        'RECONCILED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================================
-- SECTION 2: PHYSICAL LOGISTICS & CUSTODY TABLES
-- ============================================================================

-- Section 2 Pre-requisite: Ensure public.vouchers has a composite unique constraint (id, tenant_id)
-- This allows tenant-isolated composite foreign key references from logistics remittance tables.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_vouchers_composite'
    ) THEN
        ALTER TABLE public.vouchers
            ADD CONSTRAINT uq_vouchers_composite UNIQUE (id, tenant_id);
    END IF;
END $$;


-- ----------------------------------------------------------------------------
-- 1. Operational Facilities (Company Hubs, Terminals, Sorting Centers)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.operational_facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    code TEXT NOT NULL,
    facility_type public.facility_type NOT NULL DEFAULT 'BRANCH',
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    governorate TEXT NOT NULL DEFAULT 'عمان',
    city TEXT NOT NULL DEFAULT 'عمان',
    address TEXT,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Unique facility code per tenant
    CONSTRAINT uq_operational_facilities_tenant_code UNIQUE (tenant_id, code),

    -- Composite unique constraint to support composite Foreign Keys
    CONSTRAINT uq_operational_facilities_composite UNIQUE (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_operational_facilities_tenant 
    ON public.operational_facilities (tenant_id, is_active);


-- ----------------------------------------------------------------------------
-- 2. User Facility Access (Dispatcher, Sorter & Cashier Facility Assignments)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_facility_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    facility_id UUID NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    can_dispatch BOOLEAN NOT NULL DEFAULT true,
    can_receive BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Composite foreign keys ensuring strict tenant boundary isolation
    CONSTRAINT fk_user_facility_user_composite FOREIGN KEY (user_id, tenant_id)
        REFERENCES public.users(id, tenant_id) ON DELETE CASCADE,

    CONSTRAINT fk_user_facility_facility_composite FOREIGN KEY (facility_id, tenant_id)
        REFERENCES public.operational_facilities(id, tenant_id) ON DELETE CASCADE,

    CONSTRAINT uq_user_facility_access UNIQUE (user_id, facility_id)
);

CREATE INDEX IF NOT EXISTS idx_user_facility_access_lookup 
    ON public.user_facility_access (tenant_id, user_id, facility_id);


-- ----------------------------------------------------------------------------
-- 3. Shipment Legs (Authoritative Operational Transport Segments)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shipment_legs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    shipment_id UUID NOT NULL,
    sequence INTEGER NOT NULL CHECK (sequence >= 1),
    leg_type public.shipment_leg_type NOT NULL,
    status public.shipment_leg_status NOT NULL DEFAULT 'PLANNED',

    -- Typed Origin Endpoints (Declarative, exactly one endpoint non-null)
    origin_facility_id UUID,
    origin_merchant_branch_id UUID,
    origin_is_shipment_customer BOOLEAN NOT NULL DEFAULT false,

    -- Typed Destination Endpoints (Declarative, exactly one endpoint non-null)
    destination_facility_id UUID,
    destination_merchant_branch_id UUID,
    destination_is_shipment_customer BOOLEAN NOT NULL DEFAULT false,

    -- Driver Assignment & Financial Snapshot
    assigned_driver_id UUID,
    driver_earning_snapshot NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (driver_earning_snapshot >= 0),
    currency TEXT NOT NULL DEFAULT 'JOD',

    -- Self-referencing Continuation Leg link (Tenant-safe and Same-Shipment safe)
    continuation_of_leg_id UUID,

    -- Operational Timestamps
    assigned_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    failure_reason_code TEXT,
    failure_notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Composite FK to Shipments (Tenant isolated, RESTRICT delete of referenced shipment)
    CONSTRAINT fk_legs_shipment_composite FOREIGN KEY (shipment_id, tenant_id)
        REFERENCES public.shipments(id, tenant_id) ON DELETE RESTRICT,

    -- Composite FK to Assigned Driver User (Tenant isolated, RESTRICT delete)
    CONSTRAINT fk_legs_driver_composite FOREIGN KEY (assigned_driver_id, tenant_id)
        REFERENCES public.users(id, tenant_id) ON DELETE RESTRICT,

    -- Composite FKs to Origin Endpoints
    CONSTRAINT fk_legs_origin_fac_composite FOREIGN KEY (origin_facility_id, tenant_id)
        REFERENCES public.operational_facilities(id, tenant_id) ON DELETE RESTRICT,

    CONSTRAINT fk_legs_origin_branch_composite FOREIGN KEY (origin_merchant_branch_id, tenant_id)
        REFERENCES public.merchant_branches(id, tenant_id) ON DELETE RESTRICT,

    -- Composite FKs to Destination Endpoints
    CONSTRAINT fk_legs_dest_fac_composite FOREIGN KEY (destination_facility_id, tenant_id)
        REFERENCES public.operational_facilities(id, tenant_id) ON DELETE RESTRICT,

    CONSTRAINT fk_legs_dest_branch_composite FOREIGN KEY (destination_merchant_branch_id, tenant_id)
        REFERENCES public.merchant_branches(id, tenant_id) ON DELETE RESTRICT,

    -- Primary Composite Unique Constraints
    CONSTRAINT uq_shipment_legs_composite UNIQUE (id, tenant_id),
    CONSTRAINT uq_shipment_legs_shipment_composite UNIQUE (id, shipment_id, tenant_id),
    CONSTRAINT uq_shipment_leg_sequence UNIQUE (tenant_id, shipment_id, sequence),

    -- Self-referencing Composite Foreign Key ensuring Continuation Leg belongs to the SAME shipment
    CONSTRAINT fk_legs_continuation_composite FOREIGN KEY (continuation_of_leg_id, shipment_id, tenant_id)
        REFERENCES public.shipment_legs(id, shipment_id, tenant_id) ON DELETE RESTRICT,

    -- Enforce No Direct Self-Loop
    CONSTRAINT chk_leg_no_self_continuation CHECK (
        continuation_of_leg_id IS NULL OR continuation_of_leg_id <> id
    ),

    -- CHECK Constraint: Exactly ONE valid Origin endpoint
    CONSTRAINT chk_leg_exact_single_origin CHECK (
        num_nonnulls(origin_facility_id, origin_merchant_branch_id) +
        (CASE WHEN origin_is_shipment_customer THEN 1 ELSE 0 END) = 1
    ),

    -- CHECK Constraint: Exactly ONE valid Destination endpoint
    CONSTRAINT chk_leg_exact_single_destination CHECK (
        num_nonnulls(destination_facility_id, destination_merchant_branch_id) +
        (CASE WHEN destination_is_shipment_customer THEN 1 ELSE 0 END) = 1
    ),

    -- CHECK Constraint: Distinct Endpoints (Cannot start and terminate at the exact same physical entity)
    CONSTRAINT chk_leg_distinct_endpoints CHECK (
        NOT (
            (origin_facility_id IS NOT NULL AND origin_facility_id = destination_facility_id) OR
            (origin_merchant_branch_id IS NOT NULL AND origin_merchant_branch_id = destination_merchant_branch_id) OR
            (origin_is_shipment_customer AND destination_is_shipment_customer)
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_shipment_legs_shipment 
    ON public.shipment_legs (tenant_id, shipment_id, sequence);
CREATE INDEX IF NOT EXISTS idx_shipment_legs_driver_status 
    ON public.shipment_legs (tenant_id, assigned_driver_id, status) WHERE assigned_driver_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shipment_legs_origin_fac 
    ON public.shipment_legs (tenant_id, origin_facility_id, status) WHERE origin_facility_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shipment_legs_dest_fac 
    ON public.shipment_legs (tenant_id, destination_facility_id, status) WHERE destination_facility_id IS NOT NULL;


-- ----------------------------------------------------------------------------
-- 4. Shipment Leg Assignments (Dispatch Offers, Acceptance & Audit Trail)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shipment_leg_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    leg_id UUID NOT NULL,
    shipment_id UUID NOT NULL,
    driver_id UUID NOT NULL,
    assigned_by_user_id UUID,
    status public.leg_assignment_status NOT NULL DEFAULT 'OFFERED',
    earning_snapshot NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (earning_snapshot >= 0),
    offered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    responded_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Composite FK to shipment legs ensuring tenant and shipment matching
    CONSTRAINT fk_assignments_leg_composite FOREIGN KEY (leg_id, shipment_id, tenant_id)
        REFERENCES public.shipment_legs(id, shipment_id, tenant_id) ON DELETE RESTRICT,

    -- Composite FK to Driver User (Tenant isolated)
    CONSTRAINT fk_assignments_driver_composite FOREIGN KEY (driver_id, tenant_id)
        REFERENCES public.users(id, tenant_id) ON DELETE RESTRICT,

    -- Composite FK to Assigning Operator User (Tenant isolated)
    CONSTRAINT fk_assignments_operator_composite FOREIGN KEY (assigned_by_user_id, tenant_id)
        REFERENCES public.users(id, tenant_id) ON DELETE RESTRICT,

    CONSTRAINT uq_leg_assignments_composite UNIQUE (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_leg_assignments_driver 
    ON public.shipment_leg_assignments (tenant_id, driver_id, status);
CREATE INDEX IF NOT EXISTS idx_leg_assignments_leg 
    ON public.shipment_leg_assignments (tenant_id, leg_id);


-- ----------------------------------------------------------------------------
-- 5. Custody Events (Append-Only Physical Chain of Custody Event Log)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.custody_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    shipment_id UUID NOT NULL,
    leg_id UUID,
    event_type public.custody_event_type NOT NULL,

    -- Typed FROM Holder (Exactly one valid holder non-null)
    from_facility_id UUID,
    from_driver_id UUID,
    from_merchant_branch_id UUID,
    from_is_shipment_customer BOOLEAN NOT NULL DEFAULT false,

    -- Typed TO Holder (Exactly one valid holder non-null)
    to_facility_id UUID,
    to_driver_id UUID,
    to_merchant_branch_id UUID,
    to_is_shipment_customer BOOLEAN NOT NULL DEFAULT false,

    -- Operator or Driver executing the physical handoff
    performed_by_user_id UUID NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Physical Evidence Verification
    evidence_type public.custody_evidence_type NOT NULL,
    evidence_reference TEXT,
    notes TEXT,

    -- Idempotency protection per tenant
    idempotency_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Composite FK to Shipment (Tenant isolated)
    CONSTRAINT fk_custody_events_shipment_composite FOREIGN KEY (shipment_id, tenant_id)
        REFERENCES public.shipments(id, tenant_id) ON DELETE RESTRICT,

    -- Composite FK to Shipment Leg (Optional link, enforces leg belongs to exact shipment & tenant)
    CONSTRAINT fk_custody_events_leg_composite FOREIGN KEY (leg_id, shipment_id, tenant_id)
        REFERENCES public.shipment_legs(id, shipment_id, tenant_id) ON DELETE RESTRICT,

    -- Composite FK to Performing User (Tenant isolated)
    CONSTRAINT fk_custody_events_performer_composite FOREIGN KEY (performed_by_user_id, tenant_id)
        REFERENCES public.users(id, tenant_id) ON DELETE RESTRICT,

    -- Composite FKs to FROM Holders
    CONSTRAINT fk_custody_from_facility_composite FOREIGN KEY (from_facility_id, tenant_id)
        REFERENCES public.operational_facilities(id, tenant_id) ON DELETE RESTRICT,

    CONSTRAINT fk_custody_from_driver_composite FOREIGN KEY (from_driver_id, tenant_id)
        REFERENCES public.users(id, tenant_id) ON DELETE RESTRICT,

    CONSTRAINT fk_custody_from_branch_composite FOREIGN KEY (from_merchant_branch_id, tenant_id)
        REFERENCES public.merchant_branches(id, tenant_id) ON DELETE RESTRICT,

    -- Composite FKs to TO Holders
    CONSTRAINT fk_custody_to_facility_composite FOREIGN KEY (to_facility_id, tenant_id)
        REFERENCES public.operational_facilities(id, tenant_id) ON DELETE RESTRICT,

    CONSTRAINT fk_custody_to_driver_composite FOREIGN KEY (to_driver_id, tenant_id)
        REFERENCES public.users(id, tenant_id) ON DELETE RESTRICT,

    CONSTRAINT fk_custody_to_branch_composite FOREIGN KEY (to_merchant_branch_id, tenant_id)
        REFERENCES public.merchant_branches(id, tenant_id) ON DELETE RESTRICT,

    -- Unique Idempotency Constraint
    CONSTRAINT uq_custody_events_idempotency UNIQUE (tenant_id, idempotency_key),
    CONSTRAINT uq_custody_events_composite UNIQUE (id, tenant_id),
    CONSTRAINT uq_custody_events_shipment_composite UNIQUE (id, shipment_id, tenant_id),

    -- CHECK: Exactly ONE valid FROM Holder
    CONSTRAINT chk_custody_exact_single_from CHECK (
        num_nonnulls(from_facility_id, from_driver_id, from_merchant_branch_id) +
        (CASE WHEN from_is_shipment_customer THEN 1 ELSE 0 END) = 1
    ),

    -- CHECK: Exactly ONE valid TO Holder
    CONSTRAINT chk_custody_exact_single_to CHECK (
        num_nonnulls(to_facility_id, to_driver_id, to_merchant_branch_id) +
        (CASE WHEN to_is_shipment_customer THEN 1 ELSE 0 END) = 1
    ),

    -- CHECK: Distinct Handoff Parties (Cannot hand off to the exact same physical party)
    CONSTRAINT chk_custody_distinct_parties CHECK (
        NOT (
            (from_facility_id IS NOT NULL AND from_facility_id = to_facility_id) OR
            (from_driver_id IS NOT NULL AND from_driver_id = to_driver_id) OR
            (from_merchant_branch_id IS NOT NULL AND from_merchant_branch_id = to_merchant_branch_id) OR
            (from_is_shipment_customer AND to_is_shipment_customer)
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_custody_events_shipment 
    ON public.custody_events (tenant_id, shipment_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_custody_events_leg 
    ON public.custody_events (tenant_id, leg_id) WHERE leg_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_custody_events_performer 
    ON public.custody_events (tenant_id, performed_by_user_id);


-- ----------------------------------------------------------------------------
-- 6. Shipment Current Custody (High-Speed Transactional Projection Table)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shipment_current_custody (
    shipment_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    current_holder_type public.custody_holder_type NOT NULL,

    -- Current Physical Location/Holder Pointers
    current_facility_id UUID,
    current_driver_id UUID,
    current_merchant_branch_id UUID,
    is_with_customer BOOLEAN NOT NULL DEFAULT false,

    -- Distinguish Expected Initial State from Verified Physical Custody
    is_verified_custody BOOLEAN NOT NULL DEFAULT false,
    latest_custody_event_id UUID,

    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Composite FK to Shipments (Tenant isolated)
    CONSTRAINT fk_current_custody_shipment_composite FOREIGN KEY (shipment_id, tenant_id)
        REFERENCES public.shipments(id, tenant_id) ON DELETE RESTRICT,

    -- Composite FK to Latest Custody Event (Enforces event belongs to exact shipment & tenant)
    CONSTRAINT fk_current_custody_event_composite FOREIGN KEY (latest_custody_event_id, shipment_id, tenant_id)
        REFERENCES public.custody_events(id, shipment_id, tenant_id) ON DELETE RESTRICT,

    -- Composite FKs to current holders
    CONSTRAINT fk_current_custody_facility_composite FOREIGN KEY (current_facility_id, tenant_id)
        REFERENCES public.operational_facilities(id, tenant_id) ON DELETE RESTRICT,

    CONSTRAINT fk_current_custody_driver_composite FOREIGN KEY (current_driver_id, tenant_id)
        REFERENCES public.users(id, tenant_id) ON DELETE RESTRICT,

    CONSTRAINT fk_current_custody_branch_composite FOREIGN KEY (current_merchant_branch_id, tenant_id)
        REFERENCES public.merchant_branches(id, tenant_id) ON DELETE RESTRICT,

    -- CHECK: Exactly ONE valid current holder pointer
    CONSTRAINT chk_current_custody_exact_single_holder CHECK (
        num_nonnulls(current_facility_id, current_driver_id, current_merchant_branch_id) +
        (CASE WHEN is_with_customer THEN 1 ELSE 0 END) = 1
    ),

    -- CHECK: Exact consistency between current_holder_type and the populated holder pointer
    CONSTRAINT chk_current_custody_holder_type_consistency CHECK (
        (current_holder_type = 'FACILITY' AND current_facility_id IS NOT NULL AND current_driver_id IS NULL AND current_merchant_branch_id IS NULL AND NOT is_with_customer) OR
        (current_holder_type = 'DRIVER' AND current_driver_id IS NOT NULL AND current_facility_id IS NULL AND current_merchant_branch_id IS NULL AND NOT is_with_customer) OR
        (current_holder_type = 'MERCHANT' AND current_merchant_branch_id IS NOT NULL AND current_facility_id IS NULL AND current_driver_id IS NULL AND NOT is_with_customer) OR
        (current_holder_type = 'CUSTOMER' AND is_with_customer AND current_facility_id IS NULL AND current_driver_id IS NULL AND current_merchant_branch_id IS NULL)
    ),

    -- CHECK: Invariant - Unverified custody CANNOT reference a latest custody event
    CONSTRAINT chk_current_custody_unverified_no_event CHECK (
        is_verified_custody = true OR latest_custody_event_id IS NULL
    ),

    -- CHECK: Invariant - Customer terminal delivery MUST be verified custody
    CONSTRAINT chk_current_custody_customer_must_be_verified CHECK (
        NOT is_with_customer OR (is_verified_custody = true AND latest_custody_event_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_shipment_current_custody_lookup 
    ON public.shipment_current_custody (tenant_id, current_holder_type, current_facility_id, current_driver_id);


-- ----------------------------------------------------------------------------
-- 7. Operational Manifests (Physical Vehicle Transport Runsheets & Transfers)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.operational_manifests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    manifest_number TEXT NOT NULL,
    manifest_type public.manifest_type NOT NULL,
    status public.manifest_status NOT NULL DEFAULT 'DRAFT',

    source_facility_id UUID,
    destination_facility_id UUID,
    assigned_driver_id UUID,
    seal_number TEXT,

    total_legs INTEGER NOT NULL DEFAULT 0 CHECK (total_legs >= 0),
    total_cod_amount NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (total_cod_amount >= 0),
    created_by_user_id UUID NOT NULL,

    sealed_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Composite FKs to facilities and users
    CONSTRAINT fk_manifest_source_facility_composite FOREIGN KEY (source_facility_id, tenant_id)
        REFERENCES public.operational_facilities(id, tenant_id) ON DELETE RESTRICT,

    CONSTRAINT fk_manifest_dest_facility_composite FOREIGN KEY (destination_facility_id, tenant_id)
        REFERENCES public.operational_facilities(id, tenant_id) ON DELETE RESTRICT,

    CONSTRAINT fk_manifest_driver_composite FOREIGN KEY (assigned_driver_id, tenant_id)
        REFERENCES public.users(id, tenant_id) ON DELETE RESTRICT,

    CONSTRAINT fk_manifest_creator_composite FOREIGN KEY (created_by_user_id, tenant_id)
        REFERENCES public.users(id, tenant_id) ON DELETE RESTRICT,

    CONSTRAINT uq_manifest_number UNIQUE (tenant_id, manifest_number),
    CONSTRAINT uq_operational_manifests_composite UNIQUE (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_operational_manifests_lookup 
    ON public.operational_manifests (tenant_id, manifest_type, status);
CREATE INDEX IF NOT EXISTS idx_operational_manifests_driver 
    ON public.operational_manifests (tenant_id, assigned_driver_id, status) WHERE assigned_driver_id IS NOT NULL;


-- ----------------------------------------------------------------------------
-- 8. Manifest Items (Leg Membership in Physical Transport Manifests)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.manifest_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    manifest_id UUID NOT NULL,
    leg_id UUID NOT NULL,
    shipment_id UUID NOT NULL,
    is_scanned BOOLEAN NOT NULL DEFAULT false,
    scanned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Composite FK to Operational Manifests
    CONSTRAINT fk_manifest_items_manifest_composite FOREIGN KEY (manifest_id, tenant_id)
        REFERENCES public.operational_manifests(id, tenant_id) ON DELETE CASCADE,

    -- Composite FK ensuring Leg and Shipment are paired correctly and belong to the same tenant
    CONSTRAINT fk_manifest_items_leg_shipment_composite FOREIGN KEY (leg_id, shipment_id, tenant_id)
        REFERENCES public.shipment_legs(id, shipment_id, tenant_id) ON DELETE RESTRICT,

    -- A leg can belong to a given manifest at most once
    CONSTRAINT uq_manifest_item_leg UNIQUE (manifest_id, leg_id),
    CONSTRAINT uq_manifest_items_composite UNIQUE (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_manifest_items_manifest 
    ON public.manifest_items (tenant_id, manifest_id);
CREATE INDEX IF NOT EXISTS idx_manifest_items_leg 
    ON public.manifest_items (tenant_id, leg_id);


-- ----------------------------------------------------------------------------
-- 9. Customer Payment Records (Authoritative Commercial Customer Payments)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_payment_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    shipment_id UUID NOT NULL,
    leg_id UUID,

    payment_method public.customer_payment_method NOT NULL,
    amount_expected NUMERIC(12, 3) NOT NULL CHECK (amount_expected >= 0),
    amount_paid NUMERIC(12, 3) NOT NULL CHECK (amount_paid >= 0),

    discrepancy_status public.payment_discrepancy_status NOT NULL DEFAULT 'EXACT',
    discrepancy_reason TEXT,
    payment_status public.payment_record_status NOT NULL DEFAULT 'PENDING_VERIFICATION',
    payment_reference TEXT,

    reported_by_user_id UUID,
    verified_by_user_id UUID,
    reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    verified_at TIMESTAMPTZ,
    notes TEXT,

    -- Mandatory Idempotency protection
    idempotency_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Composite FK to Shipment
    CONSTRAINT fk_customer_payments_shipment_composite FOREIGN KEY (shipment_id, tenant_id)
        REFERENCES public.shipments(id, tenant_id) ON DELETE RESTRICT,

    -- Composite FK ensuring Leg belongs to the same Shipment and Tenant (if leg_id supplied)
    CONSTRAINT fk_customer_payments_leg_composite FOREIGN KEY (leg_id, shipment_id, tenant_id)
        REFERENCES public.shipment_legs(id, shipment_id, tenant_id) ON DELETE RESTRICT,

    -- Composite FKs to reporting & verifying users
    CONSTRAINT fk_customer_payments_reporter_composite FOREIGN KEY (reported_by_user_id, tenant_id)
        REFERENCES public.users(id, tenant_id) ON DELETE RESTRICT,

    CONSTRAINT fk_customer_payments_verifier_composite FOREIGN KEY (verified_by_user_id, tenant_id)
        REFERENCES public.users(id, tenant_id) ON DELETE RESTRICT,

    CONSTRAINT uq_customer_payment_records_idempotency UNIQUE (tenant_id, idempotency_key),
    CONSTRAINT uq_customer_payment_records_composite UNIQUE (id, tenant_id),
    CONSTRAINT uq_customer_payment_records_shipment_composite UNIQUE (id, shipment_id, tenant_id),
    CONSTRAINT uq_customer_payment_records_leg_composite UNIQUE (id, shipment_id, leg_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_payments_shipment 
    ON public.customer_payment_records (tenant_id, shipment_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_customer_payments_pending_verification 
    ON public.customer_payment_records (tenant_id, payment_method, payment_status)
    WHERE payment_status IN ('REPORTED', 'PENDING_VERIFICATION');


-- ----------------------------------------------------------------------------
-- 10. Driver Cash Collections (Strictly Physical Cash Held in Driver Custody)
-- Architectural Note: Only CASH payments create a row in driver_cash_collections.
-- Non-cash payment rails (e.g. CLIQ, PREPAID, WALLET) create customer_payment_records
-- but NEVER create driver_cash_collections rows because the driver holds zero physical cash.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.driver_cash_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    driver_id UUID NOT NULL,
    shipment_id UUID NOT NULL,
    leg_id UUID NOT NULL,
    payment_record_id UUID NOT NULL,

    cash_amount NUMERIC(12, 3) NOT NULL CHECK (cash_amount > 0),
    remittance_status public.cash_remittance_status NOT NULL DEFAULT 'HELD_BY_DRIVER',
    remittance_voucher_id UUID,

    collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    idempotency_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Composite FK to Driver User (Tenant isolated)
    CONSTRAINT fk_driver_cash_driver_composite FOREIGN KEY (driver_id, tenant_id)
        REFERENCES public.users(id, tenant_id) ON DELETE RESTRICT,

    -- Composite FK ensuring Payment Record belongs to the exact Shipment, Leg, and Tenant
    CONSTRAINT fk_driver_cash_payment_leg_composite FOREIGN KEY (payment_record_id, shipment_id, leg_id, tenant_id)
        REFERENCES public.customer_payment_records(id, shipment_id, leg_id, tenant_id) ON DELETE RESTRICT,

    -- Composite FK ensuring Leg belongs to the exact Shipment and Tenant
    CONSTRAINT fk_driver_cash_leg_shipment_composite FOREIGN KEY (leg_id, shipment_id, tenant_id)
        REFERENCES public.shipment_legs(id, shipment_id, tenant_id) ON DELETE RESTRICT,

    -- Composite FK to Accounting Voucher (Nullable until remitted and voucher created, strictly tenant-isolated)
    CONSTRAINT fk_driver_cash_voucher_composite FOREIGN KEY (remittance_voucher_id, tenant_id)
        REFERENCES public.vouchers(id, tenant_id) ON DELETE RESTRICT,

    -- Unique Idempotency per tenant
    CONSTRAINT uq_driver_cash_idempotency UNIQUE (tenant_id, idempotency_key),
    CONSTRAINT uq_driver_cash_composite UNIQUE (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_driver_cash_driver_status 
    ON public.driver_cash_collections (tenant_id, driver_id, remittance_status);
CREATE INDEX IF NOT EXISTS idx_driver_cash_leg 
    ON public.driver_cash_collections (tenant_id, leg_id);


-- ----------------------------------------------------------------------------
-- 11. Shipment Events (Canonical Domain Event Bus Envelope)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shipment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    shipment_id UUID NOT NULL,
    leg_id UUID,
    event_type TEXT NOT NULL,

    actor_user_id UUID NOT NULL,
    actor_role public.user_role NOT NULL,
    facility_id UUID,
    driver_id UUID,

    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    idempotency_key TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Composite FK to Shipment (Tenant isolated)
    CONSTRAINT fk_shipment_events_shipment_composite FOREIGN KEY (shipment_id, tenant_id)
        REFERENCES public.shipments(id, tenant_id) ON DELETE RESTRICT,

    -- Composite FK to Leg (Optional, enforces leg belongs to exact shipment & tenant)
    CONSTRAINT fk_shipment_events_leg_composite FOREIGN KEY (leg_id, shipment_id, tenant_id)
        REFERENCES public.shipment_legs(id, shipment_id, tenant_id) ON DELETE RESTRICT,

    -- Composite FK to Actor User (Tenant isolated)
    CONSTRAINT fk_shipment_events_actor_composite FOREIGN KEY (actor_user_id, tenant_id)
        REFERENCES public.users(id, tenant_id) ON DELETE RESTRICT,

    -- Composite FK to Facility (Optional, tenant isolated)
    CONSTRAINT fk_shipment_events_facility_composite FOREIGN KEY (facility_id, tenant_id)
        REFERENCES public.operational_facilities(id, tenant_id) ON DELETE RESTRICT,

    -- Composite FK to Driver User (Optional, tenant isolated)
    CONSTRAINT fk_shipment_events_driver_composite FOREIGN KEY (driver_id, tenant_id)
        REFERENCES public.users(id, tenant_id) ON DELETE RESTRICT,

    CONSTRAINT uq_shipment_events_idempotency UNIQUE (tenant_id, idempotency_key),
    CONSTRAINT uq_shipment_events_composite UNIQUE (id, tenant_id),
    CONSTRAINT uq_shipment_events_shipment_composite UNIQUE (id, shipment_id, tenant_id),
    CONSTRAINT uq_shipment_events_leg_composite UNIQUE (id, shipment_id, leg_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_shipment_events_shipment 
    ON public.shipment_events (tenant_id, shipment_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipment_events_type 
    ON public.shipment_events (tenant_id, event_type, occurred_at DESC);


-- ============================================================================
-- SECTION 3: EXISTING TABLE EXTENSIONS (FINANCIAL OBLIGATIONS)
-- ============================================================================

-- 1. Add nullable leg_id and source_event_id to public.financial_obligations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'financial_obligations' 
          AND column_name = 'leg_id'
    ) THEN
        ALTER TABLE public.financial_obligations
            ADD COLUMN leg_id UUID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'financial_obligations' 
          AND column_name = 'source_event_id'
    ) THEN
        ALTER TABLE public.financial_obligations
            ADD COLUMN source_event_id UUID;
    END IF;
END $$;

-- 2. Add Composite FKs from financial_obligations to shipment_legs and shipment_events
-- Enforces that leg_id belongs to the exact shipment_id and tenant_id,
-- and source_event_id belongs to the exact shipment_id, leg_id, and tenant_id.
DO $$
BEGIN
    -- Drop older loose FK if exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_obligations_leg_composite'
    ) THEN
        ALTER TABLE public.financial_obligations
            DROP CONSTRAINT fk_obligations_leg_composite;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_obligations_leg_shipment_composite'
    ) THEN
        ALTER TABLE public.financial_obligations
            ADD CONSTRAINT fk_obligations_leg_shipment_composite
            FOREIGN KEY (leg_id, shipment_id, tenant_id)
            REFERENCES public.shipment_legs(id, shipment_id, tenant_id)
            ON DELETE RESTRICT;
    END IF;

    -- Drop older loose FK if exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_obligations_source_event_composite'
    ) THEN
        ALTER TABLE public.financial_obligations
            DROP CONSTRAINT fk_obligations_source_event_composite;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_obligations_source_event_leg_composite'
    ) THEN
        ALTER TABLE public.financial_obligations
            ADD CONSTRAINT fk_obligations_source_event_leg_composite
            FOREIGN KEY (source_event_id, shipment_id, leg_id, tenant_id)
            REFERENCES public.shipment_events(id, shipment_id, leg_id, tenant_id)
            ON DELETE RESTRICT;
    END IF;

    -- Enforce that if leg_id is provided for DRIVER_EARNING, source_event_id is mandatory,
    -- while preserving full backward compatibility for legacy records where both are NULL.
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_driver_earning_source_event_required'
    ) THEN
        ALTER TABLE public.financial_obligations
            ADD CONSTRAINT chk_driver_earning_source_event_required CHECK (
                obligation_type <> 'DRIVER_EARNING'
                OR (leg_id IS NULL AND source_event_id IS NULL)
                OR (leg_id IS NOT NULL AND source_event_id IS NOT NULL)
            );
    END IF;
END $$;

-- 3. Replace Legacy Shipment/Type Unique Constraint with Safe Partial Indexes
-- Preflight Guard: Verify that existing data does not violate the upcoming partial uniqueness predicates
-- before dropping uq_obligations_shipment_type. Fails cleanly with an explicit exception if conflicts exist.
DO $$
DECLARE
    v_conflict_count INT;
BEGIN
    -- Check 1: Active Merchant & Company Fee duplicates
    SELECT COUNT(*) INTO v_conflict_count
    FROM (
        SELECT tenant_id, shipment_id, obligation_type
        FROM public.financial_obligations
        WHERE obligation_type IN ('MERCHANT_COD_PAYABLE', 'COMPANY_DELIVERY_FEE', 'COMPANY_RETURN_FEE')
          AND status <> 'CANCELLED'
          AND shipment_id IS NOT NULL
        GROUP BY tenant_id, shipment_id, obligation_type
        HAVING COUNT(*) > 1
    ) conflicts;

    IF v_conflict_count > 0 THEN
        RAISE EXCEPTION 'PREFLIGHT CHECK FAILED: Found % duplicate active merchant/company obligations across shipments. Cannot safely apply replacement unique indexes.', v_conflict_count;
    END IF;

    -- Check 2: Active legacy DRIVER_EARNING duplicates (leg_id IS NULL)
    SELECT COUNT(*) INTO v_conflict_count
    FROM (
        SELECT tenant_id, shipment_id, obligation_type
        FROM public.financial_obligations
        WHERE obligation_type = 'DRIVER_EARNING'
          AND leg_id IS NULL
          AND status <> 'CANCELLED'
          AND shipment_id IS NOT NULL
        GROUP BY tenant_id, shipment_id, obligation_type
        HAVING COUNT(*) > 1
    ) conflicts;

    IF v_conflict_count > 0 THEN
        RAISE EXCEPTION 'PREFLIGHT CHECK FAILED: Found % duplicate active legacy driver earnings across shipments. Cannot safely apply replacement unique indexes.', v_conflict_count;
    END IF;
END $$;

-- Drop the rigid 1-obligation-per-type constraint that prevented multi-leg driver earnings
ALTER TABLE public.financial_obligations
    DROP CONSTRAINT IF EXISTS uq_obligations_shipment_type;

-- Index 1: Exactly ONE active obligation per type for Merchant & Company Fee obligations (Canonical enum values)
CREATE UNIQUE INDEX IF NOT EXISTS uq_obligations_merchant_shipment_active
    ON public.financial_obligations (tenant_id, shipment_id, obligation_type)
    WHERE obligation_type IN ('MERCHANT_COD_PAYABLE', 'COMPANY_DELIVERY_FEE', 'COMPANY_RETURN_FEE')
      AND status <> 'CANCELLED';

-- Index 2: Legacy single-driver DRIVER_EARNING obligations (where leg_id is NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_obligations_driver_legacy_shipment_active
    ON public.financial_obligations (tenant_id, shipment_id, obligation_type)
    WHERE obligation_type = 'DRIVER_EARNING'
      AND leg_id IS NULL
      AND status <> 'CANCELLED';

-- Index 3: Multi-leg DRIVER_EARNING obligations (Anchored to specific Leg, exactly 1 active earning per leg)
CREATE UNIQUE INDEX IF NOT EXISTS uq_obligations_driver_leg_active
    ON public.financial_obligations (tenant_id, shipment_id, leg_id, obligation_type)
    WHERE obligation_type = 'DRIVER_EARNING'
      AND leg_id IS NOT NULL
      AND status <> 'CANCELLED';

-- Index 4: Multi-leg DRIVER_EARNING idempotency anchored to source_event_id (Prevents duplicate earnings from the same event)
CREATE UNIQUE INDEX IF NOT EXISTS uq_obligations_driver_source_event_active
    ON public.financial_obligations (tenant_id, source_event_id)
    WHERE obligation_type = 'DRIVER_EARNING'
      AND source_event_id IS NOT NULL
      AND status <> 'CANCELLED';


-- ============================================================================
-- SECTION 4: SECURITY HARDENING & RLS POLICIES
-- ============================================================================

-- Enable RLS across all new tables
ALTER TABLE public.operational_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_facility_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_legs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_leg_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custody_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_current_custody ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manifest_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_cash_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_events ENABLE ROW LEVEL SECURITY;

-- Revoke direct access from anon, authenticated, public
REVOKE ALL ON public.operational_facilities FROM anon, authenticated, public;
REVOKE ALL ON public.user_facility_access FROM anon, authenticated, public;
REVOKE ALL ON public.shipment_legs FROM anon, authenticated, public;
REVOKE ALL ON public.shipment_leg_assignments FROM anon, authenticated, public;
REVOKE ALL ON public.custody_events FROM anon, authenticated, public;
REVOKE ALL ON public.shipment_current_custody FROM anon, authenticated, public;
REVOKE ALL ON public.operational_manifests FROM anon, authenticated, public;
REVOKE ALL ON public.manifest_items FROM anon, authenticated, public;
REVOKE ALL ON public.customer_payment_records FROM anon, authenticated, public;
REVOKE ALL ON public.driver_cash_collections FROM anon, authenticated, public;
REVOKE ALL ON public.shipment_events FROM anon, authenticated, public;

-- Principle of Least Privilege: Revoke dangerous table-level truncate and mutation privileges
-- Note: In standard PostgreSQL, table owners/superusers may bypass grant-level revokes.
-- True tamper-proofing is enforced at three defense layers:
-- Layer 1: Relational Schema Design (Append-only by nature, missing mutation pathways)
-- Layer 2: Explicit privilege configuration below for standard client connections
-- Layer 3: Application service layer invariants that never issue UPDATE/DELETE on audit logs
REVOKE TRUNCATE, DELETE, UPDATE ON public.custody_events FROM service_role;
REVOKE TRUNCATE, DELETE, UPDATE ON public.shipment_events FROM service_role;
REVOKE TRUNCATE ON public.shipment_legs FROM service_role;
REVOKE TRUNCATE ON public.shipment_current_custody FROM service_role;
REVOKE TRUNCATE ON public.driver_cash_collections FROM service_role;
REVOKE TRUNCATE ON public.customer_payment_records FROM service_role;

-- Grant controlled operational privileges to service_role (used by Express backend)
-- Append-only tables (custody_events, shipment_events) are restricted to SELECT and INSERT.
GRANT ALL ON public.operational_facilities TO service_role;
GRANT ALL ON public.user_facility_access TO service_role;
GRANT ALL ON public.shipment_legs TO service_role;
GRANT ALL ON public.shipment_leg_assignments TO service_role;
GRANT SELECT, INSERT ON public.custody_events TO service_role;
GRANT ALL ON public.shipment_current_custody TO service_role;
GRANT ALL ON public.operational_manifests TO service_role;
GRANT ALL ON public.manifest_items TO service_role;
GRANT ALL ON public.customer_payment_records TO service_role;
GRANT ALL ON public.driver_cash_collections TO service_role;
GRANT SELECT, INSERT ON public.shipment_events TO service_role;

-- Service Role Policies (Permit all operations for tenant-aware backend queries)
DO $$
BEGIN
    DROP POLICY IF EXISTS service_role_all_facilities ON public.operational_facilities;
    CREATE POLICY service_role_all_facilities ON public.operational_facilities FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS service_role_all_user_facility ON public.user_facility_access;
    CREATE POLICY service_role_all_user_facility ON public.user_facility_access FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS service_role_all_shipment_legs ON public.shipment_legs;
    CREATE POLICY service_role_all_shipment_legs ON public.shipment_legs FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS service_role_all_leg_assignments ON public.shipment_leg_assignments;
    CREATE POLICY service_role_all_leg_assignments ON public.shipment_leg_assignments FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS service_role_all_custody_events ON public.custody_events;
    CREATE POLICY service_role_all_custody_events ON public.custody_events FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS service_role_all_current_custody ON public.shipment_current_custody;
    CREATE POLICY service_role_all_current_custody ON public.shipment_current_custody FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS service_role_all_operational_manifests ON public.operational_manifests;
    CREATE POLICY service_role_all_operational_manifests ON public.operational_manifests FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS service_role_all_manifest_items ON public.manifest_items;
    CREATE POLICY service_role_all_manifest_items ON public.manifest_items FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS service_role_all_customer_payments ON public.customer_payment_records;
    CREATE POLICY service_role_all_customer_payments ON public.customer_payment_records FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS service_role_all_driver_cash ON public.driver_cash_collections;
    CREATE POLICY service_role_all_driver_cash ON public.driver_cash_collections FOR ALL TO service_role USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS service_role_all_shipment_events ON public.shipment_events;
    CREATE POLICY service_role_all_shipment_events ON public.shipment_events FOR ALL TO service_role USING (true) WITH CHECK (true);
END $$;

COMMIT;

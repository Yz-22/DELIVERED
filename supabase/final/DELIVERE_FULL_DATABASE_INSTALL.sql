-- ============================================================================
-- DELIVERE ENTERPRISE — MASTER DATABASE INSTALLATION SCRIPT
-- TARGET ENVIRONMENT: DEVELOPMENT_STAGING / SUPABASE SQL EDITOR
-- TARGET SUPABASE REF: rekflpovydwnqehnqwev
-- VERSION: 2.0.0 (ENTERPRISE HARDENED)
--
-- DESCRIPTION:
-- Monolithic all-in-one database installation package for Delivere.
-- Combines modules 00 through 18 in strict relational dependency order.
-- Safely resets the public application schema while preserving auth.*,
-- storage.*, and Supabase extensions. Installs all 28 core tables,
-- composite FKs, immutability triggers, multi-tenant RLS policies,
-- stored procedures, and development baseline fixtures.
-- ============================================================================

BEGIN;

-- ============================================================================
-- MODULE 00: RESET DEVELOPMENT APPLICATION SCHEMA
-- ============================================================================

-- Catalog-aware dynamic drop for legacy relations (safely handles both TABLE and VIEW relation kinds)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT relname, relkind 
        FROM pg_class c 
        JOIN pg_namespace n ON n.oid = c.relnamespace 
        WHERE n.nspname = 'public' AND relname IN ('orders', 'settlements')
    ) LOOP
        IF r.relkind = 'v' THEN
            EXECUTE 'DROP VIEW IF EXISTS public.' || quote_ident(r.relname) || ' CASCADE';
        ELSIF r.relkind = 'r' THEN
            EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.relname) || ' CASCADE';
        END IF;
    END LOOP;
END $$;

-- Drop all public tables in reverse dependency order
DROP TABLE IF EXISTS public.settlement_items CASCADE;
DROP TABLE IF EXISTS public.settlement_records CASCADE;
DROP TABLE IF EXISTS public.financial_obligations CASCADE;
DROP TABLE IF EXISTS public.vouchers CASCADE;
DROP TABLE IF EXISTS public.journal_lines CASCADE;
DROP TABLE IF EXISTS public.journal_entries CASCADE;
DROP TABLE IF EXISTS public.accounts CASCADE;
DROP TABLE IF EXISTS public.driver_wallets CASCADE;
DROP TABLE IF EXISTS public.shipment_status_history CASCADE;
DROP TABLE IF EXISTS public.shipments CASCADE;
DROP TABLE IF EXISTS public.price_plan_rules CASCADE;
DROP TABLE IF EXISTS public.price_plans CASCADE;
DROP TABLE IF EXISTS public.merchant_stock_transfer_items CASCADE;
DROP TABLE IF EXISTS public.merchant_stock_transfers CASCADE;
DROP TABLE IF EXISTS public.stock_movements CASCADE;
DROP TABLE IF EXISTS public.branch_inventory CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.user_branch_access CASCADE;
DROP TABLE IF EXISTS public.merchant_branches CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.revoked_sessions CASCADE;
DROP TABLE IF EXISTS public.user_invitations CASCADE;
DROP TABLE IF EXISTS public.subscriptions CASCADE;
DROP TABLE IF EXISTS public.subscription_plans CASCADE;
DROP TABLE IF EXISTS public.accounting_periods CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.tenant_settings CASCADE;
DROP TABLE IF EXISTS public.tenants CASCADE;

-- Drop custom business functions and triggers
DROP FUNCTION IF EXISTS public.check_journal_posting_balance() CASCADE;
DROP FUNCTION IF EXISTS public.prevent_posted_journal_mutation() CASCADE;
DROP FUNCTION IF EXISTS public.prevent_posted_journal_lines_mutation() CASCADE;
DROP FUNCTION IF EXISTS public.prevent_audit_log_mutation() CASCADE;
DROP FUNCTION IF EXISTS public.prevent_stock_movement_mutation() CASCADE;
DROP FUNCTION IF EXISTS public.prevent_shipment_history_mutation() CASCADE;
DROP FUNCTION IF EXISTS public.protect_shipment_financial_snapshots() CASCADE;
DROP FUNCTION IF EXISTS public.validate_settlement_item_beneficiary() CASCADE;
DROP FUNCTION IF EXISTS public.enforce_settlement_allocation_cap() CASCADE;
DROP FUNCTION IF EXISTS public.recalculate_obligation_allocated_amount(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.handle_settlement_item_mutation() CASCADE;
DROP FUNCTION IF EXISTS public.handle_settlement_status_change() CASCADE;
DROP FUNCTION IF EXISTS public.check_journal_entry_period_lock() CASCADE;
DROP FUNCTION IF EXISTS public.execute_stock_transfer_completion(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.execute_stock_transfer_reversal(UUID, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.execute_journal_reversal(UUID, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.orders_view_insert_handler() CASCADE;
DROP FUNCTION IF EXISTS public.orders_view_update_handler() CASCADE;
DROP FUNCTION IF EXISTS public.orders_view_delete_handler() CASCADE;

-- Drop custom ENUM types so they can be freshly rebuilt
DROP TYPE IF EXISTS public.user_role CASCADE;
DROP TYPE IF EXISTS public.user_auth_provider CASCADE;
DROP TYPE IF EXISTS public.invitation_status CASCADE;
DROP TYPE IF EXISTS public.shipment_status CASCADE;
DROP TYPE IF EXISTS public.payment_type CASCADE;
DROP TYPE IF EXISTS public.settlement_status CASCADE;
DROP TYPE IF EXISTS public.settlement_type CASCADE;
DROP TYPE IF EXISTS public.financial_obligation_type CASCADE;
DROP TYPE IF EXISTS public.financial_obligation_status CASCADE;
DROP TYPE IF EXISTS public.account_type CASCADE;
DROP TYPE IF EXISTS public.journal_posting_status CASCADE;
DROP TYPE IF EXISTS public.voucher_type CASCADE;
DROP TYPE IF EXISTS public.accounting_period_status CASCADE;
DROP TYPE IF EXISTS public.stock_movement_type CASCADE;
DROP TYPE IF EXISTS public.stock_transfer_status CASCADE;
DROP TYPE IF EXISTS public.price_plan_type CASCADE;
DROP TYPE IF EXISTS public.subscription_status CASCADE;
DROP TYPE IF EXISTS public.subscription_billing_cycle CASCADE;


-- ============================================================================
-- MODULE 01: EXTENSIONS AND CORE ENUM TYPES
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

CREATE TYPE public.user_role AS ENUM (
    'SUPER_ADMIN',
    'ADMIN',
    'OPERATOR',
    'ACCOUNTANT',
    'DISPATCHER',
    'DRIVER',
    'MERCHANT',
    'CASHIER',
    'STAFF'
);

CREATE TYPE public.user_auth_provider AS ENUM (
    'GOOGLE',
    'EMAIL_PASSWORD'
);

CREATE TYPE public.invitation_status AS ENUM (
    'PENDING',
    'ACCEPTED',
    'EXPIRED',
    'REVOKED'
);

CREATE TYPE public.shipment_status AS ENUM (
    'CREATED',
    'RECEIVED_AT_HUB',
    'PICKED_UP',
    'SORTED',
    'IN_TRANSIT',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'FAILED_ATTEMPT',
    'RESCHEDULED',
    'RETURNED',
    'CANCELLED'
);

CREATE TYPE public.payment_type AS ENUM (
    'COD',
    'PREPAID',
    'POSTPAID'
);

CREATE TYPE public.settlement_status AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'APPROVED',
    'SETTLED',
    'CANCELLED'
);

CREATE TYPE public.settlement_type AS ENUM (
    'MERCHANT_REMITTANCE',
    'DRIVER_PAYOUT'
);

CREATE TYPE public.financial_obligation_type AS ENUM (
    'MERCHANT_COD_PAYABLE',
    'DRIVER_EARNING',
    'COMPANY_DELIVERY_FEE',
    'COMPANY_RETURN_FEE'
);

CREATE TYPE public.financial_obligation_status AS ENUM (
    'PENDING',
    'PARTIALLY_SETTLED',
    'SETTLED',
    'CANCELLED'
);

CREATE TYPE public.account_type AS ENUM (
    'ASSET',
    'LIABILITY',
    'EQUITY',
    'REVENUE',
    'EXPENSE'
);

CREATE TYPE public.journal_posting_status AS ENUM (
    'DRAFT',
    'POSTED',
    'REVERSED'
);

CREATE TYPE public.voucher_type AS ENUM (
    'RECEIPT',
    'PAYMENT',
    'JOURNAL'
);

CREATE TYPE public.accounting_period_status AS ENUM (
    'OPEN',
    'CLOSED'
);

CREATE TYPE public.stock_movement_type AS ENUM (
    'INBOUND_PURCHASE',
    'OUTBOUND_SALE',
    'OUTBOUND_DELIVERY',
    'RETURN_RESTOCK',
    'TRANSFER_OUT',
    'TRANSFER_IN',
    'ADJUSTMENT_ADD',
    'ADJUSTMENT_REMOVE',
    'DAMAGE_WRITE_OFF',
    'REVERSAL'
);

CREATE TYPE public.stock_transfer_status AS ENUM (
    'PENDING',
    'IN_TRANSIT',
    'COMPLETED',
    'CANCELLED'
);

CREATE TYPE public.price_plan_type AS ENUM (
    'MERCHANT',
    'DRIVER'
);

CREATE TYPE public.subscription_status AS ENUM (
    'TRIAL',
    'ACTIVE',
    'PAST_DUE',
    'SUSPENDED',
    'CANCELLED'
);

CREATE TYPE public.subscription_billing_cycle AS ENUM (
    'MONTHLY',
    'ANNUAL'
);


-- ============================================================================
-- MODULE 02: TENANTS AND USERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenants_code ON public.tenants (code);

CREATE TABLE IF NOT EXISTS public.tenant_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    commercial_name TEXT,
    brand_color TEXT DEFAULT '#4F46E5',
    logo_url TEXT,
    currency TEXT NOT NULL DEFAULT 'JOD',
    phone TEXT,
    email TEXT,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    email TEXT,
    phone TEXT,
    name TEXT NOT NULL,
    password_hash TEXT,
    role public.user_role NOT NULL DEFAULT 'OPERATOR',
    role_name TEXT,
    portal_access TEXT,
    commercial_name TEXT,
    commercial_type TEXT,
    city TEXT DEFAULT 'عمان',
    address TEXT,
    branch TEXT,
    department TEXT,
    account_manager TEXT,
    price_list TEXT,
    price_plan_id TEXT,
    vehicle_type TEXT,
    vehicle_plate TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    parent_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_by_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    permissions TEXT[] NOT NULL DEFAULT '{}',
    max_allowed_permissions TEXT[] NOT NULL DEFAULT '{}',
    auth_provider public.user_auth_provider NOT NULL DEFAULT 'EMAIL_PASSWORD',
    auth_user_id UUID UNIQUE,
    google_id TEXT,
    google_email TEXT,
    invitation_id UUID,
    invited_by UUID,
    subscription_plan TEXT,
    subscription_plan_name TEXT,
    subscription_status TEXT,
    subscription_start_date TIMESTAMPTZ,
    subscription_end_date TIMESTAMPTZ,
    subscription_price NUMERIC(12, 3),
    subscription_billing_cycle TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_users_composite UNIQUE (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_users_tenant_role ON public.users (tenant_id, role);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (LOWER(TRIM(email))) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users (auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_google_id ON public.users (google_id) WHERE google_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_parent_user ON public.users (parent_user_id);


-- ============================================================================
-- MODULE 03: AUTH INVITATIONS, SESSIONS, AUDIT
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash TEXT NOT NULL UNIQUE,
    email TEXT,
    phone TEXT,
    role public.user_role NOT NULL DEFAULT 'OPERATOR',
    role_name TEXT,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    parent_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    invited_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    inviter_name TEXT,
    inviter_role TEXT,
    permissions TEXT[] NOT NULL DEFAULT '{}',
    max_allowed_permissions TEXT[] NOT NULL DEFAULT '{}',
    commercial_name TEXT,
    company_name TEXT,
    branch TEXT,
    branch_id UUID,
    city TEXT,
    price_list TEXT,
    price_plan_id TEXT,
    status public.invitation_status NOT NULL DEFAULT 'PENDING',
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    accepted_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    auth_provider public.user_auth_provider NOT NULL DEFAULT 'EMAIL_PASSWORD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitations_token_hash ON public.user_invitations (token_hash);
CREATE INDEX IF NOT EXISTS idx_invitations_tenant_status ON public.user_invitations (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.user_invitations (LOWER(TRIM(email))) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.revoked_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    revoked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason TEXT DEFAULT 'LOGOUT',
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_revoked_sessions_token ON public.revoked_sessions (token_hash);
CREATE INDEX IF NOT EXISTS idx_revoked_sessions_expiry ON public.revoked_sessions (expires_at);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE RESTRICT,
    action TEXT NOT NULL,
    action_name_ar TEXT,
    performed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    performer_name TEXT,
    performer_role TEXT,
    target_id TEXT,
    target_type TEXT,
    target_name TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON public.audit_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by ON public.audit_logs (performed_by);


-- ============================================================================
-- MODULE 04: ROLES, PERMISSIONS AND BRANCH ACCESS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_branch_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    can_pos BOOLEAN NOT NULL DEFAULT true,
    can_dispatch BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_user_branch_access_user FOREIGN KEY (user_id, tenant_id) 
        REFERENCES public.users(id, tenant_id) ON DELETE CASCADE,
    
    CONSTRAINT fk_user_branch_access_merchant FOREIGN KEY (merchant_id, tenant_id) 
        REFERENCES public.users(id, tenant_id) ON DELETE CASCADE,

    CONSTRAINT uq_user_branch_access UNIQUE (user_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_user_branch_access_user ON public.user_branch_access (user_id);
CREATE INDEX IF NOT EXISTS idx_user_branch_access_merchant ON public.user_branch_access (merchant_id);
CREATE INDEX IF NOT EXISTS idx_user_branch_access_branch ON public.user_branch_access (branch_id);


-- ============================================================================
-- MODULE 05: MERCHANTS, BRANCHES, CUSTOMERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.merchant_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    address TEXT,
    governorate TEXT DEFAULT 'عمان',
    area TEXT,
    phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_main BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_merchant_branches_merchant FOREIGN KEY (merchant_id, tenant_id)
        REFERENCES public.users(id, tenant_id) ON DELETE CASCADE,

    CONSTRAINT uq_merchant_branch_composite UNIQUE (id, merchant_id, tenant_id),
    CONSTRAINT uq_merchant_branch_id_tenant UNIQUE (id, tenant_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_merchant_single_main_branch 
    ON public.merchant_branches (merchant_id) 
    WHERE is_main = true AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_merchant_branches_lookup ON public.merchant_branches (tenant_id, merchant_id, is_active);

ALTER TABLE public.user_branch_access
    DROP CONSTRAINT IF EXISTS fk_user_branch_access_branch;

ALTER TABLE public.user_branch_access
    ADD CONSTRAINT fk_user_branch_access_branch
    FOREIGN KEY (branch_id, merchant_id, tenant_id)
    REFERENCES public.merchant_branches(id, merchant_id, tenant_id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL,
    branch_id UUID REFERENCES public.merchant_branches(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    governorate TEXT DEFAULT 'عمان',
    area TEXT,
    address TEXT,
    notes TEXT,
    total_orders INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_customers_merchant FOREIGN KEY (merchant_id, tenant_id)
        REFERENCES public.users(id, tenant_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_customers_merchant_phone ON public.customers (merchant_id, phone);
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON public.customers (tenant_id);


-- ============================================================================
-- MODULE 06: PRODUCTS, WAREHOUSES, INVENTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL,
    sku TEXT NOT NULL,
    barcode TEXT,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    cost_price NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (cost_price >= 0),
    selling_price NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (selling_price >= 0),
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (tax_rate >= 0),
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_products_merchant FOREIGN KEY (merchant_id, tenant_id)
        REFERENCES public.users(id, tenant_id) ON DELETE CASCADE,

    CONSTRAINT uq_products_composite UNIQUE (id, merchant_id, tenant_id),
    CONSTRAINT uq_products_id_tenant UNIQUE (id, tenant_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_merchant_sku ON public.products (merchant_id, LOWER(TRIM(sku)));
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products (merchant_id, barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_tenant ON public.products (tenant_id, is_active);

CREATE TABLE IF NOT EXISTS public.branch_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    product_id UUID NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
    reorder_point INTEGER NOT NULL DEFAULT 5 CHECK (reorder_point >= 0),
    location_in_branch TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_branch_inventory_branch FOREIGN KEY (branch_id, merchant_id, tenant_id)
        REFERENCES public.merchant_branches(id, merchant_id, tenant_id) ON DELETE CASCADE,

    CONSTRAINT fk_branch_inventory_product FOREIGN KEY (product_id, merchant_id, tenant_id)
        REFERENCES public.products(id, merchant_id, tenant_id) ON DELETE CASCADE,

    CONSTRAINT uq_branch_inventory_item UNIQUE (branch_id, product_id),
    CONSTRAINT chk_branch_inventory_reserved_limit CHECK (reserved_quantity <= quantity)
);

CREATE INDEX IF NOT EXISTS idx_branch_inventory_lookup ON public.branch_inventory (tenant_id, merchant_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_inventory_product ON public.branch_inventory (product_id);


-- ============================================================================
-- MODULE 07: STOCK MOVEMENTS AND TRANSFERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    merchant_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    product_id UUID NOT NULL,
    movement_type public.stock_movement_type NOT NULL,
    quantity INTEGER NOT NULL,
    balance_before INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    unit_cost NUMERIC(12, 3) DEFAULT 0.000,
    reference_type TEXT,
    reference_id TEXT,
    notes TEXT,
    performed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_stock_movements_branch FOREIGN KEY (branch_id, merchant_id, tenant_id)
        REFERENCES public.merchant_branches(id, merchant_id, tenant_id) ON DELETE RESTRICT,

    CONSTRAINT fk_stock_movements_product FOREIGN KEY (product_id, merchant_id, tenant_id)
        REFERENCES public.products(id, merchant_id, tenant_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_lookup 
    ON public.stock_movements (tenant_id, merchant_id, branch_id, product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference 
    ON public.stock_movements (reference_type, reference_id);

CREATE TABLE IF NOT EXISTS public.merchant_stock_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL,
    source_branch_id UUID NOT NULL,
    destination_branch_id UUID NOT NULL,
    status public.stock_transfer_status NOT NULL DEFAULT 'PENDING',
    transfer_number TEXT,
    notes TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    received_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_different_transfer_branches CHECK (source_branch_id <> destination_branch_id),

    CONSTRAINT fk_stock_transfer_source FOREIGN KEY (source_branch_id, merchant_id, tenant_id)
        REFERENCES public.merchant_branches(id, merchant_id, tenant_id) ON DELETE RESTRICT,

    CONSTRAINT fk_stock_transfer_dest FOREIGN KEY (destination_branch_id, merchant_id, tenant_id)
        REFERENCES public.merchant_branches(id, merchant_id, tenant_id) ON DELETE RESTRICT,

    CONSTRAINT uq_merchant_stock_transfers_composite UNIQUE (id, merchant_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_lookup 
    ON public.merchant_stock_transfers (tenant_id, merchant_id, status);

CREATE TABLE IF NOT EXISTS public.merchant_stock_transfer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL,
    transfer_id UUID NOT NULL,
    product_id UUID NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(12, 3) DEFAULT 0.000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_stock_transfer_items_transfer FOREIGN KEY (transfer_id, merchant_id, tenant_id)
        REFERENCES public.merchant_stock_transfers(id, merchant_id, tenant_id) ON DELETE CASCADE,

    CONSTRAINT fk_stock_transfer_items_product FOREIGN KEY (product_id, merchant_id, tenant_id)
        REFERENCES public.products(id, merchant_id, tenant_id) ON DELETE RESTRICT,

    CONSTRAINT uq_stock_transfer_items_product UNIQUE (transfer_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_transfer ON public.merchant_stock_transfer_items (transfer_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_tenant ON public.merchant_stock_transfer_items (tenant_id, merchant_id);


-- ============================================================================
-- MODULE 08: PRICING AND DELIVERY SHIPMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.price_plans (
    id TEXT PRIMARY KEY DEFAULT ('pp-' || substr(md5(random()::text), 1, 8)),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    merchant_id UUID,
    name TEXT NOT NULL,
    type public.price_plan_type NOT NULL DEFAULT 'MERCHANT',
    description TEXT,
    is_default BOOLEAN NOT NULL DEFAULT false,
    default_fee NUMERIC(12, 3) NOT NULL DEFAULT 3.000,
    governorate_fees JSONB NOT NULL DEFAULT '{}'::jsonb,
    return_fee NUMERIC(12, 3) NOT NULL DEFAULT 1.000,
    extra_weight_fee_per_kg NUMERIC(12, 3) NOT NULL DEFAULT 0.500,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_price_plans_composite UNIQUE (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_price_plans_lookup ON public.price_plans (tenant_id, type, is_default);

-- Durable Point-to-Point Pricing Rules (Origin / Destination Matrix)
CREATE TABLE IF NOT EXISTS public.price_plan_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    price_plan_id TEXT NOT NULL,
    from_governorate TEXT NOT NULL DEFAULT 'عمان',
    from_sub_region TEXT,
    to_governorate TEXT NOT NULL,
    to_sub_region TEXT,
    order_type TEXT NOT NULL DEFAULT 'عادي',
    price NUMERIC(12, 3) NOT NULL DEFAULT 3.000,
    return_discount NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    fixed_return NUMERIC(12, 3),
    driver_discount NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    fixed_driver_cost NUMERIC(12, 3),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_plan_rules_lookup 
    ON public.price_plan_rules (tenant_id, price_plan_id, to_governorate, is_active);

CREATE TABLE IF NOT EXISTS public.shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    sequence TEXT NOT NULL,
    merchant_id UUID NOT NULL,
    branch_id UUID,
    driver_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    price_plan_id TEXT,
    recipient_name TEXT NOT NULL,
    recipient_phone TEXT NOT NULL,
    recipient_phone2 TEXT,
    governorate TEXT NOT NULL DEFAULT 'عمان',
    area TEXT,
    address TEXT,
    package_details TEXT,
    notes TEXT,
    status public.shipment_status NOT NULL DEFAULT 'CREATED',
    payment_type public.payment_type NOT NULL DEFAULT 'COD',
    weight NUMERIC(8, 2) NOT NULL DEFAULT 1.00,
    pieces INTEGER NOT NULL DEFAULT 1,
    barcode TEXT,
    otp TEXT,
    pod_signature_url TEXT,
    pod_image_url TEXT,
    is_fragile BOOLEAN NOT NULL DEFAULT false,
    allow_opening BOOLEAN NOT NULL DEFAULT true,
    delivery_attempts INTEGER NOT NULL DEFAULT 0,
    assigned_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    returned_at TIMESTAMPTZ,
    settlement_status public.settlement_status NOT NULL DEFAULT 'DRAFT',
    merchant_settlement_id UUID,
    driver_settlement_id UUID,

    cod_amount NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    merchant_collection NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    delivery_fee NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    driver_fee NUMERIC(12, 3),
    return_fee NUMERIC(12, 3),
    extra_weight_fee NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    currency TEXT NOT NULL DEFAULT 'JOD',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_shipments_merchant FOREIGN KEY (merchant_id, tenant_id)
        REFERENCES public.users(id, tenant_id) ON DELETE CASCADE,

    CONSTRAINT uq_shipments_composite UNIQUE (id, tenant_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shipments_tenant_sequence ON public.shipments (tenant_id, sequence);
CREATE INDEX IF NOT EXISTS idx_shipments_tenant_status ON public.shipments (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_shipments_merchant ON public.shipments (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipments_driver ON public.shipments (driver_id, status) WHERE driver_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shipments_branch ON public.shipments (branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shipments_barcode ON public.shipments (barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shipments_recipient_phone ON public.shipments (recipient_phone);

CREATE OR REPLACE VIEW public.orders AS
    SELECT * FROM public.shipments;

CREATE OR REPLACE FUNCTION public.orders_view_insert_handler()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.shipments (
        id, tenant_id, sequence, merchant_id, branch_id, driver_id, price_plan_id,
        recipient_name, recipient_phone, recipient_phone2, governorate,
        area, address, package_details, notes, status, payment_type,
        weight, pieces, barcode, otp, pod_signature_url, pod_image_url,
        is_fragile, allow_opening, delivery_attempts, assigned_at,
        delivered_at, returned_at, settlement_status, merchant_settlement_id,
        driver_settlement_id, cod_amount, merchant_collection, delivery_fee,
        driver_fee, return_fee, extra_weight_fee, currency, created_at, updated_at
    ) VALUES (
        COALESCE(NEW.id, gen_random_uuid()), NEW.tenant_id, NEW.sequence, NEW.merchant_id, NEW.branch_id, NEW.driver_id, NEW.price_plan_id,
        NEW.recipient_name, NEW.recipient_phone, NEW.recipient_phone2, COALESCE(NEW.governorate, 'عمان'),
        NEW.area, NEW.address, NEW.package_details, NEW.notes, COALESCE(NEW.status, 'CREATED'), COALESCE(NEW.payment_type, 'COD'),
        COALESCE(NEW.weight, 1.00), COALESCE(NEW.pieces, 1), NEW.barcode, NEW.otp, NEW.pod_signature_url, NEW.pod_image_url,
        COALESCE(NEW.is_fragile, false), COALESCE(NEW.allow_opening, true), COALESCE(NEW.delivery_attempts, 0), NEW.assigned_at,
        NEW.delivered_at, NEW.returned_at, COALESCE(NEW.settlement_status, 'DRAFT'), NEW.merchant_settlement_id,
        NEW.driver_settlement_id, COALESCE(NEW.cod_amount, 0.000), COALESCE(NEW.merchant_collection, 0.000), COALESCE(NEW.delivery_fee, 0.000),
        NEW.driver_fee, NEW.return_fee, COALESCE(NEW.extra_weight_fee, 0.000), COALESCE(NEW.currency, 'JOD'), COALESCE(NEW.created_at, now()), COALESCE(NEW.updated_at, now())
    )
    RETURNING * INTO NEW;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_view_insert ON public.orders;
CREATE TRIGGER trg_orders_view_insert
    INSTEAD OF INSERT ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.orders_view_insert_handler();

CREATE OR REPLACE FUNCTION public.orders_view_update_handler()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.shipments
    SET
        tenant_id = NEW.tenant_id,
        sequence = NEW.sequence,
        merchant_id = NEW.merchant_id,
        branch_id = NEW.branch_id,
        driver_id = NEW.driver_id,
        price_plan_id = NEW.price_plan_id,
        recipient_name = NEW.recipient_name,
        recipient_phone = NEW.recipient_phone,
        recipient_phone2 = NEW.recipient_phone2,
        governorate = NEW.governorate,
        area = NEW.area,
        address = NEW.address,
        package_details = NEW.package_details,
        notes = NEW.notes,
        status = NEW.status,
        payment_type = NEW.payment_type,
        weight = NEW.weight,
        pieces = NEW.pieces,
        barcode = NEW.barcode,
        otp = NEW.otp,
        pod_signature_url = NEW.pod_signature_url,
        pod_image_url = NEW.pod_image_url,
        is_fragile = NEW.is_fragile,
        allow_opening = NEW.allow_opening,
        delivery_attempts = NEW.delivery_attempts,
        assigned_at = NEW.assigned_at,
        delivered_at = NEW.delivered_at,
        returned_at = NEW.returned_at,
        settlement_status = NEW.settlement_status,
        merchant_settlement_id = NEW.merchant_settlement_id,
        driver_settlement_id = NEW.driver_settlement_id,
        cod_amount = NEW.cod_amount,
        merchant_collection = NEW.merchant_collection,
        delivery_fee = NEW.delivery_fee,
        driver_fee = NEW.driver_fee,
        return_fee = NEW.return_fee,
        extra_weight_fee = NEW.extra_weight_fee,
        currency = NEW.currency,
        updated_at = now()
    WHERE id = OLD.id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_view_update ON public.orders;
CREATE TRIGGER trg_orders_view_update
    INSTEAD OF UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.orders_view_update_handler();

CREATE OR REPLACE FUNCTION public.orders_view_delete_handler()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.status NOT IN ('CREATED', 'CANCELLED') THEN
        RAISE EXCEPTION 'Cannot delete order % in status % (Only CREATED or CANCELLED orders without financial postings may be deleted)', 
            OLD.id, OLD.status;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.financial_obligations WHERE shipment_id = OLD.id
    ) OR EXISTS (
        SELECT 1 FROM public.journal_lines WHERE description LIKE '%' || OLD.sequence || '%'
    ) THEN
        RAISE EXCEPTION 'Cannot delete order % with existing financial records', OLD.id;
    END IF;

    DELETE FROM public.shipments WHERE id = OLD.id;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_view_delete ON public.orders;
CREATE TRIGGER trg_orders_view_delete
    INSTEAD OF DELETE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.orders_view_delete_handler();


-- ============================================================================
-- MODULE 09: DELIVERY HISTORY AND DRIVER OPERATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.shipment_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE RESTRICT,
    previous_status public.shipment_status,
    new_status public.shipment_status NOT NULL,
    actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    actor_name TEXT,
    actor_role TEXT,
    notes TEXT,
    location_lat NUMERIC(10, 7),
    location_lng NUMERIC(10, 7),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipment_history_lookup 
    ON public.shipment_status_history (shipment_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_shipment_history_tenant 
    ON public.shipment_status_history (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.driver_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL,
    cash_on_hand NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    current_balance NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    max_cash_limit NUMERIC(12, 3) NOT NULL DEFAULT 150.000,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_driver_wallets_driver FOREIGN KEY (driver_id, tenant_id)
        REFERENCES public.users(id, tenant_id) ON DELETE CASCADE,
    CONSTRAINT uq_driver_wallet UNIQUE (driver_id)
);

CREATE INDEX IF NOT EXISTS idx_driver_wallets_tenant ON public.driver_wallets (tenant_id);


-- ============================================================================
-- MODULE 10: ACCOUNTING CORE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    type public.account_type NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_accounts_tenant_code UNIQUE (tenant_id, code),
    CONSTRAINT uq_accounts_composite UNIQUE (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_accounts_lookup ON public.accounts (tenant_id, type, is_active);

CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    entry_number TEXT NOT NULL,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status public.journal_posting_status NOT NULL DEFAULT 'DRAFT',
    description TEXT,
    reference_type TEXT,
    reference_id TEXT,
    idempotency_key TEXT,
    total_debit NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (total_debit >= 0),
    total_credit NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (total_credit >= 0),
    posted_at TIMESTAMPTZ DEFAULT NULL,
    posted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    is_reversed BOOLEAN NOT NULL DEFAULT false,
    reversal_entry_id UUID REFERENCES public.journal_entries(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_journal_balanced CHECK (total_debit = total_credit),
    CONSTRAINT uq_journal_entries_number UNIQUE (tenant_id, entry_number),
    CONSTRAINT uq_journal_entries_idempotency UNIQUE (tenant_id, idempotency_key),
    CONSTRAINT uq_journal_entries_composite UNIQUE (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_lookup 
    ON public.journal_entries (tenant_id, entry_date DESC, status);
CREATE INDEX IF NOT EXISTS idx_journal_entries_reference 
    ON public.journal_entries (reference_type, reference_id);

CREATE TABLE IF NOT EXISTS public.journal_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE RESTRICT,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
    account_code TEXT NOT NULL,
    debit NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (debit >= 0),
    credit NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (credit >= 0),
    description TEXT,
    merchant_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    driver_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    branch_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_journal_line_single_side CHECK (
        (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)
    ),

    CONSTRAINT fk_journal_lines_entry_composite FOREIGN KEY (journal_entry_id, tenant_id)
        REFERENCES public.journal_entries(id, tenant_id) ON DELETE RESTRICT,

    CONSTRAINT fk_journal_lines_account_composite FOREIGN KEY (account_id, tenant_id)
        REFERENCES public.accounts(id, tenant_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON public.journal_lines (journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON public.journal_lines (tenant_id, account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_journal_lines_merchant ON public.journal_lines (merchant_id) WHERE merchant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_journal_lines_driver ON public.journal_lines (driver_id) WHERE driver_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    voucher_number TEXT NOT NULL,
    type public.voucher_type NOT NULL,
    amount NUMERIC(12, 3) NOT NULL CHECK (amount > 0),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE RESTRICT,
    beneficiary_type TEXT,
    beneficiary_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    beneficiary_name TEXT,
    description TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_vouchers_number UNIQUE (tenant_id, voucher_number)
);

CREATE INDEX IF NOT EXISTS idx_vouchers_lookup ON public.vouchers (tenant_id, type, date DESC);


-- ============================================================================
-- MODULE 11: FINANCIAL OBLIGATIONS REGISTER
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.financial_obligations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    obligation_type public.financial_obligation_type NOT NULL,
    beneficiary_type TEXT NOT NULL,
    beneficiary_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    shipment_id UUID REFERENCES public.shipments(id) ON DELETE RESTRICT,
    order_id UUID,
    shipment_sequence TEXT,
    original_amount NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (original_amount >= 0),
    allocated_amount NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (allocated_amount >= 0),
    remaining_amount NUMERIC(12, 3) GENERATED ALWAYS AS (original_amount - allocated_amount) STORED,
    currency TEXT NOT NULL DEFAULT 'JOD',
    status public.financial_obligation_status NOT NULL DEFAULT 'PENDING',
    due_date DATE,
    idempotency_key TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_obligation_allocation_limit CHECK (allocated_amount <= original_amount),
    CONSTRAINT uq_obligations_idempotency UNIQUE (tenant_id, idempotency_key),
    CONSTRAINT uq_obligations_shipment_type UNIQUE (shipment_id, obligation_type),
    CONSTRAINT uq_obligations_composite UNIQUE (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_obligations_beneficiary 
    ON public.financial_obligations (tenant_id, beneficiary_id, status, obligation_type);
CREATE INDEX IF NOT EXISTS idx_obligations_shipment 
    ON public.financial_obligations (shipment_id);


-- ============================================================================
-- MODULE 12: SETTLEMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.settlement_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    settlement_number TEXT NOT NULL,
    type public.settlement_type NOT NULL,
    beneficiary_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    beneficiary_name TEXT,
    status public.settlement_status NOT NULL DEFAULT 'DRAFT',
    total_amount NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (total_amount >= 0),
    net_payout NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (net_payout >= 0),
    currency TEXT NOT NULL DEFAULT 'JOD',
    payment_method TEXT DEFAULT 'CASH',
    payment_reference TEXT,
    journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    settled_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_settlements_number UNIQUE (tenant_id, settlement_number),
    CONSTRAINT uq_settlements_composite UNIQUE (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_settlements_lookup 
    ON public.settlement_records (tenant_id, beneficiary_id, status, type);

CREATE TABLE IF NOT EXISTS public.settlement_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    settlement_id UUID NOT NULL,
    obligation_id UUID NOT NULL,
    allocated_amount NUMERIC(12, 3) NOT NULL CHECK (allocated_amount > 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_settlement_items_pair UNIQUE (settlement_id, obligation_id),

    CONSTRAINT fk_settlement_items_settlement_composite FOREIGN KEY (settlement_id, tenant_id)
        REFERENCES public.settlement_records(id, tenant_id) ON DELETE RESTRICT,

    CONSTRAINT fk_settlement_items_obligation_composite FOREIGN KEY (obligation_id, tenant_id)
        REFERENCES public.financial_obligations(id, tenant_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_settlement_items_obligation 
    ON public.settlement_items (obligation_id);

CREATE OR REPLACE VIEW public.settlements AS
    SELECT * FROM public.settlement_records;


-- ============================================================================
-- MODULE 13: ACCOUNTING PERIODS, REVERSALS, IDEMPOTENCY
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.accounting_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    period_name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status public.accounting_period_status NOT NULL DEFAULT 'OPEN',
    closed_at TIMESTAMPTZ,
    closed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reopened_at TIMESTAMPTZ,
    reopened_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reopen_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_period_dates CHECK (start_date <= end_date),
    CONSTRAINT uq_accounting_periods_name UNIQUE (tenant_id, period_name),
    CONSTRAINT excl_accounting_periods_range EXCLUDE USING gist (
        tenant_id WITH =,
        (daterange(start_date, end_date, '[]')) WITH &&
    )
);

CREATE INDEX IF NOT EXISTS idx_accounting_periods_range 
    ON public.accounting_periods (tenant_id, start_date, end_date, status);


-- ============================================================================
-- MODULE 14: SUBSCRIPTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    monthly_price_jod NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    annual_price_jod NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    max_users INTEGER NOT NULL DEFAULT 5,
    max_monthly_orders INTEGER NOT NULL DEFAULT 500,
    enabled_modules JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_public BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
    plan_code TEXT NOT NULL,
    plan_name TEXT NOT NULL,
    status public.subscription_status NOT NULL DEFAULT 'ACTIVE',
    start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    end_date TIMESTAMPTZ NOT NULL,
    trial_start_date TIMESTAMPTZ,
    trial_end_date TIMESTAMPTZ,
    price NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    currency TEXT NOT NULL DEFAULT 'JOD',
    billing_cycle public.subscription_billing_cycle NOT NULL DEFAULT 'MONTHLY',
    enabled_modules JSONB NOT NULL DEFAULT '{}'::jsonb,
    max_users INTEGER NOT NULL DEFAULT 5,
    max_monthly_orders INTEGER NOT NULL DEFAULT 500,
    auto_renew BOOLEAN NOT NULL DEFAULT true,
    suspended_reason TEXT,
    grace_period_days INTEGER DEFAULT 7,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_status 
    ON public.subscriptions (tenant_id, status);


-- ============================================================================
-- MODULE 15: ROW LEVEL SECURITY & DEFENSE-IN-DEPTH GRANTS
-- ============================================================================

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revoked_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_branch_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_stock_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_plan_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.audit_logs FROM anon, authenticated, public;
REVOKE ALL ON public.revoked_sessions FROM anon, authenticated, public;
REVOKE ALL ON public.financial_obligations FROM anon, authenticated, public;
REVOKE ALL ON public.settlement_records FROM anon, authenticated, public;
REVOKE ALL ON public.settlement_items FROM anon, authenticated, public;
REVOKE ALL ON public.accounts FROM anon, authenticated, public;
REVOKE ALL ON public.journal_entries FROM anon, authenticated, public;
REVOKE ALL ON public.journal_lines FROM anon, authenticated, public;
REVOKE ALL ON public.vouchers FROM anon, authenticated, public;
REVOKE ALL ON public.accounting_periods FROM anon, authenticated, public;
REVOKE ALL ON public.stock_movements FROM anon, authenticated, public;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

-- Explicitly revoke TRUNCATE on all tables from all roles
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated, public, service_role;

-- Revoke dangerous direct mutation privileges on immutable financial ledgers from all roles
REVOKE TRUNCATE, DELETE, UPDATE ON public.audit_logs FROM service_role;
REVOKE TRUNCATE, DELETE, UPDATE ON public.stock_movements FROM service_role;
REVOKE TRUNCATE, DELETE, UPDATE ON public.shipment_status_history FROM service_role;

-- Explicitly revoke TRUNCATE, DELETE, UPDATE, INSERT on journal tables from service_role
-- (Enforces that journal entries and lines MUST be created/posted via SECURITY DEFINER accounting procedures)
REVOKE TRUNCATE, DELETE, UPDATE, INSERT ON public.journal_entries FROM service_role;
REVOKE TRUNCATE, DELETE, UPDATE, INSERT ON public.journal_lines FROM service_role;

CREATE POLICY service_role_all_tenants ON public.tenants FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_tenant_settings ON public.tenant_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_users ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_user_invitations ON public.user_invitations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_revoked_sessions ON public.revoked_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_audit_logs ON public.audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_merchant_branches ON public.merchant_branches FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_user_branch_access ON public.user_branch_access FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_customers ON public.customers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_products ON public.products FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_branch_inventory ON public.branch_inventory FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_stock_movements ON public.stock_movements FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_stock_transfers ON public.merchant_stock_transfers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_stock_transfer_items ON public.merchant_stock_transfer_items FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_price_plans ON public.price_plans FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_price_plan_rules ON public.price_plan_rules FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_shipments ON public.shipments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_shipment_history ON public.shipment_status_history FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_driver_wallets ON public.driver_wallets FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_accounts ON public.accounts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_journal_entries ON public.journal_entries FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_journal_lines ON public.journal_lines FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_vouchers ON public.vouchers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_financial_obligations ON public.financial_obligations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_settlements ON public.settlement_records FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_settlement_items ON public.settlement_items FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_accounting_periods ON public.accounting_periods FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_subscription_plans ON public.subscription_plans FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_subscriptions ON public.subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ============================================================================
-- MODULE 16: INDEXES AND CONSTRAINTS
-- ============================================================================

DO $$
BEGIN
    -- Shipments -> Merchant Branches (Column-specific SET NULL on branch_id)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_shipments_branch_composite'
    ) THEN
        ALTER TABLE public.shipments
            ADD CONSTRAINT fk_shipments_branch_composite
            FOREIGN KEY (branch_id, merchant_id, tenant_id)
            REFERENCES public.merchant_branches(id, merchant_id, tenant_id)
            ON DELETE SET NULL (branch_id);
    END IF;

    -- Settlement Items -> Settlement Records (Tenant isolated)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_settlement_items_settlement_composite'
    ) THEN
        ALTER TABLE public.settlement_items
            ADD CONSTRAINT fk_settlement_items_settlement_composite
            FOREIGN KEY (settlement_id, tenant_id)
            REFERENCES public.settlement_records(id, tenant_id)
            ON DELETE RESTRICT;
    END IF;

    -- Settlement Items -> Financial Obligations (Tenant isolated)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_settlement_items_obligation_composite'
    ) THEN
        ALTER TABLE public.settlement_items
            ADD CONSTRAINT fk_settlement_items_obligation_composite
            FOREIGN KEY (obligation_id, tenant_id)
            REFERENCES public.financial_obligations(id, tenant_id)
            ON DELETE RESTRICT;
    END IF;

    -- Journal Lines -> Journal Entries Header (Tenant isolated)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_journal_lines_entry_composite'
    ) THEN
        ALTER TABLE public.journal_lines
            ADD CONSTRAINT fk_journal_lines_entry_composite
            FOREIGN KEY (journal_entry_id, tenant_id)
            REFERENCES public.journal_entries(id, tenant_id)
            ON DELETE RESTRICT;
    END IF;

    -- Journal Lines -> Chart of Accounts (Tenant isolated)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_journal_lines_account_composite'
    ) THEN
        ALTER TABLE public.journal_lines
            ADD CONSTRAINT fk_journal_lines_account_composite
            FOREIGN KEY (account_id, tenant_id)
            REFERENCES public.accounts(id, tenant_id)
            ON DELETE RESTRICT;
    END IF;

    -- Financial Obligations -> Beneficiary Users (Tenant isolated)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_obligations_beneficiary_composite'
    ) THEN
        ALTER TABLE public.financial_obligations
            ADD CONSTRAINT fk_obligations_beneficiary_composite
            FOREIGN KEY (beneficiary_id, tenant_id)
            REFERENCES public.users(id, tenant_id)
            ON DELETE RESTRICT;
    END IF;

    -- Financial Obligations -> Shipments (Tenant isolated)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_obligations_shipment_composite'
    ) THEN
        ALTER TABLE public.financial_obligations
            ADD CONSTRAINT fk_obligations_shipment_composite
            FOREIGN KEY (shipment_id, tenant_id)
            REFERENCES public.shipments(id, tenant_id)
            ON DELETE RESTRICT;
    END IF;

    -- Settlement Records -> Beneficiary Users (Tenant isolated)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_settlements_beneficiary_composite'
    ) THEN
        ALTER TABLE public.settlement_records
            ADD CONSTRAINT fk_settlements_beneficiary_composite
            FOREIGN KEY (beneficiary_id, tenant_id)
            REFERENCES public.users(id, tenant_id)
            ON DELETE RESTRICT;
    END IF;

    -- Settlement Records -> Journal Entries (Tenant isolated)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_settlements_journal_composite'
    ) THEN
        ALTER TABLE public.settlement_records
            ADD CONSTRAINT fk_settlements_journal_composite
            FOREIGN KEY (journal_entry_id, tenant_id)
            REFERENCES public.journal_entries(id, tenant_id)
            ON DELETE SET NULL (journal_entry_id);
    END IF;

    -- Journal Lines -> Merchant User (Tenant isolated)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_journal_lines_merchant_composite'
    ) THEN
        ALTER TABLE public.journal_lines
            ADD CONSTRAINT fk_journal_lines_merchant_composite
            FOREIGN KEY (merchant_id, tenant_id)
            REFERENCES public.users(id, tenant_id)
            ON DELETE SET NULL (merchant_id);
    END IF;

    -- Journal Lines -> Driver User (Tenant isolated)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_journal_lines_driver_composite'
    ) THEN
        ALTER TABLE public.journal_lines
            ADD CONSTRAINT fk_journal_lines_driver_composite
            FOREIGN KEY (driver_id, tenant_id)
            REFERENCES public.users(id, tenant_id)
            ON DELETE SET NULL (driver_id);
    END IF;

    -- Journal Lines -> Branch (Tenant isolated)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_journal_lines_branch_composite'
    ) THEN
        ALTER TABLE public.journal_lines
            ADD CONSTRAINT fk_journal_lines_branch_composite
            FOREIGN KEY (branch_id, tenant_id)
            REFERENCES public.merchant_branches(id, tenant_id)
            ON DELETE SET NULL (branch_id);
    END IF;

    -- Users -> Price Plans (Tenant isolated)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_price_plan_composite'
    ) THEN
        ALTER TABLE public.users
            ADD CONSTRAINT fk_users_price_plan_composite
            FOREIGN KEY (price_plan_id, tenant_id)
            REFERENCES public.price_plans(id, tenant_id)
            ON DELETE SET NULL (price_plan_id);
    END IF;

    -- User Invitations -> Price Plans (Tenant isolated)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_invitations_price_plan_composite'
    ) THEN
        ALTER TABLE public.user_invitations
            ADD CONSTRAINT fk_user_invitations_price_plan_composite
            FOREIGN KEY (price_plan_id, tenant_id)
            REFERENCES public.price_plans(id, tenant_id)
            ON DELETE SET NULL (price_plan_id);
    END IF;

    -- Price Plan Rules -> Price Plans (Tenant isolated)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_price_plan_rules_plan_composite'
    ) THEN
        ALTER TABLE public.price_plan_rules
            ADD CONSTRAINT fk_price_plan_rules_plan_composite
            FOREIGN KEY (price_plan_id, tenant_id)
            REFERENCES public.price_plans(id, tenant_id)
            ON DELETE CASCADE;
    END IF;

    -- Shipments -> Price Plans (Tenant isolated, RESTRICT physical delete to preserve historical snapshot auditability)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_shipments_price_plan_composite'
    ) THEN
        ALTER TABLE public.shipments
            ADD CONSTRAINT fk_shipments_price_plan_composite
            FOREIGN KEY (price_plan_id, tenant_id)
            REFERENCES public.price_plans(id, tenant_id)
            ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_shipments_dispatch_query 
    ON public.shipments (tenant_id, status, governorate, assigned_at);

CREATE INDEX IF NOT EXISTS idx_shipments_merchant_status 
    ON public.shipments (tenant_id, merchant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shipments_driver_active 
    ON public.shipments (tenant_id, driver_id, status) 
    WHERE status IN ('IN_TRANSIT', 'OUT_FOR_DELIVERY', 'PICKED_UP');

CREATE INDEX IF NOT EXISTS idx_financial_obligations_unsettled 
    ON public.financial_obligations (tenant_id, beneficiary_id, status) 
    WHERE status IN ('PENDING', 'PARTIALLY_SETTLED');

CREATE INDEX IF NOT EXISTS idx_settlements_pending_approval 
    ON public.settlement_records (tenant_id, status) 
    WHERE status IN ('DRAFT', 'SUBMITTED');

CREATE INDEX IF NOT EXISTS idx_journal_lines_posting_report 
    ON public.journal_lines (tenant_id, account_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_tenant_search 
    ON public.users (tenant_id, role, is_active, name);


-- ============================================================================
-- MODULE 17: FUNCTIONS AND TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_journal_posting_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_total_debit NUMERIC(12, 3);
    v_total_credit NUMERIC(12, 3);
    v_lines_count INT;
BEGIN
    IF NEW.status = 'POSTED' THEN
        SELECT 
            COALESCE(SUM(debit), 0.000),
            COALESCE(SUM(credit), 0.000),
            COUNT(*)
        INTO v_total_debit, v_total_credit, v_lines_count
        FROM public.journal_lines
        WHERE journal_entry_id = NEW.id;

        IF v_lines_count < 2 THEN
            RAISE EXCEPTION 'Journal entry % must have at least 2 lines to be posted (Current lines: %)', 
                NEW.id, v_lines_count;
        END IF;

        IF v_total_debit <= 0 OR v_total_credit <= 0 THEN
            RAISE EXCEPTION 'Journal entry % must have positive debit and credit totals', NEW.id;
        END IF;

        IF v_total_debit <> v_total_credit THEN
            RAISE EXCEPTION 'Journal entry % is unbalanced: Total Debit (%), Total Credit (%)',
                NEW.id, v_total_debit, v_total_credit;
        END IF;

        NEW.total_debit := v_total_debit;
        NEW.total_credit := v_total_credit;
        NEW.posted_at := COALESCE(NEW.posted_at, now());
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_journal_posting_balance ON public.journal_entries;
CREATE TRIGGER trg_check_journal_posting_balance
    BEFORE INSERT OR UPDATE ON public.journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.check_journal_posting_balance();

CREATE OR REPLACE FUNCTION public.prevent_posted_journal_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'DELETE' AND OLD.status IN ('POSTED', 'REVERSED') THEN
        RAISE EXCEPTION 'Cannot delete posted/reversed journal entry % (Immutable Financial Record)', OLD.id;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.status = 'POSTED' THEN
        -- Allow authorized reversal transition ONLY when linked to an existing, valid, posted reversal journal entry
        IF (NEW.entry_number = OLD.entry_number AND 
            NEW.total_debit = OLD.total_debit AND 
            NEW.total_credit = OLD.total_credit AND
            NEW.entry_date = OLD.entry_date AND
            NEW.tenant_id = OLD.tenant_id AND
            NEW.created_at = OLD.created_at AND
            OLD.is_reversed = false AND
            NEW.is_reversed = true AND
            NEW.reversal_entry_id IS NOT NULL AND
            NEW.status = 'REVERSED') THEN

            -- Validate that the referenced reversal journal entry exists, is POSTED, belongs to the same tenant,
            -- and is explicitly designated as the reversal of this entry
            IF NOT EXISTS (
                SELECT 1 FROM public.journal_entries r
                WHERE r.id = NEW.reversal_entry_id
                  AND r.tenant_id = OLD.tenant_id
                  AND r.status = 'POSTED'
                  AND r.reference_type = 'JOURNAL_REVERSAL'
                  AND r.reference_id = OLD.id::TEXT
                  AND r.total_debit = OLD.total_debit
                  AND r.total_credit = OLD.total_credit
            ) THEN
                RAISE EXCEPTION 'Invalid journal reversal: Reversal entry % does not exist as a posted reversal for %', 
                    NEW.reversal_entry_id, OLD.id;
            END IF;

            RETURN NEW;
        END IF;

        RAISE EXCEPTION 'Cannot modify posted journal entry % (Immutable Financial Record). Controlled reversals must be executed via public.execute_journal_reversal().', OLD.id;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.status = 'REVERSED' THEN
        RAISE EXCEPTION 'Cannot modify reversed journal entry % (Immutable Financial Record)', OLD.id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_posted_journal_mutation ON public.journal_entries;
CREATE TRIGGER trg_prevent_posted_journal_mutation
    BEFORE UPDATE OR DELETE ON public.journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_posted_journal_mutation();

CREATE OR REPLACE FUNCTION public.prevent_posted_journal_lines_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_journal_status public.journal_posting_status;
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        SELECT status INTO v_journal_status FROM public.journal_entries WHERE id = OLD.journal_entry_id;
        IF v_journal_status = 'POSTED' THEN
            RAISE EXCEPTION 'Cannot mutate lines of posted journal entry % (Immutable Financial Record)', OLD.journal_entry_id;
        END IF;
    END IF;

    IF TG_OP = 'INSERT' THEN
        SELECT status INTO v_journal_status FROM public.journal_entries WHERE id = NEW.journal_entry_id;
        IF v_journal_status = 'POSTED' THEN
            RAISE EXCEPTION 'Cannot add lines to already posted journal entry %', NEW.journal_entry_id;
        END IF;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_posted_journal_lines_mutation ON public.journal_lines;
CREATE TRIGGER trg_prevent_posted_journal_lines_mutation
    BEFORE INSERT OR UPDATE OR DELETE ON public.journal_lines
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_posted_journal_lines_mutation();

CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs is an immutable audit trail and cannot be updated or deleted';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_mutation ON public.audit_logs;
CREATE TRIGGER trg_prevent_audit_log_mutation
    BEFORE UPDATE OR DELETE ON public.audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_audit_log_mutation();

CREATE OR REPLACE FUNCTION public.prevent_stock_movement_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'stock_movements is an immutable ledger and cannot be updated or deleted. Use compensating movements instead.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_stock_movement_mutation ON public.stock_movements;
CREATE TRIGGER trg_prevent_stock_movement_mutation
    BEFORE UPDATE OR DELETE ON public.stock_movements
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_stock_movement_mutation();

CREATE OR REPLACE FUNCTION public.prevent_shipment_history_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'shipment_status_history is an immutable audit trail and cannot be updated or deleted';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_shipment_history_mutation ON public.shipment_status_history;
CREATE TRIGGER trg_prevent_shipment_history_mutation
    BEFORE UPDATE OR DELETE ON public.shipment_status_history
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_shipment_history_mutation();

CREATE OR REPLACE FUNCTION public.protect_shipment_financial_snapshots()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF OLD.status IN ('DELIVERED', 'RETURNED') OR OLD.settlement_status <> 'DRAFT' THEN
        IF (NEW.cod_amount IS DISTINCT FROM OLD.cod_amount OR 
            NEW.merchant_collection IS DISTINCT FROM OLD.merchant_collection OR 
            NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee OR 
            NEW.driver_fee IS DISTINCT FROM OLD.driver_fee OR 
            NEW.return_fee IS DISTINCT FROM OLD.return_fee OR 
            NEW.currency IS DISTINCT FROM OLD.currency) THEN
            RAISE EXCEPTION 'Cannot alter financial snapshots on shipment % in status % / settlement status % (Immutable Financial Record)', 
                OLD.id, OLD.status, OLD.settlement_status;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_shipment_financial_snapshots ON public.shipments;
CREATE TRIGGER trg_protect_shipment_financial_snapshots
    BEFORE UPDATE ON public.shipments
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_shipment_financial_snapshots();

CREATE OR REPLACE FUNCTION public.validate_settlement_item_beneficiary()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec RECORD;
    v_ob RECORD;
BEGIN
    SELECT tenant_id, beneficiary_id INTO v_rec
    FROM public.settlement_records
    WHERE id = NEW.settlement_id;

    SELECT tenant_id, beneficiary_id INTO v_ob
    FROM public.financial_obligations
    WHERE id = NEW.obligation_id;

    IF v_rec.tenant_id IS DISTINCT FROM v_ob.tenant_id THEN
        RAISE EXCEPTION 'Cross-tenant settlement allocation rejected: Settlement tenant (%) vs Obligation tenant (%)',
            v_rec.tenant_id, v_ob.tenant_id;
    END IF;

    IF v_rec.beneficiary_id IS DISTINCT FROM v_ob.beneficiary_id THEN
        RAISE EXCEPTION 'Beneficiary mismatch: Obligation % belongs to user %, but settlement % is for user %',
            NEW.obligation_id, v_ob.beneficiary_id, NEW.settlement_id, v_rec.beneficiary_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_settlement_item_beneficiary ON public.settlement_items;
CREATE TRIGGER trg_validate_settlement_item_beneficiary
    BEFORE INSERT OR UPDATE ON public.settlement_items
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_settlement_item_beneficiary();

CREATE OR REPLACE FUNCTION public.enforce_settlement_allocation_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_orig_amt NUMERIC(12, 3);
    v_existing_alloc NUMERIC(12, 3);
    v_new_total NUMERIC(12, 3);
BEGIN
    -- Acquire exclusive row lock on the target financial obligation
    SELECT original_amount INTO v_orig_amt
    FROM public.financial_obligations
    WHERE id = NEW.obligation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Financial obligation % not found', NEW.obligation_id;
    END IF;

    -- Calculate current active allocated total excluding the current item if updating
    SELECT COALESCE(SUM(si.allocated_amount), 0.000)
    INTO v_existing_alloc
    FROM public.settlement_items si
    JOIN public.settlement_records sr ON sr.id = si.settlement_id
    WHERE si.obligation_id = NEW.obligation_id
      AND sr.status <> 'CANCELLED'
      AND (TG_OP = 'INSERT' OR si.id <> OLD.id);

    v_new_total := v_existing_alloc + NEW.allocated_amount;

    IF v_new_total > v_orig_amt THEN
        RAISE EXCEPTION 'Allocation cap exceeded for obligation %: Requested total (%), Original amount (%)',
            NEW.obligation_id, v_new_total, v_orig_amt;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_settlement_allocation_cap ON public.settlement_items;
CREATE TRIGGER trg_enforce_settlement_allocation_cap
    BEFORE INSERT OR UPDATE ON public.settlement_items
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_settlement_allocation_cap();

CREATE OR REPLACE FUNCTION public.recalculate_obligation_allocated_amount(p_obligation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_orig NUMERIC(12, 3);
    v_alloc NUMERIC(12, 3);
    v_new_status public.financial_obligation_status;
BEGIN
    SELECT original_amount INTO v_orig
    FROM public.financial_obligations
    WHERE id = p_obligation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    SELECT COALESCE(SUM(si.allocated_amount), 0.000)
    INTO v_alloc
    FROM public.settlement_items si
    JOIN public.settlement_records sr ON sr.id = si.settlement_id
    WHERE si.obligation_id = p_obligation_id
      AND sr.status <> 'CANCELLED';

    IF v_alloc = 0 THEN
        v_new_status := 'PENDING';
    ELSIF v_alloc >= v_orig THEN
        v_new_status := 'SETTLED';
    ELSE
        v_new_status := 'PARTIALLY_SETTLED';
    END IF;

    UPDATE public.financial_obligations
    SET 
        allocated_amount = v_alloc,
        status = v_new_status,
        updated_at = now()
    WHERE id = p_obligation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_settlement_item_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        PERFORM public.recalculate_obligation_allocated_amount(NEW.obligation_id);
    END IF;
    IF TG_OP IN ('DELETE', 'UPDATE') THEN
        PERFORM public.recalculate_obligation_allocated_amount(OLD.obligation_id);
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_obligation_on_item_mutation ON public.settlement_items;
CREATE TRIGGER trg_recalc_obligation_on_item_mutation
    AFTER INSERT OR UPDATE OR DELETE ON public.settlement_items
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_settlement_item_mutation();

CREATE OR REPLACE FUNCTION public.handle_settlement_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    r RECORD;
BEGIN
    IF OLD.status <> NEW.status THEN
        FOR r IN SELECT DISTINCT obligation_id FROM public.settlement_items WHERE settlement_id = NEW.id LOOP
            PERFORM public.recalculate_obligation_allocated_amount(r.obligation_id);
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_obligation_on_settlement_status ON public.settlement_records;
CREATE TRIGGER trg_recalc_obligation_on_settlement_status
    AFTER UPDATE OF status ON public.settlement_records
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_settlement_status_change();

-- 11b. Settlement Header Immutability Trigger
CREATE OR REPLACE FUNCTION public.protect_settlement_record_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Prevent DELETE on non-DRAFT settlements
    IF TG_OP = 'DELETE' THEN
        IF OLD.status <> 'DRAFT' THEN
            RAISE EXCEPTION 'Cannot delete settlement % in % status (Only DRAFT settlements can be deleted)',
                OLD.settlement_number, OLD.status;
        END IF;
        RETURN OLD;
    END IF;

    -- If OLD.status is CANCELLED, settlement is terminal and completely immutable
    IF OLD.status = 'CANCELLED' THEN
        RAISE EXCEPTION 'Settlement % is CANCELLED and cannot be modified', OLD.settlement_number;
    END IF;

    -- If OLD.status is APPROVED or SETTLED, financial attributes are strictly immutable
    IF OLD.status IN ('APPROVED', 'SETTLED') THEN
        IF OLD.total_amount IS DISTINCT FROM NEW.total_amount OR
           OLD.net_payout IS DISTINCT FROM NEW.net_payout OR
           OLD.type IS DISTINCT FROM NEW.type OR
           OLD.beneficiary_id IS DISTINCT FROM NEW.beneficiary_id OR
           OLD.tenant_id IS DISTINCT FROM NEW.tenant_id OR
           OLD.currency IS DISTINCT FROM NEW.currency OR
           OLD.settlement_number IS DISTINCT FROM NEW.settlement_number THEN
            RAISE EXCEPTION 'Financial fields of settlement % in % status are immutable (total_amount, net_payout, type, beneficiary, tenant, currency, number)',
                OLD.settlement_number, OLD.status;
        END IF;

        -- Validate allowed status transitions
        IF OLD.status = 'APPROVED' AND NEW.status NOT IN ('APPROVED', 'SETTLED', 'CANCELLED') THEN
            RAISE EXCEPTION 'Invalid status transition for settlement % from APPROVED to % (Allowed: SETTLED, CANCELLED)',
                OLD.settlement_number, NEW.status;
        END IF;

        IF OLD.status = 'SETTLED' THEN
            IF NEW.status NOT IN ('SETTLED', 'CANCELLED') THEN
                RAISE EXCEPTION 'Invalid status transition for settlement % from SETTLED to % (Allowed: CANCELLED)',
                    OLD.settlement_number, NEW.status;
            END IF;

            -- Enforce that any linked journal entry must be reversed before cancellation
            IF NEW.status = 'CANCELLED' AND OLD.journal_entry_id IS NOT NULL THEN
                IF NOT EXISTS (
                    SELECT 1 FROM public.journal_entries je
                    WHERE je.id = OLD.journal_entry_id
                      AND je.status = 'REVERSED'
                ) THEN
                    RAISE EXCEPTION 'Cannot cancel SETTLED settlement %: Associated journal entry % is not reversed. Controlled reversal must be executed via public.execute_journal_reversal() first.',
                        OLD.settlement_number, OLD.journal_entry_id;
                END IF;
            END IF;
        END IF;
    END IF;

    -- Disallow invalid transitions out of SUBMITTED or DRAFT
    IF OLD.status = 'SUBMITTED' AND NEW.status NOT IN ('SUBMITTED', 'DRAFT', 'APPROVED', 'CANCELLED') THEN
        RAISE EXCEPTION 'Invalid status transition for settlement % from SUBMITTED to %',
            OLD.settlement_number, NEW.status;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_settlement_record_immutability ON public.settlement_records;
CREATE TRIGGER trg_protect_settlement_record_immutability
    BEFORE UPDATE OR DELETE ON public.settlement_records
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_settlement_record_immutability();

-- 11c. Settlement Items Immutability Trigger
CREATE OR REPLACE FUNCTION public.protect_settlement_items_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_settle_status public.settlement_status;
    v_settle_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_settle_id := OLD.settlement_id;
    ELSE
        v_settle_id := NEW.settlement_id;
    END IF;

    SELECT status INTO v_settle_status
    FROM public.settlement_records
    WHERE id = v_settle_id;

    IF v_settle_status IN ('APPROVED', 'SETTLED', 'CANCELLED') THEN
        RAISE EXCEPTION 'Cannot % settlement item for settlement % in % status (Settlement items are immutable once approved, settled, or cancelled)',
            TG_OP, v_settle_id, v_settle_status;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_settlement_items_immutability ON public.settlement_items;
CREATE TRIGGER trg_protect_settlement_items_immutability
    BEFORE INSERT OR UPDATE OR DELETE ON public.settlement_items
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_settlement_items_immutability();

-- 11d. Financial Obligations Mutation Protection Trigger
CREATE OR REPLACE FUNCTION public.protect_financial_obligation_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.allocated_amount > 0 OR OLD.status IN ('PARTIALLY_SETTLED', 'SETTLED') THEN
            RAISE EXCEPTION 'Cannot delete financial obligation % with active allocations (status: %, allocated: %)',
                OLD.id, OLD.status, OLD.allocated_amount;
        END IF;
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.allocated_amount > 0 OR OLD.status IN ('PARTIALLY_SETTLED', 'SETTLED') THEN
            IF OLD.original_amount IS DISTINCT FROM NEW.original_amount OR
               OLD.beneficiary_id IS DISTINCT FROM NEW.beneficiary_id OR
               OLD.beneficiary_type IS DISTINCT FROM NEW.beneficiary_type OR
               OLD.tenant_id IS DISTINCT FROM NEW.tenant_id OR
               OLD.obligation_type IS DISTINCT FROM NEW.obligation_type OR
               OLD.shipment_id IS DISTINCT FROM NEW.shipment_id THEN
                RAISE EXCEPTION 'Cannot modify core attributes of allocated financial obligation % (original_amount, beneficiary, type, shipment)',
                    OLD.id;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_financial_obligation_immutability ON public.financial_obligations;
CREATE TRIGGER trg_protect_financial_obligation_immutability
    BEFORE UPDATE OR DELETE ON public.financial_obligations
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_financial_obligation_immutability();

CREATE OR REPLACE FUNCTION public.check_journal_entry_period_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_period_status public.accounting_period_status;
    v_period_name TEXT;
BEGIN
    SELECT status, period_name INTO v_period_status, v_period_name
    FROM public.accounting_periods
    WHERE tenant_id = NEW.tenant_id
      AND NEW.entry_date BETWEEN start_date AND end_date
    LIMIT 1;

    IF v_period_status = 'CLOSED' THEN
        RAISE EXCEPTION 'Accounting period "%" is closed. Cannot create or alter entries on %',
            v_period_name, NEW.entry_date;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_journal_entry_period_lock ON public.journal_entries;
CREATE TRIGGER trg_journal_entry_period_lock
    BEFORE INSERT OR UPDATE ON public.journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.check_journal_entry_period_lock();

-- Database-Level Prevention of Overlapping Accounting Periods per Tenant
CREATE OR REPLACE FUNCTION public.check_accounting_period_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.start_date > NEW.end_date THEN
        RAISE EXCEPTION 'start_date (%) must be less than or equal to end_date (%)', NEW.start_date, NEW.end_date;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.accounting_periods
        WHERE tenant_id = NEW.tenant_id
          AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
          AND (start_date, end_date) OVERLAPS (NEW.start_date, NEW.end_date)
    ) THEN
        RAISE EXCEPTION 'Accounting period date range % to % overlaps with an existing accounting period for tenant %',
            NEW.start_date, NEW.end_date, NEW.tenant_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounting_period_overlap ON public.accounting_periods;
CREATE TRIGGER trg_accounting_period_overlap
    BEFORE INSERT OR UPDATE ON public.accounting_periods
    FOR EACH ROW
    EXECUTE FUNCTION public.check_accounting_period_overlap();

CREATE OR REPLACE FUNCTION public.execute_stock_transfer_completion(
    p_transfer_id UUID,
    p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_transfer RECORD;
    v_item RECORD;
    v_items_count INT;
    v_src_qty INT;
    v_dest_qty INT;
BEGIN
    -- 1. Lock transfer header
    SELECT * INTO v_transfer
    FROM public.merchant_stock_transfers
    WHERE id = p_transfer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Stock transfer % not found', p_transfer_id;
    END IF;

    IF v_transfer.status <> 'PENDING' AND v_transfer.status <> 'IN_TRANSIT' THEN
        RAISE EXCEPTION 'Transfer % is not in a completable state (current: %)', p_transfer_id, v_transfer.status;
    END IF;

    -- Count authoritative items
    SELECT COUNT(*) INTO v_items_count
    FROM public.merchant_stock_transfer_items
    WHERE transfer_id = p_transfer_id;

    IF v_items_count = 0 THEN
        RAISE EXCEPTION 'Transfer % contains no items to transfer', p_transfer_id;
    END IF;

    -- 2. Deterministically lock and validate source inventory for all items
    FOR v_item IN 
        SELECT product_id, quantity, unit_cost 
        FROM public.merchant_stock_transfer_items 
        WHERE transfer_id = p_transfer_id 
        ORDER BY product_id 
    LOOP
        SELECT quantity INTO v_src_qty
        FROM public.branch_inventory
        WHERE branch_id = v_transfer.source_branch_id AND product_id = v_item.product_id
        FOR UPDATE;

        IF v_src_qty IS NULL OR v_src_qty < v_item.quantity THEN
            RAISE EXCEPTION 'Insufficient stock at source branch for product %: Available (%), Required (%)',
                v_item.product_id, COALESCE(v_src_qty, 0), v_item.quantity;
        END IF;
    END LOOP;

    -- 3. Execute inventory updates and write immutable stock ledger movements for every item
    FOR v_item IN 
        SELECT product_id, quantity, unit_cost 
        FROM public.merchant_stock_transfer_items 
        WHERE transfer_id = p_transfer_id 
        ORDER BY product_id 
    LOOP
        SELECT quantity INTO v_src_qty
        FROM public.branch_inventory
        WHERE branch_id = v_transfer.source_branch_id AND product_id = v_item.product_id;

        UPDATE public.branch_inventory
        SET quantity = quantity - v_item.quantity, updated_at = now()
        WHERE branch_id = v_transfer.source_branch_id AND product_id = v_item.product_id;

        INSERT INTO public.stock_movements (
            tenant_id, merchant_id, branch_id, product_id,
            movement_type, quantity, balance_before, balance_after,
            unit_cost, reference_type, reference_id, performed_by, notes
        ) VALUES (
            v_transfer.tenant_id, v_transfer.merchant_id, v_transfer.source_branch_id, v_item.product_id,
            'TRANSFER_OUT', -v_item.quantity, v_src_qty, v_src_qty - v_item.quantity,
            COALESCE(v_item.unit_cost, 0.000), 'STOCK_TRANSFER', p_transfer_id::TEXT, p_actor_id,
            'Multi-item stock transfer outbound: ' || COALESCE(v_transfer.transfer_number, p_transfer_id::TEXT)
        );

        SELECT quantity INTO v_dest_qty
        FROM public.branch_inventory
        WHERE branch_id = v_transfer.destination_branch_id AND product_id = v_item.product_id
        FOR UPDATE;

        IF FOUND THEN
            UPDATE public.branch_inventory
            SET quantity = quantity + v_item.quantity, updated_at = now()
            WHERE branch_id = v_transfer.destination_branch_id AND product_id = v_item.product_id;

            INSERT INTO public.stock_movements (
                tenant_id, merchant_id, branch_id, product_id,
                movement_type, quantity, balance_before, balance_after,
                unit_cost, reference_type, reference_id, performed_by, notes
            ) VALUES (
                v_transfer.tenant_id, v_transfer.merchant_id, v_transfer.destination_branch_id, v_item.product_id,
                'TRANSFER_IN', v_item.quantity, v_dest_qty, v_dest_qty + v_item.quantity,
                COALESCE(v_item.unit_cost, 0.000), 'STOCK_TRANSFER', p_transfer_id::TEXT, p_actor_id,
                'Multi-item stock transfer inbound: ' || COALESCE(v_transfer.transfer_number, p_transfer_id::TEXT)
            );
        ELSE
            INSERT INTO public.branch_inventory (
                tenant_id, merchant_id, branch_id, product_id, quantity, updated_at
            ) VALUES (
                v_transfer.tenant_id, v_transfer.merchant_id, v_transfer.destination_branch_id, v_item.product_id,
                v_item.quantity, now()
            );

            INSERT INTO public.stock_movements (
                tenant_id, merchant_id, branch_id, product_id,
                movement_type, quantity, balance_before, balance_after,
                unit_cost, reference_type, reference_id, performed_by, notes
            ) VALUES (
                v_transfer.tenant_id, v_transfer.merchant_id, v_transfer.destination_branch_id, v_item.product_id,
                'TRANSFER_IN', v_item.quantity, 0, v_item.quantity,
                COALESCE(v_item.unit_cost, 0.000), 'STOCK_TRANSFER', p_transfer_id::TEXT, p_actor_id,
                'Multi-item stock transfer inbound (initial stock): ' || COALESCE(v_transfer.transfer_number, p_transfer_id::TEXT)
            );
        END IF;
    END LOOP;

    -- 4. Mark transfer completed only after every item succeeds
    UPDATE public.merchant_stock_transfers
    SET status = 'COMPLETED', received_by = p_actor_id, updated_at = now()
    WHERE id = p_transfer_id;

    RETURN jsonb_build_object('success', true, 'transfer_id', p_transfer_id, 'items_count', v_items_count, 'status', 'COMPLETED');
END;
$$;

CREATE OR REPLACE FUNCTION public.execute_stock_transfer_reversal(
    p_transfer_id UUID,
    p_actor_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_transfer RECORD;
    v_item RECORD;
    v_dest_qty INT;
    v_src_qty INT;
BEGIN
    SELECT * INTO v_transfer
    FROM public.merchant_stock_transfers
    WHERE id = p_transfer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Stock transfer % not found', p_transfer_id;
    END IF;

    IF v_transfer.status <> 'COMPLETED' THEN
        RAISE EXCEPTION 'Only COMPLETED stock transfers can be reversed (Current: %)', v_transfer.status;
    END IF;

    -- Validate destination branch has enough stock to return to source for all items
    FOR v_item IN 
        SELECT product_id, quantity, unit_cost 
        FROM public.merchant_stock_transfer_items 
        WHERE transfer_id = p_transfer_id 
        ORDER BY product_id 
    LOOP
        SELECT quantity INTO v_dest_qty
        FROM public.branch_inventory
        WHERE branch_id = v_transfer.destination_branch_id AND product_id = v_item.product_id
        FOR UPDATE;

        IF v_dest_qty IS NULL OR v_dest_qty < v_item.quantity THEN
            RAISE EXCEPTION 'Cannot reverse transfer %: Destination branch has insufficient stock for product % (Available: %, Needed: %)',
                p_transfer_id, v_item.product_id, COALESCE(v_dest_qty, 0), v_item.quantity;
        END IF;
    END LOOP;

    -- Revert inventory balances and log compensating REVERSAL movements
    FOR v_item IN 
        SELECT product_id, quantity, unit_cost 
        FROM public.merchant_stock_transfer_items 
        WHERE transfer_id = p_transfer_id 
        ORDER BY product_id 
    LOOP
        SELECT quantity INTO v_dest_qty
        FROM public.branch_inventory
        WHERE branch_id = v_transfer.destination_branch_id AND product_id = v_item.product_id;

        UPDATE public.branch_inventory
        SET quantity = quantity - v_item.quantity, updated_at = now()
        WHERE branch_id = v_transfer.destination_branch_id AND product_id = v_item.product_id;

        INSERT INTO public.stock_movements (
            tenant_id, merchant_id, branch_id, product_id,
            movement_type, quantity, balance_before, balance_after,
            unit_cost, reference_type, reference_id, performed_by, notes
        ) VALUES (
            v_transfer.tenant_id, v_transfer.merchant_id, v_transfer.destination_branch_id, v_item.product_id,
            'REVERSAL', -v_item.quantity, v_dest_qty, v_dest_qty - v_item.quantity,
            COALESCE(v_item.unit_cost, 0.000), 'STOCK_TRANSFER_REVERSAL', p_transfer_id::TEXT, p_actor_id,
            'Transfer reversal return: ' || COALESCE(p_reason, '')
        );

        SELECT quantity INTO v_src_qty
        FROM public.branch_inventory
        WHERE branch_id = v_transfer.source_branch_id AND product_id = v_item.product_id
        FOR UPDATE;

        UPDATE public.branch_inventory
        SET quantity = quantity + v_item.quantity, updated_at = now()
        WHERE branch_id = v_transfer.source_branch_id AND product_id = v_item.product_id;

        INSERT INTO public.stock_movements (
            tenant_id, merchant_id, branch_id, product_id,
            movement_type, quantity, balance_before, balance_after,
            unit_cost, reference_type, reference_id, performed_by, notes
        ) VALUES (
            v_transfer.tenant_id, v_transfer.merchant_id, v_transfer.source_branch_id, v_item.product_id,
            'REVERSAL', v_item.quantity, v_src_qty, v_src_qty + v_item.quantity,
            COALESCE(v_item.unit_cost, 0.000), 'STOCK_TRANSFER_REVERSAL', p_transfer_id::TEXT, p_actor_id,
            'Transfer reversal restock: ' || COALESCE(p_reason, '')
        );
    END LOOP;

    UPDATE public.merchant_stock_transfers
    SET status = 'CANCELLED', notes = COALESCE(notes, '') || ' [REVERSED: ' || COALESCE(p_reason, '') || ']', updated_at = now()
    WHERE id = p_transfer_id;

    RETURN jsonb_build_object('success', true, 'transfer_id', p_transfer_id, 'status', 'CANCELLED');
END;
$$;

CREATE OR REPLACE FUNCTION public.execute_journal_reversal(
    p_original_entry_id UUID,
    p_actor_id UUID,
    p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_orig RECORD;
    v_new_entry_id UUID;
    v_reversal_number TEXT;
    line RECORD;
BEGIN
    SELECT * INTO v_orig
    FROM public.journal_entries
    WHERE id = p_original_entry_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Original journal entry % not found', p_original_entry_id;
    END IF;

    IF v_orig.status <> 'POSTED' THEN
        RAISE EXCEPTION 'Only POSTED journal entries can be reversed (Current: %)', v_orig.status;
    END IF;

    IF v_orig.is_reversed THEN
        RAISE EXCEPTION 'Journal entry % has already been reversed', p_original_entry_id;
    END IF;

    v_new_entry_id := gen_random_uuid();
    v_reversal_number := v_orig.entry_number || '-REV';

    INSERT INTO public.journal_entries (
        id, tenant_id, entry_number, entry_date, status,
        description, reference_type, reference_id,
        total_debit, total_credit, posted_at, posted_by,
        is_reversed, created_at, updated_at
    ) VALUES (
        v_new_entry_id, v_orig.tenant_id, v_reversal_number, CURRENT_DATE, 'DRAFT',
        'Reversal of ' || v_orig.entry_number || ': ' || COALESCE(p_reason, ''),
        'JOURNAL_REVERSAL', p_original_entry_id::TEXT,
        0.000, 0.000, NULL, p_actor_id,
        false, now(), now()
    );

    FOR line IN SELECT * FROM public.journal_lines WHERE journal_entry_id = p_original_entry_id LOOP
        INSERT INTO public.journal_lines (
            tenant_id, journal_entry_id, account_id, account_code,
            debit, credit, description, merchant_id, driver_id, branch_id
        ) VALUES (
            line.tenant_id, v_new_entry_id, line.account_id, line.account_code,
            line.credit, line.debit,
            'Reversal: ' || COALESCE(line.description, ''),
            line.merchant_id, line.driver_id, line.branch_id
        );
    END LOOP;

    UPDATE public.journal_entries
    SET status = 'POSTED', posted_by = p_actor_id, updated_at = now()
    WHERE id = v_new_entry_id;

    UPDATE public.journal_entries
    SET status = 'REVERSED', is_reversed = true, reversal_entry_id = v_new_entry_id, updated_at = now()
    WHERE id = p_original_entry_id;

    RETURN v_new_entry_id;
END;
$$;

-- Approved Controlled Journal Lifecycle Procedures (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.create_draft_journal_entry(
    p_tenant_id UUID,
    p_entry_number TEXT,
    p_entry_date DATE,
    p_description TEXT DEFAULT NULL,
    p_reference_type TEXT DEFAULT NULL,
    p_reference_id TEXT DEFAULT NULL,
    p_actor_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_journal_id UUID := gen_random_uuid();
BEGIN
    INSERT INTO public.journal_entries (
        id, tenant_id, entry_number, entry_date, status,
        description, reference_type, reference_id,
        total_debit, total_credit, created_at, updated_at
    ) VALUES (
        v_journal_id, p_tenant_id, p_entry_number, COALESCE(p_entry_date, CURRENT_DATE), 'DRAFT',
        p_description, p_reference_type, p_reference_id,
        0.000, 0.000, now(), now()
    );

    RETURN v_journal_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_draft_journal_line(
    p_tenant_id UUID,
    p_journal_entry_id UUID,
    p_account_id UUID,
    p_account_code TEXT,
    p_debit NUMERIC(12, 3) DEFAULT 0.000,
    p_credit NUMERIC(12, 3) DEFAULT 0.000,
    p_description TEXT DEFAULT NULL,
    p_merchant_id UUID DEFAULT NULL,
    p_driver_id UUID DEFAULT NULL,
    p_branch_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_line_id UUID := gen_random_uuid();
    v_journal_status public.journal_posting_status;
BEGIN
    SELECT status INTO v_journal_status 
    FROM public.journal_entries 
    WHERE id = p_journal_entry_id AND tenant_id = p_tenant_id;

    IF v_journal_status IS NULL THEN
        RAISE EXCEPTION 'Journal entry % not found for tenant %', p_journal_entry_id, p_tenant_id;
    END IF;

    IF v_journal_status <> 'DRAFT' THEN
        RAISE EXCEPTION 'Cannot add lines to journal entry % in status % (must be DRAFT)', p_journal_entry_id, v_journal_status;
    END IF;

    INSERT INTO public.journal_lines (
        id, tenant_id, journal_entry_id, account_id, account_code,
        debit, credit, description, merchant_id, driver_id, branch_id,
        created_at
    ) VALUES (
        v_line_id, p_tenant_id, p_journal_entry_id, p_account_id, p_account_code,
        COALESCE(p_debit, 0.000), COALESCE(p_credit, 0.000), p_description,
        p_merchant_id, p_driver_id, p_branch_id, now()
    );

    RETURN v_line_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.post_journal_entry(
    p_journal_entry_id UUID,
    p_actor_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_status public.journal_posting_status;
BEGIN
    SELECT status INTO v_status 
    FROM public.journal_entries 
    WHERE id = p_journal_entry_id;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Journal entry % not found', p_journal_entry_id;
    END IF;

    IF v_status <> 'DRAFT' THEN
        RAISE EXCEPTION 'Journal entry % is already % and cannot be posted again', p_journal_entry_id, v_status;
    END IF;

    UPDATE public.journal_entries
    SET status = 'POSTED', posted_by = p_actor_id, posted_at = now(), updated_at = now()
    WHERE id = p_journal_entry_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_journal_posting_balance() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_settlement_item_beneficiary() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_settlement_allocation_cap() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_obligation_allocated_amount(UUID) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_settlement_item_mutation() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_settlement_status_change() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_settlement_record_immutability() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_settlement_items_immutability() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_financial_obligation_immutability() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.execute_stock_transfer_completion(UUID, UUID) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.execute_stock_transfer_reversal(UUID, UUID, TEXT) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.execute_journal_reversal(UUID, UUID, TEXT) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_draft_journal_entry(UUID, TEXT, DATE, TEXT, TEXT, TEXT, UUID) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_draft_journal_line(UUID, UUID, UUID, TEXT, NUMERIC, NUMERIC, TEXT, UUID, UUID, UUID) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.post_journal_entry(UUID, UUID) FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.execute_stock_transfer_completion(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.execute_stock_transfer_reversal(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.execute_journal_reversal(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_draft_journal_entry(UUID, TEXT, DATE, TEXT, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_draft_journal_line(UUID, UUID, UUID, TEXT, NUMERIC, NUMERIC, TEXT, UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.post_journal_entry(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_obligation_allocated_amount(UUID) TO service_role;


-- ============================================================================
-- MODULE 18: DEVELOPMENT MINIMUM SEED FIXTURES
-- ============================================================================

DO $$
DECLARE
    v_tenant_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
BEGIN
    INSERT INTO public.tenants (id, name, code, is_active, created_at, updated_at)
    VALUES (
        v_tenant_id,
        'شركة دليفري للخدمات اللوجستية (Delivere Express)',
        'DELIVERE-HQ',
        true,
        now(),
        now()
    ) ON CONFLICT (id) DO UPDATE 
    SET name = EXCLUDED.name, code = EXCLUDED.code;

    INSERT INTO public.tenant_settings (
        tenant_id, company_name, commercial_name, brand_color, currency,
        phone, email, address, created_at, updated_at
    ) VALUES (
        v_tenant_id,
        'Delivere Express Logistics Inc.',
        'دليفري إكسبريس للخدمات اللوجستية والتوصيل',
        '#4F46E5',
        'JOD',
        NULL,
        NULL,
        NULL,
        now(),
        now()
    ) ON CONFLICT (tenant_id) DO UPDATE 
    SET company_name = EXCLUDED.company_name;

    INSERT INTO public.subscription_plans (
        id, code, name_ar, name_en, monthly_price_jod, annual_price_jod,
        max_users, max_monthly_orders, enabled_modules, is_active, is_public
    ) VALUES 
    ('plan-starter', 'STARTER', 'الباقة الأساسية', 'Starter Plan', 0.000, 0.000, 5, 500, '{"tmsDelivery":true,"posCashier":true,"merchantWms":false,"accountingSettlements":true}'::jsonb, true, true),
    ('plan-growth', 'GROWTH', 'الباقة المتقدمة', 'Growth Plan', 45.000, 450.000, 20, 3000, '{"tmsDelivery":true,"posCashier":true,"merchantWms":true,"accountingSettlements":true}'::jsonb, true, true),
    ('plan-enterprise', 'ENTERPRISE', 'باقة الشركات الكبرى', 'Enterprise Plan', 95.000, 950.000, 100, 50000, '{"tmsDelivery":true,"posCashier":true,"merchantWms":true,"accountingSettlements":true,"aiRouteOptimizer":true,"apiIntegrations":true}'::jsonb, true, true)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.subscriptions (
        id, tenant_id, plan_id, plan_code, plan_name, status,
        start_date, end_date, price, currency, billing_cycle,
        enabled_modules, max_users, max_monthly_orders, auto_renew
    ) VALUES (
        gen_random_uuid(),
        v_tenant_id,
        'plan-enterprise',
        'ENTERPRISE',
        'باقة الشركات الكبرى',
        'ACTIVE',
        now(),
        now() + interval '365 days',
        95.000,
        'JOD',
        'ANNUAL',
        '{"tmsDelivery":true,"posCashier":true,"merchantWms":true,"accountingSettlements":true,"aiRouteOptimizer":true,"apiIntegrations":true}'::jsonb,
        100,
        50000,
        true
    ) ON CONFLICT DO NOTHING;

    INSERT INTO public.accounts (tenant_id, code, name, name_ar, type, description, is_system)
    VALUES 
    (v_tenant_id, '1010', 'Main Cash on Hand', 'الصندوق النقدي الرئيسي', 'ASSET', 'النقدية المتوفرة في الخزينة الرئيسية', true),
    (v_tenant_id, '1020', 'Driver Cash Custody', 'أمانات الكباتن النقدية', 'ASSET', 'النقدية المقبوضة فعلياً تحت عهدة السائقين', true),
    (v_tenant_id, '1030', 'Central Bank & CliQ', 'الحساب البنكي وخدمة كليك', 'ASSET', 'التحصيلات الإلكترونية المركزية', true),
    (v_tenant_id, '1070', 'Merchant Accounts Receivable', 'ذمم المتاجر المدينة', 'ASSET', 'مستحقات التوصيل الآجلة على المتاجر', true),
    (v_tenant_id, '1200', 'Inventory Asset', 'أصول المخزون السلعي', 'ASSET', 'قيمة البضائع والمخزون في الفروع والمستودعات', true),
    (v_tenant_id, '2020', 'Merchant COD Payables', 'أمانات تحصيل المتاجر الدائنة', 'LIABILITY', 'أمانات بضائع المتاجر المحصلة من الزبائن الواجب تسديدها', true),
    (v_tenant_id, '2030', 'Driver Earnings Payable', 'أتعاب وأجور الكباتن المستحقة', 'LIABILITY', 'عمولات وأتعاب التوصيل المستحقة للسائقين', true),
    (v_tenant_id, '2050', 'Accounts Payable', 'ذمم الموردين والشركاء الدائنة', 'LIABILITY', 'الالتزامات التجارية العامة', true),
    (v_tenant_id, '4010', 'Delivery Tariff Revenue', 'إيرادات خدمات التوصيل', 'REVENUE', 'أجور التوصيل الصافية المحققة لشركة اللوجستيات', true),
    (v_tenant_id, '4020', 'Merchant Sales Revenue', 'إيرادات مبيعات المتاجر', 'REVENUE', 'إيرادات نقاط البيع والمبيعات المباشرة', true),
    (v_tenant_id, '5010', 'Driver Delivery Expense', 'مصاريف أتعاب التوصيل', 'EXPENSE', 'تكلفة التوصيل المباشرة المدفوعة للكباتن', true),
    (v_tenant_id, '5020', 'Cost of Goods Sold', 'تكلفة البضاعة المباعة (COGS)', 'EXPENSE', 'تكلفة المنتجات المباعة', true)
    ON CONFLICT (tenant_id, code) DO NOTHING;

    INSERT INTO public.price_plans (
        id, tenant_id, name, type, description, is_default, default_fee,
        governorate_fees, return_fee, extra_weight_fee_per_kg, is_active
    ) VALUES (
        'pp-mer-std',
        v_tenant_id,
        'جميع المملكة 2 (القياسية)',
        'MERCHANT',
        'قائمة أسعار التوصيل المعتمدة للمتاجر: عمان 2.000 / 3.000 د.أ، وباقي المحافظات حسب التعرفة المعتمدة',
        true,
        3.000,
        '{"عمان": 2.000, "الزرقاء": 2.500, "البلقاء": 3.000, "السلط (البلقاء)": 3.000, "مادبا": 3.000, "إربد": 3.000, "جرش": 3.000, "عجلون": 3.000, "المفرق": 3.000, "الكرك": 3.500, "الطفيلة": 3.500, "معان": 4.000, "العقبة": 4.000}'::jsonb,
        1.500,
        0.500,
        true
    ) ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        default_fee = EXCLUDED.default_fee,
        governorate_fees = EXCLUDED.governorate_fees,
        return_fee = EXCLUDED.return_fee,
        extra_weight_fee_per_kg = EXCLUDED.extra_weight_fee_per_kg,
        is_active = true;

    INSERT INTO public.price_plans (
        id, tenant_id, name, type, description, is_default, default_fee,
        governorate_fees, return_fee, extra_weight_fee_per_kg, is_active
    ) VALUES (
        'pp-drv-std',
        v_tenant_id,
        'تعرفة أتعاب الكباتن القياسية (Standard Driver Compensation)',
        'DRIVER',
        'التعرفة المعتمدة لحساب أتعاب توصيل الكباتن: عمان 1.500، الزرقاء 1.750، وباقي المحافظات حسب التعرفة',
        true,
        1.500,
        '{"عمان": 1.500, "الزرقاء": 1.750, "البلقاء": 2.000, "السلط (البلقاء)": 2.000, "مادبا": 2.000, "إربد": 2.000, "جرش": 2.000, "عجلون": 2.000, "المفرق": 2.000, "الكرك": 2.500, "الطفيلة": 2.500, "معان": 3.000, "العقبة": 3.000}'::jsonb,
        0.500,
        0.250,
        true
    ) ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        default_fee = EXCLUDED.default_fee,
        governorate_fees = EXCLUDED.governorate_fees,
        return_fee = EXCLUDED.return_fee,
        extra_weight_fee_per_kg = EXCLUDED.extra_weight_fee_per_kg,
        is_active = true;

    INSERT INTO public.price_plan_rules (
        tenant_id, price_plan_id, from_governorate, from_sub_region, to_governorate, to_sub_region, order_type, price, return_discount, fixed_return, driver_discount, fixed_driver_cost, is_active
    ) VALUES
    (v_tenant_id, 'pp-mer-std', 'عمان', 'وسط البلد', 'عمان', 'شمال عمان', 'عادي', 2.000, 0.000, 1.000, 0.000, 1.500, true),
    (v_tenant_id, 'pp-mer-std', 'عمان', 'وسط البلد', 'الزرقاء', 'الزرقاء الجديدة', 'عادي', 2.500, 0.000, 1.250, 0.000, 1.750, true),
    (v_tenant_id, 'pp-mer-std', 'عمان', 'وسط البلد', 'إربد', 'الحي الشرقي', 'عادي', 3.000, 0.000, 1.500, 0.000, 2.000, true)
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Development minimum seed data (system config, COA, plans) loaded successfully.';
END $$;

COMMIT;

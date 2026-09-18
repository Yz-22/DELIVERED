-- ============================================================================
-- DELIVERE — 01_extensions_and_core_types.sql
-- Canonical Database Foundation: Extensions & Custom Enums
-- ============================================================================

-- Ensure core crypto, UUID generation & exclusion index extensions exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- User Roles
DO $$ BEGIN
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
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Auth Providers
DO $$ BEGIN
    CREATE TYPE public.user_auth_provider AS ENUM (
        'EMAIL_PASSWORD',
        'GOOGLE',
        'HYBRID'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Invitation Statuses
DO $$ BEGIN
    CREATE TYPE public.invitation_status AS ENUM (
        'PENDING',
        'ACCEPTED',
        'EXPIRED',
        'REVOKED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Shipment / Order Statuses
DO $$ BEGIN
    CREATE TYPE public.shipment_status AS ENUM (
        'DRAFT',
        'CREATED',
        'PICKED_UP',
        'AT_HUB',
        'IN_TRANSIT',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'RETURNED',
        'FAILED',
        'CANCELLED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Payment Types
DO $$ BEGIN
    CREATE TYPE public.payment_type AS ENUM (
        'COD',
        'CLIQ',
        'PREPAID',
        'WALLET'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Price Plan Types
DO $$ BEGIN
    CREATE TYPE public.price_plan_type AS ENUM (
        'MERCHANT',
        'DRIVER'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Stock Movement Types
DO $$ BEGIN
    CREATE TYPE public.stock_movement_type AS ENUM (
        'PURCHASE',
        'SALE',
        'RETURN',
        'TRANSFER_IN',
        'TRANSFER_OUT',
        'ADJUSTMENT_IN',
        'ADJUSTMENT_OUT',
        'REVERSAL'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Stock Transfer Statuses
DO $$ BEGIN
    CREATE TYPE public.stock_transfer_status AS ENUM (
        'PENDING',
        'IN_TRANSIT',
        'COMPLETED',
        'REJECTED',
        'CANCELLED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Financial Account Types
DO $$ BEGIN
    CREATE TYPE public.account_type AS ENUM (
        'ASSET',
        'LIABILITY',
        'EQUITY',
        'REVENUE',
        'EXPENSE'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Journal Posting Statuses
DO $$ BEGIN
    CREATE TYPE public.journal_posting_status AS ENUM (
        'DRAFT',
        'POSTED',
        'REVERSED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Voucher Types
DO $$ BEGIN
    CREATE TYPE public.voucher_type AS ENUM (
        'RECEIPT',
        'PAYMENT',
        'JOURNAL'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Financial Obligation Types (Strict Canonical Meaning)
DO $$ BEGIN
    CREATE TYPE public.financial_obligation_type AS ENUM (
        'MERCHANT_COD_PAYABLE',
        'MERCHANT_COD',
        'DRIVER_EARNING',
        'DELIVERY_FEE_AR',
        'RETURN_FEE_AR'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Financial Obligation Statuses
DO $$ BEGIN
    CREATE TYPE public.financial_obligation_status AS ENUM (
        'PENDING',
        'PARTIALLY_SETTLED',
        'SETTLED',
        'CANCELLED',
        'LEGACY_RECONCILIATION_REQUIRED',
        'FINANCIAL_RECONCILIATION_REQUIRED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Settlement Statuses
DO $$ BEGIN
    CREATE TYPE public.settlement_status AS ENUM (
        'DRAFT',
        'SUBMITTED',
        'APPROVED',
        'SETTLED',
        'CANCELLED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Settlement Types
DO $$ BEGIN
    CREATE TYPE public.settlement_type AS ENUM (
        'MERCHANT',
        'DRIVER'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Accounting Period Statuses
DO $$ BEGIN
    CREATE TYPE public.accounting_period_status AS ENUM (
        'OPEN',
        'CLOSED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Subscription Statuses
DO $$ BEGIN
    CREATE TYPE public.subscription_status AS ENUM (
        'ACTIVE',
        'TRIAL',
        'SUSPENDED',
        'EXPIRED',
        'CANCELLED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Subscription Billing Cycles
DO $$ BEGIN
    CREATE TYPE public.subscription_billing_cycle AS ENUM (
        'MONTHLY',
        'ANNUAL',
        'QUARTERLY',
        'CUSTOM'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

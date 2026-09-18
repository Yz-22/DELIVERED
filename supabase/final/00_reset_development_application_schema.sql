-- ============================================================================
-- DELIVERE — 00_reset_development_application_schema.sql
-- ENVIRONMENT: DEVELOPMENT_STAGING ONLY
-- CRITICAL WARNING: DESTRUCTIVE TO APPLICATION BUSINESS DATA.
-- DO NOT RUN ON PRODUCTION.
--
-- This script cleanly resets only the Delivere-owned public application schema.
-- It explicitly PROTECTS:
--   - Supabase Auth schema (auth.users, auth identities, tokens)
--   - Supabase Storage schema (storage.*)
--   - Supabase extensions and internal infrastructure configuration
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Starting clean development reset of Delivere application objects in public schema...';
END $$;

-- 1. Drop Triggers on Public Tables & Views
DROP TRIGGER IF EXISTS trg_check_journal_posting_balance ON public.journal_entries;
DROP TRIGGER IF EXISTS trg_prevent_posted_journal_mutation ON public.journal_entries;
DROP TRIGGER IF EXISTS trg_prevent_posted_journal_lines_mutation ON public.journal_lines;
DROP TRIGGER IF EXISTS trg_prevent_audit_log_mutation ON public.audit_logs;
DROP TRIGGER IF EXISTS trg_prevent_stock_movement_mutation ON public.stock_movements;
DROP TRIGGER IF EXISTS trg_prevent_shipment_history_mutation ON public.shipment_status_history;
DROP TRIGGER IF EXISTS trg_protect_shipment_financial_snapshots ON public.shipments;
DROP TRIGGER IF EXISTS trg_validate_settlement_item_beneficiary ON public.settlement_items;
DROP TRIGGER IF EXISTS trg_enforce_settlement_allocation_cap ON public.settlement_items;
DROP TRIGGER IF EXISTS trg_recalc_obligation_on_settlement_status ON public.settlement_records;
DROP TRIGGER IF EXISTS trg_recalc_obligation_on_item_mutation ON public.settlement_items;
DROP TRIGGER IF EXISTS trg_journal_entry_period_lock ON public.journal_entries;
DROP TRIGGER IF EXISTS trg_ensure_single_active_main_branch ON public.merchant_branches;
DROP TRIGGER IF EXISTS trg_orders_view_insert ON public.orders;
DROP TRIGGER IF EXISTS trg_orders_view_update ON public.orders;
DROP TRIGGER IF EXISTS trg_orders_view_delete ON public.orders;

-- 2. Drop Helper Stored Procedures & Functions
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
DROP FUNCTION IF EXISTS public.handle_settlement_status_change() CASCADE;
DROP FUNCTION IF EXISTS public.handle_settlement_item_mutation() CASCADE;
DROP FUNCTION IF EXISTS public.check_journal_entry_period_lock() CASCADE;
DROP FUNCTION IF EXISTS public.execute_stock_transfer_completion(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.execute_stock_transfer_reversal(UUID, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.execute_journal_reversal(UUID, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.ensure_single_active_main_branch() CASCADE;
DROP FUNCTION IF EXISTS public.orders_view_insert_handler() CASCADE;
DROP FUNCTION IF EXISTS public.orders_view_update_handler() CASCADE;
DROP FUNCTION IF EXISTS public.orders_view_delete_handler() CASCADE;

-- 3. Drop Public Application Views & Tables in Reverse-Dependency Order
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

DROP TABLE IF EXISTS public.settlement_items CASCADE;
DROP TABLE IF EXISTS public.settlement_records CASCADE;
DROP TABLE IF EXISTS public.financial_obligations CASCADE;
DROP TABLE IF EXISTS public.journal_lines CASCADE;
DROP TABLE IF EXISTS public.journal_entries CASCADE;
DROP TABLE IF EXISTS public.accounting_periods CASCADE;
DROP TABLE IF EXISTS public.vouchers CASCADE;
DROP TABLE IF EXISTS public.accounts CASCADE;

DROP TABLE IF EXISTS public.merchant_stock_transfer_items CASCADE;
DROP TABLE IF EXISTS public.merchant_stock_transfers CASCADE;
DROP TABLE IF EXISTS public.stock_movements CASCADE;
DROP TABLE IF EXISTS public.branch_inventory CASCADE;

DROP TABLE IF EXISTS public.driver_wallets CASCADE;
DROP TABLE IF EXISTS public.shipment_status_history CASCADE;
DROP TABLE IF EXISTS public.shipments CASCADE;
DROP TABLE IF EXISTS public.price_plan_rules CASCADE;
DROP TABLE IF EXISTS public.price_plans CASCADE;

DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.user_branch_access CASCADE;
DROP TABLE IF EXISTS public.merchant_branches CASCADE;

DROP TABLE IF EXISTS public.subscriptions CASCADE;
DROP TABLE IF EXISTS public.subscription_plans CASCADE;

DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.revoked_sessions CASCADE;
DROP TABLE IF EXISTS public.user_invitations CASCADE;
DROP TABLE IF EXISTS public.tenant_settings CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.tenants CASCADE;

-- 4. Drop Custom Enum Types
DROP TYPE IF EXISTS public.user_role CASCADE;
DROP TYPE IF EXISTS public.user_auth_provider CASCADE;
DROP TYPE IF EXISTS public.invitation_status CASCADE;
DROP TYPE IF EXISTS public.shipment_status CASCADE;
DROP TYPE IF EXISTS public.payment_type CASCADE;
DROP TYPE IF EXISTS public.price_plan_type CASCADE;
DROP TYPE IF EXISTS public.stock_movement_type CASCADE;
DROP TYPE IF EXISTS public.stock_transfer_status CASCADE;
DROP TYPE IF EXISTS public.account_type CASCADE;
DROP TYPE IF EXISTS public.journal_posting_status CASCADE;
DROP TYPE IF EXISTS public.voucher_type CASCADE;
DROP TYPE IF EXISTS public.financial_obligation_type CASCADE;
DROP TYPE IF EXISTS public.financial_obligation_status CASCADE;
DROP TYPE IF EXISTS public.settlement_status CASCADE;
DROP TYPE IF EXISTS public.settlement_type CASCADE;
DROP TYPE IF EXISTS public.accounting_period_status CASCADE;
DROP TYPE IF EXISTS public.subscription_status CASCADE;
DROP TYPE IF EXISTS public.subscription_billing_cycle CASCADE;

DO $$
BEGIN
    RAISE NOTICE 'Clean development reset of Delivere public application schema completed successfully.';
END $$;

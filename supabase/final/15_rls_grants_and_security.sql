-- ============================================================================
-- DELIVERE — 15_rls_grants_and_security.sql
-- Row-Level Security (RLS) & Defense-in-Depth Grant Hardening
-- ============================================================================

-- 1. Enable RLS Across All Application Tables
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

-- 2. Revoke Dangerous Direct Privileges from Anon and Authenticated Roles
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

-- 3. Grant Explicit Access to service_role (Delivere Backend Security Proxy)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

-- Explicitly revoke TRUNCATE on all tables from all roles
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated, public, service_role;

-- Revoke dangerous direct mutation privileges on immutable financial ledgers from all roles
REVOKE TRUNCATE, DELETE, UPDATE ON public.audit_logs FROM service_role;
REVOKE TRUNCATE, DELETE, UPDATE ON public.stock_movements FROM service_role;
REVOKE TRUNCATE, DELETE, UPDATE ON public.shipment_status_history FROM service_role;

-- Explicitly revoke TRUNCATE on journal tables from service_role
REVOKE TRUNCATE ON public.journal_entries FROM service_role;
REVOKE TRUNCATE ON public.journal_lines FROM service_role;

-- 4. Defense-in-Depth RLS Policies for Service Role
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

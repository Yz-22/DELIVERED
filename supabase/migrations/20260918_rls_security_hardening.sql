-- ==============================================================================
-- Delivere Logistics & Enterprise TMS/POS
-- Migration: 20260918_rls_security_hardening.sql
-- Name: Phase H — Comprehensive Row-Level Security (RLS) & Least-Privilege Hardening (Revision 3.1)
-- Architecture: Zero Direct Client Financial Access + Backend RBAC Governance + Least Privilege
-- Revoke Insecure Public Policies, Gate Financials to Service Role, & Isolate Operational Records
-- NO DATA MODIFICATION OR PRODUCTION APPLICATION IN THIS STEP
-- ==============================================================================

-- 1. REVOKE INSECURE PUBLIC / DIRECT CLIENT GRANTS ACROSS FINANCIAL & SENSITIVE TABLES

-- A. audit_logs (Strictly Immutable: Service Role Only)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow system service to record audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Public read audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Authenticated users view own tenant audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Authenticated users view own audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Service role full access to audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Service role manage audit_logs" ON public.audit_logs;

CREATE POLICY "Service role manage audit_logs" 
ON public.audit_logs 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- B. revoked_sessions (Least Privilege: Zero direct client access)
ALTER TABLE public.revoked_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow system service to manage revoked sessions" ON public.revoked_sessions;
DROP POLICY IF EXISTS "Authenticated users check revoked tokens" ON public.revoked_sessions;
DROP POLICY IF EXISTS "Service role manage revoked_sessions" ON public.revoked_sessions;

CREATE POLICY "Service role manage revoked_sessions" 
ON public.revoked_sessions 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- C. tenant_settings (Strict Tenant Scoping with Real Auth Mapping)
ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read tenant branding" ON public.tenant_settings;
DROP POLICY IF EXISTS "Tenant admin manage own branding" ON public.tenant_settings;
DROP POLICY IF EXISTS "Authenticated users view own tenant_settings" ON public.tenant_settings;
DROP POLICY IF EXISTS "Service role manage tenant_settings" ON public.tenant_settings;

CREATE POLICY "Service role manage tenant_settings" 
ON public.tenant_settings 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Authenticated users view own tenant_settings" 
ON public.tenant_settings 
FOR SELECT 
TO authenticated 
USING (
    tenant_id IN (
        SELECT u.tenant_id FROM public.users u 
        WHERE u.id = auth.uid() OR u.google_id = auth.uid()::text
    )
);

-- D. merchant_branches (Strict Tenant & Merchant Scoping with Real Auth Mapping)
ALTER TABLE public.merchant_branches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users view branches" ON public.merchant_branches;
DROP POLICY IF EXISTS "Authenticated users view own tenant branches" ON public.merchant_branches;
DROP POLICY IF EXISTS "Service role manage merchant_branches" ON public.merchant_branches;

CREATE POLICY "Service role manage merchant_branches" 
ON public.merchant_branches 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Authenticated users view own tenant branches" 
ON public.merchant_branches 
FOR SELECT 
TO authenticated 
USING (
    tenant_id IN (
        SELECT u.tenant_id FROM public.users u 
        WHERE u.id = auth.uid() OR u.google_id = auth.uid()::text
    ) OR
    merchant_id IN (
        SELECT u.id FROM public.users u 
        WHERE u.id = auth.uid() OR u.google_id = auth.uid()::text
    )
);

-- E. user_branch_access
ALTER TABLE public.user_branch_access ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role manage user_branch_access" ON public.user_branch_access;
DROP POLICY IF EXISTS "Authenticated users view own branch access" ON public.user_branch_access;

CREATE POLICY "Service role manage user_branch_access" 
ON public.user_branch_access 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Authenticated users view own branch access" 
ON public.user_branch_access 
FOR SELECT 
TO authenticated 
USING (
    user_id IN (
        SELECT u.id FROM public.users u 
        WHERE u.id = auth.uid() OR u.google_id = auth.uid()::text
    )
);

-- F. branch_inventory & merchant_stock_transfers
ALTER TABLE public.branch_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_stock_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role manage branch_inventory" ON public.branch_inventory;
DROP POLICY IF EXISTS "Service role manage merchant_stock_transfers" ON public.merchant_stock_transfers;
DROP POLICY IF EXISTS "Authenticated users view own branch inventory" ON public.branch_inventory;
DROP POLICY IF EXISTS "Authenticated users view own stock transfers" ON public.merchant_stock_transfers;

CREATE POLICY "Service role manage branch_inventory" 
ON public.branch_inventory 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Authenticated users view own branch inventory" 
ON public.branch_inventory 
FOR SELECT 
TO authenticated 
USING (
    merchant_id IN (
        SELECT u.id FROM public.users u 
        WHERE u.id = auth.uid() OR u.google_id = auth.uid()::text
    )
);

CREATE POLICY "Service role manage merchant_stock_transfers" 
ON public.merchant_stock_transfers 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Authenticated users view own stock transfers" 
ON public.merchant_stock_transfers 
FOR SELECT 
TO authenticated 
USING (
    merchant_id IN (
        SELECT u.id FROM public.users u 
        WHERE u.id = auth.uid() OR u.google_id = auth.uid()::text
    )
);

-- G. Financial Ledger & Obligation Tables (Zero Direct Client Access — Strictly Service Role Gated)
-- Being an authenticated employee, cashier, or driver in a tenant does NOT grant ledger access.
-- All financial queries are authoritatively governed by the backend API enforcing granular permissions.
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;

-- Drop all broad authenticated policies on financial tables
DROP POLICY IF EXISTS "Authenticated view tenant accounts" ON public.accounts;
DROP POLICY IF EXISTS "Authenticated view tenant journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Authenticated view tenant journal lines" ON public.journal_lines;
DROP POLICY IF EXISTS "Authenticated view tenant vouchers" ON public.vouchers;
DROP POLICY IF EXISTS "Authenticated view tenant obligations" ON public.financial_obligations;
DROP POLICY IF EXISTS "Authenticated view tenant settlements" ON public.settlement_records;
DROP POLICY IF EXISTS "Authenticated view tenant settlement items" ON public.settlement_items;
DROP POLICY IF EXISTS "Authenticated view tenant accounting periods" ON public.accounting_periods;

DROP POLICY IF EXISTS "Service role manage financial accounts" ON public.accounts;
DROP POLICY IF EXISTS "Service role manage journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Service role manage journal lines" ON public.journal_lines;
DROP POLICY IF EXISTS "Service role manage vouchers" ON public.vouchers;
DROP POLICY IF EXISTS "Service role manage financial obligations" ON public.financial_obligations;
DROP POLICY IF EXISTS "Service role manage settlement records" ON public.settlement_records;
DROP POLICY IF EXISTS "Service role manage settlement items" ON public.settlement_items;
DROP POLICY IF EXISTS "Service role manage accounting periods" ON public.accounting_periods;

CREATE POLICY "Service role manage financial accounts" ON public.accounts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role manage journal entries" ON public.journal_entries FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role manage journal lines" ON public.journal_lines FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role manage vouchers" ON public.vouchers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role manage financial obligations" ON public.financial_obligations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role manage settlement records" ON public.settlement_records FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role manage settlement items" ON public.settlement_items FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role manage accounting periods" ON public.accounting_periods FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. HARDEN DATABASE-LEVEL GRANTS: REVOKE ALL FINANCIAL AND SENSITIVE ACCESS FROM ANON & AUTHENTICATED
REVOKE ALL ON public.journal_entries FROM anon, authenticated;
REVOKE ALL ON public.journal_lines FROM anon, authenticated;
REVOKE ALL ON public.vouchers FROM anon, authenticated;
REVOKE ALL ON public.financial_obligations FROM anon, authenticated;
REVOKE ALL ON public.settlement_records FROM anon, authenticated;
REVOKE ALL ON public.settlement_items FROM anon, authenticated;
REVOKE ALL ON public.accounting_periods FROM anon, authenticated;
REVOKE ALL ON public.accounts FROM anon, authenticated;
REVOKE ALL ON public.audit_logs FROM anon, authenticated;
REVOKE ALL ON public.revoked_sessions FROM anon, authenticated;

-- Operational tables: Revoke mutation from anon and authenticated
REVOKE INSERT, UPDATE, DELETE ON public.merchant_branches FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_branch_access FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.branch_inventory FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.merchant_stock_transfers FROM anon, authenticated;
REVOKE ALL ON public.merchant_branches FROM anon;
REVOKE ALL ON public.user_branch_access FROM anon;
REVOKE ALL ON public.branch_inventory FROM anon;
REVOKE ALL ON public.merchant_stock_transfers FROM anon;

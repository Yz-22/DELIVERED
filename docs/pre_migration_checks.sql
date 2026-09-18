-- ==============================================================================
-- Delivere Logistics & Enterprise TMS/POS
-- PRE-MIGRATION READ-ONLY SAFETY AUDIT QUERIES (Revision 3.1)
-- PURPOSE: Execute these SELECT queries manually in Supabase SQL Editor BEFORE running migrations.
-- ALL QUERIES ARE 100% READ-ONLY (SELECT only). ZERO DATA IS MODIFIED.
-- ==============================================================================

-- 1. Check for Orphan Users (users without a valid tenant)
SELECT id, email, name, role, tenant_id, created_at 
FROM public.users 
WHERE tenant_id IS NULL OR tenant_id NOT IN (SELECT id FROM public.tenants);

-- 2. Check auth.users <-> public.users Identity Mapping Consistency (google_id vs auth.users.id)
SELECT 
    au.id AS auth_user_id,
    au.email AS auth_email,
    pu.id AS public_user_id,
    pu.email AS public_email,
    pu.google_id,
    pu.role,
    pu.tenant_id
FROM auth.users au
FULL OUTER JOIN public.users pu ON au.id::text = pu.google_id OR au.id = pu.id
WHERE au.id IS NULL OR pu.id IS NULL;

-- 3. Check for Orphan Merchants and Cashier Parent Relationships Integrity
SELECT c.id AS cashier_id, c.name AS cashier_name, c.email, c.parent_user_id, m.name AS merchant_name, m.role AS parent_role
FROM public.users c
LEFT JOIN public.users m ON c.parent_user_id = m.id
WHERE c.role IN ('CASHIER', 'STAFF') AND (c.parent_user_id IS NULL OR m.id IS NULL OR m.role != 'MERCHANT');

-- 4. Check for Product Ownership Integrity (product tenant_id vs merchant tenant_id)
SELECT p.id AS product_id, p.name AS product_name, p.merchant_id, p.tenant_id AS product_tenant, m.tenant_id AS merchant_tenant
FROM public.products p
LEFT JOIN public.users m ON p.merchant_id = m.id
WHERE m.id IS NULL OR p.tenant_id <> m.tenant_id;

-- 5. Inspect Existing Inventory Source (JSONB vs Relational Transactions)
SELECT 
    COUNT(*) AS total_products,
    COUNT(CASE WHEN branch_stock IS NOT NULL AND branch_stock <> '{}'::jsonb THEN 1 END) AS products_with_legacy_jsonb_stock
FROM public.products;

-- 6. Audit Financial Column Data Types & System Control Account Code Conflicts
SELECT table_name, column_name, data_type, numeric_precision, numeric_scale, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND (column_name IN ('debit', 'credit', 'amount', 'balance', 'total_cod', 'delivery_fee', 'driver_fee')
       OR table_name IN ('accounts', 'journal_entries', 'journal_lines', 'vouchers'))
ORDER BY table_name, ordinal_position;

-- 7. Check for Existing Account Code Collisions with Standard Control Codes ('1010', '1040', '2010', '4010', '5010')
SELECT tenant_id, code, name, type, balance
FROM public.accounts
WHERE code IN ('1010', '1040', '2010', '4010', '5010')
ORDER BY tenant_id, code;

-- 8. Check Journal Entry Double-Entry Balance Integrity in Legacy Data
SELECT 
    je.id AS entry_id,
    je.entry_number,
    je.date,
    je.reference_type,
    je.reference_id,
    COALESCE(SUM(jl.debit), 0) AS total_debit,
    COALESCE(SUM(jl.credit), 0) AS total_credit,
    ABS(COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0)) AS imbalance
FROM public.journal_entries je
LEFT JOIN public.journal_lines jl ON je.id = jl.entry_id
GROUP BY je.id, je.entry_number, je.date, je.reference_type, je.reference_id
HAVING ABS(COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0)) > 0.001;

-- 9. Check for Existing Negative or Both-Positive Journal Lines in Legacy Data
SELECT id, entry_id, account_id, debit, credit
FROM public.journal_lines
WHERE debit < 0 OR credit < 0 OR (debit > 0 AND credit > 0) OR (debit = 0 AND credit = 0);

-- 10. Audit Supabase RLS Policies for Insecure Public Grants or Broad Access
SELECT 
    schemaname,
    tablename,
    policyname,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND (
      'public' = ANY(roles) OR
      'anon' = ANY(roles) OR
      qual ILIKE '%true%' OR 
      with_check ILIKE '%true%'
  )
ORDER BY tablename, policyname;

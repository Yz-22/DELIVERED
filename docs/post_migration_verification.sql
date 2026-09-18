-- ==============================================================================
-- Delivere Logistics & Enterprise TMS/POS
-- POST-MIGRATION READ-ONLY VERIFICATION QUERIES (Revision 3.2)
-- PURPOSE: Execute these SELECT queries manually in Supabase SQL Editor AFTER migration.
-- ALL QUERIES ARE 100% READ-ONLY (SELECT only). ZERO DATA IS MODIFIED.
-- ==============================================================================

-- 1. Verify Preservation of Core Table Row Counts
SELECT 
    'users' AS table_name, COUNT(*) AS row_count FROM public.users
UNION ALL
SELECT 'tenants', COUNT(*) FROM public.tenants
UNION ALL
SELECT 'shipments', COUNT(*) FROM public.shipments
UNION ALL
SELECT 'products', COUNT(*) FROM public.products
UNION ALL
SELECT 'journal_entries', COUNT(*) FROM public.journal_entries
UNION ALL
SELECT 'journal_lines', COUNT(*) FROM public.journal_lines
UNION ALL
SELECT 'vouchers', COUNT(*) FROM public.vouchers
UNION ALL
SELECT 'audit_logs', COUNT(*) FROM public.audit_logs;

-- 2. Verify Cross-Tenant & Cross-Merchant Branch Isolation Integrity (Must be 0)
SELECT b.id AS branch_id, b.name AS branch_name, b.merchant_id, b.tenant_id, u.tenant_id AS merchant_tenant
FROM public.merchant_branches b
JOIN public.users u ON b.merchant_id = u.id
WHERE b.tenant_id <> u.tenant_id;

-- 3. Verify Single Active Main Branch per Merchant Rule (Imbalance must be 0)
SELECT merchant_id, COUNT(*) AS active_main_branches_count
FROM public.merchant_branches
WHERE is_main = TRUE AND is_active = TRUE
GROUP BY merchant_id
HAVING COUNT(*) > 1;

-- 4. Verify Multi-Branch Inventory Product Ownership Integrity (Must be 0 cross-merchant rows)
SELECT bi.id, bi.branch_id, bi.product_id, bi.merchant_id AS inv_merchant, p.merchant_id AS prod_merchant, b.merchant_id AS branch_merchant
FROM public.branch_inventory bi
JOIN public.products p ON bi.product_id = p.id
JOIN public.merchant_branches b ON bi.branch_id = b.id
WHERE bi.merchant_id <> p.merchant_id OR bi.merchant_id <> b.merchant_id OR bi.quantity < 0;

-- 5. Verify Inter-Branch Stock Transfers Integrity (Must be 0 invalid rows)
SELECT st.id, st.transfer_number, st.source_branch_id, st.dest_branch_id, st.quantity, st.status
FROM public.merchant_stock_transfers st
WHERE st.source_branch_id = st.dest_branch_id OR st.quantity <= 0;

-- 6. Verify Journal Entries Double-Entry Mathematical Balance for POSTED Entries (Must be 0)
SELECT 
    je.id,
    je.entry_number,
    ROUND(SUM(jl.debit), 3) AS total_debit,
    ROUND(SUM(jl.credit), 3) AS total_credit,
    ROUND(ABS(SUM(jl.debit) - SUM(jl.credit)), 3) AS diff
FROM public.journal_entries je
JOIN public.journal_lines jl ON je.id = jl.entry_id
WHERE je.posting_status = 'POSTED' OR je.is_posted = TRUE
GROUP BY je.id, je.entry_number
HAVING ROUND(ABS(SUM(jl.debit) - SUM(jl.credit)), 3) > 0.000;

-- 7. Verify Idempotency Protection (Must be 0 duplicate entries per tenant)
SELECT tenant_id, idempotency_key, COUNT(*) 
FROM public.journal_entries 
WHERE idempotency_key IS NOT NULL 
GROUP BY tenant_id, idempotency_key 
HAVING COUNT(*) > 1;

-- 8. Verify Financial Obligations Allocation Bound (Counts ONLY Active Settlements, Must be 0)
SELECT 
    fo.id AS obligation_id,
    fo.shipment_id,
    fo.obligation_type,
    fo.original_amount,
    COALESCE(SUM(
        CASE 
            WHEN sr.status IN ('DRAFT', 'APPROVED', 'POSTED') THEN si.allocated_amount 
            ELSE 0.000 
        END
    ), 0.000) AS total_active_allocated,
    (COALESCE(SUM(
        CASE 
            WHEN sr.status IN ('DRAFT', 'APPROVED', 'POSTED') THEN si.allocated_amount 
            ELSE 0.000 
        END
    ), 0.000) - fo.original_amount) AS over_allocation
FROM public.financial_obligations fo
LEFT JOIN public.settlement_items si ON fo.id = si.obligation_id
LEFT JOIN public.settlement_records sr ON si.settlement_id = sr.id
GROUP BY fo.id, fo.shipment_id, fo.obligation_type, fo.original_amount
HAVING COALESCE(SUM(
    CASE 
        WHEN sr.status IN ('DRAFT', 'APPROVED', 'POSTED') THEN si.allocated_amount 
        ELSE 0.000 
    END
), 0.000) > fo.original_amount;

-- 9. Verify Accounting Period Boundary Violations (Must be 0)
SELECT je.id, je.entry_number, je.date, ap.period_name, ap.status AS period_status
FROM public.journal_entries je
JOIN public.accounting_periods ap 
  ON je.tenant_id = ap.tenant_id 
 AND je.date::DATE BETWEEN ap.start_date AND ap.end_date
WHERE ap.status IN ('CLOSED', 'LOCKED') AND je.created_at > ap.closed_at;

-- 10. Verify Zero Insecure Public/Anon Grants on Financial or Sensitive Tables (Must be 0)
SELECT table_name, privilege_type, grantee
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated', 'public')
  AND table_name IN ('journal_entries', 'journal_lines', 'vouchers', 'financial_obligations', 'settlement_records', 'settlement_items', 'accounting_periods', 'accounts', 'audit_logs', 'revoked_sessions');

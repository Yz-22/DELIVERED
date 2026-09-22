-- ============================================================================
-- DELIVERE ENTERPRISE — STEP 6.3H REMOTE DATABASE PREFLIGHT AUDIT
-- TARGET ENVIRONMENT: DEVELOPMENT_STAGING / SUPABASE SQL EDITOR
-- SCRIPT ID: 20260922_step6_3h_remote_preflight.sql
-- 
-- SAFETY NOTICE:
-- - STRICTLY READ-ONLY: Contains ZERO DDL, DML, or state-changing operations.
-- - No INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, TRUNCATE, GRANT, or REVOKE.
-- - Safe for direct execution in Supabase SQL Editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SECTION 1: REQUIRED OBJECT EXISTENCE
-- ----------------------------------------------------------------------------
SELECT 
    t.required_table,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = t.required_table
        ) THEN 'PASS'
        ELSE 'FAIL'
    END AS existence_status
FROM (
    VALUES 
        ('products'),
        ('merchant_branches'),
        ('branch_inventory'),
        ('stock_movements'),
        ('merchant_stock_transfers'),
        ('merchant_stock_transfer_items')
) AS t(required_table)
ORDER BY t.required_table;

-- ----------------------------------------------------------------------------
-- SECTION 2: ACTUAL COLUMN CONTRACT FOR EXISTING TABLES
-- ----------------------------------------------------------------------------
WITH required_columns AS (
    SELECT * FROM (VALUES
        ('products', 'id', 'uuid'),
        ('products', 'tenant_id', 'uuid'),
        ('products', 'merchant_id', 'uuid'),
        ('products', 'cost_price', 'numeric'),

        ('merchant_branches', 'id', 'uuid'),
        ('merchant_branches', 'tenant_id', 'uuid'),
        ('merchant_branches', 'merchant_id', 'uuid'),
        ('merchant_branches', 'is_active', 'boolean'),
        ('merchant_branches', 'is_main', 'boolean'),
        ('merchant_branches', 'created_at', 'timestamp with time zone'),

        ('branch_inventory', 'tenant_id', 'uuid'),
        ('branch_inventory', 'merchant_id', 'uuid'),
        ('branch_inventory', 'branch_id', 'uuid'),
        ('branch_inventory', 'product_id', 'uuid'),
        ('branch_inventory', 'quantity', 'integer'),
        ('branch_inventory', 'updated_at', 'timestamp with time zone'),

        ('stock_movements', 'id', 'uuid'),
        ('stock_movements', 'tenant_id', 'uuid'),
        ('stock_movements', 'merchant_id', 'uuid'),
        ('stock_movements', 'branch_id', 'uuid'),
        ('stock_movements', 'product_id', 'uuid'),
        ('stock_movements', 'movement_type', 'USER-DEFINED'),
        ('stock_movements', 'quantity', 'integer'),
        ('stock_movements', 'balance_before', 'integer'),
        ('stock_movements', 'balance_after', 'integer'),
        ('stock_movements', 'unit_cost', 'numeric'),
        ('stock_movements', 'reference_type', 'text'),
        ('stock_movements', 'reference_id', 'text'),
        ('stock_movements', 'notes', 'text'),
        ('stock_movements', 'performed_by', 'uuid'),
        ('stock_movements', 'created_at', 'timestamp with time zone'),

        ('merchant_stock_transfers', 'id', 'uuid'),
        ('merchant_stock_transfers', 'tenant_id', 'uuid'),
        ('merchant_stock_transfers', 'merchant_id', 'uuid'),
        ('merchant_stock_transfers', 'source_branch_id', 'uuid'),
        ('merchant_stock_transfers', 'destination_branch_id', 'uuid'),
        ('merchant_stock_transfers', 'status', 'USER-DEFINED'),
        ('merchant_stock_transfers', 'notes', 'text'),
        ('merchant_stock_transfers', 'created_by', 'uuid'),
        ('merchant_stock_transfers', 'created_at', 'timestamp with time zone'),
        ('merchant_stock_transfers', 'updated_at', 'timestamp with time zone'),

        ('merchant_stock_transfer_items', 'id', 'uuid'),
        ('merchant_stock_transfer_items', 'tenant_id', 'uuid'),
        ('merchant_stock_transfer_items', 'merchant_id', 'uuid'),
        ('merchant_stock_transfer_items', 'transfer_id', 'uuid'),
        ('merchant_stock_transfer_items', 'product_id', 'uuid'),
        ('merchant_stock_transfer_items', 'quantity', 'integer'),
        ('merchant_stock_transfer_items', 'unit_cost', 'numeric'),
        ('merchant_stock_transfer_items', 'created_at', 'timestamp with time zone')
    ) AS r(table_name, column_name, expected_type)
)
SELECT 
    rc.table_name,
    rc.column_name,
    rc.expected_type,
    c.data_type AS actual_type,
    c.udt_name AS actual_udt,
    c.is_nullable,
    c.column_default,
    CASE 
        WHEN c.column_name IS NULL THEN 'FAIL_MISSING_COLUMN'
        WHEN c.data_type = rc.expected_type OR (rc.expected_type = 'USER-DEFINED' AND c.data_type = 'USER-DEFINED') THEN 'PASS'
        ELSE 'FAIL_TYPE_MISMATCH'
    END AS status
FROM required_columns rc
LEFT JOIN information_schema.columns c 
    ON c.table_schema = 'public' 
    AND c.table_name = rc.table_name 
    AND c.column_name = rc.column_name
ORDER BY rc.table_name, rc.column_name;

-- ----------------------------------------------------------------------------
-- SECTION 3: ACTUAL ENUM CONTRACT (DYNAMIC TRANSFER STATUS & MOVEMENT TYPES)
-- ----------------------------------------------------------------------------
-- 3A. Dynamically discover actual type of merchant_stock_transfers.status and inspect enum values
WITH status_col AS (
    SELECT 
        n.nspname AS status_column_type_schema,
        t.typname AS status_column_type_name,
        t.oid AS status_type_oid,
        (t.typtype = 'e') AS status_is_enum
    FROM pg_attribute a
    JOIN pg_class c ON a.attrelid = c.oid
    JOIN pg_namespace cn ON c.relnamespace = cn.oid
    JOIN pg_type t ON a.atttypid = t.oid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE cn.nspname = 'public' 
      AND c.relname = 'merchant_stock_transfers' 
      AND a.attname = 'status'
      AND NOT a.attisdropped
)
SELECT 
    sc.status_column_type_schema,
    sc.status_column_type_name,
    sc.status_is_enum,
    e.enumlabel AS enum_value,
    e.enumsortorder AS sort_order,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_enum e2 
            WHERE e2.enumtypid = sc.status_type_oid AND e2.enumlabel = 'COMPLETED'
        ) THEN 'YES'
        ELSE 'NO'
    END AS completed_exists
FROM status_col sc
LEFT JOIN pg_enum e ON sc.status_type_oid = e.enumtypid
ORDER BY e.enumsortorder;

-- 3B. Inspect public.stock_movement_type enum values
SELECT 
    t.typname AS enum_name,
    e.enumlabel AS enum_value,
    e.enumsortorder AS sort_order,
    CASE 
        WHEN e.enumlabel IN ('TRANSFER_OUT', 'TRANSFER_IN', 'ADJUSTMENT_ADD', 'ADJUSTMENT_REMOVE') THEN 'PASS_REQUIRED_MOVEMENT'
        ELSE 'OTHER_MOVEMENT'
    END AS classification
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public' 
  AND t.typname = 'stock_movement_type'
ORDER BY e.enumsortorder;

-- ----------------------------------------------------------------------------
-- SECTION 4: EXACT ON CONFLICT COMPATIBILITY FOR branch_inventory (branch_id, product_id)
-- ----------------------------------------------------------------------------
SELECT 
    i.relname AS index_name,
    string_agg(a.attname, ', ' ORDER BY array_position(ix.indkey, a.attnum)) AS index_columns,
    ix.indisunique AS is_unique,
    (ix.indpred IS NOT NULL) AS is_partial,
    CASE 
        WHEN ix.indisunique = true 
         AND ix.indpred IS NULL 
         AND string_agg(a.attname, ', ' ORDER BY array_position(ix.indkey, a.attnum)) = 'branch_id, product_id'
        THEN 'YES'
        ELSE 'NO'
    END AS on_conflict_branch_product_supported
FROM pg_class t
JOIN pg_namespace n ON n.oid = t.relnamespace
JOIN pg_index ix ON t.oid = ix.indrelid
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
WHERE n.nspname = 'public' 
  AND t.relname = 'branch_inventory'
GROUP BY i.relname, ix.indisunique, ix.indpred;

-- ----------------------------------------------------------------------------
-- SECTION 5: EXISTING 6.3H OBJECT COLLISION AUDIT & FULL FUNCTION DEF INSPECTION
-- ----------------------------------------------------------------------------
-- Check idempotency table existence
SELECT 
    'table: inventory_idempotency_keys' AS object_identifier,
    EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'inventory_idempotency_keys'
    ) AS object_exists,
    (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory_idempotency_keys') AS column_count;

-- Check execute_stock_adjustment & execute_stock_transfer full metadata & definitions
SELECT 
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS identity_arguments,
    pg_get_function_result(p.oid) AS function_result,
    p.prosecdef AS is_security_definer,
    pg_get_userbyid(p.proowner) AS function_owner,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' 
  AND p.proname IN ('execute_stock_adjustment', 'execute_stock_transfer');

-- ----------------------------------------------------------------------------
-- SECTION 6: DATA INTEGRITY PREFLIGHT
-- ----------------------------------------------------------------------------
-- A. Negative stock balances in branch_inventory
SELECT 'A_negative_stock_rows' AS check_name, count(*) AS violation_count
FROM public.branch_inventory
WHERE quantity < 0;

-- B. Duplicate branch_inventory rows grouped by (branch_id, product_id)
SELECT 'B_duplicate_branch_product_rows' AS check_name, count(*) AS violation_count
FROM (
    SELECT branch_id, product_id, count(*) AS cnt
    FROM public.branch_inventory
    GROUP BY branch_id, product_id
    HAVING count(*) > 1
) sub;

-- C. Orphan branch_id in branch_inventory (no matching merchant_branches.id)
SELECT 'C_orphan_branch_rows' AS check_name, count(*) AS violation_count
FROM public.branch_inventory bi
LEFT JOIN public.merchant_branches mb ON mb.id = bi.branch_id
WHERE mb.id IS NULL;

-- D. Orphan product_id in branch_inventory (no matching products.id)
SELECT 'D_orphan_product_rows' AS check_name, count(*) AS violation_count
FROM public.branch_inventory bi
LEFT JOIN public.products p ON p.id = bi.product_id
WHERE p.id IS NULL;

-- E. Tenant mismatch between branch_inventory and merchant_branches
SELECT 'E_tenant_mismatch_with_branch' AS check_name, count(*) AS violation_count
FROM public.branch_inventory bi
JOIN public.merchant_branches mb ON mb.id = bi.branch_id
WHERE bi.tenant_id <> mb.tenant_id;

-- F. Merchant mismatch between branch_inventory and merchant_branches
SELECT 'F_merchant_mismatch_with_branch' AS check_name, count(*) AS violation_count
FROM public.branch_inventory bi
JOIN public.merchant_branches mb ON mb.id = bi.branch_id
WHERE bi.merchant_id <> mb.merchant_id;

-- G. Tenant mismatch between branch_inventory and products
SELECT 'G_tenant_mismatch_with_product' AS check_name, count(*) AS violation_count
FROM public.branch_inventory bi
JOIN public.products p ON p.id = bi.product_id
WHERE bi.tenant_id <> p.tenant_id;

-- H. Merchant mismatch between branch_inventory and products
SELECT 'H_merchant_mismatch_with_product' AS check_name, count(*) AS violation_count
FROM public.branch_inventory bi
JOIN public.products p ON p.id = bi.product_id
WHERE bi.merchant_id <> p.merchant_id;

-- I. Cross-check product and branch merchant consistency in stock transfers (if any exist)
SELECT 'I_transfers_with_mismatched_branches' AS check_name, count(*) AS violation_count
FROM public.merchant_stock_transfers t
WHERE t.source_branch_id = t.destination_branch_id;

-- ----------------------------------------------------------------------------
-- SECTION 7: FOREIGN KEY & NOT NULL REALITY (UNPROVIDED COLUMNS AUDIT)
-- ----------------------------------------------------------------------------
-- Identifies any column in the 4 target tables that is NOT NULL, has NO default,
-- and is NOT provided by the 6.3H RPC INSERT statements.
WITH rpc_provided_columns AS (
    SELECT * FROM (VALUES
        -- branch_inventory INSERT
        ('branch_inventory', 'tenant_id'),
        ('branch_inventory', 'merchant_id'),
        ('branch_inventory', 'branch_id'),
        ('branch_inventory', 'product_id'),
        ('branch_inventory', 'quantity'),

        -- stock_movements INSERT
        ('stock_movements', 'id'),
        ('stock_movements', 'tenant_id'),
        ('stock_movements', 'merchant_id'),
        ('stock_movements', 'branch_id'),
        ('stock_movements', 'product_id'),
        ('stock_movements', 'movement_type'),
        ('stock_movements', 'quantity'),
        ('stock_movements', 'balance_before'),
        ('stock_movements', 'balance_after'),
        ('stock_movements', 'unit_cost'),
        ('stock_movements', 'reference_type'),
        ('stock_movements', 'reference_id'),
        ('stock_movements', 'reference_number'),
        ('stock_movements', 'notes'),
        ('stock_movements', 'performed_by'),
        ('stock_movements', 'created_at'),

        -- merchant_stock_transfers INSERT
        ('merchant_stock_transfers', 'id'),
        ('merchant_stock_transfers', 'tenant_id'),
        ('merchant_stock_transfers', 'merchant_id'),
        ('merchant_stock_transfers', 'source_branch_id'),
        ('merchant_stock_transfers', 'destination_branch_id'),
        ('merchant_stock_transfers', 'status'),
        ('merchant_stock_transfers', 'notes'),
        ('merchant_stock_transfers', 'created_by'),
        ('merchant_stock_transfers', 'created_at'),
        ('merchant_stock_transfers', 'updated_at'),

        -- merchant_stock_transfer_items INSERT
        ('merchant_stock_transfer_items', 'id'),
        ('merchant_stock_transfer_items', 'tenant_id'),
        ('merchant_stock_transfer_items', 'merchant_id'),
        ('merchant_stock_transfer_items', 'transfer_id'),
        ('merchant_stock_transfer_items', 'product_id'),
        ('merchant_stock_transfer_items', 'quantity'),
        ('merchant_stock_transfer_items', 'unit_cost'),
        ('merchant_stock_transfer_items', 'created_at')
    ) AS p(table_name, column_name)
)
SELECT 
    c.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default,
    CASE 
        WHEN p.column_name IS NOT NULL THEN 'PROVIDED_BY_RPC'
        WHEN c.column_default IS NOT NULL THEN 'HAS_DEFAULT'
        WHEN c.is_nullable = 'YES' THEN 'NULLABLE'
        ELSE 'BLOCKER_UNPROVIDED_NOT_NULL_NO_DEFAULT'
    END AS insert_safety_evaluation
FROM information_schema.columns c
LEFT JOIN rpc_provided_columns p 
    ON p.table_name = c.table_name 
    AND p.column_name = c.column_name
WHERE c.table_schema = 'public' 
  AND c.table_name IN ('branch_inventory', 'stock_movements', 'merchant_stock_transfers', 'merchant_stock_transfer_items')
ORDER BY insert_safety_evaluation DESC, c.table_name, c.column_name;

-- ----------------------------------------------------------------------------
-- SECTION 8: FUNCTION PRIVILEGE & ROLE EXISTENCE
-- ----------------------------------------------------------------------------
SELECT 
    r.target_role,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r.target_role) THEN 'EXISTS'
        ELSE 'MISSING'
    END AS role_status
FROM (
    VALUES 
        ('anon'),
        ('authenticated'),
        ('service_role')
) AS r(target_role);

-- ----------------------------------------------------------------------------
-- SECTION 9: EXTENSION & FUNCTION SUPPORT
-- ----------------------------------------------------------------------------
SELECT 
    f.target_function,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc p 
            JOIN pg_namespace n ON n.oid = p.pronamespace 
            WHERE p.proname = f.target_function
        ) THEN 'SUPPORTED'
        ELSE 'MISSING'
    END AS function_status,
    (
        SELECT string_agg(pg_get_function_identity_arguments(p.oid), ' | ')
        FROM pg_proc p
        WHERE p.proname = f.target_function
    ) AS available_signatures
FROM (
    VALUES 
        ('gen_random_uuid'),
        ('md5'),
        ('pg_advisory_xact_lock')
) AS f(target_function);

-- ----------------------------------------------------------------------------
-- SECTION 10: OPTIONAL COLUMNS / PREVIOUS MIGRATION EXTENSION AUDIT
-- ----------------------------------------------------------------------------
SELECT 
    target.table_name,
    target.column_name,
    CASE 
        WHEN c.column_name IS NOT NULL THEN 'ALREADY_EXISTS'
        ELSE 'NOT_YET_ADDED_EXPECTED_BY_6_3H'
    END AS existence_status,
    c.data_type,
    c.column_default,
    c.is_nullable
FROM (
    VALUES 
        ('products', 'min_stock_alert'),
        ('products', 'unit'),
        ('products', 'location_rack'),
        ('products', 'notes'),
        ('stock_movements', 'reference_number')
) AS target(table_name, column_name)
LEFT JOIN information_schema.columns c 
    ON c.table_schema = 'public' 
    AND c.table_name = target.table_name 
    AND c.column_name = target.column_name;

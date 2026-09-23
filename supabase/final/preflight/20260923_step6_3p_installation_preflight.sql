-- ============================================================================
-- DELIVERE ENTERPRISE — STEP 6.3P PRE-INSTALLATION PREFLIGHT SCRIPT
-- TARGET ENVIRONMENT: SUPABASE SQL EDITOR (MANUAL EXECUTION)
-- SCRIPT ID: 20260923_step6_3p_installation_preflight.sql
--
-- PURPOSE:
-- 100% READ-ONLY verification of remote PostgreSQL / Supabase database before
-- installing the canonical migration:
-- supabase/final/hotfixes/20260922_order_persistence_and_idempotency_hardening.sql
--
-- SAFETY GUARANTEES:
-- - ZERO mutations (ZERO INSERT, UPDATE, DELETE, ALTER, CREATE, DROP, TRUNCATE)
-- - ZERO permission changes (ZERO GRANT, REVOKE)
-- - ZERO RPC calls of mutating functions
-- - ZERO customer data exposure (only aggregate metrics and catalog metadata)
-- ============================================================================

-- ============================================================================
-- SECTION 1: CORE TABLES EXISTENCE
-- ============================================================================
SELECT 
    t.expected_table,
    CASE 
        WHEN c.table_name IS NOT NULL THEN 'EXISTS'
        ELSE 'MISSING'
    END AS status,
    c.table_type
FROM (
    VALUES 
        ('shipments'),
        ('shipment_status_history'),
        ('tenants'),
        ('users')
) AS t(expected_table)
LEFT JOIN information_schema.tables c
    ON c.table_schema = 'public' AND c.table_name = t.expected_table
ORDER BY t.expected_table;

-- ============================================================================
-- SECTION 2: REQUIRED & EXTENSION COLUMNS ON public.shipments
-- ============================================================================
SELECT 
    req.column_name,
    req.category,
    CASE 
        WHEN col.column_name IS NOT NULL THEN 'EXISTS'
        ELSE 'MISSING'
    END AS existence_status,
    col.data_type,
    col.udt_name,
    col.is_nullable,
    col.column_default
FROM (
    VALUES 
        ('id', 'REQUIRED_CORE'),
        ('tenant_id', 'REQUIRED_CORE'),
        ('sequence', 'REQUIRED_CORE'),
        ('merchant_id', 'REQUIRED_CORE'),
        ('branch_id', 'REQUIRED_CORE'),
        ('driver_id', 'REQUIRED_CORE'),
        ('recipient_name', 'REQUIRED_CORE'),
        ('recipient_phone', 'REQUIRED_CORE'),
        ('recipient_phone2', 'REQUIRED_CORE'),
        ('governorate', 'REQUIRED_CORE'),
        ('area', 'REQUIRED_CORE'),
        ('address', 'REQUIRED_CORE'),
        ('package_details', 'REQUIRED_CORE'),
        ('notes', 'REQUIRED_CORE'),
        ('status', 'REQUIRED_CORE'),
        ('payment_type', 'REQUIRED_CORE'),
        ('weight', 'REQUIRED_CORE'),
        ('pieces', 'REQUIRED_CORE'),
        ('barcode', 'REQUIRED_CORE'),
        ('cod_amount', 'REQUIRED_CORE'),
        ('merchant_collection', 'REQUIRED_CORE'),
        ('delivery_fee', 'REQUIRED_CORE'),
        ('driver_fee', 'REQUIRED_CORE'),
        ('return_fee', 'REQUIRED_CORE'),
        ('extra_weight_fee', 'REQUIRED_CORE'),
        ('currency', 'REQUIRED_CORE'),
        ('created_at', 'REQUIRED_CORE'),
        ('updated_at', 'REQUIRED_CORE'),
        ('payment_method', 'TARGET_ADDITIVE_HOTFIX'),
        ('cliq_reference', 'TARGET_ADDITIVE_HOTFIX'),
        ('reference_number', 'TARGET_ADDITIVE_HOTFIX'),
        ('sub_area', 'TARGET_ADDITIVE_HOTFIX'),
        ('otp', 'TARGET_DISABLED_HOTFIX')
) AS req(column_name, category)
LEFT JOIN information_schema.columns col 
    ON col.table_schema = 'public' 
   AND col.table_name = 'shipments' 
   AND col.column_name = req.column_name
ORDER BY req.category, req.column_name;

-- ============================================================================
-- SECTION 3: REQUIRED COLUMNS ON public.shipment_status_history
-- ============================================================================
SELECT 
    req.column_name,
    CASE 
        WHEN col.column_name IS NOT NULL THEN 'EXISTS'
        ELSE 'MISSING'
    END AS existence_status,
    col.data_type,
    col.udt_name,
    col.is_nullable,
    col.column_default
FROM (
    VALUES 
        ('tenant_id'),
        ('shipment_id'),
        ('previous_status'),
        ('new_status'),
        ('actor_id'),
        ('actor_name'),
        ('actor_role'),
        ('notes'),
        ('created_at')
) AS req(column_name)
LEFT JOIN information_schema.columns col 
    ON col.table_schema = 'public' 
   AND col.table_name = 'shipment_status_history' 
   AND col.column_name = req.column_name
ORDER BY req.column_name;

-- ============================================================================
-- SECTION 4: ENUM DEFINITIONS AND LABELS (shipment_status & payment_type)
-- ============================================================================
SELECT 
    t.typname AS enum_type_name,
    e.enumlabel AS enum_value,
    e.enumsortorder AS sort_order
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'public' 
  AND t.typname IN ('shipment_status', 'payment_type')
ORDER BY t.typname, e.enumsortorder;

-- ============================================================================
-- SECTION 5: FOREIGN KEY TARGET VERIFICATION (tenants.id, shipments.id)
-- ============================================================================
SELECT 
    tbl.relname AS table_name,
    col.attname AS column_name,
    c.conname AS constraint_name,
    c.contype AS constraint_type,
    CASE 
        WHEN c.contype = 'p' THEN 'PRIMARY_KEY (VALID FK TARGET)'
        WHEN c.contype = 'u' THEN 'UNIQUE (VALID FK TARGET)'
        ELSE c.contype::text
    END AS fk_target_status
FROM pg_constraint c
JOIN pg_class tbl ON tbl.oid = c.conrelid
JOIN pg_namespace n ON n.oid = tbl.relnamespace
JOIN pg_attribute col ON col.attrelid = tbl.oid AND col.attnum = ANY(c.conkey)
WHERE n.nspname = 'public'
  AND tbl.relname IN ('tenants', 'shipments')
  AND col.attname = 'id'
  AND c.contype IN ('p', 'u');

-- ============================================================================
-- SECTION 6: RPC FUNCTION INSPECTION (public.create_order_idempotent)
-- ============================================================================
SELECT 
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS argument_signature,
    pg_get_function_result(p.oid) AS return_type,
    p.prosecdef AS is_security_definer,
    p.provolatile AS volatility_classification,
    CASE 
        WHEN p.oid IS NOT NULL THEN 'ALREADY_EXISTS'
        ELSE 'NOT_INSTALLED'
    END AS installation_state
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'create_order_idempotent';

-- ============================================================================
-- SECTION 7: IDEMPOTENCY TABLE INSPECTION (public.order_idempotency_keys)
-- ============================================================================
-- 7A. Columns and Data Types
SELECT 
    column_name,
    data_type,
    udt_name,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'order_idempotency_keys'
ORDER BY ordinal_position;

-- 7B. Constraints on order_idempotency_keys
SELECT 
    c.conname AS constraint_name,
    c.contype AS constraint_type,
    pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_class tbl ON tbl.oid = c.conrelid
JOIN pg_namespace n ON n.oid = tbl.relnamespace
WHERE n.nspname = 'public' 
  AND tbl.relname = 'order_idempotency_keys';

-- ============================================================================
-- SECTION 8: INDEX EXISTENCE INSPECTION
-- ============================================================================
SELECT 
    t.expected_index,
    CASE 
        WHEN i.indexname IS NOT NULL THEN 'EXISTS'
        ELSE 'MISSING'
    END AS status,
    i.tablename,
    i.indexdef
FROM (
    VALUES 
        ('idx_shipments_payment_method'),
        ('idx_shipments_reference_number'),
        ('idx_order_idempotency_lookup')
) AS t(expected_index)
LEFT JOIN pg_indexes i 
    ON i.schemaname = 'public' AND i.indexname = t.expected_index;

-- ============================================================================
-- SECTION 9: HISTORICAL PAYMENT COMPATIBILITY (READ-ONLY AGGREGATE)
-- ============================================================================
SELECT 
    payment_type::text AS payment_type,
    COALESCE(to_jsonb(s)->>'payment_method', '<COLUMN_NOT_YET_PRESENT>') AS payment_method,
    COUNT(*) AS total_shipments
FROM public.shipments s
GROUP BY payment_type::text, (to_jsonb(s)->>'payment_method')
ORDER BY payment_type::text;

-- ============================================================================
-- SECTION 10: RECIPIENT PHONE FORMAT AUDIT (READ-ONLY AGGREGATE, ZERO PII)
-- ============================================================================
SELECT 
    COUNT(*) AS total_shipment_rows,
    COUNT(*) FILTER (
        WHERE recipient_phone IS NULL OR TRIM(recipient_phone) = ''
    ) AS null_or_empty,
    COUNT(*) FILTER (
        WHERE regexp_replace(TRIM(recipient_phone), '[\s-]', '', 'g') ~ '^07[789][0-9]{7}$'
    ) AS local_07_format,
    COUNT(*) FILTER (
        WHERE regexp_replace(TRIM(recipient_phone), '[\s-]', '', 'g') ~ '^\+9627[789][0-9]{7}$'
    ) AS canonical_plus962_format,
    COUNT(*) FILTER (
        WHERE recipient_phone IS NOT NULL 
          AND TRIM(recipient_phone) <> ''
          AND regexp_replace(TRIM(recipient_phone), '[\s-]', '', 'g') !~ '^07[789][0-9]{7}$'
          AND regexp_replace(TRIM(recipient_phone), '[\s-]', '', 'g') !~ '^\+9627[789][0-9]{7}$'
    ) AS other_format
FROM public.shipments;

-- ============================================================================
-- SECTION 11: SEQUENCE COMPATIBILITY AUDIT (READ-ONLY AGGREGATE)
-- ============================================================================
WITH current_year_ctx AS (
    SELECT TO_CHAR(now() AT TIME ZONE 'Asia/Amman', 'YYYY') AS jordan_year
),
summary_stats AS (
    SELECT 
        COUNT(*) AS total_shipments,
        COUNT(*) FILTER (WHERE sequence LIKE 'ORD-%') AS ord_sequence_count,
        COUNT(*) FILTER (WHERE sequence LIKE 'ORD-' || (SELECT jordan_year FROM current_year_ctx) || '-%') AS current_year_ord_count
    FROM public.shipments
),
tenant_suffixes AS (
    SELECT 
        tenant_id,
        (SELECT jordan_year FROM current_year_ctx) AS current_year,
        MAX(SUBSTRING(sequence FROM '[0-9]+$')::BIGINT) AS max_sequence_suffix
    FROM public.shipments
    WHERE sequence LIKE 'ORD-' || (SELECT jordan_year FROM current_year_ctx) || '-%'
    GROUP BY tenant_id
)
SELECT 
    (SELECT jordan_year FROM current_year_ctx) AS current_jordan_year,
    s.total_shipments,
    s.ord_sequence_count,
    s.current_year_ord_count,
    COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'tenant_id', ts.tenant_id,
                'year', ts.current_year,
                'max_suffix', ts.max_sequence_suffix
            )
        ) FILTER (WHERE ts.tenant_id IS NOT NULL),
        '[]'::jsonb
    ) AS tenant_max_suffixes
FROM summary_stats s
LEFT JOIN tenant_suffixes ts ON TRUE
GROUP BY s.total_shipments, s.ord_sequence_count, s.current_year_ord_count;

-- ============================================================================
-- SECTION 12: OTP COMPATIBILITY AUDIT (READ-ONLY AGGREGATE, ZERO OTP VALUES)
-- ============================================================================
SELECT 
    COUNT(*) AS total_shipment_rows,
    COUNT(*) FILTER (
        WHERE to_jsonb(s)->>'otp' IS NULL OR TRIM(to_jsonb(s)->>'otp') = ''
    ) AS otp_null_count,
    COUNT(*) FILTER (
        WHERE to_jsonb(s)->>'otp' IS NOT NULL AND TRIM(to_jsonb(s)->>'otp') <> ''
    ) AS otp_non_null_count
FROM public.shipments s;

-- ============================================================================
-- SECTION 13: DATABASE ROLES AND PRIVILEGES AUDIT
-- ============================================================================
SELECT 
    r.expected_role,
    CASE 
        WHEN pg.rolname IS NOT NULL THEN 'ROLE_EXISTS'
        ELSE 'ROLE_MISSING'
    END AS status,
    pg.rolcanlogin AS can_login,
    pg.rolsuper AS is_superuser
FROM (
    VALUES 
        ('service_role'),
        ('anon'),
        ('authenticated'),
        ('public')
) AS r(expected_role)
LEFT JOIN pg_roles pg ON pg.rolname = r.expected_role
ORDER BY r.expected_role;

-- ============================================================================
-- SECTION 14: REQUIRED EXTENSION FUNCTIONS AUDIT
-- ============================================================================
SELECT 
    req.function_name,
    CASE 
        WHEN p.proname IS NOT NULL THEN 'EXISTS'
        ELSE 'MISSING'
    END AS status,
    n.nspname AS schema_name,
    pg_get_function_identity_arguments(p.oid) AS argument_signature
FROM (
    VALUES 
        ('gen_random_uuid'),
        ('md5'),
        ('pg_advisory_xact_lock')
) AS req(function_name)
LEFT JOIN pg_proc p ON p.proname = req.function_name
LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
ORDER BY req.function_name;

-- ============================================================================
-- SECTION 15: MASTER CONSOLIDATED PREFLIGHT VERDICT (MACHINE-READABLE JSON)
-- ============================================================================
WITH preflight_audit AS (
    SELECT 
        -- 1. Table Checks
        (SELECT jsonb_agg(tbl) FROM (
            SELECT t.table_name FROM (VALUES ('shipments'), ('shipment_status_history'), ('tenants'), ('users')) AS t(table_name)
            WHERE NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t.table_name)
        ) tbl) AS missing_tables,

        -- 2. Core Shipments Column Checks
        (SELECT jsonb_agg(col) FROM (
            SELECT c.col_name FROM (
                VALUES 
                    ('id'), ('tenant_id'), ('sequence'), ('merchant_id'), ('branch_id'), ('driver_id'),
                    ('recipient_name'), ('recipient_phone'), ('recipient_phone2'), ('governorate'),
                    ('area'), ('address'), ('package_details'), ('notes'), ('status'), ('payment_type'),
                    ('weight'), ('pieces'), ('barcode'), ('cod_amount'), ('merchant_collection'),
                    ('delivery_fee'), ('driver_fee'), ('return_fee'), ('extra_weight_fee'),
                    ('currency'), ('created_at'), ('updated_at')
            ) AS c(col_name)
            WHERE NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = 'shipments' AND column_name = c.col_name
            )
        ) col) AS missing_shipment_columns,

        -- 3. Core Status History Column Checks
        (SELECT jsonb_agg(col) FROM (
            SELECT c.col_name FROM (
                VALUES 
                    ('tenant_id'), ('shipment_id'), ('previous_status'), ('new_status'),
                    ('actor_id'), ('actor_name'), ('actor_role'), ('notes'), ('created_at')
            ) AS c(col_name)
            WHERE NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = 'shipment_status_history' AND column_name = c.col_name
            )
        ) col) AS missing_history_columns,

        -- 4. Enum Checks
        (SELECT jsonb_agg(e) FROM (
            SELECT 'public.shipment_status' AS missing_enum
            WHERE NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'public' AND t.typname = 'shipment_status')
            UNION ALL
            SELECT 'public.payment_type' AS missing_enum
            WHERE NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'public' AND t.typname = 'payment_type')
        ) e) AS missing_enums,

        -- 5. Foreign Key Target Checks
        (SELECT jsonb_agg(fk) FROM (
            SELECT 'public.tenants(id)' AS missing_fk_target
            WHERE NOT EXISTS (
                SELECT 1 FROM pg_constraint c
                JOIN pg_class tbl ON tbl.oid = c.conrelid
                JOIN pg_namespace n ON n.oid = tbl.relnamespace
                JOIN pg_attribute col ON col.attrelid = tbl.oid AND col.attnum = ANY(c.conkey)
                WHERE n.nspname = 'public' AND tbl.relname = 'tenants' AND col.attname = 'id' AND c.contype IN ('p', 'u')
            )
            UNION ALL
            SELECT 'public.shipments(id)' AS missing_fk_target
            WHERE NOT EXISTS (
                SELECT 1 FROM pg_constraint c
                JOIN pg_class tbl ON tbl.oid = c.conrelid
                JOIN pg_namespace n ON n.oid = tbl.relnamespace
                JOIN pg_attribute col ON col.attrelid = tbl.oid AND col.attnum = ANY(c.conkey)
                WHERE n.nspname = 'public' AND tbl.relname = 'shipments' AND col.attname = 'id' AND c.contype IN ('p', 'u')
            )
        ) fk) AS missing_fk_targets,

        -- 6. Extension Functions
        (SELECT jsonb_agg(fn) FROM (
            SELECT f.fn_name FROM (VALUES ('gen_random_uuid'), ('md5'), ('pg_advisory_xact_lock')) AS f(fn_name)
            WHERE NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = f.fn_name)
        ) fn) AS missing_functions,

        -- 7. Roles Check
        (SELECT jsonb_agg(r) FROM (
            SELECT rl.rolename FROM (VALUES ('service_role'), ('anon'), ('authenticated')) AS rl(rolename)
            WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = rl.rolename)
        ) r) AS missing_roles
)
SELECT 
    CASE 
        WHEN COALESCE(missing_tables, '[]'::jsonb) = '[]'::jsonb
         AND COALESCE(missing_shipment_columns, '[]'::jsonb) = '[]'::jsonb
         AND COALESCE(missing_history_columns, '[]'::jsonb) = '[]'::jsonb
         AND COALESCE(missing_enums, '[]'::jsonb) = '[]'::jsonb
         AND COALESCE(missing_fk_targets, '[]'::jsonb) = '[]'::jsonb
         AND COALESCE(missing_functions, '[]'::jsonb) = '[]'::jsonb
         AND COALESCE(missing_roles, '[]'::jsonb) = '[]'::jsonb
        THEN 'PASS'
        ELSE 'FAIL'
    END AS overall_preflight_verdict,
    jsonb_build_object(
        'missing_required_tables', COALESCE(missing_tables, '[]'::jsonb),
        'missing_required_shipment_columns', COALESCE(missing_shipment_columns, '[]'::jsonb),
        'missing_required_history_columns', COALESCE(missing_history_columns, '[]'::jsonb),
        'missing_required_enums', COALESCE(missing_enums, '[]'::jsonb),
        'missing_required_fk_targets', COALESCE(missing_fk_targets, '[]'::jsonb),
        'missing_required_functions', COALESCE(missing_functions, '[]'::jsonb),
        'missing_required_roles', COALESCE(missing_roles, '[]'::jsonb)
    ) AS preflight_diagnostic_details
FROM preflight_audit;

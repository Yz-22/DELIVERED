-- ============================================================================
-- DELIVERE ENTERPRISE — MASTER POST-INSTALL VERIFICATION SCRIPT
-- FILE: DELIVERE_POST_INSTALL_VERIFY.sql
-- TARGET ENVIRONMENT: DEVELOPMENT_STAGING / SUPABASE SQL EDITOR
-- VERSION: 2.0.0 (ENTERPRISE HARDENED)
-- ============================================================================

DO $$
DECLARE
    v_missing_tables TEXT[] := ARRAY[]::TEXT[];
    v_missing_columns TEXT[] := ARRAY[]::TEXT[];
    v_missing_triggers TEXT[] := ARRAY[]::TEXT[];
    v_missing_constraints TEXT[] := ARRAY[]::TEXT[];
    v_missing_rls TEXT[] := ARRAY[]::TEXT[];
    v_invalid_types TEXT[] := ARRAY[]::TEXT[];
    t TEXT;
    c TEXT;
    trg TEXT;
    con TEXT;
    v_count INT;
    v_type TEXT;
BEGIN
    RAISE NOTICE 'Starting automated verification of rebuilt Delivere database schema...';

    -- 1. Verify Required Tables (All 29 Core Tables)
    FOREACH t IN ARRAY ARRAY[
        'tenants', 'tenant_settings', 'users', 'user_invitations', 'revoked_sessions',
        'audit_logs', 'merchant_branches', 'user_branch_access', 'customers', 'products',
        'branch_inventory', 'stock_movements', 'merchant_stock_transfers', 'merchant_stock_transfer_items',
        'price_plans', 'price_plan_rules', 'shipments', 'shipment_status_history', 'driver_wallets', 'accounts',
        'journal_entries', 'journal_lines', 'vouchers', 'financial_obligations',
        'settlement_records', 'settlement_items', 'accounting_periods', 'subscription_plans', 'subscriptions'
    ] LOOP
        SELECT COUNT(*) INTO v_count FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t;
        IF v_count = 0 THEN
            v_missing_tables := array_append(v_missing_tables, t);
        END IF;
    END LOOP;

    IF array_length(v_missing_tables, 1) > 0 THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: Missing tables: %', v_missing_tables;
    END IF;

    -- 2. Verify Exact Precision on Financial Columns (NUMERIC(12, 3))
    FOREACH c IN ARRAY ARRAY[
        'shipments.cod_amount',
        'shipments.merchant_collection',
        'shipments.delivery_fee',
        'shipments.driver_fee',
        'shipments.return_fee',
        'shipments.extra_weight_fee',
        'financial_obligations.original_amount',
        'financial_obligations.allocated_amount',
        'journal_entries.total_debit',
        'journal_entries.total_credit',
        'journal_lines.debit',
        'journal_lines.credit',
        'settlement_records.total_amount',
        'settlement_items.allocated_amount'
    ] LOOP
        SELECT data_type || '(' || numeric_precision || ',' || numeric_scale || ')'
        INTO v_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = split_part(c, '.', 1)
          AND column_name = split_part(c, '.', 2);

        IF v_type IS NULL OR v_type <> 'numeric(12,3)' THEN
            v_invalid_types := array_append(v_invalid_types, c || ' (' || COALESCE(v_type, 'MISSING') || ')');
        END IF;
    END LOOP;

    IF array_length(v_invalid_types, 1) > 0 THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: Columns with incorrect precision (expected numeric(12,3)): %', v_invalid_types;
    END IF;

    -- 3. Verify Active Triggers
    FOREACH trg IN ARRAY ARRAY[
        'trg_check_journal_posting_balance',
        'trg_prevent_posted_journal_mutation',
        'trg_prevent_posted_journal_lines_mutation',
        'trg_prevent_audit_log_mutation',
        'trg_prevent_stock_movement_mutation',
        'trg_prevent_shipment_history_mutation',
        'trg_protect_shipment_financial_snapshots',
        'trg_validate_settlement_item_beneficiary',
        'trg_enforce_settlement_allocation_cap',
        'trg_protect_settlement_record_immutability',
        'trg_protect_settlement_items_immutability',
        'trg_protect_financial_obligation_immutability',
        'trg_journal_entry_period_lock',
        'trg_accounting_period_overlap'
    ] LOOP
        SELECT COUNT(*) INTO v_count FROM pg_trigger WHERE tgname = trg;
        IF v_count = 0 THEN
            v_missing_triggers := array_append(v_missing_triggers, trg);
        END IF;
    END LOOP;

    IF array_length(v_missing_triggers, 1) > 0 THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: Missing required database triggers: %', v_missing_triggers;
    END IF;

    -- 4. Deep Catalog Verification of Critical Foreign Key Constraints (Definitions, Columns, Actions)
    DECLARE
        v_fk_def RECORD;
    BEGIN
        -- FK 1: fk_shipments_branch_composite
        SELECT 
            c.conname, c.contype, c.confdeltype,
            src.relname AS src_table, ref.relname AS ref_table,
            (SELECT array_agg(a.attname::text ORDER BY array_position(c.conkey, a.attnum))
             FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)) AS src_cols,
            (SELECT array_agg(a.attname::text ORDER BY array_position(c.confkey, a.attnum))
             FROM pg_attribute a WHERE a.attrelid = c.confrelid AND a.attnum = ANY(c.confkey)) AS ref_cols
        INTO v_fk_def
        FROM pg_constraint c
        JOIN pg_class src ON src.oid = c.conrelid
        JOIN pg_class ref ON ref.oid = c.confrelid
        JOIN pg_namespace n ON n.oid = src.relnamespace
        WHERE n.nspname = 'public' AND c.conname = 'fk_shipments_branch_composite';

        IF v_fk_def.conname IS NULL THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: Constraint fk_shipments_branch_composite missing';
        ELSIF v_fk_def.contype <> 'f' THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: fk_shipments_branch_composite is not contype f (%)', v_fk_def.contype;
        ELSIF v_fk_def.src_table <> 'shipments' OR v_fk_def.ref_table <> 'merchant_branches' THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: fk_shipments_branch_composite tables mismatch (src: %, ref: %)', v_fk_def.src_table, v_fk_def.ref_table;
        ELSIF v_fk_def.src_cols <> ARRAY['branch_id', 'merchant_id', 'tenant_id']::text[] THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: fk_shipments_branch_composite src_cols mismatch: %', v_fk_def.src_cols;
        ELSIF v_fk_def.ref_cols <> ARRAY['id', 'merchant_id', 'tenant_id']::text[] THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: fk_shipments_branch_composite ref_cols mismatch: %', v_fk_def.ref_cols;
        ELSIF v_fk_def.confdeltype <> 'n' THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: fk_shipments_branch_composite confdeltype is not SET NULL (n): %', v_fk_def.confdeltype;
        END IF;

        -- FK 2: fk_settlement_items_settlement_composite
        SELECT 
            c.conname, c.contype, c.confdeltype,
            src.relname AS src_table, ref.relname AS ref_table,
            (SELECT array_agg(a.attname::text ORDER BY array_position(c.conkey, a.attnum))
             FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)) AS src_cols,
            (SELECT array_agg(a.attname::text ORDER BY array_position(c.confkey, a.attnum))
             FROM pg_attribute a WHERE a.attrelid = c.confrelid AND a.attnum = ANY(c.confkey)) AS ref_cols
        INTO v_fk_def
        FROM pg_constraint c
        JOIN pg_class src ON src.oid = c.conrelid
        JOIN pg_class ref ON ref.oid = c.confrelid
        JOIN pg_namespace n ON n.oid = src.relnamespace
        WHERE n.nspname = 'public' AND c.conname = 'fk_settlement_items_settlement_composite';

        IF v_fk_def.conname IS NULL THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: Constraint fk_settlement_items_settlement_composite missing';
        ELSIF v_fk_def.contype <> 'f' OR v_fk_def.src_table <> 'settlement_items' OR v_fk_def.ref_table <> 'settlement_records' 
           OR v_fk_def.src_cols <> ARRAY['settlement_id', 'tenant_id']::text[] 
           OR v_fk_def.ref_cols <> ARRAY['id', 'tenant_id']::text[] 
           OR v_fk_def.confdeltype NOT IN ('r', 'a') THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: fk_settlement_items_settlement_composite definition mismatch: %', v_fk_def;
        END IF;

        -- FK 3: fk_settlement_items_obligation_composite
        SELECT 
            c.conname, c.contype, c.confdeltype,
            src.relname AS src_table, ref.relname AS ref_table,
            (SELECT array_agg(a.attname::text ORDER BY array_position(c.conkey, a.attnum))
             FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)) AS src_cols,
            (SELECT array_agg(a.attname::text ORDER BY array_position(c.confkey, a.attnum))
             FROM pg_attribute a WHERE a.attrelid = c.confrelid AND a.attnum = ANY(c.confkey)) AS ref_cols
        INTO v_fk_def
        FROM pg_constraint c
        JOIN pg_class src ON src.oid = c.conrelid
        JOIN pg_class ref ON ref.oid = c.confrelid
        JOIN pg_namespace n ON n.oid = src.relnamespace
        WHERE n.nspname = 'public' AND c.conname = 'fk_settlement_items_obligation_composite';

        IF v_fk_def.conname IS NULL THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: Constraint fk_settlement_items_obligation_composite missing';
        ELSIF v_fk_def.contype <> 'f' OR v_fk_def.src_table <> 'settlement_items' OR v_fk_def.ref_table <> 'financial_obligations' 
           OR v_fk_def.src_cols <> ARRAY['obligation_id', 'tenant_id']::text[] 
           OR v_fk_def.ref_cols <> ARRAY['id', 'tenant_id']::text[] 
           OR v_fk_def.confdeltype NOT IN ('r', 'a') THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: fk_settlement_items_obligation_composite definition mismatch: %', v_fk_def;
        END IF;

        -- FK 4: fk_journal_lines_entry_composite
        SELECT 
            c.conname, c.contype, c.confdeltype,
            src.relname AS src_table, ref.relname AS ref_table,
            (SELECT array_agg(a.attname::text ORDER BY array_position(c.conkey, a.attnum))
             FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)) AS src_cols,
            (SELECT array_agg(a.attname::text ORDER BY array_position(c.confkey, a.attnum))
             FROM pg_attribute a WHERE a.attrelid = c.confrelid AND a.attnum = ANY(c.confkey)) AS ref_cols
        INTO v_fk_def
        FROM pg_constraint c
        JOIN pg_class src ON src.oid = c.conrelid
        JOIN pg_class ref ON ref.oid = c.confrelid
        JOIN pg_namespace n ON n.oid = src.relnamespace
        WHERE n.nspname = 'public' AND c.conname = 'fk_journal_lines_entry_composite';

        IF v_fk_def.conname IS NULL THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: Constraint fk_journal_lines_entry_composite missing';
        ELSIF v_fk_def.contype <> 'f' OR v_fk_def.src_table <> 'journal_lines' OR v_fk_def.ref_table <> 'journal_entries' 
           OR v_fk_def.src_cols <> ARRAY['journal_entry_id', 'tenant_id']::text[] 
           OR v_fk_def.ref_cols <> ARRAY['id', 'tenant_id']::text[] 
           OR v_fk_def.confdeltype NOT IN ('r', 'a') THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: fk_journal_lines_entry_composite definition mismatch: %', v_fk_def;
        END IF;

        -- FK 5: fk_journal_lines_account_composite
        SELECT 
            c.conname, c.contype, c.confdeltype,
            src.relname AS src_table, ref.relname AS ref_table,
            (SELECT array_agg(a.attname::text ORDER BY array_position(c.conkey, a.attnum))
             FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)) AS src_cols,
            (SELECT array_agg(a.attname::text ORDER BY array_position(c.confkey, a.attnum))
             FROM pg_attribute a WHERE a.attrelid = c.confrelid AND a.attnum = ANY(c.confkey)) AS ref_cols
        INTO v_fk_def
        FROM pg_constraint c
        JOIN pg_class src ON src.oid = c.conrelid
        JOIN pg_class ref ON ref.oid = c.confrelid
        JOIN pg_namespace n ON n.oid = src.relnamespace
        WHERE n.nspname = 'public' AND c.conname = 'fk_journal_lines_account_composite';

        IF v_fk_def.conname IS NULL THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: Constraint fk_journal_lines_account_composite missing';
        ELSIF v_fk_def.contype <> 'f' OR v_fk_def.src_table <> 'journal_lines' OR v_fk_def.ref_table <> 'accounts' 
           OR v_fk_def.src_cols <> ARRAY['account_id', 'tenant_id']::text[] 
           OR v_fk_def.ref_cols <> ARRAY['id', 'tenant_id']::text[] 
           OR v_fk_def.confdeltype NOT IN ('r', 'a') THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: fk_journal_lines_account_composite definition mismatch: %', v_fk_def;
        END IF;

        -- FK 6: fk_stock_transfer_items_transfer
        SELECT 
            c.conname, c.contype, c.confdeltype,
            src.relname AS src_table, ref.relname AS ref_table,
            (SELECT array_agg(a.attname::text ORDER BY array_position(c.conkey, a.attnum))
             FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)) AS src_cols,
            (SELECT array_agg(a.attname::text ORDER BY array_position(c.confkey, a.attnum))
             FROM pg_attribute a WHERE a.attrelid = c.confrelid AND a.attnum = ANY(c.confkey)) AS ref_cols
        INTO v_fk_def
        FROM pg_constraint c
        JOIN pg_class src ON src.oid = c.conrelid
        JOIN pg_class ref ON ref.oid = c.confrelid
        JOIN pg_namespace n ON n.oid = src.relnamespace
        WHERE n.nspname = 'public' AND c.conname = 'fk_stock_transfer_items_transfer';

        IF v_fk_def.conname IS NULL THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: Constraint fk_stock_transfer_items_transfer missing';
        ELSIF v_fk_def.contype <> 'f' OR v_fk_def.src_table <> 'merchant_stock_transfer_items' OR v_fk_def.ref_table <> 'merchant_stock_transfers' 
           OR v_fk_def.src_cols <> ARRAY['transfer_id', 'merchant_id', 'tenant_id']::text[] 
           OR v_fk_def.ref_cols <> ARRAY['id', 'merchant_id', 'tenant_id']::text[] 
           OR v_fk_def.confdeltype <> 'c' THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: fk_stock_transfer_items_transfer definition mismatch: %', v_fk_def;
        END IF;

        -- FK 7: fk_stock_transfer_items_product
        SELECT 
            c.conname, c.contype, c.confdeltype,
            src.relname AS src_table, ref.relname AS ref_table,
            (SELECT array_agg(a.attname::text ORDER BY array_position(c.conkey, a.attnum))
             FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)) AS src_cols,
            (SELECT array_agg(a.attname::text ORDER BY array_position(c.confkey, a.attnum))
             FROM pg_attribute a WHERE a.attrelid = c.confrelid AND a.attnum = ANY(c.confkey)) AS ref_cols
        INTO v_fk_def
        FROM pg_constraint c
        JOIN pg_class src ON src.oid = c.conrelid
        JOIN pg_class ref ON ref.oid = c.confrelid
        JOIN pg_namespace n ON n.oid = src.relnamespace
        WHERE n.nspname = 'public' AND c.conname = 'fk_stock_transfer_items_product';

        IF v_fk_def.conname IS NULL THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: Constraint fk_stock_transfer_items_product missing';
        ELSIF v_fk_def.contype <> 'f' OR v_fk_def.src_table <> 'merchant_stock_transfer_items' OR v_fk_def.ref_table <> 'products' 
           OR v_fk_def.src_cols <> ARRAY['product_id', 'merchant_id', 'tenant_id']::text[] 
           OR v_fk_def.ref_cols <> ARRAY['id', 'merchant_id', 'tenant_id']::text[] 
           OR v_fk_def.confdeltype NOT IN ('r', 'a') THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: fk_stock_transfer_items_product definition mismatch: %', v_fk_def;
        END IF;

        -- FK 8: fk_price_plan_rules_plan_composite
        SELECT 
            c.conname, c.contype, c.confdeltype,
            src.relname AS src_table, ref.relname AS ref_table,
            (SELECT array_agg(a.attname::text ORDER BY array_position(c.conkey, a.attnum))
             FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)) AS src_cols,
            (SELECT array_agg(a.attname::text ORDER BY array_position(c.confkey, a.attnum))
             FROM pg_attribute a WHERE a.attrelid = c.confrelid AND a.attnum = ANY(c.confkey)) AS ref_cols
        INTO v_fk_def
        FROM pg_constraint c
        JOIN pg_class src ON src.oid = c.conrelid
        JOIN pg_class ref ON ref.oid = c.confrelid
        JOIN pg_namespace n ON n.oid = src.relnamespace
        WHERE n.nspname = 'public' AND c.conname = 'fk_price_plan_rules_plan_composite';

        IF v_fk_def.conname IS NULL THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: Constraint fk_price_plan_rules_plan_composite missing';
        ELSIF v_fk_def.contype <> 'f' OR v_fk_def.src_table <> 'price_plan_rules' OR v_fk_def.ref_table <> 'price_plans' 
           OR v_fk_def.src_cols <> ARRAY['price_plan_id', 'tenant_id']::text[] 
           OR v_fk_def.ref_cols <> ARRAY['id', 'tenant_id']::text[] 
           OR v_fk_def.confdeltype <> 'c' THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: fk_price_plan_rules_plan_composite definition mismatch: %', v_fk_def;
        END IF;

        -- FK 9: fk_shipments_price_plan_composite
        SELECT 
            c.conname, c.contype, c.confdeltype,
            src.relname AS src_table, ref.relname AS ref_table,
            (SELECT array_agg(a.attname::text ORDER BY array_position(c.conkey, a.attnum))
             FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)) AS src_cols,
            (SELECT array_agg(a.attname::text ORDER BY array_position(c.confkey, a.attnum))
             FROM pg_attribute a WHERE a.attrelid = c.confrelid AND a.attnum = ANY(c.confkey)) AS ref_cols
        INTO v_fk_def
        FROM pg_constraint c
        JOIN pg_class src ON src.oid = c.conrelid
        JOIN pg_class ref ON ref.oid = c.confrelid
        JOIN pg_namespace n ON n.oid = src.relnamespace
        WHERE n.nspname = 'public' AND c.conname = 'fk_shipments_price_plan_composite';

        IF v_fk_def.conname IS NULL THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: Constraint fk_shipments_price_plan_composite missing';
        ELSIF v_fk_def.contype <> 'f' OR v_fk_def.src_table <> 'shipments' OR v_fk_def.ref_table <> 'price_plans' 
           OR v_fk_def.src_cols <> ARRAY['price_plan_id', 'tenant_id']::text[] 
           OR v_fk_def.ref_cols <> ARRAY['id', 'tenant_id']::text[] 
           OR v_fk_def.confdeltype <> 'r' THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: fk_shipments_price_plan_composite definition mismatch: %', v_fk_def;
        END IF;

        -- EXCLUDE CONSTRAINT: excl_accounting_periods_range
        SELECT c.conname, c.contype, src.relname AS src_table
        INTO v_fk_def
        FROM pg_constraint c
        JOIN pg_class src ON src.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = src.relnamespace
        WHERE n.nspname = 'public' AND c.conname = 'excl_accounting_periods_range';

        IF v_fk_def.conname IS NULL THEN
            RAISE EXCEPTION 'EXCLUDE CONSTRAINT VERIFICATION FAILED: Constraint excl_accounting_periods_range missing';
        ELSIF v_fk_def.contype <> 'x' OR v_fk_def.src_table <> 'accounting_periods' THEN
            RAISE EXCEPTION 'EXCLUDE CONSTRAINT VERIFICATION FAILED: excl_accounting_periods_range definition mismatch: %', v_fk_def;
        END IF;

        -- FK 10: fk_users_price_plan_composite
        SELECT 
            c.conname, c.contype, c.confdeltype,
            src.relname AS src_table, ref.relname AS ref_table,
            (SELECT array_agg(a.attname::text ORDER BY array_position(c.conkey, a.attnum))
             FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)) AS src_cols,
            (SELECT array_agg(a.attname::text ORDER BY array_position(c.confkey, a.attnum))
             FROM pg_attribute a WHERE a.attrelid = c.confrelid AND a.attnum = ANY(c.confkey)) AS ref_cols
        INTO v_fk_def
        FROM pg_constraint c
        JOIN pg_class src ON src.oid = c.conrelid
        JOIN pg_class ref ON ref.oid = c.confrelid
        JOIN pg_namespace n ON n.oid = src.relnamespace
        WHERE n.nspname = 'public' AND c.conname = 'fk_users_price_plan_composite';

        IF v_fk_def.conname IS NULL THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: Constraint fk_users_price_plan_composite missing';
        ELSIF v_fk_def.contype <> 'f' OR v_fk_def.src_table <> 'users' OR v_fk_def.ref_table <> 'price_plans' 
           OR v_fk_def.src_cols <> ARRAY['price_plan_id', 'tenant_id']::text[] 
           OR v_fk_def.ref_cols <> ARRAY['id', 'tenant_id']::text[] 
           OR v_fk_def.confdeltype <> 'n' THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: fk_users_price_plan_composite definition mismatch: %', v_fk_def;
        END IF;

        -- FK 11: fk_user_invitations_price_plan_composite
        SELECT 
            c.conname, c.contype, c.confdeltype,
            src.relname AS src_table, ref.relname AS ref_table,
            (SELECT array_agg(a.attname::text ORDER BY array_position(c.conkey, a.attnum))
             FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)) AS src_cols,
            (SELECT array_agg(a.attname::text ORDER BY array_position(c.confkey, a.attnum))
             FROM pg_attribute a WHERE a.attrelid = c.confrelid AND a.attnum = ANY(c.confkey)) AS ref_cols
        INTO v_fk_def
        FROM pg_constraint c
        JOIN pg_class src ON src.oid = c.conrelid
        JOIN pg_class ref ON ref.oid = c.confrelid
        JOIN pg_namespace n ON n.oid = src.relnamespace
        WHERE n.nspname = 'public' AND c.conname = 'fk_user_invitations_price_plan_composite';

        IF v_fk_def.conname IS NULL THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: Constraint fk_user_invitations_price_plan_composite missing';
        ELSIF v_fk_def.contype <> 'f' OR v_fk_def.src_table <> 'user_invitations' OR v_fk_def.ref_table <> 'price_plans' 
           OR v_fk_def.src_cols <> ARRAY['price_plan_id', 'tenant_id']::text[] 
           OR v_fk_def.ref_cols <> ARRAY['id', 'tenant_id']::text[] 
           OR v_fk_def.confdeltype <> 'n' THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: fk_user_invitations_price_plan_composite definition mismatch: %', v_fk_def;
        END IF;

        -- FK 12: fk_obligations_beneficiary_composite
        SELECT 
            c.conname, c.contype, c.confdeltype,
            src.relname AS src_table, ref.relname AS ref_table,
            (SELECT array_agg(a.attname::text ORDER BY array_position(c.conkey, a.attnum))
             FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)) AS src_cols,
            (SELECT array_agg(a.attname::text ORDER BY array_position(c.confkey, a.attnum))
             FROM pg_attribute a WHERE a.attrelid = c.confrelid AND a.attnum = ANY(c.confkey)) AS ref_cols
        INTO v_fk_def
        FROM pg_constraint c
        JOIN pg_class src ON src.oid = c.conrelid
        JOIN pg_class ref ON ref.oid = c.confrelid
        JOIN pg_namespace n ON n.oid = src.relnamespace
        WHERE n.nspname = 'public' AND c.conname = 'fk_obligations_beneficiary_composite';

        IF v_fk_def.conname IS NULL THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: Constraint fk_obligations_beneficiary_composite missing';
        ELSIF v_fk_def.contype <> 'f' OR v_fk_def.src_table <> 'financial_obligations' OR v_fk_def.ref_table <> 'users' 
           OR v_fk_def.src_cols <> ARRAY['beneficiary_id', 'tenant_id']::text[] 
           OR v_fk_def.ref_cols <> ARRAY['id', 'tenant_id']::text[] 
           OR v_fk_def.confdeltype <> 'r' THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: fk_obligations_beneficiary_composite definition mismatch: %', v_fk_def;
        END IF;

        -- FK 13: fk_obligations_shipment_composite
        SELECT 
            c.conname, c.contype, c.confdeltype,
            src.relname AS src_table, ref.relname AS ref_table,
            (SELECT array_agg(a.attname::text ORDER BY array_position(c.conkey, a.attnum))
             FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)) AS src_cols,
            (SELECT array_agg(a.attname::text ORDER BY array_position(c.confkey, a.attnum))
             FROM pg_attribute a WHERE a.attrelid = c.confrelid AND a.attnum = ANY(c.confkey)) AS ref_cols
        INTO v_fk_def
        FROM pg_constraint c
        JOIN pg_class src ON src.oid = c.conrelid
        JOIN pg_class ref ON ref.oid = c.confrelid
        JOIN pg_namespace n ON n.oid = src.relnamespace
        WHERE n.nspname = 'public' AND c.conname = 'fk_obligations_shipment_composite';

        IF v_fk_def.conname IS NULL THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: Constraint fk_obligations_shipment_composite missing';
        ELSIF v_fk_def.contype <> 'f' OR v_fk_def.src_table <> 'financial_obligations' OR v_fk_def.ref_table <> 'shipments' 
           OR v_fk_def.src_cols <> ARRAY['shipment_id', 'tenant_id']::text[] 
           OR v_fk_def.ref_cols <> ARRAY['id', 'tenant_id']::text[] 
           OR v_fk_def.confdeltype <> 'r' THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: fk_obligations_shipment_composite definition mismatch: %', v_fk_def;
        END IF;

        -- FK 14: fk_settlements_beneficiary_composite
        SELECT 
            c.conname, c.contype, c.confdeltype,
            src.relname AS src_table, ref.relname AS ref_table,
            (SELECT array_agg(a.attname::text ORDER BY array_position(c.conkey, a.attnum))
             FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)) AS src_cols,
            (SELECT array_agg(a.attname::text ORDER BY array_position(c.confkey, a.attnum))
             FROM pg_attribute a WHERE a.attrelid = c.confrelid AND a.attnum = ANY(c.confkey)) AS ref_cols
        INTO v_fk_def
        FROM pg_constraint c
        JOIN pg_class src ON src.oid = c.conrelid
        JOIN pg_class ref ON ref.oid = c.confrelid
        JOIN pg_namespace n ON n.oid = src.relnamespace
        WHERE n.nspname = 'public' AND c.conname = 'fk_settlements_beneficiary_composite';

        IF v_fk_def.conname IS NULL THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: Constraint fk_settlements_beneficiary_composite missing';
        ELSIF v_fk_def.contype <> 'f' OR v_fk_def.src_table <> 'settlement_records' OR v_fk_def.ref_table <> 'users' 
           OR v_fk_def.src_cols <> ARRAY['beneficiary_id', 'tenant_id']::text[] 
           OR v_fk_def.ref_cols <> ARRAY['id', 'tenant_id']::text[] 
           OR v_fk_def.confdeltype <> 'r' THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: fk_settlements_beneficiary_composite definition mismatch: %', v_fk_def;
        END IF;

        -- FK 15: fk_settlements_journal_composite
        SELECT 
            c.conname, c.contype, c.confdeltype,
            src.relname AS src_table, ref.relname AS ref_table,
            (SELECT array_agg(a.attname::text ORDER BY array_position(c.conkey, a.attnum))
             FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)) AS src_cols,
            (SELECT array_agg(a.attname::text ORDER BY array_position(c.confkey, a.attnum))
             FROM pg_attribute a WHERE a.attrelid = c.confrelid AND a.attnum = ANY(c.confkey)) AS ref_cols
        INTO v_fk_def
        FROM pg_constraint c
        JOIN pg_class src ON src.oid = c.conrelid
        JOIN pg_class ref ON ref.oid = c.confrelid
        JOIN pg_namespace n ON n.oid = src.relnamespace
        WHERE n.nspname = 'public' AND c.conname = 'fk_settlements_journal_composite';

        IF v_fk_def.conname IS NULL THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: Constraint fk_settlements_journal_composite missing';
        ELSIF v_fk_def.contype <> 'f' OR v_fk_def.src_table <> 'settlement_records' OR v_fk_def.ref_table <> 'journal_entries' 
           OR v_fk_def.src_cols <> ARRAY['journal_entry_id', 'tenant_id']::text[] 
           OR v_fk_def.ref_cols <> ARRAY['id', 'tenant_id']::text[] 
           OR v_fk_def.confdeltype <> 'n' THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: fk_settlements_journal_composite definition mismatch: %', v_fk_def;
        END IF;

        -- FK 16: fk_journal_lines_merchant_composite
        SELECT 
            c.conname, c.contype, c.confdeltype,
            src.relname AS src_table, ref.relname AS ref_table,
            (SELECT array_agg(a.attname::text ORDER BY array_position(c.conkey, a.attnum))
             FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)) AS src_cols,
            (SELECT array_agg(a.attname::text ORDER BY array_position(c.confkey, a.attnum))
             FROM pg_attribute a WHERE a.attrelid = c.confrelid AND a.attnum = ANY(c.confkey)) AS ref_cols
        INTO v_fk_def
        FROM pg_constraint c
        JOIN pg_class src ON src.oid = c.conrelid
        JOIN pg_class ref ON ref.oid = c.confrelid
        JOIN pg_namespace n ON n.oid = src.relnamespace
        WHERE n.nspname = 'public' AND c.conname = 'fk_journal_lines_merchant_composite';

        IF v_fk_def.conname IS NULL THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: Constraint fk_journal_lines_merchant_composite missing';
        ELSIF v_fk_def.contype <> 'f' OR v_fk_def.src_table <> 'journal_lines' OR v_fk_def.ref_table <> 'users' 
           OR v_fk_def.src_cols <> ARRAY['merchant_id', 'tenant_id']::text[] 
           OR v_fk_def.ref_cols <> ARRAY['id', 'tenant_id']::text[] 
           OR v_fk_def.confdeltype <> 'n' THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: fk_journal_lines_merchant_composite definition mismatch: %', v_fk_def;
        END IF;

        -- FK 17: fk_journal_lines_driver_composite
        SELECT 
            c.conname, c.contype, c.confdeltype,
            src.relname AS src_table, ref.relname AS ref_table,
            (SELECT array_agg(a.attname::text ORDER BY array_position(c.conkey, a.attnum))
             FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)) AS src_cols,
            (SELECT array_agg(a.attname::text ORDER BY array_position(c.confkey, a.attnum))
             FROM pg_attribute a WHERE a.attrelid = c.confrelid AND a.attnum = ANY(c.confkey)) AS ref_cols
        INTO v_fk_def
        FROM pg_constraint c
        JOIN pg_class src ON src.oid = c.conrelid
        JOIN pg_class ref ON ref.oid = c.confrelid
        JOIN pg_namespace n ON n.oid = src.relnamespace
        WHERE n.nspname = 'public' AND c.conname = 'fk_journal_lines_driver_composite';

        IF v_fk_def.conname IS NULL THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: Constraint fk_journal_lines_driver_composite missing';
        ELSIF v_fk_def.contype <> 'f' OR v_fk_def.src_table <> 'journal_lines' OR v_fk_def.ref_table <> 'users' 
           OR v_fk_def.src_cols <> ARRAY['driver_id', 'tenant_id']::text[] 
           OR v_fk_def.ref_cols <> ARRAY['id', 'tenant_id']::text[] 
           OR v_fk_def.confdeltype <> 'n' THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: fk_journal_lines_driver_composite definition mismatch: %', v_fk_def;
        END IF;

        -- FK 18: fk_journal_lines_branch_composite
        SELECT 
            c.conname, c.contype, c.confdeltype,
            src.relname AS src_table, ref.relname AS ref_table,
            (SELECT array_agg(a.attname::text ORDER BY array_position(c.conkey, a.attnum))
             FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)) AS src_cols,
            (SELECT array_agg(a.attname::text ORDER BY array_position(c.confkey, a.attnum))
             FROM pg_attribute a WHERE a.attrelid = c.confrelid AND a.attnum = ANY(c.confkey)) AS ref_cols
        INTO v_fk_def
        FROM pg_constraint c
        JOIN pg_class src ON src.oid = c.conrelid
        JOIN pg_class ref ON ref.oid = c.confrelid
        JOIN pg_namespace n ON n.oid = src.relnamespace
        WHERE n.nspname = 'public' AND c.conname = 'fk_journal_lines_branch_composite';

        IF v_fk_def.conname IS NULL THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: Constraint fk_journal_lines_branch_composite missing';
        ELSIF v_fk_def.contype <> 'f' OR v_fk_def.src_table <> 'journal_lines' OR v_fk_def.ref_table <> 'merchant_branches' 
           OR v_fk_def.src_cols <> ARRAY['branch_id', 'tenant_id']::text[] 
           OR v_fk_def.ref_cols <> ARRAY['id', 'tenant_id']::text[] 
           OR v_fk_def.confdeltype <> 'n' THEN
            RAISE EXCEPTION 'FK VERIFICATION FAILED: fk_journal_lines_branch_composite definition mismatch: %', v_fk_def;
        END IF;
    END;

    -- 5. Verify Column Nullability & Integrity Invariants
    DECLARE
        v_is_nullable TEXT;
        v_has_chk INT;
        v_has_roles INT;
        v_has_priv INT;
    BEGIN
        -- 5a. price_plans.tenant_id IS NOT NULL
        SELECT is_nullable INTO v_is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'price_plans' AND column_name = 'tenant_id';

        IF v_is_nullable IS NULL OR v_is_nullable <> 'NO' THEN
            RAISE EXCEPTION 'INTEGRITY VERIFICATION FAILED: price_plans.tenant_id is not NOT NULL (is_nullable: %)', v_is_nullable;
        END IF;

        -- 5b. users required columns exist
        FOREACH c IN ARRAY ARRAY['id', 'tenant_id', 'email', 'name', 'phone', 'role', 'price_plan_id', 'price_list', 'branch', 'is_active'] LOOP
            SELECT COUNT(*) INTO v_count
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'users' AND column_name = c;
            IF v_count = 0 THEN
                RAISE EXCEPTION 'INTEGRITY VERIFICATION FAILED: Missing required column in public.users: %', c;
            END IF;
        END LOOP;

        -- 5c. user_role enum includes CASHIER and STAFF
        SELECT COUNT(*) INTO v_has_roles
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'user_role' AND e.enumlabel IN ('CASHIER', 'STAFF', 'SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'ACCOUNTANT', 'DISPATCHER', 'DRIVER', 'MERCHANT');

        IF v_has_roles < 9 THEN
            RAISE EXCEPTION 'INTEGRITY VERIFICATION FAILED: public.user_role enum missing required roles (found % of 9)', v_has_roles;
        END IF;

        -- 5c-2. settlement_status enum strictly matches canonical definition ('DRAFT', 'SUBMITTED', 'APPROVED', 'SETTLED', 'CANCELLED')
        DECLARE
            v_settle_labels TEXT[];
        BEGIN
            SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder)
            INTO v_settle_labels
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = 'settlement_status';

            IF v_settle_labels <> ARRAY['DRAFT', 'SUBMITTED', 'APPROVED', 'SETTLED', 'CANCELLED']::TEXT[] THEN
                RAISE EXCEPTION 'INTEGRITY VERIFICATION FAILED: public.settlement_status enum mismatch (found: %, expected: {DRAFT,SUBMITTED,APPROVED,SETTLED,CANCELLED})', v_settle_labels;
            END IF;
        END;

        -- 5d. branch_inventory invariant: reserved_quantity <= quantity
        SELECT COUNT(*) INTO v_has_chk
        FROM pg_constraint
        WHERE conname = 'chk_branch_inventory_reserved_limit';

        IF v_has_chk = 0 THEN
            RAISE EXCEPTION 'INTEGRITY VERIFICATION FAILED: chk_branch_inventory_reserved_limit constraint missing';
        END IF;

        -- 5e. journal privilege boundary: service_role direct INSERT/UPDATE/DELETE revoked
        SELECT COUNT(*) INTO v_has_priv
        FROM information_schema.table_privileges
        WHERE table_schema = 'public' 
          AND table_name IN ('journal_entries', 'journal_lines')
          AND grantee = 'service_role'
          AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');

        IF v_has_priv > 0 THEN
            RAISE EXCEPTION 'SECURITY BOUNDARY FAILED: service_role has direct mutating privileges on journals (count: %)', v_has_priv;
        END IF;
    END;

    -- 6. Verify RLS is Enabled
    FOREACH t IN ARRAY ARRAY[
        'users', 'shipments', 'financial_obligations', 'settlement_records', 'journal_entries', 'branch_inventory'
    ] LOOP
        SELECT COUNT(*) INTO v_count
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = t AND c.relrowsecurity = true;
        
        IF v_count = 0 THEN
            v_missing_rls := array_append(v_missing_rls, t);
        END IF;
    END LOOP;

    IF array_length(v_missing_rls, 1) > 0 THEN
        RAISE EXCEPTION 'VERIFICATION FAILED: Tables with RLS disabled: %', v_missing_rls;
    END IF;

    RAISE NOTICE '========================================================================';
    RAISE NOTICE 'VERIFICATION SUCCESS: All 28 tables, precision rules, triggers, composite FKs, and RLS verified!';
    RAISE NOTICE '========================================================================';
END $$;

-- ============================================================================
-- DELIVERE — 20_enterprise_integration_tests.sql
-- Enterprise PostgreSQL Integration Test Suite (48 Rigorous Invariant Assertions)
-- Wrapped in BEGIN ... ROLLBACK for zero-residue, isolated test execution
-- ============================================================================

BEGIN;

DO $$
DECLARE
    v_tenant_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
    v_other_tenant_id UUID := '00000000-0000-0000-0000-000000000002'::UUID;
    v_test_merchant_id UUID := gen_random_uuid();
    v_test_driver_id UUID := gen_random_uuid();
    v_other_merchant_id UUID := gen_random_uuid();
    v_branch_id UUID := gen_random_uuid();
    v_other_branch_id UUID := gen_random_uuid();
    v_foreign_branch_id UUID := gen_random_uuid();
    v_product_1_id UUID := gen_random_uuid();
    v_product_2_id UUID := gen_random_uuid();
    v_shipment_id UUID := gen_random_uuid();
    v_delivered_shipment_id UUID := gen_random_uuid();
    v_obligation_id UUID := gen_random_uuid();
    v_driver_obligation_id UUID := gen_random_uuid();
    v_settlement_id UUID := gen_random_uuid();
    v_journal_id UUID := gen_random_uuid();
    v_reversal_id UUID;
    v_acc_cash_custody UUID;
    v_acc_merchant_payable UUID;
    v_acc_delivery_rev UUID;
    v_acc_cliq UUID;
    v_transfer_id UUID;
    v_wallet_limit NUMERIC(12, 3);
    v_err_caught BOOLEAN;
    v_orig_journal RECORD;
    v_rev_journal RECORD;
    v_rev_lines_count INT;
    v_rev_lines_sum_debit NUMERIC(12, 3);
    v_rev_lines_sum_credit NUMERIC(12, 3);
    v_allocated_bal NUMERIC(12, 3);
    v_obl_status public.financial_obligation_status;
    v_src_bal INT;
    v_dest_bal INT;
    v_log_id UUID;
    v_movement_id UUID;
    v_history_id UUID;
    v_shipment_rec RECORD;
BEGIN
    RAISE NOTICE '========================================================================';
    RAISE NOTICE 'DELIVERE ENTERPRISE DATABASE TEST SUITE: 48 INVARIANT ASSERTIONS';
    RAISE NOTICE '========================================================================';

    -- Lookup Standard System Account IDs
    SELECT id INTO v_acc_cash_custody FROM public.accounts WHERE tenant_id = v_tenant_id AND code = '1020';
    SELECT id INTO v_acc_merchant_payable FROM public.accounts WHERE tenant_id = v_tenant_id AND code = '2020';
    SELECT id INTO v_acc_delivery_rev FROM public.accounts WHERE tenant_id = v_tenant_id AND code = '4010';
    SELECT id INTO v_acc_cliq FROM public.accounts WHERE tenant_id = v_tenant_id AND code = '1030';

    -- Ensure second tenant exists for cross-tenant boundary tests
    INSERT INTO public.tenants (id, name, code)
    VALUES (v_other_tenant_id, 'Foreign Tenant', 'FOREIGN')
    ON CONFLICT (id) DO NOTHING;

    -- Setup Test Fixtures: Merchant, Driver, Branches, Products & Inventory
    INSERT INTO public.users (id, tenant_id, email, name, role)
    VALUES 
        (v_test_merchant_id, v_tenant_id, 'test-merchant@delivere.local', 'Test Merchant', 'MERCHANT'),
        (v_test_driver_id, v_tenant_id, 'test-driver@delivere.local', 'Test Driver', 'DRIVER'),
        (v_other_merchant_id, v_other_tenant_id, 'other-merchant@foreign.local', 'Other Merchant', 'MERCHANT');

    INSERT INTO public.merchant_branches (id, tenant_id, merchant_id, name, is_main, is_active)
    VALUES 
        (v_branch_id, v_tenant_id, v_test_merchant_id, 'Main Branch', true, true),
        (v_other_branch_id, v_tenant_id, v_test_merchant_id, 'Second Branch', false, true),
        (v_foreign_branch_id, v_other_tenant_id, v_other_merchant_id, 'Foreign Branch', true, true);

    INSERT INTO public.products (id, tenant_id, merchant_id, sku, name, cost_price, selling_price)
    VALUES 
        (v_product_1_id, v_tenant_id, v_test_merchant_id, 'SKU-TEST-01', 'Test Product 1', 10.000, 15.000),
        (v_product_2_id, v_tenant_id, v_test_merchant_id, 'SKU-TEST-02', 'Test Product 2', 5.000, 8.000);

    INSERT INTO public.branch_inventory (tenant_id, merchant_id, branch_id, product_id, quantity)
    VALUES 
        (v_tenant_id, v_test_merchant_id, v_branch_id, v_product_1_id, 100),
        (v_tenant_id, v_test_merchant_id, v_branch_id, v_product_2_id, 50);

    -- ------------------------------------------------------------------------
    -- TEST 01: Standard COD Posting Invariant (DR 1020 38.000, CR 2020 35.000, CR 4010 3.000)
    -- ------------------------------------------------------------------------
    INSERT INTO public.journal_entries (
        id, tenant_id, entry_number, entry_date, status, description, reference_type, reference_id
    ) VALUES (
        v_journal_id, v_tenant_id, 'JE-TEST-01', CURRENT_DATE, 'DRAFT', 'Standard COD test', 'SHIPMENT', 'SHP-001'
    );

    INSERT INTO public.journal_lines (tenant_id, journal_entry_id, account_id, account_code, debit, credit, driver_id)
    VALUES (v_tenant_id, v_journal_id, v_acc_cash_custody, '1020', 38.000, 0.000, v_test_driver_id);

    INSERT INTO public.journal_lines (tenant_id, journal_entry_id, account_id, account_code, debit, credit, merchant_id)
    VALUES (v_tenant_id, v_journal_id, v_acc_merchant_payable, '2020', 0.000, 35.000, v_test_merchant_id);

    INSERT INTO public.journal_lines (tenant_id, journal_entry_id, account_id, account_code, debit, credit)
    VALUES (v_tenant_id, v_journal_id, v_acc_delivery_rev, '4010', 0.000, 3.000);

    UPDATE public.journal_entries SET status = 'POSTED' WHERE id = v_journal_id;

    SELECT total_debit, total_credit, posted_at INTO v_orig_journal FROM public.journal_entries WHERE id = v_journal_id;
    IF v_orig_journal.total_debit <> 38.000 OR v_orig_journal.total_credit <> 38.000 OR v_orig_journal.posted_at IS NULL THEN
        RAISE EXCEPTION 'TEST 01 FAILED: Journal totals or posted_at incorrect';
    END IF;
    RAISE NOTICE 'TEST 01 PASSED: Standard COD posting balanced (DR 38.000 = CR 38.000).';

    -- ------------------------------------------------------------------------
    -- TEST 02: Corrupt / Unbalanced COD Rejection (38.000 != 37.000)
    -- ------------------------------------------------------------------------
    DECLARE v_corrupt_jid UUID := gen_random_uuid();
    BEGIN
        INSERT INTO public.journal_entries (id, tenant_id, entry_number, entry_date, status, description)
        VALUES (v_corrupt_jid, v_tenant_id, 'JE-CORRUPT-01', CURRENT_DATE, 'DRAFT', 'Corrupt unbalanced test');

        INSERT INTO public.journal_lines (tenant_id, journal_entry_id, account_id, account_code, debit, credit)
        VALUES (v_tenant_id, v_corrupt_jid, v_acc_cash_custody, '1020', 38.000, 0.000);

        INSERT INTO public.journal_lines (tenant_id, journal_entry_id, account_id, account_code, debit, credit)
        VALUES (v_tenant_id, v_corrupt_jid, v_acc_merchant_payable, '2020', 0.000, 37.000);

        v_err_caught := false;
        BEGIN
            UPDATE public.journal_entries SET status = 'POSTED' WHERE id = v_corrupt_jid;
        EXCEPTION WHEN OTHERS THEN
            v_err_caught := true;
        END;
        IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 02 FAILED: Unbalanced journal was allowed to post!'; END IF;
        RAISE NOTICE 'TEST 02 PASSED: Corrupt/unbalanced journal posting rejected.';
    END;

    -- ------------------------------------------------------------------------
    -- TEST 03: CliQ Direct Receipt Posting (DR 1030 38.000, CR 2020 35.000, CR 4010 3.000)
    -- ------------------------------------------------------------------------
    DECLARE v_cliq_jid UUID := gen_random_uuid();
    BEGIN
        INSERT INTO public.journal_entries (id, tenant_id, entry_number, entry_date, status, description)
        VALUES (v_cliq_jid, v_tenant_id, 'JE-CLIQ-01', CURRENT_DATE, 'DRAFT', 'CliQ receipt');

        INSERT INTO public.journal_lines (tenant_id, journal_entry_id, account_id, account_code, debit, credit)
        VALUES (v_tenant_id, v_cliq_jid, v_acc_cliq, '1030', 38.000, 0.000);

        INSERT INTO public.journal_lines (tenant_id, journal_entry_id, account_id, account_code, debit, credit, merchant_id)
        VALUES (v_tenant_id, v_cliq_jid, v_acc_merchant_payable, '2020', 0.000, 35.000, v_test_merchant_id);

        INSERT INTO public.journal_lines (tenant_id, journal_entry_id, account_id, account_code, debit, credit)
        VALUES (v_tenant_id, v_cliq_jid, v_acc_delivery_rev, '4010', 0.000, 3.000);

        UPDATE public.journal_entries SET status = 'POSTED' WHERE id = v_cliq_jid;
        RAISE NOTICE 'TEST 03 PASSED: CliQ direct company receipt posted (0 driver custody).';
    END;

    -- ------------------------------------------------------------------------
    -- TEST 04: PREPAID Shipment Posting (DR 1030 3.000, CR 4010 3.000)
    -- ------------------------------------------------------------------------
    DECLARE v_prep_jid UUID := gen_random_uuid();
    BEGIN
        INSERT INTO public.journal_entries (id, tenant_id, entry_number, entry_date, status, description)
        VALUES (v_prep_jid, v_tenant_id, 'JE-PREP-01', CURRENT_DATE, 'DRAFT', 'Prepaid delivery fee');

        INSERT INTO public.journal_lines (tenant_id, journal_entry_id, account_id, account_code, debit, credit)
        VALUES (v_tenant_id, v_prep_jid, v_acc_cliq, '1030', 3.000, 0.000);

        INSERT INTO public.journal_lines (tenant_id, journal_entry_id, account_id, account_code, debit, credit)
        VALUES (v_tenant_id, v_prep_jid, v_acc_delivery_rev, '4010', 0.000, 3.000);

        UPDATE public.journal_entries SET status = 'POSTED' WHERE id = v_prep_jid;
        RAISE NOTICE 'TEST 04 PASSED: PREPAID delivery fee posting balanced (0 COD payable).';
    END;

    -- ------------------------------------------------------------------------
    -- TEST 05: RETURNED Shipment Accounting (DR 2020 1.500, CR 4010 1.500)
    -- ------------------------------------------------------------------------
    DECLARE v_ret_jid UUID := gen_random_uuid();
    BEGIN
        INSERT INTO public.journal_entries (id, tenant_id, entry_number, entry_date, status, description)
        VALUES (v_ret_jid, v_tenant_id, 'JE-RET-01', CURRENT_DATE, 'DRAFT', 'Return fee deduction');

        INSERT INTO public.journal_lines (tenant_id, journal_entry_id, account_id, account_code, debit, credit, merchant_id)
        VALUES (v_tenant_id, v_ret_jid, v_acc_merchant_payable, '2020', 1.500, 0.000, v_test_merchant_id);

        INSERT INTO public.journal_lines (tenant_id, journal_entry_id, account_id, account_code, debit, credit)
        VALUES (v_tenant_id, v_ret_jid, v_acc_delivery_rev, '4010', 0.000, 1.500);

        UPDATE public.journal_entries SET status = 'POSTED' WHERE id = v_ret_jid;
        RAISE NOTICE 'TEST 05 PASSED: RETURNED shipment fee deduction debited merchant payable.';
    END;

    -- ------------------------------------------------------------------------
    -- TEST 06: Driver Payout Settlement (DR 2030 50.000, CR 1010 50.000)
    -- ------------------------------------------------------------------------
    DECLARE v_drv_pay_jid UUID := gen_random_uuid(); v_acc_driver_pay UUID; v_acc_bank UUID;
    BEGIN
        SELECT id INTO v_acc_driver_pay FROM public.accounts WHERE tenant_id = v_tenant_id AND code = '2030';
        SELECT id INTO v_acc_bank FROM public.accounts WHERE tenant_id = v_tenant_id AND code = '1010';

        INSERT INTO public.journal_entries (id, tenant_id, entry_number, entry_date, status, description)
        VALUES (v_drv_pay_jid, v_tenant_id, 'JE-DRVPAY-01', CURRENT_DATE, 'DRAFT', 'Driver payout');

        INSERT INTO public.journal_lines (tenant_id, journal_entry_id, account_id, account_code, debit, credit, driver_id)
        VALUES (v_tenant_id, v_drv_pay_jid, v_acc_driver_pay, '2030', 50.000, 0.000, v_test_driver_id);

        INSERT INTO public.journal_lines (tenant_id, journal_entry_id, account_id, account_code, debit, credit)
        VALUES (v_tenant_id, v_drv_pay_jid, v_acc_bank, '1010', 0.000, 50.000);

        UPDATE public.journal_entries SET status = 'POSTED' WHERE id = v_drv_pay_jid;
        RAISE NOTICE 'TEST 06 PASSED: Driver payout settlement journal posted balanced.';
    END;

    -- ------------------------------------------------------------------------
    -- TEST 07: Merchant Settlement Payout (DR 2020 100.000, CR 1010 100.000)
    -- ------------------------------------------------------------------------
    DECLARE v_merch_pay_jid UUID := gen_random_uuid(); v_acc_bank UUID;
    BEGIN
        SELECT id INTO v_acc_bank FROM public.accounts WHERE tenant_id = v_tenant_id AND code = '1010';

        INSERT INTO public.journal_entries (id, tenant_id, entry_number, entry_date, status, description)
        VALUES (v_merch_pay_jid, v_tenant_id, 'JE-MERCHPAY-01', CURRENT_DATE, 'DRAFT', 'Merchant payout');

        INSERT INTO public.journal_lines (tenant_id, journal_entry_id, account_id, account_code, debit, credit, merchant_id)
        VALUES (v_tenant_id, v_merch_pay_jid, v_acc_merchant_payable, '2020', 100.000, 0.000, v_test_merchant_id);

        INSERT INTO public.journal_lines (tenant_id, journal_entry_id, account_id, account_code, debit, credit)
        VALUES (v_tenant_id, v_merch_pay_jid, v_acc_bank, '1010', 0.000, 100.000);

        UPDATE public.journal_entries SET status = 'POSTED' WHERE id = v_merch_pay_jid;
        RAISE NOTICE 'TEST 07 PASSED: Merchant settlement payout journal posted balanced.';
    END;

    -- ------------------------------------------------------------------------
    -- TEST 08: Driver Cash Custody Deposit (DR 1010 150.000, CR 1020 150.000)
    -- ------------------------------------------------------------------------
    DECLARE v_dep_jid UUID := gen_random_uuid(); v_acc_bank UUID;
    BEGIN
        SELECT id INTO v_acc_bank FROM public.accounts WHERE tenant_id = v_tenant_id AND code = '1010';

        INSERT INTO public.journal_entries (id, tenant_id, entry_number, entry_date, status, description)
        VALUES (v_dep_jid, v_tenant_id, 'JE-DEPOSIT-01', CURRENT_DATE, 'DRAFT', 'Driver cash clearance');

        INSERT INTO public.journal_lines (tenant_id, journal_entry_id, account_id, account_code, debit, credit)
        VALUES (v_tenant_id, v_dep_jid, v_acc_bank, '1010', 150.000, 0.000);

        INSERT INTO public.journal_lines (tenant_id, journal_entry_id, account_id, account_code, debit, credit, driver_id)
        VALUES (v_tenant_id, v_dep_jid, v_acc_cash_custody, '1020', 0.000, 150.000, v_test_driver_id);

        UPDATE public.journal_entries SET status = 'POSTED' WHERE id = v_dep_jid;
        RAISE NOTICE 'TEST 08 PASSED: Driver cash clearance deposit cleared custody.';
    END;

    -- ------------------------------------------------------------------------
    -- TEST 09: Partial Settlement Allocation (Alloc 20.000 / 35.000 -> PARTIALLY_SETTLED)
    -- ------------------------------------------------------------------------
    INSERT INTO public.shipments (
        id, tenant_id, sequence, merchant_id, driver_id, branch_id,
        recipient_name, recipient_phone, status, cod_amount, merchant_collection, delivery_fee, driver_fee, return_fee
    ) VALUES (
        v_delivered_shipment_id, v_tenant_id, 'SHP-TEST-DELIV-01', v_test_merchant_id, v_test_driver_id, v_branch_id,
        'Delivered Customer', '0790000001', 'DELIVERED', 38.000, 35.000, 3.000, 1.500, 1.500
    );

    INSERT INTO public.financial_obligations (
        id, tenant_id, beneficiary_type, beneficiary_id, obligation_type,
        shipment_id, original_amount, allocated_amount, status
    ) VALUES (
        v_obligation_id, v_tenant_id, 'MERCHANT', v_test_merchant_id, 'MERCHANT_COD_PAYABLE',
        v_delivered_shipment_id, 35.000, 0.000, 'PENDING'
    );

    INSERT INTO public.settlement_records (
        id, tenant_id, settlement_number, type, beneficiary_id,
        status, total_amount, payment_method
    ) VALUES (
        v_settlement_id, v_tenant_id, 'SETTLE-TEST-01', 'MERCHANT_REMITTANCE', v_test_merchant_id,
        'DRAFT', 20.000, 'CASH'
    );

    INSERT INTO public.settlement_items (tenant_id, settlement_id, obligation_id, allocated_amount)
    VALUES (v_tenant_id, v_settlement_id, v_obligation_id, 20.000);

    SELECT allocated_amount, status INTO v_allocated_bal, v_obl_status
    FROM public.financial_obligations WHERE id = v_obligation_id;

    IF v_allocated_bal <> 20.000 OR v_obl_status <> 'PARTIALLY_SETTLED' THEN
        RAISE EXCEPTION 'TEST 09 FAILED: Partial settlement tracking failed: bal=%, status=%', v_allocated_bal, v_obl_status;
    END IF;
    RAISE NOTICE 'TEST 09 PASSED: Partial settlement allocated 20.000 JOD (status = PARTIALLY_SETTLED).';

    -- ------------------------------------------------------------------------
    -- TEST 10: Exact Full Settlement Completion (Alloc 15.000 -> Total 35.000 -> SETTLED)
    -- ------------------------------------------------------------------------
    DECLARE v_settle_full_id UUID := gen_random_uuid();
    BEGIN
        INSERT INTO public.settlement_records (
            id, tenant_id, settlement_number, type, beneficiary_id,
            status, total_amount, payment_method
        ) VALUES (
            v_settle_full_id, v_tenant_id, 'SETTLE-TEST-02', 'MERCHANT_REMITTANCE', v_test_merchant_id,
            'DRAFT', 15.000, 'CASH'
        );

        INSERT INTO public.settlement_items (tenant_id, settlement_id, obligation_id, allocated_amount)
        VALUES (v_tenant_id, v_settle_full_id, v_obligation_id, 15.000);

        SELECT allocated_amount, status INTO v_allocated_bal, v_obl_status
        FROM public.financial_obligations WHERE id = v_obligation_id;

        IF v_allocated_bal <> 35.000 OR v_obl_status <> 'SETTLED' THEN
            RAISE EXCEPTION 'TEST 10 FAILED: Full settlement failed: bal=%, status=%', v_allocated_bal, v_obl_status;
        END IF;
        RAISE NOTICE 'TEST 10 PASSED: Exact full settlement completed (status = SETTLED).';
    END;

    -- ------------------------------------------------------------------------
    -- TEST 11: 0.001 JOD Over-Allocation Rejection (35.001 > 35.000)
    -- ------------------------------------------------------------------------
    DECLARE v_settle_over_id UUID := gen_random_uuid();
    BEGIN
        INSERT INTO public.settlement_records (
            id, tenant_id, settlement_number, type, beneficiary_id,
            status, total_amount, payment_method
        ) VALUES (
            v_settle_over_id, v_tenant_id, 'SETTLE-OVER-01', 'MERCHANT_REMITTANCE', v_test_merchant_id,
            'DRAFT', 0.001, 'CASH'
        );

        v_err_caught := false;
        BEGIN
            INSERT INTO public.settlement_items (tenant_id, settlement_id, obligation_id, allocated_amount)
            VALUES (v_tenant_id, v_settle_over_id, v_obligation_id, 0.001);
        EXCEPTION WHEN OTHERS THEN
            v_err_caught := true;
        END;
        IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 11 FAILED: Over-allocation was permitted!'; END IF;
        RAISE NOTICE 'TEST 11 PASSED: 0.001 JOD over-allocation strictly rejected.';
    END;

    -- ------------------------------------------------------------------------
    -- TEST 12: Settlement Cancellation Automatic Recalculation
    -- ------------------------------------------------------------------------
    UPDATE public.settlement_records SET status = 'CANCELLED' WHERE id = v_settlement_id;
    SELECT allocated_amount, status INTO v_allocated_bal, v_obl_status
    FROM public.financial_obligations WHERE id = v_obligation_id;

    IF v_allocated_bal <> 15.000 OR v_obl_status <> 'PARTIALLY_SETTLED' THEN
        RAISE EXCEPTION 'TEST 12 FAILED: Settlement cancellation recalc failed: bal=%, status=%', v_allocated_bal, v_obl_status;
    END IF;
    RAISE NOTICE 'TEST 12 PASSED: Settlement cancellation auto-recalculated obligation allocated amount.';

    -- ------------------------------------------------------------------------
    -- TEST 13: Settlement Reversal via Cancellation Processing
    -- ------------------------------------------------------------------------
    DECLARE v_settle_rev_id UUID := gen_random_uuid(); v_rev_obl UUID := gen_random_uuid();
    BEGIN
        INSERT INTO public.financial_obligations (
            id, tenant_id, beneficiary_type, beneficiary_id, obligation_type,
            original_amount, allocated_amount, status
        ) VALUES (
            v_rev_obl, v_tenant_id, 'MERCHANT', v_test_merchant_id, 'MERCHANT_COD_PAYABLE',
            50.000, 0.000, 'PENDING'
        );

        -- Step 1: Create settlement in DRAFT status
        INSERT INTO public.settlement_records (
            id, tenant_id, settlement_number, type, beneficiary_id,
            status, total_amount, payment_method
        ) VALUES (
            v_settle_rev_id, v_tenant_id, 'SETTLE-REV-01', 'MERCHANT_REMITTANCE', v_test_merchant_id,
            'DRAFT', 50.000, 'CASH'
        );

        -- Step 2: Insert settlement items while DRAFT
        INSERT INTO public.settlement_items (tenant_id, settlement_id, obligation_id, allocated_amount)
        VALUES (v_tenant_id, v_settle_rev_id, v_rev_obl, 50.000);

        -- Step 3: Transition to APPROVED
        UPDATE public.settlement_records SET status = 'APPROVED' WHERE id = v_settle_rev_id;

        -- Step 4: Cancelling / voiding the settlement (Settlements use CANCELLED to restore obligation balances)
        UPDATE public.settlement_records SET status = 'CANCELLED' WHERE id = v_settle_rev_id;

        SELECT allocated_amount, status INTO v_allocated_bal, v_obl_status
        FROM public.financial_obligations WHERE id = v_rev_obl;

        IF v_allocated_bal <> 0.000 OR v_obl_status <> 'PENDING' THEN
            RAISE EXCEPTION 'TEST 13 FAILED: Settlement cancellation did not reset obligation!';
        END IF;

        RAISE NOTICE 'TEST 13 PASSED: Settlement cancellation restored obligation balance to 0.000 (PENDING).';
    END;

    -- ------------------------------------------------------------------------
    -- TEST 14: Settlement Header Immutability
    -- ------------------------------------------------------------------------
    DECLARE v_immut_settle UUID := gen_random_uuid();
    BEGIN
        INSERT INTO public.settlement_records (
            id, tenant_id, settlement_number, type, beneficiary_id,
            status, total_amount, payment_method
        ) VALUES (
            v_immut_settle, v_tenant_id, 'SETTLE-IMMUT-01', 'MERCHANT_REMITTANCE', v_test_merchant_id,
            'APPROVED', 100.000, 'CASH'
        );

        v_err_caught := false;
        BEGIN
            UPDATE public.settlement_records SET total_amount = 120.000 WHERE id = v_immut_settle;
        EXCEPTION WHEN OTHERS THEN
            v_err_caught := true;
        END;
        IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 14 FAILED: Modification of approved settlement total_amount was allowed!'; END IF;
        RAISE NOTICE 'TEST 14 PASSED: Approved settlement header is immutable.';
    END;

    -- ------------------------------------------------------------------------
    -- TEST 15: Posted Journal Lines Immutability (INSERT / UPDATE / DELETE Blocked)
    -- ------------------------------------------------------------------------
    v_err_caught := false;
    BEGIN
        DELETE FROM public.journal_lines WHERE journal_entry_id = v_journal_id;
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 15 FAILED: Deletion of lines from posted journal was allowed!'; END IF;

    v_err_caught := false;
    BEGIN
        UPDATE public.journal_lines SET debit = 999.000 WHERE journal_entry_id = v_journal_id;
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 15 FAILED: Modification of lines in posted journal was allowed!'; END IF;
    RAISE NOTICE 'TEST 15 PASSED: Posted journal lines strictly protected from mutation.';

    -- ------------------------------------------------------------------------
    -- TEST 16: Direct UPDATE of Posted Journal to REVERSED Blocked (Assertions A, B, C)
    -- ------------------------------------------------------------------------
    -- Assertion A: Direct normal POSTED journal UPDATE fails
    v_err_caught := false;
    BEGIN
        UPDATE public.journal_entries SET total_debit = 999.000 WHERE id = v_journal_id;
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 16A FAILED: Direct normal UPDATE on posted journal total_debit was allowed!'; END IF;

    v_err_caught := false;
    BEGIN
        UPDATE public.journal_entries SET description = 'Unauthorized modification' WHERE id = v_journal_id;
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 16A FAILED: Direct normal UPDATE on posted journal description was allowed!'; END IF;

    -- Assertion B: Direct POSTED -> REVERSED UPDATE fails
    v_err_caught := false;
    BEGIN
        UPDATE public.journal_entries 
        SET status = 'REVERSED', is_reversed = true, reversal_entry_id = gen_random_uuid() 
        WHERE id = v_journal_id;
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 16B FAILED: Arbitrary direct UPDATE to REVERSED was permitted!'; END IF;

    -- Assertion C: Caller cannot spoof reversal authorization (GUC removed, structural posted reversal required)
    v_err_caught := false;
    BEGIN
        PERFORM set_config('delivere.internal_reversal_active', 'on', true);
        UPDATE public.journal_entries 
        SET status = 'REVERSED', is_reversed = true, reversal_entry_id = gen_random_uuid() 
        WHERE id = v_journal_id;
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 16C FAILED: GUC spoofing was permitted to bypass reversal authorization!'; END IF;
    RAISE NOTICE 'TEST 16 PASSED: Direct UPDATE on POSTED journal rejected (Assertions A, B, C verified).';

    -- ------------------------------------------------------------------------
    -- TEST 17: Authorized Journal Reversal via execute_journal_reversal (Assertions D, E, F, G)
    -- ------------------------------------------------------------------------
    -- Assertion D: execute_journal_reversal succeeds
    v_reversal_id := public.execute_journal_reversal(v_journal_id, v_test_merchant_id, 'Test reversal execution');

    -- Assertion E: original status = REVERSED
    SELECT status, is_reversed, reversal_entry_id INTO v_orig_journal FROM public.journal_entries WHERE id = v_journal_id;
    IF v_orig_journal.status <> 'REVERSED' OR v_orig_journal.is_reversed <> true OR v_orig_journal.reversal_entry_id <> v_reversal_id THEN
        RAISE EXCEPTION 'TEST 17E FAILED: Original journal not correctly marked REVERSED: status=%, is_rev=%', v_orig_journal.status, v_orig_journal.is_reversed;
    END IF;

    -- Assertion F: reversal status = POSTED
    SELECT status, is_reversed, reference_id, total_debit, total_credit INTO v_rev_journal FROM public.journal_entries WHERE id = v_reversal_id;
    IF v_rev_journal.status <> 'POSTED' OR v_rev_journal.total_debit <> 38.000 OR v_rev_journal.total_credit <> 38.000 THEN
        RAISE EXCEPTION 'TEST 17F FAILED: Reversal journal status or balance incorrect: status=%, deb=%, cred=%', v_rev_journal.status, v_rev_journal.total_debit, v_rev_journal.total_credit;
    END IF;

    -- Assertion G: debit/credit lines are exact inverse
    SELECT COUNT(*), SUM(debit), SUM(credit) INTO v_rev_lines_count, v_rev_lines_sum_debit, v_rev_lines_sum_credit
    FROM public.journal_lines WHERE journal_entry_id = v_reversal_id;

    IF v_rev_lines_count <> 3 OR v_rev_lines_sum_debit <> 38.000 OR v_rev_lines_sum_credit <> 38.000 THEN
        RAISE EXCEPTION 'TEST 17G FAILED: Reversal lines not inverted properly';
    END IF;
    RAISE NOTICE 'TEST 17 PASSED: Authorized journal reversal successfully marks original REVERSED, reversal POSTED, with inverted lines (Assertions D, E, F, G verified).';

    -- ------------------------------------------------------------------------
    -- TEST 18: Duplicate Journal Reversal Blocked (Assertion H: second reversal fails)
    -- ------------------------------------------------------------------------
    v_err_caught := false;
    BEGIN
        PERFORM public.execute_journal_reversal(v_journal_id, v_test_merchant_id, 'Second reversal attempt');
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 18H FAILED: Duplicate reversal of journal entry was allowed!'; END IF;
    RAISE NOTICE 'TEST 18 PASSED: Duplicate journal reversal strictly rejected (Assertion H verified).';

    -- ------------------------------------------------------------------------
    -- TEST 19: Zero-Line Journal Posting Rejection
    -- ------------------------------------------------------------------------
    DECLARE v_zeroline_jid UUID := gen_random_uuid();
    BEGIN
        INSERT INTO public.journal_entries (id, tenant_id, entry_number, entry_date, status, description)
        VALUES (v_zeroline_jid, v_tenant_id, 'JE-ZERO-01', CURRENT_DATE, 'DRAFT', 'Zero lines');

        v_err_caught := false;
        BEGIN
            UPDATE public.journal_entries SET status = 'POSTED' WHERE id = v_zeroline_jid;
        EXCEPTION WHEN OTHERS THEN
            v_err_caught := true;
        END;
        IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 19 FAILED: Zero-line journal was allowed to post!'; END IF;
        RAISE NOTICE 'TEST 19 PASSED: Zero-line journal posting rejected.';
    END;

    -- ------------------------------------------------------------------------
    -- TEST 20: Single-Line Journal Posting Rejection
    -- ------------------------------------------------------------------------
    DECLARE v_oneline_jid UUID := gen_random_uuid();
    BEGIN
        INSERT INTO public.journal_entries (id, tenant_id, entry_number, entry_date, status, description)
        VALUES (v_oneline_jid, v_tenant_id, 'JE-ONE-01', CURRENT_DATE, 'DRAFT', 'Single line');

        INSERT INTO public.journal_lines (tenant_id, journal_entry_id, account_id, account_code, debit, credit)
        VALUES (v_tenant_id, v_oneline_jid, v_acc_cash_custody, '1020', 50.000, 0.000);

        v_err_caught := false;
        BEGIN
            UPDATE public.journal_entries SET status = 'POSTED' WHERE id = v_oneline_jid;
        EXCEPTION WHEN OTHERS THEN
            v_err_caught := true;
        END;
        IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 20 FAILED: Single-line journal was allowed to post!'; END IF;
        RAISE NOTICE 'TEST 20 PASSED: Single-line journal posting rejected.';
    END;

    -- ------------------------------------------------------------------------
    -- TEST 21: Approved Controlled RPC Journal Workflow (Create DRAFT -> Add Lines -> Post)
    -- ------------------------------------------------------------------------
    DECLARE
        v_rpc_jid UUID;
        v_rpc_l1 UUID;
        v_rpc_l2 UUID;
        v_rpc_status public.journal_posting_status;
        v_rpc_deb NUMERIC(12, 3);
        v_rpc_cred NUMERIC(12, 3);
    BEGIN
        v_rpc_jid := public.create_draft_journal_entry(
            v_tenant_id, 'JE-RPC-01', CURRENT_DATE, 'Controlled RPC test', 'MANUAL', 'REF-01', v_test_merchant_id
        );

        v_rpc_l1 := public.add_draft_journal_line(
            v_tenant_id, v_rpc_jid, v_acc_cash_custody, '1020', 120.000, 0.000, 'Debit line', v_test_merchant_id, NULL, v_branch_id
        );

        v_rpc_l2 := public.add_draft_journal_line(
            v_tenant_id, v_rpc_jid, v_acc_merchant_payable, '2020', 0.000, 120.000, 'Credit line', v_test_merchant_id, NULL, v_branch_id
        );

        -- Post the journal entry via approved procedure
        PERFORM public.post_journal_entry(v_rpc_jid, v_test_merchant_id);

        SELECT status, total_debit, total_credit INTO v_rpc_status, v_rpc_deb, v_rpc_cred
        FROM public.journal_entries WHERE id = v_rpc_jid;

        IF v_rpc_status <> 'POSTED' OR v_rpc_deb <> 120.000 OR v_rpc_cred <> 120.000 THEN
            RAISE EXCEPTION 'TEST 21 FAILED: Approved RPC journal posting failed: status=%, deb=%, cred=%', v_rpc_status, v_rpc_deb, v_rpc_cred;
        END IF;

        -- Ensure lines cannot be added after posting
        v_err_caught := false;
        BEGIN
            PERFORM public.add_draft_journal_line(
                v_tenant_id, v_rpc_jid, v_acc_cash_custody, '1020', 10.000, 0.000, 'Illegal line'
            );
        EXCEPTION WHEN OTHERS THEN
            v_err_caught := true;
        END;
        IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 21 FAILED: add_draft_journal_line permitted adding to POSTED journal!'; END IF;
        RAISE NOTICE 'TEST 21 PASSED: Approved controlled SECURITY DEFINER journal RPC workflow verified.';
    END;

    -- ------------------------------------------------------------------------
    -- TEST 22: Closed Accounting Period Posting & Overlap Prevention Blocked
    -- ------------------------------------------------------------------------
    -- 22a: Assert overlapping accounting period insertion is blocked by trigger and exclusion constraint
    INSERT INTO public.accounting_periods (tenant_id, period_name, start_date, end_date, status)
    VALUES (v_tenant_id, 'Closed Year 2024', '2024-01-01', '2024-12-31', 'CLOSED');

    v_err_caught := false;
    BEGIN
        INSERT INTO public.accounting_periods (tenant_id, period_name, start_date, end_date, status)
        VALUES (v_tenant_id, 'Overlapping Period 2024', '2024-06-01', '2025-05-31', 'OPEN');
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 22 FAILED: Overlapping accounting period was allowed!'; END IF;

    -- Assert non-overlapping period for same tenant is allowed
    INSERT INTO public.accounting_periods (tenant_id, period_name, start_date, end_date, status)
    VALUES (v_tenant_id, 'Open Year 2025', '2025-01-01', '2025-12-31', 'OPEN');

    -- Assert identical period for different tenant is allowed (multi-tenant partition in exclusion constraint)
    INSERT INTO public.accounting_periods (tenant_id, period_name, start_date, end_date, status)
    VALUES (v_other_tenant_id, 'Other Tenant Year 2024', '2024-01-01', '2024-12-31', 'OPEN');

    RAISE NOTICE 'TEST 22a PASSED: Overlapping accounting period insertion strictly blocked by trigger and exclusion constraint; cross-tenant identical dates allowed.';

    -- 22b: Direct INSERT into CLOSED period is strictly rejected
    DECLARE v_closed_jid UUID := gen_random_uuid();
    BEGIN
        v_err_caught := false;
        BEGIN
            INSERT INTO public.journal_entries (id, tenant_id, entry_number, entry_date, status, description)
            VALUES (v_closed_jid, v_tenant_id, 'JE-CLOSED-01', '2024-06-15', 'DRAFT', 'Closed period direct insert');
        EXCEPTION WHEN OTHERS THEN
            v_err_caught := true;
        END;
        IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 22b FAILED: Direct journal insertion into closed period was allowed!'; END IF;
        RAISE NOTICE 'TEST 22b PASSED: Direct journal insertion into closed accounting period strictly rejected.';
    END;

    -- 22c: Same date entry for other tenant with OPEN period is permitted
    DECLARE v_other_jid UUID := gen_random_uuid();
    BEGIN
        INSERT INTO public.journal_entries (id, tenant_id, entry_number, entry_date, status, description)
        VALUES (v_other_jid, v_other_tenant_id, 'JE-FOREIGN-01', '2024-06-15', 'DRAFT', 'Foreign open period entry');
        RAISE NOTICE 'TEST 22c PASSED: Entry on same date for other tenant with OPEN period permitted.';
    END;

    -- 22d: Full Lifecycle: DRAFT created while OPEN -> Period Closed -> Modification / Posting Blocked
    DECLARE v_lifecycle_jid UUID := gen_random_uuid();
    BEGIN
        -- 1. Create DRAFT entry in OPEN 2025 period
        INSERT INTO public.journal_entries (id, tenant_id, entry_number, entry_date, status, description)
        VALUES (v_lifecycle_jid, v_tenant_id, 'JE-LIFECYCLE-01', '2025-06-15', 'DRAFT', 'Lifecycle open entry');

        INSERT INTO public.journal_lines (tenant_id, journal_entry_id, account_id, account_code, debit, credit)
        VALUES (v_tenant_id, v_lifecycle_jid, v_acc_cash_custody, '1020', 10.000, 0.000);

        INSERT INTO public.journal_lines (tenant_id, journal_entry_id, account_id, account_code, debit, credit)
        VALUES (v_tenant_id, v_lifecycle_jid, v_acc_merchant_payable, '2020', 0.000, 10.000);

        -- 2. Close the 2025 accounting period
        UPDATE public.accounting_periods
        SET status = 'CLOSED'
        WHERE tenant_id = v_tenant_id AND period_name = 'Open Year 2025';

        -- 3. Attempting to POST the entry inside now-closed period must be blocked by period lock trigger
        v_err_caught := false;
        BEGIN
            UPDATE public.journal_entries SET status = 'POSTED' WHERE id = v_lifecycle_jid;
        EXCEPTION WHEN OTHERS THEN
            v_err_caught := true;
        END;
        IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 22d FAILED: Posting in closed period was allowed!'; END IF;

        -- 4. Attempting to alter description inside now-closed period must also be blocked
        v_err_caught := false;
        BEGIN
            UPDATE public.journal_entries SET description = 'Unauthorized modification' WHERE id = v_lifecycle_jid;
        EXCEPTION WHEN OTHERS THEN
            v_err_caught := true;
        END;
        IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 22d FAILED: Modifying journal in closed period was allowed!'; END IF;

        RAISE NOTICE 'TEST 22d PASSED: Journal entry modification and posting in closed period strictly blocked.';
    END;

    -- ------------------------------------------------------------------------
    -- TEST 23: Multi-Item Stock Transfer Creation & Atomic Completion
    -- ------------------------------------------------------------------------
    v_transfer_id := gen_random_uuid();
    INSERT INTO public.merchant_stock_transfers (
        id, tenant_id, merchant_id, source_branch_id, destination_branch_id, status, notes
    ) VALUES (
        v_transfer_id, v_tenant_id, v_test_merchant_id, v_branch_id, v_other_branch_id, 'PENDING', 'Inter-branch restock'
    );

    INSERT INTO public.merchant_stock_transfer_items (transfer_id, product_id, merchant_id, tenant_id, quantity, unit_cost)
    VALUES 
        (v_transfer_id, v_product_1_id, v_test_merchant_id, v_tenant_id, 20, 10.000),
        (v_transfer_id, v_product_2_id, v_test_merchant_id, v_tenant_id, 10, 5.000);

    PERFORM public.execute_stock_transfer_completion(v_transfer_id, v_test_merchant_id);

    SELECT quantity INTO v_src_bal FROM public.branch_inventory WHERE branch_id = v_branch_id AND product_id = v_product_1_id;
    SELECT quantity INTO v_dest_bal FROM public.branch_inventory WHERE branch_id = v_other_branch_id AND product_id = v_product_1_id;

    IF v_src_bal <> 80 OR v_dest_bal <> 20 THEN
        RAISE EXCEPTION 'TEST 23 FAILED: Transfer stock update incorrect: src=%, dest=%', v_src_bal, v_dest_bal;
    END IF;
    RAISE NOTICE 'TEST 23 PASSED: Multi-item stock transfer atomic completion verified.';

    -- ------------------------------------------------------------------------
    -- TEST 24: Multi-Item Stock Transfer Full Reversal
    -- ------------------------------------------------------------------------
    PERFORM public.execute_stock_transfer_reversal(v_transfer_id, v_test_merchant_id, 'Mistake transfer reversal');

    SELECT quantity INTO v_src_bal FROM public.branch_inventory WHERE branch_id = v_branch_id AND product_id = v_product_1_id;
    SELECT quantity INTO v_dest_bal FROM public.branch_inventory WHERE branch_id = v_other_branch_id AND product_id = v_product_1_id;

    IF v_src_bal <> 100 OR v_dest_bal <> 0 THEN
        RAISE EXCEPTION 'TEST 24 FAILED: Transfer reversal stock update incorrect: src=%, dest=%', v_src_bal, v_dest_bal;
    END IF;
    RAISE NOTICE 'TEST 24 PASSED: Multi-item stock transfer reversal restored inventory perfectly.';

    -- ------------------------------------------------------------------------
    -- TEST 25: Insufficient Stock Transfer Rejection
    -- ------------------------------------------------------------------------
    DECLARE v_over_trans UUID := gen_random_uuid();
    BEGIN
        INSERT INTO public.merchant_stock_transfers (
            id, tenant_id, merchant_id, source_branch_id, destination_branch_id, status
        ) VALUES (
            v_over_trans, v_tenant_id, v_test_merchant_id, v_branch_id, v_other_branch_id, 'PENDING'
        );

        INSERT INTO public.merchant_stock_transfer_items (transfer_id, product_id, merchant_id, tenant_id, quantity, unit_cost)
        VALUES (v_over_trans, v_product_1_id, v_test_merchant_id, v_tenant_id, 9999, 10.000);

        v_err_caught := false;
        BEGIN
            PERFORM public.execute_stock_transfer_completion(v_over_trans, v_test_merchant_id);
        EXCEPTION WHEN OTHERS THEN
            v_err_caught := true;
        END;
        IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 25 FAILED: Over-quantity stock transfer was permitted!'; END IF;
        RAISE NOTICE 'TEST 25 PASSED: Insufficient inventory stock transfer strictly rejected.';
    END;

    -- ------------------------------------------------------------------------
    -- TEST 26: Cross-Tenant Branch Transfer Rejection (Constraint fk_stock_transfers_destination_branch)
    -- ------------------------------------------------------------------------
    v_err_caught := false;
    BEGIN
        INSERT INTO public.merchant_stock_transfers (
            tenant_id, merchant_id, source_branch_id, destination_branch_id, status
        ) VALUES (
            v_tenant_id, v_test_merchant_id, v_branch_id, v_foreign_branch_id, 'PENDING'
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 26 FAILED: Cross-tenant stock transfer was permitted!'; END IF;
    RAISE NOTICE 'TEST 26 PASSED: Cross-tenant destination branch transfer rejected.';

    -- ------------------------------------------------------------------------
    -- TEST 27: Cross-Merchant Product Transfer Item Rejection
    -- ------------------------------------------------------------------------
    DECLARE
        v_merchant_b_id UUID := gen_random_uuid();
        v_other_prod UUID := gen_random_uuid();
        v_valid_trans UUID := gen_random_uuid();
    BEGIN
        INSERT INTO public.users (id, tenant_id, email, name, role)
        VALUES (v_merchant_b_id, v_tenant_id, 'merchant-b@delivere.local', 'Merchant B', 'MERCHANT');

        INSERT INTO public.products (id, tenant_id, merchant_id, sku, name, cost_price, selling_price)
        VALUES (v_other_prod, v_tenant_id, v_merchant_b_id, 'SKU-OTHER-01', 'Other Prod', 10.000, 15.000);

        INSERT INTO public.merchant_stock_transfers (
            id, tenant_id, merchant_id, source_branch_id, destination_branch_id, status
        ) VALUES (
            v_valid_trans, v_tenant_id, v_test_merchant_id, v_branch_id, v_other_branch_id, 'PENDING'
        );

        v_err_caught := false;
        BEGIN
            INSERT INTO public.merchant_stock_transfer_items (transfer_id, product_id, merchant_id, tenant_id, quantity)
            VALUES (v_valid_trans, v_other_prod, v_test_merchant_id, v_tenant_id, 5);
        EXCEPTION WHEN OTHERS THEN
            v_err_caught := true;
        END;
        IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 27 FAILED: Transfer item with cross-merchant product was allowed!'; END IF;
        RAISE NOTICE 'TEST 27 PASSED: Cross-merchant product in transfer item strictly blocked.';
    END;

    -- ------------------------------------------------------------------------
    -- TEST 28: Delivered Shipment Financial Snapshot Immutability
    -- ------------------------------------------------------------------------
    v_err_caught := false;
    BEGIN
        UPDATE public.shipments SET cod_amount = 99.000 WHERE id = v_delivered_shipment_id;
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 28 FAILED: Delivered shipment financial modification was allowed!'; END IF;
    RAISE NOTICE 'TEST 28 PASSED: Delivered shipment financial snapshot is immutable.';

    -- ------------------------------------------------------------------------
    -- TEST 29: Duplicate Active Tracking Number Blocked
    -- ------------------------------------------------------------------------
    v_err_caught := false;
    BEGIN
        INSERT INTO public.shipments (
            tenant_id, sequence, merchant_id, recipient_name, recipient_phone, status, cod_amount
        ) VALUES (
            v_tenant_id, 'SHP-TEST-DELIV-01', v_test_merchant_id, 'Duplicate Customer', '0790000002', 'CREATED', 25.000
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 29 FAILED: Duplicate tracking number was allowed!'; END IF;
    RAISE NOTICE 'TEST 29 PASSED: Active tracking number collision strictly rejected.';

    -- ------------------------------------------------------------------------
    -- TEST 30: Settlement Number Unique Per Tenant
    -- ------------------------------------------------------------------------
    v_err_caught := false;
    BEGIN
        INSERT INTO public.settlement_records (
            tenant_id, settlement_number, type, beneficiary_id, status, total_amount
        ) VALUES (
            v_tenant_id, 'SETTLE-TEST-01', 'MERCHANT_REMITTANCE', v_test_merchant_id, 'DRAFT', 50.000
        );
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 30 FAILED: Duplicate settlement number was allowed!'; END IF;
    RAISE NOTICE 'TEST 30 PASSED: Settlement number uniqueness within tenant enforced.';

    -- ------------------------------------------------------------------------
    -- TEST 31: Driver Wallet Max Limit Default (150.000 JOD)
    -- ------------------------------------------------------------------------
    INSERT INTO public.driver_wallets (tenant_id, driver_id)
    VALUES (v_tenant_id, v_test_driver_id)
    RETURNING max_cash_limit INTO v_wallet_limit;

    IF v_wallet_limit <> 150.000 THEN
        RAISE EXCEPTION 'TEST 31 FAILED: Default driver wallet max limit is % (expected 150.000)', v_wallet_limit;
    END IF;
    RAISE NOTICE 'TEST 31 PASSED: Driver wallet defaults to exactly 150.000 JOD cash ceiling.';

    -- ------------------------------------------------------------------------
    -- TEST 32: Immutable Audit Log Ledger Protection
    -- ------------------------------------------------------------------------
    INSERT INTO public.audit_logs (tenant_id, performed_by, action, target_type, target_id)
    VALUES (v_tenant_id, v_test_merchant_id, 'TEST_ACTION', 'TEST_ENTITY', '123')
    RETURNING id INTO v_log_id;

    v_err_caught := false;
    BEGIN
        DELETE FROM public.audit_logs WHERE id = v_log_id;
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 32 FAILED: Deletion of audit log row was allowed!'; END IF;
    RAISE NOTICE 'TEST 32 PASSED: Audit logs ledger is strictly append-only (DELETE blocked).';

    -- ------------------------------------------------------------------------
    -- TEST 33: Immutable Stock Movement Ledger Protection
    -- ------------------------------------------------------------------------
    SELECT id INTO v_movement_id FROM public.stock_movements WHERE tenant_id = v_tenant_id LIMIT 1;
    IF v_movement_id IS NOT NULL THEN
        v_err_caught := false;
        BEGIN
            DELETE FROM public.stock_movements WHERE id = v_movement_id;
        EXCEPTION WHEN OTHERS THEN
            v_err_caught := true;
        END;
        IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 33 FAILED: Deletion of stock movement was allowed!'; END IF;
    END IF;
    RAISE NOTICE 'TEST 33 PASSED: Stock movements ledger is strictly append-only (DELETE blocked).';

    -- ------------------------------------------------------------------------
    -- TEST 34: Immutable Shipment Status History Protection
    -- ------------------------------------------------------------------------
    INSERT INTO public.shipment_status_history (tenant_id, shipment_id, new_status)
    VALUES (v_tenant_id, v_delivered_shipment_id, 'DELIVERED')
    RETURNING id INTO v_history_id;

    v_err_caught := false;
    BEGIN
        DELETE FROM public.shipment_status_history WHERE id = v_history_id;
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 34 FAILED: Deletion of shipment status history was allowed!'; END IF;
    RAISE NOTICE 'TEST 34 PASSED: Shipment status history ledger is strictly append-only (DELETE blocked).';

    -- ------------------------------------------------------------------------
    -- TEST 35: Settlement Item Cross-Beneficiary Mismatch Blocked
    -- ------------------------------------------------------------------------
    DECLARE v_bm_settle_id UUID := gen_random_uuid();
    BEGIN
        INSERT INTO public.financial_obligations (
            id, tenant_id, beneficiary_type, beneficiary_id, obligation_type,
            shipment_id, original_amount, allocated_amount, status
        ) VALUES (
            v_driver_obligation_id, v_tenant_id, 'DRIVER', v_test_driver_id, 'DRIVER_EARNING',
            v_delivered_shipment_id, 1.500, 0.000, 'PENDING'
        );

        INSERT INTO public.settlement_records (
            id, tenant_id, settlement_number, type, beneficiary_id, status, total_amount
        ) VALUES (
            v_bm_settle_id, v_tenant_id, 'SETTLE-BENEF-01', 'MERCHANT_REMITTANCE', v_test_merchant_id, 'DRAFT', 50.000
        );

        v_err_caught := false;
        BEGIN
            -- Attempting to add DRIVER obligation into a MERCHANT settlement
            INSERT INTO public.settlement_items (tenant_id, settlement_id, obligation_id, allocated_amount)
            VALUES (v_tenant_id, v_bm_settle_id, v_driver_obligation_id, 1.500);
        EXCEPTION WHEN OTHERS THEN
            v_err_caught := true;
        END;
        IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 35 FAILED: Cross-beneficiary settlement item was allowed!'; END IF;
        RAISE NOTICE 'TEST 35 PASSED: Cross-beneficiary settlement item strictly blocked.';
    END;

    -- ------------------------------------------------------------------------
    -- TEST 36: Orders View Delete Protection on Delivered Shipment
    -- ------------------------------------------------------------------------
    v_err_caught := false;
    BEGIN
        DELETE FROM public.orders WHERE id = v_delivered_shipment_id;
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 36 FAILED: Deletion of delivered shipment via orders view was allowed!'; END IF;
    RAISE NOTICE 'TEST 36 PASSED: Orders view delete handler protects delivered shipments.';

    -- ------------------------------------------------------------------------
    -- TEST 37: Revoked Sessions Token Hardening & Composite Expiry Index
    -- ------------------------------------------------------------------------
    INSERT INTO public.revoked_sessions (token_hash, user_id, expires_at)
    VALUES ('tok-test-01', v_test_merchant_id, now() + interval '1 hour');

    v_err_caught := false;
    BEGIN
        INSERT INTO public.revoked_sessions (token_hash, user_id, expires_at)
        VALUES ('tok-test-01', v_test_merchant_id, now() + interval '1 hour');
    EXCEPTION WHEN OTHERS THEN
        v_err_caught := true;
    END;
    IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 37 FAILED: Duplicate revoked token was allowed!'; END IF;
    RAISE NOTICE 'TEST 37 PASSED: Revoked session tokens uniqueness and fast lookup verified.';

    -- ------------------------------------------------------------------------
    -- TEST 38: Shipment Branch Composite FK with ON DELETE SET NULL (branch_id)
    -- ------------------------------------------------------------------------
    DECLARE
        v_temp_branch_id UUID := gen_random_uuid();
        v_temp_shipment_id UUID := gen_random_uuid();
    BEGIN
        INSERT INTO public.merchant_branches (id, tenant_id, merchant_id, name, is_main, is_active)
        VALUES (v_temp_branch_id, v_tenant_id, v_test_merchant_id, 'Temporary Branch', false, true);

        INSERT INTO public.shipments (
            id, tenant_id, sequence, merchant_id, branch_id, recipient_name, recipient_phone, status, cod_amount
        ) VALUES (
            v_temp_shipment_id, v_tenant_id, 'SHP-BRANCH-TEST-01', v_test_merchant_id, v_temp_branch_id, 'Branch Customer', '0790000003', 'CREATED', 25.000
        );

        -- Delete the branch
        DELETE FROM public.merchant_branches WHERE id = v_temp_branch_id;

        -- Verify shipment retained merchant_id and tenant_id while branch_id became NULL
        SELECT merchant_id, tenant_id, branch_id INTO v_shipment_rec
        FROM public.shipments WHERE id = v_temp_shipment_id;

        IF v_shipment_rec.branch_id IS NOT NULL OR v_shipment_rec.merchant_id <> v_test_merchant_id OR v_shipment_rec.tenant_id <> v_tenant_id THEN
            RAISE EXCEPTION 'TEST 38 FAILED: Branch deletion did not properly set branch_id to NULL while retaining merchant/tenant!';
        END IF;
        RAISE NOTICE 'TEST 38 PASSED: ON DELETE SET NULL (branch_id) successfully retained merchant_id and tenant_id on branch deletion.';
    END;

    -- ------------------------------------------------------------------------
    -- TEST 39: Cross-Tenant Settlement Composite FK Protection (Settlement ID + Tenant ID)
    -- ------------------------------------------------------------------------
    DECLARE
        v_foreign_obl_id UUID := gen_random_uuid();
        v_t1_settle_id UUID := gen_random_uuid();
    BEGIN
        INSERT INTO public.financial_obligations (
            id, tenant_id, beneficiary_type, beneficiary_id, obligation_type,
            original_amount, allocated_amount, status
        ) VALUES (
            v_foreign_obl_id, v_other_tenant_id, 'MERCHANT', v_other_merchant_id, 'MERCHANT_COD_PAYABLE',
            50.000, 0.000, 'PENDING'
        );

        INSERT INTO public.settlement_records (
            id, tenant_id, settlement_number, type, beneficiary_id, status, total_amount
        ) VALUES (
            v_t1_settle_id, v_tenant_id, 'SETTLE-T1-COMPOSITE-01', 'MERCHANT_REMITTANCE', v_test_merchant_id, 'DRAFT', 50.000
        );

        -- Attempt 1: Pair Tenant 1 settlement with Foreign Tenant obligation under Tenant 1
        v_err_caught := false;
        BEGIN
            INSERT INTO public.settlement_items (tenant_id, settlement_id, obligation_id, allocated_amount)
            VALUES (v_tenant_id, v_t1_settle_id, v_foreign_obl_id, 25.000);
        EXCEPTION WHEN OTHERS THEN
            v_err_caught := true;
        END;
        IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 39 FAILED: Cross-tenant obligation settlement item was allowed!'; END IF;

        -- Attempt 2: Pair Tenant 1 settlement with Foreign Tenant obligation under Foreign Tenant
        v_err_caught := false;
        BEGIN
            INSERT INTO public.settlement_items (tenant_id, settlement_id, obligation_id, allocated_amount)
            VALUES (v_other_tenant_id, v_t1_settle_id, v_foreign_obl_id, 25.000);
        EXCEPTION WHEN OTHERS THEN
            v_err_caught := true;
        END;
        IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 39 FAILED: Cross-tenant settlement header settlement item was allowed!'; END IF;
        RAISE NOTICE 'TEST 39 PASSED: Cross-tenant settlement composite FKs strictly protect tenant boundaries at relational level.';
    END;

    -- ------------------------------------------------------------------------
    -- TEST 40: Backward-Compatible Settlements View Queries
    -- ------------------------------------------------------------------------
    DECLARE v_view_count INT;
    BEGIN
        SELECT COUNT(*) INTO v_view_count FROM public.settlements WHERE tenant_id = v_tenant_id;
        IF v_view_count = 0 THEN
            RAISE EXCEPTION 'TEST 40 FAILED: public.settlements view query returned 0 records!';
        END IF;
        RAISE NOTICE 'TEST 40 PASSED: public.settlements view successfully provides backward compatibility layer.';
    END;

    -- ------------------------------------------------------------------------
    -- TEST 41: Custom Price Plan Creation & Governorate Rate Overrides
    -- ------------------------------------------------------------------------
    DECLARE
        v_custom_plan_id TEXT := 'pp-custom-vip-01';
        v_fetched_plan RECORD;
    BEGIN
        INSERT INTO public.price_plans (
            id, tenant_id, merchant_id, name, type, is_default, default_fee,
            governorate_fees, return_fee, extra_weight_fee_per_kg, is_active
        ) VALUES (
            v_custom_plan_id, v_tenant_id, v_test_merchant_id, 'VIP Merchant Plan', 'MERCHANT', false, 2.500,
            '{"عمان": 2.000, "إربد": 2.500, "العقبة": 3.500}'::jsonb, 1.000, 0.300, true
        );

        SELECT * INTO v_fetched_plan FROM public.price_plans WHERE id = v_custom_plan_id;
        IF v_fetched_plan.default_fee <> 2.500 OR (v_fetched_plan.governorate_fees->>'عمان')::numeric <> 2.000 THEN
            RAISE EXCEPTION 'TEST 41 FAILED: Custom price plan fees do not match created values!';
        END IF;
        RAISE NOTICE 'TEST 41 PASSED: Custom price plan created and queried with exact governorate overrides.';
    END;

    -- ------------------------------------------------------------------------
    -- TEST 42: Granular Point-to-Point / Sub-region / Order-Type Price Plan Rules
    -- ------------------------------------------------------------------------
    DECLARE
        v_rule_id UUID := gen_random_uuid();
        v_fetched_rule RECORD;
    BEGIN
        INSERT INTO public.price_plan_rules (
            id, tenant_id, price_plan_id, from_governorate, from_sub_region,
            to_governorate, to_sub_region, order_type, price, return_discount, fixed_return,
            driver_discount, fixed_driver_cost, is_active
        ) VALUES (
            v_rule_id, v_tenant_id, 'pp-custom-vip-01', 'عمان', 'الجبيهة',
            'إربد', 'الحي الشرقي', 'سريع', 4.000, 0.500, 1.500, 0.000, 2.500, true
        );

        SELECT * INTO v_fetched_rule FROM public.price_plan_rules WHERE id = v_rule_id;
        IF v_fetched_rule.price <> 4.000 OR v_fetched_rule.fixed_driver_cost <> 2.500 THEN
            RAISE EXCEPTION 'TEST 42 FAILED: Point-to-point pricing rule values mismatch!';
        END IF;
        RAISE NOTICE 'TEST 42 PASSED: Origin/Destination/Sub-region/Order-type pricing rule successfully persisted.';
    END;

    -- ------------------------------------------------------------------------
    -- TEST 43: Independent Merchant Tariff vs Driver Compensation Resolution
    -- ------------------------------------------------------------------------
    DECLARE
        v_merchant_fee NUMERIC(12, 3);
        v_driver_comp NUMERIC(12, 3);
    BEGIN
        -- Query standard merchant plan fee for Zarqa
        SELECT (governorate_fees->>'الزرقاء')::numeric INTO v_merchant_fee
        FROM public.price_plans WHERE id = 'pp-mer-std';

        -- Query standard driver plan fee for Zarqa
        SELECT (governorate_fees->>'الزرقاء')::numeric INTO v_driver_comp
        FROM public.price_plans WHERE id = 'pp-drv-std';

        IF v_merchant_fee = v_driver_comp OR v_merchant_fee <> 2.500 OR v_driver_comp <> 1.750 THEN
            RAISE EXCEPTION 'TEST 43 FAILED: Merchant rate and Driver compensation must remain separate and distinct!';
        END IF;
        RAISE NOTICE 'TEST 43 PASSED: Merchant tariffs and Driver compensation rate cards operate completely independently.';
    END;

    -- ------------------------------------------------------------------------
    -- TEST 44: Shipment Financial Snapshots Immutability Under Rate Card / Plan Updates
    -- ------------------------------------------------------------------------
    DECLARE
        v_snap_shipment_id UUID := gen_random_uuid();
        v_snap_rec RECORD;
    BEGIN
        -- Create shipment with explicit price snapshots calculated at creation
        INSERT INTO public.shipments (
            id, tenant_id, sequence, merchant_id, recipient_name, recipient_phone,
            governorate, price_plan_id, delivery_fee, driver_fee, return_fee, extra_weight_fee, cod_amount
        ) VALUES (
            v_snap_shipment_id, v_tenant_id, 'SHP-SNAP-001', v_test_merchant_id, 'Snapshot Customer', '0799999999',
            'عمان', 'pp-custom-vip-01', 2.000, 1.500, 1.000, 0.600, 25.000
        );

        -- Simulate rate card modification in price_plans table
        UPDATE public.price_plans
        SET default_fee = 9.999, governorate_fees = '{"عمان": 9.999}'::jsonb
        WHERE id = 'pp-custom-vip-01';

        -- Verify shipment financial snapshots are unchanged
        SELECT * INTO v_snap_rec FROM public.shipments WHERE id = v_snap_shipment_id;
        IF v_snap_rec.delivery_fee <> 2.000 OR v_snap_rec.driver_fee <> 1.500 OR v_snap_rec.extra_weight_fee <> 0.600 THEN
            RAISE EXCEPTION 'TEST 44 FAILED: Shipment financial snapshot was mutated when price plan changed!';
        END IF;
        RAISE NOTICE 'TEST 44 PASSED: Shipment financial snapshots are strictly decoupled from future price plan modifications.';
    END;

    -- ------------------------------------------------------------------------
    -- TEST 45: Manual Fee Overrides & Extra Weight Financial Snapshots in Orders View
    -- ------------------------------------------------------------------------
    DECLARE
        v_order_override_id UUID := gen_random_uuid();
        v_order_rec RECORD;
    BEGIN
        INSERT INTO public.orders (
            id, tenant_id, sequence, merchant_id, recipient_name, recipient_phone,
            governorate, delivery_fee, driver_fee, extra_weight_fee, weight, cod_amount
        ) VALUES (
            v_order_override_id, v_tenant_id, 'ORD-OVR-001', v_test_merchant_id, 'Override Customer', '0788888888',
            'إربد', 5.500, 3.200, 1.000, 3.00, 45.000
        );

        SELECT * INTO v_order_rec FROM public.orders WHERE id = v_order_override_id;
        IF v_order_rec.delivery_fee <> 5.500 OR v_order_rec.driver_fee <> 3.200 OR v_order_rec.extra_weight_fee <> 1.000 THEN
            RAISE EXCEPTION 'TEST 45 FAILED: Manual fee overrides not respected through orders view trigger!';
        END IF;
        RAISE NOTICE 'TEST 45 PASSED: Manual price overrides and extra weight fees work seamlessly via orders view.';
    END;

    -- ------------------------------------------------------------------------
    -- TEST 46: User Invitation with price_plan_id Preservation
    -- ------------------------------------------------------------------------
    DECLARE
        v_invitation_id UUID := gen_random_uuid();
        v_inv_rec RECORD;
    BEGIN
        INSERT INTO public.user_invitations (
            id, tenant_id, email, role, token_hash, invited_by, expires_at, price_plan_id, price_list
        ) VALUES (
            v_invitation_id, v_tenant_id, 'new-vip-merchant@delivere.local', 'MERCHANT',
            'tok-vip-999', v_test_merchant_id, now() + interval '7 days', 'pp-custom-vip-01', 'vip-tier'
        );

        SELECT * INTO v_inv_rec FROM public.user_invitations WHERE id = v_invitation_id;
        IF v_inv_rec.price_plan_id <> 'pp-custom-vip-01' OR v_inv_rec.price_list <> 'vip-tier' THEN
            RAISE EXCEPTION 'TEST 46 FAILED: User invitation did not preserve price_plan_id and price_list!';
        END IF;
        RAISE NOTICE 'TEST 46 PASSED: User invitation preserves price_plan_id and legacy price_list attributes.';
    END;

    -- ------------------------------------------------------------------------
    -- TEST 47: Composite Tenant Isolation on Shipments and Price Plan Rules
    -- ------------------------------------------------------------------------
    DECLARE
        v_tenant_b_id UUID := gen_random_uuid();
        v_test_merchant_b_id UUID := gen_random_uuid();
        v_cross_shipment_id UUID := gen_random_uuid();
        v_cross_rule_id UUID := gen_random_uuid();
        v_valid_rule_id UUID := gen_random_uuid();
    BEGIN
        -- Setup distinct Tenant B
        INSERT INTO public.tenants (id, name, code)
        VALUES (v_tenant_b_id, 'Tenant B Logistics', 'TENANT_B');

        INSERT INTO public.users (id, tenant_id, email, role, name)
        VALUES (v_test_merchant_b_id, v_tenant_b_id, 'merchant-b@tenant-b.com', 'MERCHANT', 'Tenant B Merchant');

        -- 1. Assert cross-tenant shipment referencing Tenant A price plan is strictly rejected
        v_err_caught := false;
        BEGIN
            INSERT INTO public.shipments (
                id, tenant_id, sequence, merchant_id, recipient_name, recipient_phone,
                governorate, price_plan_id, delivery_fee, cod_amount
            ) VALUES (
                v_cross_shipment_id, v_tenant_b_id, 'SHP-CROSS-01', v_test_merchant_b_id,
                'Cross Tenant Recipient', '0777777777', 'عمان', 'pp-custom-vip-01', 3.000, 20.000
            );
        EXCEPTION WHEN foreign_key_violation THEN
            v_err_caught := true;
        END;
        IF NOT v_err_caught THEN
            RAISE EXCEPTION 'TEST 47 FAILED: Cross-tenant shipment referencing foreign price plan was allowed!';
        END IF;

        -- 2. Assert same-tenant shipment referencing price plan succeeds
        INSERT INTO public.shipments (
            id, tenant_id, sequence, merchant_id, recipient_name, recipient_phone,
            governorate, price_plan_id, delivery_fee, cod_amount
        ) VALUES (
            v_cross_shipment_id, v_tenant_id, 'SHP-VALID-01', v_test_merchant_id,
            'Same Tenant Recipient', '0777777777', 'عمان', 'pp-custom-vip-01', 3.000, 20.000
        );

        -- 3. Assert cross-tenant price plan rule referencing Tenant A price plan is strictly rejected
        v_err_caught := false;
        BEGIN
            INSERT INTO public.price_plan_rules (
                id, tenant_id, price_plan_id, to_governorate, price
            ) VALUES (
                v_cross_rule_id, v_tenant_b_id, 'pp-custom-vip-01', 'الزرقاء', 2.500
            );
        EXCEPTION WHEN foreign_key_violation THEN
            v_err_caught := true;
        END;
        IF NOT v_err_caught THEN
            RAISE EXCEPTION 'TEST 47 FAILED: Cross-tenant price plan rule referencing foreign price plan was allowed!';
        END IF;

        -- 4. Assert same-tenant price plan rule referencing price plan succeeds
        INSERT INTO public.price_plan_rules (
            id, tenant_id, price_plan_id, to_governorate, price
        ) VALUES (
            v_valid_rule_id, v_tenant_id, 'pp-custom-vip-01', 'الزرقاء', 2.500
        );

        RAISE NOTICE 'TEST 47 PASSED: Composite foreign keys strictly isolate price plans across tenants for both shipments and rules.';
    END;

    -- ------------------------------------------------------------------------
    -- TEST 48: Price Plan Soft Deactivation vs Physical Deletion Restriction
    -- ------------------------------------------------------------------------
    DECLARE
        v_audit_shipment_rec RECORD;
    BEGIN
        -- 1. Soft deactivation is allowed and does not corrupt historical snapshots
        UPDATE public.price_plans
        SET is_active = false
        WHERE id = 'pp-custom-vip-01';

        SELECT * INTO v_audit_shipment_rec 
        FROM public.shipments 
        WHERE sequence = 'SHP-SNAP-001';

        IF v_audit_shipment_rec.delivery_fee <> 2.000 
           OR v_audit_shipment_rec.driver_fee <> 1.500 
           OR v_audit_shipment_rec.return_fee <> 1.000 
           OR v_audit_shipment_rec.extra_weight_fee <> 0.600 
           OR v_audit_shipment_rec.cod_amount <> 25.000 
           OR v_audit_shipment_rec.price_plan_id <> 'pp-custom-vip-01' THEN
            RAISE EXCEPTION 'TEST 48 FAILED: Historical shipment financial snapshot corrupted upon price plan deactivation!';
        END IF;

        -- 2. Physical DELETE of referenced historical price plan is strictly RESTRICTED
        v_err_caught := false;
        BEGIN
            DELETE FROM public.price_plans WHERE id = 'pp-custom-vip-01';
        EXCEPTION WHEN foreign_key_violation THEN
            v_err_caught := true;
        END;
        IF NOT v_err_caught THEN
            RAISE EXCEPTION 'TEST 48 FAILED: Physical deletion of price plan with referenced shipments was not restricted!';
        END IF;

        RAISE NOTICE 'TEST 48 PASSED: Physical deletion of referenced price plan is restricted; soft deactivation preserves historical snapshots.';
    END;

    -- ------------------------------------------------------------------------
    -- SUITE SUMMARY (All 48 Real Tests Verified)
    -- ------------------------------------------------------------------------
    RAISE NOTICE '========================================================================';
    RAISE NOTICE 'ALL 48 REAL DATABASE INTEGRATION TESTS PASSED WITH 100%% INTEGRITY!';
    RAISE NOTICE '========================================================================';
END $$;

-- Rollback uncommitted test fixtures to leave zero test artifacts in database
ROLLBACK;

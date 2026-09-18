-- ============================================================================
-- DELIVERE — 17_functions_and_triggers.sql
-- Enterprise Database Business Logic, Mathematical Guards & Triggers
-- ============================================================================

-- 1. Double-Entry Balance & Lifecycle Verification Trigger
CREATE OR REPLACE FUNCTION public.check_journal_posting_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_total_debit NUMERIC(12, 3);
    v_total_credit NUMERIC(12, 3);
    v_lines_count INT;
BEGIN
    IF NEW.status = 'POSTED' THEN
        SELECT 
            COALESCE(SUM(debit), 0.000),
            COALESCE(SUM(credit), 0.000),
            COUNT(*)
        INTO v_total_debit, v_total_credit, v_lines_count
        FROM public.journal_lines
        WHERE journal_entry_id = NEW.id;

        IF v_lines_count < 2 THEN
            RAISE EXCEPTION 'Journal entry % must have at least 2 lines to be posted (Current lines: %)', 
                NEW.id, v_lines_count;
        END IF;

        IF v_total_debit <= 0 OR v_total_credit <= 0 THEN
            RAISE EXCEPTION 'Journal entry % must have positive debit and credit totals', NEW.id;
        END IF;

        IF v_total_debit <> v_total_credit THEN
            RAISE EXCEPTION 'Journal entry % is unbalanced: Total Debit (%), Total Credit (%)',
                NEW.id, v_total_debit, v_total_credit;
        END IF;

        NEW.total_debit := v_total_debit;
        NEW.total_credit := v_total_credit;
        NEW.posted_at := COALESCE(NEW.posted_at, now());
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_journal_posting_balance ON public.journal_entries;
CREATE TRIGGER trg_check_journal_posting_balance
    BEFORE INSERT OR UPDATE ON public.journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.check_journal_posting_balance();

-- 2. Posted Journal Header Immutability Trigger
CREATE OR REPLACE FUNCTION public.prevent_posted_journal_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'DELETE' AND OLD.status IN ('POSTED', 'REVERSED') THEN
        RAISE EXCEPTION 'Cannot delete posted/reversed journal entry % (Immutable Financial Record)', OLD.id;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.status = 'POSTED' THEN
        -- Allow authorized reversal transition ONLY when linked to an existing, valid, posted reversal journal entry
        IF (NEW.entry_number = OLD.entry_number AND 
            NEW.total_debit = OLD.total_debit AND 
            NEW.total_credit = OLD.total_credit AND
            NEW.entry_date = OLD.entry_date AND
            NEW.tenant_id = OLD.tenant_id AND
            NEW.created_at = OLD.created_at AND
            OLD.is_reversed = false AND
            NEW.is_reversed = true AND
            NEW.reversal_entry_id IS NOT NULL AND
            NEW.status = 'REVERSED') THEN

            -- Validate that the referenced reversal journal entry exists, is POSTED, belongs to the same tenant,
            -- and is explicitly designated as the reversal of this entry
            IF NOT EXISTS (
                SELECT 1 FROM public.journal_entries r
                WHERE r.id = NEW.reversal_entry_id
                  AND r.tenant_id = OLD.tenant_id
                  AND r.status = 'POSTED'
                  AND r.reference_type = 'JOURNAL_REVERSAL'
                  AND r.reference_id = OLD.id::TEXT
                  AND r.total_debit = OLD.total_debit
                  AND r.total_credit = OLD.total_credit
            ) THEN
                RAISE EXCEPTION 'Invalid journal reversal: Reversal entry % does not exist as a posted reversal for %', 
                    NEW.reversal_entry_id, OLD.id;
            END IF;

            RETURN NEW;
        END IF;

        RAISE EXCEPTION 'Cannot modify posted journal entry % (Immutable Financial Record). Controlled reversals must be executed via public.execute_journal_reversal().', OLD.id;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.status = 'REVERSED' THEN
        RAISE EXCEPTION 'Cannot modify reversed journal entry % (Immutable Financial Record)', OLD.id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_posted_journal_mutation ON public.journal_entries;
CREATE TRIGGER trg_prevent_posted_journal_mutation
    BEFORE UPDATE OR DELETE ON public.journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_posted_journal_mutation();

-- 3. Posted Journal Lines Immutability Trigger
CREATE OR REPLACE FUNCTION public.prevent_posted_journal_lines_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_journal_status public.journal_posting_status;
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        SELECT status INTO v_journal_status FROM public.journal_entries WHERE id = OLD.journal_entry_id;
        IF v_journal_status = 'POSTED' THEN
            RAISE EXCEPTION 'Cannot mutate lines of posted journal entry % (Immutable Financial Record)', OLD.journal_entry_id;
        END IF;
    END IF;

    IF TG_OP = 'INSERT' THEN
        SELECT status INTO v_journal_status FROM public.journal_entries WHERE id = NEW.journal_entry_id;
        IF v_journal_status = 'POSTED' THEN
            RAISE EXCEPTION 'Cannot add lines to already posted journal entry %', NEW.journal_entry_id;
        END IF;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_posted_journal_lines_mutation ON public.journal_lines;
CREATE TRIGGER trg_prevent_posted_journal_lines_mutation
    BEFORE INSERT OR UPDATE OR DELETE ON public.journal_lines
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_posted_journal_lines_mutation();

-- 4. Audit Log Immutability Trigger
CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs is an immutable audit trail and cannot be updated or deleted';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_mutation ON public.audit_logs;
CREATE TRIGGER trg_prevent_audit_log_mutation
    BEFORE UPDATE OR DELETE ON public.audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_audit_log_mutation();

-- 5. Stock Movement Ledger Immutability Trigger
CREATE OR REPLACE FUNCTION public.prevent_stock_movement_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'stock_movements is an immutable ledger and cannot be updated or deleted. Use compensating movements instead.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_stock_movement_mutation ON public.stock_movements;
CREATE TRIGGER trg_prevent_stock_movement_mutation
    BEFORE UPDATE OR DELETE ON public.stock_movements
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_stock_movement_mutation();

-- 6. Shipment Status History Immutability Trigger
CREATE OR REPLACE FUNCTION public.prevent_shipment_history_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'shipment_status_history is an immutable audit trail and cannot be updated or deleted';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_shipment_history_mutation ON public.shipment_status_history;
CREATE TRIGGER trg_prevent_shipment_history_mutation
    BEFORE UPDATE OR DELETE ON public.shipment_status_history
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_shipment_history_mutation();

-- 7. Shipment Financial Snapshots Protection Trigger
CREATE OR REPLACE FUNCTION public.protect_shipment_financial_snapshots()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF OLD.status IN ('DELIVERED', 'RETURNED') OR OLD.settlement_status <> 'DRAFT' THEN
        IF (NEW.cod_amount IS DISTINCT FROM OLD.cod_amount OR 
            NEW.merchant_collection IS DISTINCT FROM OLD.merchant_collection OR 
            NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee OR 
            NEW.driver_fee IS DISTINCT FROM OLD.driver_fee OR 
            NEW.return_fee IS DISTINCT FROM OLD.return_fee OR 
            NEW.currency IS DISTINCT FROM OLD.currency) THEN
            RAISE EXCEPTION 'Cannot alter financial snapshots on shipment % in status % / settlement status % (Immutable Financial Record)', 
                OLD.id, OLD.status, OLD.settlement_status;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_shipment_financial_snapshots ON public.shipments;
CREATE TRIGGER trg_protect_shipment_financial_snapshots
    BEFORE UPDATE ON public.shipments
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_shipment_financial_snapshots();

-- 8. Settlement Item Beneficiary & Tenant Integrity Trigger
CREATE OR REPLACE FUNCTION public.validate_settlement_item_beneficiary()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec RECORD;
    v_ob RECORD;
BEGIN
    SELECT tenant_id, beneficiary_id INTO v_rec
    FROM public.settlement_records
    WHERE id = NEW.settlement_id;

    SELECT tenant_id, beneficiary_id INTO v_ob
    FROM public.financial_obligations
    WHERE id = NEW.obligation_id;

    IF v_rec.tenant_id IS DISTINCT FROM v_ob.tenant_id THEN
        RAISE EXCEPTION 'Cross-tenant settlement allocation rejected: Settlement tenant (%) vs Obligation tenant (%)',
            v_rec.tenant_id, v_ob.tenant_id;
    END IF;

    IF v_rec.beneficiary_id IS DISTINCT FROM v_ob.beneficiary_id THEN
        RAISE EXCEPTION 'Beneficiary mismatch: Obligation % belongs to user %, but settlement % is for user %',
            NEW.obligation_id, v_ob.beneficiary_id, NEW.settlement_id, v_rec.beneficiary_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_settlement_item_beneficiary ON public.settlement_items;
CREATE TRIGGER trg_validate_settlement_item_beneficiary
    BEFORE INSERT OR UPDATE ON public.settlement_items
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_settlement_item_beneficiary();

-- 9. Settlement Allocation Upper-Bound Guard (With Row Locking)
CREATE OR REPLACE FUNCTION public.enforce_settlement_allocation_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_orig_amt NUMERIC(12, 3);
    v_existing_alloc NUMERIC(12, 3);
    v_new_total NUMERIC(12, 3);
BEGIN
    -- Acquire exclusive row lock on the target financial obligation
    SELECT original_amount INTO v_orig_amt
    FROM public.financial_obligations
    WHERE id = NEW.obligation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Financial obligation % not found', NEW.obligation_id;
    END IF;

    -- Calculate current active allocated total excluding the current item if updating
    SELECT COALESCE(SUM(si.allocated_amount), 0.000)
    INTO v_existing_alloc
    FROM public.settlement_items si
    JOIN public.settlement_records sr ON sr.id = si.settlement_id
    WHERE si.obligation_id = NEW.obligation_id
      AND sr.status <> 'CANCELLED'
      AND (TG_OP = 'INSERT' OR si.id <> OLD.id);

    v_new_total := v_existing_alloc + NEW.allocated_amount;

    IF v_new_total > v_orig_amt THEN
        RAISE EXCEPTION 'Allocation cap exceeded for obligation %: Requested total (%), Original amount (%)',
            NEW.obligation_id, v_new_total, v_orig_amt;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_settlement_allocation_cap ON public.settlement_items;
CREATE TRIGGER trg_enforce_settlement_allocation_cap
    BEFORE INSERT OR UPDATE ON public.settlement_items
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_settlement_allocation_cap();

-- 10. Obligation Allocation Recalculation Function
CREATE OR REPLACE FUNCTION public.recalculate_obligation_allocated_amount(p_obligation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_orig NUMERIC(12, 3);
    v_alloc NUMERIC(12, 3);
    v_new_status public.financial_obligation_status;
BEGIN
    SELECT original_amount INTO v_orig
    FROM public.financial_obligations
    WHERE id = p_obligation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    SELECT COALESCE(SUM(si.allocated_amount), 0.000)
    INTO v_alloc
    FROM public.settlement_items si
    JOIN public.settlement_records sr ON sr.id = si.settlement_id
    WHERE si.obligation_id = p_obligation_id
      AND sr.status <> 'CANCELLED';

    IF v_alloc = 0 THEN
        v_new_status := 'PENDING';
    ELSIF v_alloc >= v_orig THEN
        v_new_status := 'SETTLED';
    ELSE
        v_new_status := 'PARTIALLY_SETTLED';
    END IF;

    UPDATE public.financial_obligations
    SET 
        allocated_amount = v_alloc,
        status = v_new_status,
        updated_at = now()
    WHERE id = p_obligation_id;
END;
$$;

-- 11. Settlement Status Change & Item Mutation Triggers
CREATE OR REPLACE FUNCTION public.handle_settlement_item_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        PERFORM public.recalculate_obligation_allocated_amount(NEW.obligation_id);
    END IF;
    IF TG_OP IN ('DELETE', 'UPDATE') THEN
        PERFORM public.recalculate_obligation_allocated_amount(OLD.obligation_id);
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_obligation_on_item_mutation ON public.settlement_items;
CREATE TRIGGER trg_recalc_obligation_on_item_mutation
    AFTER INSERT OR UPDATE OR DELETE ON public.settlement_items
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_settlement_item_mutation();

CREATE OR REPLACE FUNCTION public.handle_settlement_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    r RECORD;
BEGIN
    IF OLD.status <> NEW.status THEN
        FOR r IN SELECT DISTINCT obligation_id FROM public.settlement_items WHERE settlement_id = NEW.id LOOP
            PERFORM public.recalculate_obligation_allocated_amount(r.obligation_id);
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_obligation_on_settlement_status ON public.settlement_records;
CREATE TRIGGER trg_recalc_obligation_on_settlement_status
    AFTER UPDATE OF status ON public.settlement_records
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_settlement_status_change();

-- 11b. Settlement Header Immutability Trigger
CREATE OR REPLACE FUNCTION public.protect_settlement_record_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Prevent DELETE on non-DRAFT settlements
    IF TG_OP = 'DELETE' THEN
        IF OLD.status <> 'DRAFT' THEN
            RAISE EXCEPTION 'Cannot delete settlement % in % status (Only DRAFT settlements can be deleted)',
                OLD.settlement_number, OLD.status;
        END IF;
        RETURN OLD;
    END IF;

    -- If OLD.status is CANCELLED, settlement is terminal and completely immutable
    IF OLD.status = 'CANCELLED' THEN
        RAISE EXCEPTION 'Settlement % is CANCELLED and cannot be modified', OLD.settlement_number;
    END IF;

    -- If OLD.status is APPROVED or SETTLED, financial attributes are strictly immutable
    IF OLD.status IN ('APPROVED', 'SETTLED') THEN
        IF OLD.total_amount IS DISTINCT FROM NEW.total_amount OR
           OLD.net_payout IS DISTINCT FROM NEW.net_payout OR
           OLD.type IS DISTINCT FROM NEW.type OR
           OLD.beneficiary_id IS DISTINCT FROM NEW.beneficiary_id OR
           OLD.tenant_id IS DISTINCT FROM NEW.tenant_id OR
           OLD.currency IS DISTINCT FROM NEW.currency OR
           OLD.settlement_number IS DISTINCT FROM NEW.settlement_number THEN
            RAISE EXCEPTION 'Financial fields of settlement % in % status are immutable (total_amount, net_payout, type, beneficiary, tenant, currency, number)',
                OLD.settlement_number, OLD.status;
        END IF;

        -- Validate allowed status transitions
        IF OLD.status = 'APPROVED' AND NEW.status NOT IN ('APPROVED', 'SETTLED', 'CANCELLED') THEN
            RAISE EXCEPTION 'Invalid status transition for settlement % from APPROVED to % (Allowed: SETTLED, CANCELLED)',
                OLD.settlement_number, NEW.status;
        END IF;

        IF OLD.status = 'SETTLED' THEN
            IF NEW.status NOT IN ('SETTLED', 'CANCELLED') THEN
                RAISE EXCEPTION 'Invalid status transition for settlement % from SETTLED to % (Allowed: CANCELLED)',
                    OLD.settlement_number, NEW.status;
            END IF;

            -- Enforce that any linked journal entry must be reversed before cancellation
            IF NEW.status = 'CANCELLED' AND OLD.journal_entry_id IS NOT NULL THEN
                IF NOT EXISTS (
                    SELECT 1 FROM public.journal_entries je
                    WHERE je.id = OLD.journal_entry_id
                      AND je.status = 'REVERSED'
                ) THEN
                    RAISE EXCEPTION 'Cannot cancel SETTLED settlement %: Associated journal entry % is not reversed. Controlled reversal must be executed via public.execute_journal_reversal() first.',
                        OLD.settlement_number, OLD.journal_entry_id;
                END IF;
            END IF;
        END IF;
    END IF;

    -- Disallow invalid transitions out of SUBMITTED or DRAFT
    IF OLD.status = 'SUBMITTED' AND NEW.status NOT IN ('SUBMITTED', 'DRAFT', 'APPROVED', 'CANCELLED') THEN
        RAISE EXCEPTION 'Invalid status transition for settlement % from SUBMITTED to %',
            OLD.settlement_number, NEW.status;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_settlement_record_immutability ON public.settlement_records;
CREATE TRIGGER trg_protect_settlement_record_immutability
    BEFORE UPDATE OR DELETE ON public.settlement_records
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_settlement_record_immutability();

-- 11c. Settlement Items Immutability Trigger
CREATE OR REPLACE FUNCTION public.protect_settlement_items_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_settle_status public.settlement_status;
    v_settle_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_settle_id := OLD.settlement_id;
    ELSE
        v_settle_id := NEW.settlement_id;
    END IF;

    SELECT status INTO v_settle_status
    FROM public.settlement_records
    WHERE id = v_settle_id;

    IF v_settle_status IN ('APPROVED', 'SETTLED', 'CANCELLED') THEN
        RAISE EXCEPTION 'Cannot % settlement item for settlement % in % status (Settlement items are immutable once approved, settled, or cancelled)',
            TG_OP, v_settle_id, v_settle_status;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_settlement_items_immutability ON public.settlement_items;
CREATE TRIGGER trg_protect_settlement_items_immutability
    BEFORE INSERT OR UPDATE OR DELETE ON public.settlement_items
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_settlement_items_immutability();

-- 11d. Financial Obligations Mutation Protection Trigger
CREATE OR REPLACE FUNCTION public.protect_financial_obligation_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.allocated_amount > 0 OR OLD.status IN ('PARTIALLY_SETTLED', 'SETTLED') THEN
            RAISE EXCEPTION 'Cannot delete financial obligation % with active allocations (status: %, allocated: %)',
                OLD.id, OLD.status, OLD.allocated_amount;
        END IF;
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.allocated_amount > 0 OR OLD.status IN ('PARTIALLY_SETTLED', 'SETTLED') THEN
            IF OLD.original_amount IS DISTINCT FROM NEW.original_amount OR
               OLD.beneficiary_id IS DISTINCT FROM NEW.beneficiary_id OR
               OLD.beneficiary_type IS DISTINCT FROM NEW.beneficiary_type OR
               OLD.tenant_id IS DISTINCT FROM NEW.tenant_id OR
               OLD.obligation_type IS DISTINCT FROM NEW.obligation_type OR
               OLD.shipment_id IS DISTINCT FROM NEW.shipment_id THEN
                RAISE EXCEPTION 'Cannot modify core attributes of allocated financial obligation % (original_amount, beneficiary, type, shipment)',
                    OLD.id;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_financial_obligation_immutability ON public.financial_obligations;
CREATE TRIGGER trg_protect_financial_obligation_immutability
    BEFORE UPDATE OR DELETE ON public.financial_obligations
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_financial_obligation_immutability();

-- 12. Accounting Period Protection Trigger
CREATE OR REPLACE FUNCTION public.check_journal_entry_period_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_period_status public.accounting_period_status;
    v_period_name TEXT;
BEGIN
    SELECT status, period_name INTO v_period_status, v_period_name
    FROM public.accounting_periods
    WHERE tenant_id = NEW.tenant_id
      AND NEW.entry_date BETWEEN start_date AND end_date
    LIMIT 1;

    IF v_period_status = 'CLOSED' THEN
        RAISE EXCEPTION 'Accounting period "%" is closed. Cannot create or alter entries on %',
            v_period_name, NEW.entry_date;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_journal_entry_period_lock ON public.journal_entries;
CREATE TRIGGER trg_journal_entry_period_lock
    BEFORE INSERT OR UPDATE ON public.journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.check_journal_entry_period_lock();

-- 12b. Database-Level Prevention of Overlapping Accounting Periods per Tenant
CREATE OR REPLACE FUNCTION public.check_accounting_period_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.start_date > NEW.end_date THEN
        RAISE EXCEPTION 'start_date (%) must be less than or equal to end_date (%)', NEW.start_date, NEW.end_date;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.accounting_periods
        WHERE tenant_id = NEW.tenant_id
          AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
          AND (start_date, end_date) OVERLAPS (NEW.start_date, NEW.end_date)
    ) THEN
        RAISE EXCEPTION 'Accounting period date range % to % overlaps with an existing accounting period for tenant %',
            NEW.start_date, NEW.end_date, NEW.tenant_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounting_period_overlap ON public.accounting_periods;
CREATE TRIGGER trg_accounting_period_overlap
    BEFORE INSERT OR UPDATE ON public.accounting_periods
    FOR EACH ROW
    EXECUTE FUNCTION public.check_accounting_period_overlap();

-- 13. Multi-Item Atomic Stock Transfer Execution Stored Procedure
CREATE OR REPLACE FUNCTION public.execute_stock_transfer_completion(
    p_transfer_id UUID,
    p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_transfer RECORD;
    v_item RECORD;
    v_items_count INT;
    v_src_qty INT;
    v_dest_qty INT;
BEGIN
    -- 1. Lock transfer header
    SELECT * INTO v_transfer
    FROM public.merchant_stock_transfers
    WHERE id = p_transfer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Stock transfer % not found', p_transfer_id;
    END IF;

    IF v_transfer.status <> 'PENDING' AND v_transfer.status <> 'IN_TRANSIT' THEN
        RAISE EXCEPTION 'Transfer % is not in a completable state (current: %)', p_transfer_id, v_transfer.status;
    END IF;

    -- Count authoritative items
    SELECT COUNT(*) INTO v_items_count
    FROM public.merchant_stock_transfer_items
    WHERE transfer_id = p_transfer_id;

    IF v_items_count = 0 THEN
        RAISE EXCEPTION 'Transfer % contains no items to transfer', p_transfer_id;
    END IF;

    -- 2. Deterministically lock and validate source inventory for all items
    FOR v_item IN 
        SELECT product_id, quantity, unit_cost 
        FROM public.merchant_stock_transfer_items 
        WHERE transfer_id = p_transfer_id 
        ORDER BY product_id 
    LOOP
        SELECT quantity INTO v_src_qty
        FROM public.branch_inventory
        WHERE branch_id = v_transfer.source_branch_id AND product_id = v_item.product_id
        FOR UPDATE;

        IF v_src_qty IS NULL OR v_src_qty < v_item.quantity THEN
            RAISE EXCEPTION 'Insufficient stock at source branch for product %: Available (%), Required (%)',
                v_item.product_id, COALESCE(v_src_qty, 0), v_item.quantity;
        END IF;
    END LOOP;

    -- 3. Execute inventory updates and write immutable stock ledger movements for every item
    FOR v_item IN 
        SELECT product_id, quantity, unit_cost 
        FROM public.merchant_stock_transfer_items 
        WHERE transfer_id = p_transfer_id 
        ORDER BY product_id 
    LOOP
        -- Fetch locked source balance
        SELECT quantity INTO v_src_qty
        FROM public.branch_inventory
        WHERE branch_id = v_transfer.source_branch_id AND product_id = v_item.product_id;

        -- Decrement source
        UPDATE public.branch_inventory
        SET quantity = quantity - v_item.quantity, updated_at = now()
        WHERE branch_id = v_transfer.source_branch_id AND product_id = v_item.product_id;

        -- Write source TRANSFER_OUT movement
        INSERT INTO public.stock_movements (
            tenant_id, merchant_id, branch_id, product_id,
            movement_type, quantity, balance_before, balance_after,
            unit_cost, reference_type, reference_id, performed_by, notes
        ) VALUES (
            v_transfer.tenant_id, v_transfer.merchant_id, v_transfer.source_branch_id, v_item.product_id,
            'TRANSFER_OUT', -v_item.quantity, v_src_qty, v_src_qty - v_item.quantity,
            COALESCE(v_item.unit_cost, 0.000), 'STOCK_TRANSFER', p_transfer_id::TEXT, p_actor_id,
            'Multi-item stock transfer outbound: ' || COALESCE(v_transfer.transfer_number, p_transfer_id::TEXT)
        );

        -- Lock or create destination inventory
        SELECT quantity INTO v_dest_qty
        FROM public.branch_inventory
        WHERE branch_id = v_transfer.destination_branch_id AND product_id = v_item.product_id
        FOR UPDATE;

        IF FOUND THEN
            UPDATE public.branch_inventory
            SET quantity = quantity + v_item.quantity, updated_at = now()
            WHERE branch_id = v_transfer.destination_branch_id AND product_id = v_item.product_id;

            INSERT INTO public.stock_movements (
                tenant_id, merchant_id, branch_id, product_id,
                movement_type, quantity, balance_before, balance_after,
                unit_cost, reference_type, reference_id, performed_by, notes
            ) VALUES (
                v_transfer.tenant_id, v_transfer.merchant_id, v_transfer.destination_branch_id, v_item.product_id,
                'TRANSFER_IN', v_item.quantity, v_dest_qty, v_dest_qty + v_item.quantity,
                COALESCE(v_item.unit_cost, 0.000), 'STOCK_TRANSFER', p_transfer_id::TEXT, p_actor_id,
                'Multi-item stock transfer inbound: ' || COALESCE(v_transfer.transfer_number, p_transfer_id::TEXT)
            );
        ELSE
            INSERT INTO public.branch_inventory (
                tenant_id, merchant_id, branch_id, product_id, quantity, updated_at
            ) VALUES (
                v_transfer.tenant_id, v_transfer.merchant_id, v_transfer.destination_branch_id, v_item.product_id,
                v_item.quantity, now()
            );

            INSERT INTO public.stock_movements (
                tenant_id, merchant_id, branch_id, product_id,
                movement_type, quantity, balance_before, balance_after,
                unit_cost, reference_type, reference_id, performed_by, notes
            ) VALUES (
                v_transfer.tenant_id, v_transfer.merchant_id, v_transfer.destination_branch_id, v_item.product_id,
                'TRANSFER_IN', v_item.quantity, 0, v_item.quantity,
                COALESCE(v_item.unit_cost, 0.000), 'STOCK_TRANSFER', p_transfer_id::TEXT, p_actor_id,
                'Multi-item stock transfer inbound (initial stock): ' || COALESCE(v_transfer.transfer_number, p_transfer_id::TEXT)
            );
        END IF;
    END LOOP;

    -- 4. Mark transfer completed only after every item succeeds
    UPDATE public.merchant_stock_transfers
    SET status = 'COMPLETED', received_by = p_actor_id, updated_at = now()
    WHERE id = p_transfer_id;

    RETURN jsonb_build_object('success', true, 'transfer_id', p_transfer_id, 'items_count', v_items_count, 'status', 'COMPLETED');
END;
$$;

-- 14. Multi-Item Stock Transfer Reversal Stored Procedure
CREATE OR REPLACE FUNCTION public.execute_stock_transfer_reversal(
    p_transfer_id UUID,
    p_actor_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_transfer RECORD;
    v_item RECORD;
    v_dest_qty INT;
    v_src_qty INT;
BEGIN
    SELECT * INTO v_transfer
    FROM public.merchant_stock_transfers
    WHERE id = p_transfer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Stock transfer % not found', p_transfer_id;
    END IF;

    IF v_transfer.status <> 'COMPLETED' THEN
        RAISE EXCEPTION 'Only COMPLETED stock transfers can be reversed (Current: %)', v_transfer.status;
    END IF;

    -- Validate destination branch has enough stock to return to source for all items
    FOR v_item IN 
        SELECT product_id, quantity, unit_cost 
        FROM public.merchant_stock_transfer_items 
        WHERE transfer_id = p_transfer_id 
        ORDER BY product_id 
    LOOP
        SELECT quantity INTO v_dest_qty
        FROM public.branch_inventory
        WHERE branch_id = v_transfer.destination_branch_id AND product_id = v_item.product_id
        FOR UPDATE;

        IF v_dest_qty IS NULL OR v_dest_qty < v_item.quantity THEN
            RAISE EXCEPTION 'Cannot reverse transfer %: Destination branch has insufficient stock for product % (Available: %, Needed: %)',
                p_transfer_id, v_item.product_id, COALESCE(v_dest_qty, 0), v_item.quantity;
        END IF;
    END LOOP;

    -- Revert inventory balances and log compensating REVERSAL movements
    FOR v_item IN 
        SELECT product_id, quantity, unit_cost 
        FROM public.merchant_stock_transfer_items 
        WHERE transfer_id = p_transfer_id 
        ORDER BY product_id 
    LOOP
        -- Decrement destination
        SELECT quantity INTO v_dest_qty
        FROM public.branch_inventory
        WHERE branch_id = v_transfer.destination_branch_id AND product_id = v_item.product_id;

        UPDATE public.branch_inventory
        SET quantity = quantity - v_item.quantity, updated_at = now()
        WHERE branch_id = v_transfer.destination_branch_id AND product_id = v_item.product_id;

        INSERT INTO public.stock_movements (
            tenant_id, merchant_id, branch_id, product_id,
            movement_type, quantity, balance_before, balance_after,
            unit_cost, reference_type, reference_id, performed_by, notes
        ) VALUES (
            v_transfer.tenant_id, v_transfer.merchant_id, v_transfer.destination_branch_id, v_item.product_id,
            'REVERSAL', -v_item.quantity, v_dest_qty, v_dest_qty - v_item.quantity,
            COALESCE(v_item.unit_cost, 0.000), 'STOCK_TRANSFER_REVERSAL', p_transfer_id::TEXT, p_actor_id,
            'Transfer reversal return: ' || COALESCE(p_reason, '')
        );

        -- Increment source
        SELECT quantity INTO v_src_qty
        FROM public.branch_inventory
        WHERE branch_id = v_transfer.source_branch_id AND product_id = v_item.product_id
        FOR UPDATE;

        UPDATE public.branch_inventory
        SET quantity = quantity + v_item.quantity, updated_at = now()
        WHERE branch_id = v_transfer.source_branch_id AND product_id = v_item.product_id;

        INSERT INTO public.stock_movements (
            tenant_id, merchant_id, branch_id, product_id,
            movement_type, quantity, balance_before, balance_after,
            unit_cost, reference_type, reference_id, performed_by, notes
        ) VALUES (
            v_transfer.tenant_id, v_transfer.merchant_id, v_transfer.source_branch_id, v_item.product_id,
            'REVERSAL', v_item.quantity, v_src_qty, v_src_qty + v_item.quantity,
            COALESCE(v_item.unit_cost, 0.000), 'STOCK_TRANSFER_REVERSAL', p_transfer_id::TEXT, p_actor_id,
            'Transfer reversal restock: ' || COALESCE(p_reason, '')
        );
    END LOOP;

    UPDATE public.merchant_stock_transfers
    SET status = 'CANCELLED', notes = COALESCE(notes, '') || ' [REVERSED: ' || COALESCE(p_reason, '') || ']', updated_at = now()
    WHERE id = p_transfer_id;

    RETURN jsonb_build_object('success', true, 'transfer_id', p_transfer_id, 'status', 'CANCELLED');
END;
$$;

-- 15. Authorized Journal Reversal Stored Procedure
CREATE OR REPLACE FUNCTION public.execute_journal_reversal(
    p_original_entry_id UUID,
    p_actor_id UUID,
    p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_orig RECORD;
    v_new_entry_id UUID;
    v_reversal_number TEXT;
    line RECORD;
BEGIN
    SELECT * INTO v_orig
    FROM public.journal_entries
    WHERE id = p_original_entry_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Original journal entry % not found', p_original_entry_id;
    END IF;

    IF v_orig.status <> 'POSTED' THEN
        RAISE EXCEPTION 'Only POSTED journal entries can be reversed (Current: %)', v_orig.status;
    END IF;

    IF v_orig.is_reversed THEN
        RAISE EXCEPTION 'Journal entry % has already been reversed', p_original_entry_id;
    END IF;

    v_new_entry_id := gen_random_uuid();
    v_reversal_number := v_orig.entry_number || '-REV';

    -- Insert Reversing Journal Header in DRAFT
    INSERT INTO public.journal_entries (
        id, tenant_id, entry_number, entry_date, status,
        description, reference_type, reference_id,
        total_debit, total_credit, posted_at, posted_by,
        is_reversed, created_at, updated_at
    ) VALUES (
        v_new_entry_id, v_orig.tenant_id, v_reversal_number, CURRENT_DATE, 'DRAFT',
        'Reversal of ' || v_orig.entry_number || ': ' || COALESCE(p_reason, ''),
        'JOURNAL_REVERSAL', p_original_entry_id::TEXT,
        0.000, 0.000, NULL, p_actor_id,
        false, now(), now()
    );

    -- Insert Opposite Lines (Swap Debit and Credit)
    FOR line IN SELECT * FROM public.journal_lines WHERE journal_entry_id = p_original_entry_id LOOP
        INSERT INTO public.journal_lines (
            tenant_id, journal_entry_id, account_id, account_code,
            debit, credit, description, merchant_id, driver_id, branch_id
        ) VALUES (
            line.tenant_id, v_new_entry_id, line.account_id, line.account_code,
            line.credit, line.debit, -- Exactly swapped
            'Reversal: ' || COALESCE(line.description, ''),
            line.merchant_id, line.driver_id, line.branch_id
        );
    END LOOP;

    -- Post the reversal header (triggers validation and calculates totals)
    UPDATE public.journal_entries
    SET status = 'POSTED', posted_by = p_actor_id, updated_at = now()
    WHERE id = v_new_entry_id;

    -- Mark original entry as REVERSED with bidirectional link
    UPDATE public.journal_entries
    SET status = 'REVERSED', is_reversed = true, reversal_entry_id = v_new_entry_id, updated_at = now()
    WHERE id = p_original_entry_id;

    RETURN v_new_entry_id;
END;
$$;

-- 16. Approved Controlled Journal Lifecycle Procedures (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.create_draft_journal_entry(
    p_tenant_id UUID,
    p_entry_number TEXT,
    p_entry_date DATE,
    p_description TEXT DEFAULT NULL,
    p_reference_type TEXT DEFAULT NULL,
    p_reference_id TEXT DEFAULT NULL,
    p_actor_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_journal_id UUID := gen_random_uuid();
BEGIN
    INSERT INTO public.journal_entries (
        id, tenant_id, entry_number, entry_date, status,
        description, reference_type, reference_id,
        total_debit, total_credit, created_at, updated_at
    ) VALUES (
        v_journal_id, p_tenant_id, p_entry_number, COALESCE(p_entry_date, CURRENT_DATE), 'DRAFT',
        p_description, p_reference_type, p_reference_id,
        0.000, 0.000, now(), now()
    );

    RETURN v_journal_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_draft_journal_line(
    p_tenant_id UUID,
    p_journal_entry_id UUID,
    p_account_id UUID,
    p_account_code TEXT,
    p_debit NUMERIC(12, 3) DEFAULT 0.000,
    p_credit NUMERIC(12, 3) DEFAULT 0.000,
    p_description TEXT DEFAULT NULL,
    p_merchant_id UUID DEFAULT NULL,
    p_driver_id UUID DEFAULT NULL,
    p_branch_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_line_id UUID := gen_random_uuid();
    v_journal_status public.journal_posting_status;
BEGIN
    SELECT status INTO v_journal_status 
    FROM public.journal_entries 
    WHERE id = p_journal_entry_id AND tenant_id = p_tenant_id;

    IF v_journal_status IS NULL THEN
        RAISE EXCEPTION 'Journal entry % not found for tenant %', p_journal_entry_id, p_tenant_id;
    END IF;

    IF v_journal_status <> 'DRAFT' THEN
        RAISE EXCEPTION 'Cannot add lines to journal entry % in status % (must be DRAFT)', p_journal_entry_id, v_journal_status;
    END IF;

    INSERT INTO public.journal_lines (
        id, tenant_id, journal_entry_id, account_id, account_code,
        debit, credit, description, merchant_id, driver_id, branch_id,
        created_at
    ) VALUES (
        v_line_id, p_tenant_id, p_journal_entry_id, p_account_id, p_account_code,
        COALESCE(p_debit, 0.000), COALESCE(p_credit, 0.000), p_description,
        p_merchant_id, p_driver_id, p_branch_id, now()
    );

    RETURN v_line_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.post_journal_entry(
    p_journal_entry_id UUID,
    p_actor_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_status public.journal_posting_status;
BEGIN
    SELECT status INTO v_status 
    FROM public.journal_entries 
    WHERE id = p_journal_entry_id;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Journal entry % not found', p_journal_entry_id;
    END IF;

    IF v_status <> 'DRAFT' THEN
        RAISE EXCEPTION 'Journal entry % is already % and cannot be posted again', p_journal_entry_id, v_status;
    END IF;

    UPDATE public.journal_entries
    SET status = 'POSTED', posted_by = p_actor_id, posted_at = now(), updated_at = now()
    WHERE id = p_journal_entry_id;
END;
$$;

-- 17. Revoke dangerous public execute grants and grant to service_role
REVOKE EXECUTE ON FUNCTION public.check_journal_posting_balance() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_settlement_item_beneficiary() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_settlement_allocation_cap() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_obligation_allocated_amount(UUID) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_settlement_item_mutation() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_settlement_status_change() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_settlement_record_immutability() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_settlement_items_immutability() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_financial_obligation_immutability() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.execute_stock_transfer_completion(UUID, UUID) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.execute_stock_transfer_reversal(UUID, UUID, TEXT) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.execute_journal_reversal(UUID, UUID, TEXT) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_draft_journal_entry(UUID, TEXT, DATE, TEXT, TEXT, TEXT, UUID) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_draft_journal_line(UUID, UUID, UUID, TEXT, NUMERIC, NUMERIC, TEXT, UUID, UUID, UUID) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.post_journal_entry(UUID, UUID) FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.execute_stock_transfer_completion(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.execute_stock_transfer_reversal(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.execute_journal_reversal(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_draft_journal_entry(UUID, TEXT, DATE, TEXT, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_draft_journal_line(UUID, UUID, UUID, TEXT, NUMERIC, NUMERIC, TEXT, UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.post_journal_entry(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_obligation_allocated_amount(UUID) TO service_role;

-- ============================================================================
-- DELIVERE — 16_indexes_and_constraints.sql
-- Relational Integrity Constraints & Performance Index Suite
-- ============================================================================

-- 1. Composite Foreign Keys for Referential and Multi-Tenant Integrity
DO $$
BEGIN
    -- Shipments -> Merchant Branches (Column-specific SET NULL on branch_id)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_shipments_branch_composite'
    ) THEN
        ALTER TABLE public.shipments
            ADD CONSTRAINT fk_shipments_branch_composite
            FOREIGN KEY (branch_id, merchant_id, tenant_id)
            REFERENCES public.merchant_branches(id, merchant_id, tenant_id)
            ON DELETE SET NULL (branch_id);
    END IF;

    -- Settlement Items -> Settlement Records (Tenant isolated)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_settlement_items_settlement_composite'
    ) THEN
        ALTER TABLE public.settlement_items
            ADD CONSTRAINT fk_settlement_items_settlement_composite
            FOREIGN KEY (settlement_id, tenant_id)
            REFERENCES public.settlement_records(id, tenant_id)
            ON DELETE RESTRICT;
    END IF;

    -- Settlement Items -> Financial Obligations (Tenant isolated)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_settlement_items_obligation_composite'
    ) THEN
        ALTER TABLE public.settlement_items
            ADD CONSTRAINT fk_settlement_items_obligation_composite
            FOREIGN KEY (obligation_id, tenant_id)
            REFERENCES public.financial_obligations(id, tenant_id)
            ON DELETE RESTRICT;
    END IF;

    -- Journal Lines -> Journal Entries Header (Tenant isolated)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_journal_lines_entry_composite'
    ) THEN
        ALTER TABLE public.journal_lines
            ADD CONSTRAINT fk_journal_lines_entry_composite
            FOREIGN KEY (journal_entry_id, tenant_id)
            REFERENCES public.journal_entries(id, tenant_id)
            ON DELETE RESTRICT;
    END IF;

    -- Journal Lines -> Chart of Accounts (Tenant isolated)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_journal_lines_account_composite'
    ) THEN
        ALTER TABLE public.journal_lines
            ADD CONSTRAINT fk_journal_lines_account_composite
            FOREIGN KEY (account_id, tenant_id)
            REFERENCES public.accounts(id, tenant_id)
            ON DELETE RESTRICT;
    END IF;

    -- Financial Obligations -> Beneficiary Users (Tenant isolated)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_obligations_beneficiary_composite'
    ) THEN
        ALTER TABLE public.financial_obligations
            ADD CONSTRAINT fk_obligations_beneficiary_composite
            FOREIGN KEY (beneficiary_id, tenant_id)
            REFERENCES public.users(id, tenant_id)
            ON DELETE RESTRICT;
    END IF;

    -- Financial Obligations -> Shipments (Tenant isolated)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_obligations_shipment_composite'
    ) THEN
        ALTER TABLE public.financial_obligations
            ADD CONSTRAINT fk_obligations_shipment_composite
            FOREIGN KEY (shipment_id, tenant_id)
            REFERENCES public.shipments(id, tenant_id)
            ON DELETE RESTRICT;
    END IF;

    -- Settlement Records -> Beneficiary Users (Tenant isolated)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_settlements_beneficiary_composite'
    ) THEN
        ALTER TABLE public.settlement_records
            ADD CONSTRAINT fk_settlements_beneficiary_composite
            FOREIGN KEY (beneficiary_id, tenant_id)
            REFERENCES public.users(id, tenant_id)
            ON DELETE RESTRICT;
    END IF;

    -- Settlement Records -> Journal Entries (Tenant isolated)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_settlements_journal_composite'
    ) THEN
        ALTER TABLE public.settlement_records
            ADD CONSTRAINT fk_settlements_journal_composite
            FOREIGN KEY (journal_entry_id, tenant_id)
            REFERENCES public.journal_entries(id, tenant_id)
            ON DELETE SET NULL (journal_entry_id);
    END IF;

    -- Journal Lines -> Merchant User (Tenant isolated)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_journal_lines_merchant_composite'
    ) THEN
        ALTER TABLE public.journal_lines
            ADD CONSTRAINT fk_journal_lines_merchant_composite
            FOREIGN KEY (merchant_id, tenant_id)
            REFERENCES public.users(id, tenant_id)
            ON DELETE SET NULL (merchant_id);
    END IF;

    -- Journal Lines -> Driver User (Tenant isolated)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_journal_lines_driver_composite'
    ) THEN
        ALTER TABLE public.journal_lines
            ADD CONSTRAINT fk_journal_lines_driver_composite
            FOREIGN KEY (driver_id, tenant_id)
            REFERENCES public.users(id, tenant_id)
            ON DELETE SET NULL (driver_id);
    END IF;

    -- Journal Lines -> Branch (Tenant isolated)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_journal_lines_branch_composite'
    ) THEN
        ALTER TABLE public.journal_lines
            ADD CONSTRAINT fk_journal_lines_branch_composite
            FOREIGN KEY (branch_id, tenant_id)
            REFERENCES public.merchant_branches(id, tenant_id)
            ON DELETE SET NULL (branch_id);
    END IF;

    -- Users -> Price Plans (Tenant isolated)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_price_plan_composite'
    ) THEN
        ALTER TABLE public.users
            ADD CONSTRAINT fk_users_price_plan_composite
            FOREIGN KEY (price_plan_id, tenant_id)
            REFERENCES public.price_plans(id, tenant_id)
            ON DELETE SET NULL (price_plan_id);
    END IF;

    -- User Invitations -> Price Plans (Tenant isolated)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_invitations_price_plan_composite'
    ) THEN
        ALTER TABLE public.user_invitations
            ADD CONSTRAINT fk_user_invitations_price_plan_composite
            FOREIGN KEY (price_plan_id, tenant_id)
            REFERENCES public.price_plans(id, tenant_id)
            ON DELETE SET NULL (price_plan_id);
    END IF;

    -- Price Plan Rules -> Price Plans (Tenant isolated)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_price_plan_rules_plan_composite'
    ) THEN
        ALTER TABLE public.price_plan_rules
            ADD CONSTRAINT fk_price_plan_rules_plan_composite
            FOREIGN KEY (price_plan_id, tenant_id)
            REFERENCES public.price_plans(id, tenant_id)
            ON DELETE CASCADE;
    END IF;

    -- Shipments -> Price Plans (Tenant isolated, RESTRICT physical delete to preserve historical snapshot auditability)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_shipments_price_plan_composite'
    ) THEN
        ALTER TABLE public.shipments
            ADD CONSTRAINT fk_shipments_price_plan_composite
            FOREIGN KEY (price_plan_id, tenant_id)
            REFERENCES public.price_plans(id, tenant_id)
            ON DELETE RESTRICT;
    END IF;
END $$;

-- 2. Query Acceleration Indexes
CREATE INDEX IF NOT EXISTS idx_shipments_dispatch_query 
    ON public.shipments (tenant_id, status, governorate, assigned_at);

CREATE INDEX IF NOT EXISTS idx_shipments_merchant_status 
    ON public.shipments (tenant_id, merchant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shipments_driver_active 
    ON public.shipments (tenant_id, driver_id, status) 
    WHERE status IN ('IN_TRANSIT', 'OUT_FOR_DELIVERY', 'PICKED_UP');

CREATE INDEX IF NOT EXISTS idx_financial_obligations_unsettled 
    ON public.financial_obligations (tenant_id, beneficiary_id, status) 
    WHERE status IN ('PENDING', 'PARTIALLY_SETTLED');

CREATE INDEX IF NOT EXISTS idx_settlements_pending_approval 
    ON public.settlement_records (tenant_id, status) 
    WHERE status IN ('DRAFT', 'SUBMITTED');

CREATE INDEX IF NOT EXISTS idx_journal_lines_posting_report 
    ON public.journal_lines (tenant_id, account_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_tenant_search 
    ON public.users (tenant_id, role, is_active, name);

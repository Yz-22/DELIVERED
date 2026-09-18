-- ============================================================================
-- DELIVERE — 10_accounting_core.sql
-- Enterprise Chart of Accounts & Immutable Double-Entry Ledger
-- ============================================================================

-- 1. Chart of Accounts Table
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    type public.account_type NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_accounts_tenant_code UNIQUE (tenant_id, code),
    CONSTRAINT uq_accounts_composite UNIQUE (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_accounts_lookup ON public.accounts (tenant_id, type, is_active);

-- 2. Double-Entry Journal Entries Header Table
CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    entry_number TEXT NOT NULL,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status public.journal_posting_status NOT NULL DEFAULT 'DRAFT',
    description TEXT,
    reference_type TEXT,
    reference_id TEXT,
    idempotency_key TEXT,
    total_debit NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (total_debit >= 0),
    total_credit NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (total_credit >= 0),
    posted_at TIMESTAMPTZ DEFAULT NULL,
    posted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    is_reversed BOOLEAN NOT NULL DEFAULT false,
    reversal_entry_id UUID REFERENCES public.journal_entries(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_journal_balanced CHECK (total_debit = total_credit),
    CONSTRAINT uq_journal_entries_number UNIQUE (tenant_id, entry_number),
    CONSTRAINT uq_journal_entries_idempotency UNIQUE (tenant_id, idempotency_key),
    CONSTRAINT uq_journal_entries_composite UNIQUE (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_lookup 
    ON public.journal_entries (tenant_id, entry_date DESC, status);
CREATE INDEX IF NOT EXISTS idx_journal_entries_reference 
    ON public.journal_entries (reference_type, reference_id);

-- 3. Double-Entry Journal Lines Table
CREATE TABLE IF NOT EXISTS public.journal_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE RESTRICT,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
    account_code TEXT NOT NULL,
    debit NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (debit >= 0),
    credit NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (credit >= 0),
    description TEXT,
    merchant_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    driver_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    branch_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Exactly one side must be positive; no zero/zero or two-sided lines
    CONSTRAINT chk_journal_line_single_side CHECK (
        (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)
    ),

    -- Composite FK to journal entries (tenant isolated)
    CONSTRAINT fk_journal_lines_entry_composite FOREIGN KEY (journal_entry_id, tenant_id)
        REFERENCES public.journal_entries(id, tenant_id) ON DELETE RESTRICT,

    -- Composite FK to chart of accounts (tenant isolated)
    CONSTRAINT fk_journal_lines_account_composite FOREIGN KEY (account_id, tenant_id)
        REFERENCES public.accounts(id, tenant_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON public.journal_lines (journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON public.journal_lines (tenant_id, account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_journal_lines_merchant ON public.journal_lines (merchant_id) WHERE merchant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_journal_lines_driver ON public.journal_lines (driver_id) WHERE driver_id IS NOT NULL;

-- 4. Accounting Vouchers (Receipts & Payments linked to Ledger)
CREATE TABLE IF NOT EXISTS public.vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    voucher_number TEXT NOT NULL,
    type public.voucher_type NOT NULL,
    amount NUMERIC(12, 3) NOT NULL CHECK (amount > 0),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE RESTRICT,
    beneficiary_type TEXT,
    beneficiary_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    beneficiary_name TEXT,
    description TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_vouchers_number UNIQUE (tenant_id, voucher_number)
);

CREATE INDEX IF NOT EXISTS idx_vouchers_lookup ON public.vouchers (tenant_id, type, date DESC);

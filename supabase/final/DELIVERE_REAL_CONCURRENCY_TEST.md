# DELIVERE — REAL DATABASE CONCURRENCY TEST SPECIFICATION
**Version:** 2.0.0 Enterprise Hardened  
**Target Invariant:** Zero Double-Allocation Race Conditions under High Concurrency (`SELECT ... FOR UPDATE`)

---

## 1. Concurrency Rationale

A true database concurrency test **cannot** be executed within a single sequential SQL script or a single query tab, because sequential transactions execute one after the other.

To verify row-level lock serialization on `financial_obligations` under simultaneous settlement allocations, this test requires **two independent, active PostgreSQL sessions** (e.g., two Supabase SQL Editor tabs, or two `psql` / application client connections).

---

## 2. Test Setup (Run in Session A First)

```sql
-- Step 0: Deterministic Fixture Setup (Self-Contained)
DO $$
DECLARE
    v_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
    v_merchant_id UUID := '99999999-9999-9999-9999-999999999999';
    v_obligation_id UUID := '11111111-1111-1111-1111-111111111111';
    v_settle_a UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    v_settle_b UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
BEGIN
    -- Ensure tenant exists
    INSERT INTO public.tenants (id, name, domain)
    VALUES (v_tenant_id, 'Delivere Concurrency Tenant', 'concur.delivere.local')
    ON CONFLICT (id) DO NOTHING;

    -- Ensure test merchant exists deterministically
    INSERT INTO public.users (id, tenant_id, email, name, role, is_active)
    VALUES (v_merchant_id, v_tenant_id, 'concur-merchant@delivere.local', 'Concurrency Merchant', 'MERCHANT', true)
    ON CONFLICT (id) DO UPDATE SET is_active = true;

    -- Setup obligation with 35.000 JOD balance
    INSERT INTO public.financial_obligations (
        id, tenant_id, beneficiary_type, beneficiary_id, obligation_type,
        original_amount, allocated_amount, status
    ) VALUES (
        v_obligation_id, v_tenant_id, 'MERCHANT', v_merchant_id, 'MERCHANT_COD_PAYABLE',
        35.000, 0.000, 'PENDING'
    ) ON CONFLICT (id) DO UPDATE SET original_amount = 35.000, allocated_amount = 0.000, status = 'PENDING';

    -- Setup Settlement Header A
    INSERT INTO public.settlement_records (
        id, tenant_id, settlement_number, type, beneficiary_id, status, total_amount
    ) VALUES (
        v_settle_a, v_tenant_id, 'SETTLE-CONCUR-A', 'MERCHANT', v_merchant_id, 'DRAFT', 35.000
    ) ON CONFLICT (id) DO NOTHING;

    -- Setup Settlement Header B
    INSERT INTO public.settlement_records (
        id, tenant_id, settlement_number, type, beneficiary_id, status, total_amount
    ) VALUES (
        v_settle_b, v_tenant_id, 'SETTLE-CONCUR-B', 'MERCHANT', v_merchant_id, 'DRAFT', 35.000
    ) ON CONFLICT (id) DO NOTHING;
END $$;
```

---

## 3. Concurrent Execution Steps

### Session A (Window 1)
```sql
BEGIN;
-- Session A attempts to allocate 35.000 JOD (the entire balance)
INSERT INTO public.settlement_items (tenant_id, settlement_id, obligation_id, allocated_amount)
VALUES ('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 35.000);

-- DO NOT COMMIT YET. Hold transaction open to simulate processing delay.
SELECT pg_sleep(5);
COMMIT;
```

### Session B (Window 2 — Execute IMMEDIATELY after launching Session A)
```sql
BEGIN;
-- Session B attempts to allocate 35.000 JOD simultaneously to the same obligation
INSERT INTO public.settlement_items (tenant_id, settlement_id, obligation_id, allocated_amount)
VALUES ('00000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 35.000);
COMMIT;
```

---

## 4. Expected Invariant Outcome

1. **Session A**:
   - Acquires the `FOR UPDATE` row lock on obligation `'11111111-1111-1111-1111-111111111111'`.
   - Successfully allocates `35.000 JOD`.
   - Commits after sleep.
   - Status becomes `SETTLED`.

2. **Session B**:
   - Blocks on the row lock until Session A finishes.
   - Upon lock release, `trg_enforce_settlement_allocation_cap` re-reads the fresh `allocated_amount = 35.000`.
   - Evaluates: `35.000 (new) + 35.000 (already allocated) > 35.000 (original)`.
   - **Immediately raises exception**:
     `Over-allocation error: Total allocated (70.000) exceeds original obligation amount (35.000)`.
   - **Transaction rolls back cleanly**.

---

## 5. Concurrency Test 2: Accounting Period Exclusion Constraint (`excl_accounting_periods_range`)

### Session A:
```sql
BEGIN;
INSERT INTO public.accounting_periods (tenant_id, period_name, start_date, end_date, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'Fiscal Q1 2026', '2026-01-01', '2026-03-31', 'OPEN');
SELECT pg_sleep(5); -- hold transaction open
COMMIT;
```

### Session B (Run immediately after Session A begins):
```sql
BEGIN;
-- Session B attempts to insert an overlapping period concurrently
INSERT INTO public.accounting_periods (tenant_id, period_name, start_date, end_date, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'Overlapping Q1/Q2', '2026-03-01', '2026-04-30', 'OPEN');
COMMIT;
```

### Expected Outcome:
Under `READ COMMITTED`, Session B waits on index predicate locking. Once Session A commits, Session B immediately fails with:
`ERROR: conflicting key value violates exclusion constraint "excl_accounting_periods_range"`
Preventing race conditions where two simultaneous transactions could otherwise insert overlapping periods.

---

## 6. Cleanup Script

```sql
DELETE FROM public.accounting_periods WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.settlement_items WHERE settlement_id IN ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
DELETE FROM public.settlement_records WHERE id IN ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
DELETE FROM public.financial_obligations WHERE id = '11111111-1111-1111-1111-111111111111';
DELETE FROM public.users WHERE id = '99999999-9999-9999-9999-999999999999';
```

# DELIVERE ENTERPRISE — CANONICAL SQL REBUILD PACKAGE

**Target Environment:** `DEVELOPMENT_STAGING`  
**Target Supabase Project Ref:** `rekflpovydwnqehnqwev`  
**Version:** `2.0.0 (Enterprise Hardened & Audited)`  
**Architecture:** Multi-Tenant Logistics, TMS, WMS, POS, Double-Entry Financial Accounting Core  

---

## 📦 Master Files for Supabase SQL Editor

For convenient one-click copy/paste execution in the Supabase SQL Editor:

1. **`DELIVERE_FULL_DATABASE_INSTALL.sql`**
   - Single, complete, monolithic installation file.
   - Combines modules `00_` through `18_` in strict dependency order wrapped in a `BEGIN; ... COMMIT;` transaction block.
   - Protects `auth.*`, `storage.*`, and extensions while cleanly resetting and installing the 28 core public tables, constraints, composite foreign keys, RLS policies, triggers, and baseline development seed fixtures.

2. **`DELIVERE_POST_INSTALL_VERIFY.sql`**
   - Automated schema integrity verification runner.
   - Verifies the existence of all 28 core tables, `NUMERIC(12, 3)` column precisions, trigger attachments, and active RLS protection.

3. **`DELIVERE_DATABASE_TESTS.sql`**
   - Comprehensive suite of 40 real database integration tests covering all critical financial, inventory, relational, composite FK, and reversal invariants.
   - Wrapped inside `BEGIN; ... ROLLBACK;` for clean, isolated, zero-residue test runs.

4. **`DELIVERE_REAL_CONCURRENCY_TEST.md`**
   - Dedicated two-connection concurrency test specification and step-by-step SQL procedure for validating `SELECT ... FOR UPDATE` serialization.

---

## 📁 Modular Source Files

- `00_reset_development_application_schema.sql` — Clean public schema reset script (preserves `auth.*` / `storage.*`)
- `01_extensions_and_core_types.sql` — Extensions and PostgreSQL enum definitions (canonical `DRIVER_EARNING`)
- `02_tenants_and_users.sql` — Multi-tenant foundation and user identity table
- `03_auth_invitations_sessions_audit.sql` — Invitations, revoked sessions, and immutable audit logs
- `04_roles_permissions_and_branch_access.sql` — Relational branch access permissions
- `05_merchants_branches_customers.sql` — Merchant branches and customer directory
- `06_products_warehouses_inventory.sql` — Product catalog and branch-scoped inventory
- `07_stock_movements_and_transfers.sql` — Multi-item authoritative stock transfers & immutable movement ledger
- `08_pricing_and_delivery_shipments.sql` — Price plans, shipments (TMS), and backward-compatible `orders` view
- `09_delivery_history_and_driver_operations.sql` — Shipment status history and driver wallets (`150.000` limit)
- `10_accounting_core.sql` — Chart of accounts, journal entries (`DRAFT` default), journal lines, vouchers
- `11_financial_obligations.sql` — Financial obligations ledger and allocation tracking (`DRIVER_EARNING`)
- `12_settlements.sql` — Settlement records and itemized allocations
- `13_accounting_periods_reversals_idempotency.sql` — Period locking and journal reversal tracking
- `14_subscriptions.sql` — Subscription plans and tenant entitlements
- `15_rls_grants_and_security.sql` — Multi-tenant RLS policies and service_role grants
- `16_indexes_and_constraints.sql` — Composite indexes and foreign key constraints
- `17_functions_and_triggers.sql` — Hardened triggers, financial validation, multi-item stock transfers, and journal reversals
- `18_seed_development_minimum.sql` — Baseline tenant, subscription, COA, and strict Delivere pricing plans (Amman 3.000 JOD, Zarqa/Balqa/Madaba 5.000 JOD)
- `19_post_build_verification.sql` — Schema structure verification script
- `20_enterprise_integration_tests.sql` — 40 enterprise integration tests

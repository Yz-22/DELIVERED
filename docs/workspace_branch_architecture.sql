-- ==============================================================================
-- Delivere Logistics & Enterprise TMS/POS
-- Documentation: docs/workspace_branch_architecture.sql
-- Name: Role Workspaces + Merchant Multi-Branch + Statements & Reports Architecture
-- ==============================================================================

-- [1] Run in Supabase SQL Editor:
-- File: supabase/migrations/20260917_workspace_branch_architecture.sql

-- [2] Architecture Overview:
-- - Introduces `public.merchant_branches` for real multi-branch management.
-- - Introduces `public.merchant_stock_transfers` for auditable inventory movement.
-- - Enhances `public.users`, `public.user_invitations`, and `public.shipments` with `branch_id`.
-- - Backfills a 'الفرع الرئيسي' for existing merchants so no existing operations or orders break.
-- - Enforces zero downtime and strictly non-destructive schema changes.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  OrderPersistenceService,
  OrderPersistenceError,
  computeCanonicalPayloadHash,
  mapShipmentRowToOrder,
  type CanonicalOrderPayload,
} from '../src/services/orderPersistenceService.ts';

const hotfixMigrationPath = path.join(
  process.cwd(),
  'supabase/final/hotfixes/20260922_order_persistence_and_idempotency_hardening.sql'
);
const servicePath = path.join(process.cwd(), 'src/services/orderPersistenceService.ts');
const serverPath = path.join(process.cwd(), 'server.ts');

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8');
}

// ============================================================================
// SECTION 1: MIGRATION ARTIFACT INTEGRITY & INVARIANTS
// ============================================================================

test('01. Order persistence hotfix file exists at canonical path', () => {
  assert.ok(fs.existsSync(hotfixMigrationPath), 'Hotfix migration file must exist');
});

test('02. Order persistence hotfix is wrapped in transaction (BEGIN ... COMMIT)', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(sql.includes('BEGIN;'), 'Migration must be wrapped in BEGIN');
  assert.ok(sql.includes('COMMIT;'), 'Migration must be wrapped in COMMIT');
});

test('03. Order persistence hotfix is non-destructive (ZERO drops/truncates on core data)', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(!sql.includes('DROP TABLE public.shipments'), 'No DROP TABLE on shipments');
  assert.ok(!sql.includes('DROP TABLE public.orders'), 'No DROP TABLE on orders');
  assert.ok(!sql.includes('DROP COLUMN'), 'No DROP COLUMN permitted');
  assert.ok(!sql.includes('TRUNCATE'), 'No TRUNCATE permitted');
});

test('04. Schema extensions: payment_method and cliq_reference added to public.shipments', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(sql.includes('payment_method TEXT'), 'payment_method column added');
  assert.ok(sql.includes('cliq_reference TEXT'), 'cliq_reference column added');
});

test('05. Order idempotency table exists with composite unique constraint', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(sql.includes('order_idempotency_keys'), 'idempotency table created');
  assert.ok(
    sql.includes('uq_order_idempotency UNIQUE (tenant_id, merchant_id, request_type, idempotency_key)'),
    'Composite unique constraint defined'
  );
});

test('06. create_order_idempotent RPC defined with SECURITY DEFINER and safe search_path', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.create_order_idempotent'), 'RPC declared');
  assert.ok(sql.includes('SECURITY DEFINER'), 'SECURITY DEFINER declared');
  assert.ok(sql.includes('SET search_path = public, pg_temp'), 'Safe search_path declared');
});

test('07. create_order_idempotent uses pg_advisory_xact_lock for deterministic concurrency protection', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(sql.includes('pg_advisory_xact_lock'), 'pg_advisory_xact_lock used');
});

test('08. create_order_idempotent creates status history entry with CREATED status', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(sql.includes('INSERT INTO public.shipment_status_history'), 'Status history created');
  assert.ok(sql.includes('v_status'), 'Shipment status used');
});

test('09. create_order_idempotent explicitly does NOT insert into shipment_legs', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(!sql.includes('INSERT INTO public.shipment_legs'), 'No premature leg insertion allowed during registration');
});

test('10. Permissions revoked from public/anon/authenticated and granted to service_role', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(sql.includes('REVOKE ALL ON FUNCTION public.create_order_idempotent('), 'Revoke RPC from public with full signature');
  assert.ok(sql.includes('GRANT EXECUTE ON FUNCTION public.create_order_idempotent('), 'Grant RPC to service_role with full signature');
  assert.ok(sql.includes('REVOKE ALL ON TABLE public.order_idempotency_keys FROM PUBLIC, anon, authenticated;'), 'Revoke table from public');
  assert.ok(sql.includes('GRANT ALL ON TABLE public.order_idempotency_keys TO service_role;'), 'Grant table to service_role');
});

// ============================================================================
// SECTION 2: SERVICE LAYER & HASH DETERMINISM
// ============================================================================

test('11. OrderPersistenceService module exists and exports expected types and classes', () => {
  assert.ok(typeof OrderPersistenceService === 'function', 'OrderPersistenceService class exported');
  assert.ok(typeof OrderPersistenceError === 'function', 'OrderPersistenceError class exported');
  assert.ok(typeof computeCanonicalPayloadHash === 'function', 'computeCanonicalPayloadHash exported');
  assert.ok(typeof mapShipmentRowToOrder === 'function', 'mapShipmentRowToOrder exported');
});

test('12. computeCanonicalPayloadHash is completely deterministic regardless of property ordering', () => {
  const payloadA: CanonicalOrderPayload = {
    merchantId: 'm-123',
    recipientName: 'Ahmad Al-Khalil',
    recipientPhone: '0791234567',
    governorate: 'عمان',
    area: 'خلدا',
    streetAddress: 'عمان - خلدا شارع وصفي التل',
    packageType: 'طرد إلكترونيات',
    piecesCount: 1,
    paymentType: 'COD',
    totalCollectionInput: 35.5,
    merchantCollectionInput: 32.5,
  };

  const payloadB: CanonicalOrderPayload = {
    totalCollectionInput: 35.5,
    packageType: 'طرد إلكترونيات',
    recipientPhone: '0791234567',
    recipientName: 'Ahmad Al-Khalil',
    merchantId: 'm-123',
    streetAddress: 'عمان - خلدا شارع وصفي التل',
    area: 'خلدا',
    governorate: 'عمان',
    piecesCount: 1,
    merchantCollectionInput: 32.5,
    paymentType: 'COD',
  };

  const hashA = computeCanonicalPayloadHash(payloadA);
  const hashB = computeCanonicalPayloadHash(payloadB);
  assert.strictEqual(hashA, hashB, 'Hashes must match identically for equivalent payloads');
  assert.strictEqual(hashA.length, 64, 'SHA-256 hash must be 64 hex characters');
});

test('13. computeCanonicalPayloadHash changes when a material financial or routing field changes', () => {
  const basePayload: CanonicalOrderPayload = {
    merchantId: 'm-123',
    recipientName: 'Ahmad Al-Khalil',
    recipientPhone: '0791234567',
    governorate: 'عمان',
    area: 'خلدا',
    streetAddress: 'عمان - خلدا شارع وصفي التل',
    packageType: 'طرد إلكترونيات',
    piecesCount: 1,
    paymentType: 'COD',
    totalCollectionInput: 35.0,
    merchantCollectionInput: 32.0,
  };

  const alteredPayload: CanonicalOrderPayload = {
    ...basePayload,
    totalCollectionInput: 40.0, // Modified amount
  };

  const hashBase = computeCanonicalPayloadHash(basePayload);
  const hashAltered = computeCanonicalPayloadHash(alteredPayload);
  assert.notStrictEqual(hashBase, hashAltered, 'Hash must differ when financial amounts change');
});

test('14. mapShipmentRowToOrder maps Supabase shipment row to Order correctly with CliQ handling', () => {
  const row = {
    id: '11111111-2222-3333-4444-555555555555',
    sequence: 'ORD-2026-1045',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    merchant_id: 'm-99',
    status: 'CREATED',
    payment_type: 'PREPAID',
    payment_method: 'CLIQ',
    cliq_reference: 'CLIQ-REF-9988',
    recipient_name: 'سارة الأحمد',
    recipient_phone: '0788888888',
    governorate: 'إربد',
    area: 'الحي الشرقي',
    address: 'إربد - الحي الشرقي',
    cod_amount: '38.000',
    merchant_collection: '35.000',
    delivery_fee: '3.000',
    driver_fee: '1.500',
    created_at: '2026-09-22T10:00:00Z',
    updated_at: '2026-09-22T10:00:00Z',
  };

  const order = mapShipmentRowToOrder(row);
  assert.strictEqual(order.id, '11111111-2222-3333-4444-555555555555');
  assert.strictEqual(order.sequence, 'ORD-2026-1045');
  assert.strictEqual(order.status, 'PENDING', 'CREATED maps to PENDING for frontend');
  assert.strictEqual(order.paymentType, 'CLIQ', 'CLIQ payment method maps to CLIQ paymentType');
  assert.strictEqual(order.totalCollection, 38.0);
  assert.strictEqual(order.merchantCollection, 35.0);
  assert.strictEqual(order.deliveryFee, 3.0);
});

// ============================================================================
// SECTION 3: SERVER.TS INTEGRATION & FINANCIAL DEFECT VERIFICATION
// ============================================================================

test('15. server.ts exports orderPersistenceService instance', () => {
  const serverCode = read(serverPath);
  assert.ok(
    serverCode.includes('export const orderPersistenceService = new OrderPersistenceService(supabase);'),
    'orderPersistenceService instantiated and exported'
  );
});

test('16. POST /api/orders calls orderPersistenceService.createOrderIdempotent', () => {
  const serverCode = read(serverPath);
  assert.ok(
    serverCode.includes('orderPersistenceService.createOrderIdempotent'),
    'POST /api/orders wired to DB orderPersistenceService'
  );
});

test('17. POST /api/orders extracts and forwards idempotency key', () => {
  const serverCode = read(serverPath);
  assert.ok(
    serverCode.includes("req.headers['idempotency-key']"),
    'idempotency-key header supported'
  );
});

test('18. Financial Defect Fix: netPayable does NOT subtract delivery fee twice', () => {
  const serverCode = read(serverPath);
  // Net payable must be the sum of merchantCollection, not (merchantCollection - deliveryFee)
  assert.ok(
    serverCode.includes('const netPayable = pendingSettlement.reduce((sum, o) => sum + (o.merchantCollection || 0), 0);'),
    'netPayable accurately uses merchantCollection'
  );
  assert.ok(
    !serverCode.includes('((o.merchantCollection || 0) - (o.deliveryFee || 0))'),
    'Double delivery fee subtraction is completely removed'
  );
});

test('19. Financial Defect Fix: POST settle endpoint does NOT subtract delivery fee twice', () => {
  const serverCode = read(serverPath);
  const serviceCode = read(servicePath);
  assert.ok(
    serverCode.includes('orderPersistenceService.settleMerchantShipments'),
    'POST settle endpoint calls orderPersistenceService.settleMerchantShipments'
  );
  assert.ok(
    serviceCode.includes('rows.reduce((sum: number, r: any) => sum + Number(r.merchant_collection || 0), 0)'),
    'Service accumulates merchant_collection directly without re-subtracting delivery fee'
  );
});

test('20. GET /api/orders/:id checks orderPersistenceService on canonical lookup', () => {
  const serverCode = read(serverPath);
  assert.ok(
    serverCode.includes('orderPersistenceService.getShipmentById'),
    'GET /api/orders/:id checks database orderPersistenceService directly'
  );
});

test('21. Hardening: Sequence year is dynamically derived and scoped to current year prefix', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(
    sql.includes("v_year := TO_CHAR(now() AT TIME ZONE 'Asia/Amman', 'YYYY');"),
    'Sequence derives year dynamically from now() in Jordan timezone'
  );
  assert.ok(
    !sql.includes("v_sequence := 'ORD-2026-'"),
    'Hardcoded 2026 is strictly eliminated'
  );
  assert.ok(
    sql.includes("sequence LIKE (v_prefix || '%')"),
    'Sequence calculation is scoped strictly to the current year prefix'
  );
});

test('22. Hardening: Canonical creation sets driver_id = NULL and creates 0 legs', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(
    !sql.includes('p_driver_id UUID,'),
    'p_driver_id is removed from create_order_idempotent signature'
  );
  assert.ok(
    !sql.includes('INSERT INTO public.shipment_legs'),
    'Zero shipment legs created at order registration'
  );
});

test('23. Hardening: OTP is strictly excluded from RPC response and idempotency snapshot', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(
    !sql.includes("'otp', v_otp"),
    'v_response and response_snapshot do NOT contain otp'
  );
  const serviceCode = read(servicePath);
  assert.ok(
    serviceCode.includes('deliveryOtp: undefined'),
    'mapShipmentRowToOrder does NOT expose delivery OTP'
  );
});

test('24. Hardening: Payment method backfill safely handles legacy PREPAID/POSTPAID without fabricating CLIQ', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(
    sql.includes("WHEN payment_type = 'PREPAID' THEN 'UNSPECIFIED'"),
    'Legacy PREPAID safely backfilled as UNSPECIFIED'
  );
  assert.ok(
    sql.includes("WHEN payment_type = 'COD' THEN 'CASH'"),
    'Legacy COD backfilled as CASH'
  );
});

test('25. OTP Disablement: SQL migration does NOT generate random OTP on order creation', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(
    !sql.includes('v_otp TEXT;'),
    'v_otp is not declared in create_order_idempotent'
  );
  assert.ok(
    !sql.includes('v_otp := LPAD'),
    'No random OTP is computed in create_order_idempotent'
  );
});

test('26. OTP Disablement: Legacy verify-pod fails closed with OTP_FEATURE_DISABLED', () => {
  const serverCode = read(serverPath);
  assert.ok(
    serverCode.includes("error: 'OTP_FEATURE_DISABLED'"),
    'Legacy verify-pod endpoint returns OTP_FEATURE_DISABLED'
  );
  assert.ok(
    serverCode.includes("app.post('/api/orders/:id/verify-pod', requireAuth, (_req, res) => {\n  return res.status(410).json({\n    error: 'OTP_FEATURE_DISABLED'"),
    'Legacy verify-pod endpoint directly returns 410 without executing mutation logic'
  );
});

test('27. OTP Disablement: Nested shipment object in response uses sanitized allowlist without OTP', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(
    !sql.includes("'shipment', row_to_json(v_created_shipment)"),
    'Full shipment row is NOT directly dumped to response'
  );
  assert.ok(
    sql.includes("'shipment', jsonb_build_object("),
    'Shipment response is constructed with explicit safe allowlist'
  );
});


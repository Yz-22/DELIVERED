import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const preflightScriptPath = path.join(
  process.cwd(),
  'supabase/final/preflight/20260923_step6_3p_installation_preflight.sql'
);

function readScript(): string {
  return fs.readFileSync(preflightScriptPath, 'utf-8');
}

test('01. Preflight script exists at canonical path', () => {
  assert.ok(fs.existsSync(preflightScriptPath), 'Preflight script exists');
});

test('02. Preflight script is strictly READ-ONLY (ZERO mutating statements)', () => {
  const sql = readScript();
  // Strip comments and string literals
  const strippedSql = sql
    .replace(/--.*$/gm, '')
    .replace(/'[^']*'/g, "''");

  const mutatingPatterns = [
    { pattern: /\bINSERT\s+INTO\b/i, name: 'INSERT INTO' },
    { pattern: /\bUPDATE\s+\w+\s+SET\b/i, name: 'UPDATE' },
    { pattern: /\bDELETE\s+FROM\b/i, name: 'DELETE FROM' },
    { pattern: /\bALTER\s+TABLE\b/i, name: 'ALTER TABLE' },
    { pattern: /\bCREATE\s+(TABLE|OR|INDEX|VIEW|FUNCTION|SCHEMA|TYPE)\b/i, name: 'CREATE' },
    { pattern: /\bDROP\s+(TABLE|VIEW|FUNCTION|INDEX|TYPE|POLICY)\b/i, name: 'DROP' },
    { pattern: /\bTRUNCATE\b/i, name: 'TRUNCATE' },
    { pattern: /\bGRANT\s+\w+\b/i, name: 'GRANT' },
    { pattern: /\bREVOKE\s+\w+\b/i, name: 'REVOKE' },
    { pattern: /\bCALL\s+\w+\b/i, name: 'CALL' },
  ];

  for (const { pattern, name } of mutatingPatterns) {
    assert.strictEqual(
      pattern.test(strippedSql),
      false,
      `Preflight script must NOT contain ${name} statement!`
    );
  }
});

test('03. Preflight script verifies core tables (shipments, shipment_status_history, tenants, users)', () => {
  const sql = readScript();
  assert.ok(sql.includes("'shipments'"), 'shipments checked');
  assert.ok(sql.includes("'shipment_status_history'"), 'shipment_status_history checked');
  assert.ok(sql.includes("'tenants'"), 'tenants checked');
  assert.ok(sql.includes("'users'"), 'users checked');
});

test('04. Preflight script audits required core shipments columns and hotfix additions', () => {
  const sql = readScript();
  const requiredCols = [
    'id', 'tenant_id', 'sequence', 'merchant_id', 'branch_id', 'driver_id',
    'recipient_name', 'recipient_phone', 'recipient_phone2', 'governorate',
    'area', 'address', 'package_details', 'notes', 'status', 'payment_type',
    'weight', 'pieces', 'barcode', 'cod_amount', 'merchant_collection',
    'delivery_fee', 'driver_fee', 'return_fee', 'extra_weight_fee',
    'currency', 'created_at', 'updated_at'
  ];
  for (const col of requiredCols) {
    assert.ok(sql.includes(`'${col}'`), `Column ${col} checked`);
  }
  assert.ok(sql.includes("'payment_method'"), 'payment_method checked');
  assert.ok(sql.includes("'cliq_reference'"), 'cliq_reference checked');
  assert.ok(sql.includes("'reference_number'"), 'reference_number checked');
  assert.ok(sql.includes("'sub_area'"), 'sub_area checked');
  assert.ok(sql.includes("'otp'"), 'otp checked');
});

test('05. Preflight script audits shipment_status_history columns', () => {
  const sql = readScript();
  const requiredHistoryCols = [
    'tenant_id', 'shipment_id', 'previous_status', 'new_status',
    'actor_id', 'actor_name', 'actor_role', 'notes', 'created_at'
  ];
  for (const col of requiredHistoryCols) {
    assert.ok(sql.includes(`'${col}'`), `History column ${col} checked`);
  }
});

test('06. Preflight script inspects enums, FK targets, existing RPC, and idempotency table', () => {
  const sql = readScript();
  assert.ok(sql.includes("'shipment_status'"), 'shipment_status enum checked');
  assert.ok(sql.includes("'payment_type'"), 'payment_type enum checked');
  assert.ok(sql.includes("'create_order_idempotent'"), 'create_order_idempotent RPC checked');
  assert.ok(sql.includes("'order_idempotency_keys'"), 'order_idempotency_keys table checked');
  assert.ok(sql.includes("'idx_shipments_payment_method'"), 'payment method index checked');
  assert.ok(sql.includes("'idx_shipments_reference_number'"), 'reference number index checked');
  assert.ok(sql.includes("'idx_order_idempotency_lookup'"), 'idempotency lookup index checked');
});

test('07. Preflight script checks phone, sequence, and OTP aggregate metrics without PII exposure', () => {
  const sql = readScript();
  assert.ok(sql.includes('local_07_format'), 'local_07_format metric included');
  assert.ok(sql.includes('canonical_plus962_format'), 'canonical_plus962_format metric included');
  assert.ok(sql.includes('ord_sequence_count'), 'ord_sequence_count metric included');
  assert.ok(sql.includes('current_year_ord_count'), 'current_year_ord_count metric included');
  assert.ok(sql.includes('otp_null_count'), 'otp_null_count metric included');
  assert.ok(sql.includes('otp_non_null_count'), 'otp_non_null_count metric included');
});

test('08. Preflight script inspects database roles and required extension functions', () => {
  const sql = readScript();
  assert.ok(sql.includes("'service_role'"), 'service_role checked');
  assert.ok(sql.includes("'anon'"), 'anon checked');
  assert.ok(sql.includes("'authenticated'"), 'authenticated checked');
  assert.ok(sql.includes("'gen_random_uuid'"), 'gen_random_uuid checked');
  assert.ok(sql.includes("'md5'"), 'md5 checked');
  assert.ok(sql.includes("'pg_advisory_xact_lock'"), 'pg_advisory_xact_lock checked');
});

test('09. Preflight script outputs master consolidated JSON verdict with overall_preflight_verdict', () => {
  const sql = readScript();
  assert.ok(sql.includes('overall_preflight_verdict'), 'overall_preflight_verdict included');
  assert.ok(sql.includes('preflight_diagnostic_details'), 'preflight_diagnostic_details included');
});

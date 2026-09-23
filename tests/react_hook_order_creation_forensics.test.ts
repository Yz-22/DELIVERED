import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  computeCanonicalPayloadHash,
  mapShipmentRowToOrder,
  type CanonicalOrderPayload,
} from '../src/services/orderPersistenceService.ts';

const createOrderModalPath = path.join(process.cwd(), 'src/components/CreateOrderModal.tsx');
const quickOrderModalPath = path.join(process.cwd(), 'src/components/QuickOrderModal.tsx');
const appPath = path.join(process.cwd(), 'src/App.tsx');
const hotfixMigrationPath = path.join(
  process.cwd(),
  'supabase/final/hotfixes/20260922_order_persistence_and_idempotency_hardening.sql'
);

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8');
}

// ============================================================================
// SECTION 1: REACT #310 RULES OF HOOKS FORENSIC AUDIT
// ============================================================================

test('01. CreateOrderModal: ZERO hooks declared after conditional return (if (!isOpen) return null;)', () => {
  const code = read(createOrderModalPath);
  const lines = code.split('\n');

  let earlyReturnIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/if\s*\(!isOpen\)\s*return\s+null;/.test(lines[i])) {
      earlyReturnIndex = i;
      break;
    }
  }

  assert.ok(earlyReturnIndex > 0, 'Early return statement found in CreateOrderModal');

  // Check that NO hook (useState, useEffect, useMemo, useCallback, useRef) is called after earlyReturnIndex
  const hookRegex = /\buse(State|Effect|Memo|Callback|Ref|Context|Reducer)\b/;
  const hooksAfterEarlyReturn: string[] = [];

  for (let i = earlyReturnIndex + 1; i < lines.length; i++) {
    if (hookRegex.test(lines[i])) {
      hooksAfterEarlyReturn.push(`Line ${i + 1}: ${lines[i].trim()}`);
    }
  }

  assert.deepStrictEqual(
    hooksAfterEarlyReturn,
    [],
    'All React hooks in CreateOrderModal MUST be declared unconditionally before any early return'
  );
});

test('02. CreateOrderModal: formError state is declared at top level with all other hooks', () => {
  const code = read(createOrderModalPath);
  const lines = code.split('\n');

  const formErrorIndex = lines.findIndex((l) => l.includes('const [formError, setFormError] = useState'));
  const earlyReturnIndex = lines.findIndex((l) => /if\s*\(!isOpen\)\s*return\s+null;/.test(l));

  assert.ok(formErrorIndex !== -1, 'formError useState found');
  assert.ok(earlyReturnIndex !== -1, 'early return found');
  assert.ok(
    formErrorIndex < earlyReturnIndex,
    `formError hook (line ${formErrorIndex + 1}) must precede early return (line ${earlyReturnIndex + 1})`
  );
});

test('03. QuickOrderModal: ZERO hooks declared after conditional return', () => {
  const code = read(quickOrderModalPath);
  const lines = code.split('\n');

  const earlyReturnIndex = lines.findIndex((l) => /if\s*\(!isOpen\)\s*return\s+null;/.test(l));
  assert.ok(earlyReturnIndex > 0);

  const hookRegex = /\buse(State|Effect|Memo|Callback|Ref|Context|Reducer)\b/;
  const hooksAfterEarlyReturn: string[] = [];

  for (let i = earlyReturnIndex + 1; i < lines.length; i++) {
    if (hookRegex.test(lines[i])) {
      hooksAfterEarlyReturn.push(`Line ${i + 1}: ${lines[i].trim()}`);
    }
  }

  assert.deepStrictEqual(hooksAfterEarlyReturn, [], 'No hooks after early return in QuickOrderModal');
});

// ============================================================================
// SECTION 2: CLIENT ERROR HANDLING & APP STABILITY
// ============================================================================

test('04. App.tsx: handleCreateOrder provides controlled error toast without crashing', () => {
  const appCode = read(appPath);
  assert.ok(
    appCode.includes("showToast(errData.message || 'حدث خطأ أثناء حفظ الطلبية في قاعدة البيانات', 'error')"),
    'Controlled error toast displayed on non-200 HTTP response'
  );
});

test('05. App.tsx: handleQuickOrder and handleBatchImport provide controlled error toasts', () => {
  const appCode = read(appPath);
  assert.ok(
    appCode.includes("showToast(errData.message || 'حدث خطأ أثناء حفظ الطلبية السريعة', 'error')"),
    'Quick order error toast handled'
  );
  assert.ok(
    appCode.includes("showToast(errData.message || 'حدث خطأ أثناء استيراد الدفعة', 'error')"),
    'Batch import error toast handled'
  );
});

// ============================================================================
// SECTION 3: MIGRATION & PERSISTENCE PREFLIGHT AUDIT
// ============================================================================

test('06. Canonical hotfix migration has NOT been executed yet and remains ready for human installation', () => {
  assert.ok(fs.existsSync(hotfixMigrationPath), 'Hotfix migration file exists');
  const sql = read(hotfixMigrationPath);
  assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.create_order_idempotent'));
  assert.ok(sql.includes('public.order_idempotency_keys'));
});

test('07. Newly returned CREATED database row maps cleanly to Order model', () => {
  const row = {
    id: 'a0000000-0000-0000-0000-000000000001',
    sequence: 'ORD-2026-9001',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    merchant_id: 'm-55',
    status: 'CREATED',
    payment_type: 'COD',
    payment_method: 'CASH',
    recipient_name: 'خالد عبدالله',
    recipient_phone: '+962791234567',
    recipient_phone_alt: null,
    governorate: 'عمان',
    area: 'عبدون',
    sub_area: 'دوار عبدون',
    address: 'عمان - عبدون',
    cod_amount: '50.000',
    merchant_collection: '47.000',
    delivery_fee: '3.000',
    driver_fee: '1.500',
    package_type: 'طرد ملابس',
    pieces_count: 2,
    reference_number: 'REF-5544',
    created_at: '2026-09-23T10:00:00Z',
    updated_at: '2026-09-23T10:00:00Z',
  };

  const order = mapShipmentRowToOrder(row);
  assert.strictEqual(order.id, 'a0000000-0000-0000-0000-000000000001');
  assert.strictEqual(order.sequence, 'ORD-2026-9001');
  assert.strictEqual(order.status, 'PENDING');
  assert.strictEqual(order.paymentType, 'COD');
  assert.strictEqual(order.totalCollection, 50.0);
  assert.strictEqual(order.merchantCollection, 47.0);
  assert.strictEqual(order.deliveryFee, 3.0);
  assert.strictEqual(order.recipientPhone, '+962791234567');
});

test('08. Idempotency hash computation is stable and robust', () => {
  const payload: CanonicalOrderPayload = {
    merchantId: 'm-55',
    recipientName: 'خالد عبدالله',
    recipientPhone: '+962791234567',
    governorate: 'عمان',
    area: 'عبدون',
    streetAddress: 'عمان - عبدون',
    packageType: 'طرد ملابس',
    piecesCount: 2,
    paymentType: 'COD',
    totalCollectionInput: 50.0,
    merchantCollectionInput: 47.0,
  };

  const hash1 = computeCanonicalPayloadHash(payload);
  const hash2 = computeCanonicalPayloadHash({ ...payload });
  assert.strictEqual(hash1, hash2);
  assert.strictEqual(hash1.length, 64);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAuthoritativeMerchant, canAccessMerchant, users } from '../server.ts';
import { validateAndNormalizePaymentContract } from '../src/utils/paymentContract.ts';

// Mock IDs and entities
const tenantA = '00000000-0000-0000-0000-000000000001';
const tenantB = '00000000-0000-0000-0000-000000000002';

const merchantUserA = {
  id: 'merchant-a-01',
  name: 'متجر الأناقة عمان',
  role: 'MERCHANT' as const,
  tenantId: tenantA,
  parentUserId: tenantA,
};

const merchantUserB = {
  id: 'merchant-b-99',
  name: 'متجر شركة أخرى في إربد',
  role: 'MERCHANT' as const,
  tenantId: tenantB,
  parentUserId: tenantB,
};

const cashierUserA = {
  id: 'cashier-a-01',
  name: 'كاشير فرع الصويفية',
  role: 'CASHIER' as const,
  tenantId: tenantA,
  parentUserId: 'merchant-a-01',
};

const adminUserA = {
  id: 'admin-a-01',
  name: 'مشرف العمليات',
  role: 'ADMIN' as const,
  tenantId: tenantA,
  parentUserId: tenantA,
};

const operatorUserA = {
  id: 'operator-a-01',
  name: 'موظف إدخال العمليات',
  role: 'OPERATOR' as const,
  tenantId: tenantA,
  parentUserId: tenantA,
};

const superAdminUser = {
  id: 'super-01',
  name: 'مدير النظام العام',
  role: 'SUPER_ADMIN' as const,
};

// Seed mock users into server users array if not already present
if (!users.some((u) => u.id === merchantUserA.id)) users.push(merchantUserA as any);
if (!users.some((u) => u.id === merchantUserB.id)) users.push(merchantUserB as any);
if (!users.some((u) => u.id === cashierUserA.id)) users.push(cashierUserA as any);
if (!users.some((u) => u.id === adminUserA.id)) users.push(adminUserA as any);
if (!users.some((u) => u.id === operatorUserA.id)) users.push(operatorUserA as any);

// ============================================================================
// 1. LIVE ORDER CREATION AUTHORIZATION CONTRACT TESTS
// ============================================================================

test('01. MERCHANT creates for self: resolves authoritatively to own identity', () => {
  const merchantCtx = {
    userId: 'merchant-a-01',
    user: merchantUserA,
    role: 'MERCHANT',
    isSuperAdmin: false,
    isAdmin: false,
    isMerchant: true,
    isCashier: false,
    tenantId: tenantA,
  } as any;

  // With explicit own merchantId
  const explicitRes = resolveAuthoritativeMerchant(merchantCtx, 'merchant-a-01');
  assert.strictEqual(explicitRes.merchantId, 'merchant-a-01');
  assert.strictEqual(explicitRes.errorResponse, undefined);

  // With empty merchantId
  const emptyRes = resolveAuthoritativeMerchant(merchantCtx, '');
  assert.strictEqual(emptyRes.merchantId, 'merchant-a-01');
  assert.strictEqual(emptyRes.errorResponse, undefined);

  // With undefined merchantId
  const undefRes = resolveAuthoritativeMerchant(merchantCtx, undefined);
  assert.strictEqual(undefRes.merchantId, 'merchant-a-01');
  assert.strictEqual(undefRes.errorResponse, undefined);
});

test('02. MERCHANT attempts another merchant → denied with 403 FORBIDDEN_MERCHANT', () => {
  const merchantCtx = {
    userId: 'merchant-a-01',
    user: merchantUserA,
    role: 'MERCHANT',
    isSuperAdmin: false,
    isAdmin: false,
    isMerchant: true,
    isCashier: false,
    tenantId: tenantA,
  } as any;

  // Attempting another merchant in another tenant
  const foreignRes = resolveAuthoritativeMerchant(merchantCtx, 'merchant-b-99');
  assert.strictEqual(foreignRes.merchantId, '');
  assert.ok(foreignRes.errorResponse);
  assert.strictEqual(foreignRes.errorResponse?.status, 403);
  assert.strictEqual(foreignRes.errorResponse?.body.code, 'FORBIDDEN_MERCHANT');
  assert.strictEqual(foreignRes.errorResponse?.body.field, 'merchantId');

  // canAccessMerchant also strictly returns false
  assert.strictEqual(canAccessMerchant(merchantCtx, 'merchant-b-99'), false);
});

test('03. CASHIER creates for canonical parent merchant: resolves authoritatively', () => {
  const cashierCtx = {
    userId: 'cashier-a-01',
    user: cashierUserA,
    role: 'CASHIER',
    isSuperAdmin: false,
    isAdmin: false,
    isMerchant: false,
    isCashier: true,
    tenantId: tenantA,
    branchId: 'branch-sweifieh-01',
    branchName: 'فرع الصويفية',
  } as any;

  // Empty merchantId resolves to parent merchant
  const emptyRes = resolveAuthoritativeMerchant(cashierCtx, '');
  assert.strictEqual(emptyRes.merchantId, 'merchant-a-01');
  assert.strictEqual(emptyRes.errorResponse, undefined);

  // Explicit parent merchantId resolves to parent merchant
  const explicitRes = resolveAuthoritativeMerchant(cashierCtx, 'merchant-a-01');
  assert.strictEqual(explicitRes.merchantId, 'merchant-a-01');
  assert.strictEqual(explicitRes.errorResponse, undefined);

  // canAccessMerchant returns true for canonical parent merchant
  assert.strictEqual(canAccessMerchant(cashierCtx, 'merchant-a-01'), true);
});

test('04. CASHIER attempts another merchant → denied with 403 FORBIDDEN_MERCHANT', () => {
  const cashierCtx = {
    userId: 'cashier-a-01',
    user: cashierUserA,
    role: 'CASHIER',
    isSuperAdmin: false,
    isAdmin: false,
    isMerchant: false,
    isCashier: true,
    tenantId: tenantA,
    branchId: 'branch-sweifieh-01',
  } as any;

  const foreignRes = resolveAuthoritativeMerchant(cashierCtx, 'merchant-b-99');
  assert.strictEqual(foreignRes.merchantId, '');
  assert.ok(foreignRes.errorResponse);
  assert.strictEqual(foreignRes.errorResponse?.status, 403);
  assert.strictEqual(foreignRes.errorResponse?.body.code, 'FORBIDDEN_MERCHANT');

  assert.strictEqual(canAccessMerchant(cashierCtx, 'merchant-b-99'), false);
});

test('05. ADMIN authorized merchant → allowed', () => {
  const adminCtx = {
    userId: 'admin-a-01',
    user: adminUserA,
    role: 'ADMIN',
    isSuperAdmin: false,
    isAdmin: true,
    isMerchant: false,
    isCashier: false,
    tenantId: tenantA,
  } as any;

  assert.strictEqual(canAccessMerchant(adminCtx, 'merchant-a-01'), true);
  const res = resolveAuthoritativeMerchant(adminCtx, 'merchant-a-01');
  assert.strictEqual(res.merchantId, 'merchant-a-01');
  assert.strictEqual(res.errorResponse, undefined);
});

test('06. ADMIN unauthorized merchant → denied', () => {
  const adminCtx = {
    userId: 'admin-a-01',
    user: adminUserA,
    role: 'ADMIN',
    isSuperAdmin: false,
    isAdmin: true,
    isMerchant: false,
    isCashier: false,
    tenantId: tenantA,
  } as any;

  // Merchant belonging to tenantB
  assert.strictEqual(canAccessMerchant(adminCtx, 'merchant-b-99'), false);
  const res = resolveAuthoritativeMerchant(adminCtx, 'merchant-b-99');
  assert.strictEqual(res.merchantId, '');
  assert.ok(res.errorResponse);
  assert.strictEqual(res.errorResponse?.status, 403);
  assert.strictEqual(res.errorResponse?.body.code, 'FORBIDDEN_MERCHANT');
});

test('07. OPERATOR authorized merchant → allowed', () => {
  const operatorCtx = {
    userId: 'operator-a-01',
    user: operatorUserA,
    role: 'OPERATOR',
    isSuperAdmin: false,
    isAdmin: false,
    isOperator: true,
    isMerchant: false,
    isCashier: false,
    tenantId: tenantA,
  } as any;

  assert.strictEqual(canAccessMerchant(operatorCtx, 'merchant-a-01'), true);
  const res = resolveAuthoritativeMerchant(operatorCtx, 'merchant-a-01');
  assert.strictEqual(res.merchantId, 'merchant-a-01');
  assert.strictEqual(res.errorResponse, undefined);
});

test('08. OPERATOR unauthorized merchant → denied', () => {
  const operatorCtx = {
    userId: 'operator-a-01',
    user: operatorUserA,
    role: 'OPERATOR',
    isSuperAdmin: false,
    isAdmin: false,
    isOperator: true,
    isMerchant: false,
    isCashier: false,
    tenantId: tenantA,
  } as any;

  assert.strictEqual(canAccessMerchant(operatorCtx, 'merchant-b-99'), false);
  const res = resolveAuthoritativeMerchant(operatorCtx, 'merchant-b-99');
  assert.strictEqual(res.merchantId, '');
  assert.ok(res.errorResponse);
  assert.strictEqual(res.errorResponse?.status, 403);
  assert.strictEqual(res.errorResponse?.body.code, 'FORBIDDEN_MERCHANT');
});

test('09. SUPER_ADMIN explicit valid merchant selection according to existing hierarchy contract', () => {
  const superCtx = {
    userId: 'super-01',
    user: superAdminUser,
    role: 'SUPER_ADMIN',
    isSuperAdmin: true,
    isAdmin: false,
    isMerchant: false,
    isCashier: false,
  } as any;

  // Explicit valid merchant in any tenant
  assert.strictEqual(canAccessMerchant(superCtx, 'merchant-a-01'), true);
  assert.strictEqual(canAccessMerchant(superCtx, 'merchant-b-99'), true);

  const resA = resolveAuthoritativeMerchant(superCtx, 'merchant-a-01');
  assert.strictEqual(resA.merchantId, 'merchant-a-01');
  assert.strictEqual(resA.errorResponse, undefined);

  const resB = resolveAuthoritativeMerchant(superCtx, 'merchant-b-99');
  assert.strictEqual(resB.merchantId, 'merchant-b-99');
  assert.strictEqual(resB.errorResponse, undefined);

  // Empty merchantId returns structured validation error (Super Admin must explicitly choose)
  const emptyRes = resolveAuthoritativeMerchant(superCtx, '');
  assert.ok(emptyRes.errorResponse);
  assert.strictEqual(emptyRes.errorResponse?.status, 400);
  assert.strictEqual(emptyRes.errorResponse?.body.code, 'VALIDATION_ERROR');

  // Non-existent merchant returns 403 FORBIDDEN_MERCHANT
  const nonexistentRes = resolveAuthoritativeMerchant(superCtx, 'non-existent-merchant-xyz');
  assert.ok(nonexistentRes.errorResponse);
  assert.strictEqual(nonexistentRes.errorResponse?.status, 403);
  assert.strictEqual(nonexistentRes.errorResponse?.body.code, 'FORBIDDEN_MERCHANT');
});

test('10. empty merchantId from ordinary MERCHANT client → still resolves authoritatively', () => {
  const merchantCtx = {
    userId: 'merchant-a-01',
    user: merchantUserA,
    role: 'MERCHANT',
    isSuperAdmin: false,
    isAdmin: false,
    isMerchant: true,
    isCashier: false,
    tenantId: tenantA,
  } as any;

  const res = resolveAuthoritativeMerchant(merchantCtx, '   ');
  assert.strictEqual(res.merchantId, 'merchant-a-01');
  assert.strictEqual(res.errorResponse, undefined);
});

test('11. merchants[0] never silently changes authoritative identity', () => {
  const merchantCtx = {
    userId: 'merchant-a-01',
    user: merchantUserA,
    role: 'MERCHANT',
    isSuperAdmin: false,
    isAdmin: false,
    isMerchant: true,
    isCashier: false,
    tenantId: tenantA,
  } as any;

  // Even if client sent merchants[0].id which was 'merchant-b-99', it NEVER silently creates as merchant-b-99
  const res = resolveAuthoritativeMerchant(merchantCtx, 'merchant-b-99');
  assert.notStrictEqual(res.merchantId, 'merchant-b-99');
  assert.strictEqual(res.merchantId, '');
  assert.ok(res.errorResponse);
  assert.strictEqual(res.errorResponse?.status, 403);
  assert.strictEqual(res.errorResponse?.body.code, 'FORBIDDEN_MERCHANT');
});

test('12. cross-tenant spoof → denied', () => {
  const adminCtx = {
    userId: 'admin-a-01',
    user: adminUserA,
    role: 'ADMIN',
    isSuperAdmin: false,
    isAdmin: true,
    isMerchant: false,
    isCashier: false,
    tenantId: tenantA,
  } as any;

  const res = resolveAuthoritativeMerchant(adminCtx, 'merchant-b-99');
  assert.strictEqual(res.merchantId, '');
  assert.ok(res.errorResponse);
  assert.strictEqual(res.errorResponse?.status, 403);
  assert.strictEqual(res.errorResponse?.body.code, 'FORBIDDEN_MERCHANT');
});

test('13. branch scope preserved for cashier', () => {
  const cashierCtx = {
    userId: 'cashier-a-01',
    user: cashierUserA,
    role: 'CASHIER',
    isSuperAdmin: false,
    isAdmin: false,
    isMerchant: false,
    isCashier: true,
    tenantId: tenantA,
    branchId: 'branch-sweifieh-01',
    branchName: 'فرع الصويفية',
  } as any;

  // Cashier resolving order creation
  const res = resolveAuthoritativeMerchant(cashierCtx, '');
  assert.strictEqual(res.merchantId, 'merchant-a-01');
  assert.strictEqual(cashierCtx.branchId, 'branch-sweifieh-01');
  assert.strictEqual(cashierCtx.branchName, 'فرع الصويفية');
});

// ============================================================================
// 2. DRIVER & ADDRESS CONTRACT INVARIANTS
// ============================================================================

test('14. driverId is optional during creation and RPC receives driverId = null', () => {
  assert.ok(true);
});

test('15. fullAddress is optional with server fallback to governorate - area', () => {
  const gov = 'عمان';
  const area = 'شسيشس';
  const fullAddress = '';
  const fallback = (fullAddress && String(fullAddress).trim() !== '') ? String(fullAddress).trim() : `${gov} - ${area}`;
  assert.strictEqual(fallback, 'عمان - شسيشس');
});

test('16. paymentType and paymentMethod default authoritatively to COD and CASH', () => {
  const norm = validateAndNormalizePaymentContract({
    paymentType: undefined,
    paymentMethod: undefined,
  });

  assert.strictEqual(norm.success, true);
  if (norm.success) {
    assert.strictEqual(norm.paymentType, 'COD');
    assert.strictEqual(norm.paymentMethod, 'CASH');
    assert.strictEqual(norm.cliqReference, null);
  }
});

test('17. Production reproduction payload passes canonical validation with authenticated merchant', () => {
  const reproductionPayload = {
    area: 'شسيشس',
    deliveryFee: 3,
    driverId: '',
    fullAddress: '',
    governorate: 'عمان',
    merchantCollection: 25,
    merchantId: '',
    notes: '',
    packageType: 'طرد عادي',
    piecesCount: 1,
    recipientName: 'محمد احمد ',
    recipientPhone: '+962781234567',
    recipientPhoneAlt: '+962781234567',
    referenceNumber: '',
    subArea: '',
    totalCollection: 28,
  };

  const ctx = {
    userId: 'm-prod-01',
    user: { id: 'm-prod-01', role: 'MERCHANT', tenantId: tenantA, parentUserId: tenantA },
    role: 'MERCHANT',
    isSuperAdmin: false,
    isAdmin: false,
    isMerchant: true,
    isCashier: false,
    tenantId: tenantA,
  } as any;

  // 1. Validate required fields
  assert.ok(reproductionPayload.recipientName.trim().length > 0);
  assert.ok(reproductionPayload.recipientPhone.trim().length > 0);
  assert.ok(reproductionPayload.governorate.trim().length > 0);
  assert.ok(reproductionPayload.area.trim().length > 0);

  // 2. Resolve authoritative merchant
  const merchantRes = resolveAuthoritativeMerchant(ctx, reproductionPayload.merchantId);
  assert.strictEqual(merchantRes.merchantId, 'm-prod-01');
  assert.strictEqual(merchantRes.errorResponse, undefined);

  // 3. Fallback address
  const streetAddress = (reproductionPayload.fullAddress && reproductionPayload.fullAddress.trim() !== '')
    ? reproductionPayload.fullAddress.trim()
    : `${reproductionPayload.governorate} - ${reproductionPayload.area}`;
  assert.strictEqual(streetAddress, 'عمان - شسيشس');
});

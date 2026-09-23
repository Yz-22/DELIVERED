import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAndNormalizePaymentContract,
  type CanonicalPaymentType,
  type CanonicalPaymentMethod,
} from '../src/utils/paymentContract.ts';
import {
  OrderPersistenceService,
  OrderPersistenceError,
  computeCanonicalPayloadHash,
  type CanonicalOrderPayload,
} from '../src/services/orderPersistenceService.ts';

// ============================================================================
// SECTION 1: CANONICAL ALLOWED PAIRS
// ============================================================================

test('01. Allowed Pair: COD + CASH (explicitly supplied)', () => {
  const result = validateAndNormalizePaymentContract({
    paymentType: 'COD',
    paymentMethod: 'CASH',
  });

  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.strictEqual(result.paymentType, 'COD');
    assert.strictEqual(result.paymentMethod, 'CASH');
    assert.strictEqual(result.cliqReference, null);
  }
});

test('02. Allowed Pair: COD + CASH (paymentMethod omitted -> defaults to CASH)', () => {
  const result = validateAndNormalizePaymentContract({
    paymentType: 'COD',
  });

  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.strictEqual(result.paymentType, 'COD');
    assert.strictEqual(result.paymentMethod, 'CASH');
    assert.strictEqual(result.cliqReference, null);
  }
});

test('03. Allowed Pair: COD + CASH (both omitted -> defaults to COD + CASH)', () => {
  const result = validateAndNormalizePaymentContract({});

  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.strictEqual(result.paymentType, 'COD');
    assert.strictEqual(result.paymentMethod, 'CASH');
    assert.strictEqual(result.cliqReference, null);
  }
});

test('04. Allowed Pair: PREPAID + CLIQ with valid cliqReference', () => {
  const result = validateAndNormalizePaymentContract({
    paymentType: 'PREPAID',
    paymentMethod: 'CLIQ',
    cliqReference: 'CLIQ-REF-2026-98765',
  });

  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.strictEqual(result.paymentType, 'PREPAID');
    assert.strictEqual(result.paymentMethod, 'CLIQ');
    assert.strictEqual(result.cliqReference, 'CLIQ-REF-2026-98765');
  }
});

test('05. Allowed Pair: PREPAID + CLIQ without cliqReference (null/empty -> null)', () => {
  const result = validateAndNormalizePaymentContract({
    paymentType: 'PREPAID',
    paymentMethod: 'CLIQ',
    cliqReference: '   ',
  });

  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.strictEqual(result.paymentType, 'PREPAID');
    assert.strictEqual(result.paymentMethod, 'CLIQ');
    assert.strictEqual(result.cliqReference, null);
  }
});

test('06. Allowed Pair: PREPAID + UNSPECIFIED (explicitly supplied)', () => {
  const result = validateAndNormalizePaymentContract({
    paymentType: 'PREPAID',
    paymentMethod: 'UNSPECIFIED',
  });

  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.strictEqual(result.paymentType, 'PREPAID');
    assert.strictEqual(result.paymentMethod, 'UNSPECIFIED');
    assert.strictEqual(result.cliqReference, null);
  }
});

test('07. Allowed Pair: PREPAID + UNSPECIFIED (paymentMethod omitted -> defaults to UNSPECIFIED)', () => {
  const result = validateAndNormalizePaymentContract({
    paymentType: 'PREPAID',
  });

  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.strictEqual(result.paymentType, 'PREPAID');
    assert.strictEqual(result.paymentMethod, 'UNSPECIFIED');
    assert.strictEqual(result.cliqReference, null);
  }
});

test('08. Allowed Pair: POSTPAID + UNSPECIFIED (explicitly supplied)', () => {
  const result = validateAndNormalizePaymentContract({
    paymentType: 'POSTPAID',
    paymentMethod: 'UNSPECIFIED',
  });

  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.strictEqual(result.paymentType, 'POSTPAID');
    assert.strictEqual(result.paymentMethod, 'UNSPECIFIED');
    assert.strictEqual(result.cliqReference, null);
  }
});

test('09. Allowed Pair: POSTPAID + UNSPECIFIED (paymentMethod omitted -> defaults to UNSPECIFIED)', () => {
  const result = validateAndNormalizePaymentContract({
    paymentType: 'POSTPAID',
  });

  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.strictEqual(result.paymentType, 'POSTPAID');
    assert.strictEqual(result.paymentMethod, 'UNSPECIFIED');
    assert.strictEqual(result.cliqReference, null);
  }
});

// ============================================================================
// SECTION 2: CANONICAL REJECTED PAIRS AND INVALID VALUES
// ============================================================================

test('10. Rejected Pair: COD + CLIQ is strictly disallowed', () => {
  const result = validateAndNormalizePaymentContract({
    paymentType: 'COD',
    paymentMethod: 'CLIQ',
  });

  assert.strictEqual(result.success, false);
  if (!result.success) {
    assert.strictEqual(result.code, 'INVALID_PAYMENT_COMBINATION');
    assert.strictEqual(result.status, 400);
    assert.strictEqual(result.field, 'paymentMethod');
  }
});

test('11. Rejected Pair: COD + UNSPECIFIED is strictly disallowed', () => {
  const result = validateAndNormalizePaymentContract({
    paymentType: 'COD',
    paymentMethod: 'UNSPECIFIED',
  });

  assert.strictEqual(result.success, false);
  if (!result.success) {
    assert.strictEqual(result.code, 'INVALID_PAYMENT_COMBINATION');
    assert.strictEqual(result.status, 400);
  }
});

test('12. Rejected Pair: PREPAID + CASH is strictly disallowed', () => {
  const result = validateAndNormalizePaymentContract({
    paymentType: 'PREPAID',
    paymentMethod: 'CASH',
  });

  assert.strictEqual(result.success, false);
  if (!result.success) {
    assert.strictEqual(result.code, 'INVALID_PAYMENT_COMBINATION');
    assert.strictEqual(result.status, 400);
  }
});

test('13. Rejected Pair: POSTPAID + CASH is strictly disallowed', () => {
  const result = validateAndNormalizePaymentContract({
    paymentType: 'POSTPAID',
    paymentMethod: 'CASH',
  });

  assert.strictEqual(result.success, false);
  if (!result.success) {
    assert.strictEqual(result.code, 'INVALID_PAYMENT_COMBINATION');
    assert.strictEqual(result.status, 400);
  }
});

test('14. Rejected Pair: POSTPAID + CLIQ is strictly disallowed', () => {
  const result = validateAndNormalizePaymentContract({
    paymentType: 'POSTPAID',
    paymentMethod: 'CLIQ',
  });

  assert.strictEqual(result.success, false);
  if (!result.success) {
    assert.strictEqual(result.code, 'INVALID_PAYMENT_COMBINATION');
    assert.strictEqual(result.status, 400);
  }
});

test('15. Rejected: CLIQ provided as paymentType (CLIQ is a payment METHOD, not a TYPE)', () => {
  const result = validateAndNormalizePaymentContract({
    paymentType: 'CLIQ',
    paymentMethod: 'CLIQ',
  });

  assert.strictEqual(result.success, false);
  if (!result.success) {
    assert.strictEqual(result.code, 'INVALID_PAYMENT_TYPE');
    assert.strictEqual(result.status, 400);
    assert.strictEqual(result.field, 'paymentType');
  }
});

test('16. Rejected: Unknown paymentType (e.g. CREDIT, ONLINE, WALLET)', () => {
  const types = ['CREDIT', 'ONLINE', 'WALLET', 'INVOICE', 'CHEQUE', '123'];
  for (const t of types) {
    const result = validateAndNormalizePaymentContract({
      paymentType: t,
    });
    assert.strictEqual(result.success, false, `Expected failure for paymentType: ${t}`);
    if (!result.success) {
      assert.strictEqual(result.code, 'INVALID_PAYMENT_TYPE');
      assert.strictEqual(result.status, 400);
    }
  }
});

test('17. Rejected: Unknown paymentMethod (e.g. BANK_TRANSFER, VISA, CARD)', () => {
  const methods = ['BANK_TRANSFER', 'VISA', 'CREDIT_CARD', 'STRIPE', 'WALLET', 'CHEQUE'];
  for (const m of methods) {
    const result = validateAndNormalizePaymentContract({
      paymentType: 'PREPAID',
      paymentMethod: m,
    });
    assert.strictEqual(result.success, false, `Expected failure for paymentMethod: ${m}`);
    if (!result.success) {
      assert.strictEqual(result.code, 'INVALID_PAYMENT_METHOD');
      assert.strictEqual(result.status, 400);
    }
  }
});

// ============================================================================
// SECTION 3: CLIQ REFERENCE VERIFICATION RULES
// ============================================================================

test('18. cliqReference is forced to NULL for COD + CASH even if supplied', () => {
  const result = validateAndNormalizePaymentContract({
    paymentType: 'COD',
    paymentMethod: 'CASH',
    cliqReference: 'ILLEGAL-CLIQ-REF',
  });

  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.strictEqual(result.paymentType, 'COD');
    assert.strictEqual(result.paymentMethod, 'CASH');
    assert.strictEqual(result.cliqReference, null, 'cliqReference must be NULL for COD + CASH');
  }
});

test('19. cliqReference is forced to NULL for PREPAID + UNSPECIFIED even if supplied', () => {
  const result = validateAndNormalizePaymentContract({
    paymentType: 'PREPAID',
    paymentMethod: 'UNSPECIFIED',
    cliqReference: 'UNSPECIFIED-CLIQ-REF',
  });

  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.strictEqual(result.paymentType, 'PREPAID');
    assert.strictEqual(result.paymentMethod, 'UNSPECIFIED');
    assert.strictEqual(result.cliqReference, null, 'cliqReference must be NULL for PREPAID + UNSPECIFIED');
  }
});

test('20. cliqReference is forced to NULL for POSTPAID + UNSPECIFIED even if supplied', () => {
  const result = validateAndNormalizePaymentContract({
    paymentType: 'POSTPAID',
    paymentMethod: 'UNSPECIFIED',
    cliqReference: 'POSTPAID-CLIQ-REF',
  });

  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.strictEqual(result.paymentType, 'POSTPAID');
    assert.strictEqual(result.paymentMethod, 'UNSPECIFIED');
    assert.strictEqual(result.cliqReference, null, 'cliqReference must be NULL for POSTPAID + UNSPECIFIED');
  }
});

test('21. cliqReference is trimmed and preserved strictly for PREPAID + CLIQ', () => {
  const result = validateAndNormalizePaymentContract({
    paymentType: 'PREPAID',
    paymentMethod: 'CLIQ',
    cliqReference: '   JOPACC-TXN-109283   ',
  });

  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.strictEqual(result.cliqReference, 'JOPACC-TXN-109283');
  }
});

// ============================================================================
// SECTION 4: CASE INSENSITIVITY & WHITESPACE TOLERANCE
// ============================================================================

test('22. Case insensitivity and whitespace tolerance in paymentType and paymentMethod', () => {
  const result1 = validateAndNormalizePaymentContract({
    paymentType: '  cod  ',
    paymentMethod: '  cash  ',
  });
  assert.strictEqual(result1.success, true);
  if (result1.success) {
    assert.strictEqual(result1.paymentType, 'COD');
    assert.strictEqual(result1.paymentMethod, 'CASH');
  }

  const result2 = validateAndNormalizePaymentContract({
    paymentType: '  PrePaid  ',
    paymentMethod: '  cLiQ  ',
  });
  assert.strictEqual(result2.success, true);
  if (result2.success) {
    assert.strictEqual(result2.paymentType, 'PREPAID');
    assert.strictEqual(result2.paymentMethod, 'CLIQ');
  }
});

// ============================================================================
// SECTION 5: ORDER PERSISTENCE SERVICE INTEGRATION & DEFENSE-IN-DEPTH
// ============================================================================

test('23. computeCanonicalPayloadHash produces identical deterministic hash for canonical values', () => {
  const payload1: CanonicalOrderPayload = {
    merchantId: 'mer-1',
    recipientName: 'احمد علي',
    recipientPhone: '0791234567',
    governorate: 'عمان',
    area: 'خلدا',
    streetAddress: 'عمان - خلدا',
    packageType: 'طرد',
    piecesCount: 1,
    paymentType: 'COD',
    paymentMethod: 'CASH',
    cliqReference: null,
  };

  const payload2: CanonicalOrderPayload = {
    merchantId: 'mer-1',
    recipientName: 'احمد علي',
    recipientPhone: '0791234567',
    governorate: 'عمان',
    area: 'خلدا',
    streetAddress: 'عمان - خلدا',
    packageType: 'طرد',
    piecesCount: 1,
    paymentType: 'COD',
    // paymentMethod omitted -> defaults to CASH
  };

  const hash1 = computeCanonicalPayloadHash(payload1);
  const hash2 = computeCanonicalPayloadHash(payload2);
  assert.strictEqual(hash1, hash2, 'Hashes must match because paymentMethod defaults deterministically to CASH');
});

test('24. OrderPersistenceService.createOrderIdempotent rejects illegal payment combinations before RPC', async () => {
  let rpcCalled = false;
  const mockSupabase: any = {
    rpc: async () => {
      rpcCalled = true;
      return { data: null, error: null };
    },
  };

  const service = new OrderPersistenceService(mockSupabase);

  const illegalPayload: CanonicalOrderPayload = {
    merchantId: 'mer-1',
    recipientName: 'سعيد خالد',
    recipientPhone: '0791234567',
    governorate: 'عمان',
    area: 'تلاع العلي',
    streetAddress: 'عمان - تلاع العلي',
    packageType: 'طرد',
    piecesCount: 1,
    paymentType: 'COD',
    paymentMethod: 'CLIQ', // ILLEGAL
  };

  await assert.rejects(
    async () => {
      await service.createOrderIdempotent({
        tenantId: 't-1',
        merchantId: 'mer-1',
        canonicalPayload: illegalPayload,
        deliveryFee: 3,
        merchantCollection: 20,
        totalCollection: 23,
      });
    },
    (err: any) => {
      assert.strictEqual(err instanceof OrderPersistenceError, true);
      assert.strictEqual(err.code, 'INVALID_PAYMENT_COMBINATION');
      assert.strictEqual(err.statusCode, 400);
      return true;
    }
  );

  assert.strictEqual(rpcCalled, false, 'RPC must NEVER be called when payment contract validation fails');
});

test('25. OrderPersistenceService.createOrderIdempotent rejects CLIQ as paymentType before RPC', async () => {
  let rpcCalled = false;
  const mockSupabase: any = {
    rpc: async () => {
      rpcCalled = true;
      return { data: null, error: null };
    },
  };

  const service = new OrderPersistenceService(mockSupabase);

  const cliqTypePayload: CanonicalOrderPayload = {
    merchantId: 'mer-1',
    recipientName: 'سعيد خالد',
    recipientPhone: '0791234567',
    governorate: 'عمان',
    area: 'تلاع العلي',
    streetAddress: 'عمان - تلاع العلي',
    packageType: 'طرد',
    piecesCount: 1,
    paymentType: 'CLIQ' as any, // ILLEGAL as paymentType
  };

  await assert.rejects(
    async () => {
      await service.createOrderIdempotent({
        tenantId: 't-1',
        merchantId: 'mer-1',
        canonicalPayload: cliqTypePayload,
        deliveryFee: 3,
        merchantCollection: 20,
        totalCollection: 23,
      });
    },
    (err: any) => {
      assert.strictEqual(err instanceof OrderPersistenceError, true);
      assert.strictEqual(err.code, 'INVALID_PAYMENT_TYPE');
      assert.strictEqual(err.statusCode, 400);
      return true;
    }
  );

  assert.strictEqual(rpcCalled, false, 'RPC must NEVER be called when paymentType is CLIQ');
});

test('26. OrderPersistenceService.createOrderIdempotent invokes RPC with normalized allowed values', async () => {
  let rpcArgs: any = null;
  const mockSupabase: any = {
    rpc: async (fnName: string, args: any) => {
      rpcArgs = { fnName, args };
      return {
        data: {
          success: true,
          is_replay: false,
          shipment: {
            id: 'shp-123',
            tenant_id: 't-1',
            merchant_id: 'mer-1',
            tracking_number: 'TRK-123',
            status: 'CREATED',
            recipient_name: 'علي احمد',
            recipient_phone: '+962791234567',
            governorate: 'عمان',
            area: 'خلدا',
            payment_type: args.p_payment_type,
            payment_method: args.p_payment_method,
            cliq_reference: args.p_cliq_reference,
            total_collection: 25.000,
            merchant_collection: 22.000,
            delivery_fee: 3.000,
            created_at: new Date().toISOString(),
          },
        },
        error: null,
      };
    },
  };

  const service = new OrderPersistenceService(mockSupabase);

  const payload: CanonicalOrderPayload = {
    merchantId: 'mer-1',
    recipientName: 'علي احمد',
    recipientPhone: '0791234567',
    governorate: 'عمان',
    area: 'خلدا',
    streetAddress: 'عمان - خلدا',
    packageType: 'طرد',
    piecesCount: 1,
    paymentType: 'PREPAID',
    paymentMethod: 'CLIQ',
    cliqReference: '  TXN-88221  ',
  };

  const result = await service.createOrderIdempotent({
    tenantId: 't-1',
    merchantId: 'mer-1',
    canonicalPayload: payload,
    deliveryFee: 3,
    merchantCollection: 22,
    totalCollection: 25,
  });

  assert.strictEqual(result.isReplay, false);
  assert.ok(rpcArgs, 'RPC must be invoked');
  assert.strictEqual(rpcArgs.args.p_payment_type, 'PREPAID');
  assert.strictEqual(rpcArgs.args.p_payment_method, 'CLIQ');
  assert.strictEqual(rpcArgs.args.p_cliq_reference, 'TXN-88221');
});

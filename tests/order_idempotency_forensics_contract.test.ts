import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  OrderPersistenceService,
  OrderPersistenceError,
  type CanonicalOrderPayload,
} from '../src/services/orderPersistenceService.ts';

const serverPath = path.join(process.cwd(), 'server.ts');
const servicePath = path.join(process.cwd(), 'src/services/orderPersistenceService.ts');
const createModalPath = path.join(process.cwd(), 'src/components/CreateOrderModal.tsx');
const quickModalPath = path.join(process.cwd(), 'src/components/QuickOrderModal.tsx');
const appPath = path.join(process.cwd(), 'src/App.tsx');

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8');
}

// ============================================================================
// FORENSIC IDEMPOTENCY & CREATION CHANNELS AUDIT
// ============================================================================

test('01. Standard create (POST /api/orders) calls canonical RPC via orderPersistenceService', () => {
  const code = read(serverPath);
  const routeStart = code.indexOf("app.post('/api/orders',");
  assert.ok(routeStart !== -1, 'POST /api/orders route must exist');
  const routeChunk = code.substring(routeStart, routeStart + 12000);
  assert.ok(
    routeChunk.includes('orderPersistenceService.createOrderIdempotent'),
    'Standard create MUST route through orderPersistenceService.createOrderIdempotent'
  );
});

test('02. Quick create (POST /api/orders/quick) calls canonical RPC via orderPersistenceService', () => {
  const code = read(serverPath);
  const routeStart = code.indexOf("app.post('/api/orders/quick',");
  assert.ok(routeStart !== -1, 'POST /api/orders/quick route must exist');
  const routeChunk = code.substring(routeStart, routeStart + 8000);
  assert.ok(
    routeChunk.includes('orderPersistenceService.createOrderIdempotent'),
    'Quick create MUST route through orderPersistenceService.createOrderIdempotent'
  );
});

test('03. Batch create (POST /api/orders/batch) calls canonical RPC via orderPersistenceService', () => {
  const code = read(serverPath);
  const routeStart = code.indexOf("app.post('/api/orders/batch',");
  assert.ok(routeStart !== -1, 'POST /api/orders/batch route must exist');
  const routeChunk = code.substring(routeStart, routeStart + 8000);
  assert.ok(
    routeChunk.includes('orderPersistenceService.createOrderIdempotent'),
    'Batch create MUST route through orderPersistenceService.createOrderIdempotent'
  );
});

test('04. POS online delivery create (POST /api/merchants/:merchantId/invoices) calls canonical RPC via orderPersistenceService', () => {
  const code = read(serverPath);
  const posStart = code.indexOf("app.post('/api/merchants/:merchantId/invoices',");
  assert.ok(posStart !== -1, 'POST /api/merchants/:merchantId/invoices route must exist');
  const posChunk = code.substring(posStart, posStart + 12000);
  assert.ok(
    posChunk.includes('orderPersistenceService.createOrderIdempotent'),
    'POS online delivery MUST route through orderPersistenceService.createOrderIdempotent'
  );
});

test('05. ZERO production direct shipments table INSERT in server or service files', () => {
  const serverCode = read(serverPath);
  const serviceCode = read(servicePath);
  assert.ok(
    !serverCode.includes(".from('shipments').insert") && !serverCode.includes('.from("shipments").insert'),
    'server.ts must have zero direct shipments insert'
  );
  assert.ok(
    !serviceCode.includes(".from('shipments').insert") && !serviceCode.includes('.from("shipments").insert'),
    'orderPersistenceService.ts must have zero direct shipments insert'
  );
});

test('06. ZERO production orders table/view INSERT in server or service files', () => {
  const serverCode = read(serverPath);
  const serviceCode = read(servicePath);
  assert.ok(
    !serverCode.includes(".from('orders').insert") && !serverCode.includes('.from("orders").insert'),
    'server.ts must have zero direct orders insert'
  );
  assert.ok(
    !serviceCode.includes(".from('orders').insert") && !serviceCode.includes('.from("orders").insert'),
    'orderPersistenceService.ts must have zero direct orders insert'
  );
});

test('07. Non-empty idempotency key reaches service even when client passes null/empty', async () => {
  let capturedArgs: any = null;
  const mockSupabase: any = {
    rpc: async (fnName: string, args: any) => {
      capturedArgs = { fnName, args };
      return {
        data: {
          success: true,
          is_replay: false,
          shipment: { id: 'shp-auto-key-1' },
        },
        error: null,
      };
    },
  };

  const service = new OrderPersistenceService(mockSupabase);
  const payload: CanonicalOrderPayload = {
    merchantId: 'mer-1',
    recipientName: 'طارق عبد الله',
    recipientPhone: '0791112233',
    governorate: 'عمان',
    area: 'الجبيهة',
    streetAddress: 'عمان - الجبيهة',
    packageType: 'طرد ملابس',
    piecesCount: 1,
    paymentType: 'COD',
    paymentMethod: 'CASH',
    totalCollectionInput: 30,
    merchantCollectionInput: 27,
  };

  // Explicitly pass null idempotencyKey
  await service.createOrderIdempotent({
    tenantId: '00000000-0000-0000-0000-000000000001',
    merchantId: 'mer-1',
    idempotencyKey: null,
    canonicalPayload: payload,
    deliveryFee: 3,
    merchantCollection: 27,
    totalCollection: 30,
  });

  assert.ok(capturedArgs, 'RPC must be invoked');
  assert.strictEqual(capturedArgs.fnName, 'create_order_idempotent');
  assert.ok(capturedArgs.args.p_idempotency_key, 'p_idempotency_key must NOT be null or empty');
  assert.ok(typeof capturedArgs.args.p_idempotency_key === 'string' && capturedArgs.args.p_idempotency_key.length > 5, 'p_idempotency_key must be a valid non-empty string');
});

test('08. Explicit client idempotency key is preserved exactly', async () => {
  let capturedArgs: any = null;
  const mockSupabase: any = {
    rpc: async (fnName: string, args: any) => {
      capturedArgs = { fnName, args };
      return {
        data: {
          success: true,
          is_replay: false,
          shipment: { id: 'shp-client-key-1' },
        },
        error: null,
      };
    },
  };

  const service = new OrderPersistenceService(mockSupabase);
  const payload: CanonicalOrderPayload = {
    merchantId: 'mer-1',
    recipientName: 'طارق عبد الله',
    recipientPhone: '0791112233',
    governorate: 'عمان',
    area: 'الجبيهة',
    streetAddress: 'عمان - الجبيهة',
    packageType: 'طرد ملابس',
    piecesCount: 1,
    paymentType: 'COD',
    paymentMethod: 'CASH',
    totalCollectionInput: 30,
    merchantCollectionInput: 27,
  };

  const clientSuppliedKey = 'client-uuid-9999-8888-7777';
  await service.createOrderIdempotent({
    tenantId: '00000000-0000-0000-0000-000000000001',
    merchantId: 'mer-1',
    idempotencyKey: clientSuppliedKey,
    canonicalPayload: payload,
    deliveryFee: 3,
    merchantCollection: 27,
    totalCollection: 30,
  });

  assert.ok(capturedArgs, 'RPC must be invoked');
  assert.strictEqual(capturedArgs.args.p_idempotency_key, clientSuppliedKey, 'Client key must be forwarded verbatim');
});

test('09. Retry with same idempotency key returns isReplay: true without creating second logical order', async () => {
  let callCount = 0;
  const mockSupabase: any = {
    rpc: async (_fnName: string, args: any) => {
      callCount++;
      return {
        data: {
          success: true,
          is_replay: true, // Replay detected by database
          shipment: {
            id: 'shp-original-1234',
            tracking_number: 'TRK-ORIG-001',
            status: 'CREATED',
            recipient_name: 'طارق عبد الله',
          },
        },
        error: null,
      };
    },
  };

  const service = new OrderPersistenceService(mockSupabase);
  const payload: CanonicalOrderPayload = {
    merchantId: 'mer-1',
    recipientName: 'طارق عبد الله',
    recipientPhone: '0791112233',
    governorate: 'عمان',
    area: 'الجبيهة',
    streetAddress: 'عمان - الجبيهة',
    packageType: 'طرد ملابس',
    piecesCount: 1,
    paymentType: 'COD',
    paymentMethod: 'CASH',
    totalCollectionInput: 30,
    merchantCollectionInput: 27,
  };

  const result = await service.createOrderIdempotent({
    tenantId: '00000000-0000-0000-0000-000000000001',
    merchantId: 'mer-1',
    idempotencyKey: 'retry-key-123',
    canonicalPayload: payload,
    deliveryFee: 3,
    merchantCollection: 27,
    totalCollection: 30,
  });

  assert.strictEqual(result.isReplay, true, 'isReplay flag must be true');
  assert.strictEqual(result.shipment.id, 'shp-original-1234', 'Original shipment returned');
  assert.strictEqual(callCount, 1, 'Single RPC call executed');
});

test('10. RPC failure fails closed without memory fallback', async () => {
  const mockSupabase: any = {
    rpc: async () => ({
      data: null,
      error: { message: 'connection failure to database server' },
    }),
  };

  const service = new OrderPersistenceService(mockSupabase);
  const payload: CanonicalOrderPayload = {
    merchantId: 'mer-1',
    recipientName: 'طارق عبد الله',
    recipientPhone: '0791112233',
    governorate: 'عمان',
    area: 'الجبيهة',
    streetAddress: 'عمان - الجبيهة',
    packageType: 'طرد ملابس',
    piecesCount: 1,
    paymentType: 'COD',
    paymentMethod: 'CASH',
    totalCollectionInput: 30,
    merchantCollectionInput: 27,
  };

  await assert.rejects(
    async () => {
      await service.createOrderIdempotent({
        tenantId: '00000000-0000-0000-0000-000000000001',
        merchantId: 'mer-1',
        canonicalPayload: payload,
        deliveryFee: 3,
        merchantCollection: 27,
        totalCollection: 30,
      });
    },
    (err: any) => {
      assert.ok(err instanceof OrderPersistenceError, 'Must throw OrderPersistenceError');
      assert.strictEqual(err.code, 'DB_ERROR', 'Error code must be DB_ERROR');
      assert.strictEqual(err.statusCode, 500, 'Status code must be 500');
      return true;
    }
  );
});

test('11. Idempotency replay mismatch fails closed with 409', async () => {
  const mockSupabase: any = {
    rpc: async () => ({
      data: null,
      error: { message: 'IDEMPOTENCY_REPLAY_MISMATCH: Idempotency key already used with different payload' },
    }),
  };

  const service = new OrderPersistenceService(mockSupabase);
  const payload: CanonicalOrderPayload = {
    merchantId: 'mer-1',
    recipientName: 'طارق عبد الله',
    recipientPhone: '0791112233',
    governorate: 'عمان',
    area: 'الجبيهة',
    streetAddress: 'عمان - الجبيهة',
    packageType: 'طرد ملابس',
    piecesCount: 1,
    paymentType: 'COD',
    paymentMethod: 'CASH',
    totalCollectionInput: 30,
    merchantCollectionInput: 27,
  };

  await assert.rejects(
    async () => {
      await service.createOrderIdempotent({
        tenantId: '00000000-0000-0000-0000-000000000001',
        merchantId: 'mer-1',
        canonicalPayload: payload,
        deliveryFee: 3,
        merchantCollection: 27,
        totalCollection: 30,
      });
    },
    (err: any) => {
      assert.ok(err instanceof OrderPersistenceError, 'Must throw OrderPersistenceError');
      assert.strictEqual(err.code, 'IDEMPOTENCY_PAYLOAD_MISMATCH', 'Code must be IDEMPOTENCY_PAYLOAD_MISMATCH');
      assert.strictEqual(err.statusCode, 409, 'Status code must be 409');
      return true;
    }
  );
});

test('12. UI components generate client idempotency keys on submission', () => {
  const createModalCode = read(createModalPath);
  const quickModalCode = read(quickModalPath);
  const appCode = read(appPath);

  assert.ok(
    createModalCode.includes('idempotencyKey: formSessionKey'),
    'CreateOrderModal attaches client idempotencyKey'
  );
  assert.ok(
    quickModalCode.includes('idempotencyKey: formSessionKey'),
    'QuickOrderModal attaches client idempotencyKey'
  );
  assert.ok(
    appCode.includes("'Idempotency-Key': clientKey"),
    'App.tsx passes Idempotency-Key header on POST /api/orders and POST /api/orders/quick'
  );
});

import test from 'node:test';
import assert from 'node:assert';
import { mapShipmentRowToOrder } from '../../src/services/orderPersistenceService.ts';

test('Adapter maps snake_case to camelCase correctly', () => {
  const row = {
    id: '123',
    sequence: 'SEQ-123',
    tenant_id: 'tenant-1',
    status: 'CREATED',
    payment_type: 'COD',
    merchant_id: 'merch-1',
    recipient_name: 'John Doe',
    recipient_phone: '0791234567',
    governorate: 'Amman',
    area: 'Abdoun',
    address: 'Street 1',
    merchant_collection: '10.50',
    delivery_fee: '2.50',
    cod_amount: '13.00',
    pieces: '3',
    weight: '2.5',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  };

  const order = mapShipmentRowToOrder(row, []);

  assert.strictEqual(order.id, '123');
  assert.strictEqual(order.tenantId, 'tenant-1');
  assert.strictEqual(order.status, 'PENDING');
  assert.strictEqual(order.paymentType, 'COD');
  assert.strictEqual(order.merchantId, 'merch-1');
  assert.strictEqual(order.recipientName, 'John Doe');
  assert.strictEqual(order.merchantCollection, 10.5);
  assert.strictEqual(order.deliveryFee, 2.5);
  assert.strictEqual(order.totalCollection, 13);
  assert.strictEqual(order.piecesCount, 3);
  assert.strictEqual(order.packageWeightKg, 2.5);
});

test('Adapter maps settlement derived fields correctly', () => {
  const row = {
    id: '123',
    status: 'DELIVERED',
    settlement_status: 'SETTLED',
    driver_settlement_id: 'ds-123'
  };

  const order = mapShipmentRowToOrder(row, []);

  assert.strictEqual(order.isSettledWithMerchant, true);
  assert.strictEqual(order.isSettledWithDriver, true);
  assert.strictEqual(order.settlementStatus, 'SETTLED');
});

test('Adapter maps missing optional fields safely', () => {
  const row = {
    id: '123',
    status: 'PENDING'
  };

  const order = mapShipmentRowToOrder(row, []);

  assert.strictEqual(order.merchantCollection, 0);
  assert.strictEqual(order.deliveryFee, 0);
  assert.strictEqual(order.totalCollection, 0);
  assert.strictEqual(order.piecesCount, 1);
  assert.strictEqual(order.packageWeightKg, 1.0);
  assert.strictEqual(order.isSettledWithMerchant, false);
  assert.strictEqual(order.isSettledWithDriver, false);
  assert.strictEqual(order.settlementStatus, 'PENDING');
});

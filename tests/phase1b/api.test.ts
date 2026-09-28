import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const serverCode = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');

test('Phase 1B: POST /api/routes/optimize uses orderPersistenceService and bypasses RAM orders array', () => {
  const endpointMatch = serverCode.match(/app\.post\('\/api\/routes\/optimize',\s*requireAuth,\s*async\s*\(req,\s*res\)\s*=>\s*\{([\s\S]*?)\}\s*\);\s*\/\//);
  assert.ok(endpointMatch, 'Endpoint POST /api/routes/optimize must exist');

  const endpointBody = endpointMatch[1];
  assert.ok(endpointBody.includes('orderPersistenceService.getShipments'), 'Must call orderPersistenceService.getShipments');
  assert.ok(endpointBody.includes('mapShipmentRowToOrder'), 'Must map DB rows using mapShipmentRowToOrder');
  assert.strictEqual(endpointBody.includes('orders.filter'), false, 'Must not use in-memory orders.filter');
  assert.strictEqual(endpointBody.includes('orders.find'), false, 'Must not use in-memory orders.find');
});

test('Phase 1B: GET /api/reports/operational-summary uses orderPersistenceService.getOperationalSummary', () => {
  const endpointMatch = serverCode.match(/app\.get\('\/api\/reports\/operational-summary',\s*requireAuth,\s*async\s*\(req,\s*res\)\s*=>\s*\{([\s\S]*?)\}\s*\);\s*\/\//);
  assert.ok(endpointMatch, 'Endpoint GET /api/reports/operational-summary must exist');

  const endpointBody = endpointMatch[1];
  assert.ok(endpointBody.includes('orderPersistenceService.getOperationalSummary'), 'Must call orderPersistenceService.getOperationalSummary');
  assert.strictEqual(endpointBody.includes('orders.filter'), false, 'Must not use in-memory orders.filter');
});

test('Phase 1B: POST /api/orders/:id/send-sms uses orderPersistenceService.getShipmentById', () => {
  const endpointMatch = serverCode.match(/app\.post\('\/api\/orders\/:id\/send-sms',\s*requireAuth,\s*async\s*\(req,\s*res\)\s*=>\s*\{([\s\S]*?)\}\s*;\s*\/\//);
  assert.ok(endpointMatch, 'Endpoint POST /api/orders/:id/send-sms must exist');

  const endpointBody = endpointMatch[1];
  assert.ok(endpointBody.includes('orderPersistenceService.getShipmentById'), 'Must call orderPersistenceService.getShipmentById');
  assert.ok(endpointBody.includes('mapShipmentRowToOrder'), 'Must map DB row via adapter');
  assert.strictEqual(endpointBody.includes('orders.find'), false, 'Must not use in-memory orders.find');
});

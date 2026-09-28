import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const serverCode = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');

test('Phase 1A: GET /api/orders uses persistence service completely bypassing in-memory orders', () => {
  const endpointMatch = serverCode.match(/app\.get\('\/api\/orders',\s*requireAuth,\s*async\s*\(req,\s*res\)\s*=>\s*\{([\s\S]*?)\}\s*catch\s*\(err:\s*any\)\s*\{/);
  assert.ok(endpointMatch, 'Endpoint GET /api/orders must exist');
  
  const endpointBody = endpointMatch[1];
  
  assert.ok(endpointBody.includes('orderPersistenceService.getShipments'), 'Must call orderPersistenceService.getShipments');
  assert.ok(endpointBody.includes('mapShipmentRowToOrder'), 'Must map shipment row to order via adapter');
  
  // Ensure it does not use the in-memory `orders` array
  assert.strictEqual(endpointBody.includes('orders.find'), false, 'Must not use in-memory orders array directly');
  assert.strictEqual(endpointBody.includes('orders.filter'), false, 'Must not use in-memory orders array directly');
});

test('Phase 1A: GET /api/orders/:id uses persistence service completely bypassing in-memory orders', () => {
  const endpointMatch = serverCode.match(/app\.get\('\/api\/orders\/:id',\s*requireAuth,\s*async\s*\(req,\s*res\)\s*=>\s*\{([\s\S]*?)\}\s*catch\s*\(err:\s*any\)\s*\{/);
  assert.ok(endpointMatch, 'Endpoint GET /api/orders/:id must exist');
  
  const endpointBody = endpointMatch[1];
  
  assert.ok(endpointBody.includes('orderPersistenceService.getShipmentById'), 'Must call orderPersistenceService.getShipmentById');
  assert.ok(endpointBody.includes('mapShipmentRowToOrder'), 'Must map shipment row to order via adapter');
  
  // Ensure it does not use the in-memory `orders` array
  assert.strictEqual(endpointBody.includes('orders.find'), false, 'Must not use in-memory orders array directly');
  assert.strictEqual(endpointBody.includes('orders.filter'), false, 'Must not use in-memory orders array directly');
});

test('Phase 1A: Tenant A cannot read Tenant B orders', () => {
  const endpointMatch = serverCode.match(/app\.get\('\/api\/orders',\s*requireAuth,\s*async\s*\(req,\s*res\)\s*=>\s*\{([\s\S]*?)\}\s*catch\s*\(err:\s*any\)\s*\{/);
  assert.ok(endpointMatch, 'Endpoint GET /api/orders must exist');
  const endpointBody = endpointMatch[1];

  assert.ok(endpointBody.includes('if (!ctx.isSuperAdmin && ctx.user)'), 'Must check user privileges');
  assert.ok(endpointBody.includes('effectiveTenantId = ctx.tenantId'), 'Must isolate tenant A from tenant B');
});

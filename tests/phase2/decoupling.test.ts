import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const serverCode = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');

test('Phase 2B: Operational handlers do not use non-authoritative in-memory orders.find', () => {
  const operationalHandlers = [
    'handleFacilityIntake',
    'handleFacilityRelease',
    'handleInitiateReturn',
    'handleCustomerReturnPickup',
    'handleMerchantReturnReceipt',
  ];

  for (const handlerName of operationalHandlers) {
    const handlerRegex = new RegExp(`const ${handlerName} = async \\(req: express\\.Request, res: express\\.Response\\) => \\{([\\s\\S]*?)\\n\\};`);
    const match = serverCode.match(handlerRegex);
    assert.ok(match, `Operational handler ${handlerName} must exist in server.ts`);

    const handlerBody = match[1];
    assert.strictEqual(
      handlerBody.includes('orders.find'),
      false,
      `Operational handler ${handlerName} must not contain non-authoritative RAM orders.find`
    );
    assert.strictEqual(
      handlerBody.includes('orders.filter'),
      false,
      `Operational handler ${handlerName} must not contain non-authoritative RAM orders.filter`
    );
    assert.strictEqual(
      handlerBody.includes('saveDatabase()'),
      false,
      `Operational handler ${handlerName} must not trigger mock dev saveDatabase()`
    );
  }
});

test('Phase 2B: Operational handlers delegate exclusively to operationalLogisticsService PostgreSQL RPCs', () => {
  assert.ok(serverCode.includes('operationalLogisticsService.confirmFacilityIntake'), 'Facility intake must call operationalLogisticsService');
  assert.ok(serverCode.includes('operationalLogisticsService.confirmFacilityRelease'), 'Facility release must call operationalLogisticsService');
  assert.ok(serverCode.includes('operationalLogisticsService.initiateShipmentReturn'), 'Initiate return must call operationalLogisticsService');
  assert.ok(serverCode.includes('operationalLogisticsService.confirmCustomerReturnPickup'), 'Customer return pickup must call operationalLogisticsService');
  assert.ok(serverCode.includes('operationalLogisticsService.confirmMerchantReturnReceipt'), 'Merchant return receipt must call operationalLogisticsService');
});

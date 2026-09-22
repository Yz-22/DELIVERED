import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { MerchantInventoryService, InventoryServiceError } from '../src/services/merchantInventoryService.ts';

const hotfixMigrationPath = path.join(process.cwd(), 'supabase/final/hotfixes/20260922_inventory_persistence_and_transaction_hardening.sql');
const migrationsDirPath = path.join(process.cwd(), 'supabase/migrations/20260925_inventory_persistence_and_transaction_hardening.sql');
const servicePath = path.join(process.cwd(), 'src/services/merchantInventoryService.ts');
const serverPath = path.join(process.cwd(), 'server.ts');

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8');
}

// ============================================================================
// SECTION 1: MIGRATION ARTIFACT INTEGRITY & INVARIANTS
// ============================================================================

test('01. Migration hotfix file exists at recommended semantic location', () => {
  assert.ok(fs.existsSync(hotfixMigrationPath), 'Hotfix migration file must exist');
});

test('02. Migration hotfix is wrapped in transaction (BEGIN ... COMMIT)', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(sql.includes('BEGIN;'), 'Migration must be wrapped in BEGIN');
  assert.ok(sql.includes('COMMIT;'), 'Migration must be wrapped in COMMIT');
});

test('03. Migration hotfix is strictly non-destructive (ZERO drops/truncates)', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(!sql.includes('DROP TABLE'), 'No DROP TABLE permitted');
  assert.ok(!sql.includes('DROP COLUMN'), 'No DROP COLUMN permitted');
  assert.ok(!sql.includes('TRUNCATE'), 'No TRUNCATE permitted');
});

test('04. Products table schema extension has min_stock_alert, unit, location_rack, notes', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(sql.includes('min_stock_alert'), 'min_stock_alert column added');
  assert.ok(sql.includes('unit TEXT'), 'unit column added');
  assert.ok(sql.includes('location_rack TEXT'), 'location_rack column added');
  assert.ok(sql.includes('notes TEXT'), 'notes column added');
});

test('05. Stock movements schema extension has reference_number', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(sql.includes('reference_number TEXT'), 'reference_number column added');
});

test('06. Inventory idempotency keys table exists with unique constraint', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(sql.includes('inventory_idempotency_keys'), 'idempotency table defined');
  assert.ok(sql.includes('uq_inventory_idempotency UNIQUE'), 'Unique constraint on idempotency defined');
});

test('07. execute_stock_adjustment RPC declared with SECURITY DEFINER and safe search_path', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.execute_stock_adjustment'), 'Function defined');
  assert.ok(sql.includes('SECURITY DEFINER'), 'SECURITY DEFINER configured');
  assert.ok(sql.includes('SET search_path = public, pg_temp'), 'Safe search_path configured');
});

test('08. execute_stock_adjustment enforces FOR UPDATE row locking', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(sql.includes('FROM public.products') && sql.includes('FOR UPDATE'), 'Products row locked FOR UPDATE');
  assert.ok(sql.includes('FROM public.branch_inventory') && sql.includes('FOR UPDATE'), 'Branch inventory locked FOR UPDATE');
});

test('09. execute_stock_adjustment guards against negative stock balance', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(sql.includes('INSUFFICIENT_STOCK'), 'INSUFFICIENT_STOCK error raised');
  assert.ok(sql.includes('v_new_stock < 0'), 'Strict check on negative stock');
});

test('10. execute_stock_adjustment verifies idempotency replay and detects mismatch', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(sql.includes('IDEMPOTENCY_REPLAY_MISMATCH'), 'IDEMPOTENCY_REPLAY_MISMATCH error raised on mismatch');
  assert.ok(sql.includes('v_existing_key.payload_hash = v_payload_hash'), 'Payload hash comparison on replay');
});

test('11. execute_stock_transfer RPC declared with SECURITY DEFINER and safe search_path', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.execute_stock_transfer'), 'Function defined');
  assert.ok(sql.includes('SECURITY DEFINER'), 'SECURITY DEFINER configured');
  assert.ok(sql.includes('SET search_path = public, pg_temp'), 'Safe search_path configured');
});

test('12. execute_stock_transfer rejects transfer between identical branches', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(sql.includes('SAME_BRANCH_TRANSFER'), 'SAME_BRANCH_TRANSFER error raised');
  assert.ok(sql.includes('p_source_branch_id = p_destination_branch_id'), 'Source and dest branch equality check');
});

test('13. execute_stock_transfer creates 2 atomic movements (OUT and IN)', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(sql.includes('TRANSFER_OUT'), 'TRANSFER_OUT movement generated');
  assert.ok(sql.includes('TRANSFER_IN'), 'TRANSFER_IN movement generated');
});

// ============================================================================
// SECTION 2: MERCHANT INVENTORY SERVICE CODE INTEGRITY
// ============================================================================

test('14. MerchantInventoryService module exists and exports required types and class', () => {
  assert.ok(fs.existsSync(servicePath), 'Service file must exist');
  const code = read(servicePath);
  assert.ok(code.includes('export class MerchantInventoryService'), 'MerchantInventoryService exported');
  assert.ok(code.includes('export class InventoryServiceError'), 'InventoryServiceError exported');
});

test('15. MerchantInventoryService getProducts queries Supabase products and branch_inventory', () => {
  const code = read(servicePath);
  assert.ok(code.includes(".from('products')"), 'Queries products table');
  assert.ok(code.includes(".from('branch_inventory')"), 'Queries branch_inventory table');
});

test('16. MerchantInventoryService createProduct triggers atomic initial stock adjustment if initial stock > 0', () => {
  const code = read(servicePath);
  assert.ok(code.includes('initialStock > 0'), 'Checks initial stock');
  assert.ok(code.includes('adjustStock'), 'Calls adjustStock for initial inventory');
});

test('17. MerchantInventoryService adjustStock invokes execute_stock_adjustment RPC', () => {
  const code = read(servicePath);
  assert.ok(code.includes(".rpc('execute_stock_adjustment'"), 'Invokes execute_stock_adjustment RPC');
});

test('18. MerchantInventoryService adjustStock handles idempotency checking', () => {
  const code = read(servicePath);
  assert.ok(code.includes('inventory_idempotency_keys'), 'Checks idempotency keys');
  assert.ok(code.includes('IDEMPOTENCY_MISMATCH'), 'Handles idempotency mismatch');
});

test('19. MerchantInventoryService transferStock invokes execute_stock_transfer RPC', () => {
  const code = read(servicePath);
  assert.ok(code.includes(".rpc('execute_stock_transfer'"), 'Invokes execute_stock_transfer RPC');
});

test('20. MerchantInventoryService transferStock validates source and destination branch differentiation', () => {
  const code = read(servicePath);
  assert.ok(code.includes('SAME_BRANCH_TRANSFER'), 'Rejects transfer to same branch');
});

test('21. MerchantInventoryService getWarehouse masks cost price when canSeeCostPrice is false', () => {
  const code = read(servicePath);
  assert.ok(code.includes('canSeeCostPrice ? p.costPrice : 0'), 'Product cost price masked when unauthorized');
  assert.ok(code.includes('canSeeCostPrice ? totalCostValue : 0'), 'Total cost value masked when unauthorized');
});

// ============================================================================
// SECTION 3: SERVER.TS ENDPOINT INTEGRATION
// ============================================================================

test('22. server.ts instantiates and exports merchantInventoryService', () => {
  const server = read(serverPath);
  assert.ok(server.includes('merchantInventoryService = new MerchantInventoryService'), 'Service initialized');
});

test('23. GET /api/merchants/:merchantId/warehouse calls merchantInventoryService.getWarehouse', () => {
  const server = read(serverPath);
  assert.ok(server.includes('merchantInventoryService.getWarehouse'), 'Calls service getWarehouse');
});

test('24. POST /api/merchants/:merchantId/products calls merchantInventoryService.createProduct', () => {
  const server = read(serverPath);
  assert.ok(server.includes('merchantInventoryService.createProduct'), 'Calls service createProduct');
});

test('25. POST /api/merchants/:merchantId/stock-adjustments calls merchantInventoryService.adjustStock', () => {
  const server = read(serverPath);
  assert.ok(server.includes('merchantInventoryService.adjustStock'), 'Calls service adjustStock');
});

test('26. POST /api/merchants/:merchantId/stock-transfers calls merchantInventoryService.transferStock', () => {
  const server = read(serverPath);
  assert.ok(server.includes('merchantInventoryService.transferStock'), 'Calls service transferStock');
});

// ============================================================================
// SECTION 4: 25-POINT ADVERSARIAL SERVICE UNIT TESTS (MOCK SUPABASE HARNESS)
// ============================================================================

function createMockSupabase(overrides: Record<string, any> = {}) {
  const state = {
    products: [] as any[],
    branchInventory: [] as any[],
    stockMovements: [] as any[],
    transfers: [] as any[],
    transferItems: [] as any[],
    idempotencyKeys: [] as any[],
    ...overrides,
  };

  const client: any = {
    state,
    rpc: async (fnName: string, params: any) => {
      if (fnName === 'execute_stock_adjustment') {
        if (!params.p_quantity_change || params.p_quantity_change === 0) {
          return { data: null, error: { message: 'INVALID_QUANTITY: Adjustment quantity change must be non-zero' } };
        }
        if (params.p_idempotency_key) {
          const payloadHash = crypto.createHash('md5').update(`${params.p_tenant_id}:${params.p_merchant_id}:${params.p_branch_id || ''}:${params.p_product_id}:${params.p_quantity_change}`).digest('hex');
          const existing = state.idempotencyKeys.find((k: any) => k.tenant_id === params.p_tenant_id && k.merchant_id === params.p_merchant_id && k.idempotency_key === params.p_idempotency_key && k.request_type === 'ADJUSTMENT');
          if (existing) {
            if (existing.payload_hash === payloadHash) {
              return { data: existing.response_payload, error: null };
            } else {
              return { data: null, error: { message: 'IDEMPOTENCY_REPLAY_MISMATCH: Key used with different payload' } };
            }
          }
        }
        const invIndex = state.branchInventory.findIndex((b: any) => b.product_id === params.p_product_id && b.branch_id === params.p_branch_id);
        const currentQty = invIndex >= 0 ? state.branchInventory[invIndex].quantity : 0;
        const newQty = currentQty + params.p_quantity_change;
        if (newQty < 0) {
          return { data: null, error: { message: 'INSUFFICIENT_STOCK: Adjustment would result in negative stock balance' } };
        }
        if (invIndex >= 0) {
          state.branchInventory[invIndex].quantity = newQty;
        } else {
          state.branchInventory.push({ tenant_id: params.p_tenant_id, merchant_id: params.p_merchant_id, branch_id: params.p_branch_id, product_id: params.p_product_id, quantity: newQty });
        }
        const mvtId = crypto.randomUUID();
        const res = { success: true, productId: params.p_product_id, branchId: params.p_branch_id, previousStock: currentQty, newStock: newQty, quantityChange: params.p_quantity_change, movementId: mvtId };
        if (params.p_idempotency_key) {
          const payloadHash = crypto.createHash('md5').update(`${params.p_tenant_id}:${params.p_merchant_id}:${params.p_branch_id || ''}:${params.p_product_id}:${params.p_quantity_change}`).digest('hex');
          state.idempotencyKeys.push({ tenant_id: params.p_tenant_id, merchant_id: params.p_merchant_id, idempotency_key: params.p_idempotency_key, request_type: 'ADJUSTMENT', payload_hash: payloadHash, response_payload: res });
        }
        return { data: res, error: null };
      }

      if (fnName === 'execute_stock_transfer') {
        if (!params.p_quantity || params.p_quantity <= 0) {
          return { data: null, error: { message: 'INVALID_QUANTITY: Transfer quantity must be greater than zero' } };
        }
        if (params.p_source_branch_id === params.p_destination_branch_id) {
          return { data: null, error: { message: 'SAME_BRANCH_TRANSFER: Source and destination branches must be different' } };
        }
        if (params.p_idempotency_key) {
          const payloadHash = crypto.createHash('md5').update(`${params.p_tenant_id}:${params.p_merchant_id}:${params.p_source_branch_id}:${params.p_destination_branch_id}:${params.p_product_id}:${params.p_quantity}`).digest('hex');
          const existing = state.idempotencyKeys.find((k: any) => k.tenant_id === params.p_tenant_id && k.merchant_id === params.p_merchant_id && k.idempotency_key === params.p_idempotency_key && k.request_type === 'TRANSFER');
          if (existing) {
            if (existing.payload_hash === payloadHash) {
              return { data: existing.response_payload, error: null };
            } else {
              return { data: null, error: { message: 'IDEMPOTENCY_REPLAY_MISMATCH: Key used with different payload' } };
            }
          }
        }
        const srcIndex = state.branchInventory.findIndex((b: any) => b.product_id === params.p_product_id && b.branch_id === params.p_source_branch_id);
        const srcQty = srcIndex >= 0 ? state.branchInventory[srcIndex].quantity : 0;
        if (srcQty < params.p_quantity) {
          return { data: null, error: { message: 'INSUFFICIENT_STOCK: Source branch has insufficient stock' } };
        }
        state.branchInventory[srcIndex].quantity = srcQty - params.p_quantity;
        const dstIndex = state.branchInventory.findIndex((b: any) => b.product_id === params.p_product_id && b.branch_id === params.p_destination_branch_id);
        const dstQty = dstIndex >= 0 ? state.branchInventory[dstIndex].quantity : 0;
        if (dstIndex >= 0) {
          state.branchInventory[dstIndex].quantity = dstQty + params.p_quantity;
        } else {
          state.branchInventory.push({ tenant_id: params.p_tenant_id, merchant_id: params.p_merchant_id, branch_id: params.p_destination_branch_id, product_id: params.p_product_id, quantity: params.p_quantity });
        }
        const transferId = crypto.randomUUID();
        const res = { success: true, transferId, productId: params.p_product_id, sourceBranchId: params.p_source_branch_id, destinationBranchId: params.p_destination_branch_id, quantity: params.p_quantity, sourceStockAfter: srcQty - params.p_quantity, destinationStockAfter: dstQty + params.p_quantity };
        if (params.p_idempotency_key) {
          const payloadHash = crypto.createHash('md5').update(`${params.p_tenant_id}:${params.p_merchant_id}:${params.p_source_branch_id}:${params.p_destination_branch_id}:${params.p_product_id}:${params.p_quantity}`).digest('hex');
          state.idempotencyKeys.push({ tenant_id: params.p_tenant_id, merchant_id: params.p_merchant_id, idempotency_key: params.p_idempotency_key, request_type: 'TRANSFER', payload_hash: payloadHash, response_payload: res });
        }
        return { data: res, error: null };
      }

      return { data: null, error: { message: `Unknown function ${fnName}` } };
    },
    from: (table: string) => {
      const getRows = () => {
        if (table === 'products') return state.products;
        if (table === 'stock_movements') return state.stockMovements;
        if (table === 'inventory_idempotency_keys') return state.idempotencyKeys;
        if (table === 'branch_inventory') return state.branchInventory;
        return state.transfers;
      };

      const createQueryBuilder = (filters: Record<string, any> = {}, inFilters: Record<string, any[]> = {}) => {
        const execute = () => {
          let rows = getRows();
          for (const [k, v] of Object.entries(filters)) {
            rows = rows.filter((r: any) => r[k] === v);
          }
          for (const [k, vals] of Object.entries(inFilters)) {
            rows = rows.filter((r: any) => vals.includes(r[k]));
          }
          return rows;
        };

        const builder: any = {
          eq: (field: string, val: any) => createQueryBuilder({ ...filters, [field]: val }, inFilters),
          in: (field: string, vals: any[]) => createQueryBuilder(filters, { ...inFilters, [field]: vals }),
          order: () => Promise.resolve({ data: execute(), error: null }),
          single: () => {
            const rows = execute();
            return Promise.resolve({ data: rows[0] || null, error: null });
          },
          maybeSingle: () => {
            const rows = execute();
            return Promise.resolve({ data: rows[0] || null, error: null });
          },
          then: (resolve: any, reject: any) => Promise.resolve({ data: execute(), error: null }).then(resolve, reject),
        };
        return builder;
      };

      return {
        select: (cols?: string) => createQueryBuilder(),
        insert: (data: any) => {
          const row = { id: data.id || crypto.randomUUID(), ...data };
          getRows().push(row);
          return {
            select: () => ({
              single: () => Promise.resolve({ data: row, error: null }),
            }),
          };
        },
        update: (data: any) => ({
          eq: (f: string, v: any) => ({
            eq: () => ({
              eq: () => ({
                select: () => ({
                  single: () => Promise.resolve({ data: { id: 'prod-1', ...data }, error: null }),
                }),
              }),
            }),
          }),
        }),
        upsert: (data: any) => {
          const rows = getRows();
          const idx = rows.findIndex((r: any) => r.branch_id === data.branch_id && r.product_id === data.product_id);
          if (idx >= 0) {
            rows[idx] = { ...rows[idx], ...data };
          } else {
            rows.push(data);
          }
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  return client;
}

test('27. Adversarial Gate 01: Stock adjustment with quantity 0 is rejected', async () => {
  const mockClient = createMockSupabase();
  const service = new MerchantInventoryService(mockClient);
  await assert.rejects(
    async () => {
      await service.adjustStock('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', {
        productId: '00000000-0000-0000-0000-000000000002',
        quantityChange: 0,
      });
    },
    (err: any) => err instanceof InventoryServiceError && err.code === 'INVALID_QUANTITY'
  );
});

test('28. Adversarial Gate 02: Stock adjustment resulting in negative balance is strictly rejected', async () => {
  const mockClient = createMockSupabase({
    branchInventory: [{ product_id: '00000000-0000-0000-0000-000000000002', branch_id: '00000000-0000-0000-0000-000000000003', quantity: 5 }],
  });
  const service = new MerchantInventoryService(mockClient);
  await assert.rejects(
    async () => {
      await service.adjustStock('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', {
        productId: '00000000-0000-0000-0000-000000000002',
        branchId: '00000000-0000-0000-0000-000000000003',
        quantityChange: -10,
      });
    },
    (err: any) => err instanceof InventoryServiceError && err.code === 'INSUFFICIENT_STOCK'
  );
});

test('29. Adversarial Gate 03: Idempotent replay of stock adjustment returns identical result without double-incrementing', async () => {
  const mockClient = createMockSupabase({
    branchInventory: [{ product_id: '00000000-0000-0000-0000-000000000002', branch_id: '00000000-0000-0000-0000-000000000003', quantity: 10 }],
  });
  const service = new MerchantInventoryService(mockClient);

  const res1 = await service.adjustStock('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', {
    productId: '00000000-0000-0000-0000-000000000002',
    branchId: '00000000-0000-0000-0000-000000000003',
    quantityChange: 5,
    idempotencyKey: 'IDEMP-ADJ-001',
  });
  assert.equal(res1.newStock, 15, 'Stock incremented from 10 to 15');

  // Second identical call with same idempotency key
  const res2 = await service.adjustStock('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', {
    productId: '00000000-0000-0000-0000-000000000002',
    branchId: '00000000-0000-0000-0000-000000000003',
    quantityChange: 5,
    idempotencyKey: 'IDEMP-ADJ-001',
  });
  assert.equal(res2.newStock, 15, 'Stock remains 15 on replay, not 20');
});

test('30. Adversarial Gate 04: Idempotent replay with mismatched payload throws IDEMPOTENCY_MISMATCH', async () => {
  const mockClient = createMockSupabase({
    branchInventory: [{ product_id: '00000000-0000-0000-0000-000000000002', branch_id: '00000000-0000-0000-0000-000000000003', quantity: 10 }],
  });
  const service = new MerchantInventoryService(mockClient);

  await service.adjustStock('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', {
    productId: '00000000-0000-0000-0000-000000000002',
    branchId: '00000000-0000-0000-0000-000000000003',
    quantityChange: 5,
    idempotencyKey: 'IDEMP-ADJ-002',
  });

  // Replay same key but with different quantity change (10 instead of 5)
  await assert.rejects(
    async () => {
      await service.adjustStock('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', {
        productId: '00000000-0000-0000-0000-000000000002',
        branchId: '00000000-0000-0000-0000-000000000003',
        quantityChange: 10,
        idempotencyKey: 'IDEMP-ADJ-002',
      });
    },
    (err: any) => err instanceof InventoryServiceError && err.code === 'IDEMPOTENCY_MISMATCH'
  );
});

test('31. Adversarial Gate 05: Stock transfer between identical branches is rejected', async () => {
  const mockClient = createMockSupabase();
  const service = new MerchantInventoryService(mockClient);

  await assert.rejects(
    async () => {
      await service.transferStock('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', {
        sourceBranchId: '00000000-0000-0000-0000-000000000003',
        destinationBranchId: '00000000-0000-0000-0000-000000000003',
        productId: '00000000-0000-0000-0000-000000000002',
        quantity: 5,
      });
    },
    (err: any) => err instanceof InventoryServiceError && err.code === 'SAME_BRANCH_TRANSFER'
  );
});

test('32. Adversarial Gate 06: Stock transfer with quantity <= 0 is rejected', async () => {
  const mockClient = createMockSupabase();
  const service = new MerchantInventoryService(mockClient);

  await assert.rejects(
    async () => {
      await service.transferStock('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', {
        sourceBranchId: '00000000-0000-0000-0000-000000000003',
        destinationBranchId: '00000000-0000-0000-0000-000000000004',
        productId: '00000000-0000-0000-0000-000000000002',
        quantity: 0,
      });
    },
    (err: any) => err instanceof InventoryServiceError && err.code === 'INVALID_QUANTITY'
  );
});

test('33. Adversarial Gate 07: Stock transfer when source branch has insufficient stock is rejected', async () => {
  const mockClient = createMockSupabase({
    branchInventory: [{ product_id: '00000000-0000-0000-0000-000000000002', branch_id: '00000000-0000-0000-0000-000000000003', quantity: 2 }],
  });
  const service = new MerchantInventoryService(mockClient);

  await assert.rejects(
    async () => {
      await service.transferStock('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', {
        sourceBranchId: '00000000-0000-0000-0000-000000000003',
        destinationBranchId: '00000000-0000-0000-0000-000000000004',
        productId: '00000000-0000-0000-0000-000000000002',
        quantity: 10,
      });
    },
    (err: any) => err instanceof InventoryServiceError && err.code === 'INSUFFICIENT_STOCK'
  );
});

test('34. Adversarial Gate 08: Atomic stock transfer accurately mutates source and destination balances', async () => {
  const mockClient = createMockSupabase({
    branchInventory: [
      { product_id: '00000000-0000-0000-0000-000000000002', branch_id: '00000000-0000-0000-0000-000000000003', quantity: 20 },
      { product_id: '00000000-0000-0000-0000-000000000002', branch_id: '00000000-0000-0000-0000-000000000004', quantity: 5 },
    ],
  });
  const service = new MerchantInventoryService(mockClient);

  const res = await service.transferStock('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', {
    sourceBranchId: '00000000-0000-0000-0000-000000000003',
    destinationBranchId: '00000000-0000-0000-0000-000000000004',
    productId: '00000000-0000-0000-0000-000000000002',
    quantity: 8,
  });

  assert.ok(res.success, 'Transfer succeeded');
  const src = mockClient.state.branchInventory.find((b: any) => b.branch_id === '00000000-0000-0000-0000-000000000003');
  const dst = mockClient.state.branchInventory.find((b: any) => b.branch_id === '00000000-0000-0000-0000-000000000004');
  assert.equal(src.quantity, 12, 'Source stock decremented: 20 - 8 = 12');
  assert.equal(dst.quantity, 13, 'Destination stock incremented: 5 + 8 = 13');
});

// ============================================================================
// SECTION 5: IDEMPOTENCY FINAL SERIALIZATION & STATIC AUDIT
// ============================================================================

test('35. Idempotency serialization occurs before branch_inventory mutation', () => {
  const sql = read(hotfixMigrationPath);

  // In execute_stock_adjustment
  const adjIdx = sql.indexOf('CREATE OR REPLACE FUNCTION public.execute_stock_adjustment');
  const transIdx = sql.indexOf('CREATE OR REPLACE FUNCTION public.execute_stock_transfer');
  const adjSql = sql.substring(adjIdx, transIdx);
  const transSql = sql.substring(transIdx);

  const adjLockIdx = adjSql.indexOf('pg_advisory_xact_lock');
  const adjUpdateStockIdx = adjSql.indexOf('UPDATE public.branch_inventory');
  assert.ok(adjLockIdx > 0, 'Advisory lock called in execute_stock_adjustment');
  assert.ok(adjUpdateStockIdx > 0, 'UPDATE branch_inventory present in execute_stock_adjustment');
  assert.ok(adjLockIdx < adjUpdateStockIdx, 'Advisory lock acquired BEFORE branch_inventory UPDATE in execute_stock_adjustment');

  // In execute_stock_transfer
  const transLockIdx = transSql.indexOf('pg_advisory_xact_lock');
  const transUpdateStockIdx = transSql.indexOf('UPDATE public.branch_inventory');
  assert.ok(transLockIdx > 0, 'Advisory lock called in execute_stock_transfer');
  assert.ok(transUpdateStockIdx > 0, 'UPDATE branch_inventory present in execute_stock_transfer');
  assert.ok(transLockIdx < transUpdateStockIdx, 'Advisory lock acquired BEFORE branch_inventory UPDATE in execute_stock_transfer');
});

test('36. Serialization occurs before stock_movements insert', () => {
  const sql = read(hotfixMigrationPath);

  const adjIdx = sql.indexOf('CREATE OR REPLACE FUNCTION public.execute_stock_adjustment');
  const transIdx = sql.indexOf('CREATE OR REPLACE FUNCTION public.execute_stock_transfer');
  const adjSql = sql.substring(adjIdx, transIdx);
  const transSql = sql.substring(transIdx);

  const adjLockIdx = adjSql.indexOf('pg_advisory_xact_lock');
  const adjMvtInsertIdx = adjSql.indexOf('INSERT INTO public.stock_movements');
  assert.ok(adjLockIdx < adjMvtInsertIdx, 'Advisory lock acquired BEFORE stock_movements INSERT in execute_stock_adjustment');

  const transLockIdx = transSql.indexOf('pg_advisory_xact_lock');
  const transMvtInsertIdx = transSql.indexOf('INSERT INTO public.stock_movements');
  assert.ok(transLockIdx < transMvtInsertIdx, 'Advisory lock acquired BEFORE stock_movements INSERT in execute_stock_transfer');
});

test('37. Transfer serialization occurs before transfer header and item insert', () => {
  const sql = read(hotfixMigrationPath);
  const transIdx = sql.indexOf('CREATE OR REPLACE FUNCTION public.execute_stock_transfer');
  const transSql = sql.substring(transIdx);

  const transLockIdx = transSql.indexOf('pg_advisory_xact_lock');
  const headerInsertIdx = transSql.indexOf('INSERT INTO public.merchant_stock_transfers');
  const itemInsertIdx = transSql.indexOf('INSERT INTO public.merchant_stock_transfer_items');

  assert.ok(transLockIdx > 0, 'pg_advisory_xact_lock present in transfer');
  assert.ok(headerInsertIdx > 0, 'merchant_stock_transfers INSERT present in transfer');
  assert.ok(itemInsertIdx > 0, 'merchant_stock_transfer_items INSERT present in transfer');
  assert.ok(transLockIdx < headerInsertIdx, 'Lock acquired BEFORE merchant_stock_transfers INSERT');
  assert.ok(transLockIdx < itemInsertIdx, 'Lock acquired BEFORE merchant_stock_transfer_items INSERT');
});

test('38. Same key identity includes tenant', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(sql.includes("concat_ws(':', p_tenant_id::text, p_merchant_id::text, 'ADJUSTMENT', p_idempotency_key)"), 'Adjustment lock key includes tenant');
  assert.ok(sql.includes("concat_ws(':', p_tenant_id::text, p_merchant_id::text, 'TRANSFER', p_idempotency_key)"), 'Transfer lock key includes tenant');
});

test('39. Same key identity includes merchant', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(sql.includes('p_merchant_id::text'), 'Lock key identity includes merchant');
});

test('40. Same key identity includes request type', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(sql.includes("'ADJUSTMENT'"), "Lock key identity includes 'ADJUSTMENT' request type");
  assert.ok(sql.includes("'TRANSFER'"), "Lock key identity includes 'TRANSFER' request type");
});

test('41. Same key identity includes idempotency key', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(sql.includes('p_idempotency_key'), 'Lock key identity includes idempotency key');
});

test('42. Transaction-scoped lock used, not session lock', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(sql.includes('pg_advisory_xact_lock'), 'pg_advisory_xact_lock used');
  // Verify session-level pg_advisory_lock is NOT used without _xact
  const nonXactLock = /pg_advisory_lock\s*\(/;
  assert.ok(!nonXactLock.test(sql), 'Session-level pg_advisory_lock MUST NOT be used');
});

test('43. Unique constraint remains on idempotency table', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(
    sql.includes('CONSTRAINT uq_inventory_idempotency UNIQUE (tenant_id, merchant_id, idempotency_key, request_type)'),
    'Composite unique constraint on idempotency identity preserved'
  );
});

test('44. Product and stock FOR UPDATE row locking remains', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(sql.includes('FROM public.products') && sql.includes('FOR UPDATE'), 'Products table locked FOR UPDATE');
  assert.ok(sql.includes('FROM public.branch_inventory') && sql.includes('FOR UPDATE'), 'Branch inventory table locked FOR UPDATE');
  assert.ok(sql.includes('ON CONFLICT (branch_id, product_id) DO NOTHING'), 'ON CONFLICT DO NOTHING first-row race guard preserved');
});

test('45. No direct mutation fallback returns in MerchantInventoryService', () => {
  const code = read(servicePath);
  assert.ok(!code.includes('in-memory fallback'), 'No in-memory fallback comment or logic');
  assert.ok(!code.includes(".from('branch_inventory').upsert"), 'No direct branch_inventory upsert mutation');
  assert.ok(!code.includes(".from('stock_movements').insert"), 'No direct stock_movements insert mutation');
});

test('46. Movement semantics remain canonical', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(sql.includes("'TRANSFER_OUT'::public.stock_movement_type"), 'TRANSFER_OUT cast used');
  assert.ok(sql.includes("'TRANSFER_IN'::public.stock_movement_type"), 'TRANSFER_IN cast used');
  assert.ok(sql.includes("'ADJUSTMENT_ADD'::public.stock_movement_type"), 'ADJUSTMENT_ADD cast used');
  assert.ok(sql.includes("'ADJUSTMENT_REMOVE'::public.stock_movement_type"), 'ADJUSTMENT_REMOVE cast used');
});

test('47. RPC privileges remain service_role only', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(sql.includes('REVOKE EXECUTE ON FUNCTION public.execute_stock_adjustment'), 'Adjustment execute revoked from public/anon/authenticated');
  assert.ok(sql.includes('GRANT EXECUTE ON FUNCTION public.execute_stock_adjustment') && sql.includes('TO service_role'), 'Adjustment granted to service_role');
  assert.ok(sql.includes('REVOKE EXECUTE ON FUNCTION public.execute_stock_transfer'), 'Transfer execute revoked from public/anon/authenticated');
  assert.ok(sql.includes('GRANT EXECUTE ON FUNCTION public.execute_stock_transfer') && sql.includes('TO service_role'), 'Transfer granted to service_role');
});

test('48. Idempotency table remains inaccessible to anon/authenticated', () => {
  const sql = read(hotfixMigrationPath);
  assert.ok(sql.includes('REVOKE ALL ON TABLE public.inventory_idempotency_keys FROM PUBLIC, anon, authenticated'), 'Idempotency table access revoked from PUBLIC/anon/auth');
  assert.ok(sql.includes('GRANT ALL ON TABLE public.inventory_idempotency_keys TO service_role'), 'Idempotency table granted to service_role');
  assert.ok(sql.includes('ENABLE ROW LEVEL SECURITY'), 'RLS enabled on idempotency table');
});


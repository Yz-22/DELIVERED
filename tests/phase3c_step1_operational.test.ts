/**
 * DELIVERE — PHASE 3C / STEP 1: OPERATIONAL TRANSACTION ENGINE TESTS
 *
 * Validates domain contracts, read models, scan resolution, leg assignments,
 * privacy sanitization, draft manifests, payment semantics, and atomic transaction blockers.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  OperationalLogisticsService,
  OperationalError,
  type AuthenticatedOperationContext,
} from '../src/services/operationalLogisticsService.ts';

// ============================================================================
// IN-MEMORY SUPABASE MOCK FOR DETERMINISTIC DOMAIN TESTING
// ============================================================================

function createMockSupabase(initialData: Record<string, any[]> = {}) {
  const store: Record<string, any[]> = {
    operational_facilities: initialData.operational_facilities || [],
    user_facility_access: initialData.user_facility_access || [],
    shipment_legs: initialData.shipment_legs || [],
    shipment_leg_assignments: initialData.shipment_leg_assignments || [],
    custody_events: initialData.custody_events || [],
    shipment_current_custody: initialData.shipment_current_custody || [],
    operational_manifests: initialData.operational_manifests || [],
    manifest_items: initialData.manifest_items || [],
    customer_payment_records: initialData.customer_payment_records || [],
    driver_cash_collections: initialData.driver_cash_collections || [],
    shipment_events: initialData.shipment_events || [],
    financial_obligations: initialData.financial_obligations || [],
    users: initialData.users || [],
    shipments: initialData.shipments || [],
  };

  const client: any = {
    from: (table: string) => {
      let rows = [...(store[table] || [])];
      let selectedCols = '*';

      const queryBuilder: any = {
        select: (cols: string = '*') => {
          selectedCols = cols;
          return queryBuilder;
        },
        eq: (col: string, val: any) => {
          rows = rows.filter((r) => r[col] === val);
          return queryBuilder;
        },
        in: (col: string, vals: any[]) => {
          rows = rows.filter((r) => vals.includes(r[col]));
          return queryBuilder;
        },
        or: (conditionsStr: string) => {
          const parts = conditionsStr.split(',');
          rows = rows.filter((r) => {
            return parts.some((p) => {
              const [col, op, val] = p.split('.');
              if (op === 'eq') return r[col] === val;
              return false;
            });
          });
          return queryBuilder;
        },
        order: (col: string, opts?: { ascending?: boolean }) => {
          const asc = opts?.ascending !== false;
          rows.sort((a, b) => (asc ? (a[col] > b[col] ? 1 : -1) : a[col] < b[col] ? 1 : -1));
          return queryBuilder;
        },
        maybeSingle: async () => {
          return { data: rows.length > 0 ? rows[0] : null, error: null };
        },
        single: async () => {
          if (rows.length === 0) return { data: null, error: { message: 'Row not found' } };
          return { data: rows[0], error: null };
        },
        insert: (insertRows: any[]) => {
          const newRows = insertRows.map((r) => ({
            id: r.id || `mock-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            ...r,
          }));
          if (!store[table]) store[table] = [];
          store[table].push(...newRows);
          return {
            select: () => ({
              single: async () => ({ data: newRows[0], error: null }),
            }),
            then: (resolve: any) => resolve({ data: newRows, error: null }),
          };
        },
        update: (updatePayload: any) => {
          return {
            eq: (col: string, val: any) => ({
              eq: (col2: string, val2: any) => {
                rows.forEach((r) => {
                  if (r[col] === val && r[col2] === val2) {
                    Object.assign(r, updatePayload);
                  }
                });
                return Promise.resolve({ data: rows, error: null });
              },
              then: (resolve: any) => {
                rows.forEach((r) => {
                  if (r[col] === val) {
                    Object.assign(r, updatePayload);
                  }
                });
                return resolve({ data: rows, error: null });
              },
            }),
          };
        },
        delete: () => ({
          eq: (col: string, val: any) => ({
            eq: (col2: string, val2: any) => {
              if (store[table]) {
                store[table] = store[table].filter((r) => !(r[col] === val && r[col2] === val2));
              }
              return Promise.resolve({ data: true, error: null });
            },
          }),
        }),
        then: (resolve: any) => resolve({ data: rows, error: null }),
      };

      return queryBuilder;
    },
    rpc: async (fnName: string, _args: any) => {
      // Simulate remote PostgreSQL: Operational RPCs are not yet installed in schema cache
      return {
        data: null,
        error: {
          code: 'PGRST202',
          message: `Could not find the function public.${fnName} without parameters in the schema cache`,
          hint: null,
        },
      };
    },
    _getStore: () => store,
  };

  return client;
}

const mockTenantA = '11111111-1111-1111-1111-111111111111';
const mockTenantB = '22222222-2222-2222-2222-222222222222';
const mockDriverA = 'dddddddd-1111-1111-1111-111111111111';
const mockDriverB = 'dddddddd-2222-2222-2222-222222222222';
const mockAdminA = 'aaaaaaaa-1111-1111-1111-111111111111';
const mockFacilityA = 'ffffffff-1111-1111-1111-111111111111';
const mockShipmentA = 'ssssssss-1111-1111-1111-111111111111';
const mockLegA = 'llllllll-1111-1111-1111-111111111111';

// ============================================================================
// TESTS
// ============================================================================

test('1. Assignment updates shipment_legs and records audit without changing parcel custody', async () => {
  const db = createMockSupabase({
    users: [
      { id: mockDriverA, name: 'سائق تجريبي 1', role: 'DRIVER', tenant_id: mockTenantA, is_active: true },
    ],
    shipment_legs: [
      {
        id: mockLegA,
        shipment_id: mockShipmentA,
        tenant_id: mockTenantA,
        leg_type: 'PICKUP',
        sequence: 1,
        status: 'READY',
        origin_merchant_branch_id: 'bbbbbbbb-1111-1111-1111-111111111111',
        destination_facility_id: mockFacilityA,
      },
    ],
    shipment_current_custody: [
      {
        shipment_id: mockShipmentA,
        tenant_id: mockTenantA,
        current_holder_type: 'MERCHANT',
        current_merchant_branch_id: 'bbbbbbbb-1111-1111-1111-111111111111',
        version: 1,
      },
    ],
  });

  const svc = new OperationalLogisticsService(db);
  const ctx: AuthenticatedOperationContext = {
    actorUserId: mockAdminA,
    tenantId: mockTenantA,
    role: 'ADMIN',
    permissions: ['ASSIGN_ORDERS'],
  };

  const res = await svc.assignLegToDriver(
    { legId: mockLegA, driverId: mockDriverA, notes: 'تعيين صباحي' },
    ctx
  );

  assert.equal(res.success, true);
  assert.equal(res.assignedDriverId, mockDriverA);
  assert.equal(res.status, 'ASSIGNED');

  // Verify custody did NOT mutate
  const store = db._getStore();
  const custody = store.shipment_current_custody[0];
  assert.equal(custody.current_holder_type, 'MERCHANT', 'Assignment must NOT change custody holder');
  assert.equal(custody.current_driver_id, undefined, 'Driver must not have custody yet');
  assert.equal(store.custody_events.length, 0, 'No custody event should be created on assignment');

  // Verify assignment history was recorded
  assert.equal(store.shipment_leg_assignments.length, 1);
  assert.equal(store.shipment_leg_assignments[0].driver_id, mockDriverA);
});

test('2. Wrong tenant access is rejected with TENANT_MISMATCH', async () => {
  const db = createMockSupabase();
  const svc = new OperationalLogisticsService(db);

  // Missing tenantId
  const invalidCtx = { actorUserId: mockAdminA, tenantId: '', role: 'ADMIN', permissions: [] };
  await assert.rejects(
    async () => svc.getShipmentLegs(mockShipmentA, invalidCtx),
    (err: any) => {
      assert.equal(err.code, 'TENANT_MISMATCH');
      return true;
    }
  );
});

test('3. Unauthenticated operation is rejected with UNAUTHENTICATED', async () => {
  const db = createMockSupabase();
  const svc = new OperationalLogisticsService(db);

  await assert.rejects(
    async () => svc.getShipmentLegs(mockShipmentA, null as any),
    (err: any) => {
      assert.equal(err.code, 'UNAUTHENTICATED');
      return true;
    }
  );
});

test('4. Scan resolver resolves barcode, calculates allowedActions server-side, and is strictly read-only', async () => {
  const db = createMockSupabase({
    shipments: [
      {
        id: mockShipmentA,
        sequence: 'DEL-2026-001',
        barcode: 'BC-001',
        merchant_id: 'm1',
        tenant_id: mockTenantA,
        status: 'CREATED',
      },
    ],
    shipment_legs: [
      {
        id: mockLegA,
        shipment_id: mockShipmentA,
        tenant_id: mockTenantA,
        leg_type: 'PICKUP',
        sequence: 1,
        status: 'ASSIGNED',
        assigned_driver_id: mockDriverA,
        origin_merchant_branch_id: 'b1',
        destination_facility_id: mockFacilityA,
      },
    ],
    shipment_current_custody: [
      {
        shipment_id: mockShipmentA,
        tenant_id: mockTenantA,
        current_holder_type: 'MERCHANT',
        version: 1,
      },
    ],
  });

  const svc = new OperationalLogisticsService(db);
  const driverCtx: AuthenticatedOperationContext = {
    actorUserId: mockDriverA,
    tenantId: mockTenantA,
    role: 'DRIVER',
    permissions: [],
  };

  const result = await svc.resolveOperationalScan('BC-001', null, driverCtx);

  assert.equal(result.entityType, 'SHIPMENT');
  assert.equal(result.shipmentId, mockShipmentA);
  assert.equal(result.currentLeg?.id, mockLegA);
  assert.equal(result.currentCustody?.currentHolderType, 'MERCHANT');
  assert.ok(result.allowedActions.includes('CONFIRM_PICKUP'), 'Driver should be allowed to CONFIRM_PICKUP');

  // Verify non-mutating guarantee: custody events and version unchanged
  const store = db._getStore();
  assert.equal(store.custody_events.length, 0, 'Scan resolver must not create custody events');
  assert.equal(store.shipment_current_custody[0].version, 1, 'Version must not be incremented');
});

test('5. Facility access denied when operator lacks user_facility_access', async () => {
  const db = createMockSupabase({
    user_facility_access: [], // No access granted
  });

  const svc = new OperationalLogisticsService(db);
  const operatorCtx: AuthenticatedOperationContext = {
    actorUserId: 'operator-1',
    tenantId: mockTenantA,
    role: 'OPERATOR',
    permissions: [],
  };

  await assert.rejects(
    async () => svc.getFacilityOperationalQueue(mockFacilityA, operatorCtx),
    (err: any) => {
      assert.equal(err.code, 'FACILITY_ACCESS_DENIED');
      return true;
    }
  );
});

test('6. Driver privacy sanitization strips company margins, merchant tariffs, and internal financial snapshots', () => {
  const svc = new OperationalLogisticsService(createMockSupabase());
  const rawLeg = {
    id: 'leg-123',
    shipment_id: 'ship-123',
    sequence: 1,
    leg_type: 'LAST_MILE',
    status: 'IN_TRANSIT',
    assigned_driver_id: mockDriverA,
    origin_facility_id: mockFacilityA,
    destination_is_shipment_customer: true,
    // Sensitive internal data:
    merchant_tariff: 3.5,
    company_revenue: 3.5,
    company_margin: 2.0,
    internal_costs: 1.0,
  };

  const sanitized = svc.sanitizeDriverOperationalView(rawLeg);
  assert.ok(sanitized);
  assert.equal(sanitized.id, 'leg-123');
  assert.equal((sanitized as any).merchant_tariff, undefined);
  assert.equal((sanitized as any).company_revenue, undefined);
  assert.equal((sanitized as any).company_margin, undefined);
  assert.equal((sanitized as any).internal_costs, undefined);
});

test('7. Manifest draft item validation rejects already added parcels', async () => {
  const manifestId = 'mnf-test-1';
  const db = createMockSupabase({
    operational_manifests: [
      {
        id: manifestId,
        tenant_id: mockTenantA,
        manifest_number: 'MNF-001',
        manifest_type: 'HUB_TRANSFER',
        status: 'DRAFT',
        origin_facility_id: mockFacilityA,
        total_items: 1,
        scanned_items_count: 1,
      },
    ],
    shipments: [
      { id: mockShipmentA, sequence: 'DEL-2026-001', barcode: 'BC-001', tenant_id: mockTenantA },
    ],
    shipment_legs: [
      { id: mockLegA, shipment_id: mockShipmentA, tenant_id: mockTenantA, status: 'READY' },
    ],
    manifest_items: [
      { id: 'item-1', manifest_id: manifestId, leg_id: mockLegA, shipment_id: mockShipmentA, tenant_id: mockTenantA },
    ],
  });

  const svc = new OperationalLogisticsService(db);
  const ctx: AuthenticatedOperationContext = {
    actorUserId: mockAdminA,
    tenantId: mockTenantA,
    role: 'ADMIN',
    permissions: [],
  };

  // Adding the same shipment to the draft manifest again must be rejected
  await assert.rejects(
    async () => svc.addManifestItemByScan(manifestId, 'BC-001', ctx),
    (err: any) => {
      assert.equal(err.code, 'DUPLICATE_OPERATION');
      return true;
    }
  );
});

test('8. Cross-tenant manifest addition is strictly rejected', async () => {
  const manifestId = 'mnf-test-tenant-a';
  const db = createMockSupabase({
    operational_manifests: [
      {
        id: manifestId,
        tenant_id: mockTenantA,
        manifest_number: 'MNF-TENANT-A',
        status: 'DRAFT',
      },
    ],
    shipments: [
      { id: 'ship-tenant-b', sequence: 'DEL-TENANT-B', barcode: 'BC-B', tenant_id: mockTenantB },
    ],
  });

  const svc = new OperationalLogisticsService(db);
  const ctxTenantA: AuthenticatedOperationContext = {
    actorUserId: mockAdminA,
    tenantId: mockTenantA,
    role: 'ADMIN',
    permissions: [],
  };

  // Trying to scan a Tenant B parcel into Tenant A manifest
  await assert.rejects(
    async () => svc.addManifestItemByScan(manifestId, 'BC-B', ctxTenantA),
    (err: any) => {
      assert.equal(err.code, 'INVALID_SCAN');
      return true;
    }
  );
});

test('9. ATOMIC TRANSACTION REQUIREMENT: confirmMerchantPickup halts and throws ATOMIC_TRANSACTION_REQUIRED when PostgreSQL RPC is absent', async () => {
  const db = createMockSupabase();
  const svc = new OperationalLogisticsService(db);
  const ctx: AuthenticatedOperationContext = {
    actorUserId: mockDriverA,
    tenantId: mockTenantA,
    role: 'DRIVER',
    permissions: [],
  };

  await assert.rejects(
    async () =>
      svc.confirmMerchantPickup(
        {
          shipmentId: mockShipmentA,
          legId: mockLegA,
          idempotencyKey: 'idem-pickup-01',
          evidenceBarcode: 'BC-001',
        },
        ctx
      ),
    (err: any) => {
      assert.equal(err.code, 'ATOMIC_TRANSACTION_REQUIRED');
      assert.equal(err.httpStatus, 503);
      assert.ok(err.details?.rpcError || err.details?.rpc, 'Must include rpc details');
      return true;
    }
  );
});

test('10. ATOMIC TRANSACTION REQUIREMENT: confirmFacilityIntake halts and throws ATOMIC_TRANSACTION_REQUIRED when PostgreSQL RPC is absent', async () => {
  const db = createMockSupabase({
    user_facility_access: [
      { user_id: mockAdminA, facility_id: mockFacilityA, tenant_id: mockTenantA, can_receive: true },
    ],
  });
  const svc = new OperationalLogisticsService(db);
  const ctx: AuthenticatedOperationContext = {
    actorUserId: mockAdminA,
    tenantId: mockTenantA,
    role: 'ADMIN',
    permissions: [],
  };

  await assert.rejects(
    async () =>
      svc.confirmFacilityIntake(
        {
          shipmentId: mockShipmentA,
          legId: mockLegA,
          facilityId: mockFacilityA,
          driverId: mockDriverA,
          evidenceBarcode: 'BC-001',
          idempotencyKey: 'idem-intake-01',
        },
        ctx
      ),
    (err: any) => {
      assert.equal(err.code, 'ATOMIC_TRANSACTION_REQUIRED');
      assert.equal(err.httpStatus, 503);
      assert.ok(err.details?.rpcError || err.details?.rpc, 'Must include rpc details');
      return true;
    }
  );
});

test('11. ATOMIC TRANSACTION REQUIREMENT: confirmFacilityRelease halts and throws ATOMIC_TRANSACTION_REQUIRED when PostgreSQL RPC is absent', async () => {
  const db = createMockSupabase({
    user_facility_access: [
      { user_id: mockAdminA, facility_id: mockFacilityA, tenant_id: mockTenantA, can_dispatch: true },
    ],
  });
  const svc = new OperationalLogisticsService(db);
  const ctx: AuthenticatedOperationContext = {
    actorUserId: mockAdminA,
    tenantId: mockTenantA,
    role: 'ADMIN',
    permissions: [],
  };

  await assert.rejects(
    async () =>
      svc.confirmFacilityRelease(
        {
          shipmentId: mockShipmentA,
          legId: mockLegA,
          facilityId: mockFacilityA,
          targetDriverId: mockDriverA,
          evidenceBarcode: 'BC-001',
          idempotencyKey: 'idem-release-01',
        },
        ctx
      ),
    (err: any) => {
      assert.equal(err.code, 'ATOMIC_TRANSACTION_REQUIRED');
      assert.equal(err.httpStatus, 503);
      assert.ok(err.details?.rpcError || err.details?.rpc, 'Must include rpc details');
      return true;
    }
  );
});

test('12. ATOMIC TRANSACTION REQUIREMENT: completeCustomerDelivery halts and throws ATOMIC_TRANSACTION_REQUIRED when PostgreSQL RPC is absent', async () => {
  const db = createMockSupabase();
  const svc = new OperationalLogisticsService(db);
  const ctx: AuthenticatedOperationContext = {
    actorUserId: mockDriverA,
    tenantId: mockTenantA,
    role: 'DRIVER',
    permissions: [],
  };

  await assert.rejects(
    async () =>
      svc.completeCustomerDelivery(
        {
          shipmentId: mockShipmentA,
          legId: mockLegA,
          paymentMethod: 'CASH',
          amountExpected: 25.0,
          amountPaid: 25.0,
          idempotencyKey: 'idem-delivery-01',
        },
        ctx
      ),
    (err: any) => {
      assert.equal(err.code, 'ATOMIC_TRANSACTION_REQUIRED');
      assert.equal(err.httpStatus, 503);
      assert.ok(err.details?.rpcError || err.details?.rpc, 'Must include rpc details');
      return true;
    }
  );
});

test('13. Payment validation: CLIQ payment requires cliqReference', async () => {
  const db = createMockSupabase();
  const svc = new OperationalLogisticsService(db);
  const ctx: AuthenticatedOperationContext = {
    actorUserId: mockDriverA,
    tenantId: mockTenantA,
    role: 'DRIVER',
    permissions: [],
  };

  await assert.rejects(
    async () =>
      svc.completeCustomerDelivery(
        {
          shipmentId: mockShipmentA,
          legId: mockLegA,
          paymentMethod: 'CLIQ',
          amountExpected: 30.0,
          amountPaid: 30.0,
          cliqReference: '', // Missing cliq reference
          idempotencyKey: 'idem-cliq-err',
        },
        ctx
      ),
    (err: any) => {
      assert.ok(err.code === 'CLIQ_REFERENCE_REQUIRED' || err.code === 'PAYMENT_MISMATCH');
      return true;
    }
  );
});

test('14. Proposal migration contains all required atomic SECURITY DEFINER RPCs', () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20260922_phase3c_operational_transaction_rpcs.sql'
  );
  assert.ok(fs.existsSync(migrationPath), 'Proposal migration file must exist');

  const content = fs.readFileSync(migrationPath, 'utf8');

  // Verify all 6 required RPCs are defined in the proposal
  assert.ok(content.includes('FUNCTION public.execute_confirm_merchant_pickup'), 'Must define execute_confirm_merchant_pickup');
  assert.ok(content.includes('FUNCTION public.execute_confirm_facility_intake'), 'Must define execute_confirm_facility_intake');
  assert.ok(content.includes('FUNCTION public.execute_confirm_facility_release'), 'Must define execute_confirm_facility_release');
  assert.ok(content.includes('FUNCTION public.execute_complete_customer_delivery'), 'Must define execute_complete_customer_delivery');
  assert.ok(content.includes('FUNCTION public.execute_record_delivery_failure'), 'Must define execute_record_delivery_failure');
  assert.ok(content.includes('FUNCTION public.execute_seal_manifest'), 'Must define execute_seal_manifest');

  // Verify concurrency locking & security definer
  assert.ok(content.includes('SECURITY DEFINER'), 'RPCs must be SECURITY DEFINER');
  assert.ok(content.includes('FOR UPDATE'), 'RPCs must use row-level locking (FOR UPDATE)');
  assert.ok(content.includes('idempotency_key'), 'RPCs must enforce idempotency keys');
});

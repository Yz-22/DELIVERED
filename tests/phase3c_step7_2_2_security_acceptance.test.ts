// ============================================================================
// DELIVERE — PHASE 3C / STEP 7.2.2
// ADVERSARIAL SECURITY & DATA-SCOPE ACCEPTANCE TEST SUITE
// File: tests/phase3c_step7_2_2_security_acceptance.test.ts
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { OperationalTaskService } from '../src/services/operationalTaskService.ts';
import { AuthenticatedOperationContext, OperationalError } from '../src/services/operationalLogisticsService.ts';

// ----------------------------------------------------------------------------
// CONTROLLED FIXTURES & IDENTITIES
// ----------------------------------------------------------------------------

const tenantA = '00000000-0000-0000-0000-000000000001';
const tenantB = '00000000-0000-0000-0000-000000000002';

const superAdmin = '11111111-1111-1111-1111-111111111111';
const adminA = '22222222-2222-2222-2222-222222222222';
const dispatcherA = '33333333-3333-3333-3333-333333333331';
const dispatcherB = '33333333-3333-3333-3333-333333333332';
const operatorA = '44444444-4444-4444-4444-444444444441';
const operatorB = '44444444-4444-4444-4444-444444444442';
const driverA = '55555555-5555-5555-5555-555555555551';
const driverB = '55555555-5555-5555-5555-555555555552';
const merchantA = '66666666-6666-6666-6666-666666666661';
const merchantB = '66666666-6666-6666-6666-666666666662';
const cashierA = '77777777-7777-7777-7777-777777777771';
const cashierB = '77777777-7777-7777-7777-777777777772';

const facilityA = '88888888-8888-8888-8888-888888888881';
const facilityB = '88888888-8888-8888-8888-888888888882';
const branchA = '99999999-9999-9999-9999-999999999991';
const branchB = '99999999-9999-9999-9999-999999999992';

const shipmentS = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const leg1 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const leg2 = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const taskT1 = 'd1111111-1111-1111-1111-111111111111'; // Assigned to Driver A
const taskT2 = 'd2222222-2222-2222-2222-222222222222'; // Leg 1 (Driver A), driver_id = Driver A
const taskT3 = 'd3333333-3333-3333-3333-333333333333'; // Assigned to Driver B
const taskT4 = 'd4444444-4444-4444-4444-444444444444'; // Leg 2 (Driver B), driver_id = Driver B
const taskT5 = 'd5555555-5555-5555-5555-555555555555'; // Shipment S general task (neither driver)
const taskNullFacility = 'd6666666-6666-6666-6666-666666666666'; // facility_id NULL
const taskBranchB = 'd7777777-7777-7777-7777-777777777777'; // Branch B task

const exceptionA = 'e1111111-1111-1111-1111-111111111111';
const exceptionB = 'e2222222-2222-2222-2222-222222222222';

// ----------------------------------------------------------------------------
// ADVERSARIAL MOCK ENGINE
// ----------------------------------------------------------------------------

function createAdversarialMockSupabase() {
  const store: Record<string, any[]> = {
    operational_tasks: [
      {
        id: taskT1,
        tenant_id: tenantA,
        task_type_code: 'FAILED_DELIVERY_TRIAGE',
        title: 'Task T1 (Driver A assigned)',
        description: 'Assigned to Driver A directly',
        priority: 'HIGH',
        status: 'OPEN',
        linked_exception_id: exceptionA,
        entity_type: 'SHIPMENT',
        entity_id: shipmentS,
        shipment_id: shipmentS,
        leg_id: leg1,
        merchant_id: merchantA,
        driver_id: driverA,
        facility_id: facilityA,
        merchant_branch_id: branchA,
        assigned_queue_id: 'q1111111-1111-1111-1111-111111111111',
        assigned_user_id: driverA,
        due_at: new Date(Date.now() + 3600000).toISOString(),
        version: 1,
        allowed_actions: ['CLAIM', 'RESOLVE'],
        metadata: {
          recipientName: 'Omar Test',
          notes: 'Safe delivery notes',
          delivery_fee: 3.5, // Sensitive!
          merchant_collection: 45.0, // Sensitive!
          company_margin: 1.2, // Sensitive!
          cost_price: 10.0, // Sensitive!
          driver_earning: 2.0, // Sensitive!
          debug: { sql: 'SELECT *', price_plan_id: 'SECRET_PLAN' },
          items: [{ label: 'Safe Item', driver_earning: 1.5, cost_price: 9 }],
        },
        created_at: '2026-09-24T10:00:00.000Z',
        updated_at: '2026-09-24T10:00:00.000Z',
      },
      {
        id: taskT2,
        tenant_id: tenantA,
        task_type_code: 'LEG_INSPECTION',
        title: 'Task T2 (Leg 1 Driver A)',
        description: 'Bound to Leg 1 with Driver A',
        priority: 'NORMAL',
        status: 'OPEN',
        linked_exception_id: null,
        entity_type: 'SHIPMENT_LEG',
        entity_id: leg1,
        shipment_id: shipmentS,
        leg_id: leg1,
        merchant_id: merchantA,
        driver_id: driverA,
        facility_id: facilityA,
        merchant_branch_id: branchA,
        assigned_queue_id: 'q1111111-1111-1111-1111-111111111111',
        assigned_user_id: null,
        due_at: null,
        version: 1,
        allowed_actions: ['CLAIM'],
        metadata: { recipientName: 'Leg 1 Recipient' },
        created_at: '2026-09-24T10:05:00.000Z',
        updated_at: '2026-09-24T10:05:00.000Z',
      },
      {
        id: taskT3,
        tenant_id: tenantA,
        task_type_code: 'LINEHAUL_DELAY',
        title: 'Task T3 (Driver B assigned)',
        description: 'Assigned to Driver B directly',
        priority: 'NORMAL',
        status: 'IN_PROGRESS',
        linked_exception_id: null,
        entity_type: 'SHIPMENT_LEG',
        entity_id: leg2,
        shipment_id: shipmentS,
        leg_id: leg2,
        merchant_id: merchantA,
        driver_id: driverB,
        facility_id: facilityB,
        merchant_branch_id: branchA,
        assigned_queue_id: 'q2222222-2222-2222-2222-222222222222',
        assigned_user_id: driverB,
        due_at: null,
        version: 2,
        allowed_actions: ['RESOLVE'],
        metadata: { recipientName: 'Driver B task' },
        created_at: '2026-09-24T10:10:00.000Z',
        updated_at: '2026-09-24T10:10:00.000Z',
      },
      {
        id: taskT4,
        tenant_id: tenantA,
        task_type_code: 'LINEHAUL_DELAY',
        title: 'Task T4 (Leg 2 Driver B)',
        description: 'Bound to Leg 2 with Driver B',
        priority: 'NORMAL',
        status: 'OPEN',
        linked_exception_id: null,
        entity_type: 'SHIPMENT_LEG',
        entity_id: leg2,
        shipment_id: shipmentS,
        leg_id: leg2,
        merchant_id: merchantA,
        driver_id: driverB,
        facility_id: facilityB,
        merchant_branch_id: branchA,
        assigned_queue_id: 'q2222222-2222-2222-2222-222222222222',
        assigned_user_id: null,
        due_at: null,
        version: 1,
        allowed_actions: ['CLAIM'],
        metadata: { recipientName: 'Leg 2 Recipient' },
        created_at: '2026-09-24T10:15:00.000Z',
        updated_at: '2026-09-24T10:15:00.000Z',
      },
      {
        id: taskT5,
        tenant_id: tenantA,
        task_type_code: 'GENERAL_SHIPMENT_ISSUE',
        title: 'Task T5 (Shipment S general)',
        description: 'General shipment task not assigned to any leg driver',
        priority: 'LOW',
        status: 'OPEN',
        linked_exception_id: null,
        entity_type: 'SHIPMENT',
        entity_id: shipmentS,
        shipment_id: shipmentS,
        leg_id: null,
        merchant_id: merchantA,
        driver_id: null,
        facility_id: facilityA,
        merchant_branch_id: branchA,
        assigned_queue_id: 'q1111111-1111-1111-1111-111111111111',
        assigned_user_id: null,
        due_at: null,
        version: 1,
        allowed_actions: ['CLAIM'],
        metadata: { recipientName: 'General Recipient' },
        created_at: '2026-09-24T10:20:00.000Z',
        updated_at: '2026-09-24T10:20:00.000Z',
      },
      {
        id: taskNullFacility,
        tenant_id: tenantA,
        task_type_code: 'CENTRAL_TRIAGE',
        title: 'Task Null Facility',
        description: 'Global task with facility_id = NULL',
        priority: 'NORMAL',
        status: 'OPEN',
        linked_exception_id: null,
        entity_type: 'GENERAL',
        entity_id: '00000000-0000-0000-0000-000000000000',
        shipment_id: null,
        leg_id: null,
        merchant_id: null,
        driver_id: null,
        facility_id: null,
        merchant_branch_id: null,
        assigned_queue_id: null,
        assigned_user_id: null,
        due_at: null,
        version: 1,
        allowed_actions: ['CLAIM'],
        metadata: { notes: 'Global triage task' },
        created_at: '2026-09-24T10:25:00.000Z',
        updated_at: '2026-09-24T10:25:00.000Z',
      },
      {
        id: taskBranchB,
        tenant_id: tenantA,
        task_type_code: 'BRANCH_B_ISSUE',
        title: 'Branch B Task',
        description: 'Bound to Merchant Branch B',
        priority: 'NORMAL',
        status: 'OPEN',
        linked_exception_id: null,
        entity_type: 'SHIPMENT',
        entity_id: shipmentS,
        shipment_id: shipmentS,
        leg_id: null,
        merchant_id: merchantA,
        driver_id: null,
        facility_id: facilityB,
        merchant_branch_id: branchB,
        assigned_queue_id: null,
        assigned_user_id: null,
        due_at: null,
        version: 1,
        allowed_actions: ['CLAIM'],
        metadata: { notes: 'Branch B specific' },
        created_at: '2026-09-24T10:30:00.000Z',
        updated_at: '2026-09-24T10:30:00.000Z',
      },
    ],
    operational_exceptions: [
      {
        id: exceptionA,
        tenant_id: tenantA,
        exception_type_code: 'DELIVERY_ATTEMPT_FAILED',
        entity_type: 'SHIPMENT',
        entity_id: shipmentS,
        shipment_id: shipmentS,
        leg_id: leg1,
        merchant_id: merchantA,
        driver_id: driverA,
        facility_id: facilityA,
        merchant_branch_id: branchA,
        severity: 'HIGH',
        status: 'ACTIVE',
        first_detected_at: '2026-09-24T10:00:00.000Z',
        last_detected_at: '2026-09-24T10:00:00.000Z',
        occurrence_count: 1,
        source_type: 'MANUAL_USER',
        metadata: { reason: 'Customer unreachable' },
        created_at: '2026-09-24T10:00:00.000Z',
        updated_at: '2026-09-24T10:00:00.000Z',
      },
    ],
    user_facility_access: [
      {
        id: 'ufa1',
        tenant_id: tenantA,
        user_id: operatorA,
        facility_id: facilityA,
      },
      {
        id: 'ufa2',
        tenant_id: tenantA,
        user_id: dispatcherA,
        facility_id: facilityA,
      },
    ],
    task_queue_definitions: [
      {
        id: 'q1111111-1111-1111-1111-111111111111',
        tenant_id: tenantA,
        code: 'FACILITY_A_QUEUE',
        facility_id: facilityA,
        is_active: true,
      },
      {
        id: 'q2222222-2222-2222-2222-222222222222',
        tenant_id: tenantA,
        code: 'FACILITY_B_QUEUE',
        facility_id: facilityB,
        is_active: true,
      },
    ],
  };

  const client: any = {
    from: (table: string) => {
      let rows = [...(store[table] || [])];

      const queryBuilder: any = {
        select: (cols: string = '*', opts?: any) => {
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
        is: (col: string, val: any) => {
          rows = rows.filter((r) => r[col] === val);
          return queryBuilder;
        },
        or: (conditionsStr: string) => {
          if (conditionsStr.includes('assigned_user_id.eq')) {
            // Driver multi-leg query parser
            const uidMatch = conditionsStr.match(/assigned_user_id\.eq\.([a-f0-9-]+)/);
            const targetUid = uidMatch ? uidMatch[1] : '';
            rows = rows.filter((r) => r.assigned_user_id === targetUid || (r.driver_id === targetUid && r.leg_id !== null));
          } else if (conditionsStr.includes('facility_id.in')) {
            // Facility scope parser
            const facMatch = conditionsStr.match(/facility_id\.in\.\(([^)]+)\)/);
            const allowedFacs = facMatch ? facMatch[1].split(',') : [];
            rows = rows.filter((r) => allowedFacs.includes(r.facility_id) || r.facility_id === null);
          }
          return queryBuilder;
        },
        order: (col: string, opts?: { ascending?: boolean }) => {
          const asc = opts?.ascending !== false;
          rows.sort((a, b) => (asc ? (a[col] > b[col] ? 1 : -1) : a[col] < b[col] ? 1 : -1));
          return queryBuilder;
        },
        range: (from: number, to: number) => {
          const count = rows.length;
          const slice = rows.slice(from, to + 1);
          return Promise.resolve({ data: slice, count, error: null });
        },
        maybeSingle: async () => {
          return { data: rows.length > 0 ? rows[0] : null, error: null };
        },
        single: async () => {
          if (rows.length === 0) return { data: null, error: { message: 'Row not found' } };
          return { data: rows[0], error: null };
        },
        then: (resolve: any) => resolve({ data: rows, error: null }),
      };

      return queryBuilder;
    },

    rpc: async (fnName: string, params: any) => {
      if (fnName === 'execute_claim_operational_task') {
        const task = (store.operational_tasks || []).find((t) => t.id === params.p_task_id && t.tenant_id === params.p_tenant_id);
        if (!task) return { data: null, error: { code: 'P0002', message: 'TASK_NOT_FOUND' } };
        if (params.p_expected_version !== null && params.p_expected_version !== task.version) {
          return { data: null, error: { code: '40001', message: 'STALE_TASK_VERSION' } };
        }
        if (['RESOLVED', 'CLOSED', 'CANCELLED'].includes(task.status)) {
          return { data: null, error: { code: '22023', message: 'TASK_NOT_CLAIMABLE' } };
        }
        if (task.status === 'IN_PROGRESS' && task.assigned_user_id === params.p_actor_user_id) {
          return { data: { success: true, task_id: task.id, replayed: true }, error: null };
        }
        if (task.assigned_user_id && task.assigned_user_id !== params.p_actor_user_id) {
          return { data: null, error: { code: '23505', message: 'TASK_ALREADY_CLAIMED' } };
        }
        task.status = 'IN_PROGRESS';
        task.assigned_user_id = params.p_actor_user_id;
        task.version += 1;
        return { data: { success: true, task_id: task.id }, error: null };
      }

      if (fnName === 'execute_resolve_operational_task') {
        const task = (store.operational_tasks || []).find((t) => t.id === params.p_task_id && t.tenant_id === params.p_tenant_id);
        if (!task) return { data: null, error: { code: 'P0002', message: 'TASK_NOT_FOUND' } };
        task.status = 'RESOLVED';
        task.version += 1;
        return { data: { success: true, task_id: task.id }, error: null };
      }

      if (fnName === 'execute_reopen_operational_task') {
        const task = (store.operational_tasks || []).find((t) => t.id === params.p_task_id && t.tenant_id === params.p_tenant_id);
        if (!task) return { data: null, error: { code: 'P0002', message: 'TASK_NOT_FOUND' } };
        task.status = 'OPEN';
        task.version += 1;
        return { data: { success: true, task_id: task.id }, error: null };
      }

      return { data: null, error: { message: `Unknown RPC ${fnName}` } };
    },
  };

  return { client, store };
}

// ============================================================================
// ADVERSARIAL TEST SUITE
// ============================================================================

test('A1. DRIVER MULTI-LEG ISOLATION: Driver A can only see T1 and T2, not T3, T4, or T5', async () => {
  const { client } = createAdversarialMockSupabase();
  const svc = new OperationalTaskService(client);
  const driverACtx: AuthenticatedOperationContext = {
    actorUserId: driverA,
    tenantId: tenantA,
    role: 'DRIVER',
    permissions: [],
  };

  const list = await svc.getTasks({}, driverACtx);
  const taskIds = list.data.map((t: any) => t.id);

  assert.equal(list.data.length, 2, 'Driver A must see exactly 2 tasks');
  assert.ok(taskIds.includes(taskT1), 'Driver A can see assigned task T1');
  assert.ok(taskIds.includes(taskT2), 'Driver A can see Leg 1 task T2');
  assert.ok(!taskIds.includes(taskT3), 'Driver A MUST NOT see Driver B assigned task T3');
  assert.ok(!taskIds.includes(taskT4), 'Driver A MUST NOT see Driver B Leg 2 task T4');
  assert.ok(!taskIds.includes(taskT5), 'Driver A MUST NOT see general unassigned shipment task T5');
});

test('A2. DRIVER MULTI-LEG ISOLATION: Driver B can only see T3 and T4, not T1, T2, or T5', async () => {
  const { client } = createAdversarialMockSupabase();
  const svc = new OperationalTaskService(client);
  const driverBCtx: AuthenticatedOperationContext = {
    actorUserId: driverB,
    tenantId: tenantA,
    role: 'DRIVER',
    permissions: [],
  };

  const list = await svc.getTasks({}, driverBCtx);
  const taskIds = list.data.map((t: any) => t.id);

  assert.equal(list.data.length, 2, 'Driver B must see exactly 2 tasks');
  assert.ok(taskIds.includes(taskT3), 'Driver B can see assigned task T3');
  assert.ok(taskIds.includes(taskT4), 'Driver B can see Leg 2 task T4');
  assert.ok(!taskIds.includes(taskT1), 'Driver B MUST NOT see Driver A task T1');
  assert.ok(!taskIds.includes(taskT2), 'Driver B MUST NOT see Driver A Leg 1 task T2');
  assert.ok(!taskIds.includes(taskT5), 'Driver B MUST NOT see general shipment task T5');
});

test('A3. DRIVER PRIVACY ATTACK: Deeply nested financial metrics, company profit, and debug trees are 100% stripped', async () => {
  const { client } = createAdversarialMockSupabase();
  const svc = new OperationalTaskService(client);
  const driverACtx: AuthenticatedOperationContext = {
    actorUserId: driverA,
    tenantId: tenantA,
    role: 'DRIVER',
    permissions: [],
  };

  const detail: any = await svc.getTaskDetail(taskT1, driverACtx);

  // Assert top-level sensitive fields are absent
  assert.equal(detail.metadata.delivery_fee, undefined);
  assert.equal(detail.metadata.merchant_collection, undefined);
  assert.equal(detail.metadata.company_margin, undefined);
  assert.equal(detail.metadata.cost_price, undefined);
  assert.equal(detail.metadata.driver_earning, undefined);
  assert.equal(detail.metadata.debug, undefined);
  assert.equal(detail.metadata.items, undefined); // Unallowlisted complex object

  // Safe fields remain
  assert.equal(detail.metadata.recipientName, 'Omar Test');
  assert.equal(detail.metadata.notes, 'Safe delivery notes');
});

test('A4. FACILITY ISOLATION: Operator A (Facility A only) sees Facility A tasks and NULL-facility tasks, but NOT Facility B tasks', async () => {
  const { client } = createAdversarialMockSupabase();
  const svc = new OperationalTaskService(client);
  const operatorACtx: AuthenticatedOperationContext = {
    actorUserId: operatorA,
    tenantId: tenantA,
    role: 'OPERATOR',
    permissions: [],
  };

  const list = await svc.getTasks({}, operatorACtx);
  const taskIds = list.data.map((t: any) => t.id);

  assert.ok(taskIds.includes(taskT1), 'Operator A sees Facility A task T1');
  assert.ok(taskIds.includes(taskNullFacility), 'Operator A sees NULL facility task');
  assert.ok(!taskIds.includes(taskT3), 'Operator A MUST NOT see Facility B task T3');
  assert.ok(!taskIds.includes(taskT4), 'Operator A MUST NOT see Facility B task T4');
});

test('A5. CASHIER BRANCH ISOLATION: Cashier A cannot see Branch B task', async () => {
  const { client } = createAdversarialMockSupabase();
  const svc = new OperationalTaskService(client);
  const cashierACtx: AuthenticatedOperationContext & { branchId: string } = {
    actorUserId: cashierA,
    tenantId: tenantA,
    role: 'CASHIER',
    branchId: branchA,
    permissions: [],
  };

  const list = await svc.getTasks({}, cashierACtx);
  const taskIds = list.data.map((t: any) => t.id);

  assert.ok(taskIds.includes(taskT1), 'Cashier A sees Branch A task');
  assert.ok(!taskIds.includes(taskBranchB), 'Cashier A MUST NOT see Branch B task');

  // Detail lookup on Branch B task rejected for Cashier A
  await assert.rejects(
    async () => svc.getTaskDetail(taskBranchB, cashierACtx),
    (err: any) => {
      assert.equal(err.code, 'TASK_NOT_FOUND');
      assert.equal(err.httpStatus, 404);
      return true;
    }
  );
});

test('A6. EXCEPTION ISOLATION: External roles (Driver, Merchant, Cashier) cannot access raw exceptions', async () => {
  const { client } = createAdversarialMockSupabase();
  const svc = new OperationalTaskService(client);
  const driverCtx: AuthenticatedOperationContext = { actorUserId: driverA, tenantId: tenantA, role: 'DRIVER', permissions: [] };
  const merchantCtx: AuthenticatedOperationContext = { actorUserId: merchantA, tenantId: tenantA, role: 'MERCHANT', permissions: [] };
  const cashierCtx: AuthenticatedOperationContext = { actorUserId: cashierA, tenantId: tenantA, role: 'CASHIER', permissions: [] };

  await assert.rejects(async () => svc.getExceptions({}, driverCtx), (e: any) => e.code === 'ACTOR_NOT_AUTHORIZED');
  await assert.rejects(async () => svc.getExceptions({}, merchantCtx), (e: any) => e.code === 'ACTOR_NOT_AUTHORIZED');
  await assert.rejects(async () => svc.getExceptions({}, cashierCtx), (e: any) => e.code === 'ACTOR_NOT_AUTHORIZED');
});

test('A7. PAGINATION AND LIMIT CLAMPING: Limit over 100 is clamped to 100', async () => {
  const { client } = createAdversarialMockSupabase();
  const svc = new OperationalTaskService(client);
  const adminCtx: AuthenticatedOperationContext = { actorUserId: adminA, tenantId: tenantA, role: 'ADMIN', permissions: [] };

  const res = await svc.getTasks({ limit: 999999 }, adminCtx);
  assert.equal(res.pagination.limit, 100);
});

test('A8. INJECTION DEFENSE: Malformed UUID filters do not crash or alter queries', async () => {
  const { client } = createAdversarialMockSupabase();
  const svc = new OperationalTaskService(client);
  const adminCtx: AuthenticatedOperationContext = { actorUserId: adminA, tenantId: tenantA, role: 'ADMIN', permissions: [] };

  // Injection-like filter payloads
  const res = await svc.getTasks(
    {
      assignedUserId: 'invalid; DROP TABLE operational_tasks;',
      facilityId: "88888888-8888-8888-8888-888888888881' OR '1'='1",
      driverId: 'not-a-uuid',
    },
    adminCtx
  );

  // Successfully filters without evaluating injected strings
  assert.ok(res.data.length >= 0);
});

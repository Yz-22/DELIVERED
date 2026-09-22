// ============================================================================
// DELIVERE — PHASE 3C / STEP 7.2.1
// OPERATIONAL TASKS & EXCEPTIONS SERVICE & API COMPREHENSIVE TEST SUITE
// File: tests/phase3c_step7_2_1_operational_tasks.test.ts
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { OperationalTaskService } from '../src/services/operationalTaskService.ts';
import { AuthenticatedOperationContext, OperationalError } from '../src/services/operationalLogisticsService.ts';
import app from '../server.ts';

// ----------------------------------------------------------------------------
// TEST FIXTURES & IDENTITIES
// ----------------------------------------------------------------------------

const tenantA = '00000000-0000-0000-0000-000000000001';
const tenantB = '00000000-0000-0000-0000-000000000002';

const superAdminUser = '11111111-1111-1111-1111-111111111111';
const adminUser = '22222222-2222-2222-2222-222222222222';
const dispatcherUser = '33333333-3333-3333-3333-333333333333';
const operatorUser = '44444444-4444-4444-4444-444444444444';
const driverUser1 = '55555555-5555-5555-5555-555555555551';
const driverUser2 = '55555555-5555-5555-5555-555555555552';
const merchantUser1 = '66666666-6666-6666-6666-666666666661';
const merchantUser2 = '66666666-6666-6666-6666-666666666662';
const cashierUser = '77777777-7777-7777-7777-777777777771';

const facilityA = '88888888-8888-8888-8888-888888888881';
const facilityB = '88888888-8888-8888-8888-888888888882';
const branchA = '99999999-9999-9999-9999-999999999991';

const shipment1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const leg1 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const leg2 = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const task1 = 'd1111111-1111-1111-1111-111111111111';
const task2 = 'd2222222-2222-2222-2222-222222222222';
const task3 = 'd3333333-3333-3333-3333-333333333333';
const taskTenantB = 'dbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const exception1 = 'e1111111-1111-1111-1111-111111111111';
const exceptionTenantB = 'ebbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const queue1 = 'faaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const queueFacilityB = 'fbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

// ----------------------------------------------------------------------------
// IN-MEMORY MOCK FOR SUPABASE CLIENT
// ----------------------------------------------------------------------------

function createMockSupabase(overrideData: Record<string, any[]> = {}) {
  const store: Record<string, any[]> = {
    operational_tasks: overrideData.operational_tasks || [
      {
        id: task1,
        tenant_id: tenantA,
        task_type_code: 'FAILED_DELIVERY_TRIAGE',
        title: 'فشل تسليم الشحنة - رقم 1001',
        description: 'العميل لم يرد على الهاتف',
        priority: 'HIGH',
        status: 'OPEN',
        linked_exception_id: exception1,
        entity_type: 'SHIPMENT',
        entity_id: shipment1,
        shipment_id: shipment1,
        leg_id: leg1,
        manifest_id: null,
        merchant_id: merchantUser1,
        driver_id: driverUser1,
        facility_id: facilityA,
        merchant_branch_id: branchA,
        assigned_queue_id: queue1,
        assigned_user_id: null,
        created_by_type: 'SYSTEM',
        created_by_user_id: null,
        due_at: new Date(Date.now() + 3600000).toISOString(),
        sla_minutes_snapshot: 60,
        sla_source_snapshot: 'TYPE_DEFAULT',
        escalation_level: 0,
        opened_at: new Date().toISOString(),
        acknowledged_at: null,
        started_at: null,
        blocked_at: null,
        blocked_reason: null,
        resolved_at: null,
        resolution_code: null,
        resolution_notes: null,
        resolved_by_user_id: null,
        closed_at: null,
        closed_by_user_id: null,
        cancelled_at: null,
        cancelled_by_user_id: null,
        cancellation_reason: null,
        reopen_count: 0,
        version: 1,
        allowed_actions: ['ASSIGN', 'CLAIM', 'START', 'RESOLVE'],
        metadata: {
          recipientName: 'أحمد محمود',
          city: 'عمان',
          area: 'خلدا',
          company_profit: 4.5, // Sensitive!
          merchant_tariff: 3.0, // Sensitive!
          driver_fee: 2.0, // Sensitive!
          internal_diagnostic_code: 'SYS_ERR_99',
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: task2,
        tenant_id: tenantA,
        task_type_code: 'LINEHAUL_DELAY',
        title: 'تأخر نقل مسار الخط الرئيسي',
        description: 'ازدحام مروري على طريق المطار',
        priority: 'NORMAL',
        status: 'IN_PROGRESS',
        linked_exception_id: null,
        entity_type: 'SHIPMENT_LEG',
        entity_id: leg2,
        shipment_id: shipment1,
        leg_id: leg2,
        manifest_id: null,
        merchant_id: merchantUser1,
        driver_id: driverUser2, // Assigned to driver 2
        facility_id: facilityB,
        merchant_branch_id: null,
        assigned_queue_id: queueFacilityB,
        assigned_user_id: driverUser2,
        created_by_type: 'USER',
        created_by_user_id: dispatcherUser,
        due_at: new Date(Date.now() - 3600000).toISOString(), // Overdue
        sla_minutes_snapshot: 120,
        sla_source_snapshot: 'TYPE_DEFAULT',
        escalation_level: 1,
        opened_at: new Date(Date.now() - 7200000).toISOString(),
        acknowledged_at: new Date(Date.now() - 7000000).toISOString(),
        started_at: new Date(Date.now() - 6500000).toISOString(),
        blocked_at: null,
        blocked_reason: null,
        resolved_at: null,
        resolution_code: null,
        resolution_notes: null,
        resolved_by_user_id: null,
        closed_at: null,
        closed_by_user_id: null,
        cancelled_at: null,
        cancelled_by_user_id: null,
        cancellation_reason: null,
        reopen_count: 0,
        version: 2,
        allowed_actions: ['RESOLVE', 'BLOCK'],
        metadata: {
          recipientName: 'شركة النقل',
        },
        created_at: new Date(Date.now() - 7200000).toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: task3,
        tenant_id: tenantA,
        task_type_code: 'ADDRESS_AMBIGUOUS',
        title: 'عنوان غير مكتمل',
        description: 'بحاجة إلى موقع جغرافي دقيق',
        priority: 'LOW',
        status: 'RESOLVED',
        linked_exception_id: null,
        entity_type: 'SHIPMENT',
        entity_id: shipment1,
        shipment_id: shipment1,
        leg_id: null,
        manifest_id: null,
        merchant_id: merchantUser1,
        driver_id: null,
        facility_id: null,
        merchant_branch_id: branchA,
        assigned_queue_id: null,
        assigned_user_id: operatorUser,
        created_by_type: 'SYSTEM',
        created_by_user_id: null,
        due_at: null,
        sla_minutes_snapshot: null,
        sla_source_snapshot: null,
        escalation_level: 0,
        opened_at: new Date(Date.now() - 10000000).toISOString(),
        acknowledged_at: null,
        started_at: null,
        blocked_at: null,
        blocked_reason: null,
        resolved_at: new Date().toISOString(),
        resolution_code: 'ADDRESS_UPDATED',
        resolution_notes: 'تم التواصل مع العميل وتحديث الإحداثيات',
        resolved_by_user_id: operatorUser,
        closed_at: null,
        closed_by_user_id: null,
        cancelled_at: null,
        cancelled_by_user_id: null,
        cancellation_reason: null,
        reopen_count: 0,
        version: 3,
        allowed_actions: ['REOPEN'],
        metadata: {},
        created_at: new Date(Date.now() - 10000000).toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: taskTenantB,
        tenant_id: tenantB,
        task_type_code: 'CROSS_TENANT_TEST',
        title: 'مهمة تابعة لمستأجر آخر',
        description: 'يجب عزل هذه المهمة كلياً عن المستأجر A',
        priority: 'HIGH',
        status: 'OPEN',
        linked_exception_id: exceptionTenantB,
        entity_type: 'GENERAL',
        entity_id: '00000000-0000-0000-0000-000000000000',
        shipment_id: null,
        leg_id: null,
        manifest_id: null,
        merchant_id: null,
        driver_id: null,
        facility_id: null,
        merchant_branch_id: null,
        assigned_queue_id: null,
        assigned_user_id: null,
        created_by_type: 'SYSTEM',
        created_by_user_id: null,
        due_at: null,
        sla_minutes_snapshot: null,
        sla_source_snapshot: null,
        escalation_level: 0,
        opened_at: new Date().toISOString(),
        acknowledged_at: null,
        started_at: null,
        blocked_at: null,
        blocked_reason: null,
        resolved_at: null,
        resolution_code: null,
        resolution_notes: null,
        resolved_by_user_id: null,
        closed_at: null,
        closed_by_user_id: null,
        cancelled_at: null,
        cancelled_by_user_id: null,
        cancellation_reason: null,
        reopen_count: 0,
        version: 1,
        allowed_actions: ['CLAIM'],
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    operational_exceptions: overrideData.operational_exceptions || [
      {
        id: exception1,
        tenant_id: tenantA,
        exception_type_code: 'DELIVERY_ATTEMPT_FAILED',
        entity_type: 'SHIPMENT',
        entity_id: shipment1,
        shipment_id: shipment1,
        leg_id: leg1,
        manifest_id: null,
        merchant_id: merchantUser1,
        driver_id: driverUser1,
        facility_id: facilityA,
        merchant_branch_id: branchA,
        severity: 'HIGH',
        status: 'ACTIVE',
        first_detected_at: new Date().toISOString(),
        last_detected_at: new Date().toISOString(),
        occurrence_count: 1,
        source_type: 'MANUAL_USER',
        source_event_id: null,
        source_rule_code: null,
        resolution_code: null,
        resolution_notes: null,
        resolution_mode: null,
        resolved_by_user_id: null,
        resolved_at: null,
        metadata: { reason: 'Customer unreachable' },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: exceptionTenantB,
        tenant_id: tenantB,
        exception_type_code: 'CROSS_TENANT_EXC',
        entity_type: 'GENERAL',
        entity_id: '00000000-0000-0000-0000-000000000000',
        shipment_id: null,
        leg_id: null,
        manifest_id: null,
        merchant_id: null,
        driver_id: null,
        facility_id: null,
        merchant_branch_id: null,
        severity: 'CRITICAL',
        status: 'ACTIVE',
        first_detected_at: new Date().toISOString(),
        last_detected_at: new Date().toISOString(),
        occurrence_count: 1,
        source_type: 'SYSTEM_DETECTOR',
        source_event_id: null,
        source_rule_code: null,
        resolution_code: null,
        resolution_notes: null,
        resolution_mode: null,
        resolved_by_user_id: null,
        resolved_at: null,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    operational_task_comments: overrideData.operational_task_comments || [
      {
        id: 'c1111111-1111-1111-1111-111111111111',
        task_id: task1,
        tenant_id: tenantA,
        author_user_id: dispatcherUser,
        comment_text: 'ملاحظة داخلية: العميل يطلب إعادة المحاولة غداً صباحاً',
        visibility: 'INTERNAL',
        created_at: new Date().toISOString(),
      },
    ],
    operational_task_events: overrideData.operational_task_events || [
      {
        id: 'e1111111-1111-1111-1111-111111111111',
        task_id: task1,
        tenant_id: tenantA,
        actor_user_id: dispatcherUser,
        actor_role: 'DISPATCHER',
        event_type: 'CREATED',
        old_status: null,
        new_status: 'OPEN',
        old_priority: null,
        new_priority: 'HIGH',
        payload: { source: 'MANUAL_DISPATCH' },
        occurred_at: new Date().toISOString(),
      },
    ],
    task_queue_definitions: overrideData.task_queue_definitions || [
      {
        id: queue1,
        tenant_id: tenantA,
        code: 'AMMAN_DISPATCH_TRIAGE',
        name_ar: 'طابور فرز عمان',
        name_en: 'Amman Triage Queue',
        description_ar: 'المهام الخاصة بمحطة عمان الرئيسية',
        description_en: 'Main hub tasks',
        queue_category: 'HUB',
        facility_id: facilityA,
        merchant_branch_id: null,
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: queueFacilityB,
        tenant_id: tenantA,
        code: 'IRBID_HUB_QUEUE',
        name_ar: 'طابور فرع إربد',
        name_en: 'Irbid Hub Queue',
        description_ar: 'المهام الخاصة بمحطة إربد',
        description_en: 'Irbid hub tasks',
        queue_category: 'HUB',
        facility_id: facilityB,
        merchant_branch_id: null,
        is_active: true,
        created_at: new Date().toISOString(),
      },
    ],
    task_type_definitions: overrideData.task_type_definitions || [
      {
        id: 'taaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        tenant_id: tenantA,
        code: 'FAILED_DELIVERY_TRIAGE',
        name_ar: 'فرز فشل التسليم',
        name_en: 'Failed Delivery Triage',
        description_ar: 'مهمة متابعة فشل التسليم',
        description_en: 'Delivery attempt follow up',
        category: 'DELIVERY',
        default_priority: 'HIGH',
        default_sla_minutes: 60,
        is_active: true,
        created_at: new Date().toISOString(),
      },
    ],
    user_facility_access: overrideData.user_facility_access || [
      {
        id: 'u1111111-1111-1111-1111-111111111111',
        tenant_id: tenantA,
        user_id: operatorUser,
        facility_id: facilityA,
        is_default: true,
        can_dispatch: true,
        can_receive: true,
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
          // Simplified parser for test cases
          if (conditionsStr.includes('assigned_user_id.eq')) {
            rows = rows.filter((r) => r.assigned_user_id === driverUser1 || (r.driver_id === driverUser1 && r.leg_id !== null));
          } else if (conditionsStr.includes('facility_id.in')) {
            rows = rows.filter((r) => r.facility_id === facilityA || r.facility_id === null);
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
        if (!task) {
          return { data: null, error: { code: 'P0002', message: 'TASK_NOT_FOUND' } };
        }
        if (params.p_expected_version !== null && params.p_expected_version !== task.version) {
          return { data: null, error: { code: '40001', message: 'STALE_TASK_VERSION' } };
        }
        if (['RESOLVED', 'CLOSED', 'CANCELLED'].includes(task.status)) {
          return { data: null, error: { code: '22023', message: 'TASK_NOT_CLAIMABLE' } };
        }
        if (task.status === 'IN_PROGRESS' && task.assigned_user_id === params.p_actor_user_id) {
          // Idempotent replay
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
        if (!task) {
          return { data: null, error: { code: 'P0002', message: 'TASK_NOT_FOUND' } };
        }
        task.status = 'RESOLVED';
        task.resolution_code = params.p_resolution_code;
        task.resolution_notes = params.p_resolution_notes;
        task.version += 1;
        return { data: { success: true, task_id: task.id }, error: null };
      }

      if (fnName === 'execute_reopen_operational_task') {
        const task = (store.operational_tasks || []).find((t) => t.id === params.p_task_id && t.tenant_id === params.p_tenant_id);
        if (!task) {
          return { data: null, error: { code: 'P0002', message: 'TASK_NOT_FOUND' } };
        }
        task.status = 'OPEN';
        task.reopen_count += 1;
        task.version += 1;
        return { data: { success: true, task_id: task.id }, error: null };
      }

      if (fnName === 'execute_create_operational_task') {
        const newId = 'dnewwwww-wwww-wwww-wwww-wwwwwwwwwwww';
        const newTask = {
          id: newId,
          tenant_id: params.p_tenant_id,
          task_type_code: params.p_task_type_code,
          title: params.p_title,
          description: params.p_description,
          priority: params.p_priority || 'NORMAL',
          status: 'OPEN',
          entity_type: params.p_entity_type,
          entity_id: params.p_entity_id,
          assigned_user_id: params.p_assigned_user_id,
          version: 1,
          metadata: params.p_metadata || {},
          allowed_actions: ['CLAIM', 'ASSIGN'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        store.operational_tasks.push(newTask);
        return { data: { success: true, task_id: newId }, error: null };
      }

      if (fnName === 'execute_record_operational_exception') {
        const newId = 'enewwwww-wwww-wwww-wwww-wwwwwwwwwwww';
        const newExc = {
          id: newId,
          tenant_id: params.p_tenant_id,
          exception_type_code: params.p_exception_type_code,
          entity_type: params.p_entity_type,
          entity_id: params.p_entity_id,
          severity: params.p_severity || 'NORMAL',
          status: 'ACTIVE',
          metadata: params.p_metadata || {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        store.operational_exceptions.push(newExc);
        return { data: { success: true, exception_id: newId }, error: null };
      }

      if (fnName === 'execute_resolve_operational_exception') {
        const exc = (store.operational_exceptions || []).find((e) => e.id === params.p_exception_id && e.tenant_id === params.p_tenant_id);
        if (!exc) {
          return { data: null, error: { code: 'P0002', message: 'EXCEPTION_NOT_FOUND' } };
        }
        exc.status = 'RESOLVED';
        exc.resolution_code = params.p_resolution_code;
        exc.resolution_notes = params.p_resolution_notes;
        return { data: { success: true, exception_id: exc.id }, error: null };
      }

      return { data: null, error: { message: `Unknown RPC ${fnName}` } };
    },
  };

  return { client, store };
}

// ============================================================================
// TEST SUITE: STEP 7.2.1 REQUIREMENTS
// ============================================================================

test('1. Unauthenticated request is rejected with UNAUTHENTICATED (401)', async () => {
  const { client } = createMockSupabase();
  const svc = new OperationalTaskService(client);
  const unauthCtx: any = { actorUserId: '', tenantId: '' };

  await assert.rejects(
    async () => svc.getTasks({}, unauthCtx),
    (err: any) => {
      assert.equal(err.code, 'UNAUTHENTICATED');
      assert.equal(err.httpStatus, 401);
      return true;
    }
  );
});

test('2. Missing or invalid tenant context is rejected with TENANT_MISMATCH (403)', async () => {
  const { client } = createMockSupabase();
  const svc = new OperationalTaskService(client);
  const badTenantCtx: AuthenticatedOperationContext = {
    actorUserId: dispatcherUser,
    tenantId: 'invalid-non-uuid',
    role: 'DISPATCHER',
    permissions: [],
  };

  await assert.rejects(
    async () => svc.getTasks({}, badTenantCtx),
    (err: any) => {
      assert.equal(err.code, 'TENANT_MISMATCH');
      assert.equal(err.httpStatus, 403);
      return true;
    }
  );
});

test('3. Cross-tenant task detail query is strictly isolated (TASK_NOT_FOUND 404)', async () => {
  const { client } = createMockSupabase();
  const svc = new OperationalTaskService(client);
  const tenantACtx: AuthenticatedOperationContext = {
    actorUserId: dispatcherUser,
    tenantId: tenantA,
    role: 'DISPATCHER',
    permissions: [],
  };

  // Attempt to read a task belonging to Tenant B from Tenant A context
  await assert.rejects(
    async () => svc.getTaskDetail(taskTenantB, tenantACtx),
    (err: any) => {
      assert.equal(err.code, 'TASK_NOT_FOUND');
      assert.equal(err.httpStatus, 404);
      return true;
    }
  );
});

test('4. Cross-tenant exception query is strictly isolated (EXCEPTION_NOT_FOUND 404)', async () => {
  const { client } = createMockSupabase();
  const svc = new OperationalTaskService(client);
  const tenantACtx: AuthenticatedOperationContext = {
    actorUserId: dispatcherUser,
    tenantId: tenantA,
    role: 'DISPATCHER',
    permissions: [],
  };

  // Attempt to read an exception belonging to Tenant B from Tenant A context
  await assert.rejects(
    async () => svc.getExceptionDetail(exceptionTenantB, tenantACtx),
    (err: any) => {
      assert.equal(err.code, 'EXCEPTION_NOT_FOUND');
      assert.equal(err.httpStatus, 404);
      return true;
    }
  );
});

test('5. SUPER_ADMIN must operate in explicit tenant context (no cross-tenant bleed)', async () => {
  const { client } = createMockSupabase();
  const svc = new OperationalTaskService(client);
  const superAdminCtx: AuthenticatedOperationContext = {
    actorUserId: superAdminUser,
    tenantId: tenantA,
    role: 'SUPER_ADMIN',
    isSuperAdmin: true,
    permissions: [],
  };

  const result = await svc.getTasks({}, superAdminCtx);
  // Must ONLY contain tasks from Tenant A
  assert.equal(result.data.length, 3);
  result.data.forEach((task: any) => {
    assert.notEqual(task.id, taskTenantB);
  });
});

test('6. OPERATOR and DISPATCHER facility scoping strictly enforces user_facility_access', async () => {
  const { client } = createMockSupabase();
  const svc = new OperationalTaskService(client);
  const operatorCtx: AuthenticatedOperationContext = {
    actorUserId: operatorUser,
    tenantId: tenantA,
    role: 'OPERATOR',
    permissions: [],
  };

  const queues = await svc.getTaskQueues(operatorCtx);
  // Operator only has access to Facility A, so Facility B queue must not be visible
  assert.equal(queues.length, 1);
  assert.equal(queues[0].facilityId, facilityA);
  assert.equal(queues[0].id, queue1);
});

test('7. DRIVER SCOPE: Driver can only view own assigned tasks or own leg tasks', async () => {
  const { client } = createMockSupabase();
  const svc = new OperationalTaskService(client);
  const driverCtx: AuthenticatedOperationContext = {
    actorUserId: driverUser1,
    tenantId: tenantA,
    role: 'DRIVER',
    permissions: [],
  };

  const result = await svc.getTasks({}, driverCtx);
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].id, task1);

  // Driver 1 attempts to read task 2 belonging to Driver 2 on Leg 2
  await assert.rejects(
    async () => svc.getTaskDetail(task2, driverCtx),
    (err: any) => {
      assert.equal(err.code, 'TASK_NOT_FOUND');
      assert.equal(err.httpStatus, 404);
      return true;
    }
  );
});

test('8. DRIVER PRIVACY: Driver receives ZERO financial fields, margins, or internal tariffs', async () => {
  const { client } = createMockSupabase();
  const svc = new OperationalTaskService(client);
  const driverCtx: AuthenticatedOperationContext = {
    actorUserId: driverUser1,
    tenantId: tenantA,
    role: 'DRIVER',
    permissions: [],
  };

  const taskDetail: any = await svc.getTaskDetail(task1, driverCtx);

  // Assert ZERO financial leaks
  assert.equal(taskDetail.metadata.company_profit, undefined);
  assert.equal(taskDetail.metadata.merchant_tariff, undefined);
  assert.equal(taskDetail.metadata.driver_fee, undefined);
  assert.equal(taskDetail.metadata.internal_diagnostic_code, undefined);

  // Safe delivery fields are retained
  assert.equal(taskDetail.metadata.recipientName, 'أحمد محمود');
  assert.equal(taskDetail.metadata.city, 'عمان');
  assert.equal(taskDetail.metadata.area, 'خلدا');

  // Internal comments and events must NOT be attached to Driver view
  assert.equal(taskDetail.comments, undefined);
  assert.equal(taskDetail.events, undefined);
});

test('9. MERCHANT PRIVACY: Merchant cannot see internal task events or diagnostics', async () => {
  const { client } = createMockSupabase();
  const svc = new OperationalTaskService(client);
  const merchantCtx: AuthenticatedOperationContext = {
    actorUserId: merchantUser1,
    tenantId: tenantA,
    role: 'MERCHANT',
    permissions: [],
  };

  // Raw task events API rejected for merchant
  await assert.rejects(
    async () => svc.getTaskEvents(task1, merchantCtx),
    (err: any) => {
      assert.equal(err.code, 'ACTOR_NOT_AUTHORIZED');
      assert.equal(err.httpStatus, 403);
      return true;
    }
  );

  // Raw exceptions API rejected for merchant
  await assert.rejects(
    async () => svc.getExceptions({}, merchantCtx),
    (err: any) => {
      assert.equal(err.code, 'ACTOR_NOT_AUTHORIZED');
      assert.equal(err.httpStatus, 403);
      return true;
    }
  );
});

test('10. TASK CLAIM: Success transition, same-actor replay, and different-actor conflict', async () => {
  const { client, store } = createMockSupabase();
  const svc = new OperationalTaskService(client);
  const dispatcherCtx: AuthenticatedOperationContext = {
    actorUserId: dispatcherUser,
    tenantId: tenantA,
    role: 'DISPATCHER',
    permissions: [],
  };
  const operatorCtx: AuthenticatedOperationContext = {
    actorUserId: operatorUser,
    tenantId: tenantA,
    role: 'OPERATOR',
    permissions: [],
  };

  // 1. Initial claim on OPEN task1 succeeds
  const claimedTask = await svc.claimTask({ taskId: task1, expectedVersion: 1 }, dispatcherCtx);
  assert.equal(claimedTask.status, 'IN_PROGRESS');
  assert.equal(claimedTask.assignedUserId, dispatcherUser);
  assert.equal(claimedTask.version, 2);

  // 2. Same-actor idempotent replay succeeds
  const replayedTask = await svc.claimTask({ taskId: task1, expectedVersion: 2 }, dispatcherCtx);
  assert.equal(replayedTask.status, 'IN_PROGRESS');
  assert.equal(replayedTask.assignedUserId, dispatcherUser);

  // 3. Different actor conflict raises TASK_ALREADY_CLAIMED (409)
  await assert.rejects(
    async () => svc.claimTask({ taskId: task1, expectedVersion: 2 }, operatorCtx),
    (err: any) => {
      assert.equal(err.code, 'TASK_ALREADY_CLAIMED');
      assert.equal(err.httpStatus, 409);
      return true;
    }
  );
});

test('11. CONCURRENCY: Stale version check returns STALE_TASK_VERSION (409)', async () => {
  const { client } = createMockSupabase();
  const svc = new OperationalTaskService(client);
  const dispatcherCtx: AuthenticatedOperationContext = {
    actorUserId: dispatcherUser,
    tenantId: tenantA,
    role: 'DISPATCHER',
    permissions: [],
  };

  // Task 1 is at version 1, passing expectedVersion: 99
  await assert.rejects(
    async () => svc.claimTask({ taskId: task1, expectedVersion: 99 }, dispatcherCtx),
    (err: any) => {
      assert.equal(err.code, 'STALE_TASK_VERSION');
      assert.equal(err.httpStatus, 409);
      return true;
    }
  );
});

test('12. SUPERVISOR RESTRICTION: Non-supervisor cannot reopen resolved task', async () => {
  const { client } = createMockSupabase();
  const svc = new OperationalTaskService(client);
  const operatorCtx: AuthenticatedOperationContext = {
    actorUserId: operatorUser,
    tenantId: tenantA,
    role: 'OPERATOR',
    permissions: [],
  };
  const adminCtx: AuthenticatedOperationContext = {
    actorUserId: adminUser,
    tenantId: tenantA,
    role: 'ADMIN',
    permissions: [],
  };

  // Operator cannot reopen
  await assert.rejects(
    async () => svc.reopenTask({ taskId: task3, reopenReason: 'إعادة فتح لمزيد من الفحص' }, operatorCtx),
    (err: any) => {
      assert.equal(err.code, 'SUPERVISOR_ROLE_REQUIRED');
      assert.equal(err.httpStatus, 403);
      return true;
    }
  );

  // Admin can reopen
  const reopened = await svc.reopenTask({ taskId: task3, reopenReason: 'إعادة فتح بواسطة المشرف' }, adminCtx);
  assert.equal(reopened.status, 'OPEN');
  assert.equal(reopened.reopenCount, 1);
});

test('13. TASK RESOLUTION INDEPENDENCE: Resolving a task does not auto-resolve linked exception', async () => {
  const { client, store } = createMockSupabase();
  const svc = new OperationalTaskService(client);
  const dispatcherCtx: AuthenticatedOperationContext = {
    actorUserId: dispatcherUser,
    tenantId: tenantA,
    role: 'DISPATCHER',
    permissions: [],
  };

  // Resolve task1 which has linked exception1
  await svc.resolveTask({ taskId: task1, resolutionCode: 'CUSTOMER_CONTACTED', resolutionNotes: 'تم الاتفاق على موعد جديد' }, dispatcherCtx);

  const taskRow = store.operational_tasks.find((t) => t.id === task1);
  assert.equal(taskRow.status, 'RESOLVED');

  // Verify linked exception1 is still ACTIVE
  const excRow = store.operational_exceptions.find((e) => e.id === exception1);
  assert.equal(excRow.status, 'ACTIVE');
});

test('14. ATTENTION SUMMARY: Persistent aggregation without double-counting linked issues', async () => {
  const { client } = createMockSupabase();
  const svc = new OperationalTaskService(client);
  const adminCtx: AuthenticatedOperationContext = {
    actorUserId: adminUser,
    tenantId: tenantA,
    role: 'ADMIN',
    permissions: [],
  };

  const summary = await svc.getAttentionSummary(adminCtx);

  assert.equal(summary.activeExceptionsCount, 1); // exception1
  assert.equal(summary.openTasksCount, 2); // task1 (OPEN) & task2 (IN_PROGRESS)
  assert.equal(summary.unassignedTasksCount, 1); // task1
  assert.equal(summary.overdueTasksCount, 1); // task2 is overdue

  // Task1 is linked to exception1. Unified attention count must NOT double count them!
  // Active exception1 (1) + Task2 (1) = 2 unified issues
  assert.equal(summary.needsAttentionUnifiedCount, 2);
});

test('15. ALIAS ROUTE PARITY: Express router registers identical handlers for /api/operational and /api/operations task & exception endpoints', () => {
  const routes = (app._router.stack || [])
    .filter((r: any) => r.route && typeof r.route.path === 'string')
    .map((r: any) => ({
      path: r.route.path,
      methods: Object.keys(r.route.methods),
    }));

  const operationalPaths = routes.filter((r: any) => r.path.startsWith('/api/operational/'));
  const operationsPaths = routes.filter((r: any) => r.path.startsWith('/api/operations/'));

  const expectedSuffixes = [
    'tasks',
    'tasks/:id',
    'tasks/:id/events',
    'exceptions',
    'exceptions/:id',
    'task-queues',
    'task-types',
    'attention-summary',
    'tasks/:id/claim',
    'tasks/:id/assign',
    'tasks/:id/state',
    'tasks/:id/resolve',
    'tasks/:id/reopen',
    'exceptions/:id/resolve',
  ];

  for (const suffix of expectedSuffixes) {
    const hasOp1 = operationalPaths.some((r: any) => r.path === `/api/operational/${suffix}`);
    const hasOp2 = operationsPaths.some((r: any) => r.path === `/api/operations/${suffix}`);
    assert.ok(hasOp1, `Missing /api/operational/${suffix}`);
    assert.ok(hasOp2, `Missing /api/operations/${suffix}`);
  }
});

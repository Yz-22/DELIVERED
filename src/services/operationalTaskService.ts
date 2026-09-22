// ============================================================================
// DELIVERE — PHASE 3C / STEP 7.2.1
// OPERATIONAL TASKS & EXCEPTIONS BACKEND SERVICE
// File: src/services/operationalTaskService.ts
// ============================================================================

import { SupabaseClient } from '@supabase/supabase-js';
import { AuthenticatedOperationContext, OperationalError, parseRpcError } from './operationalLogisticsService.js';
import {
  TaskListFilters,
  ExceptionListFilters,
  PaginatedResult,
  InternalTaskDTO,
  DriverTaskDTO,
  MerchantSafeTaskDTO,
  TaskDetailDTO,
  TaskCommentDTO,
  TaskEventDTO,
  InternalExceptionDTO,
  TaskQueueDefinitionDTO,
  TaskTypeDefinitionDTO,
  AttentionSummaryDTO,
  CreateTaskParams,
  ClaimTaskParams,
  AssignTaskParams,
  UpdateTaskStateParams,
  ResolveTaskParams,
  ReopenTaskParams,
  RecordExceptionParams,
  ResolveExceptionParams,
  ExceptionSeverity,
} from '../types/operationalTasks.js';

// UUID validation helper
function isValidUuid(id: any): boolean {
  if (typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// ----------------------------------------------------------------------------
// METADATA & FINANCIAL SANITIZERS (STRICT ALLOWLISTS)
// ----------------------------------------------------------------------------

const DRIVER_METADATA_ALLOWLIST = new Set([
  'notes',
  'recipientName',
  'recipientPhone',
  'city',
  'area',
  'streetAddress',
  'deliveryWindow',
  'specialInstructions',
  'trackingNumber',
  'referenceCode',
]);

const MERCHANT_METADATA_ALLOWLIST = new Set([
  'notes',
  'merchantNotes',
  'recipientName',
  'trackingNumber',
  'itemCount',
  'category',
]);

function sanitizeDriverMetadata(rawMetadata: any): Record<string, any> {
  if (!rawMetadata || typeof rawMetadata !== 'object') return {};
  const clean: Record<string, any> = {};
  for (const key of Object.keys(rawMetadata)) {
    if (DRIVER_METADATA_ALLOWLIST.has(key)) {
      clean[key] = rawMetadata[key];
    }
  }
  return clean;
}

function sanitizeMerchantMetadata(rawMetadata: any): Record<string, any> {
  if (!rawMetadata || typeof rawMetadata !== 'object') return {};
  const clean: Record<string, any> = {};
  for (const key of Object.keys(rawMetadata)) {
    if (MERCHANT_METADATA_ALLOWLIST.has(key)) {
      clean[key] = rawMetadata[key];
    }
  }
  return clean;
}

function sanitizeInternalMetadata(rawMetadata: any): Record<string, any> {
  if (!rawMetadata || typeof rawMetadata !== 'object') return {};
  const clean: Record<string, any> = {};
  for (const key of Object.keys(rawMetadata)) {
    // Drop raw stack traces or internal secrets if any
    if (key !== 'stack' && key !== 'sql' && key !== 'dbInternal') {
      clean[key] = rawMetadata[key];
    }
  }
  return clean;
}

export class OperationalTaskService {
  constructor(private readonly supabase: SupabaseClient) {}

  // --------------------------------------------------------------------------
  // CENTRALIZED AUTHORIZATION & SCOPE HELPERS
  // --------------------------------------------------------------------------

  public validateContext(ctx: AuthenticatedOperationContext): void {
    if (!ctx || !ctx.actorUserId) {
      throw new OperationalError('UNAUTHENTICATED', 'يجب تسجيل الدخول للوصول إلى هذه الواجهة.', 401);
    }
    if (!ctx.tenantId || !isValidUuid(ctx.tenantId)) {
      throw new OperationalError('TENANT_MISMATCH', 'معرّف المستأجر مفقود أو غير صالح في سياق الجلسة.', 403);
    }
  }

  public isInternalOperationalRole(role: string): boolean {
    return ['SUPER_ADMIN', 'ADMIN', 'DISPATCHER', 'OPERATOR'].includes(role);
  }

  public assertInternalOperationalAccess(ctx: AuthenticatedOperationContext, actionDescription: string = 'العملية'): void {
    this.validateContext(ctx);
    if (!this.isInternalOperationalRole(ctx.role)) {
      throw new OperationalError(
        'ACTOR_NOT_AUTHORIZED',
        `غير مصرح بتنفيذ ${actionDescription}: هذه العملية محصورة بالطاقم التشغيلي للنظام.`,
        403
      );
    }
  }

  public assertSupervisorAccess(ctx: AuthenticatedOperationContext, actionDescription: string = 'إعادة فتح المهمة'): void {
    this.validateContext(ctx);
    if (!ctx.isSuperAdmin && ctx.role !== 'ADMIN') {
      throw new OperationalError(
        'SUPERVISOR_ROLE_REQUIRED',
        `غير مصرح بتنفيذ ${actionDescription}: هذه العملية تتطلب صلاحية مدير عمليات أو مشرف النظام.`,
        403
      );
    }
  }

  /**
   * Fetches authorized facility IDs for the actor if not SUPER_ADMIN or ADMIN.
   */
  public async getAuthorizedFacilityIds(ctx: AuthenticatedOperationContext): Promise<string[] | 'ALL'> {
    this.validateContext(ctx);
    if (ctx.isSuperAdmin || ctx.role === 'ADMIN') {
      return 'ALL';
    }

    const { data, error } = await this.supabase
      .from('user_facility_access')
      .select('facility_id')
      .eq('user_id', ctx.actorUserId)
      .eq('tenant_id', ctx.tenantId);

    if (error || !data || data.length === 0) {
      return [];
    }
    return data.map((r: any) => r.facility_id);
  }

  // --------------------------------------------------------------------------
  // READ MODELS
  // --------------------------------------------------------------------------

  /**
   * GET /api/operational/tasks & /api/operations/tasks
   * Server-side paginated, tenant-bound, role-scoped task listing.
   */
  async getTasks(
    filters: TaskListFilters,
    ctx: AuthenticatedOperationContext
  ): Promise<PaginatedResult<InternalTaskDTO | DriverTaskDTO | MerchantSafeTaskDTO>> {
    this.validateContext(ctx);

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 25));
    const offset = (page - 1) * limit;

    // 1. Build authoritative query strictly scoped to tenant_id
    let query = this.supabase
      .from('operational_tasks')
      .select(
        `
        id,
        task_type_id,
        task_type_code,
        title,
        description,
        priority,
        status,
        linked_exception_id,
        entity_type,
        entity_id,
        shipment_id,
        leg_id,
        manifest_id,
        merchant_id,
        driver_id,
        facility_id,
        merchant_branch_id,
        assigned_queue_id,
        assigned_user_id,
        created_by_type,
        created_by_user_id,
        due_at,
        sla_minutes_snapshot,
        sla_source_snapshot,
        escalation_level,
        opened_at,
        acknowledged_at,
        started_at,
        blocked_at,
        blocked_reason,
        resolved_at,
        resolution_code,
        resolution_notes,
        resolved_by_user_id,
        closed_at,
        closed_by_user_id,
        cancelled_at,
        cancelled_by_user_id,
        cancellation_reason,
        reopen_count,
        version,
        allowed_actions,
        metadata,
        created_at,
        updated_at
      `,
        { count: 'exact' }
      )
      .eq('tenant_id', ctx.tenantId);

    // 2. Apply Role Data Scope Boundaries
    if (ctx.role === 'DRIVER') {
      // Driver scope: assigned directly to driver OR leg-specific task for driver
      query = query.or(
        `assigned_user_id.eq.${ctx.actorUserId},and(driver_id.eq.${ctx.actorUserId},leg_id.not.is.null)`
      );
    } else if (ctx.role === 'MERCHANT') {
      // Merchant scope: tasks referencing merchant's owned account
      query = query.eq('merchant_id', ctx.actorUserId);
    } else if (ctx.role === 'CASHIER') {
      // Cashier scope: restricted to own assigned branch
      const assignedBranchId = (ctx as any).branchId;
      if (assignedBranchId) {
        query = query.eq('merchant_branch_id', assignedBranchId);
      } else {
        // Cashier with no assigned branch sees nothing
        return {
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0, hasMore: false },
        };
      }
    } else if (['OPERATOR', 'DISPATCHER'].includes(ctx.role)) {
      // Operators / Dispatchers: verify facility scope if filtering by facility
      const authorizedFacilities = await this.getAuthorizedFacilityIds(ctx);
      if (authorizedFacilities !== 'ALL') {
        if (authorizedFacilities.length === 0) {
          // Unassigned operator sees only non-facility-bound tasks
          query = query.is('facility_id', null);
        } else {
          // Can see tasks bound to authorized facilities or global hub tasks
          query = query.or(`facility_id.in.(${authorizedFacilities.join(',')}),facility_id.is.null`);
        }
      }
    } else if (!this.isInternalOperationalRole(ctx.role)) {
      // Any unsupported external role fails closed
      throw new OperationalError('ACTOR_NOT_AUTHORIZED', 'الدور الحالي غير مصرح له باستعراض المهام التشغيلية.', 403);
    }

    // 3. User Filter Application (Allowlisted fields only)
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query = query.in('status', filters.status);
      } else {
        query = query.eq('status', filters.status);
      }
    }

    if (filters.priority) {
      if (Array.isArray(filters.priority)) {
        query = query.in('priority', filters.priority);
      } else {
        query = query.eq('priority', filters.priority);
      }
    }

    if (filters.assignedToMe) {
      query = query.eq('assigned_user_id', ctx.actorUserId);
    } else if (filters.assignedUserId && isValidUuid(filters.assignedUserId)) {
      query = query.eq('assigned_user_id', filters.assignedUserId);
    }

    if (filters.assignedQueueId && isValidUuid(filters.assignedQueueId)) {
      query = query.eq('assigned_queue_id', filters.assignedQueueId);
    }

    if (filters.shipmentId && isValidUuid(filters.shipmentId)) {
      query = query.eq('shipment_id', filters.shipmentId);
    }

    if (filters.legId && isValidUuid(filters.legId)) {
      query = query.eq('leg_id', filters.legId);
    }

    if (filters.driverId && isValidUuid(filters.driverId) && ctx.role !== 'DRIVER') {
      query = query.eq('driver_id', filters.driverId);
    }

    if (filters.merchantId && isValidUuid(filters.merchantId) && ctx.role !== 'MERCHANT') {
      query = query.eq('merchant_id', filters.merchantId);
    }

    if (filters.facilityId && isValidUuid(filters.facilityId)) {
      query = query.eq('facility_id', filters.facilityId);
    }

    if (filters.merchantBranchId && isValidUuid(filters.merchantBranchId)) {
      query = query.eq('merchant_branch_id', filters.merchantBranchId);
    }

    if (filters.linkedExceptionId && isValidUuid(filters.linkedExceptionId)) {
      query = query.eq('linked_exception_id', filters.linkedExceptionId);
    }

    if (filters.entityType) {
      query = query.eq('entity_type', filters.entityType);
    }

    if (filters.entityId && isValidUuid(filters.entityId)) {
      query = query.eq('entity_id', filters.entityId);
    }

    // 4. Deterministic Ordering & Pagination
    query = query.order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + limit - 1);

    const { data: rows, count, error } = await query;

    if (error) {
      throw new OperationalError('QUERY_FAILED', `خطأ في قراءة قائمة المهام: ${error.message}`, 500);
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    // 5. Serialize into Role-Safe DTOs
    const safeData = (rows || []).map((row: any) => this.mapTaskToRoleDto(row, ctx));

    return {
      data: safeData,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  /**
   * GET /api/operational/tasks/:id & /api/operations/tasks/:id
   * Detailed task view with linked exception summary, comments, and allowed actions.
   */
  async getTaskDetail(taskId: string, ctx: AuthenticatedOperationContext): Promise<TaskDetailDTO | DriverTaskDTO | MerchantSafeTaskDTO> {
    this.validateContext(ctx);

    if (!taskId || !isValidUuid(taskId)) {
      throw new OperationalError('INVALID_PAYLOAD', 'معرّف المهمة غير صالح', 400);
    }

    // 1. Fetch Task Row strictly within Tenant
    const { data: task, error } = await this.supabase
      .from('operational_tasks')
      .select('*')
      .eq('id', taskId)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle();

    if (error) {
      throw new OperationalError('QUERY_FAILED', `خطأ في قراءة المهمة: ${error.message}`, 500);
    }

    if (!task) {
      throw new OperationalError('TASK_NOT_FOUND', 'المهمة التشغيلية المطلوبة غير موجودة في هذا المستأجر.', 404);
    }

    // 2. Validate Data Scope
    if (ctx.role === 'DRIVER') {
      const isAssigned = task.assigned_user_id === ctx.actorUserId;
      const isLegDriver = task.leg_id && task.driver_id === ctx.actorUserId;
      if (!isAssigned && !isLegDriver) {
        throw new OperationalError('TASK_NOT_FOUND', 'المهمة التشغيلية المطلوبة غير موجودة أو غير مسندة إليك.', 404);
      }
      return this.mapTaskToDriverDto(task);
    }

    if (ctx.role === 'MERCHANT') {
      if (task.merchant_id !== ctx.actorUserId) {
        throw new OperationalError('TASK_NOT_FOUND', 'المهمة التشغيلية المطلوبة غير موجودة في حساب التاجر.', 404);
      }
      return this.mapTaskToMerchantDto(task);
    }

    if (ctx.role === 'CASHIER') {
      const assignedBranchId = (ctx as any).branchId;
      if (!assignedBranchId || task.merchant_branch_id !== assignedBranchId) {
        throw new OperationalError('TASK_NOT_FOUND', 'المهمة التشغيلية المطلوبة غير موجودة في فرعك.', 404);
      }
    }

    // Internal roles: fetch comments and linked exception
    const [commentsRes, exceptionRes] = await Promise.all([
      this.supabase
        .from('operational_task_comments')
        .select('*')
        .eq('task_id', taskId)
        .eq('tenant_id', ctx.tenantId)
        .order('created_at', { ascending: true }),
      task.linked_exception_id
        ? this.supabase
            .from('operational_exceptions')
            .select('id, exception_type_code, severity, status, first_detected_at, last_detected_at, occurrence_count, resolution_code')
            .eq('id', task.linked_exception_id)
            .eq('tenant_id', ctx.tenantId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const comments: TaskCommentDTO[] = (commentsRes.data || [])
      .filter((c: any) => {
        // Internal staff see all comments
        return true;
      })
      .map((c: any) => ({
        id: c.id,
        taskId: c.task_id,
        authorUserId: c.author_user_id,
        commentText: c.comment_text,
        visibility: c.visibility,
        createdAt: c.created_at,
      }));

    const baseDto = this.mapTaskToInternalDto(task);

    return {
      ...baseDto,
      comments,
      linkedException: exceptionRes.data || null,
    };
  }

  /**
   * GET /api/operational/tasks/:id/events & /api/operations/tasks/:id/events
   * Internal lifecycle event timeline. Strictly forbidden for Merchant and Driver.
   */
  async getTaskEvents(taskId: string, ctx: AuthenticatedOperationContext): Promise<TaskEventDTO[]> {
    this.assertInternalOperationalAccess(ctx, 'استعراض سجل أحداث المهمة');

    if (!taskId || !isValidUuid(taskId)) {
      throw new OperationalError('INVALID_PAYLOAD', 'معرّف المهمة غير صالح', 400);
    }

    // Verify task existence in tenant
    const { data: task, error: taskErr } = await this.supabase
      .from('operational_tasks')
      .select('id')
      .eq('id', taskId)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle();

    if (taskErr || !task) {
      throw new OperationalError('TASK_NOT_FOUND', 'المهمة التشغيلية المطلوبة غير موجودة.', 404);
    }

    const { data: events, error } = await this.supabase
      .from('operational_task_events')
      .select('*')
      .eq('task_id', taskId)
      .eq('tenant_id', ctx.tenantId)
      .order('occurred_at', { ascending: true });

    if (error) {
      throw new OperationalError('QUERY_FAILED', `خطأ في استرجاع أحداث المهمة: ${error.message}`, 500);
    }

    return (events || []).map((e: any) => ({
      id: e.id,
      taskId: e.task_id,
      actorUserId: e.actor_user_id,
      actorRole: e.actor_role,
      eventType: e.event_type,
      oldStatus: e.old_status,
      newStatus: e.new_status,
      oldPriority: e.old_priority,
      newPriority: e.new_priority,
      payload: sanitizeInternalMetadata(e.payload),
      occurredAt: e.occurred_at,
    }));
  }

  /**
   * GET /api/operational/exceptions & /api/operations/exceptions
   * Scoped operational exceptions listing.
   */
  async getExceptions(
    filters: ExceptionListFilters,
    ctx: AuthenticatedOperationContext
  ): Promise<PaginatedResult<InternalExceptionDTO>> {
    this.assertInternalOperationalAccess(ctx, 'استعراض الاستثناءات التشغيلية');

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 25));
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('operational_exceptions')
      .select(
        `
        id,
        exception_type_code,
        entity_type,
        entity_id,
        shipment_id,
        leg_id,
        manifest_id,
        merchant_id,
        driver_id,
        facility_id,
        merchant_branch_id,
        severity,
        status,
        first_detected_at,
        last_detected_at,
        occurrence_count,
        source_type,
        source_event_id,
        source_rule_code,
        resolution_code,
        resolution_notes,
        resolution_mode,
        resolved_by_user_id,
        resolved_at,
        metadata,
        created_at,
        updated_at
      `,
        { count: 'exact' }
      )
      .eq('tenant_id', ctx.tenantId);

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.severity) {
      if (Array.isArray(filters.severity)) {
        query = query.in('severity', filters.severity);
      } else {
        query = query.eq('severity', filters.severity);
      }
    }

    if (filters.exceptionTypeCode) {
      query = query.eq('exception_type_code', filters.exceptionTypeCode);
    }

    if (filters.entityType) {
      query = query.eq('entity_type', filters.entityType);
    }

    if (filters.entityId && isValidUuid(filters.entityId)) {
      query = query.eq('entity_id', filters.entityId);
    }

    if (filters.shipmentId && isValidUuid(filters.shipmentId)) {
      query = query.eq('shipment_id', filters.shipmentId);
    }

    if (filters.facilityId && isValidUuid(filters.facilityId)) {
      query = query.eq('facility_id', filters.facilityId);
    }

    query = query
      .order('last_detected_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: rows, count, error } = await query;

    if (error) {
      throw new OperationalError('QUERY_FAILED', `خطأ في قراءة الاستثناءات: ${error.message}`, 500);
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    const safeData: InternalExceptionDTO[] = (rows || []).map((row: any) => ({
      id: row.id,
      exceptionTypeCode: row.exception_type_code,
      entityType: row.entity_type,
      entityId: row.entity_id,
      shipmentId: row.shipment_id,
      legId: row.leg_id,
      manifestId: row.manifest_id,
      merchantId: row.merchant_id,
      driverId: row.driver_id,
      facilityId: row.facility_id,
      merchantBranchId: row.merchant_branch_id,
      severity: row.severity,
      status: row.status,
      firstDetectedAt: row.first_detected_at,
      lastDetectedAt: row.last_detected_at,
      occurrenceCount: row.occurrence_count,
      sourceType: row.source_type,
      sourceEventId: row.source_event_id,
      sourceRuleCode: row.source_rule_code,
      resolutionCode: row.resolution_code,
      resolutionNotes: row.resolution_notes,
      resolutionMode: row.resolution_mode,
      resolvedByUserId: row.resolved_by_user_id,
      resolvedAt: row.resolved_at,
      metadata: sanitizeInternalMetadata(row.metadata),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return {
      data: safeData,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  /**
   * GET /api/operational/exceptions/:id & /api/operations/exceptions/:id
   */
  async getExceptionDetail(exceptionId: string, ctx: AuthenticatedOperationContext): Promise<InternalExceptionDTO> {
    this.assertInternalOperationalAccess(ctx, 'استعراض تفاصيل الاستثناء');

    if (!exceptionId || !isValidUuid(exceptionId)) {
      throw new OperationalError('INVALID_PAYLOAD', 'معرّف الاستثناء غير صالح', 400);
    }

    const { data: row, error } = await this.supabase
      .from('operational_exceptions')
      .select('*')
      .eq('id', exceptionId)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle();

    if (error) {
      throw new OperationalError('QUERY_FAILED', `خطأ في قراءة تفاصيل الاستثناء: ${error.message}`, 500);
    }

    if (!row) {
      throw new OperationalError('EXCEPTION_NOT_FOUND', 'الاستثناء المطلوب غير موجود في هذا المستأجر.', 404);
    }

    return {
      id: row.id,
      exceptionTypeCode: row.exception_type_code,
      entityType: row.entity_type,
      entityId: row.entity_id,
      shipmentId: row.shipment_id,
      legId: row.leg_id,
      manifestId: row.manifest_id,
      merchantId: row.merchant_id,
      driverId: row.driver_id,
      facilityId: row.facility_id,
      merchantBranchId: row.merchant_branch_id,
      severity: row.severity,
      status: row.status,
      firstDetectedAt: row.first_detected_at,
      lastDetectedAt: row.last_detected_at,
      occurrenceCount: row.occurrence_count,
      sourceType: row.source_type,
      sourceEventId: row.source_event_id,
      sourceRuleCode: row.source_rule_code,
      resolutionCode: row.resolution_code,
      resolutionNotes: row.resolution_notes,
      resolutionMode: row.resolution_mode,
      resolvedByUserId: row.resolved_by_user_id,
      resolvedAt: row.resolved_at,
      metadata: sanitizeInternalMetadata(row.metadata),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * GET /api/operational/task-queues & /api/operations/task-queues
   */
  async getTaskQueues(ctx: AuthenticatedOperationContext): Promise<TaskQueueDefinitionDTO[]> {
    this.validateContext(ctx);

    let query = this.supabase
      .from('task_queue_definitions')
      .select('id, code, name_ar, name_en, description_ar, description_en, queue_category, facility_id, merchant_branch_id, is_active, created_at')
      .eq('tenant_id', ctx.tenantId)
      .eq('is_active', true)
      .order('code', { ascending: true });

    // Non-admin facility scoping
    if (['OPERATOR', 'DISPATCHER'].includes(ctx.role)) {
      const authorizedFacilities = await this.getAuthorizedFacilityIds(ctx);
      if (authorizedFacilities !== 'ALL') {
        if (authorizedFacilities.length === 0) {
          query = query.is('facility_id', null);
        } else {
          query = query.or(`facility_id.in.(${authorizedFacilities.join(',')}),facility_id.is.null`);
        }
      }
    }

    const { data, error } = await query;
    if (error) {
      throw new OperationalError('QUERY_FAILED', `خطأ في قراءة طوابير المهام: ${error.message}`, 500);
    }

    return (data || []).map((q: any) => ({
      id: q.id,
      code: q.code,
      nameAr: q.name_ar,
      nameEn: q.name_en,
      descriptionAr: q.description_ar,
      descriptionEn: q.description_en,
      queueCategory: q.queue_category,
      facilityId: q.facility_id,
      merchantBranchId: q.merchant_branch_id,
      isActive: q.is_active,
      createdAt: q.created_at,
    }));
  }

  /**
   * GET /api/operational/task-types & /api/operations/task-types
   */
  async getTaskTypes(ctx: AuthenticatedOperationContext): Promise<TaskTypeDefinitionDTO[]> {
    this.validateContext(ctx);

    const { data, error } = await this.supabase
      .from('task_type_definitions')
      .select('id, code, name_ar, name_en, description_ar, description_en, category, default_priority, default_sla_minutes, is_active, created_at')
      .eq('tenant_id', ctx.tenantId)
      .eq('is_active', true)
      .order('code', { ascending: true });

    if (error) {
      throw new OperationalError('QUERY_FAILED', `خطأ في قراءة أنواع المهام: ${error.message}`, 500);
    }

    return (data || []).map((t: any) => ({
      id: t.id,
      code: t.code,
      nameAr: t.name_ar,
      nameEn: t.name_en,
      descriptionAr: t.description_ar,
      descriptionEn: t.description_en,
      category: t.category,
      defaultPriority: t.default_priority,
      defaultSlaMinutes: t.default_sla_minutes,
      isActive: t.is_active,
      createdAt: t.created_at,
    }));
  }

  /**
   * GET /api/operational/attention-summary & /api/operations/attention-summary
   * Aggregates active exceptions and open/blocked tasks from persistent PostgreSQL tables.
   * Prevents double-counting: an active exception linked to a primary task represents 1 operational issue.
   */
  async getAttentionSummary(ctx: AuthenticatedOperationContext): Promise<AttentionSummaryDTO> {
    this.assertInternalOperationalAccess(ctx, 'استعراض ملخص التنبيهات التشغيلية');

    const now = new Date().toISOString();

    const [exceptionsRes, tasksRes, queuesRes] = await Promise.all([
      this.supabase
        .from('operational_exceptions')
        .select('id, severity, status')
        .eq('tenant_id', ctx.tenantId)
        .eq('status', 'ACTIVE'),
      this.supabase
        .from('operational_tasks')
        .select('id, status, priority, assigned_user_id, assigned_queue_id, linked_exception_id, due_at')
        .eq('tenant_id', ctx.tenantId)
        .in('status', ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'BLOCKED']),
      this.supabase
        .from('task_queue_definitions')
        .select('id, code, name_ar')
        .eq('tenant_id', ctx.tenantId)
        .eq('is_active', true),
    ]);

    const activeExceptions = exceptionsRes.data || [];
    const openTasks = tasksRes.data || [];
    const queues = queuesRes.data || [];

    const summaryBySeverity: Record<ExceptionSeverity, number> = {
      LOW: 0,
      NORMAL: 0,
      HIGH: 0,
      URGENT: 0,
      CRITICAL: 0,
    };

    activeExceptions.forEach((e: any) => {
      const sev = (e.severity || 'NORMAL') as ExceptionSeverity;
      if (summaryBySeverity[sev] !== undefined) {
        summaryBySeverity[sev]++;
      }
    });

    let unassignedCount = 0;
    let blockedCount = 0;
    let overdueCount = 0;

    const queueMap: Record<string, { queueId: string | null; queueCode: string; queueNameAr: string; openTasks: number; unassignedTasks: number; blockedTasks: number }> = {};
    queues.forEach((q: any) => {
      queueMap[q.id] = {
        queueId: q.id,
        queueCode: q.code,
        queueNameAr: q.name_ar,
        openTasks: 0,
        unassignedTasks: 0,
        blockedTasks: 0,
      };
    });

    // Unified alert keys to prevent double-counting linked exceptions and their spawned tasks
    const unifiedAlertSet = new Set<string>();

    activeExceptions.forEach((e: any) => {
      unifiedAlertSet.add(`exc-${e.id}`);
    });

    openTasks.forEach((t: any) => {
      if (!t.assigned_user_id) unassignedCount++;
      if (t.status === 'BLOCKED') blockedCount++;
      if (t.due_at && t.due_at < now && t.status !== 'RESOLVED' && t.status !== 'CLOSED') overdueCount++;

      if (t.assigned_queue_id && queueMap[t.assigned_queue_id]) {
        queueMap[t.assigned_queue_id].openTasks++;
        if (!t.assigned_user_id) queueMap[t.assigned_queue_id].unassignedTasks++;
        if (t.status === 'BLOCKED') queueMap[t.assigned_queue_id].blockedTasks++;
      }

      // If this task is NOT linked to an already registered active exception, add to unified count
      if (!t.linked_exception_id || !unifiedAlertSet.has(`exc-${t.linked_exception_id}`)) {
        unifiedAlertSet.add(`task-${t.id}`);
      }
    });

    return {
      activeExceptionsCount: activeExceptions.length,
      criticalExceptionsCount: summaryBySeverity.CRITICAL,
      urgentExceptionsCount: summaryBySeverity.URGENT,
      openTasksCount: openTasks.length,
      unassignedTasksCount: unassignedCount,
      blockedTasksCount: blockedCount,
      overdueTasksCount: overdueCount,
      needsAttentionUnifiedCount: unifiedAlertSet.size,
      summaryByQueue: Object.values(queueMap),
      summaryBySeverity,
    };
  }

  // --------------------------------------------------------------------------
  // MUTATION RPC WRAPPERS (STEP 7.1 FOUNDATION)
  // --------------------------------------------------------------------------

  /**
   * POST /api/operational/tasks & /api/operations/tasks
   * Atomic task creation via public.execute_create_operational_task
   */
  async createTask(params: CreateTaskParams, ctx: AuthenticatedOperationContext): Promise<InternalTaskDTO> {
    this.assertInternalOperationalAccess(ctx, 'إنشاء مهمة تشغيلية');

    if (!params.taskTypeCode || !params.title || !params.entityType || !params.entityId) {
      throw new OperationalError('INVALID_PAYLOAD', 'رمز نوع المهمة والعنوان ونوع الكيان ومعرّفه إلزامية.', 400);
    }

    if (!isValidUuid(params.entityId)) {
      throw new OperationalError('INVALID_PAYLOAD', 'معرّف الكيان غير صالح (UUID مطلوب).', 400);
    }

    const { data: rpcRes, error: rpcErr } = await this.supabase.rpc('execute_create_operational_task', {
      p_tenant_id: ctx.tenantId,
      p_actor_user_id: ctx.actorUserId,
      p_task_type_code: params.taskTypeCode.trim(),
      p_title: params.title.trim(),
      p_entity_type: params.entityType,
      p_entity_id: params.entityId,
      p_description: params.description || null,
      p_priority: params.priority || null,
      p_assigned_queue_id: params.assignedQueueId || null,
      p_assigned_user_id: params.assignedUserId || null,
      p_shipment_id: params.shipmentId || null,
      p_leg_id: params.legId || null,
      p_manifest_id: params.manifestId || null,
      p_merchant_id: params.merchantId || null,
      p_driver_id: params.driverId || null,
      p_facility_id: params.facilityId || null,
      p_merchant_branch_id: params.merchantBranchId || null,
      p_linked_exception_id: params.linkedExceptionId || null,
      p_source_event_id: params.sourceEventId || null,
      p_idempotency_key: params.idempotencyKey || null,
      p_allowed_actions: params.allowedActions || [],
      p_metadata: params.metadata || {},
    });

    if (rpcErr) {
      throw parseRpcError(rpcErr, 'INVALID_PAYLOAD');
    }

    const createdId = rpcRes?.task_id || rpcRes?.id;
    if (!createdId) {
      throw new OperationalError('RPC_RESULT_INVALID', 'لم يتم إرجاع معرّف المهمة المنشأة من قاعدة البيانات.', 500);
    }

    // Authoritative refetch
    return (await this.getTaskDetail(createdId, ctx)) as InternalTaskDTO;
  }

  /**
   * POST /api/operational/tasks/:id/claim & /api/operations/tasks/:id/claim
   * Atomic claim via public.execute_claim_operational_task
   */
  async claimTask(params: ClaimTaskParams, ctx: AuthenticatedOperationContext): Promise<InternalTaskDTO> {
    this.assertInternalOperationalAccess(ctx, 'استلام المهمة (Claim)');

    if (!params.taskId || !isValidUuid(params.taskId)) {
      throw new OperationalError('INVALID_PAYLOAD', 'معرّف المهمة غير صالح.', 400);
    }

    const expectedVer = params.expectedVersion !== undefined ? Math.floor(Number(params.expectedVersion)) : null;

    const { data: rpcRes, error: rpcErr } = await this.supabase.rpc('execute_claim_operational_task', {
      p_tenant_id: ctx.tenantId,
      p_actor_user_id: ctx.actorUserId,
      p_task_id: params.taskId,
      p_expected_version: expectedVer,
      p_idempotency_key: params.idempotencyKey || null,
    });

    if (rpcErr) {
      throw parseRpcError(rpcErr, 'TASK_NOT_CLAIMABLE');
    }

    return (await this.getTaskDetail(params.taskId, ctx)) as InternalTaskDTO;
  }

  /**
   * POST /api/operational/tasks/:id/assign & /api/operations/tasks/:id/assign
   * Atomic assignment via public.execute_assign_operational_task
   */
  async assignTask(params: AssignTaskParams, ctx: AuthenticatedOperationContext): Promise<InternalTaskDTO> {
    this.assertInternalOperationalAccess(ctx, 'إسناد المهمة');

    if (!params.taskId || !isValidUuid(params.taskId)) {
      throw new OperationalError('INVALID_PAYLOAD', 'معرّف المهمة غير صالح.', 400);
    }

    const expectedVer = params.expectedVersion !== undefined ? Math.floor(Number(params.expectedVersion)) : null;

    const { data: rpcRes, error: rpcErr } = await this.supabase.rpc('execute_assign_operational_task', {
      p_tenant_id: ctx.tenantId,
      p_actor_user_id: ctx.actorUserId,
      p_task_id: params.taskId,
      p_target_user_id: params.targetUserId || null,
      p_target_queue_id: params.targetQueueId || null,
      p_notes: params.notes || null,
      p_expected_version: expectedVer,
      p_idempotency_key: params.idempotencyKey || null,
    });

    if (rpcErr) {
      throw parseRpcError(rpcErr, 'INVALID_PAYLOAD');
    }

    return (await this.getTaskDetail(params.taskId, ctx)) as InternalTaskDTO;
  }

  /**
   * POST /api/operational/tasks/:id/state & /api/operations/tasks/:id/state
   * Atomic state change (ACKNOWLEDGED, IN_PROGRESS, BLOCKED) via public.execute_update_operational_task_state
   */
  async updateTaskState(params: UpdateTaskStateParams, ctx: AuthenticatedOperationContext): Promise<InternalTaskDTO> {
    this.assertInternalOperationalAccess(ctx, 'تحديث حالة المهمة');

    if (!params.taskId || !isValidUuid(params.taskId)) {
      throw new OperationalError('INVALID_PAYLOAD', 'معرّف المهمة غير صالح.', 400);
    }

    if (!['ACKNOWLEDGED', 'IN_PROGRESS', 'BLOCKED'].includes(params.targetStatus)) {
      throw new OperationalError('INVALID_PAYLOAD', 'الحالة المطلوبة غير صالحة لهذا المسار.', 400);
    }

    const expectedVer = params.expectedVersion !== undefined ? Math.floor(Number(params.expectedVersion)) : null;

    const { data: rpcRes, error: rpcErr } = await this.supabase.rpc('execute_update_operational_task_state', {
      p_tenant_id: ctx.tenantId,
      p_actor_user_id: ctx.actorUserId,
      p_task_id: params.taskId,
      p_target_status: params.targetStatus,
      p_reason: params.reason || null,
      p_expected_version: expectedVer,
      p_idempotency_key: params.idempotencyKey || null,
    });

    if (rpcErr) {
      throw parseRpcError(rpcErr, 'INVALID_LEG_STATE');
    }

    return (await this.getTaskDetail(params.taskId, ctx)) as InternalTaskDTO;
  }

  /**
   * POST /api/operational/tasks/:id/resolve & /api/operations/tasks/:id/resolve
   * Atomic task resolution via public.execute_resolve_operational_task
   * Resolves TASK ONLY. Does not auto-resolve linked exception.
   */
  async resolveTask(params: ResolveTaskParams, ctx: AuthenticatedOperationContext): Promise<InternalTaskDTO> {
    this.assertInternalOperationalAccess(ctx, 'حل المهمة التشغيلية');

    if (!params.taskId || !isValidUuid(params.taskId)) {
      throw new OperationalError('INVALID_PAYLOAD', 'معرّف المهمة غير صالح.', 400);
    }

    if (!params.resolutionCode || !params.resolutionNotes) {
      throw new OperationalError('INVALID_PAYLOAD', 'رمز الحل وملاحظات الإغلاق إلزامية.', 400);
    }

    const expectedVer = params.expectedVersion !== undefined ? Math.floor(Number(params.expectedVersion)) : null;

    const { data: rpcRes, error: rpcErr } = await this.supabase.rpc('execute_resolve_operational_task', {
      p_tenant_id: ctx.tenantId,
      p_actor_user_id: ctx.actorUserId,
      p_task_id: params.taskId,
      p_resolution_code: params.resolutionCode.trim(),
      p_resolution_notes: params.resolutionNotes.trim(),
      p_expected_version: expectedVer,
      p_idempotency_key: params.idempotencyKey || null,
    });

    if (rpcErr) {
      throw parseRpcError(rpcErr, 'INVALID_PAYLOAD');
    }

    return (await this.getTaskDetail(params.taskId, ctx)) as InternalTaskDTO;
  }

  /**
   * POST /api/operational/tasks/:id/reopen & /api/operations/tasks/:id/reopen
   * Supervisor-only atomic task reopen via public.execute_reopen_operational_task
   */
  async reopenTask(params: ReopenTaskParams, ctx: AuthenticatedOperationContext): Promise<InternalTaskDTO> {
    this.assertSupervisorAccess(ctx, 'إعادة فتح المهمة التشغيلية');

    if (!params.taskId || !isValidUuid(params.taskId)) {
      throw new OperationalError('INVALID_PAYLOAD', 'معرّف المهمة غير صالح.', 400);
    }

    if (!params.reopenReason || !params.reopenReason.trim()) {
      throw new OperationalError('INVALID_PAYLOAD', 'سبب إعادة فتح المهمة إلزامي.', 400);
    }

    const expectedVer = params.expectedVersion !== undefined ? Math.floor(Number(params.expectedVersion)) : null;

    const { data: rpcRes, error: rpcErr } = await this.supabase.rpc('execute_reopen_operational_task', {
      p_tenant_id: ctx.tenantId,
      p_actor_user_id: ctx.actorUserId,
      p_task_id: params.taskId,
      p_reopen_reason: params.reopenReason.trim(),
      p_expected_version: expectedVer,
      p_idempotency_key: params.idempotencyKey || null,
    });

    if (rpcErr) {
      throw parseRpcError(rpcErr, 'INVALID_PAYLOAD');
    }

    return (await this.getTaskDetail(params.taskId, ctx)) as InternalTaskDTO;
  }

  /**
   * POST /api/operational/exceptions & /api/operations/exceptions
   * Atomic record exception via public.execute_record_operational_exception
   */
  async recordException(params: RecordExceptionParams, ctx: AuthenticatedOperationContext): Promise<InternalExceptionDTO> {
    this.assertInternalOperationalAccess(ctx, 'تسجيل استثناء تشغيلي');

    if (!params.exceptionTypeCode || !params.entityType || !params.entityId) {
      throw new OperationalError('INVALID_PAYLOAD', 'رمز نوع الاستثناء ونوع الكيان ومعرّفه إلزامية.', 400);
    }

    if (!isValidUuid(params.entityId)) {
      throw new OperationalError('INVALID_PAYLOAD', 'معرّف الكيان غير صالح.', 400);
    }

    const { data: rpcRes, error: rpcErr } = await this.supabase.rpc('execute_record_operational_exception', {
      p_tenant_id: ctx.tenantId,
      p_actor_user_id: ctx.actorUserId,
      p_exception_type_code: params.exceptionTypeCode.trim(),
      p_entity_type: params.entityType,
      p_entity_id: params.entityId,
      p_severity: params.severity || 'NORMAL',
      p_source_type: params.sourceType || 'MANUAL_USER',
      p_source_rule_code: params.sourceRuleCode || null,
      p_source_event_id: params.sourceEventId || null,
      p_shipment_id: params.shipmentId || null,
      p_leg_id: params.legId || null,
      p_manifest_id: params.manifestId || null,
      p_merchant_id: params.merchantId || null,
      p_driver_id: params.driverId || null,
      p_facility_id: params.facilityId || null,
      p_merchant_branch_id: params.merchantBranchId || null,
      p_spawn_task: params.spawnTask !== false,
      p_task_title: params.taskTitle || null,
      p_task_description: params.taskDescription || null,
      p_task_queue_code: params.taskQueueCode || null,
      p_task_type_code: params.taskTypeCode || null,
      p_metadata: params.metadata || {},
    });

    if (rpcErr) {
      throw parseRpcError(rpcErr, 'INVALID_PAYLOAD');
    }

    const exceptionId = rpcRes?.exception_id || rpcRes?.id;
    if (!exceptionId) {
      throw new OperationalError('RPC_RESULT_INVALID', 'لم يتم إرجاع معرّف الاستثناء من قاعدة البيانات.', 500);
    }

    return await this.getExceptionDetail(exceptionId, ctx);
  }

  /**
   * POST /api/operational/exceptions/:id/resolve & /api/operations/exceptions/:id/resolve
   * Atomic resolve exception via public.execute_resolve_operational_exception
   */
  async resolveException(params: ResolveExceptionParams, ctx: AuthenticatedOperationContext): Promise<InternalExceptionDTO> {
    this.assertInternalOperationalAccess(ctx, 'إغلاق الاستثناء التشغيلي');

    if (!params.exceptionId || !isValidUuid(params.exceptionId)) {
      throw new OperationalError('INVALID_PAYLOAD', 'معرّف الاستثناء غير صالح.', 400);
    }

    if (!params.resolutionCode || !params.resolutionNotes) {
      throw new OperationalError('INVALID_PAYLOAD', 'رمز الحل وملاحظات الإغلاق إلزامية.', 400);
    }

    const { data: rpcRes, error: rpcErr } = await this.supabase.rpc('execute_resolve_operational_exception', {
      p_tenant_id: ctx.tenantId,
      p_actor_user_id: ctx.actorUserId,
      p_exception_id: params.exceptionId,
      p_resolution_code: params.resolutionCode.trim(),
      p_resolution_notes: params.resolutionNotes.trim(),
      p_resolution_mode: params.resolutionMode || 'MANUAL_VERIFIED',
    });

    if (rpcErr) {
      throw parseRpcError(rpcErr, 'INVALID_PAYLOAD');
    }

    return await this.getExceptionDetail(params.exceptionId, ctx);
  }

  // --------------------------------------------------------------------------
  // ROLE DTO SERIALIZATION HELPERS
  // --------------------------------------------------------------------------

  private mapTaskToRoleDto(row: any, ctx: AuthenticatedOperationContext): InternalTaskDTO | DriverTaskDTO | MerchantSafeTaskDTO {
    if (ctx.role === 'DRIVER') {
      return this.mapTaskToDriverDto(row);
    }
    if (ctx.role === 'MERCHANT') {
      return this.mapTaskToMerchantDto(row);
    }
    return this.mapTaskToInternalDto(row);
  }

  private mapTaskToInternalDto(row: any): InternalTaskDTO {
    return {
      id: row.id,
      taskTypeCode: row.task_type_code,
      title: row.title,
      description: row.description,
      priority: row.priority,
      status: row.status,
      linkedExceptionId: row.linked_exception_id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      shipmentId: row.shipment_id,
      legId: row.leg_id,
      manifestId: row.manifest_id,
      merchantId: row.merchant_id,
      driverId: row.driver_id,
      facilityId: row.facility_id,
      merchantBranchId: row.merchant_branch_id,
      assignedQueueId: row.assigned_queue_id,
      assignedUserId: row.assigned_user_id,
      createdByType: row.created_by_type,
      createdByUserId: row.created_by_user_id,
      dueAt: row.due_at,
      slaMinutesSnapshot: row.sla_minutes_snapshot,
      slaSourceSnapshot: row.sla_source_snapshot,
      escalationLevel: row.escalation_level,
      openedAt: row.opened_at,
      acknowledgedAt: row.acknowledged_at,
      startedAt: row.started_at,
      blockedAt: row.blocked_at,
      blockedReason: row.blocked_reason,
      resolvedAt: row.resolved_at,
      resolutionCode: row.resolution_code,
      resolutionNotes: row.resolution_notes,
      resolvedByUserId: row.resolved_by_user_id,
      closedAt: row.closed_at,
      closedByUserId: row.closed_by_user_id,
      cancelledAt: row.cancelled_at,
      cancelledByUserId: row.cancelled_by_user_id,
      cancellationReason: row.cancellation_reason,
      reopenCount: row.reopen_count,
      version: row.version,
      allowedActions: Array.isArray(row.allowed_actions) ? row.allowed_actions : [],
      metadata: sanitizeInternalMetadata(row.metadata),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapTaskToDriverDto(row: any): DriverTaskDTO {
    return {
      id: row.id,
      taskTypeCode: row.task_type_code,
      title: row.title,
      description: row.description,
      priority: row.priority,
      status: row.status,
      entityType: row.entity_type,
      entityId: row.entity_id,
      shipmentId: row.shipment_id,
      legId: row.leg_id,
      dueAt: row.due_at,
      openedAt: row.opened_at,
      startedAt: row.started_at,
      resolvedAt: row.resolved_at,
      allowedActions: Array.isArray(row.allowed_actions) ? row.allowed_actions : [],
      metadata: sanitizeDriverMetadata(row.metadata), // Strict allowlist. Zero financials.
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapTaskToMerchantDto(row: any): MerchantSafeTaskDTO {
    return {
      id: row.id,
      taskTypeCode: row.task_type_code,
      title: row.title,
      description: row.description,
      priority: row.priority,
      status: row.status,
      entityType: row.entity_type,
      entityId: row.entity_id,
      shipmentId: row.shipment_id,
      dueAt: row.due_at,
      openedAt: row.opened_at,
      resolvedAt: row.resolved_at,
      resolutionCode: row.resolution_code,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

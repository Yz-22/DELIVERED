// ============================================================================
// DELIVERE — PHASE 3C / STEP 7.2.1
// OPERATIONAL TASKS & EXCEPTIONS TYPES & CONTRACTS
// File: src/types/operationalTasks.ts
// ============================================================================

export type TaskStatus =
  | 'OPEN'
  | 'ACKNOWLEDGED'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'RESOLVED'
  | 'CLOSED'
  | 'CANCELLED';

export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | 'CRITICAL';

export type ExceptionStatus = 'ACTIVE' | 'RESOLVED' | 'SUPPRESSED';

export type ExceptionSeverity = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | 'CRITICAL';

export type OperationalEntityType =
  | 'SHIPMENT'
  | 'SHIPMENT_LEG'
  | 'MANIFEST'
  | 'PAYMENT_RECORD'
  | 'DRIVER_CASH'
  | 'SETTLEMENT'
  | 'FACILITY'
  | 'DRIVER'
  | 'MERCHANT_BRANCH'
  | 'GENERAL';

export type TaskEventType =
  | 'CREATED'
  | 'ASSIGNED'
  | 'CLAIMED'
  | 'REASSIGNED'
  | 'UNASSIGNED'
  | 'ACKNOWLEDGED'
  | 'STARTED'
  | 'BLOCKED'
  | 'UNBLOCKED'
  | 'PRIORITY_CHANGED'
  | 'DUE_DATE_CHANGED'
  | 'ESCALATED'
  | 'RESOLVED'
  | 'REOPENED'
  | 'CLOSED'
  | 'CANCELLED'
  | 'COMMENT_ADDED';

export type CommentVisibility = 'INTERNAL' | 'MERCHANT_VISIBLE' | 'DRIVER_VISIBLE';

// ----------------------------------------------------------------------------
// Task Filter & Pagination Options
// ----------------------------------------------------------------------------

export interface TaskListFilters {
  status?: TaskStatus | TaskStatus[];
  priority?: TaskPriority | TaskPriority[];
  assignedQueueId?: string;
  assignedUserId?: string;
  assignedToMe?: boolean;
  shipmentId?: string;
  legId?: string;
  driverId?: string;
  merchantId?: string;
  facilityId?: string;
  merchantBranchId?: string;
  entityType?: OperationalEntityType;
  entityId?: string;
  linkedExceptionId?: string;
  page?: number;
  limit?: number;
}

export interface ExceptionListFilters {
  status?: ExceptionStatus;
  severity?: ExceptionSeverity | ExceptionSeverity[];
  exceptionTypeCode?: string;
  entityType?: OperationalEntityType;
  entityId?: string;
  shipmentId?: string;
  merchantId?: string;
  driverId?: string;
  facilityId?: string;
  merchantBranchId?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// ----------------------------------------------------------------------------
// Role-Safe DTOs (Data Transfer Objects)
// ----------------------------------------------------------------------------

export interface InternalTaskDTO {
  id: string;
  taskTypeCode: string;
  taskTypeNameAr?: string;
  taskTypeNameEn?: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  linkedExceptionId: string | null;
  entityType: OperationalEntityType;
  entityId: string;
  shipmentId: string | null;
  legId: string | null;
  manifestId: string | null;
  merchantId: string | null;
  driverId: string | null;
  facilityId: string | null;
  merchantBranchId: string | null;
  assignedQueueId: string | null;
  assignedQueueNameAr?: string;
  assignedQueueNameEn?: string;
  assignedUserId: string | null;
  assignedUserName?: string;
  createdByType: 'SYSTEM' | 'USER' | 'AUTOMATION';
  createdByUserId: string | null;
  dueAt: string | null;
  slaMinutesSnapshot: number | null;
  slaSourceSnapshot: string | null;
  escalationLevel: number;
  openedAt: string;
  acknowledgedAt: string | null;
  startedAt: string | null;
  blockedAt: string | null;
  blockedReason: string | null;
  resolvedAt: string | null;
  resolutionCode: string | null;
  resolutionNotes: string | null;
  resolvedByUserId: string | null;
  closedAt: string | null;
  closedByUserId: string | null;
  cancelledAt: string | null;
  cancelledByUserId: string | null;
  cancellationReason: string | null;
  reopenCount: number;
  version: number;
  allowedActions: string[];
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface DriverTaskDTO {
  id: string;
  taskTypeCode: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  entityType: OperationalEntityType;
  entityId: string;
  shipmentId: string | null;
  legId: string | null;
  dueAt: string | null;
  openedAt: string;
  startedAt: string | null;
  resolvedAt: string | null;
  allowedActions: string[];
  metadata: Record<string, any>; // Strictly allowlisted: e.g. recipientName, address notes. ZERO financial fields.
  createdAt: string;
  updatedAt: string;
}

export interface MerchantSafeTaskDTO {
  id: string;
  taskTypeCode: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  entityType: OperationalEntityType;
  entityId: string;
  shipmentId: string | null;
  dueAt: string | null;
  openedAt: string;
  resolvedAt: string | null;
  resolutionCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskCommentDTO {
  id: string;
  taskId: string;
  authorUserId: string;
  authorName?: string;
  authorRole?: string;
  commentText: string;
  visibility: CommentVisibility;
  createdAt: string;
}

export interface TaskEventDTO {
  id: string;
  taskId: string;
  actorUserId: string;
  actorRole: string;
  actorName?: string;
  eventType: TaskEventType;
  oldStatus: string | null;
  newStatus: string | null;
  oldPriority: string | null;
  newPriority: string | null;
  payload: Record<string, any>;
  occurredAt: string;
}

export interface TaskDetailDTO extends InternalTaskDTO {
  comments?: TaskCommentDTO[];
  events?: TaskEventDTO[];
  linkedException?: {
    id: string;
    exceptionTypeCode: string;
    severity: ExceptionSeverity;
    status: ExceptionStatus;
    firstDetectedAt: string;
    lastDetectedAt: string;
    occurrenceCount: number;
    resolutionCode: string | null;
  } | null;
}

export interface InternalExceptionDTO {
  id: string;
  exceptionTypeCode: string;
  entityType: OperationalEntityType;
  entityId: string;
  shipmentId: string | null;
  legId: string | null;
  manifestId: string | null;
  merchantId: string | null;
  driverId: string | null;
  facilityId: string | null;
  merchantBranchId: string | null;
  severity: ExceptionSeverity;
  status: ExceptionStatus;
  firstDetectedAt: string;
  lastDetectedAt: string;
  occurrenceCount: number;
  sourceType: string;
  sourceEventId: string | null;
  sourceRuleCode: string | null;
  resolutionCode: string | null;
  resolutionNotes: string | null;
  resolutionMode: string | null;
  resolvedByUserId: string | null;
  resolvedAt: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface TaskQueueDefinitionDTO {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  queueCategory: string;
  facilityId: string | null;
  merchantBranchId: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface TaskTypeDefinitionDTO {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  category: string;
  defaultPriority: TaskPriority;
  defaultSlaMinutes: number;
  isActive: boolean;
  createdAt: string;
}

export interface AttentionSummaryDTO {
  activeExceptionsCount: number;
  criticalExceptionsCount: number;
  urgentExceptionsCount: number;
  openTasksCount: number;
  unassignedTasksCount: number;
  blockedTasksCount: number;
  overdueTasksCount: number;
  needsAttentionUnifiedCount: number; // Deduplicated aggregate: linked exceptions and unassigned/blocked tasks
  summaryByQueue: Array<{
    queueId: string | null;
    queueCode: string;
    queueNameAr: string;
    openTasks: number;
    unassignedTasks: number;
    blockedTasks: number;
  }>;
  summaryBySeverity: Record<ExceptionSeverity, number>;
}

// ----------------------------------------------------------------------------
// Mutation Request Types
// ----------------------------------------------------------------------------

export interface CreateTaskParams {
  taskTypeCode: string;
  title: string;
  entityType: OperationalEntityType;
  entityId: string;
  description?: string;
  priority?: TaskPriority;
  assignedQueueId?: string;
  assignedUserId?: string;
  shipmentId?: string;
  legId?: string;
  manifestId?: string;
  merchantId?: string;
  driverId?: string;
  facilityId?: string;
  merchantBranchId?: string;
  linkedExceptionId?: string;
  sourceEventId?: string;
  allowedActions?: string[];
  metadata?: Record<string, any>;
  idempotencyKey?: string;
}

export interface ClaimTaskParams {
  taskId: string;
  expectedVersion?: number;
  idempotencyKey?: string;
}

export interface AssignTaskParams {
  taskId: string;
  targetUserId?: string;
  targetQueueId?: string;
  notes?: string;
  expectedVersion?: number;
  idempotencyKey?: string;
}

export interface UpdateTaskStateParams {
  taskId: string;
  targetStatus: 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'BLOCKED';
  reason?: string;
  expectedVersion?: number;
  idempotencyKey?: string;
}

export interface ResolveTaskParams {
  taskId: string;
  resolutionCode: string;
  resolutionNotes: string;
  expectedVersion?: number;
  idempotencyKey?: string;
}

export interface ReopenTaskParams {
  taskId: string;
  reopenReason: string;
  expectedVersion?: number;
  idempotencyKey?: string;
}

export interface RecordExceptionParams {
  exceptionTypeCode: string;
  entityType: OperationalEntityType;
  entityId: string;
  severity?: ExceptionSeverity;
  sourceType?: 'SYSTEM_DETECTOR' | 'CANONICAL_EVENT' | 'MANUAL_USER';
  sourceRuleCode?: string;
  sourceEventId?: string;
  shipmentId?: string;
  legId?: string;
  manifestId?: string;
  merchantId?: string;
  driverId?: string;
  facilityId?: string;
  merchantBranchId?: string;
  spawnTask?: boolean;
  taskTitle?: string;
  taskDescription?: string;
  taskQueueCode?: string;
  taskTypeCode?: string;
  metadata?: Record<string, any>;
}

export interface ResolveExceptionParams {
  exceptionId: string;
  resolutionCode: string;
  resolutionNotes: string;
  resolutionMode?: 'MANUAL_VERIFIED' | 'SUPPRESSED';
}

// Aliases for Frontend API Request types
export type TaskClaimRequest = { expectedVersion?: number; idempotencyKey?: string };
export type TaskAssignRequest = { targetUserId?: string; targetQueueId?: string; notes?: string; expectedVersion?: number; idempotencyKey?: string };
export type TaskStatusUpdateRequest = { targetStatus: 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'BLOCKED'; reason?: string; expectedVersion?: number; idempotencyKey?: string };
export type TaskResolveRequest = { resolutionCode: string; resolutionNotes: string; expectedVersion?: number; idempotencyKey?: string };
export type TaskCloseRequest = { expectedVersion?: number; idempotencyKey?: string };
export type TaskCancelRequest = { cancellationReason: string; expectedVersion?: number; idempotencyKey?: string };
export type TaskReopenRequest = { reopenReason: string; expectedVersion?: number; idempotencyKey?: string };


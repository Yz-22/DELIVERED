/**
 * DELIVERE — OPERATIONAL API CLIENT (PHASE 3C / STEP 7.2.3)
 *
 * Strongly-typed frontend client for the Authoritative Operational Task,
 * Exception, and Attention API endpoints.
 *
 * Uses:
 * - Direct authenticated fetch with Bearer token from auth.ts
 * - `/api/operational/*` canonical endpoint routes
 * - Full type safety matching backend contracts in `src/types/operationalTasks.ts`
 */

import { getAuthHeaders } from '../lib/auth';
import {
  InternalTaskDTO,
  TaskDetailDTO,
  InternalExceptionDTO,
  AttentionSummaryDTO,
  TaskQueueDefinitionDTO,
  TaskTypeDefinitionDTO,
  TaskListFilters,
  ExceptionListFilters,
  PaginatedResult,
  TaskClaimRequest,
  TaskAssignRequest,
  TaskStatusUpdateRequest,
  TaskResolveRequest,
} from '../types/operationalTasks';

const API_BASE = '/api/operational';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorDetail = `Request failed with status ${res.status}`;
    let errorCode = 'UNKNOWN_ERROR';
    try {
      const errorJson = await res.json();
      if (errorJson.code) {
        errorCode = errorJson.code;
      }
      if (errorJson.error && typeof errorJson.error === 'object' && errorJson.error.code) {
        errorCode = errorJson.error.code;
      }
      if (errorJson.message) {
        errorDetail = errorJson.message;
      } else if (errorJson.error && typeof errorJson.error === 'object' && errorJson.error.message) {
        errorDetail = errorJson.error.message;
      } else if (errorJson.error && typeof errorJson.error === 'string') {
        errorDetail = errorJson.error;
      }
    } catch {
      // Non-JSON error body
    }
    const err = new Error(errorDetail) as any;
    err.code = errorCode;
    err.status = res.status;
    throw err;
  }
  const body = await res.json();
  if (body && typeof body === 'object' && 'task' in body && body.success) {
    return body.task;
  }
  if (body && typeof body === 'object' && 'exception' in body && body.success) {
    return body.exception;
  }
  if (body && typeof body === 'object' && 'summary' in body && body.success) {
    return body.summary;
  }
  return body;
}

export const operationalApiClient = {
  // --------------------------------------------------------------------------
  // Attention Summary
  // --------------------------------------------------------------------------
  async getAttentionSummary(): Promise<AttentionSummaryDTO> {
    const res = await fetch(`${API_BASE}/attention-summary`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse<AttentionSummaryDTO>(res);
  },

  // --------------------------------------------------------------------------
  // Tasks
  // --------------------------------------------------------------------------
  async listTasks(filters: TaskListFilters = {}): Promise<PaginatedResult<InternalTaskDTO>> {
    const params = new URLSearchParams();
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        filters.status.forEach((s) => params.append('status', s));
      } else {
        params.append('status', filters.status);
      }
    }
    if (filters.priority) {
      if (Array.isArray(filters.priority)) {
        filters.priority.forEach((p) => params.append('priority', p));
      } else {
        params.append('priority', filters.priority);
      }
    }
    if (filters.assignedQueueId) params.append('assignedQueueId', filters.assignedQueueId);
    if (filters.assignedUserId) params.append('assignedUserId', filters.assignedUserId);
    if (filters.assignedToMe) params.append('assignedToMe', 'true');
    if (filters.shipmentId) params.append('shipmentId', filters.shipmentId);
    if (filters.legId) params.append('legId', filters.legId);
    if (filters.driverId) params.append('driverId', filters.driverId);
    if (filters.merchantId) params.append('merchantId', filters.merchantId);
    if (filters.facilityId) params.append('facilityId', filters.facilityId);
    if (filters.merchantBranchId) params.append('merchantBranchId', filters.merchantBranchId);
    if (filters.entityType) params.append('entityType', filters.entityType);
    if (filters.entityId) params.append('entityId', filters.entityId);
    if (filters.linkedExceptionId) params.append('linkedExceptionId', filters.linkedExceptionId);
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));

    const queryString = params.toString();
    const url = queryString ? `${API_BASE}/tasks?${queryString}` : `${API_BASE}/tasks`;

    const res = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse<PaginatedResult<InternalTaskDTO>>(res);
  },

  async getTask(taskId: string): Promise<TaskDetailDTO> {
    const res = await fetch(`${API_BASE}/tasks/${encodeURIComponent(taskId)}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse<TaskDetailDTO>(res);
  },

  // --------------------------------------------------------------------------
  // Task Mutations
  // --------------------------------------------------------------------------
  async claimTask(taskId: string, req: TaskClaimRequest): Promise<InternalTaskDTO> {
    const res = await fetch(`${API_BASE}/tasks/${encodeURIComponent(taskId)}/claim`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(req),
    });
    return handleResponse<InternalTaskDTO>(res);
  },

  async assignTask(taskId: string, req: TaskAssignRequest): Promise<InternalTaskDTO> {
    const res = await fetch(`${API_BASE}/tasks/${encodeURIComponent(taskId)}/assign`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(req),
    });
    return handleResponse<InternalTaskDTO>(res);
  },

  async updateTaskStatus(taskId: string, req: TaskStatusUpdateRequest): Promise<InternalTaskDTO> {
    const res = await fetch(`${API_BASE}/tasks/${encodeURIComponent(taskId)}/state`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(req),
    });
    return handleResponse<InternalTaskDTO>(res);
  },

  async resolveTask(taskId: string, req: TaskResolveRequest): Promise<InternalTaskDTO> {
    const res = await fetch(`${API_BASE}/tasks/${encodeURIComponent(taskId)}/resolve`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(req),
    });
    return handleResponse<InternalTaskDTO>(res);
  },

  // --------------------------------------------------------------------------
  // Exceptions
  // --------------------------------------------------------------------------
  async listExceptions(filters: ExceptionListFilters = {}): Promise<PaginatedResult<InternalExceptionDTO>> {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.severity) {
      if (Array.isArray(filters.severity)) {
        filters.severity.forEach((s) => params.append('severity', s));
      } else {
        params.append('severity', filters.severity);
      }
    }
    if (filters.exceptionTypeCode) params.append('exceptionTypeCode', filters.exceptionTypeCode);
    if (filters.entityType) params.append('entityType', filters.entityType);
    if (filters.entityId) params.append('entityId', filters.entityId);
    if (filters.shipmentId) params.append('shipmentId', filters.shipmentId);
    if (filters.merchantId) params.append('merchantId', filters.merchantId);
    if (filters.driverId) params.append('driverId', filters.driverId);
    if (filters.facilityId) params.append('facilityId', filters.facilityId);
    if (filters.merchantBranchId) params.append('merchantBranchId', filters.merchantBranchId);
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));

    const queryString = params.toString();
    const url = queryString ? `${API_BASE}/exceptions?${queryString}` : `${API_BASE}/exceptions`;

    const res = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse<PaginatedResult<InternalExceptionDTO>>(res);
  },

  async getException(exceptionId: string): Promise<InternalExceptionDTO> {
    const res = await fetch(`${API_BASE}/exceptions/${encodeURIComponent(exceptionId)}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse<InternalExceptionDTO>(res);
  },

  // --------------------------------------------------------------------------
  // Metadata & Lookups
  // --------------------------------------------------------------------------
  async getQueues(): Promise<TaskQueueDefinitionDTO[]> {
    const res = await fetch(`${API_BASE}/queues`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse<TaskQueueDefinitionDTO[]>(res);
  },

  async getTaskTypes(): Promise<TaskTypeDefinitionDTO[]> {
    const res = await fetch(`${API_BASE}/task-types`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse<TaskTypeDefinitionDTO[]>(res);
  },
};

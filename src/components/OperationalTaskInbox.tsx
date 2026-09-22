/**
 * DELIVERE — OPERATIONAL TASK INBOX & EXCEPTION QUEUE (PHASE 3C / STEP 4.2)
 *
 * Premium Logistics Operating System Work Queue.
 *
 * High-density operational triage table and responsive cards for Authoritative Tasks & Exceptions.
 * Uses Step 2 Design System foundation primitives (StatusBadge, PriorityIndicator, Skeleton, EmptyState).
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  RefreshCw,
  User,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Layers,
  ShieldAlert,
  SlidersHorizontal,
  XCircle,
} from 'lucide-react';
import {
  InternalTaskDTO,
  InternalExceptionDTO,
  TaskStatus,
  TaskPriority,
  ExceptionSeverity,
  ExceptionStatus,
  TaskListFilters,
  ExceptionListFilters,
} from '../types/operationalTasks';
import { operationalApiClient } from '../services/operationalApiClient';
import { StatusBadge, PriorityIndicator, Skeleton, EmptyState } from './ui';

interface OperationalTaskInboxProps {
  activeTab: 'tasks' | 'exceptions';
  onSelectTask: (taskId: string) => void;
  selectedTaskId: string | null;
  selectedQueueId?: string | null;
  statusFilterShortcut?: string;
  severityFilterShortcut?: string;
  currentUserId?: string;
  dir?: 'rtl' | 'ltr';
  onNavigateToShipment?: (shipmentId: string) => void;
}

export const OperationalTaskInbox: React.FC<OperationalTaskInboxProps> = ({
  activeTab,
  onSelectTask,
  selectedTaskId,
  selectedQueueId,
  statusFilterShortcut,
  severityFilterShortcut,
  currentUserId,
  dir = 'rtl',
  onNavigateToShipment,
}) => {
  const isRtl = dir === 'rtl';

  // Monotonic request counter to prevent out-of-order race conditions
  const lastTaskRequestIdRef = useRef<number>(0);
  const lastExceptionRequestIdRef = useRef<number>(0);

  // Task State
  const [tasks, setTasks] = useState<InternalTaskDTO[]>([]);
  const [taskTotal, setTaskTotal] = useState<number>(0);
  const [taskPage, setTaskPage] = useState<number>(1);
  const [taskLimit] = useState<number>(20);
  const [taskSearch, setTaskSearch] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [onlyMyTasks, setOnlyMyTasks] = useState<boolean>(false);

  // Exception State
  const [exceptions, setExceptions] = useState<InternalExceptionDTO[]>([]);
  const [exceptionTotal, setExceptionTotal] = useState<number>(0);
  const [exceptionPage, setExceptionPage] = useState<number>(1);
  const [exceptionLimit] = useState<number>(20);
  const [exceptionStatus, setExceptionStatus] = useState<string>('ACTIVE');
  const [exceptionSeverity, setExceptionSeverity] = useState<string>('ALL');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Synchronize status filter shortcut from status strip
  useEffect(() => {
    if (statusFilterShortcut) {
      if (statusFilterShortcut === 'UNASSIGNED') {
        setSelectedStatus('OPEN');
      } else if (statusFilterShortcut === 'OVERDUE' || statusFilterShortcut === 'ALL') {
        setSelectedStatus('ALL');
      } else {
        setSelectedStatus(statusFilterShortcut);
      }
      setTaskPage(1);
    }
  }, [statusFilterShortcut]);

  // Synchronize severity shortcut
  useEffect(() => {
    if (severityFilterShortcut) {
      setExceptionSeverity(severityFilterShortcut);
      setExceptionPage(1);
    }
  }, [severityFilterShortcut]);

  const loadTasks = useCallback(async () => {
    const requestId = ++lastTaskRequestIdRef.current;
    try {
      setIsLoading(true);
      setError(null);
      const filters: TaskListFilters = {
        page: taskPage,
        limit: taskLimit,
      };

      if (selectedStatus !== 'ALL') {
        filters.status = selectedStatus as TaskStatus;
      }
      if (selectedPriority !== 'ALL') {
        filters.priority = selectedPriority as TaskPriority;
      }
      if (selectedQueueId) {
        filters.assignedQueueId = selectedQueueId;
      }
      if (onlyMyTasks && currentUserId) {
        filters.assignedUserId = currentUserId;
      }

      const res = await operationalApiClient.listTasks(filters);
      if (requestId === lastTaskRequestIdRef.current) {
        setTasks(res.data);
        setTaskTotal(res.pagination.total);
      }
    } catch (err: any) {
      if (requestId === lastTaskRequestIdRef.current) {
        setError(err.message || (isRtl ? 'فشل تحميل المهام التشغيلية' : 'Failed to load operational tasks'));
      }
    } finally {
      if (requestId === lastTaskRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [taskPage, taskLimit, selectedStatus, selectedPriority, selectedQueueId, onlyMyTasks, currentUserId, isRtl]);

  const loadExceptions = useCallback(async () => {
    const requestId = ++lastExceptionRequestIdRef.current;
    try {
      setIsLoading(true);
      setError(null);
      const filters: ExceptionListFilters = {
        page: exceptionPage,
        limit: exceptionLimit,
      };

      if (exceptionStatus !== 'ALL') {
        filters.status = exceptionStatus as ExceptionStatus;
      }
      if (exceptionSeverity !== 'ALL') {
        filters.severity = exceptionSeverity as ExceptionSeverity;
      }

      const res = await operationalApiClient.listExceptions(filters);
      if (requestId === lastExceptionRequestIdRef.current) {
        setExceptions(res.data);
        setExceptionTotal(res.pagination.total);
      }
    } catch (err: any) {
      if (requestId === lastExceptionRequestIdRef.current) {
        setError(err.message || (isRtl ? 'فشل تحميل الاستثناءات التشغيلية' : 'Failed to load operational exceptions'));
      }
    } finally {
      if (requestId === lastExceptionRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [exceptionPage, exceptionLimit, exceptionStatus, exceptionSeverity, isRtl]);

  useEffect(() => {
    if (activeTab === 'tasks') {
      loadTasks();
    } else {
      loadExceptions();
    }
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        if (activeTab === 'tasks') {
          loadTasks();
        } else {
          loadExceptions();
        }
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [activeTab, loadTasks, loadExceptions]);

  // Client-side text search filter
  const filteredTasks = tasks.filter((t) => {
    if (!taskSearch.trim()) return true;
    const q = taskSearch.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      t.taskTypeCode.toLowerCase().includes(q) ||
      (t.shipmentId && t.shipmentId.toLowerCase().includes(q)) ||
      (t.description && t.description.toLowerCase().includes(q))
    );
  });

  const filteredExceptions = exceptions.filter((exc) => {
    if (!taskSearch.trim()) return true;
    const q = taskSearch.toLowerCase();
    return (
      exc.exceptionTypeCode.toLowerCase().includes(q) ||
      (exc.shipmentId && exc.shipmentId.toLowerCase().includes(q)) ||
      (exc.entityId && exc.entityId.toLowerCase().includes(q))
    );
  });

  // Map TaskStatus to Step 2 StatusBadge tone
  const getTaskStatusTone = (status: TaskStatus) => {
    switch (status) {
      case 'OPEN':
        return 'info';
      case 'ACKNOWLEDGED':
        return 'purple';
      case 'IN_PROGRESS':
        return 'warning';
      case 'BLOCKED':
        return 'danger';
      case 'RESOLVED':
        return 'success';
      case 'CLOSED':
      case 'CANCELLED':
      default:
        return 'neutral';
    }
  };

  // Map ExceptionSeverity to Step 2 StatusBadge tone
  const getExceptionSeverityTone = (severity: ExceptionSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return 'danger';
      case 'URGENT':
        return 'warning';
      case 'HIGH':
        return 'warning';
      case 'NORMAL':
        return 'info';
      case 'LOW':
      default:
        return 'neutral';
    }
  };

  const isOverdue = (dueAt: string | null | undefined, status: TaskStatus) => {
    if (!dueAt || status === 'RESOLVED' || status === 'CLOSED' || status === 'CANCELLED') return false;
    return new Date(dueAt).getTime() < Date.now();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xs space-y-0" dir={dir}>
      {/* Control Filters Bar */}
      <div className="p-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          {/* Search Box */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={taskSearch}
              onChange={(e) => setTaskSearch(e.target.value)}
              placeholder={
                activeTab === 'tasks'
                  ? isRtl
                    ? 'بحث في المهام، الكود، الشحنة...'
                    : 'Search tasks, type, shipment...'
                  : isRtl
                  ? 'بحث في الاستثناءات...'
                  : 'Search exceptions...'
              }
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg ps-8 pe-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
            />
          </div>

          {activeTab === 'tasks' ? (
            <>
              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setTaskPage(1);
                }}
                className="bg-slate-900 border border-slate-700/80 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-amber-500 cursor-pointer transition-colors"
              >
                <option value="ALL">{isRtl ? 'كافة الحالات' : 'All Statuses'}</option>
                <option value="OPEN">{isRtl ? 'مفتوحة (OPEN)' : 'OPEN'}</option>
                <option value="ACKNOWLEDGED">{isRtl ? 'مقرّ بها (ACKNOWLEDGED)' : 'ACKNOWLEDGED'}</option>
                <option value="IN_PROGRESS">{isRtl ? 'قيد العمل (IN_PROGRESS)' : 'IN_PROGRESS'}</option>
                <option value="BLOCKED">{isRtl ? 'متوقفة (BLOCKED)' : 'BLOCKED'}</option>
                <option value="RESOLVED">{isRtl ? 'تم الحل (RESOLVED)' : 'RESOLVED'}</option>
                <option value="CLOSED">{isRtl ? 'مغلقة (CLOSED)' : 'CLOSED'}</option>
              </select>

              {/* Priority Filter */}
              <select
                value={selectedPriority}
                onChange={(e) => {
                  setSelectedPriority(e.target.value);
                  setTaskPage(1);
                }}
                className="bg-slate-900 border border-slate-700/80 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-amber-500 cursor-pointer transition-colors"
              >
                <option value="ALL">{isRtl ? 'كافة الأولويات' : 'All Priorities'}</option>
                <option value="CRITICAL">{isRtl ? 'حرجة (CRITICAL)' : 'CRITICAL'}</option>
                <option value="URGENT">{isRtl ? 'عاجلة (URGENT)' : 'URGENT'}</option>
                <option value="HIGH">{isRtl ? 'مرتفعة (HIGH)' : 'HIGH'}</option>
                <option value="NORMAL">{isRtl ? 'عادية (NORMAL)' : 'NORMAL'}</option>
                <option value="LOW">{isRtl ? 'منخفضة (LOW)' : 'LOW'}</option>
              </select>

              {/* Only My Tasks Toggle */}
              {currentUserId && (
                <button
                  type="button"
                  onClick={() => {
                    setOnlyMyTasks(!onlyMyTasks);
                    setTaskPage(1);
                  }}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                    onlyMyTasks
                      ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                      : 'bg-slate-900 text-slate-300 border-slate-700/80 hover:text-white'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>{isRtl ? 'مهامي فقط' : 'My Tasks'}</span>
                </button>
              )}
            </>
          ) : (
            <>
              {/* Exception Status */}
              <select
                value={exceptionStatus}
                onChange={(e) => {
                  setExceptionStatus(e.target.value);
                  setExceptionPage(1);
                }}
                className="bg-slate-900 border border-slate-700/80 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-amber-500 cursor-pointer transition-colors"
              >
                <option value="ALL">{isRtl ? 'كافة الحالات' : 'All'}</option>
                <option value="ACTIVE">{isRtl ? 'نشط (ACTIVE)' : 'ACTIVE'}</option>
                <option value="RESOLVED">{isRtl ? 'تمت معالجته (RESOLVED)' : 'RESOLVED'}</option>
                <option value="SUPPRESSED">{isRtl ? 'تم تجاهله (SUPPRESSED)' : 'SUPPRESSED'}</option>
              </select>

              {/* Exception Severity */}
              <select
                value={exceptionSeverity}
                onChange={(e) => {
                  setExceptionSeverity(e.target.value);
                  setExceptionPage(1);
                }}
                className="bg-slate-900 border border-slate-700/80 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-amber-500 cursor-pointer transition-colors"
              >
                <option value="ALL">{isRtl ? 'كافة درجات الخطورة' : 'All Severities'}</option>
                <option value="CRITICAL">{isRtl ? 'حرجة (CRITICAL)' : 'CRITICAL'}</option>
                <option value="URGENT">{isRtl ? 'عاجلة (URGENT)' : 'URGENT'}</option>
                <option value="HIGH">{isRtl ? 'مرتفعة (HIGH)' : 'HIGH'}</option>
                <option value="NORMAL">{isRtl ? 'عادية (NORMAL)' : 'NORMAL'}</option>
              </select>
            </>
          )}
        </div>

        {/* Refresh & Pagination Summary */}
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="font-mono tabular-nums">
            {isRtl ? 'إجمالي السجلات:' : 'Total:'}{' '}
            <strong className="text-white">{activeTab === 'tasks' ? taskTotal : exceptionTotal}</strong>
          </span>
          <button
            type="button"
            onClick={activeTab === 'tasks' ? loadTasks : loadExceptions}
            disabled={isLoading}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 transition-all cursor-pointer disabled:opacity-50"
            title={isRtl ? 'تحديث السجلات' : 'Refresh records'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error View */}
      {error && (
        <div className="p-3 bg-red-950/60 border-b border-red-800 text-red-300 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={activeTab === 'tasks' ? loadTasks : loadExceptions}
            className="px-2.5 py-1 rounded-md bg-red-900/60 hover:bg-red-800 text-red-100 font-semibold text-[11px] transition-colors cursor-pointer"
          >
            {isRtl ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </div>
      )}

      {/* Data View */}
      <div className="overflow-x-auto">
        {activeTab === 'tasks' ? (
          <>
            {/* Mobile Card List (md:hidden) */}
            <div className="block md:hidden divide-y divide-slate-800/60">
              {isLoading && tasks.length === 0 ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="p-3 rounded-lg bg-slate-950/40 border border-slate-800/60 space-y-2.5">
                      <div className="flex justify-between">
                        <Skeleton variant="text" width="70px" height="18px" />
                        <Skeleton variant="text" width="80px" height="18px" />
                      </div>
                      <Skeleton variant="text" width="100%" height="16px" />
                      <div className="flex justify-between pt-1">
                        <Skeleton variant="text" width="90px" height="14px" />
                        <Skeleton variant="text" width="80px" height="14px" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="py-12 px-4">
                  <EmptyState
                    icon={<CheckCircle2 className="w-8 h-8 text-slate-600" />}
                    title={isRtl ? 'لا توجد مهام تشغيلية' : 'No Operational Tasks'}
                    description={
                      taskSearch || selectedStatus !== 'ALL' || selectedPriority !== 'ALL'
                        ? isRtl
                          ? 'لا توجد مهام تطابق معايير التصفية الحالية.'
                          : 'No tasks match current filter criteria.'
                        : isRtl
                        ? 'كافة المهام مكتملة ومنفذة بنجاح.'
                        : 'All tasks completed successfully.'
                    }
                  />
                </div>
              ) : (
                filteredTasks.map((task) => {
                  const isSelected = selectedTaskId === task.id;
                  const overdue = isOverdue(task.dueAt, task.status);
                  return (
                    <div
                      key={task.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelectTask(task.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectTask(task.id);
                        }
                      }}
                      className={`p-3.5 space-y-2.5 hover:bg-slate-800/50 transition-colors cursor-pointer text-start ${
                        isSelected ? 'bg-amber-950/25 border-s-4 border-amber-500' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <PriorityIndicator priority={task.priority} size="sm" />
                        <StatusBadge
                          status={task.status}
                          tone={getTaskStatusTone(task.status)}
                          size="sm"
                        />
                      </div>

                      <div>
                        <div className="font-bold text-white text-xs leading-snug">{task.title}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">{task.taskTypeCode}</div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2 pt-1.5 border-t border-slate-800/50">
                        {task.shipmentId ? (
                          <span className="font-mono text-amber-400 font-bold">
                            {task.shipmentId}
                          </span>
                        ) : (
                          <span className="font-mono text-slate-400">
                            {task.entityType}: {task.entityId.slice(0, 8)}
                          </span>
                        )}

                        <div className="flex items-center gap-2.5">
                          {task.assignedUserName ? (
                            <span className="text-slate-300 font-medium">
                              {task.assignedUserName}
                            </span>
                          ) : (
                            <span className="text-amber-400/80 italic">
                              {isRtl ? 'غير مسند' : 'Unassigned'}
                            </span>
                          )}

                          {task.dueAt && (
                            <span className={`font-mono ${overdue ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>
                              {new Date(task.dueAt).toLocaleTimeString(isRtl ? 'ar-JO' : 'en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table (hidden md:table) */}
            <table className="hidden md:table w-full text-xs text-start border-collapse">
              <thead>
                <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 select-none">
                  <th className="py-2.5 px-3 text-start font-bold">{isRtl ? 'الأولوية' : 'Priority'}</th>
                  <th className="py-2.5 px-3 text-start font-bold">{isRtl ? 'المهمة' : 'Task'}</th>
                  <th className="py-2.5 px-3 text-start font-bold">{isRtl ? 'الكيان / الشحنة' : 'Entity / Shipment'}</th>
                  <th className="py-2.5 px-3 text-start font-bold">{isRtl ? 'الطابور' : 'Queue'}</th>
                  <th className="py-2.5 px-3 text-start font-bold">{isRtl ? 'المسؤول' : 'Assignee'}</th>
                  <th className="py-2.5 px-3 text-start font-bold">{isRtl ? 'الحالة' : 'Status'}</th>
                  <th className="py-2.5 px-3 text-start font-bold">{isRtl ? 'الاستحقاق (SLA)' : 'Due SLA'}</th>
                  <th className="py-2.5 px-3 text-center font-bold">{isRtl ? 'إجراء' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {isLoading && tasks.length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-3 px-3"><Skeleton variant="text" width="60px" height="18px" /></td>
                      <td className="py-3 px-3"><Skeleton variant="text" width="160px" height="16px" /></td>
                      <td className="py-3 px-3"><Skeleton variant="text" width="90px" height="14px" /></td>
                      <td className="py-3 px-3"><Skeleton variant="text" width="80px" height="14px" /></td>
                      <td className="py-3 px-3"><Skeleton variant="text" width="80px" height="14px" /></td>
                      <td className="py-3 px-3"><Skeleton variant="text" width="70px" height="18px" /></td>
                      <td className="py-3 px-3"><Skeleton variant="text" width="60px" height="14px" /></td>
                      <td className="py-3 px-3 text-center"><Skeleton variant="text" width="50px" height="24px" className="mx-auto" /></td>
                    </tr>
                  ))
                ) : filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      <EmptyState
                        icon={<CheckCircle2 className="w-8 h-8 text-slate-600" />}
                        title={isRtl ? 'لا توجد مهام تشغيلية' : 'No Operational Tasks'}
                        description={
                          taskSearch || selectedStatus !== 'ALL' || selectedPriority !== 'ALL'
                            ? isRtl
                              ? 'لا توجد مهام تطابق معايير التصفية المحددة.'
                              : 'No tasks match current filter criteria.'
                            : isRtl
                            ? 'كافة المهام مكتملة ومنفذة بنجاح.'
                            : 'All operational tasks are completed.'
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task) => {
                    const isSelected = selectedTaskId === task.id;
                    const overdue = isOverdue(task.dueAt, task.status);
                    return (
                      <tr
                        key={task.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelectTask(task.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelectTask(task.id);
                          }
                        }}
                        className={`hover:bg-slate-800/60 transition-colors cursor-pointer ${
                          isSelected ? 'bg-amber-950/25 border-s-2 border-amber-500' : ''
                        }`}
                      >
                        {/* Priority */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <PriorityIndicator priority={task.priority} size="sm" />
                        </td>

                        {/* Title & Type */}
                        <td className="py-2.5 px-3 max-w-xs">
                          <div className="font-bold text-white truncate">{task.title}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{task.taskTypeCode}</div>
                        </td>

                        {/* Entity / Shipment */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {task.shipmentId ? (
                            <span className="font-mono text-amber-400 font-bold hover:underline">
                              {task.shipmentId}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">
                              {task.entityType}: {task.entityId.slice(0, 8)}
                            </span>
                          )}
                        </td>

                        {/* Queue */}
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-300">
                          {task.assignedQueueNameAr || task.assignedQueueId || '—'}
                        </td>

                        {/* Assignee */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {task.assignedUserId ? (
                            <div className="flex items-center gap-1.5 text-slate-300">
                              <div className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                                U
                              </div>
                              <span className="truncate max-w-[100px]">{task.assignedUserName || task.assignedUserId.slice(0, 6)}</span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-amber-400/80 italic">
                              {isRtl ? 'غير مسند' : 'Unassigned'}
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <StatusBadge
                            status={task.status}
                            tone={getTaskStatusTone(task.status)}
                            size="sm"
                          />
                        </td>

                        {/* SLA */}
                        <td className="py-2.5 px-3 whitespace-nowrap text-[11px]">
                          {task.dueAt ? (
                            <span className={`font-mono ${overdue ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>
                              {new Date(task.dueAt).toLocaleTimeString(isRtl ? 'ar-JO' : 'en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectTask(task.id);
                            }}
                            className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 text-[11px] font-bold transition-all cursor-pointer border border-slate-700/60"
                          >
                            {isRtl ? 'معاينة' : 'View'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </>
        ) : (
          <table className="w-full text-xs text-start border-collapse">
            <thead>
              <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 select-none">
                <th className="py-2.5 px-3 text-start font-bold">{isRtl ? 'درجة الخطورة' : 'Severity'}</th>
                <th className="py-2.5 px-3 text-start font-bold">{isRtl ? 'رمز الاستثناء' : 'Exception Code'}</th>
                <th className="py-2.5 px-3 text-start font-bold">{isRtl ? 'الكيان / الشحنة' : 'Entity / Shipment'}</th>
                <th className="py-2.5 px-3 text-start font-bold">{isRtl ? 'الحالة' : 'Status'}</th>
                <th className="py-2.5 px-3 text-start font-bold">{isRtl ? 'أول رصد' : 'First Detected'}</th>
                <th className="py-2.5 px-3 text-start font-bold">{isRtl ? 'التكرار' : 'Count'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading && exceptions.length === 0 ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-3 px-3"><Skeleton variant="text" width="60px" height="18px" /></td>
                    <td className="py-3 px-3"><Skeleton variant="text" width="120px" height="16px" /></td>
                    <td className="py-3 px-3"><Skeleton variant="text" width="90px" height="14px" /></td>
                    <td className="py-3 px-3"><Skeleton variant="text" width="60px" height="18px" /></td>
                    <td className="py-3 px-3"><Skeleton variant="text" width="110px" height="14px" /></td>
                    <td className="py-3 px-3"><Skeleton variant="text" width="40px" height="14px" /></td>
                  </tr>
                ))
              ) : filteredExceptions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <EmptyState
                      icon={<ShieldAlert className="w-8 h-8 text-emerald-500/60" />}
                      title={isRtl ? 'لا توجد استثناءات تشغيلية' : 'No Operational Exceptions'}
                      description={
                        taskSearch || exceptionStatus !== 'ALL' || exceptionSeverity !== 'ALL'
                          ? isRtl
                            ? 'لا توجد استثناءات تطابق شروط التصفية.'
                            : 'No exceptions match current filter criteria.'
                          : isRtl
                          ? 'العمليات اللوجستية تسير بدون استثناءات نشطة.'
                          : 'Logistics operations running cleanly.'
                      }
                    />
                  </td>
                </tr>
              ) : (
                filteredExceptions.map((exc) => (
                  <tr key={exc.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <StatusBadge
                        tone={getExceptionSeverityTone(exc.severity)}
                        label={exc.severity}
                        size="sm"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-white font-mono">{exc.exceptionTypeCode}</span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {exc.shipmentId ? (
                        <span className="font-mono text-amber-400 font-bold">{exc.shipmentId}</span>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">
                          {exc.entityType}: {exc.entityId.slice(0, 8)}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <StatusBadge
                        status={exc.status}
                        tone={exc.status === 'ACTIVE' ? 'warning' : exc.status === 'RESOLVED' ? 'success' : 'neutral'}
                        size="sm"
                      />
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-400 text-[11px]">
                      {new Date(exc.firstDetectedAt).toLocaleString(isRtl ? 'ar-JO' : 'en-US')}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap font-mono text-slate-300 tabular-nums">
                      {exc.occurrenceCount}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <div>
          {activeTab === 'tasks' ? (
            <span className="font-mono tabular-nums">
              {isRtl ? 'صفحة' : 'Page'} {taskPage} {isRtl ? 'من' : 'of'}{' '}
              {Math.ceil(taskTotal / taskLimit) || 1}
            </span>
          ) : (
            <span className="font-mono tabular-nums">
              {isRtl ? 'صفحة' : 'Page'} {exceptionPage} {isRtl ? 'من' : 'of'}{' '}
              {Math.ceil(exceptionTotal / exceptionLimit) || 1}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {activeTab === 'tasks' ? (
            <>
              <button
                type="button"
                onClick={() => setTaskPage((p) => Math.max(1, p - 1))}
                disabled={taskPage <= 1}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-300 disabled:opacity-40 cursor-pointer transition-colors"
                title={isRtl ? 'الصفحة السابقة' : 'Previous page'}
              >
                {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => setTaskPage((p) => p + 1)}
                disabled={taskPage * taskLimit >= taskTotal}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-300 disabled:opacity-40 cursor-pointer transition-colors"
                title={isRtl ? 'الصفحة التالية' : 'Next page'}
              >
                {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setExceptionPage((p) => Math.max(1, p - 1))}
                disabled={exceptionPage <= 1}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-300 disabled:opacity-40 cursor-pointer transition-colors"
                title={isRtl ? 'الصفحة السابقة' : 'Previous page'}
              >
                {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => setExceptionPage((p) => p + 1)}
                disabled={exceptionPage * exceptionLimit >= exceptionTotal}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-300 disabled:opacity-40 cursor-pointer transition-colors"
                title={isRtl ? 'الصفحة التالية' : 'Next page'}
              >
                {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

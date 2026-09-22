/**
 * DELIVERE — TASK DETAIL DRAWER (PHASE 3C / STEP 4.2)
 *
 * Master-detail operational drawer for Authoritative Tasks.
 * Displays safe task metadata, linked exception context, authoritative audit timeline,
 * and optimistic-concurrency state transitions (Claim, Assign, Acknowledge, Start, Block, Unblock, Resolve).
 *
 * Visual style: Logistics OS Master-Detail panel using Step 2 foundation (Drawer, Modal, StatusBadge, PriorityIndicator, Button).
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  User,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Ban,
  ExternalLink,
  Layers,
  History,
  Check,
} from 'lucide-react';
import {
  TaskDetailDTO,
  InternalTaskDTO,
  TaskPriority,
  TaskStatus,
  ExceptionSeverity,
} from '../types/operationalTasks';
import { operationalApiClient } from '../services/operationalApiClient';
import {
  Drawer,
  Modal,
  Button,
  StatusBadge,
  PriorityIndicator,
  Skeleton,
} from './ui';

interface TaskDetailDrawerProps {
  taskId: string | null;
  onClose: () => void;
  onTaskUpdated: (task: InternalTaskDTO) => void;
  currentUserId?: string;
  dir?: 'rtl' | 'ltr';
  onNavigateToShipment?: (shipmentId: string) => void;
}

export const TaskDetailDrawer: React.FC<TaskDetailDrawerProps> = ({
  taskId,
  onClose,
  onTaskUpdated,
  currentUserId,
  dir = 'rtl',
  onNavigateToShipment,
}) => {
  const isRtl = dir === 'rtl';
  const [taskDetail, setTaskDetail] = useState<TaskDetailDTO | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Monotonic fetch request counter to prevent out-of-order race conditions
  const lastFetchIdRef = useRef<number>(0);

  // Mutation Modals
  const [showBlockModal, setShowBlockModal] = useState<boolean>(false);
  const [blockReason, setBlockReason] = useState<string>('');
  const [showResolveModal, setShowResolveModal] = useState<boolean>(false);
  const [resolutionCode, setResolutionCode] = useState<string>('RESOLVED_MANUAL');
  const [resolutionNotes, setResolutionNotes] = useState<string>('');

  useEffect(() => {
    if (!taskId) {
      setTaskDetail(null);
      setMutationError(null);
      setError(null);
      return;
    }

    const fetchId = ++lastFetchIdRef.current;
    setIsLoading(true);
    setError(null);
    setMutationError(null);

    operationalApiClient
      .getTask(taskId)
      .then((data) => {
        if (fetchId === lastFetchIdRef.current) {
          setTaskDetail(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (fetchId === lastFetchIdRef.current) {
          setError(err.message || (isRtl ? 'فشل تحميل تفاصيل المهمة' : 'Failed to load task details'));
          setIsLoading(false);
        }
      });
  }, [taskId, isRtl]);

  const handleClaim = async () => {
    if (!taskDetail) return;
    try {
      setActionLoading('claim');
      setMutationError(null);
      const updated = await operationalApiClient.claimTask(taskDetail.id, {
        expectedVersion: taskDetail.version,
      });
      setTaskDetail((prev) => (prev ? { ...prev, ...updated } : null));
      onTaskUpdated(updated);
    } catch (err: any) {
      const errCode =
        err.code ||
        (err.message && err.message.includes('STALE')
          ? 'STALE_TASK_VERSION'
          : err.message && err.message.includes('CLAIMED')
          ? 'TASK_ALREADY_CLAIMED'
          : 'UNKNOWN_ERROR');

      if (errCode === 'STALE_TASK_VERSION') {
        setMutationError(
          isRtl
            ? 'تعارض في النسخة: تم تعديل بيانات المهمة بواسطة مستخدم آخر. تم تحديث البيانات تلقائياً.'
            : 'Stale task version: Task was updated by another operator. Latest data reloaded.'
        );
      } else if (errCode === 'TASK_ALREADY_CLAIMED') {
        setMutationError(
          isRtl
            ? 'المهمة مستلمة مسبقاً: قام مشغل آخر باستلام هذه المهمة بالفعل.'
            : 'Task already claimed: Another operator has already claimed this task.'
        );
      } else {
        setMutationError(err.message || (isRtl ? 'فشل استلام المهمة' : 'Failed to claim task'));
      }

      // Authoritative task refetch on conflict / error
      try {
        const fresh = await operationalApiClient.getTask(taskDetail.id);
        setTaskDetail(fresh);
        onTaskUpdated(fresh);
      } catch {
        // Refetch error handled silently
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleStart = async () => {
    if (!taskDetail) return;
    try {
      setActionLoading('start');
      setMutationError(null);
      const updated = await operationalApiClient.updateTaskStatus(taskDetail.id, {
        targetStatus: 'IN_PROGRESS',
        expectedVersion: taskDetail.version,
      });
      setTaskDetail((prev) => (prev ? { ...prev, ...updated } : null));
      onTaskUpdated(updated);
    } catch (err: any) {
      const errCode = err.code || (err.message && err.message.includes('STALE') ? 'STALE_TASK_VERSION' : 'UNKNOWN_ERROR');
      if (errCode === 'STALE_TASK_VERSION') {
        setMutationError(
          isRtl
            ? 'تعارض في النسخة: تم تعديل بيانات المهمة من قبل مستخدم آخر. جاري تحديث البيانات.'
            : 'Stale task version: Task was modified by another operator. Reloading latest data.'
        );
      } else {
        setMutationError(err.message || (isRtl ? 'فشل بدء العمل على المهمة' : 'Failed to start task'));
      }
      try {
        const fresh = await operationalApiClient.getTask(taskDetail.id);
        setTaskDetail(fresh);
        onTaskUpdated(fresh);
      } catch {}
    } finally {
      setActionLoading(null);
    }
  };

  const handleAcknowledge = async () => {
    if (!taskDetail) return;
    try {
      setActionLoading('ack');
      setMutationError(null);
      const updated = await operationalApiClient.updateTaskStatus(taskDetail.id, {
        targetStatus: 'ACKNOWLEDGED',
        expectedVersion: taskDetail.version,
      });
      setTaskDetail((prev) => (prev ? { ...prev, ...updated } : null));
      onTaskUpdated(updated);
    } catch (err: any) {
      const errCode = err.code || (err.message && err.message.includes('STALE') ? 'STALE_TASK_VERSION' : 'UNKNOWN_ERROR');
      if (errCode === 'STALE_TASK_VERSION') {
        setMutationError(
          isRtl
            ? 'تعارض في النسخة: تم تعديل بيانات المهمة. جاري التحديث.'
            : 'Stale task version: Task was modified. Reloading.'
        );
      } else {
        setMutationError(err.message || (isRtl ? 'فشل إقرار المهمة' : 'Failed to acknowledge task'));
      }
      try {
        const fresh = await operationalApiClient.getTask(taskDetail.id);
        setTaskDetail(fresh);
        onTaskUpdated(fresh);
      } catch {}
    } finally {
      setActionLoading(null);
    }
  };

  const handleBlock = async () => {
    if (!taskDetail || !blockReason.trim()) return;
    try {
      setActionLoading('block');
      setMutationError(null);
      const updated = await operationalApiClient.updateTaskStatus(taskDetail.id, {
        targetStatus: 'BLOCKED',
        reason: blockReason.trim(),
        expectedVersion: taskDetail.version,
      });
      setTaskDetail((prev) => (prev ? { ...prev, ...updated } : null));
      onTaskUpdated(updated);
      setShowBlockModal(false);
      setBlockReason('');
    } catch (err: any) {
      const errCode = err.code || (err.message && err.message.includes('STALE') ? 'STALE_TASK_VERSION' : 'UNKNOWN_ERROR');
      if (errCode === 'STALE_TASK_VERSION') {
        setMutationError(
          isRtl
            ? 'تعارض في النسخة: تم تعديل بيانات المهمة. جاري التحديث.'
            : 'Stale task version: Task was modified. Reloading.'
        );
      } else {
        setMutationError(err.message || (isRtl ? 'فشل تعليق المهمة' : 'Failed to block task'));
      }
      try {
        const fresh = await operationalApiClient.getTask(taskDetail.id);
        setTaskDetail(fresh);
        onTaskUpdated(fresh);
      } catch {}
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnblock = async () => {
    if (!taskDetail) return;
    try {
      setActionLoading('unblock');
      setMutationError(null);
      const updated = await operationalApiClient.updateTaskStatus(taskDetail.id, {
        targetStatus: 'IN_PROGRESS',
        reason: 'Unblocked by operator',
        expectedVersion: taskDetail.version,
      });
      setTaskDetail((prev) => (prev ? { ...prev, ...updated } : null));
      onTaskUpdated(updated);
    } catch (err: any) {
      const errCode = err.code || (err.message && err.message.includes('STALE') ? 'STALE_TASK_VERSION' : 'UNKNOWN_ERROR');
      if (errCode === 'STALE_TASK_VERSION') {
        setMutationError(
          isRtl
            ? 'تعارض في النسخة: تم تعديل بيانات المهمة. جاري التحديث.'
            : 'Stale task version: Task was modified. Reloading.'
        );
      } else {
        setMutationError(err.message || (isRtl ? 'فشل فك تعليق المهمة' : 'Failed to unblock task'));
      }
      try {
        const fresh = await operationalApiClient.getTask(taskDetail.id);
        setTaskDetail(fresh);
        onTaskUpdated(fresh);
      } catch {}
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolve = async () => {
    if (!taskDetail) return;
    try {
      setActionLoading('resolve');
      setMutationError(null);
      const updated = await operationalApiClient.resolveTask(taskDetail.id, {
        resolutionCode,
        resolutionNotes: resolutionNotes.trim() || undefined,
        expectedVersion: taskDetail.version,
      });
      setTaskDetail((prev) => (prev ? { ...prev, ...updated } : null));
      onTaskUpdated(updated);
      setShowResolveModal(false);
    } catch (err: any) {
      const errCode = err.code || (err.message && err.message.includes('STALE') ? 'STALE_TASK_VERSION' : 'UNKNOWN_ERROR');
      if (errCode === 'STALE_TASK_VERSION') {
        setMutationError(
          isRtl
            ? 'تعارض في النسخة: تم تعديل بيانات المهمة. جاري التحديث.'
            : 'Stale task version: Task was modified. Reloading.'
        );
      } else {
        setMutationError(err.message || (isRtl ? 'فشل إنهاء المهمة' : 'Failed to resolve task'));
      }
      try {
        const fresh = await operationalApiClient.getTask(taskDetail.id);
        setTaskDetail(fresh);
        onTaskUpdated(fresh);
      } catch {}
    } finally {
      setActionLoading(null);
    }
  };

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

  const drawerTitle = taskDetail ? (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
        <Layers className="w-4 h-4" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-slate-400">
            #{taskDetail.id.slice(0, 8)}
          </span>
          <PriorityIndicator priority={taskDetail.priority} size="sm" />
          <StatusBadge
            status={taskDetail.status}
            tone={getTaskStatusTone(taskDetail.status)}
            size="sm"
          />
        </div>
        <h2 className="text-sm font-bold text-white mt-0.5 leading-snug">
          {taskDetail.title}
        </h2>
      </div>
    </div>
  ) : (
    <span className="text-sm font-bold text-white">
      {isRtl ? 'تفاصيل المهمة التشغيلية' : 'Task Details'}
    </span>
  );

  return (
    <>
      <Drawer
        isOpen={Boolean(taskId)}
        onClose={onClose}
        title={drawerTitle}
        width="xl"
        side={isRtl ? 'left' : 'right'}
        className="bg-slate-900 border-slate-800 text-slate-200"
      >
        <div className="space-y-5 p-1" dir={dir}>
          {isLoading && (
            <div className="space-y-4 py-4">
              <Skeleton variant="text" width="60%" height="20px" />
              <Skeleton variant="rect" height="90px" className="rounded-lg" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton variant="rect" height="70px" className="rounded-lg" />
                <Skeleton variant="rect" height="70px" className="rounded-lg" />
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-950/60 border border-red-800 rounded-lg text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {mutationError && (
            <div className="p-3 bg-amber-950/60 border border-amber-800 rounded-lg text-amber-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>{mutationError}</span>
            </div>
          )}

          {taskDetail && !isLoading && (
            <>
              {/* Action Toolbar */}
              <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400">
                  {isRtl ? 'الإجراءات المتاحة:' : 'Available Actions:'}
                </span>

                {/* Claim action */}
                {!taskDetail.assignedUserId && taskDetail.status !== 'CLOSED' && taskDetail.status !== 'CANCELLED' && (
                  <Button
                    variant="primary"
                    size="compact"
                    onClick={handleClaim}
                    isLoading={actionLoading === 'claim'}
                    disabled={Boolean(actionLoading)}
                    iconStart={<User className="w-3.5 h-3.5" />}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border-none"
                  >
                    {isRtl ? 'استلام المهمة (Claim)' : 'Claim'}
                  </Button>
                )}

                {/* Acknowledge */}
                {taskDetail.status === 'OPEN' && taskDetail.assignedUserId && (
                  <Button
                    variant="primary"
                    size="compact"
                    onClick={handleAcknowledge}
                    isLoading={actionLoading === 'ack'}
                    disabled={Boolean(actionLoading)}
                    iconStart={<Check className="w-3.5 h-3.5" />}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white"
                  >
                    {isRtl ? 'إقرار بالاستلام (Acknowledge)' : 'Acknowledge'}
                  </Button>
                )}

                {/* Start */}
                {(taskDetail.status === 'OPEN' || taskDetail.status === 'ACKNOWLEDGED') && (
                  <Button
                    variant="primary"
                    size="compact"
                    onClick={handleStart}
                    isLoading={actionLoading === 'start'}
                    disabled={Boolean(actionLoading)}
                    iconStart={<Clock className="w-3.5 h-3.5" />}
                    className="bg-blue-600 hover:bg-blue-500 text-white"
                  >
                    {isRtl ? 'بدء العمل (Start)' : 'Start Work'}
                  </Button>
                )}

                {/* Block */}
                {taskDetail.status !== 'BLOCKED' && taskDetail.status !== 'RESOLVED' && taskDetail.status !== 'CLOSED' && taskDetail.status !== 'CANCELLED' && (
                  <Button
                    variant="secondary"
                    size="compact"
                    onClick={() => setShowBlockModal(true)}
                    disabled={Boolean(actionLoading)}
                    iconStart={<Ban className="w-3.5 h-3.5 text-red-400" />}
                    className="hover:bg-red-950 hover:text-red-300 hover:border-red-800"
                  >
                    {isRtl ? 'تعليق (Block)' : 'Block'}
                  </Button>
                )}

                {/* Unblock */}
                {taskDetail.status === 'BLOCKED' && (
                  <Button
                    variant="primary"
                    size="compact"
                    onClick={handleUnblock}
                    isLoading={actionLoading === 'unblock'}
                    disabled={Boolean(actionLoading)}
                    iconStart={<CheckCircle2 className="w-3.5 h-3.5" />}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    {isRtl ? 'فك التعليق (Unblock)' : 'Unblock'}
                  </Button>
                )}

                {/* Resolve */}
                {taskDetail.status !== 'RESOLVED' && taskDetail.status !== 'CLOSED' && taskDetail.status !== 'CANCELLED' && (
                  <Button
                    variant="primary"
                    size="compact"
                    onClick={() => setShowResolveModal(true)}
                    disabled={Boolean(actionLoading)}
                    iconStart={<CheckCircle2 className="w-3.5 h-3.5" />}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    {isRtl ? 'معالجة وإنهاء (Resolve)' : 'Resolve'}
                  </Button>
                )}
              </div>

              {/* Description & Context */}
              <div className="bg-slate-950/50 p-3.5 rounded-lg border border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-slate-400 block">
                  {isRtl ? 'الوصف والتفاصيل التشغيلية:' : 'Description & Context:'}
                </span>
                <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {taskDetail.description || (isRtl ? 'لا يوجد وصف تفصيلي للمهمة.' : 'No description provided.')}
                </p>

                {taskDetail.blockedReason && (
                  <div className="p-2.5 bg-red-950/50 border border-red-900 rounded-md text-xs text-red-300 flex items-start gap-2 mt-2">
                    <Ban className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                    <div>
                      <span className="font-bold block">{isRtl ? 'سبب التعليق:' : 'Blocked Reason:'}</span>
                      <span>{taskDetail.blockedReason}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Task Metadata Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[11px]">{isRtl ? 'نوع المهمة' : 'Task Type'}</span>
                  <div className="font-bold text-white font-mono">{taskDetail.taskTypeCode}</div>
                </div>

                <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[11px]">{isRtl ? 'الطابور المسند' : 'Assigned Queue'}</span>
                  <div className="font-bold text-amber-400">{taskDetail.assignedQueueNameAr || taskDetail.assignedQueueId || '—'}</div>
                </div>

                <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[11px]">{isRtl ? 'الموظف المسؤول' : 'Assignee'}</span>
                  <div className="font-bold text-white">{taskDetail.assignedUserName || taskDetail.assignedUserId || (isRtl ? 'غير مسند' : 'Unassigned')}</div>
                </div>

                <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[11px]">{isRtl ? 'موعد الاستحقاق (SLA)' : 'Due SLA'}</span>
                  <div className="font-bold text-slate-300 font-mono">
                    {taskDetail.dueAt ? new Date(taskDetail.dueAt).toLocaleString(isRtl ? 'ar-JO' : 'en-US') : '—'}
                  </div>
                </div>

                {taskDetail.shipmentId && (
                  <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800 space-y-1 col-span-2 flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 text-[11px]">{isRtl ? 'الشحنة المرتبطة' : 'Linked Shipment'}</span>
                      <div className="font-bold text-amber-400 font-mono">{taskDetail.shipmentId}</div>
                    </div>
                    {onNavigateToShipment && (
                      <Button
                        variant="secondary"
                        size="compact"
                        onClick={() => onNavigateToShipment(taskDetail.shipmentId!)}
                        iconStart={<ExternalLink className="w-3 h-3" />}
                      >
                        {isRtl ? 'عرض الشحنة' : 'View Shipment'}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Linked Exception Section (Independent from Task Resolution) */}
              {taskDetail.linkedException && (
                <div className="p-3.5 bg-rose-950/20 border border-rose-900/60 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-rose-300 flex items-center gap-1.5">
                      <AlertOctagon className="w-3.5 h-3.5" />
                      {isRtl ? 'الاستثناء التشغيلي المرتبط:' : 'Linked Operational Exception:'}
                    </span>
                    <StatusBadge
                      tone={getExceptionSeverityTone(taskDetail.linkedException.severity)}
                      label={taskDetail.linkedException.severity}
                      size="sm"
                    />
                  </div>
                  <div className="text-xs text-slate-300 space-y-1">
                    <div className="font-mono text-white font-semibold">{taskDetail.linkedException.exceptionTypeCode}</div>
                    <div className="text-slate-400 text-[11px]">
                      {isRtl ? 'رُصد لأول مرة:' : 'First detected:'}{' '}
                      {new Date(taskDetail.linkedException.firstDetectedAt).toLocaleString(isRtl ? 'ar-JO' : 'en-US')}
                    </div>
                  </div>
                </div>
              )}

              {/* Audit Event Timeline */}
              {taskDetail.events && taskDetail.events.length > 0 && (
                <div className="space-y-3 pt-2">
                  <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    {isRtl ? 'سجل التدقيق والتحولات التشغيلية (Authoritative Audit):' : 'Authoritative Audit Events:'}
                  </span>
                  <div className="space-y-2 border-s-2 border-slate-800 ps-3 ms-1">
                    {taskDetail.events.map((evt) => (
                      <div key={evt.id} className="text-xs space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-amber-400 font-mono text-[11px]">{evt.eventType}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(evt.occurredAt).toLocaleTimeString(isRtl ? 'ar-JO' : 'en-US')}
                          </span>
                        </div>
                        <div className="text-slate-400 text-[11px]">
                          {isRtl ? 'المستخدم:' : 'Actor:'} {evt.actorName || evt.actorRole || evt.actorUserId}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Drawer>

      {/* Modal: Block Reason */}
      <Modal
        isOpen={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        title={
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Ban className="w-4 h-4 text-red-400" />
            <span>{isRtl ? 'تعليق المهمة التشغيلية' : 'Block Operational Task'}</span>
          </div>
        }
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              size="compact"
              onClick={() => setShowBlockModal(false)}
            >
              {isRtl ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              variant="danger"
              size="compact"
              onClick={handleBlock}
              isLoading={actionLoading === 'block'}
              disabled={!blockReason.trim() || Boolean(actionLoading)}
            >
              {isRtl ? 'تأكيد التعليق' : 'Confirm Block'}
            </Button>
          </div>
        }
      >
        <div className="space-y-2 text-xs" dir={dir}>
          <label className="text-slate-300 block font-medium">{isRtl ? 'سبب التعليق:' : 'Reason for block:'}</label>
          <textarea
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            placeholder={isRtl ? 'وضح سبب إيقاف المهمة (مثلاً بانتظار رد العميل)...' : 'Specify blocking reason...'}
            className="w-full h-24 bg-slate-950 border border-slate-700/80 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
          />
        </div>
      </Modal>

      {/* Modal: Resolve */}
      <Modal
        isOpen={showResolveModal}
        onClose={() => setShowResolveModal(false)}
        title={
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{isRtl ? 'إنهاء ومعالجة المهمة' : 'Resolve Task'}</span>
          </div>
        }
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              size="compact"
              onClick={() => setShowResolveModal(false)}
            >
              {isRtl ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              variant="primary"
              size="compact"
              onClick={handleResolve}
              isLoading={actionLoading === 'resolve'}
              disabled={Boolean(actionLoading)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {isRtl ? 'تأكيد الحل' : 'Confirm Resolve'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3.5 text-xs" dir={dir}>
          <div>
            <label className="text-slate-300 block mb-1 font-medium">{isRtl ? 'رمز الحل:' : 'Resolution Code:'}</label>
            <select
              value={resolutionCode}
              onChange={(e) => setResolutionCode(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg p-2 text-xs text-white focus:outline-hidden focus:border-amber-500 transition-colors"
            >
              <option value="RESOLVED_MANUAL">{isRtl ? 'معالجة يدوية من الموظف' : 'Manual staff resolution'}</option>
              <option value="CUSTOMER_CONTACTED">{isRtl ? 'تم التواصل مع العميل بنجاح' : 'Customer successfully contacted'}</option>
              <option value="ADDRESS_UPDATED">{isRtl ? 'تم تصحيح العنوان والموقع' : 'Address corrected'}</option>
              <option value="RESCHEDULED">{isRtl ? 'تمت إعادة جدولة التسليم' : 'Delivery rescheduled'}</option>
              <option value="RETURN_PROCESSED">{isRtl ? 'تم اعتماد الإرجاع' : 'Return processed'}</option>
            </select>
          </div>
          <div>
            <label className="text-slate-300 block mb-1 font-medium">{isRtl ? 'ملاحظات الحل:' : 'Resolution Notes:'}</label>
            <textarea
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder={isRtl ? 'تفاصيل إضافية حول كيفية الحل...' : 'Optional resolution notes...'}
              className="w-full h-20 bg-slate-950 border border-slate-700/80 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
            />
          </div>
        </div>
      </Modal>
    </>
  );
};

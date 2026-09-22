/**
 * DELIVERE — OPERATIONAL STATUS STRIP (STEP 4.1 DESIGN SYSTEM MIGRATION)
 *
 * High-density operational attention strip for the Logistics Control Tower.
 * Consumes authoritative /api/operational/attention-summary endpoint.
 *
 * Invariants:
 * - 100% DB-backed authoritative metrics (no local simulation)
 * - Step 2 Primitive integration (StatusBadge, Skeleton, PriorityIndicator, Button, IconButton)
 * - Receding 0-count styling and high-contrast alert indicators
 * - Accessible keyboard navigation and semantic labels
 * - Zero marketing fluff, high operational density
 */

import React from 'react';
import {
  AlertTriangle,
  AlertOctagon,
  Inbox,
  UserX,
  Clock,
  Ban,
  Layers,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { AttentionSummaryDTO } from '../types/operationalTasks';
import { Skeleton } from './ui/Skeleton';
import { StatusBadge } from './ui/StatusBadge';

interface OperationalStatusStripProps {
  summary: AttentionSummaryDTO | null;
  isLoading: boolean;
  error?: string | null;
  lastUpdated?: string | null;
  onRefresh: () => void;
  onSelectQueueFilter?: (queueId: string | null) => void;
  onSelectStatusFilter?: (status: string) => void;
  onSelectSeverityFilter?: (severity: string) => void;
  selectedQueueId?: string | null;
  activeTab?: 'tasks' | 'exceptions' | 'overview';
  onTabChange?: (tab: 'tasks' | 'exceptions' | 'overview') => void;
  dir?: 'rtl' | 'ltr';
}

export const OperationalStatusStrip: React.FC<OperationalStatusStripProps> = ({
  summary,
  isLoading,
  error,
  lastUpdated,
  onRefresh,
  onSelectQueueFilter,
  onSelectStatusFilter,
  onSelectSeverityFilter,
  selectedQueueId,
  activeTab,
  onTabChange,
  dir = 'rtl',
}) => {
  const isRtl = dir === 'rtl';

  // Loading skeleton state
  if (isLoading && !summary) {
    return (
      <div className="bg-slate-900 text-slate-100 rounded-xl p-4 shadow-sm border border-slate-800 space-y-4" dir={dir}>
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Skeleton variant="circle" width="36px" height="36px" />
            <div className="space-y-1.5">
              <Skeleton variant="text" width="220px" height="18px" />
              <Skeleton variant="text" width="160px" height="12px" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton variant="rect" width="180px" height="32px" className="rounded-lg" />
            <Skeleton variant="rect" width="36px" height="32px" className="rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rect" height="74px" className="rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // Error State with Retry
  if (error && !summary) {
    return (
      <div className="bg-slate-900 border border-rose-500/30 rounded-xl p-4 text-slate-100 flex items-center justify-between gap-4" dir={dir}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-rose-300">
              {isRtl ? 'تعذر تحميل ملخص التنبيهات التشغيلية' : 'Failed to load operational attention summary'}
            </h3>
            <p className="text-xs text-slate-400">{error}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{isRtl ? 'إعادة المحاولة' : 'Retry'}</span>
        </button>
      </div>
    );
  }

  const criticalAndUrgent = (summary?.criticalExceptionsCount || 0) + (summary?.urgentExceptionsCount || 0);
  const unassigned = summary?.unassignedTasksCount || 0;
  const overdue = summary?.overdueTasksCount || 0;
  const blocked = summary?.blockedTasksCount || 0;
  const open = summary?.openTasksCount || 0;
  const unifiedTotal = summary?.needsAttentionUnifiedCount || 0;

  return (
    <div className="bg-slate-900 text-slate-100 rounded-xl p-3.5 sm:p-4 shadow-sm border border-slate-800 space-y-3.5" dir={dir}>
      {/* 1. Context & Control Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <AlertTriangle className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                {isRtl ? 'حالة التنبيهات والمهام التشغيلية' : 'Operational Attention & Task Status'}
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {isRtl ? 'بيانات تشغيلية موثقة' : 'Authoritative operational data'}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
              {isRtl
                ? 'مؤشرات الإجراءات المطلوبة فوراً للحفاظ على تدفق الشحنات وسلامة العمليات'
                : 'Direct action required to maintain parcel flow and operational SLA'}
            </p>
          </div>
        </div>

        {/* Action Controls & Tab Switcher */}
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="hidden sm:inline-block text-[10px] text-slate-400 font-mono">
              {isRtl ? `آخر تحديث: ${lastUpdated}` : `Updated: ${lastUpdated}`}
            </span>
          )}

          {onTabChange && (
            <div className="inline-flex rounded-lg bg-slate-950 p-0.5 border border-slate-800 text-xs font-medium">
              <button
                type="button"
                onClick={() => onTabChange('tasks')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                  activeTab === 'tasks'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {isRtl ? 'صندوق المهام' : 'Tasks Inbox'}
              </button>
              <button
                type="button"
                onClick={() => onTabChange('exceptions')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                  activeTab === 'exceptions'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {isRtl ? 'الاستثناءات النشطة' : 'Active Exceptions'}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 sm:p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
            title={isRtl ? 'تحديث فوري' : 'Refresh'}
            aria-label={isRtl ? 'تحديث فوري للبيانات' : 'Refresh authoritative data'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Primary Attention Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
        {/* Card 1: Unified Needs Attention */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            onSelectStatusFilter?.('ALL');
            onTabChange?.('tasks');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelectStatusFilter?.('ALL');
              onTabChange?.('tasks');
            }
          }}
          className={`bg-slate-950/70 border p-2.5 sm:p-3 rounded-lg cursor-pointer transition-all flex flex-col justify-between ${
            unifiedTotal > 0
              ? 'border-slate-800 hover:border-amber-500/50'
              : 'border-slate-800/40 opacity-70 hover:opacity-100'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium truncate">{isRtl ? 'إجمالي الحالات' : 'Total Attention'}</span>
            <Inbox className={`w-3.5 h-3.5 ${unifiedTotal > 0 ? 'text-amber-400' : 'text-slate-500'}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className={`text-xl sm:text-2xl font-bold font-mono tabular-nums ${
              unifiedTotal > 0 ? 'text-amber-400' : 'text-slate-500'
            }`}>
              {unifiedTotal}
            </span>
            <span className="text-[10px] text-slate-400">{isRtl ? 'حالة' : 'items'}</span>
          </div>
        </div>

        {/* Card 2: Critical & Urgent Exceptions */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            onSelectSeverityFilter?.('CRITICAL');
            onTabChange?.('exceptions');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelectSeverityFilter?.('CRITICAL');
              onTabChange?.('exceptions');
            }
          }}
          className={`bg-slate-950/70 border p-2.5 sm:p-3 rounded-lg cursor-pointer transition-all flex flex-col justify-between ${
            criticalAndUrgent > 0
              ? 'border-rose-500/30 bg-rose-500/5 hover:border-rose-500/60'
              : 'border-slate-800/40 opacity-70 hover:opacity-100'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium truncate">{isRtl ? 'استثناءات حرجة' : 'Critical / Urgent'}</span>
            <AlertOctagon className={`w-3.5 h-3.5 ${criticalAndUrgent > 0 ? 'text-rose-400' : 'text-slate-500'}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className={`text-xl sm:text-2xl font-bold font-mono tabular-nums ${
              criticalAndUrgent > 0 ? 'text-rose-400' : 'text-slate-500'
            }`}>
              {criticalAndUrgent}
            </span>
            <span className="text-[10px] text-slate-400">{isRtl ? 'استثناء' : 'exc'}</span>
          </div>
        </div>

        {/* Card 3: Unassigned Tasks */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            onSelectStatusFilter?.('UNASSIGNED');
            onTabChange?.('tasks');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelectStatusFilter?.('UNASSIGNED');
              onTabChange?.('tasks');
            }
          }}
          className={`bg-slate-950/70 border p-2.5 sm:p-3 rounded-lg cursor-pointer transition-all flex flex-col justify-between ${
            unassigned > 0
              ? 'border-slate-800 hover:border-amber-500/50'
              : 'border-slate-800/40 opacity-70 hover:opacity-100'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium truncate">{isRtl ? 'مهام غير مسندة' : 'Unassigned'}</span>
            <UserX className={`w-3.5 h-3.5 ${unassigned > 0 ? 'text-amber-300' : 'text-slate-500'}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className={`text-xl sm:text-2xl font-bold font-mono tabular-nums ${
              unassigned > 0 ? 'text-white' : 'text-slate-500'
            }`}>
              {unassigned}
            </span>
            <span className="text-[10px] text-slate-400">{isRtl ? 'مهمة' : 'tasks'}</span>
          </div>
        </div>

        {/* Card 4: Overdue SLA */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            onSelectStatusFilter?.('OVERDUE');
            onTabChange?.('tasks');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelectStatusFilter?.('OVERDUE');
              onTabChange?.('tasks');
            }
          }}
          className={`bg-slate-950/70 border p-2.5 sm:p-3 rounded-lg cursor-pointer transition-all flex flex-col justify-between ${
            overdue > 0
              ? 'border-orange-500/30 bg-orange-500/5 hover:border-orange-500/60'
              : 'border-slate-800/40 opacity-70 hover:opacity-100'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium truncate">{isRtl ? 'متجاوزة للوقت' : 'Overdue SLA'}</span>
            <Clock className={`w-3.5 h-3.5 ${overdue > 0 ? 'text-orange-400' : 'text-slate-500'}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className={`text-xl sm:text-2xl font-bold font-mono tabular-nums ${
              overdue > 0 ? 'text-orange-400' : 'text-slate-500'
            }`}>
              {overdue}
            </span>
            <span className="text-[10px] text-slate-400">{isRtl ? 'مهمة' : 'tasks'}</span>
          </div>
        </div>

        {/* Card 5: Blocked Tasks */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            onSelectStatusFilter?.('BLOCKED');
            onTabChange?.('tasks');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelectStatusFilter?.('BLOCKED');
              onTabChange?.('tasks');
            }
          }}
          className={`bg-slate-950/70 border p-2.5 sm:p-3 rounded-lg cursor-pointer transition-all flex flex-col justify-between ${
            blocked > 0
              ? 'border-red-500/30 bg-red-500/5 hover:border-red-500/60'
              : 'border-slate-800/40 opacity-70 hover:opacity-100'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium truncate">{isRtl ? 'مهام متوقفة' : 'Blocked Tasks'}</span>
            <Ban className={`w-3.5 h-3.5 ${blocked > 0 ? 'text-red-400' : 'text-slate-500'}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className={`text-xl sm:text-2xl font-bold font-mono tabular-nums ${
              blocked > 0 ? 'text-red-400' : 'text-slate-500'
            }`}>
              {blocked}
            </span>
            <span className="text-[10px] text-slate-400">{isRtl ? 'مهمة' : 'tasks'}</span>
          </div>
        </div>

        {/* Card 6: Open Tasks */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            onSelectStatusFilter?.('OPEN');
            onTabChange?.('tasks');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelectStatusFilter?.('OPEN');
              onTabChange?.('tasks');
            }
          }}
          className={`bg-slate-950/70 border p-2.5 sm:p-3 rounded-lg cursor-pointer transition-all flex flex-col justify-between ${
            open > 0
              ? 'border-slate-800 hover:border-emerald-500/50'
              : 'border-slate-800/40 opacity-70 hover:opacity-100'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium truncate">{isRtl ? 'مهام قيد العمل' : 'Open Tasks'}</span>
            <Layers className={`w-3.5 h-3.5 ${open > 0 ? 'text-emerald-400' : 'text-slate-500'}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className={`text-xl sm:text-2xl font-bold font-mono tabular-nums ${
              open > 0 ? 'text-emerald-400' : 'text-slate-500'
            }`}>
              {open}
            </span>
            <span className="text-[10px] text-slate-400">{isRtl ? 'مهمة' : 'tasks'}</span>
          </div>
        </div>
      </div>

      {/* 3. Operational Queues Carousel Chips */}
      {summary && summary.summaryByQueue && summary.summaryByQueue.length > 0 && (
        <div className="pt-2 border-t border-slate-800 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap">
            {isRtl ? 'الطوابير التشغيلية:' : 'Operational Queues:'}
          </span>
          <button
            type="button"
            onClick={() => onSelectQueueFilter?.(null)}
            className={`text-xs px-2.5 py-1 rounded-md transition-all whitespace-nowrap cursor-pointer ${
              selectedQueueId === null || selectedQueueId === undefined
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            {isRtl ? 'كافة الطوابير' : 'All Queues'}
          </button>
          {summary.summaryByQueue.map((q) => (
            <button
              key={q.queueCode}
              type="button"
              onClick={() => onSelectQueueFilter?.(q.queueId)}
              className={`text-xs px-2.5 py-1 rounded-md transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                selectedQueueId === q.queueId
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <span>{q.queueNameAr || q.queueCode}</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono tabular-nums bg-slate-950/60 text-amber-400 font-bold">
                {q.openTasks}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * DELIVERE — LOGISTICS CONTROL TOWER (OPERATIONS HOME)
 * File: src/components/OperationsDashboardGrid.tsx
 *
 * Primary Operational Command Workspace for Operations & Admins.
 *
 * Invariants:
 * - 100% DB-backed and loaded-data authoritative metrics (Zero fake/mock fallbacks)
 * - Zero unsafe financial claims (Monthly profit and accounting proxies removed)
 * - Authoritative Needs Attention & Exceptions powered by operationalApiClient
 * - Compact horizontal status strip with true 0s (no mock or screenshot fallbacks)
 * - High-density active shipments operational table
 * - Master-detail task drawer integration
 * - RTL first, dark obsidian accents, enterprise logistics SaaS density
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  AlertOctagon,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  Layers,
  Package,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  Truck,
  UserCheck,
  UserX,
  XCircle,
} from 'lucide-react';
import { Order, OrderStatus } from '../types/logistics';
import {
  AttentionSummaryDTO,
  InternalExceptionDTO,
  InternalTaskDTO,
} from '../types/operationalTasks';
import { operationalApiClient } from '../services/operationalApiClient';
import { StatusBadge, PriorityIndicator, Skeleton } from './ui';
import { TaskDetailDrawer } from './TaskDetailDrawer';

export interface OperationsDashboardGridProps {
  orders: Order[];
  onSelectMetricFilter: (filterKey: string, status?: OrderStatus | 'ALL') => void;
  onNavigateToSection?: (section: string) => void;
  onViewOrderDetails?: (order: Order) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export const OperationsDashboardGrid: React.FC<OperationsDashboardGridProps> = ({
  orders,
  onSelectMetricFilter,
  onNavigateToSection,
  onViewOrderDetails,
  onRefresh,
  isLoading = false,
}) => {
  // Time scope filter
  const [timeScope, setTimeScope] = useState<'today' | 'this_week' | 'this_month' | 'all'>('all');
  const [tableSearch, setTableSearch] = useState<string>('');

  // Authoritative operational attention & task state
  const [attentionSummary, setAttentionSummary] = useState<AttentionSummaryDTO | null>(null);
  const [recentExceptions, setRecentExceptions] = useState<InternalExceptionDTO[]>([]);
  const [recentTasks, setRecentTasks] = useState<InternalTaskDTO[]>([]);
  const [isAttentionLoading, setIsAttentionLoading] = useState<boolean>(false);
  const [attentionError, setAttentionError] = useState<string | null>(null);

  // Active queue tab: exceptions vs tasks
  const [activeQueueTab, setActiveQueueTab] = useState<'exceptions' | 'tasks'>('exceptions');

  // Master-detail drawer state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Fetch authoritative attention summary and recent active items
  const fetchAttentionData = useCallback(async () => {
    setIsAttentionLoading(true);
    setAttentionError(null);
    try {
      const [summary, exceptionsRes, tasksRes] = await Promise.all([
        operationalApiClient.getAttentionSummary().catch((err) => {
          console.error('Failed to load attention summary:', err);
          return null;
        }),
        operationalApiClient.getExceptions({ status: 'ACTIVE', limit: 5 }).catch(() => ({ data: [] })),
        operationalApiClient.getTasks({ status: ['OPEN', 'BLOCKED', 'IN_PROGRESS'], limit: 5 }).catch(() => ({ data: [] })),
      ]);

      if (summary) {
        setAttentionSummary(summary);
      }
      setRecentExceptions(exceptionsRes.data || []);
      setRecentTasks(tasksRes.data || []);
    } catch (err: any) {
      setAttentionError(err.message || 'تعذر تحميل بيانات الاستثناءات التشغيلية');
    } finally {
      setIsAttentionLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAttentionData();
  }, [fetchAttentionData]);

  // Handle master refresh
  const handleFullRefresh = () => {
    fetchAttentionData();
    if (onRefresh) {
      onRefresh();
    }
  };

  // Scope filter calculation for loaded orders
  const filteredOrders = useMemo(() => {
    let result = orders;

    // Time filter
    if (timeScope !== 'all') {
      const now = new Date();
      if (timeScope === 'today') {
        const todayStr = now.toISOString().slice(0, 10);
        result = result.filter((o) => o.createdAt.startsWith(todayStr));
      } else if (timeScope === 'this_week') {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        result = result.filter((o) => new Date(o.createdAt) >= oneWeekAgo);
      } else if (timeScope === 'this_month') {
        const currentMonthStr = now.toISOString().slice(0, 7);
        result = result.filter((o) => o.createdAt.startsWith(currentMonthStr));
      }
    }

    // Search filter
    if (tableSearch.trim()) {
      const q = tableSearch.trim().toLowerCase();
      result = result.filter(
        (o) =>
          o.trackingNumber.toLowerCase().includes(q) ||
          (o.recipientName && o.recipientName.toLowerCase().includes(q)) ||
          (o.recipientPhone && o.recipientPhone.includes(q)) ||
          (o.merchantName && o.merchantName.toLowerCase().includes(q)) ||
          (o.governorate && o.governorate.toLowerCase().includes(q))
      );
    }

    return result;
  }, [orders, timeScope, tableSearch]);

  // Authoritative status counts derived strictly from loaded dataset (Zero fake fallbacks!)
  const totalLoaded = orders.length;
  const activeOrders = orders.filter(
    (o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && o.status !== 'RETURNED'
  ).length;
  const pickupOrders = orders.filter((o) => o.status === 'PENDING' || o.status === 'PICKING').length;
  const inHubOrders = orders.filter((o) => o.status === 'RECEIVED_AT_HUB').length;
  const outForDeliveryOrders = orders.filter((o) => o.status === 'OUT_FOR_DELIVERY').length;
  const postponedOrders = orders.filter((o) => o.status === 'POSTPONED').length;
  const returnedOrders = orders.filter((o) => o.status === 'RETURNED').length;
  const deliveredOrders = orders.filter((o) => o.status === 'DELIVERED').length;

  return (
    <div className="space-y-4 mb-6 font-sans text-slate-900" dir="rtl">
      {/* ========================================================================= */}
      {/* 1. CONTROL TOWER HEADER & FILTERS                                         */}
      {/* ========================================================================= */}
      <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Title & Status */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-lg sm:text-xl text-white tracking-tight">
                  لوحة العمليات
                </h1>
                <span className="text-[11px] bg-slate-800 text-slate-300 font-mono font-medium px-2 py-0.5 rounded border border-slate-700">
                  CONTROL TOWER
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                مركز التحكم التشغيلي للشحنات والمهام والاستثناءات
              </p>
            </div>
          </div>

          {/* Controls: Time Scope & Refresh */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setTimeScope('today')}
                className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                  timeScope === 'today'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                اليوم
              </button>
              <button
                type="button"
                onClick={() => setTimeScope('this_week')}
                className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                  timeScope === 'this_week'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                هذا الأسبوع
              </button>
              <button
                type="button"
                onClick={() => setTimeScope('this_month')}
                className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                  timeScope === 'this_month'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                هذا الشهر
              </button>
              <button
                type="button"
                onClick={() => setTimeScope('all')}
                className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                  timeScope === 'all'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                كافة البيانات
              </button>
            </div>

            <button
              type="button"
              onClick={handleFullRefresh}
              disabled={isLoading || isAttentionLoading}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
              title="تحديث البيانات التشغيلية"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-amber-400 ${
                  isLoading || isAttentionLoading ? 'animate-spin' : ''
                }`}
              />
              <span className="hidden sm:inline">تحديث</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. OPERATIONAL STATUS STRIP (Zero cards - Dense monochrome metrics)       */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5 font-bold text-slate-700">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>شريط المؤشرات التشغيلية</span>
            <span className="text-slate-400 font-normal">
              (حسب الشحنات المحملة: {totalLoaded})
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            AUTHORITATIVE METRICS
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {/* Active Shipments */}
          <div
            onClick={() => onSelectMetricFilter('ACTIVE')}
            className="p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-xs text-slate-600 font-bold">
              <span>الطلبيات النشطة</span>
              <span className="w-2 h-2 rounded-full bg-blue-500" />
            </div>
            <div className="mt-2 text-xl font-black font-mono tabular-nums text-slate-900">
              {activeOrders}
            </div>
          </div>

          {/* Pickup */}
          <div
            onClick={() => onSelectMetricFilter('PICKUP', 'PENDING')}
            className="p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-xs text-slate-600 font-bold">
              <span>مرحلة الاستلام</span>
              <span className="w-2 h-2 rounded-full bg-amber-500" />
            </div>
            <div className="mt-2 text-xl font-black font-mono tabular-nums text-slate-900">
              {pickupOrders}
            </div>
          </div>

          {/* At Hub */}
          <div
            onClick={() => onSelectMetricFilter('WAREHOUSE', 'RECEIVED_AT_HUB')}
            className="p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-xs text-slate-600 font-bold">
              <span>في المستودع والفرع</span>
              <span className="w-2 h-2 rounded-full bg-purple-500" />
            </div>
            <div className="mt-2 text-xl font-black font-mono tabular-nums text-slate-900">
              {inHubOrders}
            </div>
          </div>

          {/* Out for Delivery (Zero Displays as 0 - Strictly Authoritative) */}
          <div
            onClick={() => onSelectMetricFilter('DISPATCH', 'OUT_FOR_DELIVERY')}
            className="p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-xs text-slate-600 font-bold">
              <span>جاري التوصيل</span>
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
            </div>
            <div className="mt-2 text-xl font-black font-mono tabular-nums text-slate-900">
              {outForDeliveryOrders}
            </div>
          </div>

          {/* Postponed */}
          <div
            onClick={() => onSelectMetricFilter('POSTPONED', 'POSTPONED')}
            className="p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-xs text-slate-600 font-bold">
              <span>مؤجل</span>
              <span className="w-2 h-2 rounded-full bg-amber-600" />
            </div>
            <div className="mt-2 text-xl font-black font-mono tabular-nums text-slate-900">
              {postponedOrders}
            </div>
          </div>

          {/* Returned */}
          <div
            onClick={() => onSelectMetricFilter('RETURNED', 'RETURNED')}
            className="p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-xs text-slate-600 font-bold">
              <span>مرتجع</span>
              <span className="w-2 h-2 rounded-full bg-rose-500" />
            </div>
            <div className="mt-2 text-xl font-black font-mono tabular-nums text-slate-900">
              {returnedOrders}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. LIVE OPERATIONS FLOW PIPELINE                                          */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100 text-xs font-bold text-slate-700">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-amber-500" />
            <span>مسار التدفق التشغيلي للشحنات (Operational Lifecycle)</span>
          </div>
          <span className="text-[11px] text-slate-400 font-normal">
            المجموع الكلي: {totalLoaded} شحنة
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
          {/* Stage 1: Pickup */}
          <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
            <span className="text-slate-500 font-semibold text-[11px]">1. استلام الشحنة</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-mono font-black text-lg text-slate-800">{pickupOrders}</span>
              <span className="text-[10px] text-slate-400">قيد الاستلام</span>
            </div>
          </div>

          {/* Stage 2: Hub */}
          <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
            <span className="text-slate-500 font-semibold text-[11px]">2. وصول المركز والفرز</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-mono font-black text-lg text-slate-800">{inHubOrders}</span>
              <span className="text-[10px] text-slate-400">في المستودع</span>
            </div>
          </div>

          {/* Stage 3: Out for Delivery */}
          <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
            <span className="text-slate-500 font-semibold text-[11px]">3. جاري التوزيع</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-mono font-black text-lg text-slate-800">{outForDeliveryOrders}</span>
              <span className="text-[10px] text-slate-400">مع السائق</span>
            </div>
          </div>

          {/* Stage 4: Delivered */}
          <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/40 flex flex-col justify-between">
            <span className="text-emerald-700 font-semibold text-[11px]">4. تم التسليم بنجاح</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-mono font-black text-lg text-emerald-800">{deliveredOrders}</span>
              <span className="text-[10px] text-emerald-600">مكتمل</span>
            </div>
          </div>

          {/* Stage 5: Reverse / Exceptions */}
          <div className="p-2.5 rounded-lg border border-rose-200 bg-rose-50/40 flex flex-col justify-between col-span-2 md:col-span-1">
            <span className="text-rose-700 font-semibold text-[11px]">5. مؤجل ومرتجع</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-mono font-black text-lg text-rose-800">
                {postponedOrders + returnedOrders}
              </span>
              <span className="text-[10px] text-rose-600">تدفق عكسي</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. PRIMARY OPERATIONAL AREA: AUTHORITATIVE NEEDS ATTENTION & EXCEPTIONS   */}
      {/* ========================================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-white shadow-md space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <AlertOctagon className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">
                  مركز الاستثناءات والمهام التشغيلية
                </h2>
                {attentionSummary && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30 font-mono">
                    {attentionSummary.unifiedTotal} تنبيه نشط
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                المسار المعتمد لمعالجة الاستثناءات التشغيلية وحل المهام الحرجة
              </p>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setActiveQueueTab('exceptions')}
              className={`px-3 py-1 rounded-md font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeQueueTab === 'exceptions'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>الاستثناءات التشغيلية</span>
              {attentionSummary && attentionSummary.activeExceptionsCount > 0 && (
                <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                  {attentionSummary.activeExceptionsCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveQueueTab('tasks')}
              className={`px-3 py-1 rounded-md font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeQueueTab === 'tasks'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>المهام المعلقة</span>
              {attentionSummary && attentionSummary.openTasksCount > 0 && (
                <span className="bg-slate-700 text-slate-200 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                  {attentionSummary.openTasksCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Content Area */}
        {isAttentionLoading ? (
          <div className="py-6 flex items-center justify-center text-xs text-slate-400">
            <RefreshCw className="w-4 h-4 animate-spin me-2 text-amber-400" />
            <span>جاري استرجاع التنبيهات والمهام المعتمدة...</span>
          </div>
        ) : activeQueueTab === 'exceptions' ? (
          recentExceptions.length === 0 ? (
            /* Professional Zero-Data Experience */
            <div className="py-6 text-center text-xs text-slate-400 space-y-1">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto opacity-80 mb-1" />
              <div className="font-bold text-slate-200">
                لا توجد استثناءات تشغيلية تحتاج تدخلاً حالياً
              </div>
              <div className="text-[11px] text-slate-500">
                كافة العمليات المجدولة تسير وفق مؤشرات الأداء المعتمدة
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {recentExceptions.map((ex) => (
                <div
                  key={ex.id}
                  className="bg-slate-950/80 border border-slate-800 hover:border-amber-500/40 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors"
                >
                  <div className="flex items-start gap-2.5">
                    <PriorityIndicator
                      priority={ex.severity as any}
                      size="sm"
                      className="mt-0.5"
                    />
                    <div>
                      <div className="flex items-center gap-2 font-bold text-slate-200">
                        <span>{ex.exceptionTypeCode}</span>
                        {ex.shipmentId && (
                          <span className="font-mono text-slate-400 text-[11px]">
                            شحنة: {ex.shipmentId.slice(0, 8)}...
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-3">
                        <span>الكيان: {ex.entityType}</span>
                        <span>
                          رُصد لأول مرة: {new Date(ex.firstDetectedAt).toLocaleDateString('ar-JO')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onNavigateToSection && onNavigateToSection('operations')}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <span>معاينة في العمليات</span>
                      <ArrowRight className="w-3 h-3 rtl:rotate-180" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : recentTasks.length === 0 ? (
          /* Professional Zero-Data Experience */
          <div className="py-6 text-center text-xs text-slate-400 space-y-1">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto opacity-80 mb-1" />
            <div className="font-bold text-slate-200">لا توجد مهام تشغيلية مفتوحة</div>
            <div className="text-[11px] text-slate-500">
              صندوق المهام التشغيلية فارغ حالياً
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {recentTasks.map((task) => (
              <div
                key={task.id}
                className="bg-slate-950/80 border border-slate-800 hover:border-amber-500/40 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <PriorityIndicator
                    priority={task.priority}
                    size="sm"
                    className="mt-0.5"
                  />
                  <div>
                    <div className="flex items-center gap-2 font-bold text-slate-200">
                      <span>{task.title}</span>
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                        {task.taskTypeCode}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-3">
                      <span>الحالة: {task.status}</span>
                      <span>
                        المسند: {task.assignedUserName || task.assignedUserId ? 'مسند' : 'غير مسند'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedTaskId(task.id)}
                    className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <span>فتح التفاصيل</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. ACTIVE SHIPMENTS OPERATIONAL TABLE                                     */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-slate-600" />
            <h2 className="text-sm font-bold text-slate-800">
              جدول الشحنات التشغيلية النشطة
            </h2>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">
              {filteredOrders.length} شحنة
            </span>
          </div>

          {/* Quick Search */}
          <div className="relative max-w-xs w-full">
            <Search className="w-3.5 h-3.5 absolute start-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="بحث برقم التتبع، العميل، التاجر..."
              className="w-full text-xs ps-8 pe-3 py-1.5 rounded-lg border border-slate-300 focus:outline-hidden focus:border-amber-500"
            />
          </div>
        </div>

        {/* Table / Empty State */}
        {filteredOrders.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500 space-y-1.5">
            <Package className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="font-bold text-slate-700">لا توجد شحنات مطابقة للمعايير المحددة</div>
            <p className="text-[11px] text-slate-400">
              قم بتعديل فلتر البحث أو النطاق الزمني لعرض الشحنات
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-3">رقم التتبع / البوليصة</th>
                  <th className="py-2.5 px-3">التاجر</th>
                  <th className="py-2.5 px-3">المستلم والوجهة</th>
                  <th className="py-2.5 px-3">الحالة التشغيلية</th>
                  <th className="py-2.5 px-3">المندوب</th>
                  <th className="py-2.5 px-3">تاريخ ووقت الإنشاء</th>
                  <th className="py-2.5 px-3 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    {/* Tracking / Sequence */}
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                      {order.trackingNumber}
                    </td>

                    {/* Merchant */}
                    <td className="py-2.5 px-3 font-medium text-slate-700">
                      {order.merchantName || '—'}
                    </td>

                    {/* Recipient & Governorate */}
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-900">{order.recipientName}</div>
                      <div className="text-[11px] text-slate-500">
                        {order.governorate} {order.city ? `• ${order.city}` : ''}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-2.5 px-3">
                      <StatusBadge status={order.status} size="sm" />
                    </td>

                    {/* Assigned Driver */}
                    <td className="py-2.5 px-3 text-slate-600">
                      {order.driverName ? (
                        <div className="flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{order.driverName}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">غير مسند</span>
                      )}
                    </td>

                    {/* Created Date */}
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                      {new Date(order.createdAt).toLocaleString('ar-JO', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          if (onViewOrderDetails) {
                            onViewOrderDetails(order);
                          } else if (onNavigateToSection) {
                            onNavigateToSection('operations');
                          }
                        }}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        معاينة
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 6. MASTER-DETAIL TASK DRAWER INTEGRATION                                  */}
      {/* ========================================================================= */}
      {selectedTaskId && (
        <TaskDetailDrawer
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onTaskUpdated={() => {
            fetchAttentionData();
          }}
          dir="rtl"
          onNavigateToShipment={() => {
            setSelectedTaskId(null);
            if (onNavigateToSection) {
              onNavigateToSection('operations');
            }
          }}
        />
      )}
    </div>
  );
};

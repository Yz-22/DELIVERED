/**
 * DELIVERE — LOGISTICS CONTROL TOWER (STEP 4.1 DESIGN SYSTEM MIGRATION)
 *
 * Primary Operational Command Workspace.
 * Integrates:
 * 1. Authoritative Attention Summary Strip (`OperationalStatusStrip`)
 * 2. Operational Task Inbox & Exception Queue (`OperationalTaskInbox`)
 * 3. Master-Detail Task Drawer (`TaskDetailDrawer`)
 * 4. High-density operational action bar & filters
 *
 * Invariants:
 * - 100% authoritative DB-backed operations (no local simulation)
 * - Single 30-second polling cadence with document.visibilityState pause
 * - Step 2 Primitives (Skeleton, StatusBadge, Button, IconButton, EmptyState)
 * - RTL first, full LTR support
 * - Zero marketing images, zero AI slop, maximum operational density
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '../lib/i18n';
import { User, Order } from '../types/logistics';
import {
  Shield,
  Activity,
  Search,
  Barcode,
  PlusCircle,
  Zap,
  Globe,
  Clock,
  Layers,
  DollarSign,
  Package,
  RotateCcw,
  UserCheck,
  TrendingUp,
} from 'lucide-react';
import { AttentionSummaryDTO, InternalTaskDTO } from '../types/operationalTasks';
import { operationalApiClient } from '../services/operationalApiClient';
import { OperationalStatusStrip } from './OperationalStatusStrip';
import { OperationalTaskInbox } from './OperationalTaskInbox';
import { TaskDetailDrawer } from './TaskDetailDrawer';

interface LogisticsControlTowerProps {
  currentUser: User | null;
  orders: Order[];
  onOpenCreateModal: () => void;
  onOpenQuickOrderModal: () => void;
  onOpenScannerModal: () => void;
  onSelectSection: (section: string) => void;
  activeSubTab?: string;
}

export const LogisticsControlTower: React.FC<LogisticsControlTowerProps> = ({
  currentUser,
  orders,
  onOpenCreateModal,
  onOpenQuickOrderModal,
  onOpenScannerModal,
  onSelectSection,
}) => {
  const { t, language, toggleLanguage } = useI18n();
  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const isRtl = language === 'ar';

  const [currentTime, setCurrentTime] = useState<string>('');
  const [globalSearch, setGlobalSearch] = useState<string>('');

  // Authoritative Attention Summary State
  const [attentionSummary, setAttentionSummary] = useState<AttentionSummaryDTO | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState<boolean>(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Active View & Filter State
  const [activeTab, setActiveTab] = useState<'tasks' | 'exceptions' | 'overview'>('tasks');
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [statusFilterShortcut, setStatusFilterShortcut] = useState<string>('ALL');
  const [severityFilterShortcut, setSeverityFilterShortcut] = useState<string>('ALL');

  // Master-Detail State
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Request race condition guard ref
  const lastRequestIdRef = useRef<number>(0);

  // System Time Format
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString(language === 'ar' ? 'ar-JO' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [language]);

  // Load Authoritative Attention Summary
  const fetchAttentionSummary = useCallback(async () => {
    const requestId = ++lastRequestIdRef.current;
    try {
      setIsSummaryLoading(true);
      setSummaryError(null);
      const data = await operationalApiClient.getAttentionSummary();
      
      // Prevent stale response overwrite
      if (requestId === lastRequestIdRef.current) {
        setAttentionSummary(data);
        const now = new Date();
        setLastUpdated(
          now.toLocaleTimeString(language === 'ar' ? 'ar-JO' : 'en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        );
      }
    } catch (err: any) {
      if (requestId === lastRequestIdRef.current) {
        setSummaryError(err.message || (isRtl ? 'فشل تحميل بيانات التنبيهات التشغيلية' : 'Failed to fetch operational attention summary'));
      }
    } finally {
      if (requestId === lastRequestIdRef.current) {
        setIsSummaryLoading(false);
      }
    }
  }, [isRtl, language]);

  // 30-second Authoritative Polling Loop with Visibility Pause
  useEffect(() => {
    fetchAttentionSummary();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchAttentionSummary();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchAttentionSummary]);

  // Handle task update from Drawer (Mutation refetch)
  const handleTaskUpdated = (updatedTask: InternalTaskDTO) => {
    fetchAttentionSummary();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans" dir={dir}>
      {/* 1. TOP OPERATIONAL COMMAND BAR */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-3 sm:px-6 py-2.5 flex items-center justify-between shadow-md">
        {/* Left / Context Identity */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-2.5 sm:px-3 py-1.5 rounded-lg">
            <Shield className="w-4.5 h-4.5 text-amber-400" />
            <span className="font-black tracking-tight text-white text-sm sm:text-base">DELIVERE</span>
            <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
              {isRtl ? 'برج التحكم' : 'CONTROL TOWER'}
            </span>
          </div>

          {/* System Clock */}
          <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-mono tabular-nums">{currentTime || '00:00:00'}</span>
          </div>
        </div>

        {/* Center Search Input */}
        <div className="flex-1 max-w-xs sm:max-w-md mx-2 sm:mx-4">
          <div className="relative">
            <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              id="delivere-control-tower-search"
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder={isRtl ? 'بحث بالشحنات والمهام...' : 'Search shipments & tasks...'}
              className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 ps-8 sm:ps-9 pe-3 py-1.5 sm:py-2 rounded-lg focus:outline-hidden focus:border-amber-500 transition-all"
            />
          </div>
        </div>

        {/* Right / Quick Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Scanner */}
          <button
            type="button"
            onClick={onOpenScannerModal}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-700 transition-colors cursor-pointer"
            title={t.common.scan}
            aria-label={t.common.scan}
          >
            <Barcode className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
            <span className="hidden sm:inline">{t.common.scan}</span>
          </button>

          {/* Quick Order */}
          <button
            type="button"
            onClick={onOpenQuickOrderModal}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold px-2.5 sm:px-3 py-1.5 rounded-lg shadow-xs transition-all cursor-pointer"
            aria-label={t.common.quickOrder}
          >
            <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">{t.common.quickOrder}</span>
          </button>

          {/* Full New Order */}
          <button
            type="button"
            onClick={onOpenCreateModal}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-700 shadow-xs transition-all cursor-pointer"
            aria-label={t.common.newOrder}
          >
            <PlusCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
            <span className="hidden sm:inline">{t.common.newOrder}</span>
          </button>

          {/* Language Toggle */}
          <button
            type="button"
            onClick={toggleLanguage}
            className="flex items-center gap-1 bg-slate-950 hover:bg-slate-800 text-slate-300 text-xs font-semibold px-2 py-1.5 rounded-lg border border-slate-800 transition-colors cursor-pointer"
            aria-label="Toggle Language"
          >
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-mono">{language.toUpperCase()}</span>
          </button>
        </div>
      </header>

      {/* 2. OPERATIONAL NAVIGATION ENGINE */}
      <nav className="bg-slate-900/90 border-b border-slate-800 px-3 sm:px-6 py-1.5 overflow-x-auto flex items-center gap-1 text-xs no-scrollbar">
        <button
          type="button"
          onClick={() => onSelectSection('operations_grid')}
          className="flex items-center gap-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold px-2.5 sm:px-3 py-1.5 rounded-md cursor-pointer shrink-0"
        >
          <Activity className="w-3.5 h-3.5" />
          <span>{t.navigation.controlTower}</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectSection('operations')}
          className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 px-2.5 sm:px-3 py-1.5 rounded-md transition-colors cursor-pointer shrink-0"
        >
          <Package className="w-3.5 h-3.5" />
          <span>{t.navigation.orders}</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectSection('manifests')}
          className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 px-2.5 sm:px-3 py-1.5 rounded-md transition-colors cursor-pointer shrink-0"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{t.navigation.manifests}</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectSection('reverse_logistics')}
          className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 px-2.5 sm:px-3 py-1.5 rounded-md transition-colors cursor-pointer shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
          <span>{t.navigation.returns}</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectSection('settlements')}
          className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 px-2.5 sm:px-3 py-1.5 rounded-md transition-colors cursor-pointer shrink-0"
        >
          <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
          <span>{t.navigation.finance}</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectSection('users')}
          className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 px-2.5 sm:px-3 py-1.5 rounded-md transition-colors cursor-pointer shrink-0"
        >
          <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
          <span>{t.navigation.drivers}</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectSection('reports_statements')}
          className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 px-2.5 sm:px-3 py-1.5 rounded-md transition-colors cursor-pointer shrink-0"
        >
          <TrendingUp className="w-3.5 h-3.5 text-violet-400" />
          <span>{t.navigation.reports}</span>
        </button>
      </nav>

      {/* 3. MAIN WORKSPACE / CONTROL TOWER */}
      <main className="flex-1 p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-5 max-w-7xl w-full mx-auto">
        {/* Authoritative Operational Status Strip */}
        <OperationalStatusStrip
          summary={attentionSummary}
          isLoading={isSummaryLoading}
          error={summaryError}
          lastUpdated={lastUpdated}
          onRefresh={fetchAttentionSummary}
          onSelectQueueFilter={(qid) => setSelectedQueueId(qid)}
          onSelectStatusFilter={(st) => setStatusFilterShortcut(st)}
          onSelectSeverityFilter={(sev) => setSeverityFilterShortcut(sev)}
          selectedQueueId={selectedQueueId}
          activeTab={activeTab === 'overview' ? 'tasks' : activeTab}
          onTabChange={(tab) => setActiveTab(tab)}
          dir={dir}
        />

        {/* Operational Task Inbox & Exception Queue */}
        <OperationalTaskInbox
          activeTab={activeTab === 'exceptions' ? 'exceptions' : 'tasks'}
          onSelectTask={(taskId) => setSelectedTaskId(taskId)}
          selectedTaskId={selectedTaskId}
          selectedQueueId={selectedQueueId}
          statusFilterShortcut={statusFilterShortcut}
          severityFilterShortcut={severityFilterShortcut}
          currentUserId={currentUser?.id}
          dir={dir}
          onNavigateToShipment={(shipmentId) => {
            onSelectSection('operations');
          }}
        />
      </main>

      {/* Master-Detail Task Drawer */}
      <TaskDetailDrawer
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onTaskUpdated={handleTaskUpdated}
        currentUserId={currentUser?.id}
        dir={dir}
        onNavigateToShipment={(shipmentId) => {
          setSelectedTaskId(null);
          onSelectSection('operations');
        }}
      />
    </div>
  );
};

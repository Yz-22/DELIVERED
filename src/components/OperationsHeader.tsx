import React from 'react';
import {
  Plus,
  Zap,
  Layers,
  RefreshCw,
  Download,
  LayoutGrid,
  Table as TableIcon,
  BarChart3,
  TrendingUp,
  Package,
  Clock,
  CheckCircle2,
  DollarSign,
  Lock,
} from 'lucide-react';

interface OperationsHeaderProps {
  viewMode: 'grid' | 'kanban' | 'kpi';
  setViewMode: (mode: 'grid' | 'kanban' | 'kpi') => void;
  onOpenCreateModal: () => void;
  onOpenQuickModal: () => void;
  onOpenBatchModal: () => void;
  onRefresh: () => void;
  onExportCSV: () => void;
  canCreateOrder?: boolean;
  canExportCSV?: boolean;
  stats: {
    total: number;
    pending: number;
    picking: number;
    out_for_delivery: number;
    delivered: number;
    cancelled: number;
    postponed: number;
    totalCOD: number;
    totalDeliveryFees: number;
  };
  isLoading: boolean;
}

export const OperationsHeader: React.FC<OperationsHeaderProps> = ({
  viewMode,
  setViewMode,
  onOpenCreateModal,
  onOpenQuickModal,
  onOpenBatchModal,
  onRefresh,
  onExportCSV,
  canCreateOrder = true,
  canExportCSV = true,
  stats,
  isLoading,
}) => {
  return (
    <div className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-4 space-y-4">
      {/* Top row: Title and Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Title & Breadcrumbs */}
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span>إدارة العمليات والتوصيل</span>
            <span>/</span>
            <span className="text-amber-600 font-bold">لوحة العمليات اليومية</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5 flex items-center gap-2.5">
            الطلبيات النشطة
            <span className="text-xs bg-slate-100 text-slate-700 font-bold px-2.5 py-0.5 rounded-full border border-slate-200">
              {stats.total} طرد
            </span>
          </h1>
        </div>

        {/* Core Odoo Action Buttons (as specifically requested in prompt) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Create Button */}
          <button
            onClick={canCreateOrder ? onOpenCreateModal : undefined}
            disabled={!canCreateOrder}
            title={!canCreateOrder ? 'غير مصرح لك بإنشاء طلبيات' : 'إنشاء طلبية جديدة'}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-bold rounded-lg shadow-sm transition-all ${
              canCreateOrder
                ? 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer focus:ring-2 focus:ring-slate-400'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
            }`}
          >
            {canCreateOrder ? (
              <Plus className="w-4 h-4 text-amber-400 stroke-[2.5]" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>إنشاء</span>
          </button>

          {/* Quick Order Button */}
          <button
            onClick={canCreateOrder ? onOpenQuickModal : undefined}
            disabled={!canCreateOrder}
            title={!canCreateOrder ? 'غير مصرح لك بإنشاء طلبيات' : 'إنشاء طلبية سريعة'}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-bold rounded-lg shadow-sm transition-all ${
              canCreateOrder
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 cursor-pointer focus:ring-2 focus:ring-amber-300'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
            }`}
          >
            <Zap className={`w-4 h-4 ${canCreateOrder ? 'fill-slate-950 text-slate-950' : 'text-slate-400'}`} />
            <span>طلبية سريعة</span>
          </button>

          {/* Batch Import Button */}
          <button
            onClick={canCreateOrder ? onOpenBatchModal : undefined}
            disabled={!canCreateOrder}
            title={!canCreateOrder ? 'غير مصرح لك باستيراد طلبيات' : 'استيراد دفعة من Excel / CSV'}
            className={`inline-flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg border shadow-xs transition-all ${
              canCreateOrder
                ? 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300 cursor-pointer'
                : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
            }`}
          >
            <Layers className="w-4 h-4 text-slate-500" />
            <span>إضافة دفعة</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={canExportCSV ? onExportCSV : undefined}
            disabled={!canExportCSV}
            title={!canExportCSV ? 'غير مصرح لك بتصدير البيانات' : 'تصدير جدول الطلبيات إلى Excel / CSV'}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg border shadow-xs transition-all ${
              canExportCSV
                ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 cursor-pointer'
                : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
            }`}
          >
            {canExportCSV ? (
              <Download className="w-3.5 h-3.5 text-slate-500" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span className="hidden md:inline">تصدير</span>
          </button>

          {/* Refresh */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-300 shadow-xs transition-all disabled:opacity-50"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 text-slate-600 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* View Modes */}
          <div className="flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200 mr-auto sm:mr-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="عرض جدول البيانات المتقدم"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">جدول البيانات</span>
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'kanban'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="عرض لوحة كانبان للحالات"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">لوحة كانبان</span>
            </button>
            <button
              onClick={() => setViewMode('kpi')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'kpi'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="مؤشرات الأداء والإحصائيات"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">المؤشرات</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Status Strip (Odoo Stat Badges) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
        {/* Total Active */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2.5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-slate-200/80 flex items-center justify-center text-slate-700">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-medium">إجمالي الطرود</div>
            <div className="text-base font-bold text-slate-900">{stats.total}</div>
          </div>
        </div>

        {/* Pending & Picking */}
        <div className="bg-amber-50/60 border border-amber-200/80 rounded-lg p-2.5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-amber-100 flex items-center justify-center text-amber-700">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-amber-700 font-medium">بالانتظار / للاستلام</div>
            <div className="text-base font-bold text-amber-900">{stats.pending + stats.picking}</div>
          </div>
        </div>

        {/* Out for Delivery */}
        <div className="bg-indigo-50/60 border border-indigo-200/80 rounded-lg p-2.5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-indigo-100 flex items-center justify-center text-indigo-700">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-indigo-700 font-medium">مع المناديب للتوصيل</div>
            <div className="text-base font-bold text-indigo-900">{stats.out_for_delivery}</div>
          </div>
        </div>

        {/* Delivered */}
        <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-lg p-2.5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-emerald-100 flex items-center justify-center text-emerald-700">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-emerald-700 font-medium">تم التسليم بنجاح</div>
            <div className="text-base font-bold text-emerald-900">{stats.delivered}</div>
          </div>
        </div>

        {/* Postponed or Cancelled */}
        <div className="bg-rose-50/60 border border-rose-200/80 rounded-lg p-2.5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-rose-100 flex items-center justify-center text-rose-700">
            <span className="text-xs font-bold">!</span>
          </div>
          <div>
            <div className="text-[11px] text-rose-700 font-medium">مؤجل / ملغي</div>
            <div className="text-base font-bold text-rose-900">{stats.postponed + stats.cancelled}</div>
          </div>
        </div>

        {/* Total COD */}
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-emerald-500/20 flex items-center justify-center text-emerald-700">
            <DollarSign className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div>
            <div className="text-[11px] text-emerald-800 font-medium">إجمالي التحصيل COD</div>
            <div className="text-base font-extrabold text-emerald-900 font-mono">
              {stats.totalCOD.toFixed(1)} <span className="text-[10px] font-sans font-bold">د.أ</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

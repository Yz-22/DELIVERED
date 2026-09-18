import React from 'react';
import { Search, Filter, X, RefreshCw } from 'lucide-react';

interface SuperAdminToolbarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  filterRole: string;
  onRoleChange: (val: string) => void;
  filterPlan: string;
  onPlanChange: (val: string) => void;
  filterStatus: string;
  onStatusChange: (val: string) => void;
  totalResults: number;
  onResetFilters?: () => void;
}

export const SuperAdminToolbar: React.FC<SuperAdminToolbarProps> = ({
  searchQuery,
  onSearchChange,
  filterRole,
  onRoleChange,
  filterPlan,
  onPlanChange,
  filterStatus,
  onStatusChange,
  totalResults,
  onResetFilters,
}) => {
  const isFiltered =
    searchQuery.trim() !== '' ||
    filterRole !== 'ALL' ||
    filterPlan !== 'ALL' ||
    filterStatus !== 'ALL';

  return (
    <div
      className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 shadow-xs"
      dir="rtl"
    >
      {/* Search Input */}
      <div className="relative flex-1 max-w-md">
        <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="بحث بالاسم، الشركة، الهاتف، البريد..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pr-9 pl-8 py-1.5 bg-slate-950 border border-slate-700/80 rounded-lg text-xs font-medium text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5"
            aria-label="مسح البحث"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Filter Selectors */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold shrink-0">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden sm:inline">تصفية:</span>
        </div>

        {/* Role Filter */}
        <select
          value={filterRole}
          onChange={(e) => onRoleChange(e.target.value)}
          className="px-2.5 py-1.5 bg-slate-950 border border-slate-700/80 rounded-lg text-xs font-semibold text-slate-200 focus:outline-hidden focus:border-amber-500 cursor-pointer"
          aria-label="تصفية حسب الدور الوظيفي"
        >
          <option value="ALL">جميع الأدوار</option>
          <option value="ADMIN">مدراء الشركات (Admin)</option>
          <option value="MERCHANT">التجار (Merchant)</option>
          <option value="DRIVER">كباتن التوصيل (Driver)</option>
          <option value="OPERATOR">موظفو العمليات</option>
          <option value="ACCOUNTANT">محاسبون ماليون</option>
          <option value="CASHIER">كاشير ونقاط البيع</option>
          <option value="SUPER_ADMIN">المدير العام (Super Admin)</option>
        </select>

        {/* Plan Filter */}
        <select
          value={filterPlan}
          onChange={(e) => onPlanChange(e.target.value)}
          className="px-2.5 py-1.5 bg-slate-950 border border-slate-700/80 rounded-lg text-xs font-semibold text-slate-200 focus:outline-hidden focus:border-amber-500 cursor-pointer"
          aria-label="تصفية حسب باقة الاشتراك"
        >
          <option value="ALL">جميع الباقات</option>
          <option value="ENTERPRISE">الباقة الماسية (Enterprise)</option>
          <option value="PROFESSIONAL">الباقة الذهبية (Gold Pro)</option>
          <option value="GROWTH">الباقة الفضية (Silver)</option>
          <option value="TRIAL">الاشتراك التجريبي (Trial)</option>
        </select>

        {/* Status Filter */}
        <select
          value={filterStatus}
          onChange={(e) => onStatusChange(e.target.value)}
          className="px-2.5 py-1.5 bg-slate-950 border border-slate-700/80 rounded-lg text-xs font-semibold text-slate-200 focus:outline-hidden focus:border-amber-500 cursor-pointer"
          aria-label="تصفية حسب حالة الحساب"
        >
          <option value="ALL">جميع الحالات</option>
          <option value="ACTIVE">نشط ومفعل</option>
          <option value="SUSPENDED">معلق / متوقف</option>
        </select>

        {/* Reset Filters button */}
        {isFiltered && onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
            title="إعادة تعيين التصفيات"
          >
            <RefreshCw className="w-3 h-3" />
            <span className="hidden sm:inline">إعادة ضبط</span>
          </button>
        )}

        <div className="text-[11px] font-mono text-slate-400 px-2 shrink-0 border-r border-slate-800">
          <span className="text-amber-400 font-bold">{totalResults}</span> سجل
        </div>
      </div>
    </div>
  );
};

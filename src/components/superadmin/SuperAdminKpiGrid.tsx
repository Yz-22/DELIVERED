import React from 'react';
import {
  Users,
  Building2,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
} from 'lucide-react';

interface SuperAdminKpiGridProps {
  totalAccounts: number;
  totalTenants: number;
  activeSubs: number;
  suspendedSubs: number;
  totalMRR: number;
}

export const SuperAdminKpiGrid: React.FC<SuperAdminKpiGridProps> = ({
  totalAccounts,
  totalTenants,
  activeSubs,
  suspendedSubs,
  totalMRR,
}) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4" dir="rtl">
      {/* 1. Total Registered Accounts */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 transition-all hover:border-slate-700 shadow-xs">
        <div className="flex items-center justify-between text-slate-400 mb-1.5">
          <span className="text-xs font-bold">إجمالي الحسابات</span>
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl sm:text-3xl font-black text-white font-mono">
            {totalAccounts}
          </span>
          <span className="text-[11px] text-slate-400 font-medium">حساب مسجل</span>
        </div>
        <div className="text-[10px] text-slate-400 mt-1">كافة الحسابات بالمنظومة</div>
      </div>

      {/* 2. Total Enterprise Tenants / Companies */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 transition-all hover:border-slate-700 shadow-xs">
        <div className="flex items-center justify-between text-slate-400 mb-1.5">
          <span className="text-xs font-bold">الشركات والتجار</span>
          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <Building2 className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl sm:text-3xl font-black text-indigo-300 font-mono">
            {totalTenants}
          </span>
          <span className="text-[11px] text-slate-400 font-medium">منشأة</span>
        </div>
        <div className="text-[10px] text-slate-400 mt-1">شركات وتجار مرخصين</div>
      </div>

      {/* 3. Active Subscriptions */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 transition-all hover:border-slate-700 shadow-xs">
        <div className="flex items-center justify-between text-slate-400 mb-1.5">
          <span className="text-xs font-bold">الاشتراكات الفعالة</span>
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
            {activeSubs}
          </span>
          <span className="text-[11px] text-emerald-400/80 font-medium">ساري</span>
        </div>
        <div className="text-[10px] text-slate-400 mt-1">تراخيص نشطة الصلاحية</div>
      </div>

      {/* 4. Suspended Subscriptions */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 transition-all hover:border-slate-700 shadow-xs">
        <div className="flex items-center justify-between text-slate-400 mb-1.5">
          <span className="text-xs font-bold">الحسابات المعلقة</span>
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
            {suspendedSubs}
          </span>
          <span className="text-[11px] text-amber-400/80 font-medium">معلق</span>
        </div>
        <div className="text-[10px] text-slate-400 mt-1">بحاجة لتجديد أو مراجعة</div>
      </div>

      {/* 5. MRR */}
      <div className="col-span-2 md:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-3.5 transition-all hover:border-slate-700 shadow-xs">
        <div className="flex items-center justify-between text-slate-400 mb-1.5">
          <span className="text-xs font-bold">الإيراد الشهري (MRR)</span>
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl sm:text-3xl font-black text-white font-mono">
            {totalMRR.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
          <span className="text-[11px] text-slate-400 font-medium">د.أ</span>
        </div>
        <div className="text-[10px] text-slate-400 mt-1">القيمة الشهرية المجمعة</div>
      </div>
    </div>
  );
};

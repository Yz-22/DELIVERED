import React from 'react';
import {
  Building2,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  TrendingUp,
} from 'lucide-react';

interface SuperAdminKpiGridProps {
  totalTenants: number;
  activeSubs: number;
  suspendedSubs: number;
  totalMRR: number;
}

export const SuperAdminKpiGrid: React.FC<SuperAdminKpiGridProps> = ({
  totalTenants,
  activeSubs,
  suspendedSubs,
  totalMRR,
}) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" dir="rtl">
      {/* 1. Total Tenants */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 transition-all hover:border-slate-700 shadow-xs">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-bold">إجمالي المشتركين</span>
          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <Building2 className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-black text-white font-mono">
            {totalTenants}
          </span>
          <span className="text-[11px] text-slate-400 font-medium">
            شركة / متجر
          </span>
        </div>
        <div className="text-[11px] text-slate-500 mt-1 font-medium">
          الحسابات المسجلة بالمنظومة
        </div>
      </div>

      {/* 2. Active Subscriptions */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 transition-all hover:border-slate-700 shadow-xs">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-bold">الاشتراكات الفعالة</span>
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
            {activeSubs}
          </span>
          <span className="text-[11px] text-emerald-400/80 font-medium">
            حساب نشط
          </span>
        </div>
        <div className="text-[11px] text-slate-500 mt-1 font-medium">
          تراخيص سارية الصلاحية
        </div>
      </div>

      {/* 3. Suspended Subscriptions */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 transition-all hover:border-slate-700 shadow-xs">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-bold">الحسابات المعلقة</span>
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
            {suspendedSubs}
          </span>
          <span className="text-[11px] text-amber-400/80 font-medium">
            معلق / متوقف
          </span>
        </div>
        <div className="text-[11px] text-slate-500 mt-1 font-medium">
          بحاجة لتجديد أو مراجعة
        </div>
      </div>

      {/* 4. MRR */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 transition-all hover:border-slate-700 shadow-xs">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-bold">الإيراد الشهري المقدر (MRR)</span>
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl sm:text-3xl font-black text-white font-mono">
            {totalMRR.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-slate-400 font-medium">
            د.أ / شهر
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-emerald-400 mt-1 font-medium">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>عقود واشتراكات نشطة</span>
        </div>
      </div>
    </div>
  );
};

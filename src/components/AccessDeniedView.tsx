import React from 'react';
import { ShieldAlert, ArrowRight, Lock, UserCheck, AlertTriangle } from 'lucide-react';
import { Role } from '../types/logistics';

interface AccessDeniedViewProps {
  sectionTitle: string;
  requiredRole: string;
  currentRole: Role;
  onNavigateHome: () => void;
  homeSectionName?: string;
}

export const AccessDeniedView: React.FC<AccessDeniedViewProps> = ({
  sectionTitle,
  requiredRole,
  currentRole,
  onNavigateHome,
  homeSectionName = 'الرئيسية المصرح بها',
}) => {
  const roleDisplayNames: Record<Role, { label: string; color: string; badge: string }> = {
    ADMIN: {
      label: 'مدير العمليات (Admin)',
      color: 'text-amber-700 bg-amber-50 border-amber-200',
      badge: 'إدارة عليا',
    },
    OPERATOR: {
      label: 'موظف العمليات والفرز (Operator)',
      color: 'text-blue-700 bg-blue-50 border-blue-200',
      badge: 'عمليات ومستودع',
    },
    MERCHANT: {
      label: 'حساب تاجر (Merchant)',
      color: 'text-indigo-700 bg-indigo-50 border-indigo-200',
      badge: 'عميل تجاري',
    },
    DRIVER: {
      label: 'كابتن توصيل (Driver)',
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      badge: 'مندوب ميداني',
    },
  };

  const currentRoleInfo = roleDisplayNames[currentRole] || {
    label: currentRole,
    color: 'text-slate-700 bg-slate-50 border-slate-200',
    badge: 'مستخدم',
  };

  return (
    <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-12 flex flex-col items-center justify-center">
      <div className="w-full bg-white border border-rose-200/80 rounded-2xl shadow-xl overflow-hidden text-center">
        {/* Top Warning Banner */}
        <div className="bg-rose-50 border-b border-rose-100 px-6 py-4 flex items-center justify-center gap-2 text-rose-800 text-xs font-bold">
          <ShieldAlert className="w-4 h-4 text-rose-600" />
          <span>نظام حماية الصلاحيات والأمان (RBAC Security Guard)</span>
        </div>

        <div className="p-8 sm:p-10 space-y-6">
          {/* Lock Icon Emblem */}
          <div className="relative inline-flex items-center justify-center">
            <div className="w-20 h-20 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shadow-inner">
              <Lock className="w-10 h-10 stroke-[2.2]" />
            </div>
            <span className="absolute -bottom-2 -right-2 bg-amber-500 text-slate-950 p-1.5 rounded-full shadow-md">
              <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
            </span>
          </div>

          {/* Heading and Description */}
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              وصول مقيد: غير مصرح لك بدخول هذا القسم
            </h2>
            <p className="text-sm font-semibold text-slate-600">
              قسم: <span className="text-slate-900 font-bold underline decoration-rose-300 decoration-2">{sectionTitle}</span>
            </p>
          </div>

          {/* Role Comparison Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 text-right grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="bg-white p-3.5 rounded-lg border border-slate-200">
              <span className="text-slate-500 font-medium block mb-1">الصلاحية المطلوبة للوصول:</span>
              <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                {requiredRole}
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-lg border border-slate-200">
              <span className="text-slate-500 font-medium block mb-1">صلاحية حسابك الحالي:</span>
              <span className={`font-bold text-sm inline-flex items-center gap-1.5 px-2 py-0.5 rounded border ${currentRoleInfo.color}`}>
                <UserCheck className="w-3.5 h-3.5" />
                {currentRoleInfo.label}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
            تم تطبيق قيود الأمان لمنع التعديل غير المصرح به على البيانات الحساسة أو الحسابات المالية أو طرود المستودع بناءً على دور المستخدم المسجل.
          </p>

          {/* Action Button */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onNavigateHome}
              type="button"
              className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>الانتقال إلى {homeSectionName}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};

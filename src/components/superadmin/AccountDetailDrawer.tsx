import React from 'react';
import {
  X,
  Building2,
  Mail,
  Phone,
  Calendar,
  CreditCard,
  Layers,
  KeyRound,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Eye,
  CheckCircle2,
  Lock,
  Unlock,
  Sliders,
} from 'lucide-react';
import { User, SAAS_SUBSCRIPTION_PLANS } from '../../types/logistics';

interface AccountDetailDrawerProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectForLogin: (user: User) => void;
  onOpenRenewal: (user: User) => void;
  onOpenModules: (user: User) => void;
  onOpenPasswordReset: (user: User) => void;
  onToggleStatus: (user: User) => void;
}

export const AccountDetailDrawer: React.FC<AccountDetailDrawerProps> = ({
  user,
  isOpen,
  onClose,
  onSelectForLogin,
  onOpenRenewal,
  onOpenModules,
  onOpenPasswordReset,
  onToggleStatus,
}) => {
  if (!isOpen || !user) return null;

  const isActive = (user.isActive ?? true) && user.subscriptionStatus !== 'SUSPENDED';
  const planInfo = user.subscriptionPlan ? SAAS_SUBSCRIPTION_PLANS[user.subscriptionPlan] : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" dir="rtl">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-lg bg-[#0A1024] border-r border-slate-800 text-slate-100 shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-left duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center font-bold text-amber-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {user.companyName || user.storeName || user.name}
              </h3>
              <p className="text-xs text-slate-400">تفاصيل الحساب والترخيص المنظومي</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            aria-label="إغلاق التفاصيل"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Status & Impersonation Banner */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isActive ? 'bg-emerald-400 shadow-emerald-500/50 shadow-sm' : 'bg-rose-400'
                }`}
              />
              <div>
                <div className="text-xs font-bold text-white">
                  حالة الحساب: {isActive ? 'نشط وساري الصلاحية' : 'معلق / متوقف'}
                </div>
                <div className="text-[11px] text-slate-400">
                  {user.roleName || user.role} • معرف: <span className="font-mono text-slate-300">#{user.id}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onSelectForLogin(user);
              }}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>دخول ومعاينة</span>
            </button>
          </div>

          {/* Identity & Contact Information */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              بيانات الاتصال والهوية
            </h4>
            <div className="grid grid-cols-1 gap-2.5 text-xs bg-slate-900/50 p-3.5 rounded-xl border border-slate-800/80">
              <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" /> البريد الإلكتروني
                </span>
                <span className="text-slate-200 font-mono" dir="ltr">
                  {user.email || 'غير محدد'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" /> رقم الهاتف
                </span>
                <span className="text-slate-200 font-mono" dir="ltr">
                  {user.phone || 'غير مسجل'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" /> المنشأة / المتجر
                </span>
                <span className="text-slate-200 font-medium">
                  {user.companyName || user.storeName || 'غير مسجل'}
                </span>
              </div>
            </div>
          </div>

          {/* Subscription & License Details */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              بيانات الباقة والترخيص
            </h4>
            <div className="bg-slate-900/50 p-3.5 rounded-xl border border-slate-800/80 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">الباقة المعتمدة:</span>
                <span className="px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-300 font-bold border border-amber-500/20">
                  {planInfo ? planInfo.nameAr : user.subscriptionPlan || 'احترافية (Professional)'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">قيمة الاشتراك:</span>
                <span className="text-slate-200 font-mono font-bold">
                  {user.subscriptionPrice || 85} د.أ / {user.subscriptionBillingCycle === 'ANNUAL' ? 'سنوياً' : 'شهرياً'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">تاريخ انتهاء الترخيص:</span>
                <span className="text-slate-300 font-mono">
                  {user.subscriptionEndDate
                    ? new Date(user.subscriptionEndDate).toLocaleDateString('ar-JO')
                    : 'ساري ومستمر'}
                </span>
              </div>
            </div>
          </div>

          {/* Enabled Modules / Feature Flags */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                الموديلات والصلاحيات المفعلة
              </h4>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenModules(user);
                }}
                className="text-[11px] text-amber-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
              >
                <Sliders className="w-3 h-3" />
                <span>تعديل الموديلات</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {user.enabledModules && typeof user.enabledModules === 'object'
                ? Object.entries(user.enabledModules)
                    .filter(([_, enabled]) => Boolean(enabled))
                    .map(([modKey]) => (
                      <span
                        key={modKey}
                        className="px-2 py-1 bg-slate-800 border border-slate-700 rounded-md text-[11px] font-medium text-slate-300"
                      >
                        {modKey}
                      </span>
                    ))
                : ['tmsDelivery', 'posCashier', 'accountingSettlements'].map((modKey) => (
                    <span
                      key={modKey}
                      className="px-2 py-1 bg-slate-800 border border-slate-700 rounded-md text-[11px] font-medium text-slate-300"
                    >
                      {modKey}
                    </span>
                  ))}
            </div>
          </div>

          {/* Quick Administrative Actions Grid */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              الإجراءات الإدارية المباشرة
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenRenewal(user);
                }}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <span>تجديد الاشتراك</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPasswordReset(user);
                }}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span>تغيير كلمة المرور</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onToggleStatus(user);
                }}
                className={`col-span-2 p-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors border cursor-pointer ${
                  isActive
                    ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                }`}
              >
                {isActive ? (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>تجميد الحساب وإيقاف الترخيص</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4" />
                    <span>فك التجميد وتفعيل الترخيص</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

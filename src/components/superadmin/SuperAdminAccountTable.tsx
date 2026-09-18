import React, { useState } from 'react';
import {
  MoreVertical,
  Shield,
  Building2,
  Lock,
  Unlock,
  KeyRound,
  CreditCard,
  Sliders,
  LogIn,
  Eye,
  EyeOff,
  Copy,
  Check,
  Calendar,
  Sparkles,
  ExternalLink,
  Users,
  AlertCircle,
} from 'lucide-react';
import {
  User,
  Role,
  SubscriptionPlanType,
  SAAS_SUBSCRIPTION_PLANS,
} from '../../types/logistics';

interface SuperAdminAccountTableProps {
  users: User[];
  visiblePasswords: Record<string, boolean>;
  onTogglePasswordVisibility: (userId: string) => void;
  onOpenRenewModal: (user: User) => void;
  onOpenModulesModal: (user: User) => void;
  onOpenPasswordModal: (user: User) => void;
  onToggleStatus: (user: User) => void;
  onSelectUserForLogin: (user: User) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const SuperAdminAccountTable: React.FC<SuperAdminAccountTableProps> = ({
  users,
  visiblePasswords,
  onTogglePasswordVisibility,
  onOpenRenewModal,
  onOpenModulesModal,
  onOpenPasswordModal,
  onToggleStatus,
  onSelectUserForLogin,
  showToast,
}) => {
  const [activeMenuUserId, setActiveMenuUserId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      showToast('تم نسخ البيانات بنجاح', 'success');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showToast('تعذر النسخ التلقائي', 'error');
    }
  };

  const getRoleBadge = (role?: Role | string, roleName?: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return {
          label: roleName || 'المدير العام (Super Admin)',
          classes: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        };
      case 'ADMIN':
        return {
          label: roleName || 'مدير العمليات (Admin)',
          classes: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
        };
      case 'MERCHANT':
        return {
          label: roleName || 'حساب تاجر (Merchant)',
          classes: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        };
      case 'DRIVER':
        return {
          label: roleName || 'كابتن توصيل (Driver)',
          classes: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
        };
      case 'ACCOUNTANT':
        return {
          label: roleName || 'محاسب مالي (Accountant)',
          classes: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
        };
      case 'CASHIER':
        return {
          label: roleName || 'أمين صندوق (Cashier)',
          classes: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
        };
      case 'OPERATOR':
      case 'STAFF':
      case 'DISPATCHER':
        return {
          label: roleName || 'موظف العمليات والفرز',
          classes: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
        };
      default:
        return {
          label: roleName || role || 'مستخدم',
          classes: 'bg-slate-800 text-slate-300 border-slate-700',
        };
    }
  };

  const getPlanBadge = (planId?: SubscriptionPlanType, planName?: string) => {
    switch (planId) {
      case 'ENTERPRISE':
        return {
          name: planName || 'الباقة الماسية (Enterprise)',
          classes: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
        };
      case 'GROWTH':
        return {
          name: planName || 'الباقة الفضية (Growth)',
          classes: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        };
      case 'TRIAL':
        return {
          name: planName || 'الاشتراك التجريبي (Trial)',
          classes: 'bg-slate-800 text-slate-400 border-slate-700',
        };
      case 'PROFESSIONAL':
      default:
        return {
          name: planName || 'الباقة الذهبية (Gold Pro)',
          classes: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        };
    }
  };

  if (users.length === 0) {
    return (
      <div
        className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400 space-y-3"
        dir="rtl"
      >
        <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
          <Users className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-slate-200">
            لا توجد حسابات مطابقة لمعايير البحث والتصفية
          </h4>
          <p className="text-xs text-slate-500">
            يرجى مراجعة كلمات البحث أو إعادة ضبط خيارات التصفية بالأعلى
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-slate-900 border border-slate-800 rounded-xl shadow-xs overflow-hidden"
      dir="rtl"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-right text-xs border-collapse">
          {/* Table Header */}
          <thead className="bg-[#080E21] text-slate-400 font-bold border-b border-slate-800 sticky top-0 z-10">
            <tr>
              <th className="py-3 px-4 text-right">المشترك / الشركة</th>
              <th className="py-3 px-3 text-right">الدور الوظيفي</th>
              <th className="py-3 px-3 text-right">بيانات الدخول والاتصال</th>
              <th className="py-3 px-3 text-right">باقة الاشتراك</th>
              <th className="py-3 px-3 text-right">الصلاحية والانتهاء</th>
              <th className="py-3 px-3 text-center">الأنظمة المفتوحة</th>
              <th className="py-3 px-3 text-center">حالة الحساب</th>
              <th className="py-3 px-4 text-center">الإجراءات</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-800/80 text-slate-300">
            {users.map((u) => {
              const isSuper = u.role === 'SUPER_ADMIN';
              const isSuspended =
                !u.isActive || u.subscriptionStatus === 'SUSPENDED';
              const roleBadge = getRoleBadge(u.role, u.roleName);
              const planBadge = getPlanBadge(
                u.subscriptionPlan,
                u.subscriptionPlanName
              );
              const endDateStr = u.subscriptionEndDate
                ? u.subscriptionEndDate.split('T')[0]
                : '2027-12-31';
              const isMenuOpen = activeMenuUserId === u.id;

              return (
                <tr
                  key={u.id}
                  className={`hover:bg-slate-800/50 transition-colors group ${
                    isSuspended ? 'bg-rose-950/10 text-slate-400' : ''
                  }`}
                >
                  {/* 1. Tenant & Company */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                          isSuper
                            ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                            : u.role === 'ADMIN'
                            ? 'bg-indigo-600 text-white'
                            : u.role === 'MERCHANT'
                            ? 'bg-emerald-600 text-white'
                            : u.role === 'DRIVER'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-700 text-slate-200'
                        }`}
                      >
                        {u.name ? u.name.slice(0, 2) : 'US'}
                      </div>
                      <div className="leading-tight">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span>{u.name}</span>
                          {isSuper && (
                            <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 text-[10px] font-bold rounded border border-amber-500/30">
                              المالك
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                          <span>
                            {u.companyName ||
                              u.commercialName ||
                              u.storeName ||
                              u.branch ||
                              'شركة لوجستية'}
                          </span>
                          <span>•</span>
                          <span>{u.city || 'عمان'}</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* 2. Role */}
                  <td className="py-3 px-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${roleBadge.classes}`}
                    >
                      {roleBadge.label}
                    </span>
                  </td>

                  {/* 3. Credentials */}
                  <td className="py-3 px-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="font-mono text-[11px] text-slate-200 font-semibold truncate max-w-[160px]"
                          dir="ltr"
                        >
                          {u.email}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(u.email, `email-${u.id}`)}
                          className="text-slate-500 hover:text-slate-300 p-0.5 transition-colors cursor-pointer"
                          title="نسخ البريد"
                          aria-label="نسخ البريد الإلكتروني"
                        >
                          {copiedId === `email-${u.id}` ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className="font-mono text-[10px] text-slate-400"
                          dir="ltr"
                        >
                          {visiblePasswords[u.id]
                            ? u.password || '123456'
                            : '••••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => onTogglePasswordVisibility(u.id)}
                          className="text-slate-500 hover:text-slate-300 p-0.5 cursor-pointer"
                          title={
                            visiblePasswords[u.id]
                              ? 'إخفاء كلمة المرور'
                              : 'إظهار كلمة المرور'
                          }
                          aria-label="إظهار أو إخفاء كلمة المرور"
                        >
                          {visiblePasswords[u.id] ? (
                            <EyeOff className="w-3 h-3 text-amber-400" />
                          ) : (
                            <Eye className="w-3 h-3" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenPasswordModal(u)}
                          className="text-amber-400 hover:text-amber-300 text-[10px] font-bold underline cursor-pointer"
                        >
                          تغيير
                        </button>
                      </div>
                    </div>
                  </td>

                  {/* 4. Plan */}
                  <td className="py-3 px-3">
                    <div className="space-y-0.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${planBadge.classes}`}
                      >
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span>{planBadge.name}</span>
                      </span>
                      <div className="text-[10px] font-mono text-slate-400">
                        {u.subscriptionPrice
                          ? `${u.subscriptionPrice} د.أ / ${
                              u.subscriptionBillingCycle === 'ANNUAL'
                                ? 'سنوي'
                                : 'شهري'
                            }`
                          : 'مجاني'}
                      </div>
                    </div>
                  </td>

                  {/* 5. End Date */}
                  <td className="py-3 px-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1 text-slate-300 font-mono text-[11px]">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span dir="ltr">{endDateStr}</span>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-bold">
                        اشتراك ساري
                      </span>
                    </div>
                  </td>

                  {/* 6. Subsystems / Modules */}
                  <td className="py-3 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => onOpenModulesModal(u)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-[11px] font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Sliders className="w-3 h-3 text-indigo-400" />
                      <span>الموديلات</span>
                    </button>
                  </td>

                  {/* 7. Status */}
                  <td className="py-3 px-3 text-center">
                    {!isSuper ? (
                      <button
                        type="button"
                        onClick={() => onToggleStatus(u)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all border ${
                          isSuspended
                            ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border-rose-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30'
                        }`}
                        title={
                          isSuspended
                            ? 'انقر لفك التجميد وتفعيل الحساب'
                            : 'انقر لتجميد وقفل الحساب'
                        }
                      >
                        {isSuspended ? (
                          <>
                            <Lock className="w-3 h-3" />
                            <span>معلق</span>
                          </>
                        ) : (
                          <>
                            <Unlock className="w-3 h-3" />
                            <span>نشط</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 text-amber-300 rounded-lg text-[11px] font-bold border border-amber-500/30">
                        <Shield className="w-3 h-3 text-amber-400" />
                        <span>دائم</span>
                      </span>
                    )}
                  </td>

                  {/* 8. Actions */}
                  <td className="py-3 px-4 text-center relative">
                    <div className="flex items-center justify-center gap-1.5">
                      {/* Primary contextual action: Renew */}
                      <button
                        type="button"
                        onClick={() => onOpenRenewModal(u)}
                        className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 font-bold rounded-lg text-[11px] flex items-center gap-1 transition-all cursor-pointer border border-amber-500/30"
                        title="تجديد أو ترقية باقة الاشتراك"
                      >
                        <CreditCard className="w-3 h-3" />
                        <span>تجديد</span>
                      </button>

                      {/* Secondary action: Kebab dropdown menu */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveMenuUserId(isMenuOpen ? null : u.id)
                          }
                          className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          title="خيارات إضافية"
                          aria-label="قائمة الخيارات الإضافية"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {/* Dropdown Menu Portal */}
                        {isMenuOpen && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setActiveMenuUserId(null)}
                            />
                            <div
                              className="absolute left-0 mt-1 w-52 bg-[#0B132B] border border-slate-700 rounded-xl shadow-2xl p-1.5 z-50 text-right space-y-0.5 animate-in fade-in duration-100"
                              dir="rtl"
                            >
                              {/* Impersonate Login */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuUserId(null);
                                  onSelectUserForLogin(u);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-right cursor-pointer"
                              >
                                <LogIn className="w-3.5 h-3.5 text-amber-400" />
                                <span>دخول ومعاينة الحساب</span>
                              </button>

                              {/* Toggle Subsystems */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuUserId(null);
                                  onOpenModulesModal(u);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-right cursor-pointer"
                              >
                                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                                <span>تعديل الموديلات المفتوحة</span>
                              </button>

                              {/* Change Password */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuUserId(null);
                                  onOpenPasswordModal(u);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-right cursor-pointer"
                              >
                                <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                                <span>تغيير كلمة المرور</span>
                              </button>

                              {/* Suspend / Activate Account */}
                              {!isSuper && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuUserId(null);
                                    onToggleStatus(u);
                                  }}
                                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold rounded-lg transition-colors text-right cursor-pointer ${
                                    isSuspended
                                      ? 'text-emerald-400 hover:bg-emerald-500/10'
                                      : 'text-rose-400 hover:bg-rose-500/10'
                                  }`}
                                >
                                  {isSuspended ? (
                                    <>
                                      <Unlock className="w-3.5 h-3.5" />
                                      <span>فك التجميد وتفعيل الحساب</span>
                                    </>
                                  ) : (
                                    <>
                                      <Lock className="w-3.5 h-3.5" />
                                      <span>تجميد وتعطيل الحساب</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="p-3 bg-[#080E21] border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
        <span className="font-medium">
          إجمالي الحسابات المعروضة:{' '}
          <strong className="text-white font-mono">{users.length}</strong> حساب
        </span>
        <span className="text-[11px] text-slate-400">
          انقر على زر القائمة (...) للوصول لإجراءات الدخول والموديلات وتعديل كلمات المرور
        </span>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import {
  CreditCard,
  Shield,
  Check,
  Clock,
  Lock,
  RotateCw,
  Sliders,
  Sparkles,
  Zap,
  Building2,
  Calendar,
  Layers,
} from 'lucide-react';
import { User, SAAS_SUBSCRIPTION_PLANS, SubscriptionPlanType } from '../../types/logistics';

interface SuperAdminSubscriptionsTabProps {
  users: User[];
  onOpenRenewModal: (user: User) => void;
  onOpenModulesModal: (user: User) => void;
  onToggleStatus: (user: User) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const SuperAdminSubscriptionsTab: React.FC<SuperAdminSubscriptionsTabProps> = ({
  users,
  onOpenRenewModal,
  onOpenModulesModal,
  onToggleStatus,
}) => {
  const [filterPlan, setFilterPlan] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Filter accounts having subscription data
  const accountsWithSubs = users.filter((u) => {
    const isCompanyOrMerchant = u.role === 'ADMIN' || u.role === 'MERCHANT' || u.companyName || u.storeName;
    if (!isCompanyOrMerchant) return false;

    const matchesPlan = filterPlan === 'ALL' || u.subscriptionPlan === filterPlan;
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.companyName && u.companyName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.storeName && u.storeName.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesPlan && matchesSearch;
  });

  return (
    <div className="space-y-6" dir="rtl">
      {/* 1. Header & Section Context */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold">
              <CreditCard className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-white">إدارة الاشتراكات والتراخيص السحابية</h2>
          </div>
          <p className="text-xs text-slate-400 pt-1">
            متابعة باقات الاشتراك، صلاحيات الموديولات، تجديد التراخيص المنتهية، وضبط التعريفات.
          </p>
        </div>
      </div>

      {/* 2. SaaS Subscription Plans Catalog */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-300 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>باقات النماذج المعتمدة في المنصة (SaaS Pricing Plans)</span>
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(SAAS_SUBSCRIPTION_PLANS).map(([key, plan]) => {
            const planKey = key as SubscriptionPlanType;
            const isEnterprise = planKey === 'ENTERPRISE';
            const isPro = planKey === 'PROFESSIONAL';

            return (
              <div
                key={planKey}
                className={`bg-slate-900 border rounded-2xl p-4 flex flex-col justify-between transition-all relative overflow-hidden ${
                  isEnterprise
                    ? 'border-amber-500/50 bg-gradient-to-b from-amber-500/10 to-slate-900'
                    : isPro
                    ? 'border-blue-500/40'
                    : 'border-slate-800'
                }`}
              >
                {isEnterprise && (
                  <span className="absolute left-3 top-3 px-2 py-0.5 bg-amber-500 text-slate-950 font-black text-[9px] rounded-full uppercase tracking-wider">
                    الأعلى طاقة
                  </span>
                )}

                <div className="space-y-3">
                  <div>
                    <h4 className="font-extrabold text-sm text-white">{plan.nameAr}</h4>
                    <div className="text-[11px] text-slate-400 pt-0.5">{plan.description}</div>
                  </div>

                  <div className="flex items-baseline gap-1 py-1">
                    <span className="text-2xl font-black text-amber-400">{plan.monthlyPriceJod}</span>
                    <span className="text-xs text-slate-400 font-bold">د.أ / شهرياً</span>
                  </div>

                  <div className="space-y-1.5 text-xs pt-2 border-t border-slate-800/80">
                    <div className="flex items-center gap-2 text-slate-300 text-[11px]">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>سعة طلبات: <strong>{plan.maxMonthlyOrders ? `${plan.maxMonthlyOrders} شحنة` : 'غير محدودة'}</strong></span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300 text-[11px]">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>المستخدمون المسموح بهم: <strong>{plan.maxUsers ? `${plan.maxUsers} مستخدم` : 'غير محدود'}</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Tenant Subscriptions & License Directory */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white">سجل التراخيص والاشتراكات النشطة ({accountsWithSubs.length})</h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="البحث باسم الشركة أو التاجر..."
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500/50 w-48 sm:w-64"
            />
            <select
              value={filterPlan}
              onChange={(e) => setFilterPlan(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-hidden focus:border-amber-500/50"
            >
              <option value="ALL">جميع الباقات</option>
              <option value="ENTERPRISE">ENTERPRISE</option>
              <option value="PROFESSIONAL">PROFESSIONAL</option>
              <option value="GROWTH">GROWTH</option>
              <option value="TRIAL">TRIAL</option>
            </select>
          </div>
        </div>

        {/* Directory Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 font-bold border-b border-slate-800">
              <tr>
                <th className="p-3">الشركة / التاجر</th>
                <th className="p-3">نوع الباقة</th>
                <th className="p-3">دورة الفوترة والسعر</th>
                <th className="p-3">تاريخ انتهاء الترخيص</th>
                <th className="p-3">حالة الاشتراك</th>
                <th className="p-3 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {accountsWithSubs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center p-8 text-slate-500 text-xs">
                    لا توجد اشتراكات تطابق معايير التصفية الحالية.
                  </td>
                </tr>
              ) : (
                accountsWithSubs.map((user) => {
                  const isSuspended = !user.isActive || user.subscriptionStatus === 'SUSPENDED';
                  const expDate = user.subscriptionEndDate
                    ? new Date(user.subscriptionEndDate).toLocaleDateString('ar-JO')
                    : 'دائم وساري';

                  return (
                    <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 font-bold text-white">
                        <div>{user.companyName || user.storeName || user.name}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{user.email}</div>
                      </td>
                      <td className="p-3 font-mono">
                        <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-md text-[11px] font-bold text-slate-200">
                          {user.subscriptionPlan || 'PROFESSIONAL'}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-amber-300">
                        {user.subscriptionPrice || 85} د.أ /{' '}
                        {user.subscriptionBillingCycle === 'ANNUAL' ? 'سنوياً' : 'شهرياً'}
                      </td>
                      <td className="p-3 font-mono text-slate-300">
                        {expDate}
                      </td>
                      <td className="p-3">
                        {isSuspended ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-500/15 text-rose-300 border border-rose-500/30 rounded-full text-[10px] font-bold">
                            <Lock className="w-3 h-3" /> موقوف
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-bold">
                            <Check className="w-3 h-3" /> ساري ونشط
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenRenewModal(user)}
                            className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                            title="تجديد الترخيص"
                          >
                            تجديد
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenModulesModal(user)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                            title="إدارة الموديولات"
                          >
                            الموديولات
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleStatus(user)}
                            className={`p-1 rounded-lg border transition-all cursor-pointer ${
                              isSuspended
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                            }`}
                            title={isSuspended ? 'فك التجميد' : 'تعليق الحساب'}
                          >
                            <Lock className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

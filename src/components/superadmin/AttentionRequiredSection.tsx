import React from 'react';
import {
  AlertTriangle,
  Clock,
  Lock,
  RefreshCw,
  Eye,
  ChevronLeft,
  CheckCircle2,
} from 'lucide-react';
import { User } from '../../types/logistics';

interface AttentionRequiredSectionProps {
  users: User[];
  onOpenRenewal: (user: User) => void;
  onToggleStatus: (user: User) => void;
  onSelectForLogin: (user: User) => void;
}

export const AttentionRequiredSection: React.FC<AttentionRequiredSectionProps> = ({
  users,
  onOpenRenewal,
  onToggleStatus,
  onSelectForLogin,
}) => {
  const now = new Date().getTime();
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;

  // 1. Suspended accounts
  const suspendedAccounts = users.filter(
    (u) => !u.isActive || u.subscriptionStatus === 'SUSPENDED'
  );

  // 2. Subscriptions expiring soon (< 14 days)
  const expiringAccounts = users.filter((u) => {
    if (u.subscriptionEndDate && (u.isActive ?? true) && u.subscriptionStatus !== 'SUSPENDED') {
      const exp = new Date(u.subscriptionEndDate).getTime();
      return exp > now && exp - now <= fourteenDaysMs;
    }
    return false;
  });

  const totalAttentionItems = suspendedAccounts.length + expiringAccounts.length;

  if (totalAttentionItems === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between" dir="rtl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">حالة المنظومة والتراخيص ممتازة</h4>
            <p className="text-[11px] text-slate-400">لا توجد حسابات معلقة أو اشتراكات متأخرة تتطلب تدخلاً فورياً.</p>
          </div>
        </div>
        <span className="px-2.5 py-1 bg-emerald-500/15 text-emerald-300 rounded-md text-[10px] font-bold border border-emerald-500/30">
          جاهزية 100%
        </span>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 shadow-xs" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white">يحتاج إلى انتباه ومتابعة فورية</h3>
            <p className="text-[10px] text-slate-400">
              يوجد {totalAttentionItems} عنصر يتطلب مراجعة إدارية أو تجديد ترخيص
            </p>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-300 border border-amber-500/30">
          {totalAttentionItems} تنبيه
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
        {/* Suspended accounts card list */}
        {suspendedAccounts.slice(0, 2).map((user) => (
          <div
            key={user.id}
            className="p-3 bg-slate-950/60 border border-rose-500/30 rounded-xl flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
                <Lock className="w-3.5 h-3.5" />
              </div>
              <div className="truncate">
                <div className="text-xs font-bold text-white truncate">
                  {user.companyName || user.storeName || user.name}
                </div>
                <div className="text-[10px] text-rose-400 font-medium">
                  حساب معلق / ترخيص موقوف
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => onToggleStatus(user)}
                className="px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
              >
                فك التجميد
              </button>
              <button
                type="button"
                onClick={() => onSelectForLogin(user)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                title="معاينة"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}

        {/* Expiring accounts list */}
        {expiringAccounts.slice(0, 2).map((user) => (
          <div
            key={user.id}
            className="p-3 bg-slate-950/60 border border-amber-500/30 rounded-xl flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <div className="truncate">
                <div className="text-xs font-bold text-white truncate">
                  {user.companyName || user.storeName || user.name}
                </div>
                <div className="text-[10px] text-amber-400 font-medium">
                  ينتهي الاشتراك في{' '}
                  {user.subscriptionEndDate
                    ? new Date(user.subscriptionEndDate).toLocaleDateString('ar-JO')
                    : 'أيام قليلة'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => onOpenRenewal(user)}
                className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
              >
                تجديد الترخيص
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

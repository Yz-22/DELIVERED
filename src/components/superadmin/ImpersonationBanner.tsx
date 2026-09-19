import React from 'react';
import { Eye, ArrowRight, ShieldAlert, X } from 'lucide-react';
import { User } from '../../types/logistics';

interface ImpersonationBannerProps {
  impersonatedUser: User;
  onExitImpersonation: () => void;
}

export const ImpersonationBanner: React.FC<ImpersonationBannerProps> = ({
  impersonatedUser,
  onExitImpersonation,
}) => {
  return (
    <div
      className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 px-4 py-2 text-xs font-bold shadow-md sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-amber-600/40"
      dir="rtl"
    >
      <div className="flex items-center gap-2.5 overflow-hidden">
        <span className="p-1 bg-slate-950 text-amber-400 rounded-md shrink-0 flex items-center justify-center">
          <Eye className="w-3.5 h-3.5" />
        </span>
        <div className="flex items-center gap-1.5 truncate">
          <span className="font-extrabold">وضع معاينة الحساب:</span>
          <span className="font-medium text-slate-900 truncate">
            أنت تتصفح النظام بصفتك{' '}
            <strong className="text-slate-950 underline font-bold">
              {impersonatedUser.name}
            </strong>{' '}
            ({impersonatedUser.roleName || impersonatedUser.role} -{' '}
            {impersonatedUser.companyName || impersonatedUser.storeName || 'حساب مشترك'})
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onExitImpersonation}
        className="px-3 py-1 bg-slate-950 hover:bg-slate-900 text-amber-400 hover:text-amber-300 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-xs active:scale-95"
      >
        <span>إنهاء المعاينة والعودة للسوبر أدمن</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

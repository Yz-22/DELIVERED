import React, { useState, useEffect } from 'react';
import {
  Store,
  Receipt,
  User as UserIcon,
  LogOut,
  MapPin,
  Clock,
  DollarSign,
  ShoppingBag,
  CheckCircle2,
  ShieldAlert,
  Boxes,
} from 'lucide-react';
import { User, Order } from '../types/logistics';
import { MerchantBranch } from '../types/branches';
import { MerchantPos } from './MerchantPos';
import { MerchantInvoices } from './MerchantInvoices';
import { getAuthHeaders } from '../lib/auth';

interface CashierWorkspaceProps {
  currentUser: User;
  onLogout?: () => void;
  merchants: User[];
  onOrderCreated?: () => void;
}

export const CashierWorkspace: React.FC<CashierWorkspaceProps> = ({
  currentUser,
  onLogout,
  merchants,
  onOrderCreated,
}) => {
  const [activeTab, setActiveTab] = useState<'pos' | 'invoices'>('pos');
  const [branchDetails, setBranchDetails] = useState<MerchantBranch | null>(null);
  const [shiftStats, setShiftStats] = useState({
    totalSales: 0,
    ordersCount: 0,
    cashInDrawer: 0,
  });

  // Resolve Merchant context for Cashier
  const merchantId = currentUser.parentUserId || currentUser.tenantId || merchants[0]?.id;
  const merchant = merchants.find((m) => m.id === merchantId) || {
    id: merchantId,
    name: 'متجر التاجر',
    storeName: 'متجر التاجر',
  } as User;

  // Fetch branch details
  useEffect(() => {
    async function loadBranch() {
      if (!merchantId) return;
      try {
        const res = await fetch(`/api/merchants/${merchantId}/branches`, {
          headers: getAuthHeaders(currentUser),
        });
        if (res.ok) {
          const data = await res.json();
          const branches: MerchantBranch[] = data.branches || [];
          // Find matching branch or fallback to main
          const match =
            branches.find((b) => b.id === (currentUser as any).branchId || b.name === currentUser.branch) ||
            branches.find((b) => b.isMain) ||
            branches[0];
          if (match) setBranchDetails(match);
        }
      } catch (e) {
        // ignore
      }
    }
    loadBranch();
  }, [merchantId, currentUser]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans" dir="rtl">
      {/* Dedicated Cashier Top Bar */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Store & Branch Badge */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-black shadow-md">
                <Store className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-black text-white">
                    {merchant.storeName || merchant.name || 'متجر المبيعات'}
                  </h1>
                  <span className="text-[10px] bg-rose-500/20 text-rose-300 font-bold px-2 py-0.5 rounded-full border border-rose-500/30">
                    نقطة بيع وكاشير
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-amber-400" />
                    <span className="font-bold text-slate-200">
                      {branchDetails?.name || currentUser.branch || 'الفرع الرئيسي'}
                    </span>
                  </span>
                  <span>•</span>
                  <span>وردية مباشرة</span>
                </div>
              </div>
            </div>

            {/* Cashier Controls & Tabs */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveTab('pos')}
                  className={`px-4 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'pos'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>شاشة الكاشير المباشر</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('invoices')}
                  className={`px-4 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'invoices'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>فواتير الوردية والمبيعات</span>
                </button>
              </div>

              {/* Cashier User Info & Logout */}
              <div className="flex items-center gap-2 pr-3 border-r border-slate-800">
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-bold text-slate-200">{currentUser.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono">الكاشير المسجل</div>
                </div>

                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="p-2 text-slate-400 hover:text-rose-400 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                    title="تسجيل الخروج وإغلاق الوردية"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Cashier Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {/* Security / Isolation Banner */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 mb-5 flex items-center justify-between text-xs text-emerald-900 shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <span className="font-black">مساحة الكاشير المخصصة: </span>
              <span>
                أنت مسجل حالياً على كاشير{' '}
                <strong className="font-bold underline">{branchDetails?.name || currentUser.branch || 'الفرع الرئيسي'}</strong>.
                جميع المبيعات والإيصالات تسجل آلياً ضمن هذا الفرع.
              </span>
            </div>
          </div>

          <div className="text-[11px] font-mono text-emerald-700 font-bold bg-emerald-100/60 px-2.5 py-1 rounded-lg">
            حالة الوردية: مفتوحة
          </div>
        </div>

        {/* Content Tabs */}
        {activeTab === 'pos' && (
          <MerchantPos
            currentMerchant={merchant}
            onOrderCreated={onOrderCreated}
          />
        )}

        {activeTab === 'invoices' && (
          <MerchantInvoices
            currentMerchant={merchant}
          />
        )}
      </main>
    </div>
  );
};

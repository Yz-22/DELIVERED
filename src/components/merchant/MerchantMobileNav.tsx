import React, { useState } from 'react';
import {
  Home,
  Package,
  Store,
  PlusCircle,
  Menu,
  X,
  Boxes,
  FileText,
  Users,
  CreditCard,
  Calculator,
  Building2,
  RotateCcw,
  Truck
} from 'lucide-react';
import { MerchantTab } from './MerchantWorkspaceNav';

interface MerchantMobileNavProps {
  activeTab: MerchantTab;
  setActiveTab: (tab: MerchantTab) => void;
  totalOrdersCount: number;
  pendingDeliveriesCount: number;
  lowStockCount: number;
  onQuickNewShipment: () => void;
}

export const MerchantMobileNav: React.FC<MerchantMobileNavProps> = ({
  activeTab,
  setActiveTab,
  totalOrdersCount,
  pendingDeliveriesCount,
  lowStockCount,
  onQuickNewShipment,
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const navItems = [
    { id: 'home' as MerchantTab, label: 'الرئيسية', icon: Home },
    { id: 'orders' as MerchantTab, label: 'الطلبات', icon: Package, badge: totalOrdersCount },
    { id: 'pos' as MerchantTab, label: 'الكاشير', icon: Store, isHighlight: true },
  ];

  const secondaryDomains = [
    { id: 'deliveries' as MerchantTab, label: 'متابعة الشحنات الجارية', icon: Truck, badge: pendingDeliveriesCount },
    { id: 'returns' as MerchantTab, label: 'المرتجعات واستلام المتجر', icon: RotateCcw },
    { id: 'warehouse' as MerchantTab, label: 'المستودع وجرد الأصناف', icon: Boxes, badge: lowStockCount > 0 ? `${lowStockCount} تنبيه` : null },
    { id: 'invoices' as MerchantTab, label: 'فواتير المشتريات والمبيعات', icon: FileText },
    { id: 'customers' as MerchantTab, label: 'سجل ودليل الزبائن', icon: Users },
    { id: 'finance' as MerchantTab, label: 'المحفظة والمستحقات', icon: CreditCard },
    { id: 'accounting' as MerchantTab, label: 'الأرباح والأداء P&L', icon: Calculator },
    { id: 'branches' as MerchantTab, label: 'إدارة الفروع', icon: Building2 },
  ];

  return (
    <>
      {/* Mobile Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-800 text-white md:hidden shadow-2xl px-2 py-2 flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all ${
                isActive
                  ? 'text-amber-400 font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {item.badge ? (
                  <span className="absolute -top-1.5 -right-2 text-[9px] bg-amber-500 text-slate-950 px-1 rounded-full font-black">
                    {item.badge}
                  </span>
                ) : null}
              </div>
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </button>
          );
        })}

        {/* Quick New Shipment Button */}
        <button
          onClick={onQuickNewShipment}
          className="flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/30"
        >
          <PlusCircle className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">شحنة</span>
        </button>

        {/* Menu Drawer Toggle Button */}
        <button
          onClick={() => setIsDrawerOpen(true)}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl text-slate-400 hover:text-white ${
            secondaryDomains.some((d) => d.id === activeTab) ? 'text-amber-400 font-bold' : ''
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">المزيد</span>
        </button>
      </div>

      {/* Expandable Domain Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex justify-end md:hidden">
          <div className="w-4/5 max-w-xs bg-slate-900 h-full text-white p-5 space-y-4 overflow-y-auto border-l border-slate-800 shadow-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="font-black text-sm text-amber-400 flex items-center gap-2">
                  <Store className="w-4 h-4" />
                  <span>قائمة أقسام التاجر</span>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5 mt-4">
                {secondaryDomains.map((domain) => {
                  const Icon = domain.icon;
                  const isActive = activeTab === domain.id;
                  return (
                    <button
                      key={domain.id}
                      onClick={() => {
                        setActiveTab(domain.id);
                        setIsDrawerOpen(false);
                      }}
                      className={`w-full text-right p-2.5 rounded-xl text-xs font-bold flex items-center justify-between ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 font-black'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4" />
                        <span>{domain.label}</span>
                      </div>
                      {domain.badge && (
                        <span className="text-[10px] bg-slate-800 text-amber-300 px-2 py-0.5 rounded-full font-mono">
                          {domain.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 text-center text-[10px] text-slate-400">
              نظام التاجر المعتمد DELIVERE Merchant OS
            </div>
          </div>
        </div>
      )}
    </>
  );
};

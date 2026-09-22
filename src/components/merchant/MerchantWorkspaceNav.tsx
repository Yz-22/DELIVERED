import React from 'react';
import {
  Home,
  ShoppingBag,
  Store,
  Package,
  Boxes,
  FileText,
  Users,
  CreditCard,
  Calculator,
  Building2,
  PlusCircle,
  Clock,
  RotateCcw,
  Sparkles,
  ChevronRight,
  Sliders,
  TrendingUp,
  Truck
} from 'lucide-react';

export type MerchantTab =
  | 'home'
  | 'orders'
  | 'pos'
  | 'deliveries'
  | 'returns'
  | 'warehouse'
  | 'invoices'
  | 'customers'
  | 'finance'
  | 'accounting'
  | 'branches'
  | 'new_shipment';

interface MerchantWorkspaceNavProps {
  activeTab: MerchantTab;
  setActiveTab: (tab: MerchantTab) => void;
  totalOrdersCount: number;
  lowStockCount: number;
  pendingDeliveriesCount: number;
  returnsCount: number;
  onQuickNewShipment: () => void;
  onQuickPos: () => void;
}

export const MerchantWorkspaceNav: React.FC<MerchantWorkspaceNavProps> = ({
  activeTab,
  setActiveTab,
  totalOrdersCount,
  lowStockCount,
  pendingDeliveriesCount,
  returnsCount,
  onQuickNewShipment,
  onQuickPos,
}) => {
  // Domain Groups Definition
  const domains = [
    {
      group: 'الرئيسية',
      items: [
        { id: 'home' as MerchantTab, label: 'لوحة التحكم والعمليات', icon: Home, badge: null },
      ],
    },
    {
      group: 'المبيعات والكاشير (SELL)',
      items: [
        { id: 'orders' as MerchantTab, label: 'طلبات الشحن والزبائن', icon: Package, badge: totalOrdersCount > 0 ? totalOrdersCount : null },
        { id: 'pos' as MerchantTab, label: 'نقطة البيع والكاشير POS', icon: Store, badge: 'سريع', isHighlight: true },
      ],
    },
    {
      group: 'العمليات والتوصيل (OPERATIONS)',
      items: [
        { id: 'deliveries' as MerchantTab, label: 'متابعة الشحنات الجارية', icon: Truck, badge: pendingDeliveriesCount > 0 ? pendingDeliveriesCount : null },
        { id: 'returns' as MerchantTab, label: 'المرتجعات واستلام المتجر', icon: RotateCcw, badge: returnsCount > 0 ? returnsCount : null, isWarning: returnsCount > 0 },
      ],
    },
    {
      group: 'المنتجات والمخزون (CATALOG)',
      items: [
        { id: 'warehouse' as MerchantTab, label: 'المستودع وجرد الأصناف', icon: Boxes, badge: lowStockCount > 0 ? `${lowStockCount} تنبيه` : null, isAlert: lowStockCount > 0 },
      ],
    },
    {
      group: 'المشتريات والتوريد (PROCUREMENT)',
      items: [
        { id: 'invoices' as MerchantTab, label: 'فواتير المشتريات والمبيعات', icon: FileText, badge: null },
      ],
    },
    {
      group: 'العملاء (RELATIONSHIPS)',
      items: [
        { id: 'customers' as MerchantTab, label: 'دليل الزبائن والسجل', icon: Users, badge: null },
      ],
    },
    {
      group: 'المالية والمحفظة (FINANCE)',
      items: [
        { id: 'finance' as MerchantTab, label: 'المحفظة والمستحقات', icon: CreditCard, badge: null },
      ],
    },
    {
      group: 'التقارير والأرباح (INSIGHTS)',
      items: [
        { id: 'accounting' as MerchantTab, label: 'الأرباح والأداء P&L', icon: Calculator, badge: null },
      ],
    },
    {
      group: 'إدارة المتجر (BUSINESS)',
      items: [
        { id: 'branches' as MerchantTab, label: 'الفروع والمستودعات', icon: Building2, badge: null },
      ],
    },
  ];

  return (
    <div className="bg-slate-900 text-slate-100 rounded-3xl p-3 border border-slate-800 shadow-xl hidden md:block w-64 shrink-0 space-y-4">
      {/* Quick Action Trigger Buttons */}
      <div className="space-y-2 p-1">
        <button
          onClick={onQuickPos}
          className="w-full py-2.5 px-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-black text-xs flex items-center justify-between shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-98 transition-all cursor-pointer border border-amber-300"
        >
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4" />
            <span>كاشير سريع POS</span>
          </div>
          <span className="text-[10px] bg-slate-950/20 text-slate-950 px-1.5 py-0.5 rounded-full font-bold">
            F1
          </span>
        </button>

        <button
          onClick={onQuickNewShipment}
          className="w-full py-2 px-3 rounded-2xl bg-slate-800 hover:bg-slate-700/80 text-amber-400 font-bold text-xs flex items-center justify-between border border-slate-700/60 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-amber-400" />
            <span>إضافة شحنة جديدة</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 rotate-180" />
        </button>
      </div>

      <div className="h-px bg-slate-800 my-2" />

      {/* Domain Navigation Groupings */}
      <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-280px)] scrollbar-thin scrollbar-thumb-slate-700 pl-1">
        {domains.map((domain, idx) => (
          <div key={idx} className="space-y-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-3 py-1">
              {domain.group}
            </div>
            {domain.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full text-right px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive
                          ? 'text-slate-950'
                          : item.isHighlight
                          ? 'text-amber-400'
                          : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge !== null && item.badge !== undefined && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold shrink-0 ${
                        isActive
                          ? 'bg-slate-950/20 text-slate-950'
                          : item.isAlert
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : item.isWarning
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

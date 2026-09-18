import React from 'react';
import {
  Shield,
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  Truck,
  Package,
  FileSpreadsheet,
  RotateCcw,
  Sliders,
  DollarSign,
  FileText,
  Store,
  GitBranch,
  Receipt,
  Navigation,
  Settings,
  Code2,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Scan,
  Radio,
  ExternalLink,
  Layers,
  Sparkles,
} from 'lucide-react';
import { AppSection } from '../TopNavbar';
import { User } from '../../types/logistics';

interface NavItem {
  id: AppSection;
  label: string;
  icon: React.ElementType;
  badge?: string;
  badgeColor?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

interface SuperAdminSidebarProps {
  activeSection: AppSection | null;
  onChangeSection: (section: AppSection) => void;
  currentUser: User;
  onLogout?: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenScanner?: () => void;
  onOpenTracking?: () => void;
  onOpenIntegrations?: () => void;
  onOpenSchemaDoc?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const SuperAdminSidebar: React.FC<SuperAdminSidebarProps> = ({
  activeSection,
  onChangeSection,
  currentUser,
  onLogout,
  isCollapsed,
  onToggleCollapse,
  onOpenScanner,
  onOpenTracking,
  onOpenIntegrations,
  onOpenSchemaDoc,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const navGroups: NavGroup[] = [
    {
      title: 'إدارة المنصة والاشتراكات',
      items: [
        {
          id: 'super_admin_hub',
          label: 'مركز إدارة المنصة (Hub)',
          icon: Shield,
        },
        {
          id: 'users',
          label: 'المستخدمون والصلاحيات',
          icon: Users,
        },
        {
          id: 'settings',
          label: 'إعدادات النظام والتراخيص',
          icon: Settings,
        },
      ],
    },
    {
      title: 'العمليات والأسطول اللوجستي',
      items: [
        {
          id: 'operations_grid',
          label: 'لوحة العمليات والمؤشرات',
          icon: LayoutDashboard,
        },
        {
          id: 'operations',
          label: 'جدول الشحنات والطلبات',
          icon: Package,
        },
        {
          id: 'manifests',
          label: 'كشوفات ومنافست التوزيع',
          icon: FileSpreadsheet,
        },
        {
          id: 'staff_portal',
          label: 'محطة الفرز والمستودع',
          icon: Layers,
        },
        {
          id: 'reverse_logistics',
          label: 'اللوجستيات العكسية والمرتجعات',
          icon: RotateCcw,
        },
      ],
    },
    {
      title: 'المالية والحسابات',
      items: [
        {
          id: 'settlements',
          label: 'التسويات والمطابقة (COD)',
          icon: DollarSign,
        },
        {
          id: 'reports_statements',
          label: 'كشوفات الحساب والتقارير',
          icon: FileText,
        },
      ],
    },
    {
      title: 'بوابات المنظومة ونقاط البيع',
      items: [
        {
          id: 'cashier_workspace',
          label: 'مساحة الكاشير (POS)',
          icon: Receipt,
        },
        {
          id: 'merchant_portal',
          label: 'بوابة التاجر والمخزن',
          icon: Store,
        },
        {
          id: 'merchant_branches',
          label: 'إدارة فروع المتاجر',
          icon: GitBranch,
        },
        {
          id: 'driver_portal',
          label: 'بوابة كابتن التوصيل',
          icon: Truck,
        },
      ],
    },
  ];

  const handleSelect = (section: AppSection) => {
    onChangeSection(section);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-950/70 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 right-0 z-50 h-full bg-[#0B132B] text-slate-200 border-l border-slate-800/80 flex flex-col transition-all duration-300 ease-in-out shadow-2xl ${
          isCollapsed ? 'w-[74px]' : 'w-[260px]'
        } ${
          isMobileOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
        dir="rtl"
        aria-label="القائمة الجانبية للسوبر أدمن"
      >
        {/* Brand Header */}
        <div className="h-16 px-4 border-b border-slate-800/80 flex items-center justify-between shrink-0 bg-[#080E21]">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-lg shadow-amber-500/20">
              <Shield className="w-5 h-5 stroke-[2.5]" />
            </div>
            {!isCollapsed && (
              <div className="leading-tight overflow-hidden">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-sm tracking-tight text-white font-sans">
                    DELIVERE
                  </span>
                  <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-400 text-[10px] font-bold rounded border border-amber-500/30">
                    TMS
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-medium truncate">
                  مركز تحكم الإدارة العليا
                </div>
              </div>
            )}
          </div>

          {/* Collapse Toggle Button (Desktop only) */}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
            title={isCollapsed ? 'توسيع القائمة' : 'تصغير القائمة'}
            aria-label={isCollapsed ? 'توسيع القائمة' : 'تصغير القائمة'}
          >
            {isCollapsed ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation Items (Scrollable) */}
        <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4 custom-scrollbar">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              {!isCollapsed && (
                <div className="px-2.5 py-1 text-[11px] font-bold text-slate-400 tracking-wider">
                  {group.title}
                </div>
              )}
              {isCollapsed && gIdx > 0 && (
                <div className="my-2 border-t border-slate-800/80 mx-2" />
              )}

              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all group relative cursor-pointer ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                      }`}
                      title={isCollapsed ? item.label : undefined}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                          isActive
                            ? 'text-slate-950 stroke-[2.5]'
                            : 'text-slate-400 group-hover:text-amber-400'
                        }`}
                      />

                      {!isCollapsed && (
                        <span className="truncate flex-1 text-right">
                          {item.label}
                        </span>
                      )}

                      {!isCollapsed && item.badge && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold shrink-0 ${
                            item.badgeColor || 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}

                      {/* Tooltip for collapsed mode */}
                      {isCollapsed && (
                        <div className="absolute right-full mr-2 px-2.5 py-1 bg-slate-900 text-white text-xs font-bold rounded-lg shadow-xl border border-slate-700 whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                          {item.label}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Quick System Actions in Sidebar */}
          <div className="pt-2 border-t border-slate-800/80 space-y-1">
            {!isCollapsed && (
              <div className="px-2.5 py-1 text-[11px] font-bold text-slate-400">
                أدوات المنظومة السريعة
              </div>
            )}

            {onOpenScanner && (
              <button
                type="button"
                onClick={onOpenScanner}
                className="w-full flex items-center gap-3 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer group"
                title={isCollapsed ? 'ماسح الباركود' : undefined}
              >
                <Scan className="w-4 h-4 text-amber-400 shrink-0 group-hover:scale-110 transition-transform" />
                {!isCollapsed && <span>ماسح الباركود السريع</span>}
              </button>
            )}

            {onOpenTracking && (
              <button
                type="button"
                onClick={onOpenTracking}
                className="w-full flex items-center gap-3 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer group"
                title={isCollapsed ? 'تتبع الشحنات' : undefined}
              >
                <Radio className="w-4 h-4 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
                {!isCollapsed && <span>شاشة التتبع اللحظي</span>}
              </button>
            )}

            {onOpenIntegrations && (
              <button
                type="button"
                onClick={onOpenIntegrations}
                className="w-full flex items-center gap-3 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer group"
                title={isCollapsed ? 'الربط البرمجي للمتاجر' : undefined}
              >
                <Code2 className="w-4 h-4 text-indigo-400 shrink-0 group-hover:scale-110 transition-transform" />
                {!isCollapsed && <span>الربط البرمجي (APIs)</span>}
              </button>
            )}

            {onOpenSchemaDoc && (
              <button
                type="button"
                onClick={onOpenSchemaDoc}
                className="w-full flex items-center gap-3 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer group"
                title={isCollapsed ? 'هيكلية البيانات وقواعد الربط' : undefined}
              >
                <FileSpreadsheet className="w-4 h-4 text-cyan-400 shrink-0 group-hover:scale-110 transition-transform" />
                {!isCollapsed && <span>مخطط البيانات والتكامل</span>}
              </button>
            )}
          </div>
        </div>

        {/* User Account / Session Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-[#080E21] shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center font-black text-xs shrink-0">
                {currentUser.name ? currentUser.name.slice(0, 2) : 'SA'}
              </div>
              {!isCollapsed && (
                <div className="overflow-hidden leading-tight">
                  <div className="font-bold text-xs text-white truncate">
                    {currentUser.name}
                  </div>
                  <div
                    className="text-[10px] font-mono text-slate-400 truncate"
                    dir="ltr"
                  >
                    {currentUser.email}
                  </div>
                </div>
              )}
            </div>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer shrink-0"
                title="تسجيل الخروج"
                aria-label="تسجيل الخروج"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

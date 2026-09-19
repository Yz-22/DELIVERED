import React, { useState } from 'react';
import {
  Shield,
  Users,
  Settings,
  FileText,
  LogOut,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Sliders,
  Code2,
  Terminal,
} from 'lucide-react';
import { AppSection } from '../TopNavbar';
import { User } from '../../types/logistics';

interface PlatformNavItem {
  id: AppSection;
  label: string;
  icon: React.ElementType;
  description: string;
}

interface SuperAdminSidebarProps {
  activeSection: AppSection | null;
  onChangeSection: (section: AppSection) => void;
  currentUser: User;
  onLogout?: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
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
  onOpenIntegrations,
  onOpenSchemaDoc,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);

  // Pure Platform Governance & Administration Primary Navigation
  const platformNavItems: PlatformNavItem[] = [
    {
      id: 'super_admin_hub',
      label: 'مركز إدارة المنصة',
      description: 'نظرة عامة والشركات والاشتراكات',
      icon: Shield,
    },
    {
      id: 'users',
      label: 'المستخدمون والصلاحيات',
      description: 'إدارة الحسابات والدعوات والوصول',
      icon: Users,
    },
    {
      id: 'reports_statements',
      label: 'التقارير وسجلات النشاط',
      description: 'الكشوفات المالية وسجل التدقيق',
      icon: FileText,
    },
    {
      id: 'settings',
      label: 'إعدادات المنصة والتسعير',
      description: 'التكوينات والتراخيص الجذرية',
      icon: Settings,
    },
  ];

  const handleNavClick = (section: AppSection) => {
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
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-40 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 right-0 z-40 bg-[#080E21] border-l border-slate-800 flex flex-col transition-all duration-300 ease-in-out select-none ${
          isCollapsed ? 'w-[74px]' : 'w-[260px]'
        } ${
          isMobileOpen
            ? 'translate-x-0'
            : 'translate-x-full lg:translate-x-0'
        }`}
        dir="rtl"
      >
        {/* 1. Header & Brand */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400 font-black">
              <Shield className="w-5 h-5 text-amber-400" />
            </div>

            {!isCollapsed && (
              <div className="leading-tight truncate animate-in fade-in duration-200">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-sm text-white tracking-wide">
                    DELIVERE
                  </span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.2 rounded border border-amber-500/30">
                    ROOT
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-medium truncate">
                  إدارة المنصة المركزية
                </div>
              </div>
            )}
          </div>

          {/* Desktop Collapse Button */}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
            title={isCollapsed ? 'توسيع القائمة' : 'تصغير القائمة'}
            aria-label={isCollapsed ? 'توسيع القائمة الجانبية' : 'طي القائمة الجانبية'}
          >
            {isCollapsed ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* 2. Primary Navigation Body */}
        <div className="flex-1 overflow-y-auto px-2.5 py-4 space-y-6">
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="px-3 pb-1.5 text-[11px] font-bold text-slate-400">
                إدارة المنصة والتراخيص
              </div>
            )}

            {platformNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all group relative cursor-pointer ${
                    isActive
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  } ${isCollapsed ? 'justify-center px-0' : ''}`}
                  title={isCollapsed ? item.label : undefined}
                  aria-label={item.label}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive
                        ? 'text-amber-400'
                        : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />

                  {!isCollapsed && (
                    <div className="flex-1 text-right truncate">
                      <div className="truncate">{item.label}</div>
                      <div className="text-[10px] text-slate-400 font-normal truncate">
                        {item.description}
                      </div>
                    </div>
                  )}

                  {/* Active indicator bar */}
                  {isActive && (
                    <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-amber-500 rounded-l" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Collapsible Developer & Integration Tools */}
          <div className="space-y-1 pt-2 border-t border-slate-800/60">
            {!isCollapsed ? (
              <div>
                <button
                  type="button"
                  onClick={() => setIsDevToolsOpen(!isDevToolsOpen)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-bold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-slate-500" />
                    <span>أدوات المطورين</span>
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isDevToolsOpen ? 'rotate-180 text-amber-400' : ''
                    }`}
                  />
                </button>

                {isDevToolsOpen && (
                  <div className="pt-1 pr-2 space-y-1 animate-in fade-in duration-150">
                    {onOpenIntegrations && (
                      <button
                        type="button"
                        onClick={onOpenIntegrations}
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all cursor-pointer"
                      >
                        <Sliders className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>الربط البرمجي (APIs)</span>
                      </button>
                    )}

                    {onOpenSchemaDoc && (
                      <button
                        type="button"
                        onClick={onOpenSchemaDoc}
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all cursor-pointer"
                      >
                        <Code2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>مخطط البيانات والتوثيق</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {onOpenIntegrations && (
                  <button
                    type="button"
                    onClick={onOpenIntegrations}
                    className="w-full flex items-center justify-center py-2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    title="الربط البرمجي (APIs)"
                  >
                    <Sliders className="w-4 h-4" />
                  </button>
                )}
                {onOpenSchemaDoc && (
                  <button
                    type="button"
                    onClick={onOpenSchemaDoc}
                    className="w-full flex items-center justify-center py-2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    title="مخطط البيانات"
                  >
                    <Code2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 3. Footer / User Profile & Logout */}
        <div className="p-3 border-t border-slate-800/80 bg-[#060B1A] shrink-0">
          <div
            className={`flex items-center gap-3 ${
              isCollapsed ? 'justify-center' : 'justify-between'
            }`}
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
                {currentUser.name ? currentUser.name.slice(0, 2) : 'SA'}
              </div>

              {!isCollapsed && (
                <div className="leading-tight truncate">
                  <div className="font-bold text-xs text-white truncate">
                    {currentUser.name}
                  </div>
                  <div className="text-[10px] text-amber-400 font-semibold truncate">
                    المدير العام للنظام
                  </div>
                </div>
              )}
            </div>

            {onLogout && !isCollapsed && (
              <button
                type="button"
                onClick={onLogout}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
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

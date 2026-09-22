import React, { useState, useRef, useEffect } from 'react';
import { useTenantBranding } from '../../context/TenantBrandingContext';
import {
  LayoutGrid,
  Scan,
  Search,
  Code2,
  Database,
  Download,
  Shield,
  ChevronDown,
  LogOut,
  Menu,
  Check,
} from 'lucide-react';
import { User, Role } from '../../types/logistics';
import { AppSection } from '../TopNavbar';
import {
  getRoleLabel,
  getLauncherItemsForRole,
} from './navigationConfig';
import { resolveWorkspaceForUser } from '../../lib/workspaceResolver';

export interface GlobalHeaderProps {
  activeSection: AppSection | null;
  onChangeSection: (section: AppSection) => void;
  currentUser?: User | null;
  onOpenScanner?: () => void;
  onOpenTracking?: () => void;
  onOpenRouteOptimizer?: () => void;
  onOpenSchemaDoc?: () => void;
  onOpenIntegrations?: () => void;
  onDownloadBackup?: () => void;
  onLogout?: () => void;
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
}

export const GlobalHeader: React.FC<GlobalHeaderProps> = ({
  activeSection,
  onChangeSection,
  currentUser,
  onOpenScanner,
  onOpenTracking,
  onOpenSchemaDoc,
  onOpenIntegrations,
  onDownloadBackup,
  onLogout,
  onToggleMobileMenu,
  isMobileMenuOpen,
}) => {
  const [isLauncherOpen, setIsLauncherOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const launcherRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const { branding } = useTenantBranding();
  const role = currentUser?.role;

  const launcherItems = getLauncherItemsForRole(role);

  // Close dropdowns on outside click or ESC key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (launcherRef.current && !launcherRef.current.contains(e.target as Node)) {
        setIsLauncherOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsLauncherOpen(false);
        setIsProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleBrandClick = () => {
    const target = resolveWorkspaceForUser(currentUser);
    if (target) {
      onChangeSection(target);
    }
  };

  const getUserInitials = () => {
    if (!currentUser?.name) return 'مد';
    const parts = currentUser.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[1].charAt(0)}`;
    }
    return currentUser.name.slice(0, 2);
  };

  return (
    <header className="bg-slate-900/95 backdrop-blur-md text-slate-100 border-b border-slate-800 sticky top-0 z-40 transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-15 gap-2">
          {/* Right/Start: Brand & ERP 9-Dots Launcher */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Mobile Menu Hamburger Button */}
            {onToggleMobileMenu && (
              <button
                type="button"
                onClick={onToggleMobileMenu}
                aria-label="فتح القائمة الرئيسية"
                aria-expanded={isMobileMenuOpen}
                className="lg:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors focus-ring cursor-pointer"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            {/* 9-Dots ERP Apps Launcher */}
            <div className="relative" ref={launcherRef}>
              <button
                type="button"
                onClick={() => {
                  setIsLauncherOpen((prev) => !prev);
                  setIsProfileOpen(false);
                }}
                aria-label="قائمة تطبيقات ومنظومة ERP"
                aria-expanded={isLauncherOpen}
                aria-haspopup="true"
                className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 flex items-center justify-center text-slate-950 font-black shadow-sm transition-all focus-ring cursor-pointer"
                title="قائمة تطبيقات ومنظومة ERP"
              >
                <LayoutGrid className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-slate-950 stroke-[2.4]" />
              </button>

              {/* Launcher Dropdown */}
              {isLauncherOpen && (
                <div
                  role="menu"
                  aria-orientation="vertical"
                  className="absolute start-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 z-50 text-slate-200 animate-in fade-in slide-in-from-top-2"
                >
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 border-b border-slate-800 mb-1 flex items-center justify-between">
                    <span>منظومات النظام (ERP)</span>
                    <span className="font-mono text-amber-500 font-bold">Delivere OS</span>
                  </div>

                  <div className="space-y-1">
                    {launcherItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeSection === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            onChangeSection(item.id);
                            setIsLauncherOpen(false);
                          }}
                          className={`w-full text-start px-3 py-2 rounded-lg flex items-center justify-between transition-colors focus-ring cursor-pointer ${
                            isActive
                              ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                              : 'hover:bg-slate-800 text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-slate-950' : 'text-amber-400'}`} />
                            <div className="truncate">
                              <span className="text-xs block font-semibold truncate">{item.title}</span>
                              <span className={`text-[10px] block truncate ${isActive ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
                                {item.subtitle}
                              </span>
                            </div>
                          </div>
                          {isActive && <Check className="w-3.5 h-3.5 text-slate-950 shrink-0 ms-1" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Brand Logo & Company Title */}
            <div
              className="flex items-center gap-2 cursor-pointer shrink-0 select-none"
              onClick={handleBrandClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleBrandClick();
                }
              }}
              title="العودة للرئيسية"
            >
              {branding.logoUrl && role !== 'SUPER_ADMIN' ? (
                <div className="h-8 max-w-[110px] flex items-center justify-center overflow-hidden rounded-md bg-white/10 p-1 border border-white/10">
                  <img
                    src={branding.logoUrl}
                    alt={branding.companyName}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : null}

              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-sm sm:text-base tracking-wide text-white">
                    {role === 'SUPER_ADMIN'
                      ? 'منصة Delivere'
                      : branding.companyName || 'Delivere'}
                  </span>
                  <span className="text-[10px] bg-amber-500/15 text-amber-300 font-bold px-1.5 py-0.5 rounded border border-amber-500/30">
                    TMS
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight hidden xs:block">
                  {role === 'SUPER_ADMIN'
                    ? 'منظومة إدارة الشركات والاشتراكات'
                    : 'منظومة إدارة الشحنات والعمليات'}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Global Action Tools & User Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Quick Barcode Scanner */}
            {onOpenScanner && (
              <button
                type="button"
                onClick={onOpenScanner}
                aria-label="الماسح الباركودي"
                className="px-2.5 py-1.5 rounded-lg bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 border border-indigo-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors focus-ring cursor-pointer"
                title="ماسح الباركود السريع"
              >
                <Scan className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline">الماسح</span>
              </button>
            )}

            {/* Quick Tracking Button */}
            {onOpenTracking && (
              <button
                type="button"
                onClick={onOpenTracking}
                aria-label="تتبع شحنة"
                className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors focus-ring cursor-pointer"
                title="تتبع شحنة"
              >
                <Search className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">تتبع</span>
              </button>
            )}

            {/* Integrations (Webhooks & API) - Available for SUPER_ADMIN & ADMIN */}
            {(role === 'SUPER_ADMIN' || role === 'ADMIN') && onOpenIntegrations && (
              <button
                type="button"
                onClick={onOpenIntegrations}
                aria-label="الربط البرمجي للمتاجر"
                className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors focus-ring cursor-pointer"
                title="الربط البرمجي للمتاجر (Shopify / Salla / WooCommerce)"
              >
                <Code2 className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden xl:inline">API</span>
              </button>
            )}

            {/* Prisma Schema Doc */}
            {(role === 'SUPER_ADMIN' || role === 'ADMIN') && onOpenSchemaDoc && (
              <button
                type="button"
                onClick={onOpenSchemaDoc}
                aria-label="عرض كود Prisma ومسارات API"
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus-ring cursor-pointer"
                title="عرض كود Prisma ومسارات API"
              >
                <Database className="w-4 h-4 text-amber-400" />
              </button>
            )}

            {/* Database Backup Export */}
            {(role === 'SUPER_ADMIN' || role === 'ADMIN') && onDownloadBackup && (
              <button
                type="button"
                onClick={onDownloadBackup}
                aria-label="تصدير نسخة احتياطية"
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus-ring cursor-pointer"
                title="تصدير نسخة احتياطية من قاعدة البيانات (Backup JSON)"
              >
                <Download className="w-4 h-4 text-emerald-400" />
              </button>
            )}

            {/* User Profile & Menu */}
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => {
                  setIsProfileOpen((prev) => !prev);
                  setIsLauncherOpen(false);
                }}
                aria-label="إدارة الحساب والجلسة"
                aria-expanded={isProfileOpen}
                aria-haspopup="true"
                className="flex items-center gap-2 pe-1 sm:pe-2 ps-1 border-s border-slate-800 hover:bg-slate-800/70 p-1 sm:p-1.5 rounded-lg sm:rounded-xl transition-colors text-start focus-ring cursor-pointer"
                title="إدارة الجلسة وبيانات الحساب (RBAC)"
              >
                <div className="w-8 h-8 rounded-lg sm:rounded-xl bg-amber-500 text-slate-950 font-black flex items-center justify-center text-xs shadow-xs">
                  {getUserInitials()}
                </div>
                <div className="hidden xl:block text-start max-w-[130px]">
                  <div className="text-xs font-bold text-white leading-tight truncate">
                    {currentUser?.name || 'مستخدم النظام'}
                  </div>
                  <div className="text-[10px] text-amber-400 font-medium flex items-center gap-1 truncate">
                    <Shield className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">{getRoleLabel(role)}</span>
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>

              {/* Profile Dropdown */}
              {isProfileOpen && (
                <div
                  role="menu"
                  aria-orientation="vertical"
                  className="absolute end-0 mt-2 w-68 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-3 z-50 text-slate-200 animate-in fade-in slide-in-from-top-2 text-start"
                >
                  <div className="border-b border-slate-800 pb-2.5 mb-2">
                    <div className="text-xs font-bold text-white truncate">{currentUser?.name || 'مستخدم النظام'}</div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">{currentUser?.email || '—'}</div>
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold">
                      <Shield className="w-3 h-3 shrink-0" />
                      <span className="truncate">{getRoleLabel(role)}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {onLogout && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsProfileOpen(false);
                          onLogout();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors text-start focus-ring cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>تسجيل الخروج من النظام</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

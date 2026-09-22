import React, { useEffect } from 'react';
import {
  X,
  Shield,
  LogOut,
  Scan,
  Search,
  Code2,
  Database,
  Download,
  Check,
} from 'lucide-react';
import { User, Role } from '../../types/logistics';
import { AppSection } from '../TopNavbar';
import {
  getRoleLabel,
  getNavItemsForRole,
} from './navigationConfig';

export interface MobileNavigationProps {
  isOpen: boolean;
  onClose: () => void;
  activeSection: AppSection | null;
  onChangeSection: (section: AppSection) => void;
  currentUser?: User | null;
  onLogout?: () => void;
  onOpenScanner?: () => void;
  onOpenTracking?: () => void;
  onOpenSchemaDoc?: () => void;
  onOpenIntegrations?: () => void;
  onDownloadBackup?: () => void;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  isOpen,
  onClose,
  activeSection,
  onChangeSection,
  currentUser,
  onLogout,
  onOpenScanner,
  onOpenTracking,
  onOpenSchemaDoc,
  onOpenIntegrations,
  onDownloadBackup,
}) => {
  const role = currentUser?.role;
  const navItems = getNavItemsForRole(role);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleSelectSection = (section: AppSection) => {
    onChangeSection(section);
    onClose();
  };

  return (
    <>
      {/* 1. Sub-Navbar for Quick Mobile Tab Switching (Visible on mobile/tablet when drawer is closed) */}
      <div className="lg:hidden bg-slate-900 border-b border-slate-800 px-3 py-2 overflow-x-auto no-scrollbar select-none">
        <div className="flex items-center gap-1.5 min-w-max">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeSection(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all focus-ring cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                    : 'text-slate-300 hover:text-white bg-slate-800/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-slate-950' : 'text-amber-400'}`} />
                <span>{item.shortLabel || item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Full Drawer Modal */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="القائمة الجانبية للتنقل"
          className="fixed inset-0 z-50 flex lg:hidden"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity animate-in fade-in"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div className="relative start-0 w-full max-w-xs bg-slate-900 border-e border-slate-800 h-full flex flex-col shadow-2xl z-10 animate-in slide-in-from-start duration-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-black flex items-center justify-center text-xs">
                  {currentUser?.name ? currentUser.name.slice(0, 2) : 'دي'}
                </div>
                <div>
                  <h2 className="text-xs font-bold text-white truncate max-w-[170px]">
                    {currentUser?.name || 'مستخدم النظام'}
                  </h2>
                  <div className="text-[10px] text-amber-400 font-medium flex items-center gap-1">
                    <Shield className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">{getRoleLabel(role)}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="إغلاق القائمة"
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus-ring cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                مساحات العمل والتنقل
              </div>

              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectSection(item.id)}
                    className={`w-full min-h-[44px] text-start px-3 py-2.5 rounded-xl flex items-center justify-between transition-colors focus-ring cursor-pointer ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                        : 'text-slate-200 hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-slate-950' : 'text-amber-400'}`} />
                      <div>
                        <div className="text-xs font-bold">{item.label}</div>
                        <div className={`text-[10px] ${isActive ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
                          {item.description}
                        </div>
                      </div>
                    </div>
                    {isActive && <Check className="w-4 h-4 text-slate-950 shrink-0" />}
                  </button>
                );
              })}

              {/* Quick Tools in Mobile Drawer */}
              <div className="pt-3 border-t border-slate-800/80 mt-3 space-y-1">
                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  الأدوات والخدمات السريعة
                </div>

                {onOpenScanner && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenScanner();
                    }}
                    className="w-full min-h-[44px] text-start px-3 py-2 rounded-lg text-xs font-semibold text-indigo-300 hover:bg-slate-800 flex items-center gap-2.5 focus-ring cursor-pointer"
                  >
                    <Scan className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>ماسح الباركود السريع</span>
                  </button>
                )}

                {onOpenTracking && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenTracking();
                    }}
                    className="w-full min-h-[44px] text-start px-3 py-2 rounded-lg text-xs font-semibold text-emerald-300 hover:bg-slate-800 flex items-center gap-2.5 focus-ring cursor-pointer"
                  >
                    <Search className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>تتبع الشحنات بالرقم المرجعي</span>
                  </button>
                )}

                {(role === 'SUPER_ADMIN' || role === 'ADMIN') && onOpenIntegrations && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenIntegrations();
                    }}
                    className="w-full min-h-[44px] text-start px-3 py-2 rounded-lg text-xs font-semibold text-amber-300 hover:bg-slate-800 flex items-center gap-2.5 focus-ring cursor-pointer"
                  >
                    <Code2 className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>الربط البرمجي للمتاجر (API)</span>
                  </button>
                )}

                {(role === 'SUPER_ADMIN' || role === 'ADMIN') && onOpenSchemaDoc && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenSchemaDoc();
                    }}
                    className="w-full min-h-[44px] text-start px-3 py-2 rounded-lg text-xs font-semibold text-amber-300 hover:bg-slate-800 flex items-center gap-2.5 focus-ring cursor-pointer"
                  >
                    <Database className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>هيكلية Prisma ومسارات الـ API</span>
                  </button>
                )}

                {(role === 'SUPER_ADMIN' || role === 'ADMIN') && onDownloadBackup && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onDownloadBackup();
                    }}
                    className="w-full min-h-[44px] text-start px-3 py-2 rounded-lg text-xs font-semibold text-emerald-300 hover:bg-slate-800 flex items-center gap-2.5 focus-ring cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>تصدير نسخة احتياطية (JSON)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Footer with Logout */}
            {onLogout && (
              <div className="p-3 border-t border-slate-800 bg-slate-900/90">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onLogout();
                  }}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition-colors focus-ring cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>تسجيل الخروج من النظام</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

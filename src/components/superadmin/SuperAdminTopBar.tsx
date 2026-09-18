import React, { useState } from 'react';
import {
  Menu,
  Bell,
  Search,
  Scan,
  Radio,
  Download,
  RotateCw,
  Shield,
  LogOut,
  User as UserIcon,
  ChevronDown,
  CheckCircle2,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { AppSection } from '../TopNavbar';
import { User } from '../../types/logistics';
import { WORKSPACE_METADATA } from '../../lib/workspaceResolver';

interface SuperAdminTopBarProps {
  activeSection: AppSection | null;
  onChangeSection: (section: AppSection) => void;
  currentUser: User;
  onLogout?: () => void;
  onRefresh?: () => void;
  onOpenMobileMenu: () => void;
  onOpenScanner?: () => void;
  onOpenTracking?: () => void;
  onDownloadBackup?: () => void;
  isRefreshing?: boolean;
}

export const SuperAdminTopBar: React.FC<SuperAdminTopBarProps> = ({
  activeSection,
  onChangeSection,
  currentUser,
  onLogout,
  onRefresh,
  onOpenMobileMenu,
  onOpenScanner,
  onOpenTracking,
  onDownloadBackup,
  isRefreshing = false,
}) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const meta = activeSection ? WORKSPACE_METADATA[activeSection] : null;

  return (
    <header
      className="h-16 bg-[#0B132B] border-b border-slate-800/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs"
      dir="rtl"
    >
      {/* Right side: Mobile Menu Toggle & Breadcrumb Title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label="فتح القائمة الرئيسية"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <span>منصة الإدارة المركزية</span>
            <span>/</span>
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
              {meta ? meta.titleAr : 'مركز تحكم السوبر أدمن'}
            </h2>
            <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <Shield className="w-3 h-3 text-amber-400" />
              <span>SUPER_ADMIN</span>
            </span>
          </div>
        </div>
      </div>

      {/* Left side: Quick Actions, System Status, User Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Refresh Action */}
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition-all border border-slate-700/60 cursor-pointer disabled:opacity-50"
            title="تحديث البيانات اللحظية"
            aria-label="تحديث البيانات"
          >
            <RotateCw
              className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`}
            />
          </button>
        )}

        {/* Quick Scanner Action */}
        {onOpenScanner && (
          <button
            type="button"
            onClick={onOpenScanner}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700/80 rounded-xl text-xs font-bold transition-all cursor-pointer"
            title="ماسح الباركود السريع"
          >
            <Scan className="w-3.5 h-3.5 text-amber-400" />
            <span>الماسح</span>
          </button>
        )}

        {/* Live Tracking Action */}
        {onOpenTracking && (
          <button
            type="button"
            onClick={onOpenTracking}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700/80 rounded-xl text-xs font-bold transition-all cursor-pointer"
            title="التتبع الحي الميداني"
          >
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span>التتبع</span>
          </button>
        )}

        {/* Backup Download */}
        {onDownloadBackup && (
          <button
            type="button"
            onClick={onDownloadBackup}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700/80 rounded-xl text-xs font-bold transition-all cursor-pointer"
            title="تحميل نسخة احتياطية من البيانات"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>نسخة احتياطية</span>
          </button>
        )}

        <div className="h-6 w-px bg-slate-800 mx-1 hidden sm:block" />

        {/* User Profile Dropdown Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 text-slate-200 transition-colors cursor-pointer"
            aria-expanded={isProfileOpen}
            aria-haspopup="true"
          >
            <div className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xs">
              {currentUser.name ? currentUser.name.slice(0, 2) : 'SA'}
            </div>
            <div className="hidden md:block text-right leading-tight">
              <div className="font-bold text-xs text-white truncate max-w-[120px]">
                {currentUser.name}
              </div>
              <div className="text-[10px] text-amber-400 font-semibold">
                المالك العام
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {isProfileOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsProfileOpen(false)}
              />
              <div
                className="absolute left-0 mt-2 w-64 bg-[#0B132B] border border-slate-700 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-right"
                dir="rtl"
              >
                <div className="p-2.5 border-b border-slate-800/80 space-y-1">
                  <div className="font-bold text-xs text-white">
                    {currentUser.name}
                  </div>
                  <div
                    className="text-[11px] font-mono text-slate-400 break-all"
                    dir="ltr"
                  >
                    {currentUser.email}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-emerald-400 pt-1 font-bold">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>جلسة إدارة معتمدة ومشفرة</span>
                  </div>
                </div>

                <div className="py-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileOpen(false);
                      onChangeSection('super_admin_hub');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-xl transition-colors text-right cursor-pointer"
                  >
                    <Shield className="w-4 h-4 text-amber-400" />
                    <span>مركز إدارة التراخيص والاشتراكات</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileOpen(false);
                      onChangeSection('users');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-xl transition-colors text-right cursor-pointer"
                  >
                    <UserIcon className="w-4 h-4 text-indigo-400" />
                    <span>إدارة المستخدمين والصلاحيات</span>
                  </button>
                </div>

                {onLogout && (
                  <div className="pt-1 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors text-right cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>تسجيل الخروج من المنصة</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

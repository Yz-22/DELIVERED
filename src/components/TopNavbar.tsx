import React, { useState } from 'react';
import {
  Truck,
  Bell,
  Search,
  Scan,
  Database,
  ExternalLink,
  Car,
  Receipt,
  LayoutDashboard,
  Building2,
  RotateCcw,
  Navigation,
  Code2,
  Download,
  Shield,
  Users,
  BarChart3,
  PackageCheck,
  ChevronDown,
  ListOrdered,
  FileSpreadsheet,
  Briefcase,
  CheckCircle2,
} from 'lucide-react';
import { User, Role } from '../types/logistics';

export type AppSection =
  | 'operations_grid'
  | 'operations'
  | 'manifests'
  | 'users'
  | 'staff_portal'
  | 'driver_portal'
  | 'merchant_portal'
  | 'settlements'
  | 'reverse_logistics';

interface TopNavbarProps {
  activeSection: AppSection;
  onChangeSection: (section: AppSection) => void;
  onOpenScanner: () => void;
  onOpenTracking: () => void;
  onOpenRouteOptimizer: () => void;
  onOpenSchemaDoc: () => void;
  onOpenIntegrations?: () => void;
  currentUser?: User | null;
  onOpenAuthLogin?: () => void;
  onDownloadBackup?: () => void;
  onSwitchRoleQuick?: (role: Role) => void;
  onQuickRoleSwitch?: (role: Role) => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  activeSection,
  onChangeSection,
  onOpenScanner,
  onOpenTracking,
  onOpenRouteOptimizer,
  onOpenSchemaDoc,
  onOpenIntegrations,
  currentUser,
  onOpenAuthLogin,
  onDownloadBackup,
  onSwitchRoleQuick,
  onQuickRoleSwitch,
}) => {
  const handleRoleSwitch = onSwitchRoleQuick || onQuickRoleSwitch;
  const [isManifestsOpen, setIsManifestsOpen] = useState(false);
  const [isUsersDropdownOpen, setIsUsersDropdownOpen] = useState(false);

  const role = currentUser?.role || 'ADMIN';

  return (
    <header className="bg-slate-900 text-slate-100 border-b border-slate-800 sticky top-0 z-40 shadow-md">
      {/* 1. Production Role Switcher Banner (عزل الصلاحيات كأن التطبيق منشور في بيئة الإنتاج) */}
      <div className="bg-slate-950/90 border-b border-slate-800/80 px-4 sm:px-6 lg:px-8 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">الحساب الفعّال حالياً:</span>
          <span className="font-bold text-white flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-0.5 rounded-md border border-slate-700">
            {role === 'ADMIN' && <Shield className="w-3.5 h-3.5 text-amber-400" />}
            {role === 'OPERATOR' && <Briefcase className="w-3.5 h-3.5 text-blue-400" />}
            {role === 'MERCHANT' && <Building2 className="w-3.5 h-3.5 text-indigo-400" />}
            {role === 'DRIVER' && <Car className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{currentUser?.name || 'مدير النظام'}</span>
            <span className="text-[10px] text-slate-400">
              (
              {role === 'ADMIN'
                ? 'مدير العمليات'
                : role === 'OPERATOR'
                ? 'موظف العمليات'
                : role === 'MERCHANT'
                ? 'حساب تاجر'
                : 'كابتن توصيل'}
              )
            </span>
          </span>
        </div>

        {/* Quick Role Simulator Pills */}
        {handleRoleSwitch && (
          <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px]">
            <span className="text-slate-400 px-1.5 hidden md:inline">محاكاة الدخول بصلاحية:</span>
            <button
              type="button"
              onClick={() => handleRoleSwitch('ADMIN')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                role === 'ADMIN'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              العمليات (Admin)
            </button>
            <button
              type="button"
              onClick={() => handleRoleSwitch('OPERATOR')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                role === 'OPERATOR'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              الموظفون (Staff)
            </button>
            <button
              type="button"
              onClick={() => handleRoleSwitch('MERCHANT')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                role === 'MERCHANT'
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              التجار (Merchant)
            </button>
            <button
              type="button"
              onClick={() => handleRoleSwitch('DRIVER')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                role === 'DRIVER'
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              الكابتن (Driver)
            </button>
          </div>
        )}
      </div>

      {/* 2. Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-15">
          {/* Brand Logo (Matching ERP images with yellow square and 'التوصيل') */}
          <div
            className="flex items-center gap-2.5 cursor-pointer shrink-0"
            onClick={() => {
              if (role === 'MERCHANT') onChangeSection('merchant_portal');
              else if (role === 'DRIVER') onChangeSection('driver_portal');
              else if (role === 'OPERATOR') onChangeSection('staff_portal');
              else onChangeSection('operations_grid');
            }}
          >
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-black shadow-sm">
              <Truck className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-wide text-white">
                  التوصيل
                </span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.2 rounded border border-amber-500/30">
                  TMS ERP
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                منظومة إدارة الشحنات والعمليات
              </p>
            </div>
          </div>

          {/* Center Navigation Menus - Dynamically Filtered by Role */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 text-xs font-semibold">
            {/* ADMIN Role Menus */}
            {role === 'ADMIN' && (
              <>
                {/* لوحة العمليات (Grid from screenshots 3 & 4) */}
                <button
                  onClick={() => onChangeSection('operations_grid')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                    activeSection === 'operations_grid'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>لوحة العمليات</span>
                </button>

                {/* جدول الطلبيات */}
                <button
                  onClick={() => onChangeSection('operations')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                    activeSection === 'operations'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                  <span>الطلبيات</span>
                </button>

                {/* كشوفات (Manifests & Statements from screenshot 1) */}
                <button
                  onClick={() => onChangeSection('manifests')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                    activeSection === 'manifests'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>كشوفات</span>
                </button>

                {/* المستخدمون (Users from screenshots 1 & 2) */}
                <button
                  onClick={() => onChangeSection('users')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                    activeSection === 'users'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>المستخدمون</span>
                </button>

                {/* التسويات المالية */}
                <button
                  onClick={() => onChangeSection('settlements')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                    activeSection === 'settlements'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>التسويات المالية</span>
                </button>

                {/* المرتجعات والرفوف */}
                <button
                  onClick={() => onChangeSection('reverse_logistics')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                    activeSection === 'reverse_logistics'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>المرتجعات</span>
                </button>

                {/* بوابات الموظف / الكابتن / المتجر السريعة للإدارة */}
                <button
                  onClick={() => onChangeSection('staff_portal')}
                  className={`px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 text-[11px] ${
                    activeSection === 'staff_portal' ? 'bg-slate-700 text-white font-bold' : ''
                  }`}
                  title="عرض واجهة موظف المستودع"
                >
                  بوابة الموظف
                </button>
              </>
            )}

            {/* OPERATOR / STAFF Role Menus (الموظفون ومسؤولو الفرز) */}
            {role === 'OPERATOR' && (
              <>
                <button
                  onClick={() => onChangeSection('staff_portal')}
                  className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                    activeSection === 'staff_portal'
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <PackageCheck className="w-3.5 h-3.5" />
                  <span>بوابة الموظف والفرز</span>
                </button>

                <button
                  onClick={() => onChangeSection('operations')}
                  className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                    activeSection === 'operations'
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                  <span>جدول الشحنات</span>
                </button>

                <button
                  onClick={() => onChangeSection('manifests')}
                  className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                    activeSection === 'manifests'
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>كشوفات التوزيع</span>
                </button>

                <button
                  onClick={() => onChangeSection('reverse_logistics')}
                  className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                    activeSection === 'reverse_logistics'
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>المرتجعات والرفوف</span>
                </button>
              </>
            )}

            {/* MERCHANT Role Menus (التجار) */}
            {role === 'MERCHANT' && (
              <>
                <button
                  onClick={() => onChangeSection('merchant_portal')}
                  className={`px-4 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                    activeSection === 'merchant_portal'
                      ? 'bg-indigo-600 text-white font-bold shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>بوابة المتجر وطلبياتي</span>
                </button>

                <button
                  onClick={() => onChangeSection('settlements')}
                  className={`px-4 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                    activeSection === 'settlements'
                      ? 'bg-indigo-600 text-white font-bold shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>كشوفات التحصيل المالي (COD)</span>
                </button>

                {onOpenIntegrations && (
                  <button
                    onClick={onOpenIntegrations}
                    className="px-4 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/50 flex items-center gap-1.5"
                  >
                    <Code2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>الربط البرمجي لمتجري</span>
                  </button>
                )}
              </>
            )}

            {/* DRIVER Role Menus (الكباتن) */}
            {role === 'DRIVER' && (
              <>
                <button
                  onClick={() => onChangeSection('driver_portal')}
                  className={`px-4 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                    activeSection === 'driver_portal'
                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <Car className="w-3.5 h-3.5" />
                  <span>بوابة الكابتن وطلبيات الرحلة</span>
                </button>

                <button
                  onClick={onOpenRouteOptimizer}
                  className="px-4 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/50 flex items-center gap-1.5"
                >
                  <Navigation className="w-3.5 h-3.5 text-blue-400" />
                  <span>المسار والخرائط</span>
                </button>
              </>
            )}
          </div>

          {/* Quick Action Tools & Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Quick Barcode Scanner Button */}
            <button
              onClick={onOpenScanner}
              className="px-2.5 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30 text-xs font-bold flex items-center gap-1.5 transition-all"
              title="ماسح الباركود السريع"
            >
              <Scan className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">الماسح</span>
            </button>

            {/* Quick Tracking Button */}
            <button
              onClick={onOpenTracking}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-all"
              title="تتبع شحنة"
            >
              <Search className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">تتبع</span>
            </button>

            {/* Integrations (Webhooks & API) - Available for ADMIN */}
            {role === 'ADMIN' && onOpenIntegrations && (
              <button
                onClick={onOpenIntegrations}
                className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-all"
                title="الربط البرمجي للمتاجر (Shopify / Salla / WooCommerce)"
              >
                <Code2 className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden xl:inline">API</span>
              </button>
            )}

            {/* Prisma Schema Doc */}
            {role === 'ADMIN' && (
              <button
                onClick={onOpenSchemaDoc}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
                title="عرض كود Prisma ومسارات API"
              >
                <Database className="w-4 h-4 text-amber-400" />
              </button>
            )}

            {/* Database Backup Export */}
            {role === 'ADMIN' && onDownloadBackup && (
              <button
                onClick={onDownloadBackup}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
                title="تصدير نسخة احتياطية من قاعدة البيانات (Backup JSON)"
              >
                <Download className="w-4 h-4 text-emerald-400" />
              </button>
            )}

            {/* User Profile & Role Switcher */}
            <button
              onClick={onOpenAuthLogin}
              className="flex items-center gap-2 pr-2 border-r border-slate-800 hover:bg-slate-800/60 p-1 rounded-lg transition-colors text-right"
              title="إدارة الجلسة وتبديل الحساب / الصلاحيات (RBAC)"
            >
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 font-bold text-xs">
                {currentUser?.name ? currentUser.name.slice(0, 2) : 'با'}
              </div>
              <div className="hidden 2xl:block text-right">
                <div className="text-xs font-semibold text-white leading-tight">
                  {currentUser?.name || 'باسل البلبيسي'}
                </div>
                <div className="text-[10px] text-amber-400 flex items-center gap-1">
                  <Shield className="w-2.5 h-2.5" />
                  <span>
                    {role === 'ADMIN'
                      ? 'مدير العمليات'
                      : role === 'OPERATOR'
                      ? 'موظف العمليات'
                      : role === 'MERCHANT'
                      ? 'حساب تاجر'
                      : 'كابتن توصيل'}
                  </span>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Navigation Sub-bar */}
        <div className="flex lg:hidden items-center justify-between overflow-x-auto py-2 border-t border-slate-800 text-xs font-bold gap-1">
          {role === 'ADMIN' && (
            <>
              <button
                onClick={() => onChangeSection('operations_grid')}
                className={`px-2.5 py-1 rounded-lg shrink-0 ${
                  activeSection === 'operations_grid' ? 'bg-amber-500 text-slate-950' : 'text-slate-300'
                }`}
              >
                لوحة العمليات
              </button>
              <button
                onClick={() => onChangeSection('operations')}
                className={`px-2.5 py-1 rounded-lg shrink-0 ${
                  activeSection === 'operations' ? 'bg-amber-500 text-slate-950' : 'text-slate-300'
                }`}
              >
                الطلبيات
              </button>
              <button
                onClick={() => onChangeSection('manifests')}
                className={`px-2.5 py-1 rounded-lg shrink-0 ${
                  activeSection === 'manifests' ? 'bg-amber-500 text-slate-950' : 'text-slate-300'
                }`}
              >
                الكشوفات
              </button>
              <button
                onClick={() => onChangeSection('users')}
                className={`px-2.5 py-1 rounded-lg shrink-0 ${
                  activeSection === 'users' ? 'bg-amber-500 text-slate-950' : 'text-slate-300'
                }`}
              >
                المستخدمون
              </button>
            </>
          )}

          {role === 'OPERATOR' && (
            <>
              <button
                onClick={() => onChangeSection('staff_portal')}
                className={`px-2.5 py-1 rounded-lg shrink-0 ${
                  activeSection === 'staff_portal' ? 'bg-blue-600 text-white' : 'text-slate-300'
                }`}
              >
                بوابة الموظف
              </button>
              <button
                onClick={() => onChangeSection('operations')}
                className={`px-2.5 py-1 rounded-lg shrink-0 ${
                  activeSection === 'operations' ? 'bg-blue-600 text-white' : 'text-slate-300'
                }`}
              >
                الطلبيات
              </button>
              <button
                onClick={() => onChangeSection('manifests')}
                className={`px-2.5 py-1 rounded-lg shrink-0 ${
                  activeSection === 'manifests' ? 'bg-blue-600 text-white' : 'text-slate-300'
                }`}
              >
                الكشوفات
              </button>
            </>
          )}

          {role === 'MERCHANT' && (
            <>
              <button
                onClick={() => onChangeSection('merchant_portal')}
                className={`px-2.5 py-1 rounded-lg shrink-0 ${
                  activeSection === 'merchant_portal' ? 'bg-indigo-600 text-white' : 'text-slate-300'
                }`}
              >
                بوابة المتجر
              </button>
              <button
                onClick={() => onChangeSection('settlements')}
                className={`px-2.5 py-1 rounded-lg shrink-0 ${
                  activeSection === 'settlements' ? 'bg-indigo-600 text-white' : 'text-slate-300'
                }`}
              >
                التحصيلات COD
              </button>
            </>
          )}

          {role === 'DRIVER' && (
            <button
              onClick={() => onChangeSection('driver_portal')}
              className={`px-2.5 py-1 rounded-lg shrink-0 ${
                activeSection === 'driver_portal' ? 'bg-emerald-600 text-white' : 'text-slate-300'
              }`}
            >
              بوابة الكابتن
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

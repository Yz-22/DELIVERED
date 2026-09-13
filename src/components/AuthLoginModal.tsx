import React, { useState } from 'react';
import {
  X,
  UserCheck,
  Shield,
  Building2,
  Car,
  CheckCircle2,
  KeyRound,
  LogOut,
  ArrowLeft,
} from 'lucide-react';
import { User, Role } from '../types/logistics';

interface AuthLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onSelectUser: (user: User) => void;
  allUsers: User[];
  onLogout: () => void;
}

export const AuthLoginModal: React.FC<AuthLoginModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSelectUser,
  allUsers,
  onLogout,
}) => {
  const [selectedRole, setSelectedRole] = useState<Role>('ADMIN');

  if (!isOpen) return null;

  const admins = allUsers.filter((u) => u.role === 'ADMIN');
  const operators = allUsers.filter((u) => u.role === 'OPERATOR');
  const merchants = allUsers.filter((u) => u.role === 'MERCHANT');
  const drivers = allUsers.filter((u) => u.role === 'DRIVER');

  const rolePresets = [
    {
      role: 'ADMIN' as const,
      label: 'مدير العمليات (Admin)',
      icon: Shield,
      color: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      desc: 'صلاحيات كاملة على شاشات العمليات، المناديب، التسويات المالية، والتكاملات البرمجية',
      users: admins.length > 0 ? admins : [
        {
          id: 'u-admin-1',
          name: 'باسل البلبيسي',
          email: 'operations@dargo-tms.io',
          phone: '0795551234',
          role: 'ADMIN',
          city: 'عمان',
          isActive: true,
        } as User,
      ],
    },
    {
      role: 'OPERATOR' as const,
      label: 'الموظفون ومسؤولو الفرز (Staff / Operator)',
      icon: Shield,
      color: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      desc: 'بوابة موظف العمليات: استلام الطرود الواردة، ماسح الباركود، الفرز بالمستودع، وطباعة البوالص الحرارية',
      users: operators.length > 0 ? operators : [
        {
          id: 'u-op-1',
          name: 'أنس الرواشدة (مسؤول الفرز)',
          email: 'anas@dargo-tms.io',
          phone: '0791112233',
          role: 'OPERATOR',
          branch: 'فرع عمان الرئيسي',
          city: 'عمان',
          isActive: true,
        } as User,
      ],
    },
    {
      role: 'MERCHANT' as const,
      label: 'حساب التاجر (Merchant)',
      icon: Building2,
      color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
      desc: 'بوابة المتجر: تسجيل الشحنات، متابعة التحصيلات المالية، ومفاتيح الربط البرمجي Webhooks',
      users: merchants.length > 0 ? merchants : [
        {
          id: 'u-mer-1',
          name: 'متجر سحر الشرق للأزياء',
          email: 'sahar@orient-fashion.com',
          phone: '0788123456',
          role: 'MERCHANT',
          commercialName: 'سحر الشرق فاشن',
          city: 'عمان',
          isActive: true,
        } as User,
      ],
    },
    {
      role: 'DRIVER' as const,
      label: 'كابتن التوصيل (Field Captain)',
      icon: Car,
      color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      desc: 'بوابة الكابتن الميدانية: المسار الذكي، توثيق التسليم POD، ودفع CliQ الفوري',
      users: drivers.length > 0 ? drivers : [
        {
          id: 'u-drv-1',
          name: 'أحمد خليل',
          phone: '0799887766',
          role: 'DRIVER',
          city: 'عمان',
          isActive: true,
        } as User,
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">إدارة الجلسة وتسجيل الدخول والصلاحيات (RBAC)</h3>
              <p className="text-xs text-slate-400">
                التبديل بين أدوار النظام لتجربة بيئة العمل الميدانية لكل مستخدم
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Active User Status */}
        <div className="p-5 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-800 text-amber-400 font-bold flex items-center justify-center text-sm border border-slate-700">
                {currentUser ? currentUser.name.slice(0, 2) : 'زائر'}
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500">المستخدم النشط حالياً:</div>
                <div className="text-sm font-bold text-slate-900">
                  {currentUser?.name || 'غير مسجل'}
                </div>
                <div className="text-[11px] text-slate-500">
                  الدور:{' '}
                  <span className="font-bold text-amber-600">
                    {currentUser?.role === 'ADMIN'
                      ? 'مدير عمليات (كامل الصلاحيات)'
                      : currentUser?.role === 'OPERATOR'
                      ? 'موظف العمليات والفرز (Staff)'
                      : currentUser?.role === 'MERCHANT'
                      ? 'تاجر (بوابة المتاجر)'
                      : 'كابتن توصيل (بوابة الكابتن)'}
                  </span>
                </div>
              </div>
            </div>

            {currentUser && (
              <button
                type="button"
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>تسجيل الخروج</span>
              </button>
            )}
          </div>

          {/* Role Selection Tabs */}
          <div>
            <label className="text-xs font-bold text-slate-800 block mb-2">
              اختر دوراً لتسجيل الدخول السريع (Fast Role Switch):
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {rolePresets.map((preset) => {
                const Icon = preset.icon;
                const isCurrent = selectedRole === preset.role;
                return (
                  <button
                    key={preset.role}
                    type="button"
                    onClick={() => setSelectedRole(preset.role)}
                    className={`p-3 rounded-xl border text-right transition-all flex flex-col gap-1.5 ${
                      isCurrent
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-amber-400/50'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isCurrent ? 'text-amber-400' : 'text-slate-500'}`} />
                    <span className="text-xs font-bold leading-tight">{preset.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* User Cards for Selected Role */}
          <div className="space-y-2 pt-1">
            {rolePresets
              .find((p) => p.role === selectedRole)
              ?.users.map((u) => {
                const isSelected = currentUser?.id === u.id;
                return (
                  <div
                    key={u.id}
                    className={`p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-emerald-50/70 border-emerald-300 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-amber-400/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-xs font-bold text-slate-900">{u.name}</strong>
                        {u.commercialName && (
                          <span className="text-[10px] text-slate-500">({u.commercialName})</span>
                        )}
                        {isSelected && (
                          <span className="text-[10px] bg-emerald-500 text-white font-bold px-1.5 py-0.5 rounded">
                            النشط حالياً
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        هاتف: {u.phone} {u.city ? `• مدينة: ${u.city}` : ''}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onSelectUser(u);
                        onClose();
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-900 hover:bg-slate-800 text-white'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{isSelected ? 'مفعل' : 'دخول بهذا الحساب'}</span>
                    </button>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            الصلاحيات تتغير فورياً بناءً على الدور المختار
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

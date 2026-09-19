import React, { useState } from 'react';
import {
  Shield,
  Plus,
  Lock,
  Unlock,
  KeyRound,
  RotateCw,
  CreditCard,
  Sliders,
  Check,
  X,
  Copy,
  UserPlus,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Users,
} from 'lucide-react';
import {
  User,
  Role,
  SubscriptionPlanType,
  SubscriptionStatus,
  SAAS_SUBSCRIPTION_PLANS,
} from '../types/logistics';
import { getAuthHeaders } from '../lib/auth';
import { SuperAdminKpiGrid } from './superadmin/SuperAdminKpiGrid';
import { SuperAdminToolbar } from './superadmin/SuperAdminToolbar';
import { SuperAdminAccountTable } from './superadmin/SuperAdminAccountTable';
import { AccountDetailDrawer } from './superadmin/AccountDetailDrawer';
import { AttentionRequiredSection } from './superadmin/AttentionRequiredSection';
import { RecentActivitySection } from './superadmin/RecentActivitySection';

interface SuperAdminMasterHubProps {
  users: User[];
  currentUser: User;
  onRefresh: () => Promise<void>;
  onSelectUserForLogin: (user: User) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const SuperAdminMasterHub: React.FC<SuperAdminMasterHubProps> = ({
  users,
  currentUser,
  onRefresh,
  onSelectUserForLogin,
  showToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPlan, setFilterPlan] = useState<string>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedUserForDrawer, setSelectedUserForDrawer] = useState<User | null>(null);
  const [selectedUserForRenewal, setSelectedUserForRenewal] = useState<User | null>(null);
  const [selectedUserForModules, setSelectedUserForModules] = useState<User | null>(null);
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<User | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  // Renewal Form State
  const [renewalPlan, setRenewalPlan] = useState<SubscriptionPlanType>('PROFESSIONAL');
  const [renewalDays, setRenewalDays] = useState<number>(30);
  const [renewalPrice, setRenewalPrice] = useState<number>(85);
  const [renewalCycle, setRenewalCycle] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Account Form State
  const [newAccName, setNewAccName] = useState('');
  const [newAccCompanyName, setNewAccCompanyName] = useState('');
  const [newAccEmail, setNewAccEmail] = useState('');
  const [newAccPhone, setNewAccPhone] = useState('');
  const [newAccPassword, setNewAccPassword] = useState('123456');
  const [newAccRole, setNewAccRole] = useState<Role>('ADMIN');
  const [newAccPlan, setNewAccPlan] = useState<SubscriptionPlanType>('PROFESSIONAL');
  const [newAccCity, setNewAccCity] = useState('عمان');

  // Password reset state
  const [newPasswordVal, setNewPasswordVal] = useState('');

  // Super Admin Invitation State
  const [isInviteSuperAdminModalOpen, setIsInviteSuperAdminModalOpen] = useState(false);
  const [inviteSuperAdminName, setInviteSuperAdminName] = useState('');
  const [inviteSuperAdminEmail, setInviteSuperAdminEmail] = useState('');
  const [inviteSuperAdminPhone, setInviteSuperAdminPhone] = useState('');
  const [inviteSuperAdminExpiresInDays, setInviteSuperAdminExpiresInDays] = useState<number>(7);
  const [generatedSuperAdminInviteUrl, setGeneratedSuperAdminInviteUrl] = useState<string>('');
  const [isInvitingSuperAdmin, setIsInvitingSuperAdmin] = useState(false);
  const [isCopiedInvite, setIsCopiedInvite] = useState(false);

  // Filtering
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.phone.includes(searchQuery) ||
      (u.companyName && u.companyName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.storeName && u.storeName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRole = filterRole === 'ALL' || u.role === filterRole;
    const matchesStatus =
      filterStatus === 'ALL' ||
      (filterStatus === 'ACTIVE' && u.isActive && u.subscriptionStatus !== 'SUSPENDED') ||
      (filterStatus === 'SUSPENDED' && (!u.isActive || u.subscriptionStatus === 'SUSPENDED'));
    const matchesPlan = filterPlan === 'ALL' || u.subscriptionPlan === filterPlan;

    return matchesSearch && matchesRole && matchesStatus && matchesPlan;
  });

  // Calculate SaaS KPIs
  const totalTenants = users.filter((u) => u.role === 'ADMIN' || u.role === 'MERCHANT').length;
  const activeSubs = users.filter((u) => u.isActive && u.subscriptionStatus !== 'SUSPENDED').length;
  const suspendedSubs = users.filter((u) => !u.isActive || u.subscriptionStatus === 'SUSPENDED').length;
  const totalMRR = users.reduce((sum, u) => {
    const isActiveSub = (u.isActive ?? true) && u.subscriptionStatus !== 'SUSPENDED';
    if (isActiveSub && u.subscriptionPrice) {
      const isAnnual = u.subscriptionBillingCycle === 'ANNUAL' || u.subscriptionBillingCycle === 'YEARLY';
      return sum + (isAnnual ? u.subscriptionPrice / 12 : u.subscriptionPrice);
    }
    return sum;
  }, 0);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
      showToast('تم تحديث بيانات الحسابات بنجاح', 'success');
    } catch {
      showToast('فشل تحديث البيانات', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Toggle Password Visibility
  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  // Suspend / Activate Account
  const handleToggleStatus = async (user: User) => {
    const isCurrentlyActive = user.isActive && user.subscriptionStatus !== 'SUSPENDED';
    const newStatus: SubscriptionStatus = isCurrentlyActive ? 'SUSPENDED' : 'ACTIVE';
    const reason = isCurrentlyActive
      ? prompt('يرجى كتابة سبب تعليق وإيقاف الحساب:', 'عدم تجديد الاشتراك أو مخالفة شروط الاستخدام')
      : undefined;

    if (isCurrentlyActive && reason === null) return;

    try {
      const res = await fetch('/api/superadmin/subscriptions/toggle-status', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          userId: user.id,
          status: newStatus,
          reason,
        }),
      });

      if (res.ok) {
        showToast(
          newStatus === 'ACTIVE'
            ? `تم فك التجميد وتفعيل حساب (${user.name}) بنجاح`
            : `تم تجميد وتعطيل حساب (${user.name}) بنجاح`,
          'success'
        );
        onRefresh();
      } else {
        const data = await res.json();
        showToast(data.error || 'فشل تعديل حالة الحساب', 'error');
      }
    } catch {
      showToast('حدث خطأ في الاتصال بالخادم', 'error');
    }
  };

  // Renew Subscription Action
  const handleRenewSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForRenewal) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/superadmin/subscriptions/renew', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          userId: selectedUserForRenewal.id,
          planId: renewalPlan,
          daysToAdd: renewalDays,
          price: renewalPrice,
          billingCycle: renewalCycle,
        }),
      });

      if (res.ok) {
        showToast(`تم تجديد وتفعيل اشتراك (${selectedUserForRenewal.name}) بنجاح`, 'success');
        setSelectedUserForRenewal(null);
        onRefresh();
      } else {
        const data = await res.json();
        showToast(data.error || 'فشل تجديد الاشتراك', 'error');
      }
    } catch {
      showToast('حدث خطأ أثناء تجديد الاشتراك', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Module
  const handleToggleModule = async (user: User, moduleKey: string, currentVal: boolean) => {
    try {
      const res = await fetch('/api/superadmin/subscriptions/toggle-module', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          userId: user.id,
          moduleKey,
          enabled: !currentVal,
        }),
      });

      if (res.ok) {
        showToast(`تم تحديث صلاحية النظام الفرعي بنجاح`, 'success');
        onRefresh();
      }
    } catch {
      showToast('فشل تعديل الصلاحية', 'error');
    }
  };

  // Reset Password Action
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForPassword || !newPasswordVal.trim()) return;

    try {
      const res = await fetch(`/api/users/${selectedUserForPassword.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ password: newPasswordVal.trim() }),
      });

      if (res.ok) {
        showToast(`تم تغيير كلمة المرور للمستخدم (${selectedUserForPassword.name}) بنجاح`, 'success');
        setSelectedUserForPassword(null);
        setNewPasswordVal('');
        onRefresh();
      }
    } catch {
      showToast('فشل تغيير كلمة المرور', 'error');
    }
  };

  // Create New Tenant Account
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName || !newAccPhone) {
      showToast('يرجى ملء الاسم ورقم الهاتف على الأقل', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedPlanData = SAAS_SUBSCRIPTION_PLANS.find((p) => p.id === newAccPlan);
      const cleanEmail = newAccEmail.trim() || `${newAccPhone.replace(/\D/g, '')}@delivere-tms.io`;

      const res = await fetch('/api/users', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: newAccName.trim(),
          email: cleanEmail,
          phone: newAccPhone.trim(),
          password: newAccPassword.trim() || '123456',
          role: newAccRole,
          companyName: newAccCompanyName.trim() || newAccName.trim(),
          city: newAccCity,
          subscriptionPlan: newAccPlan,
          subscriptionPlanName: selectedPlanData?.nameAr || 'الباقة الذهبية للمحترفين',
          subscriptionStatus: 'ACTIVE',
          subscriptionStartDate: new Date().toISOString(),
          subscriptionEndDate: new Date(Date.now() + 30 * 86400000).toISOString(),
          subscriptionPrice: selectedPlanData?.monthlyPriceJod || 85,
          subscriptionBillingCycle: 'MONTHLY',
          maxMonthlyOrders: selectedPlanData?.maxMonthlyOrders || 10000,
          maxUsers: selectedPlanData?.maxUsers || 15,
          enabledModules: selectedPlanData?.includedModules || {
            tmsDelivery: true,
            posCashier: true,
            merchantWms: true,
            accountingSettlements: true,
            apiIntegrations: true,
            aiRouteOptimizer: true,
          },
          isActive: true,
        }),
      });

      if (res.ok) {
        showToast(`تم إنشاء حساب المشترك (${newAccName}) وتفعيل الاشتراك بنجاح`, 'success');
        setIsCreateModalOpen(false);
        setNewAccName('');
        setNewAccCompanyName('');
        setNewAccEmail('');
        setNewAccPhone('');
        onRefresh();
      } else {
        let errorMsg = 'فشل إنشاء الحساب في الخادم';
        try {
          const data = await res.json();
          errorMsg = data.error || data.message || errorMsg;
        } catch {
          const rawText = await res.text().catch(() => '');
          errorMsg = rawText ? `خطأ (${res.status}): ${rawText.slice(0, 120)}` : `فشل استجابة الخادم (كود: ${res.status})`;
        }
        showToast(errorMsg, 'error');
      }
    } catch (e: any) {
      console.error('Account creation error:', e);
      showToast(e?.message ? `خطأ أثناء الاتصال: ${e.message}` : 'حدث خطأ غير متوقع أثناء إنشاء الحساب', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Super Admin Invitation Handler
  const handleCreateSuperAdminInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteSuperAdminEmail || !inviteSuperAdminEmail.trim()) {
      showToast('يرجى إدخال البريد الإلكتروني للمدير العام المطلوب دعوته', 'error');
      return;
    }

    try {
      setIsInvitingSuperAdmin(true);
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          email: inviteSuperAdminEmail.trim().toLowerCase(),
          name: inviteSuperAdminName.trim() || undefined,
          phone: inviteSuperAdminPhone.trim() || undefined,
          role: 'SUPER_ADMIN',
          roleName: 'المدير العام للنظام (Super Admin)',
          expiresInDays: inviteSuperAdminExpiresInDays || 7,
          permissions: ['*'],
          maxAllowedPermissions: ['*'],
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setGeneratedSuperAdminInviteUrl(data.inviteUrl);
        showToast('تم توليد رابط دعوة السوبر أدمن المشفر بنجاح', 'success');
      } else {
        showToast(data.error || 'فشل توليد رابط الدعوة للسوبر أدمن', 'error');
      }
    } catch (err: any) {
      console.error('Super Admin invite error:', err);
      showToast('خطأ في الاتصال بالخادم أثناء توليد رابط الدعوة: ' + err.message, 'error');
    } finally {
      setIsInvitingSuperAdmin(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopiedInvite(true);
      showToast('تم نسخ الرابط إلى الحافظة بنجاح', 'success');
      setTimeout(() => setIsCopiedInvite(false), 2500);
    } catch {
      showToast('تعذر النسخ التلقائي، يرجى تحديد الرابط ونسخه يدوياً', 'error');
    }
  };

  return (
    <div className="space-y-5" dir="rtl">
      {/* 1. Page Header (Restrained Enterprise TMS Layout) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center font-black">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                مركز إدارة المنصة
              </h1>
              <p className="text-xs text-slate-400">
                إدارة الشركات والحسابات والاشتراكات والتراخيص
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setGeneratedSuperAdminInviteUrl('');
              setInviteSuperAdminEmail('');
              setInviteSuperAdminName('');
              setInviteSuperAdminPhone('');
              setIsInviteSuperAdminModalOpen(true);
            }}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-xs active:scale-98"
          >
            <UserPlus className="w-4 h-4" />
            <span>دعوة سوبر أدمن</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-98"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>إنشاء حساب</span>
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl transition-all border border-slate-800 cursor-pointer disabled:opacity-50"
            title="تحديث البيانات"
            aria-label="تحديث البيانات"
          >
            <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Compact Enterprise KPI Grid */}
      <SuperAdminKpiGrid
        totalAccounts={users.length}
        totalTenants={totalTenants}
        activeSubs={activeSubs}
        suspendedSubs={suspendedSubs}
        totalMRR={totalMRR}
      />

      {/* 3. Attention Required & Recent Activity Overview Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AttentionRequiredSection
          users={users}
          onOpenRenewal={(user) => {
            setSelectedUserForRenewal(user);
            setRenewalPlan(user.subscriptionPlan || 'PROFESSIONAL');
            setRenewalPrice(user.subscriptionPrice || 85);
          }}
          onToggleStatus={handleToggleStatus}
          onSelectForLogin={onSelectUserForLogin}
        />
        <RecentActivitySection />
      </div>

      {/* 4. Compact Search & Filter Toolbar */}
      <SuperAdminToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filterRole={filterRole}
        onRoleChange={setFilterRole}
        filterPlan={filterPlan}
        onPlanChange={setFilterPlan}
        filterStatus={filterStatus}
        onStatusChange={setFilterStatus}
        totalResults={filteredUsers.length}
        onResetFilters={() => {
          setSearchQuery('');
          setFilterRole('ALL');
          setFilterPlan('ALL');
          setFilterStatus('ALL');
        }}
      />

      {/* 5. Enterprise Accounts & Subscriptions DataTable */}
      <SuperAdminAccountTable
        users={filteredUsers}
        visiblePasswords={visiblePasswords}
        onTogglePasswordVisibility={togglePasswordVisibility}
        onOpenDetailDrawer={(user) => setSelectedUserForDrawer(user)}
        onOpenRenewModal={(user) => {
          setSelectedUserForRenewal(user);
          setRenewalPlan(user.subscriptionPlan || 'PROFESSIONAL');
          setRenewalPrice(user.subscriptionPrice || 85);
        }}
        onOpenModulesModal={(user) => setSelectedUserForModules(user)}
        onOpenPasswordModal={(user) => setSelectedUserForPassword(user)}
        onToggleStatus={handleToggleStatus}
        onSelectUserForLogin={onSelectUserForLogin}
        showToast={showToast}
      />

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: Create New Tenant Account */}
      {/* ------------------------------------------------------------- */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 animate-in fade-in" dir="rtl">
          <div className="bg-[#0B132B] text-slate-200 rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-bold">
                  <Plus className="w-4 h-4 stroke-[3]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">إنشاء حساب مشترك جديد وتفعيل الاشتراك</h3>
                  <p className="text-xs text-slate-400">توليد حساب شركة أو تاجر أو مدير مع باقة وصلاحيات مخصصة</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 cursor-pointer"
                aria-label="إغلاق النافذة"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">اسم المسؤول / صاحب الحساب *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: أحمد عبد الله"
                    value={newAccName}
                    onChange={(e) => setNewAccName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 focus:border-amber-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">اسم الشركة / المتجر التجاري</label>
                  <input
                    type="text"
                    placeholder="مثال: شركة البرق اللوجستية"
                    value={newAccCompanyName}
                    onChange={(e) => setNewAccCompanyName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 focus:border-amber-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">رقم الهاتف (لتسجيل الدخول) *</label>
                  <input
                    type="text"
                    required
                    dir="ltr"
                    placeholder="0791234567"
                    value={newAccPhone}
                    onChange={(e) => setNewAccPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-slate-200 focus:border-amber-500 focus:outline-hidden text-right"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">البريد الإلكتروني (اختياري)</label>
                  <input
                    type="email"
                    dir="ltr"
                    placeholder="name@company.com"
                    value={newAccEmail}
                    onChange={(e) => setNewAccEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-slate-200 focus:border-amber-500 focus:outline-hidden text-right"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">كلمة المرور الابتدائية</label>
                  <input
                    type="text"
                    required
                    dir="ltr"
                    value={newAccPassword}
                    onChange={(e) => setNewAccPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-slate-200 focus:border-amber-500 focus:outline-hidden text-right"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">الدور الوظيفي في المنظومة</label>
                  <select
                    value={newAccRole}
                    onChange={(e) => setNewAccRole(e.target.value as Role)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 focus:border-amber-500 focus:outline-hidden cursor-pointer"
                  >
                    <option value="ADMIN">مدير عمليات وشركة كاملة (Admin)</option>
                    <option value="MERCHANT">حساب تاجر ومتجر (Merchant)</option>
                    <option value="OPERATOR">موظف فرز وعمليات (Operator)</option>
                    <option value="ACCOUNTANT">محاسب مالي (Accountant)</option>
                    <option value="CASHIER">كاشير ونقاط بيع (Cashier)</option>
                    <option value="DRIVER">كابتن توصيل (Driver)</option>
                  </select>
                </div>
              </div>

              {/* Plan Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">تحديد باقة الاشتراك والتراخيص *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {SAAS_SUBSCRIPTION_PLANS.map((plan) => (
                    <div
                      key={plan.id}
                      onClick={() => setNewAccPlan(plan.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        newAccPlan === plan.id
                          ? 'border-amber-500 bg-amber-500/10'
                          : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-white">{plan.nameAr}</span>
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/30">
                          {plan.monthlyPriceJod > 0 ? `${plan.monthlyPriceJod} د.أ/شهر` : 'مجاناً'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed">{plan.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-slate-700 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'جاري الإنشاء...' : 'تأكيد إنشاء الحساب والاشتراك'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: Subscription Renewal */}
      {/* ------------------------------------------------------------- */}
      {selectedUserForRenewal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 animate-in fade-in" dir="rtl">
          <div className="bg-[#0B132B] text-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-bold">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">تجديد أو تعديل باقة الاشتراك</h3>
                  <p className="text-xs text-slate-400">{selectedUserForRenewal.name} ({selectedUserForRenewal.companyName || selectedUserForRenewal.email})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUserForRenewal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 cursor-pointer"
                aria-label="إغلاق النافذة"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRenewSubscription} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اختر باقة الاشتراك</label>
                <select
                  value={renewalPlan}
                  onChange={(e) => {
                    const p = e.target.value as SubscriptionPlanType;
                    setRenewalPlan(p);
                    const planData = SAAS_SUBSCRIPTION_PLANS.find((x) => x.id === p);
                    if (planData) setRenewalPrice(planData.monthlyPriceJod);
                  }}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 focus:border-amber-500 focus:outline-hidden cursor-pointer"
                >
                  <option value="ENTERPRISE">الباقة الماسية والمؤسسية (Enterprise) - 150 د.أ/شهر</option>
                  <option value="PROFESSIONAL">الباقة الذهبية للمحترفين (Gold Pro) - 85 د.أ/شهر</option>
                  <option value="GROWTH">الباقة الفضية للنمو (Silver) - 40 د.أ/شهر</option>
                  <option value="TRIAL">الاشتراك التجريبي (Trial 14 days) - مجاني</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">مدة التمديد الإضافية</label>
                  <select
                    value={renewalDays}
                    onChange={(e) => setRenewalDays(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 focus:border-amber-500 focus:outline-hidden cursor-pointer"
                  >
                    <option value={30}>+ 30 يوم (شهر إضافي)</option>
                    <option value={90}>+ 90 يوم (3 أشهر)</option>
                    <option value={180}>+ 180 يوم (6 أشهر)</option>
                    <option value={365}>+ 365 يوم (سنة كاملة)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">قيمة الاشتراك المتفق عليها (د.أ)</label>
                  <input
                    type="number"
                    dir="ltr"
                    value={renewalPrice}
                    onChange={(e) => setRenewalPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-200 focus:border-amber-500 focus:outline-hidden text-right"
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  سيتم تمديد تاريخ انتهاء الصلاحية تلقائياً، وتحديث حالة الحساب إلى <strong>نشط ومفعل</strong> مع إتاحة كافة مميزات الباقة المختارة فورياً.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedUserForRenewal(null)}
                  className="px-4 py-2 border border-slate-700 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'جاري الحفظ...' : 'تأكيد التجديد وتحديث الباقة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: Granular Modules Matrix */}
      {/* ------------------------------------------------------------- */}
      {selectedUserForModules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 animate-in fade-in" dir="rtl">
          <div className="bg-[#0B132B] text-slate-200 rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 flex items-center justify-center font-bold">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">إدارة الموديلات والأنظمة المفعلة</h3>
                  <p className="text-xs text-slate-400">{selectedUserForModules.name} ({selectedUserForModules.roleName || selectedUserForModules.role})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUserForModules(null)}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 cursor-pointer"
                aria-label="إغلاق النافذة"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mt-4">
              <p className="text-xs text-slate-400 font-medium">
                بصفتك السوبر أدمن، يمكنك تفعيل أو تعطيل أي جزء من المنظومة لهذا الحساب بشكل مباشر:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  { key: 'tmsDelivery', title: 'إدارة الشحنات والتوصيل (TMS)', desc: 'إنشاء البوالص، توزيع السائقين، والتتبع' },
                  { key: 'posCashier', title: 'نظام الكاشير والمبيعات (POS)', desc: 'شاشة نقاط البيع والباركود السريع' },
                  { key: 'merchantWms', title: 'مخزن التاجر وإدارة المخزون (WMS)', desc: 'إدارة المنتجات، الفواتير، والكميات' },
                  { key: 'accountingSettlements', title: 'المحاسبة والتسويات المالية (ERP)', desc: 'كشوفات COD، قيود اليومية، والسندات' },
                  { key: 'apiIntegrations', title: 'الربط البرمجي للمتاجر (API)', desc: 'مفاتيح الربط مع Shopify, Salla, WooCommerce' },
                  { key: 'aiRouteOptimizer', title: 'تحسين المسارات الذكي (AI Routing)', desc: 'ترتيب نقاط التوصيل الجغرافية ومسارات الخرائط' },
                ].map((mod) => {
                  const isEnabled = selectedUserForModules.enabledModules?.[mod.key] ?? true;
                  return (
                    <div
                      key={mod.key}
                      onClick={() => handleToggleModule(selectedUserForModules, mod.key, isEnabled)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-2 ${
                        isEnabled
                          ? 'border-emerald-500/50 bg-emerald-500/10 text-white'
                          : 'border-slate-800 bg-slate-950 text-slate-500'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-xs">{mod.title}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{mod.desc}</div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                          isEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {isEnabled ? <Check className="w-3 h-3 stroke-[3]" /> : <X className="w-3 h-3" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end pt-4 border-t border-slate-800 mt-4">
              <button
                type="button"
                onClick={() => setSelectedUserForModules(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                إغلاق وحفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 4: Reset Password */}
      {/* ------------------------------------------------------------- */}
      {selectedUserForPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 animate-in fade-in" dir="rtl">
          <div className="bg-[#0B132B] text-slate-200 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">تغيير كلمة المرور</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUserForPassword(null)}
                className="p-1 text-slate-400 hover:text-slate-200"
                aria-label="إغلاق النافذة"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-3 mt-4">
              <p className="text-xs text-slate-400">
                أدخل كلمة المرور الجديدة للمستخدم <strong className="text-white">{selectedUserForPassword.name}</strong>:
              </p>
              <input
                type="text"
                required
                dir="ltr"
                placeholder="كلمة المرور الجديدة..."
                value={newPasswordVal}
                onChange={(e) => setNewPasswordVal(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-200 focus:border-amber-500 focus:outline-hidden text-right"
              />

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedUserForPassword(null)}
                  className="px-3 py-1.5 border border-slate-700 text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-800"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 text-slate-950 font-bold rounded-lg text-xs hover:bg-amber-400"
                >
                  حفظ التغيير
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 5: Super Admin Invitation */}
      {/* ------------------------------------------------------------- */}
      {isInviteSuperAdminModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 animate-in fade-in" dir="rtl">
          <div className="bg-[#0B132B] text-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 flex items-center justify-center font-bold">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">دعوة مدير عام للمنظومة (Super Admin)</h3>
                  <p className="text-xs text-slate-400">توليد رابط دعوة آمن ومشفّر بصلاحيات المالك الكاملة</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteSuperAdminModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 cursor-pointer"
                aria-label="إغلاق النافذة"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!generatedSuperAdminInviteUrl ? (
              <form onSubmit={handleCreateSuperAdminInvite} className="space-y-4 mt-4">
                <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">تنبيه أمني وإداري صارم:</p>
                    <p className="text-[11px] leading-relaxed text-amber-400/90">
                      هذه الدعوة تمنح حاملها صلاحيات السوبر أدمن الكاملة (Full Root Access) على المنظومة والبيانات، والربط التلقائي بتينانت المنصة الجذري. سيقوم المدعو بتعيين كلمة مروره الخاصة بنفسه عند فتح الرابط.
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 block">البريد الإلكتروني للمدعو: *</label>
                  <input
                    type="email"
                    required
                    dir="ltr"
                    placeholder="admin2@domain.com"
                    value={inviteSuperAdminEmail}
                    onChange={(e) => setInviteSuperAdminEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-slate-200 focus:border-indigo-500 focus:outline-hidden text-right"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300 block">الاسم الكريم (اختياري):</label>
                    <input
                      type="text"
                      placeholder="اسم المدير..."
                      value={inviteSuperAdminName}
                      onChange={(e) => setInviteSuperAdminName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 focus:border-indigo-500 focus:outline-hidden"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300 block">رقم الهاتف (اختياري):</label>
                    <input
                      type="tel"
                      dir="ltr"
                      placeholder="0790000000"
                      value={inviteSuperAdminPhone}
                      onChange={(e) => setInviteSuperAdminPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-slate-200 focus:border-indigo-500 focus:outline-hidden text-right"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 block">مدة صلاحية رابط الدعوة:</label>
                  <select
                    value={inviteSuperAdminExpiresInDays}
                    onChange={(e) => setInviteSuperAdminExpiresInDays(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 focus:border-indigo-500 focus:outline-hidden cursor-pointer"
                  >
                    <option value={1}>يوم واحد (24 ساعة - أمان عالي)</option>
                    <option value={3}>3 أيام</option>
                    <option value={7}>7 أيام (موصى به)</option>
                    <option value={14}>14 يوماً</option>
                    <option value={30}>30 يوماً</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsInviteSuperAdminModalOpen(false)}
                    className="px-4 py-2 border border-slate-700 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isInvitingSuperAdmin}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    {isInvitingSuperAdmin ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" />
                        <span>جاري التوليد والتشفير...</span>
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4" />
                        <span>توليد رابط الدعوة الآن</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 mt-4 animate-in fade-in">
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start gap-2.5 text-emerald-300">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-white">تم توليد رابط دعوة السوبر أدمن بنجاح</h4>
                    <p className="text-[11px] text-emerald-300/90 mt-0.5">
                      تم تشفير الرمز وتخزين الـ Hash في قاعدة البيانات، وربط الرتبة الجذرية SUPER_ADMIN والصلاحيات الشاملة.
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block">رابط الدعوة المباشر والمشفر:</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      dir="ltr"
                      value={generatedSuperAdminInviteUrl}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-200 select-all"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(generatedSuperAdminInviteUrl)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                        isCopiedInvite
                          ? 'bg-emerald-600 text-white'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      }`}
                    >
                      {isCopiedInvite ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{isCopiedInvite ? 'تم النسخ' : 'نسخ الرابط'}</span>
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
                  <div className="flex justify-between">
                    <span className="font-bold text-slate-300">البريد الإلكتروني:</span>
                    <span className="font-mono text-slate-200" dir="ltr">{inviteSuperAdminEmail}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold text-slate-300">الرتبة الممنوحة:</span>
                    <span className="font-bold text-indigo-400">SUPER_ADMIN (المدير العام للنظام)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold text-slate-300">الصلاحيات:</span>
                    <span className="font-mono text-emerald-400 font-bold">[*] Full Root Scope</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setGeneratedSuperAdminInviteUrl('');
                      setInviteSuperAdminEmail('');
                      setInviteSuperAdminName('');
                      setInviteSuperAdminPhone('');
                    }}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer"
                  >
                    + إنشاء دعوة أخرى
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsInviteSuperAdminModalOpen(false);
                      onRefresh();
                    }}
                    className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs cursor-pointer"
                  >
                    تم وإغلاق
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Account Detail Drawer */}
      <AccountDetailDrawer
        user={selectedUserForDrawer}
        isOpen={Boolean(selectedUserForDrawer)}
        onClose={() => setSelectedUserForDrawer(null)}
        onSelectForLogin={onSelectUserForLogin}
        onOpenRenewal={(user) => {
          setSelectedUserForRenewal(user);
          setRenewalPlan(user.subscriptionPlan || 'PROFESSIONAL');
          setRenewalPrice(user.subscriptionPrice || 85);
        }}
        onOpenModules={(user) => setSelectedUserForModules(user)}
        onOpenPasswordReset={(user) => {
          setSelectedUserForPassword(user);
          setNewPasswordVal('');
        }}
        onToggleStatus={handleToggleStatus}
      />
    </div>
  );
};

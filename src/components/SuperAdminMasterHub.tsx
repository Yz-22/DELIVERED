import React, { useState } from 'react';
import {
  Shield,
  Users,
  CreditCard,
  Sparkles,
  Search,
  Filter,
  Plus,
  Lock,
  Unlock,
  KeyRound,
  Calendar,
  Layers,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  EyeOff,
  UserCheck,
  Store,
  Truck,
  Building2,
  Clock,
  RotateCw,
  ExternalLink,
  ChevronDown,
  DollarSign,
  Briefcase,
  Sliders,
  Check,
  X,
  LogIn,
  Package,
  ShoppingCart,
  BadgePercent,
  Terminal,
  FileText,
} from 'lucide-react';
import {
  User,
  Role,
  SubscriptionPlanType,
  SubscriptionStatus,
  SAAS_SUBSCRIPTION_PLANS,
} from '../types/logistics';
import { getAuthHeaders } from '../lib/auth';

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

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
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
    if (u.subscriptionStatus === 'ACTIVE' && u.subscriptionPrice) {
      return sum + (u.subscriptionBillingCycle === 'ANNUAL' ? u.subscriptionPrice / 12 : u.subscriptionPrice);
    }
    return sum;
  }, 0);

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

    if (isCurrentlyActive && reason === null) return; // user cancelled prompt

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
    } catch (e) {
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
    } catch (e) {
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
    } catch (e) {
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
    } catch (e) {
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
      const cleanEmail = newAccEmail.trim() || `${newAccPhone.replace(/\D/g, '')}@dargo-tms.io`;

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

  return (
    <div className="space-y-6 animate-in fade-in duration-300" dir="rtl">
      {/* 1. Header Banner & Master Title */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 border border-slate-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 -mt-10 -ml-10 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 -mb-10 -mr-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/20">
                <Shield className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                    مركز تحكم السوبر أدمن وإدارة الاشتراكات والتراخيص (SaaS Master)
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black border border-amber-500/30">
                    صلاحيات المالك الكاملة
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  إدارة شاملة لجميع الحسابات، تفعيل الاشتراكات، قفل وفتح الصلاحيات، وإدارة الموديلات والتراخيص للشركات والتجار
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/25 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>إنشاء حساب مشترك جديد</span>
            </button>

            <button
              onClick={() => onRefresh()}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all border border-slate-700 cursor-pointer"
              title="تحديث البيانات"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. SaaS KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-950/50 p-3.5 rounded-2xl border border-slate-800/80 backdrop-blur-xs">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-bold">إجمالي المشتركين</span>
              <Building2 className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-white">{totalTenants}</span>
              <span className="text-[11px] text-slate-400">شركة / متجر</span>
            </div>
          </div>

          <div className="bg-slate-950/50 p-3.5 rounded-2xl border border-slate-800/80 backdrop-blur-xs">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-bold">الاشتراكات الفعالة</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-emerald-400">{activeSubs}</span>
              <span className="text-[11px] text-emerald-500/80">حساب نشط</span>
            </div>
          </div>

          <div className="bg-slate-950/50 p-3.5 rounded-2xl border border-slate-800/80 backdrop-blur-xs">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-bold">الحسابات المعلقة</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-amber-400">{suspendedSubs}</span>
              <span className="text-[11px] text-amber-500/80">معلق / متوقف</span>
            </div>
          </div>

          <div className="bg-slate-950/50 p-3.5 rounded-2xl border border-slate-800/80 backdrop-blur-xs">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-bold">الإيراد الشهري المقدر (MRR)</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-emerald-400">{totalMRR.toLocaleString()}</span>
              <span className="text-[11px] text-slate-400">د.أ / شهرياً</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="بحث بالاسم، الشركة، الهاتف، البريد..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer focus:outline-hidden"
          >
            <option value="ALL">جميع الأدوار</option>
            <option value="ADMIN">مدراء العمليات والشركات (Admin)</option>
            <option value="MERCHANT">التجار والمتاجر (Merchant)</option>
            <option value="DRIVER">كباتن التوصيل (Driver)</option>
            <option value="OPERATOR">موظفو الفرز والعمليات</option>
            <option value="ACCOUNTANT">محاسبون ماليون</option>
            <option value="CASHIER">كاشير ونقاط البيع</option>
          </select>

          <select
            value={filterPlan}
            onChange={(e) => setFilterPlan(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer focus:outline-hidden"
          >
            <option value="ALL">جميع باقات الاشتراك</option>
            <option value="ENTERPRISE">الباقة الماسية (Enterprise)</option>
            <option value="PROFESSIONAL">الباقة الذهبية (Gold Pro)</option>
            <option value="GROWTH">الباقة الفضية (Silver)</option>
            <option value="TRIAL">الاشتراك التجريبي (Trial)</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer focus:outline-hidden"
          >
            <option value="ALL">جميع الحالات</option>
            <option value="ACTIVE">نشط ومفعل</option>
            <option value="SUSPENDED">معلق / متوقف</option>
          </select>
        </div>
      </div>

      {/* 4. Master Accounts & Subscriptions Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-600" />
            <h3 className="font-bold text-sm text-slate-900">
              قائمة الحسابات والتراخيص ({filteredUsers.length})
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            انقر على أي حساب لتعديل باقته، تمديد الاشتراك، أو قفل/فتح الصلاحيات فورياً
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
              <tr>
                <th className="p-3.5">المشترك / الشركة</th>
                <th className="p-3.5">الدور الوظيفي</th>
                <th className="p-3.5">بيانات الدخول وكلمة المرور</th>
                <th className="p-3.5">باقة الاشتراك</th>
                <th className="p-3.5">تاريخ الانتهاء</th>
                <th className="p-3.5">الموديلات والأنظمة</th>
                <th className="p-3.5">حالة الحساب</th>
                <th className="p-3.5 text-center">إجراءات السوبر أدمن</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredUsers.map((u) => {
                const isSuper = u.role === 'SUPER_ADMIN';
                const isSuspended = !u.isActive || u.subscriptionStatus === 'SUSPENDED';
                const planInfo = SAAS_SUBSCRIPTION_PLANS.find((p) => p.id === u.subscriptionPlan) || SAAS_SUBSCRIPTION_PLANS[1];
                const endDateStr = u.subscriptionEndDate ? u.subscriptionEndDate.split('T')[0] : '2027-12-31';

                return (
                  <tr
                    key={u.id}
                    className={`hover:bg-amber-50/30 transition-colors ${
                      isSuspended ? 'bg-rose-50/20 text-slate-400' : ''
                    }`}
                  >
                    {/* 1. Name & Company */}
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs ${
                            isSuper
                              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                              : u.role === 'ADMIN'
                              ? 'bg-indigo-600 text-white'
                              : u.role === 'MERCHANT'
                              ? 'bg-emerald-600 text-white'
                              : u.role === 'DRIVER'
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-700 text-white'
                          }`}
                        >
                          {u.name.slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{u.name}</span>
                            {isSuper && (
                              <span className="px-1.5 py-0.2 bg-amber-100 text-amber-900 text-[10px] font-black rounded-md">
                                المالك
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {u.companyName || u.commercialName || u.storeName || u.branch || 'شركة عامة'} • {u.city || 'عمان'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 2. Role */}
                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                          u.role === 'SUPER_ADMIN'
                            ? 'bg-amber-100 text-amber-900 border border-amber-200'
                            : u.role === 'ADMIN'
                            ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                            : u.role === 'MERCHANT'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : u.role === 'DRIVER'
                            ? 'bg-blue-50 text-blue-800 border border-blue-200'
                            : 'bg-slate-100 text-slate-800 border border-slate-200'
                        }`}
                      >
                        {u.roleName || u.role}
                      </span>
                    </td>

                    {/* 3. Credentials & Password */}
                    <td className="p-3.5">
                      <div className="space-y-1">
                        <div className="font-mono text-[11px] text-slate-800 font-semibold">{u.email}</div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-mono text-slate-500">
                            {visiblePasswords[u.id] ? u.password || '123456' : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(u.id)}
                            className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                            title="إظهار / إخفاء كلمة المرور"
                          >
                            {visiblePasswords[u.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedUserForPassword(u)}
                            className="text-amber-600 hover:text-amber-800 text-[10px] font-bold underline cursor-pointer mr-1"
                          >
                            تغيير
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* 4. Subscription Plan */}
                    <td className="p-3.5">
                      <div className="space-y-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            u.subscriptionPlan === 'ENTERPRISE'
                              ? 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                              : u.subscriptionPlan === 'GROWTH'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                              : u.subscriptionPlan === 'TRIAL'
                              ? 'bg-slate-100 text-slate-700 border border-slate-300'
                              : 'bg-amber-100 text-amber-900 border border-amber-200'
                          }`}
                        >
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          <span>{u.subscriptionPlanName || planInfo.nameAr}</span>
                        </span>
                        <div className="text-[10px] text-slate-500">
                          {u.subscriptionPrice ? `${u.subscriptionPrice} د.أ / ${u.subscriptionBillingCycle === 'ANNUAL' ? 'سنوي' : 'شهري'}` : 'مجاني'}
                        </div>
                      </div>
                    </td>

                    {/* 5. End Date */}
                    <td className="p-3.5 font-mono text-[11px]">
                      <div className="flex items-center gap-1 text-slate-700">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{endDateStr}</span>
                      </div>
                      <span className="text-[10px] text-emerald-600 font-bold">اشتراك ساري</span>
                    </td>

                    {/* 6. Modules Active */}
                    <td className="p-3.5">
                      <button
                        type="button"
                        onClick={() => setSelectedUserForModules(u)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Sliders className="w-3 h-3 text-indigo-600" />
                        <span>الأنظمة المفتوحة (تحكم)</span>
                      </button>
                    </td>

                    {/* 7. Status */}
                    <td className="p-3.5">
                      {!isSuper ? (
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(u)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                            isSuspended
                              ? 'bg-rose-100 text-rose-800 hover:bg-rose-200 border border-rose-200'
                              : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-200'
                          }`}
                          title={isSuspended ? 'انقر لتفعيل وفك تجميد الحساب' : 'انقر لتجميد وقفل الحساب'}
                        >
                          {isSuspended ? (
                            <>
                              <Lock className="w-3 h-3" />
                              <span>معلق / مغلق</span>
                            </>
                          ) : (
                            <>
                              <Unlock className="w-3 h-3" />
                              <span>نشط ومفعل</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-900 rounded-lg text-[11px] font-bold border border-amber-200">
                          <Shield className="w-3 h-3" />
                          <span>حساب المالك الدائم</span>
                        </span>
                      )}
                    </td>

                    {/* 8. Actions */}
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Renew Subscription Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedUserForRenewal(u);
                            setRenewalPlan(u.subscriptionPlan || 'PROFESSIONAL');
                            setRenewalPrice(u.subscriptionPrice || 85);
                          }}
                          className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500 text-amber-900 hover:text-slate-950 font-bold rounded-lg text-[11px] flex items-center gap-1 transition-all cursor-pointer border border-amber-500/30"
                          title="تجديد أو ترقية باقة الاشتراك وتاريخ الانتهاء"
                        >
                          <CreditCard className="w-3 h-3" />
                          <span>تجديد الاشتراك</span>
                        </button>

                        {/* Login as User (Impersonate) */}
                        <button
                          type="button"
                          onClick={() => onSelectUserForLogin(u)}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-indigo-600 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                          title="تسجيل الدخول فورياً بصلاحيات هذا المستخدم لمعاينة حسابه"
                        >
                          <LogIn className="w-3 h-3" />
                          <span>دخول بالحساب</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: Create New Tenant Account & Subscription */}
      {/* ------------------------------------------------------------- */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">إنشاء حساب مشترك جديد وتفعيل الاشتراك</h3>
                  <p className="text-xs text-slate-500">خاص بالسوبر أدمن: توليد حساب شركة أو تاجر أو مدير مع باقة وصلاحيات</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم المسؤول / صاحب الحساب *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: أحمد عبد الله"
                    value={newAccName}
                    onChange={(e) => setNewAccName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم الشركة / المتجر التجاري</label>
                  <input
                    type="text"
                    placeholder="مثال: شركة البرق للخدمات اللوجستية"
                    value={newAccCompanyName}
                    onChange={(e) => setNewAccCompanyName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف (المستخدم لتسجيل الدخول) *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: 0791234567"
                    value={newAccPhone}
                    onChange={(e) => setNewAccPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">البريد الإلكتروني (اختياري)</label>
                  <input
                    type="email"
                    placeholder="name@company.com"
                    value={newAccEmail}
                    onChange={(e) => setNewAccEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور الابتدائية</label>
                  <input
                    type="text"
                    required
                    value={newAccPassword}
                    onChange={(e) => setNewAccPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الدور الوظيفي في المنظومة</label>
                  <select
                    value={newAccRole}
                    onChange={(e) => setNewAccRole(e.target.value as Role)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden cursor-pointer"
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

              {/* Subscription Plan Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">تحديد باقة الاشتراك والتراخيص *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {SAAS_SUBSCRIPTION_PLANS.map((plan) => (
                    <div
                      key={plan.id}
                      onClick={() => setNewAccPlan(plan.id)}
                      className={`p-3 rounded-2xl border-2 transition-all cursor-pointer ${
                        newAccPlan === plan.id
                          ? 'border-amber-500 bg-amber-50/50 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-slate-900">{plan.nameAr}</span>
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-md">
                          {plan.monthlyPriceJod > 0 ? `${plan.monthlyPriceJod} د.أ/شهر` : 'مجاناً'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed">{plan.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'جاري الإنشاء...' : 'تأكيد إنشاء الحساب والاشتراك'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: Subscription Renewal & Plan Change */}
      {/* ------------------------------------------------------------- */}
      {selectedUserForRenewal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">تجديد أو تعديل باقة الاشتراك</h3>
                  <p className="text-xs text-slate-500">المستخدم: {selectedUserForRenewal.name} ({selectedUserForRenewal.companyName || selectedUserForRenewal.email})</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUserForRenewal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRenewSubscription} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اختر باقة الاشتراك</label>
                <select
                  value={renewalPlan}
                  onChange={(e) => {
                    const p = e.target.value as SubscriptionPlanType;
                    setRenewalPlan(p);
                    const planData = SAAS_SUBSCRIPTION_PLANS.find((x) => x.id === p);
                    if (planData) setRenewalPrice(planData.monthlyPriceJod);
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden cursor-pointer"
                >
                  <option value="ENTERPRISE">الباقة الماسية والمؤسسية (Enterprise) - 150 د.أ/شهر</option>
                  <option value="PROFESSIONAL">الباقة الذهبية للمحترفين (Gold Pro) - 85 د.أ/شهر</option>
                  <option value="GROWTH">الباقة الفضية للنمو (Silver) - 40 د.أ/شهر</option>
                  <option value="TRIAL">الاشتراك التجريبي (Trial 14 days) - مجاني</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">مدة التمديد الإضافية</label>
                  <select
                    value={renewalDays}
                    onChange={(e) => setRenewalDays(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden cursor-pointer"
                  >
                    <option value={30}>+ 30 يوم (شهر إضافي)</option>
                    <option value={90}>+ 90 يوم (3 أشهر)</option>
                    <option value={180}>+ 180 يوم (6 أشهر)</option>
                    <option value={365}>+ 365 يوم (سنة كاملة)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">قيمة الاشتراك المتفق عليها (د.أ)</label>
                  <input
                    type="number"
                    value={renewalPrice}
                    onChange={(e) => setRenewalPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  سيتم تمديد تاريخ انتهاء صلاحية الحساب تلقائياً، وتحديث الحالة إلى <strong>نشط ومفعل</strong> مع إتاحة كافة مميزات الباقة المختارة فورياً.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedUserForRenewal(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'جاري الحفظ...' : 'تأكيد التجديد وتحديث الباقة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: Granular Modules & Feature Flags Matrix */}
      {/* ------------------------------------------------------------- */}
      {selectedUserForModules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">فتح وإغلاق أنظمة وموديلات الحساب</h3>
                  <p className="text-xs text-slate-500">الحساب: {selectedUserForModules.name} ({selectedUserForModules.roleName || selectedUserForModules.role})</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUserForModules(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mt-4">
              <p className="text-xs text-slate-600 font-medium">
                بصفتك السوبر أدمن، يمكنك تفعيل أو تعطيل أي جزء من المنظومة لهذا العميل بشكل مخصص:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  { key: 'tmsDelivery', title: '🚚 إدارة الشحنات والتوصيل (TMS)', desc: 'إنشاء البوالص، توزيع السائقين، وتتبع الحالات' },
                  { key: 'posCashier', title: '🛒 نظام الكاشير والمبيعات (POS)', desc: 'شاشة نقاط البيع السريعة والباركود والخصومات' },
                  { key: 'merchantWms', title: '📦 مخزن التاجر وإدارة المخزون (WMS)', desc: 'إدارة المنتجات، الأصناف، الفواتير، والكميات' },
                  { key: 'accountingSettlements', title: '💰 المحاسبة والتسويات المالية (ERP)', desc: 'كشوفات COD، قيود اليومية، وسندات الصرف والقبض' },
                  { key: 'apiIntegrations', title: '🔌 الربط البرمجي للمتاجر (API)', desc: 'مفاتيح الربط مع Shopify, Salla, WooCommerce' },
                  { key: 'aiRouteOptimizer', title: '🗺️ تحسين المسارات الذكي (AI Routing)', desc: 'ترتيب نقاط التوصيل الجغرافية وتوليد خرائط Google' },
                ].map((mod) => {
                  const isEnabled = selectedUserForModules.enabledModules?.[mod.key] ?? true;
                  return (
                    <div
                      key={mod.key}
                      onClick={() => handleToggleModule(selectedUserForModules, mod.key, isEnabled)}
                      className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-start justify-between gap-2 ${
                        isEnabled
                          ? 'border-emerald-500 bg-emerald-50/40 text-slate-900'
                          : 'border-slate-200 bg-slate-50/60 text-slate-400'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-xs">{mod.title}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{mod.desc}</div>
                      </div>
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                          isEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-600'
                        }`}
                      >
                        {isEnabled ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <X className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end pt-4 border-t border-slate-100 mt-4">
              <button
                type="button"
                onClick={() => setSelectedUserForModules(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                إغلاق وحفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 4: Reset Password Directly */}
      {/* ------------------------------------------------------------- */}
      {selectedUserForPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-black text-slate-900">تغيير كلمة المرور للحساب</h3>
              </div>
              <button onClick={() => setSelectedUserForPassword(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-3 mt-4">
              <p className="text-xs text-slate-600">
                أدخل كلمة المرور الجديدة للمستخدم <strong>{selectedUserForPassword.name}</strong>:
              </p>
              <input
                type="text"
                required
                placeholder="كلمة المرور الجديدة..."
                value={newPasswordVal}
                onChange={(e) => setNewPasswordVal(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedUserForPassword(null)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 text-slate-950 font-black rounded-lg text-xs shadow-md"
                >
                  حفظ التغيير
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

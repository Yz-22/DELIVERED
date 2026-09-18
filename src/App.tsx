import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TopNavbar, AppSection } from './components/TopNavbar';
import { OperationsHeader } from './components/OperationsHeader';
import { ToolbarFilter } from './components/ToolbarFilter';
import { OrdersDataGrid } from './components/OrdersDataGrid';
import { KanbanBoard } from './components/KanbanBoard';
import { KpiSummaryView } from './components/KpiSummaryView';
import { DriverPortal } from './components/DriverPortal';
import { FinancialSettlements } from './components/FinancialSettlements';
import { MerchantPortal } from './components/MerchantPortal';
import { ReverseLogistics } from './components/ReverseLogistics';
import { RouteOptimizerModal } from './components/RouteOptimizerModal';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { PublicTrackingModal } from './components/PublicTrackingModal';
import { CreateOrderModal } from './components/CreateOrderModal';
import { QuickOrderModal } from './components/QuickOrderModal';
import { BatchImportModal } from './components/BatchImportModal';
import { OrderDetailsDrawer } from './components/OrderDetailsDrawer';
import { ThermalWaybillModal } from './components/ThermalWaybillModal';
import { SchemaAndApiModal } from './components/SchemaAndApiModal';
import { IntegrationsModal } from './components/IntegrationsModal';
import { CliqPaymentModal } from './components/CliqPaymentModal';
import { OperationsDashboardGrid } from './components/OperationsDashboardGrid';
import { UsersManagement } from './components/UsersManagement';
import { ManifestsStatements } from './components/ManifestsStatements';
import { StaffPortal } from './components/StaffPortal';
import { AccessDeniedView } from './components/AccessDeniedView';
import { AdminSettings } from './components/AdminSettings';
import { MerchantBranches } from './components/MerchantBranches';
import { CashierWorkspace } from './components/CashierWorkspace';
import { ReportsAndStatements } from './components/ReportsAndStatements';
import { LoginPage } from './components/LoginPage';
import { InviteAcceptancePage } from './components/InviteAcceptancePage';
import { supabase, resolveSupabaseOAuthSession } from './lib/supabase';
import { OpsSuperAdminLogin } from './components/OpsSuperAdminLogin';
import { SuperAdminMasterHub } from './components/SuperAdminMasterHub';
import { TenantBrandingProvider } from './context/TenantBrandingContext';
import { Order, OrderStatus, User, Role, OrdersQueryResponse } from './types/logistics';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import {
  getAuthHeaders as getAppAuthHeaders,
  getAuthToken,
  storeDelivereSession,
  clearDelivereSession,
  getStoredDelivereSession,
} from './lib/auth';

export default function App() {
  // Check OPS portal from subdomain, path, query param, or hash
  const checkIsOpsPortal = () => {
    if (typeof window === 'undefined') return false;
    const hostname = window.location.hostname || '';
    const pathname = window.location.pathname || '';
    const searchParams = new URLSearchParams(window.location.search);
    return (
      hostname.startsWith('ops.') ||
      pathname.startsWith('/ops') ||
      searchParams.get('portal') === 'ops' ||
      searchParams.get('ops') === 'true' ||
      window.location.hash.includes('/ops')
    );
  };

  const [isOpsMode, setIsOpsMode] = useState<boolean>(checkIsOpsPortal);

  // Sync state if user navigates back/forward
  useEffect(() => {
    const handlePopState = () => {
      setIsOpsMode(checkIsOpsPortal());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleSwitchToOps = () => {
    setIsOpsMode(true);
    try {
      window.history.pushState(null, '', '/ops');
    } catch {
      // fallback
    }
  };

  const handleSwitchToStandard = () => {
    setIsOpsMode(false);
    try {
      window.history.pushState(null, '', '/');
    } catch {
      // fallback
    }
  };

  // Primary Navigation Section: Operations, Driver Mobile, Financial Settlements, Merchant Portal, Reverse Logistics
  const [activeSection, setActiveSection] = useState<AppSection>('operations');

  // Navigation & View Mode within Operations
  const [viewMode, setViewMode] = useState<'grid' | 'kanban' | 'kpi'>('grid');

  // Authentication & Current User Session
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authState, setAuthState] = useState<'INITIALIZING' | 'AUTHENTICATED' | 'UNAUTHENTICATED'>('INITIALIZING');
  const isAuthChecking = authState === 'INITIALIZING';
  const [cliqOrder, setCliqOrder] = useState<Order | null>(null);

  // Invite Token URL detector
  const [inviteToken, setInviteToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const searchParams = new URLSearchParams(window.location.search);
    const tokenParam = searchParams.get('token') || searchParams.get('invite_token') || searchParams.get('invitation');
    if (tokenParam) {
      try {
        sessionStorage.setItem('delivere_pending_invite_token', tokenParam);
        localStorage.setItem('delivere_pending_invite_token', tokenParam);
      } catch {}
      return tokenParam;
    }
    if (window.location.pathname.startsWith('/invite')) {
      const pToken = searchParams.get('token') || '';
      if (pToken) {
        try {
          sessionStorage.setItem('delivere_pending_invite_token', pToken);
          localStorage.setItem('delivere_pending_invite_token', pToken);
        } catch {}
        return pToken;
      }
    }
    try {
      return sessionStorage.getItem('delivere_pending_invite_token') || localStorage.getItem('delivere_pending_invite_token');
    } catch {
      return null;
    }
  });

  // Active User Role & RBAC Security Matrix
  const currentRole: Role = currentUser?.role || 'ADMIN';

  const permissions = useMemo(() => {
    switch (currentRole) {
      case 'SUPER_ADMIN':
        return {
          allowedSections: [
            'super_admin_hub',
            'operations_grid',
            'operations',
            'manifests',
            'users',
            'reports_statements',
            'merchant_branches',
            'settlements',
            'reverse_logistics',
            'staff_portal',
            'driver_portal',
            'settings',
          ] as AppSection[],
          canManageUsers: true,
          canAccessReverseLogistics: true,
          canBulkStatusChange: true,
          canBulkAssignDriver: true,
          canCreateOrder: true,
          canExportCSV: true,
          canAccessFinancials: true,
        };
      case 'ADMIN':
        return {
          allowedSections: [
            'operations_grid',
            'operations',
            'manifests',
            'users',
            'reports_statements',
            'merchant_branches',
            'settlements',
            'reverse_logistics',
            'staff_portal',
            'driver_portal',
            'settings',
          ] as AppSection[],
          canManageUsers: true,
          canAccessReverseLogistics: true,
          canBulkStatusChange: true,
          canBulkAssignDriver: true,
          canCreateOrder: true,
          canExportCSV: true,
          canAccessFinancials: true,
        };
      case 'OPERATOR':
      case 'STAFF':
        return {
          allowedSections: [
            'staff_portal',
            'operations_grid',
            'operations',
            'manifests',
            'reverse_logistics',
          ] as AppSection[],
          canManageUsers: false,
          canAccessReverseLogistics: true,
          canBulkStatusChange: true,
          canBulkAssignDriver: true,
          canCreateOrder: true,
          canExportCSV: true,
          canAccessFinancials: false,
        };
      case 'CASHIER':
        return {
          allowedSections: [
            'cashier_workspace',
          ] as AppSection[],
          canManageUsers: false,
          canAccessReverseLogistics: false,
          canBulkStatusChange: true,
          canBulkAssignDriver: false,
          canCreateOrder: true,
          canExportCSV: false,
          canAccessFinancials: false,
        };
      case 'ACCOUNTANT':
        return {
          allowedSections: [
            'reports_statements',
            'settlements',
            'manifests',
            'operations_grid',
            'operations',
          ] as AppSection[],
          canManageUsers: false,
          canAccessReverseLogistics: false,
          canBulkStatusChange: false,
          canBulkAssignDriver: false,
          canCreateOrder: false,
          canExportCSV: true,
          canAccessFinancials: true,
        };
      case 'MERCHANT':
        return {
          allowedSections: [
            'merchant_portal',
            'merchant_branches',
            'reports_statements',
            'settlements',
          ] as AppSection[],
          canManageUsers: false,
          canAccessReverseLogistics: false,
          canBulkStatusChange: false,
          canBulkAssignDriver: false,
          canCreateOrder: true,
          canExportCSV: true,
          canAccessFinancials: true,
        };
      case 'DRIVER':
        return {
          allowedSections: ['driver_portal'] as AppSection[],
          canManageUsers: false,
          canAccessReverseLogistics: false,
          canBulkStatusChange: false,
          canBulkAssignDriver: false,
          canCreateOrder: false,
          canExportCSV: false,
          canAccessFinancials: false,
        };
      default:
        return {
          allowedSections: ['operations_grid'] as AppSection[],
          canManageUsers: false,
          canAccessReverseLogistics: false,
          canBulkStatusChange: false,
          canBulkAssignDriver: false,
          canCreateOrder: false,
          canExportCSV: false,
          canAccessFinancials: false,
        };
    }
  }, [currentRole]);

  // Helper label for authorized fallback section
  const getSectionTitle = (sec?: AppSection): string => {
    switch (sec) {
      case 'super_admin_hub':
        return 'المدير العام للنظام';
      case 'operations_grid':
        return 'لوحة العمليات المركزية';
      case 'operations':
        return 'جدول إدارة الطلبيات';
      case 'manifests':
        return 'كشوفات ومنافست التوزيع';
      case 'users':
        return 'إدارة المستخدمين وقوائم الأسعار';
      case 'staff_portal':
        return 'بوابة موظف العمليات والفرز';
      case 'driver_portal':
        return 'بوابة الكابتن وتوصيل الطرود';
      case 'merchant_portal':
        return 'بوابة المتجر والمخزن والطلبيات';
      case 'merchant_branches':
        return 'إدارة فروع المتجر والمناقلات المخزنية';
      case 'cashier_workspace':
        return 'مساحة الكاشير ونقاط البيع السريعة (POS)';
      case 'reports_statements':
        return 'التقارير وكشوفات الحسابات الموحدة';
      case 'settlements':
        return 'التسويات والحسابات المالية';
      case 'reverse_logistics':
        return 'اللوجستيات العكسية ومستودع المرتجعات';
      case 'settings':
        return 'الإعدادات، قوائم الأسعار، والمناطق';
      default:
        return 'البوابة الرئيسية';
    }
  };

  // Guard activeSection: automatically redirect if switched to a role lacking access
  useEffect(() => {
    if (!permissions.allowedSections.includes(activeSection)) {
      const defaultSec = permissions.allowedSections[0] || 'operations_grid';
      setActiveSection(defaultSec);
    }
  }, [permissions, activeSection]);

  // Orders State & Pagination
  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    picking: 0,
    out_for_delivery: 0,
    delivered: 0,
    cancelled: 0,
    postponed: 0,
    totalCOD: 0,
    totalDeliveryFees: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  // Users (Merchants and Drivers)
  const [merchants, setMerchants] = useState<User[]>([]);
  const [drivers, setDrivers] = useState<User[]>([]);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [governorateFilter, setGovernorateFilter] = useState('ALL');
  const [driverFilter, setDriverFilter] = useState('ALL');
  const [merchantFilter, setMerchantFilter] = useState('ALL');
  const [groupBy, setGroupBy] = useState<'none' | 'status' | 'governorate' | 'merchant' | 'driver'>('none');

  // Selection for Batch Actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isQuickModalOpen, setIsQuickModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);
  const [isRouteOptimizerOpen, setIsRouteOptimizerOpen] = useState(false);
  const [isIntegrationsOpen, setIsIntegrationsOpen] = useState(false);
  const [activeOrderDetails, setActiveOrderDetails] = useState<Order | null>(null);
  const [activeWaybillOrders, setActiveWaybillOrders] = useState<Order[] | null>(null);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Helper to extract session authorization headers
  const getAuthHeaders = useCallback((): Record<string, string> => {
    return getAppAuthHeaders(currentUser);
  }, [currentUser?.id]);

  // Fetch Users & Authenticate Session
  const fetchUsers = useCallback(async () => {
    if (authState !== 'AUTHENTICATED' || !currentUser?.id) return;
    try {
      const headers = getAuthHeaders();
      // Only fetch if an authorization token/header exists
      if (!headers['Authorization']) return;
      const res = await fetch('/api/users', { headers });
      if (res.ok) {
        const data: User[] = await res.json();
        setAllUsers(data);
        setMerchants(data.filter((u) => u.role === 'MERCHANT'));
        setDrivers(data.filter((u) => u.role === 'DRIVER'));
      }
    } catch (e) {
      console.error('Error fetching users:', e);
    }
  }, [authState, currentUser?.id, getAuthHeaders]);

  const handleLoginSuccess = (user: User, token: string) => {
    storeDelivereSession(user, token);
    setCurrentUser(user);
    setAuthState('AUTHENTICATED');
    if (user.role === 'SUPER_ADMIN') {
      setActiveSection('super_admin_hub');
    } else if (user.role === 'DRIVER') {
      setActiveSection('driver_portal');
    } else if (user.role === 'MERCHANT') {
      setActiveSection('merchant_portal');
    } else if (user.role === 'OPERATOR' || user.role === 'CASHIER' || user.role === 'STAFF') {
      setActiveSection('staff_portal');
    } else if (user.role === 'ACCOUNTANT') {
      setActiveSection('settlements');
    } else {
      setActiveSection('operations_grid');
    }
    showToast(`مرحباً بك: ${user.name} (${user.roleName || user.role})`);
  };

  const handleLogout = async () => {
    try {
      const headers = getAppAuthHeaders(currentUser);
      if (headers['Authorization']) {
        await fetch('/api/auth/logout', { method: 'POST', headers });
      }
    } catch {
      // Ignore network errors on logout
    }
    clearDelivereSession();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {}
    }
    setCurrentUser(null);
    setAuthState('UNAUTHENTICATED');
    showToast('تم تسجيل الخروج من النظام بنجاح');
  };

  const handleSelectUser = async (user: User) => {
    setCurrentUser(user);
    let switchToken = getAuthToken(user);
    try {
      const res = await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.token) switchToken = data.token;
      }
    } catch {
      // Ignore network errors
    }

    storeDelivereSession(user, switchToken);
    setAuthState('AUTHENTICATED');

    if (user.role === 'SUPER_ADMIN') {
      setActiveSection('super_admin_hub');
      showToast(`تم التبديل إلى مركز تحكم السوبر أدمن: ${user.name}`);
    } else if (user.role === 'DRIVER') {
      setActiveSection('driver_portal');
      showToast(`تم التبديل إلى بوابة الكابتن: ${user.name}`);
    } else if (user.role === 'MERCHANT') {
      setActiveSection('merchant_portal');
      showToast(`تم التبديل إلى بوابة التاجر: ${user.name}`);
    } else if (user.role === 'OPERATOR' || user.role === 'CASHIER' || user.role === 'STAFF') {
      setActiveSection('staff_portal');
      showToast(`تم التبديل إلى بوابة موظف العمليات والفرز: ${user.name}`);
    } else if (user.role === 'ACCOUNTANT') {
      setActiveSection('settlements');
      showToast(`تم التبديل إلى بوابة الحسابات والتسويات: ${user.name}`);
    } else {
      setActiveSection('operations_grid');
      showToast(`تم تسجيل الدخول بصلاحيات الإدارة: ${user.name}`);
    }
  };

  const handleAddUser = async (newUserData: Partial<User>): Promise<User | null> => {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: getAppAuthHeaders(currentUser),
        body: JSON.stringify(newUserData),
      });
      if (res.ok) {
        const resData: any = await res.json();
        const createdUser: User = resData.user || resData;
        setAllUsers((prev) => [createdUser, ...prev.filter((u) => u.id !== createdUser.id)]);
        if (createdUser.role === 'MERCHANT') {
          setMerchants((prev) => [createdUser, ...prev.filter((m) => m.id !== createdUser.id)]);
        }
        if (createdUser.role === 'DRIVER') {
          setDrivers((prev) => [createdUser, ...prev.filter((d) => d.id !== createdUser.id)]);
        }
        showToast(`تمت إضافة ${createdUser.commercialName || createdUser.name} بنجاح`);
        return createdUser;
      } else {
        const fallbackNew: User = {
          id: `u-${Date.now()}`,
          name: newUserData.name || '',
          email: newUserData.email || '',
          phone: newUserData.phone || '',
          role: newUserData.role || 'MERCHANT',
          roleName: newUserData.roleName,
          commercialName: newUserData.commercialName,
          commercialType: newUserData.commercialType,
          priceList: newUserData.priceList || 'جميع المملكة 2',
          branch: newUserData.branch || 'فرع عمان الرئيسي',
          accountManager: newUserData.accountManager || 'باسل البلبيسي',
          city: newUserData.city || 'عمان',
          isActive: newUserData.isActive ?? true,
        };
        setAllUsers((prev) => [fallbackNew, ...prev]);
        if (fallbackNew.role === 'MERCHANT') setMerchants((prev) => [fallbackNew, ...prev]);
        if (fallbackNew.role === 'DRIVER') setDrivers((prev) => [fallbackNew, ...prev]);
        showToast('تمت إضافة المستخدم بنجاح');
        return fallbackNew;
      }
    } catch (e) {
      console.error(e);
      showToast('خطأ في إضافة المستخدم', 'error');
      return null;
    }
  };

  const handleUpdateUser = async (id: string, updatedData: Partial<User>) => {
    try {
      const token = localStorage.getItem('dargo_jwt_token') || currentUser?.id;
      const url = updatedData.permissions && Object.keys(updatedData).length === 1
        ? `/api/users/${id}/permissions`
        : `/api/users/${id}`;

      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(updatedData),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'فشل حفظ تعديلات المستخدم والصلاحيات');
      }

      const resData = await res.json();
      const updatedUser: User = resData.user || { ...allUsers.find((u) => u.id === id)!, ...updatedData };

      setAllUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, ...updatedUser } : u))
      );
      setMerchants((prev) =>
        prev.map((u) => (u.id === id ? { ...u, ...updatedUser } : u))
      );
      setDrivers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, ...updatedUser } : u))
      );

      // If updating the currently logged in user, refresh session
      if (currentUser && currentUser.id === id) {
        setCurrentUser(updatedUser);
        let existingToken = '';
        try {
          const prev = localStorage.getItem('dargo_user_session');
          if (prev) existingToken = JSON.parse(prev)?.token || '';
        } catch {}
        const sessionToken = existingToken;
        const sessionObj = JSON.stringify({
          user: updatedUser,
          token: sessionToken,
          savedAt: new Date().toISOString(),
        });
        localStorage.setItem('dargo_user_session', sessionObj);
        localStorage.setItem('dargo_token', sessionToken);
        localStorage.setItem('dargo_jwt_token', sessionToken);
      }

      showToast('تم حفظ وتحديث تعديلات المستخدم والصلاحيات في قاعدة البيانات بنجاح');
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'فشل حفظ الصلاحيات والتعديلات', 'error');
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const res = await fetch('/api/database/backup');
      if (!res.ok) throw new Error('فشل تحميل النسخة الاحتياطية');
      const data = await res.json();
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dargo_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('تم تصدير وتحميل النسخة الاحتياطية بنجاح (JSON Backup)');
    } catch (err: any) {
      showToast(err.message || 'فشل تحميل النسخة الاحتياطية', 'error');
    }
  };

  // Fetch Orders from Express API
  const fetchOrders = useCallback(async () => {
    if (authState !== 'AUTHENTICATED' || !currentUser?.id) {
      return;
    }
    const headers = getAuthHeaders();
    if (!headers['Authorization']) {
      return;
    }

    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        search: searchQuery,
        status: statusFilter,
        governorate: governorateFilter,
        driverId: driverFilter,
        merchantId: merchantFilter,
      });

      const res = await fetch(`/api/orders?${queryParams.toString()}`, { headers });
      if (res.ok) {
        const data: OrdersQueryResponse = await res.json();
        setOrders(data.orders);
        setPagination(data.pagination);
        setStats(data.stats);
      }
    } catch (e) {
      console.error('Error fetching orders:', e);
    } finally {
      setIsLoading(false);
    }
  }, [
    authState,
    currentUser?.id,
    getAuthHeaders,
    pagination.page,
    pagination.limit,
    searchQuery,
    statusFilter,
    governorateFilter,
    driverFilter,
    merchantFilter,
  ]);

  useEffect(() => {
    let isMounted = true;
    const initAuthAndUsers = async () => {
      try {
        const hasOAuthParams =
          typeof window !== 'undefined' &&
          (window.location.hash.includes('access_token') ||
            window.location.search.includes('code=') ||
            window.location.hash.includes('code=') ||
            window.location.hash.includes('error=') ||
            window.location.search.includes('error='));

        // Check for returning Supabase OAuth session
        if (supabase && hasOAuthParams) {
          try {
            const accessToken = await resolveSupabaseOAuthSession(8000);
            if (accessToken) {
              const urlParams = new URLSearchParams(window.location.search);
              const pendingInvite =
                urlParams.get('token') ||
                urlParams.get('invite_token') ||
                urlParams.get('invitation') ||
                sessionStorage.getItem('delivere_pending_invite_token') ||
                localStorage.getItem('delivere_pending_invite_token') ||
                inviteToken;

              const res = await fetch('/api/auth/supabase-google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  supabaseAccessToken: accessToken,
                  invitationToken: pendingInvite || undefined,
                }),
              });

              const data = await res.json();
              if (res.ok && data.token && data.user) {
                sessionStorage.removeItem('delivere_pending_invite_token');
                localStorage.removeItem('delivere_pending_invite_token');
                storeDelivereSession(data.user, data.token);
                if (window.history.replaceState) {
                  window.history.replaceState(null, '', window.location.pathname);
                }
                setInviteToken(null);
                if (isMounted) {
                  handleLoginSuccess(data.user, data.token);
                }
                return;
              } else {
                console.warn('Backend OAuth exchange failed:', data?.error);
                await supabase.auth.signOut();
                if (pendingInvite) {
                  setInviteToken(pendingInvite);
                }
              }
            }
          } catch (authErr) {
            console.warn('OAuth session exchange warning in App.tsx:', authErr);
          }
        }

        const savedSession = getStoredDelivereSession();
        if (savedSession?.user?.id && savedSession?.token) {
          if (isMounted) {
            setCurrentUser(savedSession.user);
            setAuthState('AUTHENTICATED');
          }

          try {
            const verifyRes = await fetch('/api/auth/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${savedSession.token}`,
              },
              body: JSON.stringify({ userId: savedSession.user.id }),
            });
            if (verifyRes.ok) {
              const verified = await verifyRes.json();
              if (verified.user && isMounted) {
                setCurrentUser(verified.user);
                storeDelivereSession(verified.user, savedSession.token);
                setAuthState('AUTHENTICATED');
              }
            } else if (verifyRes.status === 401 || verifyRes.status === 403) {
              if (isMounted) {
                clearDelivereSession();
                setCurrentUser(null);
                setAuthState('UNAUTHENTICATED');
              }
            }
          } catch (netErr) {
            console.warn('Server temporarily unreachable during session check, retaining local session:', netErr);
          }
        } else {
          if (isMounted) {
            setAuthState('UNAUTHENTICATED');
          }
        }
      } catch (e) {
        console.error('Auth init error:', e);
        if (isMounted) {
          setAuthState('UNAUTHENTICATED');
        }
      } finally {
        if (isMounted) {
          setAuthState((prev) => (prev === 'INITIALIZING' ? 'UNAUTHENTICATED' : prev));
        }
      }
    };

    initAuthAndUsers();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (authState === 'AUTHENTICATED' && currentUser?.id) {
      fetchOrders();
    }
  }, [authState, currentUser?.id, fetchOrders]);

  useEffect(() => {
    if (authState === 'AUTHENTICATED' && currentUser?.id) {
      fetchUsers();
    }
  }, [authState, currentUser?.id, fetchUsers]);

  // Checkbox handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (orders.every((o) => selectedIds.includes(o.id))) {
      setSelectedIds([]);
    } else {
      setSelectedIds(orders.map((o) => o.id));
    }
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  // Create standard order
  const handleCreateOrder = async (orderData: any) => {
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: getAppAuthHeaders(currentUser),
        body: JSON.stringify(orderData),
      });
      if (res.ok) {
        showToast('تم إنشاء البوليصة والطلبية بنجاح');
        fetchOrders();
      }
    } catch (e) {
      showToast('حدث خطأ أثناء إنشاء الطلبية', 'error');
    }
  };

  // Quick order
  const handleQuickOrder = async (orderData: any) => {
    try {
      const res = await fetch('/api/orders/quick', {
        method: 'POST',
        headers: getAppAuthHeaders(currentUser),
        body: JSON.stringify(orderData),
      });
      if (res.ok) {
        showToast('تم تسجيل الطلبية السريعة بنجاح');
        fetchOrders();
      }
    } catch (e) {
      showToast('حدث خطأ أثناء حفظ الطلبية السريعة', 'error');
    }
  };

  // Batch import
  const handleBatchImport = async (batchOrders: any[]) => {
    try {
      const res = await fetch('/api/orders/batch', {
        method: 'POST',
        headers: getAppAuthHeaders(currentUser),
        body: JSON.stringify({ orders: batchOrders }),
      });
      if (res.ok) {
        const result = await res.json();
        showToast(result.message || 'تم استيراد الدفعة بنجاح');
        fetchOrders();
      }
    } catch (e) {
      showToast('حدث خطأ أثناء استيراد الدفعة', 'error');
    }
  };

  // Single Order Status Change
  const handleChangeStatus = async (orderId: string, newStatus: OrderStatus, note?: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: getAppAuthHeaders(currentUser),
        body: JSON.stringify({ status: newStatus, note }),
      });
      if (res.ok) {
        showToast('تم تحديث حالة الطلبية بنجاح');
        fetchOrders();
        if (activeOrderDetails && activeOrderDetails.id === orderId) {
          const updated = await res.json();
          setActiveOrderDetails(updated);
        }
      }
    } catch (e) {
      showToast('فشل تحديث الحالة', 'error');
    }
  };

  // Single Order Driver Assignment
  const handleAssignDriver = async (orderId: string, driverId: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/assign`, {
        method: 'PATCH',
        headers: getAppAuthHeaders(currentUser),
        body: JSON.stringify({ driverId }),
      });
      if (res.ok) {
        showToast('تم تعيين الكابتن بنجاح');
        fetchOrders();
        if (activeOrderDetails && activeOrderDetails.id === orderId) {
          const updated = await res.json();
          setActiveOrderDetails(updated);
        }
      }
    } catch (e) {
      showToast('فشل تعيين السائق', 'error');
    }
  };

  // Bulk Status Change
  const handleBulkStatusChange = async (status: OrderStatus) => {
    if (selectedIds.length === 0) return;
    if (!permissions.canBulkStatusChange) {
      showToast('غير مصرح لك بتعديل الحالات جماعياً. يتطلب هذا الإجراء صلاحيات مدير العمليات أو موظف المستودع.', 'error');
      return;
    }
    try {
      const res = await fetch('/api/orders/bulk-status', {
        method: 'POST',
        headers: getAppAuthHeaders(currentUser),
        body: JSON.stringify({ ids: selectedIds, status }),
      });
      if (res.ok) {
        showToast(`تم تحديث حالة ${selectedIds.length} طلبية إلى "${status}"`);
        setSelectedIds([]);
        fetchOrders();
      }
    } catch (e) {
      showToast('فشل التحديث الجماعي', 'error');
    }
  };

  // Bulk Assign Driver
  const handleBulkAssignDriver = async (driverId: string) => {
    if (selectedIds.length === 0) return;
    if (!permissions.canBulkAssignDriver) {
      showToast('غير مصرح لك بتعيين السائقين جماعياً. يتطلب هذا الإجراء صلاحيات إدارة العمليات.', 'error');
      return;
    }
    try {
      const res = await fetch('/api/orders/bulk-assign', {
        method: 'POST',
        headers: getAppAuthHeaders(currentUser),
        body: JSON.stringify({ ids: selectedIds, driverId }),
      });
      if (res.ok) {
        showToast(`تم تعيين الكابتن لـ ${selectedIds.length} طلبية بنجاح`);
        setSelectedIds([]);
        fetchOrders();
      }
    } catch (e) {
      showToast('فشل التعيين الجماعي', 'error');
    }
  };

  // Bulk Print Thermal Waybills
  const handleBulkPrintWaybills = () => {
    if (selectedIds.length === 0) return;
    const selectedOrders = orders.filter((o) => selectedIds.includes(o.id));
    if (selectedOrders.length > 0) {
      setActiveWaybillOrders(selectedOrders);
      showToast(`تم فتح حزمة طباعة البوالص الحرارية لـ ${selectedOrders.length} شحنة`);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!permissions.canExportCSV) {
      showToast('غير مصرح لك بتصدير ملفات البيانات.', 'error');
      return;
    }
    if (orders.length === 0) {
      showToast('لا توجد بيانات للتصدير', 'error');
      return;
    }
    const headers = [
      'الرقم التسلسلي',
      'رقم المرجع',
      'اسم المستلم',
      'رقم الهاتف',
      'المحافظة',
      'المنطقة',
      'المتجر',
      'الكابتن',
      'إجمالي التحصيل',
      'الحالة',
      'تاريخ الإنشاء',
    ];
    const rows = orders.map((o) => [
      o.sequence,
      o.referenceNumber || '',
      o.recipientName,
      o.recipientPhone,
      o.governorate,
      o.area,
      o.merchant?.commercialName || o.merchant?.name || '',
      o.driver?.name || 'غير معين',
      o.totalCollection,
      o.status,
      o.createdAt,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.map((cell) => `"${cell}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `dargo_orders_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('تم تصدير ملف CSV بنجاح');
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 font-sans" dir="rtl">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-300">جاري التحقق من الجلسة والصلاحيات...</p>
      </div>
    );
  }

  if (!currentUser) {
    if (inviteToken) {
      return (
        <InviteAcceptancePage
          token={inviteToken}
          onLoginSuccess={(user, token) => {
            setInviteToken(null);
            handleLoginSuccess(user, token);
          }}
          onNavigateToLogin={() => {
            setInviteToken(null);
            try {
              window.history.pushState(null, '', '/');
            } catch {
              // ignore
            }
          }}
        />
      );
    }

    return (
      <>
        {isOpsMode ? (
          <OpsSuperAdminLogin
            onLoginSuccess={handleLoginSuccess}
            onSwitchToStandardLogin={handleSwitchToStandard}
          />
        ) : (
          <LoginPage
            onLoginSuccess={handleLoginSuccess}
            onSwitchToOpsLogin={handleSwitchToOps}
            onOpenInvite={(token) => setInviteToken(token)}
          />
        )}
        {toastMessage && (
          <div
            className={`fixed bottom-5 left-5 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-bold ${
              toastMessage.type === 'success'
                ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                : 'bg-rose-600 text-white shadow-rose-600/20'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        )}
      </>
    );
  }

  return (
    <TenantBrandingProvider>
      <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans">
      {/* 1. Global Navigation Bar */}
      <TopNavbar
        activeSection={activeSection}
        onChangeSection={setActiveSection}
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenTracking={() => setIsTrackingOpen(true)}
        onOpenRouteOptimizer={() => setIsRouteOptimizerOpen(true)}
        onOpenSchemaDoc={() => setIsSchemaModalOpen(true)}
        onOpenIntegrations={() => setIsIntegrationsOpen(true)}
        currentUser={currentUser}
        onLogout={handleLogout}
        onDownloadBackup={handleDownloadBackup}
      />

      {/* 1. Super Admin Master Hub & Subscriptions Management */}
      {activeSection === 'super_admin_hub' && (
        permissions.allowedSections.includes('super_admin_hub') && currentUser ? (
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <SuperAdminMasterHub
              users={allUsers}
              currentUser={currentUser}
              onRefresh={async () => {
                const res = await fetch('/api/users');
                if (res.ok) {
                  const data = await res.json();
                  setAllUsers(data);
                }
              }}
              onSelectUserForLogin={(targetUser) => {
                setCurrentUser(targetUser);
                localStorage.setItem('dargo_tms_session', JSON.stringify({ user: targetUser, token: `dargo_jwt_${targetUser.id}` }));
                showToast(`تم تسجيل الدخول بنجاح بحساب (${targetUser.name}) - ${targetUser.roleName || targetUser.role}`, 'success');
                if (targetUser.role === 'MERCHANT') setActiveSection('merchant_portal');
                else if (targetUser.role === 'DRIVER') setActiveSection('driver_portal');
                else if (targetUser.role === 'OPERATOR') setActiveSection('staff_portal');
                else setActiveSection('operations_grid');
              }}
              showToast={showToast}
            />
          </main>
        ) : (
          <AccessDeniedView
            sectionTitle="مركز السوبر أدمن وإدارة الاشتراكات"
            requiredRole="المدير العام للنظام (SUPER_ADMIN)"
            currentRole={currentRole}
            onNavigateHome={() => setActiveSection(permissions.allowedSections[0])}
            homeSectionName={getSectionTitle(permissions.allowedSections[0])}
          />
        )
      )}

      {/* 2. Operations Dashboard Grid (ERP Summary Matrix) */}
      {activeSection === 'operations_grid' && (
        permissions.allowedSections.includes('operations_grid') ? (
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <OperationsDashboardGrid
              orders={orders}
              onSelectMetricFilter={(filterKey, status) => {
                if (status) {
                  setStatusFilter(status);
                } else if (filterKey === 'ACTIVE') {
                  setStatusFilter('ALL');
                }
                setActiveSection('operations');
              }}
              onNavigateToSection={(sec) => setActiveSection(sec as AppSection)}
            />
          </main>
        ) : (
          <AccessDeniedView
            sectionTitle="لوحة مؤشرات العمليات (Operations Matrix)"
            requiredRole="إدارة العمليات والفرز (ADMIN / OPERATOR)"
            currentRole={currentRole}
            onNavigateHome={() => setActiveSection(permissions.allowedSections[0])}
            homeSectionName={getSectionTitle(permissions.allowedSections[0])}
          />
        )
      )}

      {/* 3. Operations Section (Table / Kanban / KPI) */}
      {activeSection === 'operations' && (
        permissions.allowedSections.includes('operations') ? (
          <>
            <OperationsHeader
              viewMode={viewMode}
              setViewMode={setViewMode}
              onOpenCreateModal={() => setIsCreateModalOpen(true)}
              onOpenQuickModal={() => setIsQuickModalOpen(true)}
              onOpenBatchModal={() => setIsBatchModalOpen(true)}
              onRefresh={fetchOrders}
              onExportCSV={handleExportCSV}
              canCreateOrder={permissions.canCreateOrder}
              canExportCSV={permissions.canExportCSV}
              stats={stats}
              isLoading={isLoading}
            />

            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-4">
              <ToolbarFilter
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                governorateFilter={governorateFilter}
                setGovernorateFilter={setGovernorateFilter}
                driverFilter={driverFilter}
                setDriverFilter={setDriverFilter}
                merchantFilter={merchantFilter}
                setMerchantFilter={setMerchantFilter}
                groupBy={groupBy}
                setGroupBy={setGroupBy}
                merchants={merchants}
                drivers={drivers}
                selectedCount={selectedIds.length}
                onBulkStatusChange={handleBulkStatusChange}
                onBulkAssignDriver={handleBulkAssignDriver}
                onClearSelection={handleClearSelection}
                onBulkPrintWaybills={handleBulkPrintWaybills}
                canBulkStatusChange={permissions.canBulkStatusChange}
                canBulkAssignDriver={permissions.canBulkAssignDriver}
              />

              {viewMode === 'grid' && (
                <OrdersDataGrid
                  orders={orders}
                  selectedIds={selectedIds}
                  onToggleSelect={handleToggleSelect}
                  onToggleSelectAll={handleToggleSelectAll}
                  onViewDetails={(order) => setActiveOrderDetails(order)}
                  onPrintWaybill={(order) => setActiveWaybillOrders([order])}
                  onChangeStatus={handleChangeStatus}
                  onAssignDriver={handleAssignDriver}
                  drivers={drivers}
                  pagination={pagination}
                  onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
                  onLimitChange={(limit) => setPagination((prev) => ({ ...prev, limit, page: 1 }))}
                  groupBy={groupBy}
                  isLoading={isLoading}
                />
              )}

              {viewMode === 'kanban' && (
                <KanbanBoard
                  orders={orders}
                  onViewDetails={(order) => setActiveOrderDetails(order)}
                  onPrintWaybill={(order) => setActiveWaybillOrders([order])}
                  onChangeStatus={(orderId, status) => handleChangeStatus(orderId, status)}
                  drivers={drivers}
                />
              )}

              {viewMode === 'kpi' && (
                <KpiSummaryView orders={orders} drivers={drivers} stats={stats} />
              )}
            </main>
          </>
        ) : (
          <AccessDeniedView
            sectionTitle="جدول العمليات والطلبيات الشامل"
            requiredRole="إدارة العمليات والفرز (ADMIN / OPERATOR)"
            currentRole={currentRole}
            onNavigateHome={() => setActiveSection(permissions.allowedSections[0])}
            homeSectionName={getSectionTitle(permissions.allowedSections[0])}
          />
        )
      )}

      {/* 4. Manifests & Financial Statements */}
      {activeSection === 'manifests' && (
        permissions.allowedSections.includes('manifests') ? (
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <ManifestsStatements
              orders={orders}
              drivers={drivers}
              merchants={merchants}
              onPrintThermalBatch={(selected) => {
                setActiveWaybillOrders(selected);
                showToast(`تم فتح حزمة طباعة البوالص لـ ${selected.length} شحنة`);
              }}
            />
          </main>
        ) : (
          <AccessDeniedView
            sectionTitle="كشوفات ومنافست التوزيع"
            requiredRole="إدارة العمليات وموظف الفرز (ADMIN / OPERATOR)"
            currentRole={currentRole}
            onNavigateHome={() => setActiveSection(permissions.allowedSections[0])}
            homeSectionName={getSectionTitle(permissions.allowedSections[0])}
          />
        )
      )}

      {/* 5. Users & Roles Management (RBAC & Price Lists) - STRICTLY ADMIN ONLY */}
      {activeSection === 'users' && (
        permissions.canManageUsers ? (
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <UsersManagement
              users={allUsers}
              currentUser={currentUser}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
            />
          </main>
        ) : (
          <AccessDeniedView
            sectionTitle="إدارة المستخدمين وقوائم الأسعار والصلاحيات"
            requiredRole="مدير العمليات والنظام (ADMIN)"
            currentRole={currentRole}
            onNavigateHome={() => setActiveSection(permissions.allowedSections[0])}
            homeSectionName={getSectionTitle(permissions.allowedSections[0])}
          />
        )
      )}

      {/* 6. Operations Staff Portal (Inbound, Sorting & Dispatch) */}
      {activeSection === 'staff_portal' && (
        permissions.allowedSections.includes('staff_portal') ? (
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <StaffPortal
              orders={orders}
              drivers={drivers}
              onOpenScanner={() => setIsScannerOpen(true)}
              onOpenWaybill={(order) => setActiveWaybillOrders([order])}
              onOpenWaybillBatch={(ordersList) => {
                setActiveWaybillOrders(ordersList);
                showToast(`تم فتح طباعة البوالص لـ ${ordersList.length} شحنة`);
              }}
              onChangeOrderStatus={handleChangeStatus}
              onAssignDriver={handleAssignDriver}
            />
          </main>
        ) : (
          <AccessDeniedView
            sectionTitle="بوابة موظف العمليات والفرز والمستودع"
            requiredRole="موظف العمليات أو مدير النظام"
            currentRole={currentRole}
            onNavigateHome={() => setActiveSection(permissions.allowedSections[0])}
            homeSectionName={getSectionTitle(permissions.allowedSections[0])}
          />
        )
      )}

      {/* 7. Driver Mobile Portal Section */}
      {activeSection === 'driver_portal' && (
        permissions.allowedSections.includes('driver_portal') ? (
          <main className="flex-1 py-4">
            <DriverPortal
              drivers={drivers}
              currentUser={currentUser}
              onOrderUpdated={fetchOrders}
              onOpenWaybill={(order) => setActiveWaybillOrders([order])}
            />
          </main>
        ) : (
          <AccessDeniedView
            sectionTitle="بوابة الكابتن وتوصيل الشحنات الميدانية"
            requiredRole="كابتن توصيل معتمد (DRIVER)"
            currentRole={currentRole}
            onNavigateHome={() => setActiveSection(permissions.allowedSections[0])}
            homeSectionName={getSectionTitle(permissions.allowedSections[0])}
          />
        )
      )}

      {/* 8. Financial Settlements Section */}
      {activeSection === 'settlements' && (
        permissions.canAccessFinancials ? (
          <main className="flex-1 py-4">
            <FinancialSettlements />
          </main>
        ) : (
          <AccessDeniedView
            sectionTitle="الحسابات والتسويات المالية"
            requiredRole="حساب تاجر أو مدير النظام المالي"
            currentRole={currentRole}
            onNavigateHome={() => setActiveSection(permissions.allowedSections[0])}
            homeSectionName={getSectionTitle(permissions.allowedSections[0])}
          />
        )
      )}

      {/* 9. Merchant Self-Service Portal */}
      {activeSection === 'merchant_portal' && (
        permissions.allowedSections.includes('merchant_portal') ? (
          <main className="flex-1 py-4">
            <MerchantPortal
              merchants={merchants}
              currentUser={currentUser}
              onOpenWaybill={(order) => setActiveWaybillOrders([order])}
              onViewOrderDetails={(order) => setActiveOrderDetails(order)}
              onOrderCreated={fetchOrders}
            />
          </main>
        ) : (
          <AccessDeniedView
            sectionTitle="بوابة التاجر والخدمة الذاتية"
            requiredRole="حساب تاجر معتمد أو الإدارة"
            currentRole={currentRole}
            onNavigateHome={() => setActiveSection(permissions.allowedSections[0])}
            homeSectionName={getSectionTitle(permissions.allowedSections[0])}
          />
        )
      )}

      {/* 10. Reverse Logistics & Warehouse Shelving - STRICTLY ADMIN & OPERATOR */}
      {activeSection === 'reverse_logistics' && (
        permissions.canAccessReverseLogistics ? (
          <main className="flex-1 py-4">
            <ReverseLogistics
              merchants={merchants}
              orders={orders}
              onRefreshOrders={fetchOrders}
              onOpenWaybill={(order) => setActiveWaybillOrders([order])}
            />
          </main>
        ) : (
          <AccessDeniedView
            sectionTitle="اللوجستيات العكسية ومستودع الطرود المرتجعة"
            requiredRole="أمين المستودع أو إدارة العمليات (ADMIN / OPERATOR)"
            currentRole={currentRole}
            onNavigateHome={() => setActiveSection(permissions.allowedSections[0])}
            homeSectionName={getSectionTitle(permissions.allowedSections[0])}
          />
        )
      )}

      {/* 11. Admin Settings & Pricing - STRICTLY ADMIN ONLY (Matching user screenshot) */}
      {activeSection === 'settings' && (
        currentRole === 'ADMIN' ? (
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <AdminSettings
              merchants={merchants}
              onOpenIntegrations={() => setIsIntegrationsOpen(true)}
            />
          </main>
        ) : (
          <AccessDeniedView
            sectionTitle="إعدادات النظام، التسعير والمناطق"
            requiredRole="مدير العمليات والنظام (ADMIN)"
            currentRole={currentRole}
            onNavigateHome={() => setActiveSection(permissions.allowedSections[0])}
            homeSectionName={getSectionTitle(permissions.allowedSections[0])}
          />
        )
      )}

      {/* 12. Merchant Multi-Branch & Stock Transfer Architecture */}
      {activeSection === 'merchant_branches' && (
        permissions.allowedSections.includes('merchant_branches') ? (
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <MerchantBranches
              currentUser={currentUser}
              merchants={merchants}
              merchantId={currentUser?.role === 'MERCHANT' ? currentUser.id : undefined}
            />
          </main>
        ) : (
          <AccessDeniedView
            sectionTitle="إدارة فروع المتجر والمناقلات المخزنية"
            requiredRole="حساب تاجر أو إدارة العمليات"
            currentRole={currentRole}
            onNavigateHome={() => setActiveSection(permissions.allowedSections[0])}
            homeSectionName={getSectionTitle(permissions.allowedSections[0])}
          />
        )
      )}

      {/* 13. Cashier & POS Dedicated Workspace */}
      {activeSection === 'cashier_workspace' && (
        permissions.allowedSections.includes('cashier_workspace') && currentUser ? (
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <CashierWorkspace
              currentUser={currentUser}
              merchants={merchants}
              onOrderCreated={fetchOrders}
              onLogout={handleLogout}
            />
          </main>
        ) : (
          <AccessDeniedView
            sectionTitle="مساحة الكاشير ونقاط البيع السريعة (POS)"
            requiredRole="أمين الصندوق (CASHIER)"
            currentRole={currentRole}
            onNavigateHome={() => setActiveSection(permissions.allowedSections[0])}
            homeSectionName={getSectionTitle(permissions.allowedSections[0])}
          />
        )
      )}

      {/* 14. Statements & Financial / Operational Reports */}
      {activeSection === 'reports_statements' && (
        permissions.allowedSections.includes('reports_statements') ? (
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <ReportsAndStatements
              currentUser={currentUser}
              merchants={merchants}
              drivers={drivers}
            />
          </main>
        ) : (
          <AccessDeniedView
            sectionTitle="التقارير وكشوفات الحسابات الموحدة"
            requiredRole="محاسب مالي أو إدارة العمليات أو تاجر"
            currentRole={currentRole}
            onNavigateHome={() => setActiveSection(permissions.allowedSections[0])}
            homeSectionName={getSectionTitle(permissions.allowedSections[0])}
          />
        )
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 left-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg bg-slate-900 text-white text-xs font-bold border border-slate-800 animate-in fade-in slide-in-from-bottom-2">
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400" />
          )}
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white mr-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Modals & Drawers */}
      <CreateOrderModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateOrder}
        merchants={merchants}
        drivers={drivers}
        onAddNewMerchant={handleAddUser}
      />

      <QuickOrderModal
        isOpen={isQuickModalOpen}
        onClose={() => setIsQuickModalOpen(false)}
        onSubmit={handleQuickOrder}
        merchants={merchants}
        onAddNewMerchant={handleAddUser}
      />

      <BatchImportModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        onSubmit={handleBatchImport}
        merchants={merchants}
      />

      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        drivers={drivers}
        onScanSuccess={fetchOrders}
      />

      <PublicTrackingModal
        isOpen={isTrackingOpen}
        onClose={() => setIsTrackingOpen(false)}
      />

      <RouteOptimizerModal
        isOpen={isRouteOptimizerOpen}
        onClose={() => setIsRouteOptimizerOpen(false)}
        drivers={drivers}
        onAppliedOptimization={fetchOrders}
      />

      <OrderDetailsDrawer
        order={activeOrderDetails}
        isOpen={!!activeOrderDetails}
        onClose={() => setActiveOrderDetails(null)}
        onPrintWaybill={(order) => {
          setActiveWaybillOrders([order]);
          setActiveOrderDetails(null);
        }}
        onChangeStatus={handleChangeStatus}
        onAssignDriver={handleAssignDriver}
        onOpenCliqPayment={(order) => setCliqOrder(order)}
        drivers={drivers}
      />

      <ThermalWaybillModal
        orders={activeWaybillOrders}
        isOpen={!!activeWaybillOrders && activeWaybillOrders.length > 0}
        onClose={() => setActiveWaybillOrders(null)}
      />

      <IntegrationsModal
        isOpen={isIntegrationsOpen}
        onClose={() => setIsIntegrationsOpen(false)}
        merchants={merchants}
        onOrderCreatedFromWebhook={() => {
          fetchOrders();
          showToast('تم استقبال وتوليد طلبية متجر إلكتروني بنجاح عبر Webhook!');
        }}
      />

      <SchemaAndApiModal
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
      />

      {/* Jordan JoPACC CliQ Payment Modal */}
      <CliqPaymentModal
        isOpen={!!cliqOrder}
        order={cliqOrder}
        onClose={() => setCliqOrder(null)}
        onSuccess={(updatedOrder) => {
          showToast(`تم توثيق دفع حوالة CliQ للشحنة (${updatedOrder.sequence}) بنجاح!`);
          setCliqOrder(null);
          fetchOrders();
          if (activeOrderDetails && activeOrderDetails.id === updatedOrder.id) {
            setActiveOrderDetails(updatedOrder);
          }
        }}
      />
    </div>
  </TenantBrandingProvider>
  );
}

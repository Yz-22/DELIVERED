import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AppSection } from './components/TopNavbar';
import { LoginPage } from './components/LoginPage';
import { InviteAcceptancePage } from './components/InviteAcceptancePage';
import { supabase, resolveSupabaseOAuthSession } from './lib/supabase';
import { TenantBrandingProvider } from './context/TenantBrandingContext';
import { Order, OrderStatus, User, Role, OrdersQueryResponse } from './types/logistics';
import { resolveWorkspaceForUser } from './lib/workspaceResolver';
import {
  getAuthHeaders as getAppAuthHeaders,
  getAuthToken,
  storeDelivereSession,
  clearDelivereSession,
  getStoredDelivereSession,
} from './lib/auth';

// Modular Shell Architecture
import { ProductShell } from './components/shell/ProductShell';
import { WorkspaceViewResolver } from './components/shell/WorkspaceViewResolver';
import { GlobalOverlayLayer, ToastState } from './components/shell/GlobalOverlayLayer';

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

  // Primary Navigation Section
  const [activeSection, setActiveSection] = useState<AppSection | null>(() => {
    const saved = getStoredDelivereSession();
    return resolveWorkspaceForUser(saved?.user);
  });

  // Navigation & View Mode within Operations
  const [viewMode, setViewMode] = useState<'grid' | 'kanban' | 'kpi'>('grid');

  // Authentication & Current User Session
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [impersonatingAdmin, setImpersonatingAdmin] = useState<User | null>(null);
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
      } catch {}
      return tokenParam;
    }
    if (window.location.pathname.startsWith('/invite')) {
      const pToken = searchParams.get('token') || '';
      if (pToken) {
        try {
          sessionStorage.setItem('delivere_pending_invite_token', pToken);
        } catch {}
        return pToken;
      }
      try {
        return sessionStorage.getItem('delivere_pending_invite_token');
      } catch {}
    }
    return null;
  });

  // Active User Role & RBAC Security Matrix
  const currentRole = currentUser?.role;

  const permissions = useMemo(() => {
    const normalizedRole = currentRole ? String(currentRole).toUpperCase().trim() : '';
    switch (normalizedRole) {
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
      case 'DISPATCHER':
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
        // FAIL CLOSED: Unknown / undefined / unauthorized role has NO allowed sections
        return {
          allowedSections: [] as AppSection[],
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

  // Guard activeSection: automatically redirect if switched to a role lacking access
  useEffect(() => {
    if (activeSection && !permissions.allowedSections.includes(activeSection)) {
      const defaultSec = permissions.allowedSections[0] || null;
      setActiveSection(defaultSec);
    } else if (!activeSection && permissions.allowedSections.length > 0) {
      setActiveSection(permissions.allowedSections[0]);
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
  const [toastMessage, setToastMessage] = useState<ToastState | null>(null);

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
    const targetSection = resolveWorkspaceForUser(user);
    setActiveSection(targetSection);
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
              const oauthIntent = sessionStorage.getItem('delivere_oauth_intent');
              const isInviteRoute =
                window.location.pathname.startsWith('/invite') ||
                urlParams.has('token') ||
                urlParams.has('invite_token') ||
                urlParams.has('invitation');

              const pendingInvite =
                sessionStorage.getItem('delivere_pending_invite_token') ||
                urlParams.get('token') ||
                urlParams.get('invite_token') ||
                urlParams.get('invitation') ||
                inviteToken;

              const isInvitationMode = (oauthIntent === 'invitation' || isInviteRoute) && Boolean(pendingInvite);
              const targetEndpoint = isInvitationMode ? '/api/auth/supabase-google' : '/api/auth/login-with-google';

              const reqPayload: any = {
                supabaseAccessToken: accessToken,
              };
              if (isInvitationMode) {
                reqPayload.invitationToken = pendingInvite;
              }

              const res = await fetch(targetEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reqPayload),
              });

              sessionStorage.removeItem('delivere_oauth_intent');

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
                console.warn('Backend OAuth exchange notice:', data?.error);
                await supabase.auth.signOut();
                if (data?.code === 'INVALID_INVITATION_TOKEN' || data?.code === 'REGISTRATION_GATED' || data?.code === 'USER_NOT_FOUND') {
                  sessionStorage.removeItem('delivere_pending_invite_token');
                  localStorage.removeItem('delivere_pending_invite_token');
                  setInviteToken(null);
                } else if (pendingInvite) {
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
            const targetSection = resolveWorkspaceForUser(savedSession.user);
            setActiveSection(targetSection);
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
                const targetSection = resolveWorkspaceForUser(verified.user);
                setActiveSection(targetSection);
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
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.message || 'حدث خطأ أثناء حفظ الطلبية في قاعدة البيانات', 'error');
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
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.message || 'حدث خطأ أثناء حفظ الطلبية السريعة', 'error');
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
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.message || 'حدث خطأ أثناء استيراد الدفعة', 'error');
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

  const handleExitImpersonation = () => {
    if (impersonatingAdmin) {
      setCurrentUser(impersonatingAdmin);
      storeDelivereSession(impersonatingAdmin, `delivere_jwt_${impersonatingAdmin.id}`);
      setImpersonatingAdmin(null);
      setActiveSection('super_admin_hub');
      showToast('تم إنهاء وضع المعاينة والعودة لحساب المدير العام (Super Admin)', 'success');
    }
  };

  const handleSelectUserForLogin = (targetUser: User) => {
    if (currentUser?.role === 'SUPER_ADMIN' && !impersonatingAdmin) {
      setImpersonatingAdmin(currentUser);
    }
    setCurrentUser(targetUser);
    storeDelivereSession(targetUser, `delivere_jwt_${targetUser.id}`);
    showToast(`تم الدخول في وضع المعاينة بحساب (${targetUser.name}) - ${targetUser.roleName || targetUser.role}`, 'success');
    const resolvedSec = resolveWorkspaceForUser(targetUser);
    setActiveSection(resolvedSec);
  };

  // 1. Session & Auth Verification Spinner
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 font-sans" dir="rtl">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-300">جاري التحقق من الجلسة والصلاحيات...</p>
      </div>
    );
  }

  // 2. Unauthenticated Boundary
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
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
          onOpenInvite={(token) => setInviteToken(token)}
        />
        {toastMessage && (
          <div
            role="status"
            aria-live="polite"
            className={`fixed bottom-5 left-5 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-bold ${
              toastMessage.type === 'success'
                ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                : 'bg-rose-600 text-white shadow-rose-600/20'
            }`}
          >
            <span>{toastMessage.text}</span>
          </div>
        )}
      </>
    );
  }

  // 3. Authenticated Modular Product Shell
  return (
    <TenantBrandingProvider>
      <ProductShell
        activeSection={activeSection}
        onChangeSection={setActiveSection}
        currentUser={currentUser}
        impersonatingAdmin={impersonatingAdmin}
        onExitImpersonation={handleExitImpersonation}
        onLogout={handleLogout}
        onRefresh={fetchUsers}
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenTracking={() => setIsTrackingOpen(true)}
        onOpenRouteOptimizer={() => setIsRouteOptimizerOpen(true)}
        onOpenSchemaDoc={() => setIsSchemaModalOpen(true)}
        onOpenIntegrations={() => setIsIntegrationsOpen(true)}
        onDownloadBackup={handleDownloadBackup}
      >
        <WorkspaceViewResolver
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          currentUser={currentUser}
          allUsers={allUsers}
          merchants={merchants}
          drivers={drivers}
          orders={orders}
          stats={stats}
          isLoading={isLoading}
          pagination={pagination}
          setPagination={setPagination}
          permissions={permissions}
          viewMode={viewMode}
          setViewMode={setViewMode}
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
          selectedIds={selectedIds}
          fetchOrders={fetchOrders}
          fetchUsers={fetchUsers}
          handleAddUser={handleAddUser}
          handleUpdateUser={handleUpdateUser}
          handleChangeStatus={handleChangeStatus}
          handleAssignDriver={handleAssignDriver}
          handleBulkStatusChange={handleBulkStatusChange}
          handleBulkAssignDriver={handleBulkAssignDriver}
          handleBulkPrintWaybills={handleBulkPrintWaybills}
          handleExportCSV={handleExportCSV}
          handleToggleSelect={handleToggleSelect}
          handleToggleSelectAll={handleToggleSelectAll}
          handleClearSelection={handleClearSelection}
          handleLogout={handleLogout}
          showToast={showToast}
          setIsCreateModalOpen={setIsCreateModalOpen}
          setIsQuickModalOpen={setIsQuickModalOpen}
          setIsBatchModalOpen={setIsBatchModalOpen}
          setIsScannerOpen={setIsScannerOpen}
          setIsIntegrationsOpen={setIsIntegrationsOpen}
          setActiveOrderDetails={setActiveOrderDetails}
          setActiveWaybillOrders={setActiveWaybillOrders}
          onSelectUserForLogin={handleSelectUserForLogin}
        />
      </ProductShell>

      {/* Global Modals, Drawers & Toast Layer */}
      <GlobalOverlayLayer
        isCreateModalOpen={isCreateModalOpen}
        onCloseCreateModal={() => setIsCreateModalOpen(false)}
        onSubmitCreateOrder={handleCreateOrder}
        isQuickModalOpen={isQuickModalOpen}
        onCloseQuickModal={() => setIsQuickModalOpen(false)}
        onSubmitQuickOrder={handleQuickOrder}
        isBatchModalOpen={isBatchModalOpen}
        onCloseBatchModal={() => setIsBatchModalOpen(false)}
        onSubmitBatchImport={handleBatchImport}
        isScannerOpen={isScannerOpen}
        onCloseScanner={() => setIsScannerOpen(false)}
        onScanSuccess={fetchOrders}
        isTrackingOpen={isTrackingOpen}
        onCloseTracking={() => setIsTrackingOpen(false)}
        isRouteOptimizerOpen={isRouteOptimizerOpen}
        onCloseRouteOptimizer={() => setIsRouteOptimizerOpen(false)}
        onAppliedOptimization={fetchOrders}
        isIntegrationsOpen={isIntegrationsOpen}
        onCloseIntegrations={() => setIsIntegrationsOpen(false)}
        onOrderCreatedFromWebhook={() => {
          fetchOrders();
          showToast('تم استقبال وتوليد طلبية متجر إلكتروني بنجاح عبر Webhook!');
        }}
        isSchemaModalOpen={isSchemaModalOpen}
        onCloseSchemaModal={() => setIsSchemaModalOpen(false)}
        activeOrderDetails={activeOrderDetails}
        onCloseOrderDetails={() => setActiveOrderDetails(null)}
        onPrintSingleWaybill={(order) => {
          setActiveWaybillOrders([order]);
          setActiveOrderDetails(null);
        }}
        onChangeOrderStatus={handleChangeStatus}
        onAssignDriver={handleAssignDriver}
        onOpenCliqPayment={(order) => setCliqOrder(order)}
        activeWaybillOrders={activeWaybillOrders}
        onCloseWaybillModal={() => setActiveWaybillOrders(null)}
        cliqOrder={cliqOrder}
        onCloseCliqPayment={() => setCliqOrder(null)}
        onCliqSuccess={(updatedOrder) => {
          showToast(`تم توثيق دفع حوالة CliQ للشحنة (${updatedOrder.sequence}) بنجاح!`);
          setCliqOrder(null);
          fetchOrders();
          if (activeOrderDetails && activeOrderDetails.id === updatedOrder.id) {
            setActiveOrderDetails(updatedOrder);
          }
        }}
        merchants={merchants}
        drivers={drivers}
        currentUser={currentUser}
        onAddNewUser={handleAddUser}
        toastMessage={toastMessage}
        onCloseToast={() => setToastMessage(null)}
      />
    </TenantBrandingProvider>
  );
}

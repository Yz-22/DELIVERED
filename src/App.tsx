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
import { AuthLoginModal } from './components/AuthLoginModal';
import { CliqPaymentModal } from './components/CliqPaymentModal';
import { OperationsDashboardGrid } from './components/OperationsDashboardGrid';
import { UsersManagement } from './components/UsersManagement';
import { ManifestsStatements } from './components/ManifestsStatements';
import { StaffPortal } from './components/StaffPortal';
import { AccessDeniedView } from './components/AccessDeniedView';
import { Order, OrderStatus, User, Role, OrdersQueryResponse } from './types/logistics';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export default function App() {
  // Primary Navigation Section: Operations, Driver Mobile, Financial Settlements, Merchant Portal, Reverse Logistics
  const [activeSection, setActiveSection] = useState<AppSection>('operations');

  // Navigation & View Mode within Operations
  const [viewMode, setViewMode] = useState<'grid' | 'kanban' | 'kpi'>('grid');

  // Authentication & Current User Session
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [cliqOrder, setCliqOrder] = useState<Order | null>(null);

  // Active User Role & RBAC Security Matrix
  const currentRole: Role = currentUser?.role || 'ADMIN';

  const permissions = useMemo(() => {
    switch (currentRole) {
      case 'ADMIN':
        return {
          allowedSections: [
            'operations_grid',
            'operations',
            'manifests',
            'users',
            'staff_portal',
            'driver_portal',
            'merchant_portal',
            'settlements',
            'reverse_logistics',
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
        return {
          allowedSections: [
            'staff_portal',
            'operations_grid',
            'operations',
            'manifests',
            'reverse_logistics',
          ] as AppSection[],
          canManageUsers: false, // Strict RBAC: Protected from OPERATOR
          canAccessReverseLogistics: true, // Warehouse operator handles return shelving
          canBulkStatusChange: true,
          canBulkAssignDriver: true,
          canCreateOrder: true,
          canExportCSV: true,
          canAccessFinancials: false,
        };
      case 'MERCHANT':
        return {
          allowedSections: ['merchant_portal', 'settlements'] as AppSection[],
          canManageUsers: false, // Strict RBAC: Hidden from MERCHANT
          canAccessReverseLogistics: false, // Strict RBAC: Hidden from MERCHANT
          canBulkStatusChange: false, // Merchants cannot alter operational statuses in bulk
          canBulkAssignDriver: false, // Merchants cannot assign drivers in bulk
          canCreateOrder: true,
          canExportCSV: true,
          canAccessFinancials: true,
        };
      case 'DRIVER':
        return {
          allowedSections: ['driver_portal'] as AppSection[],
          canManageUsers: false, // Strict RBAC: Hidden from DRIVER
          canAccessReverseLogistics: false, // Strict RBAC: Hidden from DRIVER
          canBulkStatusChange: false, // Driver only changes status inside their own mobile portal
          canBulkAssignDriver: false, // Cannot dispatch/assign drivers
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
        return 'بوابة التاجر والخدمة الذاتية';
      case 'settlements':
        return 'التسويات والحسابات المالية';
      case 'reverse_logistics':
        return 'اللوجستيات العكسية ومستودع المرتجعات';
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

  // Fetch Users
  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data: User[] = await res.json();
        setAllUsers(data);
        setMerchants(data.filter((u) => u.role === 'MERCHANT'));
        setDrivers(data.filter((u) => u.role === 'DRIVER'));
        if (!currentUser && data.length > 0) {
          const admin = data.find((u) => u.role === 'ADMIN') || data[0];
          setCurrentUser(admin);
        }
      }
    } catch (e) {
      console.error('Error fetching users:', e);
    }
  };

  const handleSelectUser = (user: User) => {
    setCurrentUser(user);
    if (user.role === 'DRIVER') {
      setActiveSection('driver_portal');
      showToast(`تم التبديل إلى بوابة الكابتن: ${user.name}`);
    } else if (user.role === 'MERCHANT') {
      setActiveSection('merchant_portal');
      showToast(`تم التبديل إلى بوابة التاجر: ${user.name}`);
    } else if (user.role === 'OPERATOR') {
      setActiveSection('staff_portal');
      showToast(`تم التبديل إلى بوابة موظف العمليات والفرز: ${user.name}`);
    } else {
      setActiveSection('operations_grid');
      showToast(`تم تسجيل الدخول بصلاحيات مدير العمليات: ${user.name}`);
    }
  };

  const handleQuickRoleSwitch = (targetRole: Role) => {
    const foundUser = allUsers.find((u) => u.role === targetRole);
    if (foundUser) {
      handleSelectUser(foundUser);
    } else {
      const fallbackUser: User = {
        id: `sim-${targetRole.toLowerCase()}`,
        name:
          targetRole === 'ADMIN'
            ? 'باسل البلبيسي (مدير العمليات)'
            : targetRole === 'OPERATOR'
            ? 'أنس الرواشدة (مسؤول الفرز والمستودع)'
            : targetRole === 'MERCHANT'
            ? 'متجر سحر الشرق للأزياء'
            : 'أحمد خليل (كابتن توصيل)',
        email: `${targetRole.toLowerCase()}@dargo-tms.io`,
        phone: '0795551234',
        role: targetRole,
        commercialName: targetRole === 'MERCHANT' ? 'سحر الشرق فاشن' : undefined,
        priceList: 'جميع المملكة 2',
        branch: 'فرع عمان الرئيسي',
        city: 'عمان',
        isActive: true,
      };
      handleSelectUser(fallbackUser);
    }
  };

  const handleAddUser = async (newUserData: Partial<User>) => {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUserData),
      });
      if (res.ok) {
        await fetchUsers();
        showToast('تمت إضافة المستخدم وتحديد الصلاحية وقائمة الأسعار بنجاح');
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
      }
    } catch (e) {
      console.error(e);
      showToast('خطأ في إضافة المستخدم', 'error');
    }
  };

  const handleUpdateUser = async (id: string, updatedData: Partial<User>) => {
    try {
      await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });
    } catch (e) {
      console.error(e);
    }
    setAllUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ...updatedData } : u))
    );
    setMerchants((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ...updatedData } : u))
    );
    setDrivers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ...updatedData } : u))
    );
    showToast('تم حفظ تعديلات المستخدم والصلاحيات');
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

      const res = await fetch(`/api/orders?${queryParams.toString()}`);
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
    pagination.page,
    pagination.limit,
    searchQuery,
    statusFilter,
    governorateFilter,
    driverFilter,
    merchantFilter,
  ]);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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

  return (
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
        onOpenAuthLogin={() => setIsAuthModalOpen(true)}
        onQuickRoleSwitch={handleQuickRoleSwitch}
        onDownloadBackup={handleDownloadBackup}
      />

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
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onSelectUserToSimulate={handleSelectUser}
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
      />

      <QuickOrderModal
        isOpen={isQuickModalOpen}
        onClose={() => setIsQuickModalOpen(false)}
        onSubmit={handleQuickOrder}
        merchants={merchants}
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

      {/* Auth & RBAC Session Modal */}
      <AuthLoginModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onSelectUser={handleSelectUser}
        allUsers={allUsers}
        onLogout={() => {
          setCurrentUser(null);
          showToast('تم تسجيل الخروج');
        }}
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
  );
}

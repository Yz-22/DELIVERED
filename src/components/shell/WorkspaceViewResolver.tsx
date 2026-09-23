import React from 'react';
import { User, Order, OrderStatus, Role } from '../../types/logistics';
import { AppSection } from '../TopNavbar';

// Workspaces
import { SuperAdminMasterHub } from '../SuperAdminMasterHub';
import { OperationsDashboardGrid } from '../OperationsDashboardGrid';
import { OperationsHeader } from '../OperationsHeader';
import { ToolbarFilter } from '../ToolbarFilter';
import { OrdersDataGrid } from '../OrdersDataGrid';
import { KanbanBoard } from '../KanbanBoard';
import { KpiSummaryView } from '../KpiSummaryView';
import { ManifestsStatements } from '../ManifestsStatements';
import { UsersManagement } from '../UsersManagement';
import { StaffPortal } from '../StaffPortal';
import { DriverPortal } from '../DriverPortal';
import { FinancialSettlements } from '../FinancialSettlements';
import { MerchantPortal } from '../MerchantPortal';
import { ReverseLogistics } from '../ReverseLogistics';
import { AdminSettings } from '../AdminSettings';
import { MerchantBranches } from '../MerchantBranches';
import { CashierWorkspace } from '../CashierWorkspace';
import { ReportsAndStatements } from '../ReportsAndStatements';
import { AccessDeniedView } from '../AccessDeniedView';

export interface WorkspaceViewResolverProps {
  activeSection: AppSection | null;
  setActiveSection: (section: AppSection) => void;
  currentUser: User;
  allUsers: User[];
  merchants: User[];
  drivers: User[];
  orders: Order[];
  stats: any;
  isLoading: boolean;
  pagination: any;
  setPagination: React.Dispatch<React.SetStateAction<any>>;
  permissions: {
    canManageUsers: boolean;
    canCreateOrder: boolean;
    canBulkStatusChange: boolean;
    canBulkAssignDriver: boolean;
    canExportCSV: boolean;
    canAccessFinancials: boolean;
    canAccessReverseLogistics: boolean;
    allowedSections: AppSection[];
  };

  // Operations filter & view state
  viewMode: 'grid' | 'kanban' | 'kpi';
  setViewMode: (mode: 'grid' | 'kanban' | 'kpi') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  governorateFilter: string;
  setGovernorateFilter: (g: string) => void;
  driverFilter: string;
  setDriverFilter: (d: string) => void;
  merchantFilter: string;
  setMerchantFilter: (m: string) => void;
  groupBy: 'none' | 'status' | 'governorate' | 'merchant' | 'driver';
  setGroupBy: (g: 'none' | 'status' | 'governorate' | 'merchant' | 'driver') => void;
  selectedIds: string[];

  // Action callbacks
  fetchOrders: () => void;
  fetchUsers: () => Promise<void>;
  handleAddUser: (data: Partial<User>) => Promise<User | null>;
  handleUpdateUser: (id: string, data: Partial<User>) => Promise<void>;
  handleChangeStatus: (orderId: string, status: OrderStatus, note?: string) => Promise<void>;
  handleAssignDriver: (orderId: string, driverId: string) => Promise<void>;
  handleBulkStatusChange: (status: OrderStatus) => Promise<void>;
  handleBulkAssignDriver: (driverId: string) => Promise<void>;
  handleBulkPrintWaybills: () => void;
  handleExportCSV: () => void;
  handleToggleSelect: (id: string) => void;
  handleToggleSelectAll: () => void;
  handleClearSelection: () => void;
  handleLogout: () => Promise<void>;
  showToast: (text: string, type?: 'success' | 'error') => void;

  // Modals / Drawers Openers
  setIsCreateModalOpen: (open: boolean) => void;
  setIsQuickModalOpen: (open: boolean) => void;
  setIsBatchModalOpen: (open: boolean) => void;
  setIsScannerOpen: (open: boolean) => void;
  setIsIntegrationsOpen: (open: boolean) => void;
  setActiveOrderDetails: (order: Order | null) => void;
  setActiveWaybillOrders: (orders: Order[] | null) => void;

  // Super Admin impersonation handler
  onSelectUserForLogin: (targetUser: User) => void;
}

export const getSectionTitle = (section: AppSection | null): string => {
  switch (section) {
    case 'super_admin_hub':
      return 'مركز السوبر أدمن والاشتراكات';
    case 'operations_grid':
      return 'لوحة قيادة العمليات (Operations Matrix)';
    case 'operations':
      return 'جدول العمليات والطلبيات الشامل';
    case 'manifests':
      return 'كشوفات ومنافست التوزيع';
    case 'users':
      return 'إدارة المستخدمين وقوائم الأسعار والصلاحيات';
    case 'staff_portal':
      return 'بوابة موظف العمليات والفرز والمستودع';
    case 'driver_portal':
      return 'بوابة الكابتن وتوصيل الشحنات';
    case 'merchant_portal':
      return 'بوابة التاجر والخدمة الذاتية';
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

export const WorkspaceViewResolver: React.FC<WorkspaceViewResolverProps> = ({
  activeSection,
  setActiveSection,
  currentUser,
  allUsers,
  merchants,
  drivers,
  orders,
  stats,
  isLoading,
  pagination,
  setPagination,
  permissions,
  viewMode,
  setViewMode,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  governorateFilter,
  setGovernorateFilter,
  driverFilter,
  setDriverFilter,
  merchantFilter,
  setMerchantFilter,
  groupBy,
  setGroupBy,
  selectedIds,
  fetchOrders,
  fetchUsers,
  handleAddUser,
  handleUpdateUser,
  handleChangeStatus,
  handleAssignDriver,
  handleBulkStatusChange,
  handleBulkAssignDriver,
  handleBulkPrintWaybills,
  handleExportCSV,
  handleToggleSelect,
  handleToggleSelectAll,
  handleClearSelection,
  handleLogout,
  showToast,
  setIsCreateModalOpen,
  setIsQuickModalOpen,
  setIsBatchModalOpen,
  setIsScannerOpen,
  setIsIntegrationsOpen,
  setActiveOrderDetails,
  setActiveWaybillOrders,
  onSelectUserForLogin,
}) => {
  const currentRole = currentUser?.role;
  const isSuperAdmin = currentRole === 'SUPER_ADMIN';

  const defaultHomeSection = permissions.allowedSections[0] || null;
  const homeSectionName = defaultHomeSection ? getSectionTitle(defaultHomeSection) : 'تسجيل الخروج';
  const handleNavigateHome = () => {
    if (defaultHomeSection) {
      setActiveSection(defaultHomeSection);
    } else {
      handleLogout();
    }
  };

  return (
    <>
      {/* 1. Super Admin Master Hub & Subscriptions Management */}
      {activeSection === 'super_admin_hub' && (
        permissions.allowedSections.includes('super_admin_hub') ? (
          isSuperAdmin ? (
            <SuperAdminMasterHub
              users={allUsers}
              currentUser={currentUser}
              onRefresh={fetchUsers}
              onSelectUserForLogin={onSelectUserForLogin}
              showToast={showToast}
            />
          ) : (
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
              <SuperAdminMasterHub
                users={allUsers}
                currentUser={currentUser}
                onRefresh={fetchUsers}
                onSelectUserForLogin={onSelectUserForLogin}
                showToast={showToast}
              />
            </main>
          )
        ) : (
          <AccessDeniedView
            sectionTitle="مركز السوبر أدمن وإدارة الاشتراكات"
            requiredRole="المدير العام للنظام (SUPER_ADMIN)"
            currentRole={currentRole}
            onNavigateHome={handleNavigateHome}
            homeSectionName={homeSectionName}
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
              onViewOrderDetails={(order) => setActiveOrderDetails(order)}
              onRefresh={fetchOrders}
              isLoading={isLoading}
            />
          </main>
        ) : (
          <AccessDeniedView
            sectionTitle="لوحة مؤشرات العمليات (Operations Matrix)"
            requiredRole="إدارة العمليات والفرز (ADMIN / OPERATOR)"
            currentRole={currentRole}
            onNavigateHome={handleNavigateHome}
            homeSectionName={homeSectionName}
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
                  onPageChange={(page) => setPagination((prev: any) => ({ ...prev, page }))}
                  onLimitChange={(limit) => setPagination((prev: any) => ({ ...prev, limit, page: 1 }))}
                  groupBy={groupBy}
                  isLoading={isLoading}
                  userRole={currentUser?.role}
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
            onNavigateHome={handleNavigateHome}
            homeSectionName={homeSectionName}
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
            onNavigateHome={handleNavigateHome}
            homeSectionName={homeSectionName}
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
            onNavigateHome={handleNavigateHome}
            homeSectionName={homeSectionName}
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
            onNavigateHome={handleNavigateHome}
            homeSectionName={homeSectionName}
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
            onNavigateHome={handleNavigateHome}
            homeSectionName={homeSectionName}
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
            onNavigateHome={handleNavigateHome}
            homeSectionName={homeSectionName}
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
            onNavigateHome={handleNavigateHome}
            homeSectionName={homeSectionName}
          />
        )
      )}

      {/* 10. Reverse Logistics & Warehouse Shelving */}
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
            onNavigateHome={handleNavigateHome}
            homeSectionName={homeSectionName}
          />
        )
      )}

      {/* 11. Admin Settings & Pricing */}
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
            onNavigateHome={handleNavigateHome}
            homeSectionName={homeSectionName}
          />
        )
      )}

      {/* 12. Merchant Multi-Branch & Stock Transfer */}
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
            onNavigateHome={handleNavigateHome}
            homeSectionName={homeSectionName}
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
            onNavigateHome={handleNavigateHome}
            homeSectionName={homeSectionName}
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
            onNavigateHome={handleNavigateHome}
            homeSectionName={homeSectionName}
          />
        )
      )}

      {/* 15. Fail-Closed Fallback Access Denied for Unknown / Unauthorized Workspace */}
      {(!activeSection || permissions.allowedSections.length === 0 || !permissions.allowedSections.includes(activeSection)) && (
        <AccessDeniedView
          sectionTitle="منظومة التحكم والوصول الآمن (Delivere Security Matrix)"
          requiredRole="حساب معتمد ومفعل داخل منظومة ديليفري"
          currentRole={(currentRole || 'غير محدد') as Role}
          onNavigateHome={handleLogout}
          homeSectionName="تسجيل الخروج والعودة لتسجيل الدخول"
        />
      )}
    </>
  );
};

import React, { useState, ReactNode } from 'react';
import { AppSection } from '../TopNavbar';
import { User } from '../../types/logistics';
import { SuperAdminSidebar } from './SuperAdminSidebar';
import { SuperAdminTopBar } from './SuperAdminTopBar';

interface SuperAdminShellProps {
  activeSection: AppSection | null;
  onChangeSection: (section: AppSection) => void;
  currentUser: User;
  onLogout?: () => void;
  onRefresh?: () => void;
  onOpenScanner?: () => void;
  onOpenTracking?: () => void;
  onOpenRouteOptimizer?: () => void;
  onOpenSchemaDoc?: () => void;
  onOpenIntegrations?: () => void;
  onDownloadBackup?: () => void;
  isRefreshing?: boolean;
  children: ReactNode;
}

export const SuperAdminShell: React.FC<SuperAdminShellProps> = ({
  activeSection,
  onChangeSection,
  currentUser,
  onLogout,
  onRefresh,
  onOpenScanner,
  onOpenTracking,
  onOpenRouteOptimizer,
  onOpenSchemaDoc,
  onOpenIntegrations,
  onDownloadBackup,
  isRefreshing = false,
  children,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950"
      dir="rtl"
    >
      {/* 1. Super Admin Right-Side RTL Sidebar */}
      <SuperAdminSidebar
        activeSection={activeSection}
        onChangeSection={onChangeSection}
        currentUser={currentUser}
        onLogout={onLogout}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        onOpenScanner={onOpenScanner}
        onOpenTracking={onOpenTracking}
        onOpenIntegrations={onOpenIntegrations}
        onOpenSchemaDoc={onOpenSchemaDoc}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* 2. Main Content Canvas with dynamic right margin to offset sidebar on desktop */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${
          isCollapsed ? 'lg:mr-[74px]' : 'lg:mr-[260px]'
        }`}
      >
        {/* TopBar */}
        <SuperAdminTopBar
          activeSection={activeSection}
          onChangeSection={onChangeSection}
          currentUser={currentUser}
          onLogout={onLogout}
          onRefresh={onRefresh}
          onOpenMobileMenu={() => setIsMobileOpen(true)}
          onOpenScanner={onOpenScanner}
          onOpenTracking={onOpenTracking}
          onDownloadBackup={onDownloadBackup}
          isRefreshing={isRefreshing}
        />

        {/* Page Content Body */}
        <main className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

import React, { useState, ReactNode } from 'react';
import { User } from '../../types/logistics';
import { AppSection } from '../TopNavbar';
import { GlobalHeader } from './GlobalHeader';
import { WorkspaceNavigation } from './WorkspaceNavigation';
import { MobileNavigation } from './MobileNavigation';
import { ImpersonationBanner } from '../superadmin/ImpersonationBanner';
import { SuperAdminShell } from '../superadmin/SuperAdminShell';

export interface ProductShellProps {
  activeSection: AppSection | null;
  onChangeSection: (section: AppSection) => void;
  currentUser: User;
  impersonatingAdmin?: User | null;
  onExitImpersonation?: () => void;
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

export const ProductShell: React.FC<ProductShellProps> = ({
  activeSection,
  onChangeSection,
  currentUser,
  impersonatingAdmin,
  onExitImpersonation,
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950"
      dir="rtl"
    >
      {/* 1. Impersonation Banner */}
      {impersonatingAdmin && onExitImpersonation && (
        <ImpersonationBanner
          impersonatedUser={currentUser}
          onExitImpersonation={onExitImpersonation}
        />
      )}

      {/* 2. SuperAdmin Dedicated Shell vs Modular Operating System Shell */}
      {isSuperAdmin ? (
        <SuperAdminShell
          activeSection={activeSection}
          onChangeSection={onChangeSection}
          currentUser={currentUser}
          onLogout={onLogout}
          onRefresh={onRefresh}
          onOpenScanner={onOpenScanner}
          onOpenTracking={onOpenTracking}
          onOpenRouteOptimizer={onOpenRouteOptimizer}
          onOpenSchemaDoc={onOpenSchemaDoc}
          onOpenIntegrations={onOpenIntegrations}
          onDownloadBackup={onDownloadBackup}
          isRefreshing={isRefreshing}
        >
          {children}
        </SuperAdminShell>
      ) : (
        <div className="flex-1 flex flex-col min-h-screen">
          {/* Global Sticky Header */}
          <GlobalHeader
            activeSection={activeSection}
            onChangeSection={onChangeSection}
            currentUser={currentUser}
            onOpenScanner={onOpenScanner}
            onOpenTracking={onOpenTracking}
            onOpenRouteOptimizer={onOpenRouteOptimizer}
            onOpenSchemaDoc={onOpenSchemaDoc}
            onOpenIntegrations={onOpenIntegrations}
            onDownloadBackup={onDownloadBackup}
            onLogout={onLogout}
            onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
            isMobileMenuOpen={isMobileMenuOpen}
          />

          {/* Desktop Workspace Navigation Bar */}
          <WorkspaceNavigation
            activeSection={activeSection}
            onChangeSection={onChangeSection}
            currentUser={currentUser}
          />

          {/* Mobile Navigation Drawer & Quick Sub-bar */}
          <MobileNavigation
            isOpen={isMobileMenuOpen}
            onClose={() => setIsMobileMenuOpen(false)}
            activeSection={activeSection}
            onChangeSection={onChangeSection}
            currentUser={currentUser}
            onLogout={onLogout}
            onOpenScanner={onOpenScanner}
            onOpenTracking={onOpenTracking}
            onOpenSchemaDoc={onOpenSchemaDoc}
            onOpenIntegrations={onOpenIntegrations}
            onDownloadBackup={onDownloadBackup}
          />

          {/* Active Workspace View Canvas */}
          <div className="flex-1 flex flex-col">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { User } from '../types/logistics';
import { GlobalHeader } from './shell/GlobalHeader';
import { WorkspaceNavigation } from './shell/WorkspaceNavigation';
import { MobileNavigation } from './shell/MobileNavigation';

export type AppSection =
  | 'super_admin_hub'
  | 'operations_grid'
  | 'operations'
  | 'manifests'
  | 'users'
  | 'staff_portal'
  | 'driver_portal'
  | 'merchant_portal'
  | 'settlements'
  | 'reverse_logistics'
  | 'settings'
  | 'merchant_branches'
  | 'cashier_workspace'
  | 'reports_statements';

export interface TopNavbarProps {
  activeSection: AppSection | null;
  onChangeSection: (section: AppSection) => void;
  onOpenScanner?: () => void;
  onOpenTracking?: () => void;
  onOpenRouteOptimizer?: () => void;
  onOpenSchemaDoc?: () => void;
  onOpenIntegrations?: () => void;
  currentUser?: User | null;
  onLogout?: () => void;
  onDownloadBackup?: () => void;
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
  onLogout,
  onDownloadBackup,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex flex-col select-none">
      {/* 1. Global Sticky Header */}
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

      {/* 2. Desktop Horizontal Navigation Tabs */}
      <WorkspaceNavigation
        activeSection={activeSection}
        onChangeSection={onChangeSection}
        currentUser={currentUser}
      />

      {/* 3. Mobile Navigation Drawer & Sub-bar */}
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
    </div>
  );
};

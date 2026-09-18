import React, { ReactNode } from 'react';
import { TopNavbar, AppSection } from '../TopNavbar';
import { User } from '../../types/logistics';
import { WORKSPACE_METADATA } from '../../lib/workspaceResolver';

interface AppShellProps {
  currentUser: User;
  activeSection: AppSection;
  onChangeSection: (section: AppSection) => void;
  onOpenScanner: () => void;
  onOpenTracking: () => void;
  onOpenRouteOptimizer: () => void;
  onOpenSchemaDoc: () => void;
  onOpenIntegrations?: () => void;
  onLogout: () => void;
  onDownloadBackup?: () => void;
  children: ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentUser,
  activeSection,
  onChangeSection,
  onOpenScanner,
  onOpenTracking,
  onOpenRouteOptimizer,
  onOpenSchemaDoc,
  onOpenIntegrations,
  onLogout,
  onDownloadBackup,
  children,
}) => {
  const meta = WORKSPACE_METADATA[activeSection];

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950" dir="rtl">
      {/* Top Navbar Component */}
      <TopNavbar
        activeSection={activeSection}
        onChangeSection={onChangeSection}
        onOpenScanner={onOpenScanner}
        onOpenTracking={onOpenTracking}
        onOpenRouteOptimizer={onOpenRouteOptimizer}
        onOpenSchemaDoc={onOpenSchemaDoc}
        onOpenIntegrations={onOpenIntegrations}
        currentUser={currentUser}
        onLogout={onLogout}
        onDownloadBackup={onDownloadBackup}
      />

      {/* Main Content Area with Deliberate Surface Canvas */}
      <main className="flex-1 flex flex-col w-full">
        {children}
      </main>
    </div>
  );
};

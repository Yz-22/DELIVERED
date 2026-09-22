import React, { ReactNode } from 'react';
import { User } from '../../types/logistics';
import { AppSection } from '../TopNavbar';
import { ProductShell } from './ProductShell';

export interface AppShellProps {
  currentUser: User;
  activeSection: AppSection | null;
  onChangeSection: (section: AppSection) => void;
  onOpenScanner?: () => void;
  onOpenTracking?: () => void;
  onOpenRouteOptimizer?: () => void;
  onOpenSchemaDoc?: () => void;
  onOpenIntegrations?: () => void;
  onLogout?: () => void;
  onDownloadBackup?: () => void;
  children: ReactNode;
}

export const AppShell: React.FC<AppShellProps> = (props) => {
  return <ProductShell {...props} />;
};

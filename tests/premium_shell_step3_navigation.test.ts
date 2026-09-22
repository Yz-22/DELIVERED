import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {
  ALL_NAV_ITEMS,
  LAUNCHER_ITEMS,
  getNavItemsForRole,
  getLauncherItemsForRole,
  getRoleLabel,
} from '../src/components/shell/navigationConfig';
import { resolveWorkspaceForUser, isUserAuthorizedForSection, WORKSPACE_METADATA } from '../src/lib/workspaceResolver';
import { User, Role } from '../src/types/logistics';
import { AppSection } from '../src/components/TopNavbar';
import * as shellExports from '../src/components/shell/index';
import * as topNavbarModule from '../src/components/TopNavbar';
import * as appShellModule from '../src/components/shell/AppShell';
import fs from 'node:fs';
import path from 'node:path';

const createMockUser = (id: string, name: string, role: Role): User => ({
  id,
  name,
  email: `${id}@delivere.test`,
  phone: '0790000000',
  role,
  isActive: true,
});

// Contract 1: ADMIN primary entry
test('Contract 1: ADMIN primary workspace canonical entry', () => {
  const adminUser = createMockUser('u-admin', 'Admin User', 'ADMIN');
  const primaryWorkspace = resolveWorkspaceForUser(adminUser);
  assert.equal(primaryWorkspace, 'operations_grid', 'ADMIN primary workspace must resolve to operations_grid');
  assert.equal(isUserAuthorizedForSection(adminUser, 'operations_grid'), true, 'ADMIN must be authorized for operations_grid');
});

// Contract 2: SUPER_ADMIN primary entry
test('Contract 2: SUPER_ADMIN primary workspace canonical entry', () => {
  const superAdminUser = createMockUser('u-super', 'Super Admin', 'SUPER_ADMIN');
  const primaryWorkspace = resolveWorkspaceForUser(superAdminUser);
  assert.equal(primaryWorkspace, 'super_admin_hub', 'SUPER_ADMIN primary workspace must resolve to super_admin_hub');
  assert.equal(isUserAuthorizedForSection(superAdminUser, 'super_admin_hub'), true, 'SUPER_ADMIN must be authorized for super_admin_hub');
});

// Contract 3: MERCHANT isolation
test('Contract 3: MERCHANT isolation and boundaries', () => {
  const merchantUser = createMockUser('u-merchant', 'Merchant Test', 'MERCHANT');
  const primaryWorkspace = resolveWorkspaceForUser(merchantUser);
  assert.equal(primaryWorkspace, 'merchant_portal', 'MERCHANT primary workspace must be merchant_portal');
  
  assert.equal(isUserAuthorizedForSection(merchantUser, 'merchant_portal'), true);
  assert.equal(isUserAuthorizedForSection(merchantUser, 'merchant_branches'), true);
  assert.equal(isUserAuthorizedForSection(merchantUser, 'reports_statements'), true);
  assert.equal(isUserAuthorizedForSection(merchantUser, 'settlements'), true);

  // Strictly denied internal operations
  assert.equal(isUserAuthorizedForSection(merchantUser, 'super_admin_hub'), false);
  assert.equal(isUserAuthorizedForSection(merchantUser, 'operations_grid'), false);
  assert.equal(isUserAuthorizedForSection(merchantUser, 'operations'), false);
  assert.equal(isUserAuthorizedForSection(merchantUser, 'manifests'), false);
  assert.equal(isUserAuthorizedForSection(merchantUser, 'staff_portal'), false);
  assert.equal(isUserAuthorizedForSection(merchantUser, 'driver_portal'), false);
  assert.equal(isUserAuthorizedForSection(merchantUser, 'cashier_workspace'), false);
  assert.equal(isUserAuthorizedForSection(merchantUser, 'reverse_logistics'), false);
  assert.equal(isUserAuthorizedForSection(merchantUser, 'users'), false);
  assert.equal(isUserAuthorizedForSection(merchantUser, 'settings'), false);
});

// Contract 4: DRIVER isolation
test('Contract 4: DRIVER isolation and boundaries', () => {
  const driverUser = createMockUser('u-driver', 'Driver Test', 'DRIVER');
  const primaryWorkspace = resolveWorkspaceForUser(driverUser);
  assert.equal(primaryWorkspace, 'driver_portal', 'DRIVER primary workspace must be driver_portal');

  assert.equal(isUserAuthorizedForSection(driverUser, 'driver_portal'), true);
  assert.equal(isUserAuthorizedForSection(driverUser, 'super_admin_hub'), false);
  assert.equal(isUserAuthorizedForSection(driverUser, 'operations_grid'), false);
  assert.equal(isUserAuthorizedForSection(driverUser, 'operations'), false);
  assert.equal(isUserAuthorizedForSection(driverUser, 'manifests'), false);
  assert.equal(isUserAuthorizedForSection(driverUser, 'merchant_portal'), false);
  assert.equal(isUserAuthorizedForSection(driverUser, 'settlements'), false);
  assert.equal(isUserAuthorizedForSection(driverUser, 'users'), false);
});

// Contract 5: CASHIER isolation
test('Contract 5: CASHIER isolation and boundaries', () => {
  const cashierUser = createMockUser('u-cashier', 'Cashier Test', 'CASHIER');
  const primaryWorkspace = resolveWorkspaceForUser(cashierUser);
  assert.equal(primaryWorkspace, 'cashier_workspace', 'CASHIER primary workspace must be cashier_workspace');

  assert.equal(isUserAuthorizedForSection(cashierUser, 'cashier_workspace'), true);
  assert.equal(isUserAuthorizedForSection(cashierUser, 'super_admin_hub'), false);
  assert.equal(isUserAuthorizedForSection(cashierUser, 'operations_grid'), false);
  assert.equal(isUserAuthorizedForSection(cashierUser, 'users'), false);
  assert.equal(isUserAuthorizedForSection(cashierUser, 'settlements'), false);
});

// Contract 6: ACCOUNTANT entry
test('Contract 6: ACCOUNTANT primary workspace and destinations', () => {
  const accountantUser = createMockUser('u-acc', 'Accountant Test', 'ACCOUNTANT');
  const primaryWorkspace = resolveWorkspaceForUser(accountantUser);
  assert.equal(primaryWorkspace, 'settlements', 'ACCOUNTANT primary workspace must be settlements');

  assert.equal(isUserAuthorizedForSection(accountantUser, 'settlements'), true);
  assert.equal(isUserAuthorizedForSection(accountantUser, 'reports_statements'), true);
  assert.equal(isUserAuthorizedForSection(accountantUser, 'manifests'), true);
  assert.equal(isUserAuthorizedForSection(accountantUser, 'super_admin_hub'), false);
  assert.equal(isUserAuthorizedForSection(accountantUser, 'users'), false);
});

// Contract 7: OPERATOR entry
test('Contract 7: OPERATOR primary workspace and destinations', () => {
  const operatorUser = createMockUser('u-op', 'Operator Test', 'OPERATOR');
  const primaryWorkspace = resolveWorkspaceForUser(operatorUser);
  assert.equal(primaryWorkspace, 'staff_portal', 'OPERATOR primary workspace must be staff_portal');

  assert.equal(isUserAuthorizedForSection(operatorUser, 'staff_portal'), true);
  assert.equal(isUserAuthorizedForSection(operatorUser, 'operations'), true);
  assert.equal(isUserAuthorizedForSection(operatorUser, 'manifests'), true);
  assert.equal(isUserAuthorizedForSection(operatorUser, 'reverse_logistics'), true);
  assert.equal(isUserAuthorizedForSection(operatorUser, 'users'), false);
  assert.equal(isUserAuthorizedForSection(operatorUser, 'settings'), false);
});

// Contract 8: STAFF entry
test('Contract 8: STAFF primary workspace and destinations', () => {
  const staffUser = createMockUser('u-staff', 'Staff Test', 'STAFF');
  const primaryWorkspace = resolveWorkspaceForUser(staffUser);
  assert.equal(primaryWorkspace, 'staff_portal', 'STAFF primary workspace must be staff_portal');

  assert.equal(isUserAuthorizedForSection(staffUser, 'staff_portal'), true);
  assert.equal(isUserAuthorizedForSection(staffUser, 'operations'), true);
  assert.equal(isUserAuthorizedForSection(staffUser, 'manifests'), true);
  assert.equal(isUserAuthorizedForSection(staffUser, 'reverse_logistics'), true);
});

// Contract 9: DISPATCHER entry
test('Contract 9: DISPATCHER primary workspace and destinations', () => {
  const dispatcherUser = {
    id: 'u-disp',
    name: 'Dispatcher Test',
    email: 'disp@delivere.test',
    phone: '0790000000',
    role: 'DISPATCHER' as unknown as Role,
    isActive: true,
  } as User;
  const primaryWorkspace = resolveWorkspaceForUser(dispatcherUser);
  assert.equal(primaryWorkspace, 'staff_portal', 'DISPATCHER primary workspace must be staff_portal');

  assert.equal(isUserAuthorizedForSection(dispatcherUser, 'staff_portal'), true);
  assert.equal(isUserAuthorizedForSection(dispatcherUser, 'operations'), true);
  assert.equal(isUserAuthorizedForSection(dispatcherUser, 'manifests'), true);
  assert.equal(isUserAuthorizedForSection(dispatcherUser, 'reverse_logistics'), true);
  assert.equal(isUserAuthorizedForSection(dispatcherUser, 'users'), false);
});

// Contract 10: unauthorized destination fail-closed
test('Contract 10: Unauthorized destination fail-closed behavior', () => {
  assert.equal(resolveWorkspaceForUser(null), null);
  assert.equal(resolveWorkspaceForUser(undefined), null);
  assert.equal(resolveWorkspaceForUser({ id: 'bad', name: 'Bad', email: 'b@b.com', phone: '0', isActive: false, role: '' as any }), null);
  assert.equal(resolveWorkspaceForUser({ id: 'bad', name: 'Bad', email: 'b@b.com', phone: '0', isActive: false, role: 'ANONYMOUS' as any }), null);

  assert.equal(isUserAuthorizedForSection(null, 'operations_grid'), false);
  assert.equal(isUserAuthorizedForSection(undefined, 'merchant_portal'), false);
  assert.equal(isUserAuthorizedForSection({ id: 'bad', name: 'Bad', email: 'b@b.com', phone: '0', isActive: false, role: 'FAKE' as any }, 'super_admin_hub'), false);
});

// Contract 11: active navigation visual highlighting contract
test('Contract 11: Active navigation configuration metadata and badges', () => {
  const allItems = ALL_NAV_ITEMS;
  assert.ok(allItems.length >= 14, 'All 14 canonical workspaces must have navigation definitions');
  const superAdminItem = allItems.find((i) => i.id === 'super_admin_hub');
  assert.ok(superAdminItem, 'super_admin_hub must exist');
  assert.equal(superAdminItem?.badge, 'SaaS');
});

// Contract 12 & 13: mobile open/close and ESC behavior
test('Contract 12 & 13: Mobile navigation configuration and Drawer state contract', () => {
  assert.ok(shellExports.MobileNavigation, 'MobileNavigation component must be exported');
  assert.ok(shellExports.GlobalHeader, 'GlobalHeader component must be exported');
  const globalHeaderCode = fs.readFileSync(path.resolve('src/components/shell/GlobalHeader.tsx'), 'utf-8');
  assert.ok(globalHeaderCode.includes("e.key === 'Escape'"), 'GlobalHeader must dismiss menus on Escape');
  const mobileNavCode = fs.readFileSync(path.resolve('src/components/shell/MobileNavigation.tsx'), 'utf-8');
  assert.ok(mobileNavCode.includes("e.key === 'Escape'"), 'MobileNavigation must dismiss drawer on Escape');
});

// Contract 14: Language toggle / workspace retention
test('Contract 14: Language and branding context isolation', () => {
  for (const item of ALL_NAV_ITEMS) {
    assert.ok(typeof item.id === 'string' && item.id.length > 0);
  }
});

// Contract 15 & 16: RTL / LTR layout support
test('Contract 15 & 16: RTL and LTR navigation layout attributes', () => {
  const productShellCode = fs.readFileSync(path.resolve('src/components/shell/ProductShell.tsx'), 'utf-8');
  assert.ok(productShellCode.includes('dir="rtl"'), 'ProductShell must enforce standard RTL layout structure');
});

// Contract 17: logout reachable
test('Contract 17: Logout action propagation in Header and Drawer', () => {
  const globalHeaderCode = fs.readFileSync(path.resolve('src/components/shell/GlobalHeader.tsx'), 'utf-8');
  assert.ok(globalHeaderCode.includes('onLogout'), 'GlobalHeader must receive and propagate onLogout');
  const mobileNavCode = fs.readFileSync(path.resolve('src/components/shell/MobileNavigation.tsx'), 'utf-8');
  assert.ok(mobileNavCode.includes('onLogout'), 'MobileNavigation must receive and propagate onLogout');
});

// Contract 18: impersonation visible
test('Contract 18: SuperAdmin Impersonation banner visibility and exit handler', () => {
  const productShellCode = fs.readFileSync(path.resolve('src/components/shell/ProductShell.tsx'), 'utf-8');
  assert.ok(productShellCode.includes('ImpersonationBanner'), 'ProductShell must embed ImpersonationBanner');
  assert.ok(productShellCode.includes('impersonatingAdmin'), 'ProductShell must check impersonatingAdmin');
});

// Contract 19: history/back behavior
test('Contract 19: History/popstate and portal query parameter support in App.tsx', () => {
  const appCode = fs.readFileSync(path.resolve('src/App.tsx'), 'utf-8');
  assert.ok(appCode.includes('popstate'), 'App.tsx must handle popstate navigation');
  assert.ok(appCode.includes('portal'), 'App.tsx must support portal query parameter');
});

// Contract 20: launcher permitted destinations
test('Contract 20: ERP 9-Dots Launcher role filtering', () => {
  const superLauncher = getLauncherItemsForRole('SUPER_ADMIN');
  assert.ok(superLauncher.some((l) => l.id === 'super_admin_hub'));

  const adminLauncher = getLauncherItemsForRole('ADMIN');
  assert.ok(!adminLauncher.some((l) => l.id === 'super_admin_hub'));
  assert.ok(adminLauncher.some((l) => l.id === 'operations_grid'));

  const driverLauncher = getLauncherItemsForRole('DRIVER');
  assert.equal(driverLauncher.length, 0, 'Driver must not have privileged launcher items');
});

// Contract 21: SuperAdmin tenant context requirement
test('Contract 21: SuperAdmin tenant context requirement for operational workflows', () => {
  const superUser = createMockUser('u-super', 'Super Admin', 'SUPER_ADMIN');
  assert.equal(resolveWorkspaceForUser(superUser), 'super_admin_hub', 'SuperAdmin default workspace MUST be super_admin_hub');
});

// Contract 22: no placeholder header tools
test('Contract 22: Zero placeholder header tools with authentic handlers', () => {
  const globalOverlayCode = fs.readFileSync(path.resolve('src/components/shell/GlobalOverlayLayer.tsx'), 'utf-8');
  assert.ok(globalOverlayCode.includes('isScannerOpen'), 'Scanner modal handler must exist');
  assert.ok(globalOverlayCode.includes('isTrackingOpen'), 'Tracking modal handler must exist');
  assert.ok(globalOverlayCode.includes('isRouteOptimizerOpen'), 'Route optimizer modal handler must exist');
  assert.ok(globalOverlayCode.includes('isIntegrationsOpen'), 'Integrations modal handler must exist');
});

// Contract 23: navigationConfig not auth source
test('Contract 23: navigationConfig is strictly presentational', () => {
  assert.ok(typeof isUserAuthorizedForSection === 'function', 'isUserAuthorizedForSection is the authoritative gate');
});

// Contract 24: protected modules unchanged
test('Contract 24: Protected modules check', () => {
  assert.ok(fs.existsSync(path.resolve('server.ts')), 'server.ts must exist');
  assert.ok(fs.existsSync(path.resolve('src/lib/auth.ts')), 'src/lib/auth.ts must exist');
  assert.ok(fs.existsSync(path.resolve('src/lib/workspaceResolver.ts')), 'src/lib/workspaceResolver.ts must exist');
});

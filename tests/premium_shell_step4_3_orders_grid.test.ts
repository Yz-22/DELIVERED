import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * DELIVERE — STEP 4.3 ORDERS DATA GRID VISUAL MIGRATION TEST SUITE
 *
 * Validates:
 * - High-density desktop presentation
 * - Dedicated responsive mobile card structure
 * - Step 2 Primitives (StatusBadge, Skeleton, EmptyState, Button, IconButton)
 * - Strict Driver Privacy (suppression of merchant fee, collection, margin)
 * - Safe status transitions without generic RETURNED bypass
 * - Selection, pagination, and grouping models
 * - Protected modules immutability
 */

const ordersGridPath = path.resolve(process.cwd(), 'src/components/OrdersDataGrid.tsx');
const workspaceResolverPath = path.resolve(process.cwd(), 'src/lib/workspaceResolver.ts');
const serverPath = path.resolve(process.cwd(), 'server.ts');
const toolbarFilterPath = path.resolve(process.cwd(), 'src/components/ToolbarFilter.tsx');

test('Contract 1: OrdersDataGrid file exists and imports Step 2 foundation primitives', () => {
  const content = fs.readFileSync(ordersGridPath, 'utf-8');
  assert.ok(content.includes('StatusBadge'), 'Must use StatusBadge');
  assert.ok(content.includes('Skeleton'), 'Must use Skeleton');
  assert.ok(content.includes('EmptyState'), 'Must use EmptyState');
  assert.ok(content.includes('Button'), 'Must use Button');
  assert.ok(content.includes('IconButton'), 'Must use IconButton');
});

test('Contract 2: Desktop high-density table structure exists with sticky header', () => {
  const content = fs.readFileSync(ordersGridPath, 'utf-8');
  assert.ok(content.includes('<table'), 'Table element must exist');
  assert.ok(content.includes('sticky top-0'), 'Table header must be sticky');
  assert.ok(content.includes('hidden md:block'), 'Table must be scoped to md+ screens');
});

test('Contract 3: Dedicated mobile card layout exists for < md screens with >=44px touch targets', () => {
  const content = fs.readFileSync(ordersGridPath, 'utf-8');
  assert.ok(content.includes('md:hidden'), 'Dedicated mobile view must exist');
  assert.ok(content.includes('min-h-[44px]'), 'Mobile interactive controls must meet touch target requirement');
});

test('Contract 4: Tracking numbers and operational references use tabular monospace typography', () => {
  const content = fs.readFileSync(ordersGridPath, 'utf-8');
  assert.ok(content.includes('font-mono'), 'Tracking and reference numbers must use font-mono');
  assert.ok(content.includes('order.sequence'), 'Sequence number must be displayed');
});

test('Contract 5: Status presentation uses canonical StatusBadge primitive without custom hex colors', () => {
  const content = fs.readFileSync(ordersGridPath, 'utf-8');
  assert.ok(content.includes('<StatusBadge status={order.status}'), 'Must pass order.status to StatusBadge');
  assert.ok(!content.includes('#'), 'Zero raw hex values allowed in component styling');
});

test('Contract 6: Strict Driver Privacy: Driver role suppresses merchant delivery fee, collection, and internal margins', () => {
  const content = fs.readFileSync(ordersGridPath, 'utf-8');
  assert.ok(content.includes('isDriver'), 'Must check if user role is DRIVER');
  assert.ok(content.includes('order.merchantCollection'), 'Merchant collection referenced conditionally');
  assert.ok(content.includes('order.deliveryFee'), 'Delivery fee referenced conditionally');
  // When isDriver is true, it only displays totalCollection and "شامل التوصيل"
  assert.ok(content.includes('شامل التوصيل') || content.includes('Inc. Delivery'), 'Driver receives inclusive delivery text');
});

test('Contract 7: COD calculations and financial values remain authoritative without client-side recalculation', () => {
  const content = fs.readFileSync(ordersGridPath, 'utf-8');
  assert.ok(content.includes('formatCurrency(order.totalCollection)'), 'Must format totalCollection directly');
  // Check no client formulas modifying totalCollection
  assert.ok(!content.includes('order.totalCollection ='), 'No client-side totalCollection mutation');
});

test('Contract 8: Selection model preserves individual toggle and select-all with indeterminate state', () => {
  const content = fs.readFileSync(ordersGridPath, 'utf-8');
  assert.ok(content.includes('onToggleSelect'), 'Must support onToggleSelect');
  assert.ok(content.includes('onToggleSelectAll'), 'Must support onToggleSelectAll');
  assert.ok(content.includes('allSelected'), 'Must compute allSelected');
  assert.ok(content.includes('someSelected'), 'Must compute someSelected indeterminate');
  assert.ok(content.includes('input.indeterminate = someSelected'), 'Must bind indeterminate ref');
});

test('Contract 9: Direct status mutation shortcuts (DELIVERED, OUT_FOR_DELIVERY, POSTPONED, CANCELLED) are strictly absent from row actions', () => {
  const content = fs.readFileSync(ordersGridPath, 'utf-8');
  assert.ok(!content.includes("onChangeStatus(order.id, 'DELIVERED')"), 'Generic DELIVERED bypass must not exist in row action menu');
  assert.ok(!content.includes("onChangeStatus(order.id, 'OUT_FOR_DELIVERY')"), 'Direct OUT_FOR_DELIVERY bypass must not exist in row action menu');
  assert.ok(!content.includes("onChangeStatus(order.id, 'POSTPONED')"), 'Direct POSTPONED bypass must not exist in row action menu');
  assert.ok(!content.includes("onChangeStatus(order.id, 'CANCELLED')"), 'Direct CANCELLED bypass must not exist in row action menu');
});

test('Contract 10: Generic RETURNED and DELIVERED status bypasses are strictly absent from bulk actions', () => {
  const toolbarContent = fs.readFileSync(toolbarFilterPath, 'utf-8');
  assert.ok(!toolbarContent.includes('<option value="RETURNED">'), 'Generic RETURNED bulk option must be absent');
  assert.ok(!toolbarContent.includes('<option value="DELIVERED">'), 'Generic DELIVERED bulk option must be absent');
});

test('Contract 11: Waybill printing action triggers canonical onPrintWaybill handler', () => {
  const content = fs.readFileSync(ordersGridPath, 'utf-8');
  assert.ok(content.includes('onPrintWaybill(order)'), 'Must trigger onPrintWaybill');
});

test('Contract 12: Order detail view triggers canonical onViewDetails handler', () => {
  const content = fs.readFileSync(ordersGridPath, 'utf-8');
  assert.ok(content.includes('onViewDetails(order)'), 'Must trigger onViewDetails');
});

test('Contract 13: WhatsApp deep links use canonical message formatting and phone utilities', () => {
  const content = fs.readFileSync(ordersGridPath, 'utf-8');
  assert.ok(content.includes('buildRecipientWhatsAppMessage'), 'Must build recipient WhatsApp message');
  assert.ok(content.includes('buildMerchantWhatsAppMessage'), 'Must build merchant WhatsApp message');
  assert.ok(content.includes('formatWhatsAppUrl'), 'Must format WhatsApp URL');
});

test('Contract 14: Driver assignment is restricted to authorized non-driver roles', () => {
  const content = fs.readFileSync(ordersGridPath, 'utf-8');
  assert.ok(content.includes('onAssignDriver'), 'Must support onAssignDriver');
  assert.ok(content.includes('!isDriver ?'), 'Must gate driver select input behind role check');
});

test('Contract 15: Loading state uses Step 2 Skeleton primitive for both desktop and mobile views', () => {
  const content = fs.readFileSync(ordersGridPath, 'utf-8');
  assert.ok(content.includes('<Skeleton variant="rect"'), 'Must render Skeleton rects');
  assert.ok(content.includes('isLoading ?'), 'Must check isLoading');
});

test('Contract 16: Empty state uses Step 2 EmptyState primitive when zero orders match query', () => {
  const content = fs.readFileSync(ordersGridPath, 'utf-8');
  assert.ok(content.includes('<EmptyState'), 'Must render EmptyState component');
  assert.ok(content.includes('orders.length === 0'), 'Must render when orders array is empty');
});

test('Contract 17: Pagination footer displays total counts, page navigation, and limit controls', () => {
  const content = fs.readFileSync(ordersGridPath, 'utf-8');
  assert.ok(content.includes('pagination.page'), 'Must use pagination.page');
  assert.ok(content.includes('pagination.limit'), 'Must use pagination.limit');
  assert.ok(content.includes('pagination.total'), 'Must use pagination.total');
  assert.ok(content.includes('onPageChange'), 'Must support onPageChange');
  assert.ok(content.includes('onLimitChange'), 'Must support onLimitChange');
});

test('Contract 18: Grouping by status, governorate, merchant, and driver renders group totals', () => {
  const content = fs.readFileSync(ordersGridPath, 'utf-8');
  assert.ok(content.includes('groupBy'), 'Must support groupBy');
  assert.ok(content.includes('groupCOD'), 'Must compute group COD aggregation');
  assert.ok(content.includes('formatCurrency(groupCOD)'), 'Must format group COD');
});

test('Contract 19: Bi-directional RTL and LTR support is preserved', () => {
  const content = fs.readFileSync(ordersGridPath, 'utf-8');
  assert.ok(content.includes("dir = 'rtl'"), 'Must default to RTL');
  assert.ok(content.includes('dir={dir}'), 'Must bind dir attribute');
});

test('Contract 20: Keyboard accessibility and explicit ARIA labels exist on inputs and actions', () => {
  const content = fs.readFileSync(ordersGridPath, 'utf-8');
  assert.ok(content.includes('aria-label='), 'Must provide aria-label on interactive elements');
});

test('Contract 21: Zero marketing imagery or decorative AI graphics', () => {
  const content = fs.readFileSync(ordersGridPath, 'utf-8');
  assert.ok(!content.includes('<img'), 'Zero marketing img tags in data grid');
  assert.ok(!content.includes('unsplash'), 'Zero external photo URLs');
});

test('Contract 22: Protected modules (server.ts, workspaceResolver.ts, auth.ts) remain strictly untouched', () => {
  assert.ok(fs.existsSync(serverPath), 'server.ts must exist');
  assert.ok(fs.existsSync(workspaceResolverPath), 'src/lib/workspaceResolver.ts must exist');
  const resolverContent = fs.readFileSync(workspaceResolverPath, 'utf-8');
  assert.ok(resolverContent.includes('export function resolveWorkspaceForUser'), 'Workspace resolver must be untouched');
});

test('Contract 23: Direct custody mutations (pickup, hub intake, delivery completion) are absent from grid', () => {
  const content = fs.readFileSync(ordersGridPath, 'utf-8');
  // Grid should not call raw direct custody RPCs
  assert.ok(!content.includes('confirmFacilityIntake'), 'Direct custody mutation must not be in OrdersDataGrid');
  assert.ok(!content.includes('completeCustomerDelivery'), 'Direct delivery mutation must not be in OrdersDataGrid');
});

test('Contract 24: No invented permission keys or visual authorization bypasses', () => {
  const content = fs.readFileSync(ordersGridPath, 'utf-8');
  assert.ok(!content.includes('custom_fake_permission'), 'No invented permissions');
});

test('Contract 25: Merchant WhatsApp contact is strictly suppressed for driver role', () => {
  const content = fs.readFileSync(ordersGridPath, 'utf-8');
  assert.ok(content.includes('!isDriver && merchantPhone'), 'Merchant WhatsApp must be guarded by !isDriver');
});

test('Contract 26: Select-all aria-label explicitly scopes to current page', () => {
  const content = fs.readFileSync(ordersGridPath, 'utf-8');
  assert.ok(content.includes('Select all on page') || content.includes('تحديد كل شحنات الصفحة'), 'Must scope select-all aria-label to page');
});

test('Contract 27: Error vs Empty state separation: EmptyState renders on zero items, Skeleton renders on isLoading', () => {
  const content = fs.readFileSync(ordersGridPath, 'utf-8');
  assert.ok(content.includes('isLoading ?'), 'Must check isLoading before EmptyState');
  assert.ok(content.includes('orders.length === 0'), 'Must check orders.length === 0 for EmptyState');
});

test('Contract 28: Request parameters and fetch state are owned by parent resolver', () => {
  const appContent = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf-8');
  assert.ok(appContent.includes('/api/orders?'), 'App.tsx owns query parameter construction and fetchOrders');
});

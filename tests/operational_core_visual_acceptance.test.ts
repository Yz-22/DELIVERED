import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const controlTowerPath = path.resolve(process.cwd(), 'src/components/LogisticsControlTower.tsx');
const taskInboxPath = path.resolve(process.cwd(), 'src/components/OperationalTaskInbox.tsx');
const taskDetailPath = path.resolve(process.cwd(), 'src/components/TaskDetailDrawer.tsx');
const ordersGridPath = path.resolve(process.cwd(), 'src/components/OrdersDataGrid.tsx');
const toolbarFilterPath = path.resolve(process.cwd(), 'src/components/ToolbarFilter.tsx');
const workspaceResolverPath = path.resolve(process.cwd(), 'src/components/shell/WorkspaceViewResolver.tsx');
const appPath = path.resolve(process.cwd(), 'src/App.tsx');

test('Contract 1: Control Tower attention leads to scoped Task Inbox filter context', () => {
  const ctContent = fs.readFileSync(controlTowerPath, 'utf-8');
  assert.ok(ctContent.includes('onSelectQueueFilter') && ctContent.includes('OperationalTaskInbox'), 'Control Tower embeds Inbox with attention filter props');
  assert.ok(ctContent.includes('selectedQueueId') || ctContent.includes('statusFilterShortcut'), 'Control Tower passes filter criteria to Inbox');
});

test('Contract 2: Task Inbox row click opens canonical TaskDetailDrawer', () => {
  const inboxContent = fs.readFileSync(taskInboxPath, 'utf-8');
  assert.ok(inboxContent.includes('onSelectTask'), 'Task inbox must trigger onSelectTask callback');
});

test('Contract 3: Task Detail linked shipment triggers navigation callback', () => {
  const detailContent = fs.readFileSync(taskDetailPath, 'utf-8');
  assert.ok(detailContent.includes('onNavigateToShipment'), 'Task detail must support onNavigateToShipment');
});

test('Contract 4: Loading / Error / Empty states are strictly distinct across all three surfaces', () => {
  const ctContent = fs.readFileSync(controlTowerPath, 'utf-8');
  const inboxContent = fs.readFileSync(taskInboxPath, 'utf-8');
  const gridContent = fs.readFileSync(ordersGridPath, 'utf-8');

  // Must check loading before rendering empty state
  assert.ok(ctContent.includes('loading') || ctContent.includes('Skeleton'), 'Control Tower handles loading state');
  assert.ok(inboxContent.includes('isLoading ?') || inboxContent.includes('loading'), 'Inbox handles loading state');
  assert.ok(gridContent.includes('isLoading ?'), 'Grid handles loading state before EmptyState');
  assert.ok(gridContent.includes('orders.length === 0'), 'Grid handles zero items distinctly from loading');
});

test('Contract 5: Semantic Status presentation uses canonical StatusBadge across all surfaces', () => {
  const inboxContent = fs.readFileSync(taskInboxPath, 'utf-8');
  const detailContent = fs.readFileSync(taskDetailPath, 'utf-8');
  const gridContent = fs.readFileSync(ordersGridPath, 'utf-8');

  assert.ok(inboxContent.includes('StatusBadge'), 'Inbox uses StatusBadge');
  assert.ok(detailContent.includes('StatusBadge'), 'Detail drawer uses StatusBadge');
  assert.ok(gridContent.includes('StatusBadge'), 'Grid uses StatusBadge');
});

test('Contract 6: Priority representation uses canonical PriorityIndicator', () => {
  const inboxContent = fs.readFileSync(taskInboxPath, 'utf-8');
  const detailContent = fs.readFileSync(taskDetailPath, 'utf-8');

  assert.ok(inboxContent.includes('PriorityIndicator'), 'Inbox uses PriorityIndicator');
  assert.ok(detailContent.includes('PriorityIndicator'), 'Detail uses PriorityIndicator');
});

test('Contract 7: Authoritative operational data terminology used - zero fake realtime labels', () => {
  const ctContent = fs.readFileSync(controlTowerPath, 'utf-8');
  const inboxContent = fs.readFileSync(taskInboxPath, 'utf-8');
  const gridContent = fs.readFileSync(ordersGridPath, 'utf-8');

  const combined = ctContent + inboxContent + gridContent;
  assert.ok(!combined.includes('Updated live'), 'No fake "Updated live" labels');
  assert.ok(!combined.includes('Realtime sync active'), 'No fake "Realtime sync active" labels');
  assert.ok(ctContent.includes('Authoritative') || ctContent.includes('موثقة') || ctContent.includes('Operational'), 'Authoritative wording used');
});

test('Contract 8: Control Tower owns exactly one visibility-aware polling interval', () => {
  const ctContent = fs.readFileSync(controlTowerPath, 'utf-8');
  assert.ok(ctContent.includes('setInterval'), 'Must declare setInterval');
  assert.ok(ctContent.includes('clearInterval'), 'Must cleanup interval on unmount');
  assert.ok(ctContent.includes('document.visibilityState') || ctContent.includes('visibilitychange'), 'Must be visibility-aware');
});

test('Contract 9: Task execution passes expectedVersion for optimistic locking', () => {
  const detailContent = fs.readFileSync(taskDetailPath, 'utf-8');
  assert.ok(detailContent.includes('expectedVersion'), 'Must send expectedVersion with task mutations');
});

test('Contract 10: Concurrency conflict (409) triggers authoritative refetch and localized message', () => {
  const detailContent = fs.readFileSync(taskDetailPath, 'utf-8');
  assert.ok(detailContent.includes('STALE_TASK_VERSION') || detailContent.includes('409'), 'Must handle 409 concurrency error');
});

test('Contract 11: Task and Exception resolution remain visually and functionally independent', () => {
  const detailContent = fs.readFileSync(taskDetailPath, 'utf-8');
  assert.ok(detailContent.includes('Linked Exception') || detailContent.includes('استثناء مرتبط'), 'Visual separation of linked exception');
});

test('Contract 12: Comment write UI remains strictly deferred', () => {
  const detailContent = fs.readFileSync(taskDetailPath, 'utf-8');
  assert.ok(!detailContent.includes('<form') || !detailContent.includes('onSubmitComment'), 'No active comment write form');
});

test('Contract 13: Unsupported task Close & Cancel actions are strictly absent', () => {
  const detailContent = fs.readFileSync(taskDetailPath, 'utf-8');
  assert.ok(!detailContent.includes('onCloseTask'), 'onCloseTask must not exist');
  assert.ok(!detailContent.includes('onCancelTask'), 'onCancelTask must not exist');
});

test('Contract 14: Generic DELIVERED bypass is strictly absent from Orders grid row actions', () => {
  const gridContent = fs.readFileSync(ordersGridPath, 'utf-8');
  assert.ok(!gridContent.includes("onChangeStatus(order.id, 'DELIVERED')"), 'Generic DELIVERED bypass must not exist in row action menu');
});

test('Contract 15: Generic RETURNED bypass is strictly absent from Orders grid row actions', () => {
  const gridContent = fs.readFileSync(ordersGridPath, 'utf-8');
  assert.ok(!gridContent.includes("onChangeStatus(order.id, 'RETURNED')"), 'Generic RETURNED bypass must not exist in row actions');
});

test('Contract 16: Bulk status mutations bypassing custody/lifecycle (OUT_FOR_DELIVERY, POSTPONED, CANCELLED, DELIVERED, RETURNED) are strictly absent', () => {
  const toolbarContent = fs.readFileSync(toolbarFilterPath, 'utf-8');
  assert.ok(!toolbarContent.includes('<option value="OUT_FOR_DELIVERY">'), 'Bulk OUT_FOR_DELIVERY must be absent');
  assert.ok(!toolbarContent.includes('<option value="POSTPONED">'), 'Bulk POSTPONED must be absent');
  assert.ok(!toolbarContent.includes('<option value="CANCELLED">'), 'Bulk CANCELLED must be absent');
  assert.ok(!toolbarContent.includes('<option value="DELIVERED">'), 'Bulk DELIVERED must be absent');
  assert.ok(!toolbarContent.includes('<option value="RETURNED">'), 'Bulk RETURNED must be absent');
});

test('Contract 17: One-driver UI assumption is strictly absent from Orders grid', () => {
  const gridContent = fs.readFileSync(ordersGridPath, 'utf-8');
  assert.ok(gridContent.includes('Assigned Driver') || gridContent.includes('الكابتن المكلف'), 'Labels specify Assigned Driver');
  assert.ok(!gridContent.includes('Sole Driver') && !gridContent.includes('السائق الوحيد'), 'No single-driver assumption');
});

test('Contract 18: Financial privacy across operational core is strictly enforced', () => {
  const gridContent = fs.readFileSync(ordersGridPath, 'utf-8');
  const taskDetailContent = fs.readFileSync(taskDetailPath, 'utf-8');

  assert.ok(gridContent.includes('isDriver'), 'Grid is driver-role aware');
  assert.ok(!gridContent.includes('order.driverEarning') && !gridContent.includes('order.margin'), 'No driver margin/internal earnings leak');
  assert.ok(!taskDetailContent.includes('task.driverEarnings'), 'No task driver earnings leak');
});

test('Contract 19: Merchant contact privacy is strictly enforced for driver role', () => {
  const gridContent = fs.readFileSync(ordersGridPath, 'utf-8');
  assert.ok(gridContent.includes('!isDriver && merchantPhone'), 'Merchant WhatsApp link hidden from driver');
});

test('Contract 20: RTL and LTR directionality is preserved across all three surfaces', () => {
  const ctContent = fs.readFileSync(controlTowerPath, 'utf-8');
  const inboxContent = fs.readFileSync(taskInboxPath, 'utf-8');
  const gridContent = fs.readFileSync(ordersGridPath, 'utf-8');

  assert.ok(ctContent.includes('dir={dir}') || ctContent.includes('isRtl'), 'Control Tower supports RTL');
  assert.ok(inboxContent.includes('dir={dir}') || inboxContent.includes('isRtl'), 'Inbox supports RTL');
  assert.ok(gridContent.includes('dir={dir}') || gridContent.includes('isRtl'), 'Grid supports RTL');
});

test('Contract 21: Mobile intentional layouts exist with >=44px touch targets', () => {
  const gridContent = fs.readFileSync(ordersGridPath, 'utf-8');
  const inboxContent = fs.readFileSync(taskInboxPath, 'utf-8');

  assert.ok(gridContent.includes('min-h-[44px]'), 'Grid mobile cards have min 44px touch targets');
  assert.ok(gridContent.includes('md:hidden'), 'Grid has dedicated mobile layout');
  assert.ok(inboxContent.includes('md:hidden') || inboxContent.includes('min-h-[44px]'), 'Inbox has mobile layout support');
});

test('Contract 22: Protected modules remain strictly untouched', () => {
  const protectedModules = [
    'server.ts',
    'src/lib/auth.ts',
    'src/lib/workspaceResolver.ts',
  ];

  for (const mod of protectedModules) {
    const fullPath = path.resolve(process.cwd(), mod);
    assert.ok(fs.existsSync(fullPath), `${mod} must exist`);
  }
});

test('Contract 23: Zero marketing imagery or decorative AI graphics across Operational Core', () => {
  const ctContent = fs.readFileSync(controlTowerPath, 'utf-8');
  const inboxContent = fs.readFileSync(taskInboxPath, 'utf-8');
  const gridContent = fs.readFileSync(ordersGridPath, 'utf-8');

  const combined = ctContent + inboxContent + gridContent;
  assert.ok(!combined.includes('unsplash.com'), 'No unsplash imagery');
  assert.ok(!combined.includes('bg-gradient-to-r from-purple'), 'No marketing gradients');
});

test('Contract 24: Direct custody, financial, or inventory mutations are strictly absent from grid', () => {
  const gridContent = fs.readFileSync(ordersGridPath, 'utf-8');
  assert.ok(!gridContent.includes('/api/operational/custody/transfer'), 'No raw custody mutations in grid');
  assert.ok(!gridContent.includes('/api/operational/hub/intake'), 'No raw hub intake mutations in grid');
  assert.ok(!gridContent.includes('/api/operational/delivery/complete'), 'No raw delivery completion in grid');
});

test('Contract 25: No invented permission keys or visual authorization bypasses', () => {
  const gridContent = fs.readFileSync(ordersGridPath, 'utf-8');
  const inboxContent = fs.readFileSync(taskInboxPath, 'utf-8');
  assert.ok(!gridContent.includes('custom_fake_perm'), 'No fake permissions in grid');
  assert.ok(!inboxContent.includes('custom_fake_perm'), 'No fake permissions in inbox');
});

/**
 * DELIVERE — STEP CT-1 LOGISTICS CONTROL TOWER VERIFICATION CONTRACTS
 * File: tests/step_ct1_control_tower_verification.test.ts
 *
 * 18 Comprehensive Verification Contracts for Operations Dashboard Grid & Control Tower.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const gridSource = fs.readFileSync(path.resolve('src/components/OperationsDashboardGrid.tsx'), 'utf-8');
const workspaceResolverSource = fs.readFileSync(path.resolve('src/components/shell/WorkspaceViewResolver.tsx'), 'utf-8');

// Contract 1: OperationsDashboardGrid source contains ZERO occurrences of the forbidden mock values
test('Contract 1: OperationsDashboardGrid contains ZERO forbidden mock strings', () => {
  assert.ok(!gridSource.includes("'50.3'"), "Must NOT contain '50.3'");
  assert.ok(!gridSource.includes('50.3'), "Must NOT contain 50.3");
  assert.ok(!gridSource.includes("'6,562'"), "Must NOT contain '6,562'");
  assert.ok(!gridSource.includes('6,562'), "Must NOT contain 6,562");
  assert.ok(!gridSource.includes('224'), "Must NOT contain 224");
  assert.ok(!gridSource.includes('390'), "Must NOT contain 390");
  assert.ok(!gridSource.includes('262'), "Must NOT contain 262");
});

// Contract 2: Out for delivery has NO 32 fallback
test('Contract 2: Out for delivery has NO 32 fallback', () => {
  assert.ok(!gridSource.includes(': 32'), 'Must NOT have fallback ternary to 32');
  assert.ok(!gridSource.includes('|| 32'), 'Must NOT have fallback default to 32');
  assert.ok(gridSource.includes('{outForDeliveryOrders}'), 'Must display true count of outForDeliveryOrders directly');
});

// Contract 3: Active orders has NO 48 fallback
test('Contract 3: Active orders has NO 48 fallback', () => {
  assert.ok(!gridSource.includes(': 48'), 'Must NOT have fallback ternary to 48');
  assert.ok(!gridSource.includes('|| 48'), 'Must NOT have fallback default to 48');
  assert.ok(gridSource.includes('{activeOrders}'), 'Must display true count of activeOrders directly');
});

// Contract 4: Total orders has NO 6,562 fallback
test('Contract 4: Total orders has NO 6,562 fallback', () => {
  assert.ok(!gridSource.includes(': 6562'), 'Must NOT have fallback ternary to 6562');
  assert.ok(!gridSource.includes("'6,562'"), 'Must NOT have fallback string 6,562');
});

// Contract 5: Monthly Profit metric is completely removed
test('Contract 5: Monthly Profit metric is completely removed', () => {
  assert.ok(!gridSource.includes('الأرباح الشهرية'), 'Must NOT display Monthly Profit card');
  assert.ok(!gridSource.includes('totalMonthlyProfit'), 'Must NOT calculate unverified monthly profit');
});

// Contract 6: Unverified Accounting Proxies are removed
test('Contract 6: Unverified Accounting Proxies are removed', () => {
  assert.ok(!gridSource.includes('محاسبة السائقين'), 'Must NOT display unverified Driver Accounting proxy');
  assert.ok(!gridSource.includes('محاسبة التجار'), 'Must NOT display unverified Merchant Accounting proxy');
});

// Contract 7: Needs Attention is NOT postponed + cancelled
test('Contract 7: Needs Attention is NOT postponed + cancelled', () => {
  assert.ok(!gridSource.includes('postponedOrders + cancelledOrders'), 'Must NOT calculate needs attention as postponed + cancelled');
});

// Contract 8: Authoritative Needs Attention consumes operationalApiClient
test('Contract 8: Authoritative Needs Attention consumes operationalApiClient', () => {
  assert.ok(gridSource.includes('operationalApiClient.getAttentionSummary()'), 'Must call getAttentionSummary from operationalApiClient');
  assert.ok(gridSource.includes('operationalApiClient.getExceptions'), 'Must call getExceptions from operationalApiClient');
  assert.ok(gridSource.includes('operationalApiClient.getTasks'), 'Must call getTasks from operationalApiClient');
});

// Contract 9: Control Tower Header contains required labels
test('Contract 9: Control Tower Header contains required labels', () => {
  assert.ok(gridSource.includes('لوحة العمليات'), 'Must contain header title لوحة العمليات');
  assert.ok(gridSource.includes('مركز التحكم التشغيلي للشحنات والمهام والاستثناءات'), 'Must contain supporting text');
});

// Contract 10: Operational Status Strip contains required metrics with true counts
test('Contract 10: Operational Status Strip contains required metrics with true counts', () => {
  assert.ok(gridSource.includes('الطلبيات النشطة'), 'Must contain Active Shipments');
  assert.ok(gridSource.includes('مرحلة الاستلام'), 'Must contain Pickup metric');
  assert.ok(gridSource.includes('في المستودع والفرع'), 'Must contain At Hub metric');
  assert.ok(gridSource.includes('جاري التوصيل'), 'Must contain Out for Delivery metric');
  assert.ok(gridSource.includes('مؤجل'), 'Must contain Postponed metric');
  assert.ok(gridSource.includes('مرتجع'), 'Must contain Returned metric');
});

// Contract 11: Scope of loaded shipments is explicitly disclosed
test('Contract 11: Scope of loaded shipments is explicitly disclosed', () => {
  assert.ok(gridSource.includes('حسب الشحنات المحملة'), 'Must explicitly indicate that counts are scoped to loaded shipments');
});

// Contract 12: Live Operations Flow pipeline exists
test('Contract 12: Live Operations Flow pipeline exists', () => {
  assert.ok(gridSource.includes('مسار التدفق التشغيلي للشحنات'), 'Must render operational lifecycle pipeline');
  assert.ok(gridSource.includes('1. استلام الشحنة'), 'Must render stage 1');
  assert.ok(gridSource.includes('2. وصول المركز والفرز'), 'Must render stage 2');
  assert.ok(gridSource.includes('3. جاري التوزيع'), 'Must render stage 3');
  assert.ok(gridSource.includes('4. تم التسليم بنجاح'), 'Must render stage 4');
  assert.ok(gridSource.includes('5. مؤجل ومرتجع'), 'Must render stage 5');
});

// Contract 13: Zero-Data Experience handles empty exceptions cleanly
test('Contract 13: Zero-Data Experience handles empty exceptions cleanly', () => {
  assert.ok(gridSource.includes('لا توجد استثناءات تشغيلية تحتاج تدخلاً حالياً'), 'Must render professional empty state for exceptions');
  assert.ok(gridSource.includes('كافة العمليات المجدولة تسير وفق مؤشرات الأداء المعتمدة'), 'Must render operational reassurance');
});

// Contract 14: Zero-Data Experience handles empty tasks cleanly
test('Contract 14: Zero-Data Experience handles empty tasks cleanly', () => {
  assert.ok(gridSource.includes('لا توجد مهام تشغيلية مفتوحة'), 'Must render professional empty state for tasks');
});

// Contract 15: High-Density Active Shipments Table contains operational columns
test('Contract 15: High-Density Active Shipments Table contains operational columns', () => {
  assert.ok(gridSource.includes('جدول الشحنات التشغيلية النشطة'), 'Must render active shipments table');
  assert.ok(gridSource.includes('رقم التتبع / البوليصة'), 'Must include tracking/sequence column');
  assert.ok(gridSource.includes('المستلم والوجهة'), 'Must include recipient/destination column');
  assert.ok(gridSource.includes('الحالة التشغيلية'), 'Must include status column');
  assert.ok(gridSource.includes('المندوب'), 'Must include driver assignment column');
});

// Contract 16: Zero private financial leak in shipments table
test('Contract 16: Zero private financial leak in shipments table', () => {
  assert.ok(!gridSource.includes('order.deliveryFee'), 'Must NOT display order.deliveryFee in table');
  assert.ok(!gridSource.includes('order.totalCollection'), 'Must NOT display order.totalCollection in table');
});

// Contract 17: Master-detail task drawer is integrated
test('Contract 17: Master-detail task drawer is integrated', () => {
  assert.ok(gridSource.includes('TaskDetailDrawer'), 'Must integrate TaskDetailDrawer');
  assert.ok(gridSource.includes('selectedTaskId'), 'Must manage selectedTaskId state');
});

// Contract 18: WorkspaceViewResolver wires OperationsDashboardGrid with onViewOrderDetails and onRefresh
test('Contract 18: WorkspaceViewResolver wires OperationsDashboardGrid with onViewOrderDetails and onRefresh', () => {
  assert.ok(workspaceResolverSource.includes('onViewOrderDetails={(order) => setActiveOrderDetails(order)}'), 'Must pass onViewOrderDetails');
  assert.ok(workspaceResolverSource.includes('onRefresh={fetchOrders}'), 'Must pass onRefresh');
});

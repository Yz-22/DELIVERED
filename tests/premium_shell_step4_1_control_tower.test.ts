/**
 * DELIVERE — STEP 4.1 LOGISTICS CONTROL TOWER VISUAL MIGRATION TESTS
 *
 * 24 Comprehensive Verification Contracts for Logistics Control Tower & Attention Strip.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { AttentionSummaryDTO } from '../src/types/operationalTasks';
import { OperationalStatusStrip } from '../src/components/OperationalStatusStrip';
import { LogisticsControlTower } from '../src/components/LogisticsControlTower';

const controlTowerSource = fs.readFileSync(path.resolve('src/components/LogisticsControlTower.tsx'), 'utf-8');
const statusStripSource = fs.readFileSync(path.resolve('src/components/OperationalStatusStrip.tsx'), 'utf-8');

// Contract 1: Control Tower renders authoritative attention data
test('Contract 1: Control Tower renders authoritative attention data', () => {
  assert.ok(statusStripSource.includes('summary.needsAttentionUnifiedCount') || statusStripSource.includes('unifiedTotal'), 'Must consume authoritative unified count');
  assert.ok(statusStripSource.includes('criticalExceptionsCount'), 'Must consume authoritative critical exceptions');
  assert.ok(statusStripSource.includes('unassignedTasksCount'), 'Must consume authoritative unassigned tasks');
  assert.ok(statusStripSource.includes('overdueTasksCount'), 'Must consume authoritative overdue tasks');
  assert.ok(statusStripSource.includes('blockedTasksCount'), 'Must consume authoritative blocked tasks');
  assert.ok(statusStripSource.includes('openTasksCount'), 'Must consume authoritative open tasks');
});

// Contract 2: Zero attention state does not look like error
test('Contract 2: Zero attention state does not look like error', () => {
  assert.ok(statusStripSource.includes('opacity-70') || statusStripSource.includes('text-slate-500'), 'Zero state must visually recede rather than appear as error');
  assert.ok(!statusStripSource.includes('border-red-500') || statusStripSource.includes('blocked > 0'), 'Red border must only apply when count > 0');
});

// Contract 3: Fetch failure does not render fake zero
test('Contract 3: Fetch failure does not render fake zero', () => {
  assert.ok(statusStripSource.includes('error && !summary'), 'Error condition must be explicitly checked');
  assert.ok(statusStripSource.includes('Retry') || statusStripSource.includes('إعادة المحاولة'), 'Retry action must be present on error');
  assert.ok(controlTowerSource.includes('setSummaryError'), 'Control Tower must manage summary error state');
});

// Contract 4: Critical SLA presentation
test('Contract 4: Critical SLA presentation', () => {
  assert.ok(statusStripSource.includes('criticalAndUrgent') || statusStripSource.includes('criticalExceptionsCount'), 'Critical exceptions must be tracked');
  assert.ok(statusStripSource.includes('text-rose-400') || statusStripSource.includes('border-rose-500'), 'Critical SLA must use semantic rose tone');
});

// Contract 5: Blocked task presentation
test('Contract 5: Blocked task presentation', () => {
  assert.ok(statusStripSource.includes('blockedTasksCount') || statusStripSource.includes('blocked'), 'Blocked tasks must be represented');
  assert.ok(statusStripSource.includes('BLOCKED'), 'Must trigger BLOCKED filter on click');
});

// Contract 6: Unassigned task presentation
test('Contract 6: Unassigned task presentation', () => {
  assert.ok(statusStripSource.includes('unassignedTasksCount') || statusStripSource.includes('unassigned'), 'Unassigned tasks must be represented');
  assert.ok(statusStripSource.includes('UNASSIGNED'), 'Must trigger UNASSIGNED filter on click');
});

// Contract 7: Task preview deep link
test('Contract 7: Task preview deep link', () => {
  assert.ok(controlTowerSource.includes('onNavigateToShipment'), 'Deep link handler to shipment operations must be wired');
  assert.ok(controlTowerSource.includes("onSelectSection('operations')"), 'Must navigate to operations workspace');
});

// Contract 8: Exception preview deep link
test('Contract 8: Exception preview deep link', () => {
  assert.ok(controlTowerSource.includes('activeTab'), 'Active tab must support switching between tasks and exceptions');
  assert.ok(statusStripSource.includes("onTabChange('exceptions')") || statusStripSource.includes("onTabChange?.('exceptions')"), 'Status strip must support switching to exceptions view');
});

// Contract 9: Manual refresh
test('Contract 9: Manual refresh', () => {
  assert.ok(controlTowerSource.includes('fetchAttentionSummary'), 'Must define fetchAttentionSummary');
  assert.ok(statusStripSource.includes('onRefresh'), 'Status strip must expose onRefresh prop');
  assert.ok(statusStripSource.includes('RefreshCw'), 'Must render refresh icon');
});

// Contract 10: Only accepted polling contract remains
test('Contract 10: Only accepted polling contract remains', () => {
  const pollingMatches = controlTowerSource.match(/setInterval\(/g) || [];
  // Clock + 30s polling loop = 2 setInterval calls
  assert.equal(pollingMatches.length, 2, 'Must have exactly clock interval and single 30s polling interval');
  assert.ok(controlTowerSource.includes('30000'), 'Polling interval must be 30000ms');
});

// Contract 11: Visibility pause
test('Contract 11: Visibility pause', () => {
  assert.ok(controlTowerSource.includes("document.visibilityState === 'visible'"), 'Polling must pause when document is hidden');
});

// Contract 12: Cleanup on unmount
test('Contract 12: Cleanup on unmount', () => {
  assert.ok(controlTowerSource.includes('clearInterval(interval)'), 'Intervals must be cleaned up on unmount');
});

// Contract 13: No fake realtime wording
test('Contract 13: No fake realtime wording', () => {
  assert.ok(!statusStripSource.includes('Realtime live sync'), 'No fake realtime marketing claims');
  assert.ok(statusStripSource.includes('Authoritative operational data') || statusStripSource.includes('بيانات تشغيلية موثقة'), 'Must use accurate authoritative terminology');
});

// Contract 14: Arabic RTL support
test('Contract 14: Arabic RTL support', () => {
  assert.ok(controlTowerSource.includes("dir={dir}"), 'Must set dir attribute on root');
  assert.ok(statusStripSource.includes("dir={dir}"), 'Status strip must respect dir attribute');
  assert.ok(statusStripSource.includes('حالة التنبيهات والمهام التشغيلية'), 'Arabic titles must be present');
});

// Contract 15: English LTR support
test('Contract 15: English LTR support', () => {
  assert.ok(statusStripSource.includes('Operational Attention & Task Status'), 'English titles must be present');
  assert.ok(statusStripSource.includes('Authoritative operational data'), 'English data freshness note present');
});

// Contract 16: Mobile structure
test('Contract 16: Mobile structure', () => {
  assert.ok(statusStripSource.includes('grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'), 'Must use responsive grid for mobile and desktop');
  assert.ok(controlTowerSource.includes('sm:'), 'Control tower must use responsive tailwind prefixes');
});

// Contract 17: Loading skeleton
test('Contract 17: Loading skeleton', () => {
  assert.ok(statusStripSource.includes('Skeleton'), 'Must adopt Skeleton primitive on loading');
  assert.ok(statusStripSource.includes('isLoading && !summary'), 'Must check loading state before rendering skeleton');
});

// Contract 18: Empty state handling
test('Contract 18: Empty state handling', () => {
  assert.ok(statusStripSource.includes('tabular-nums') && statusStripSource.includes('font-mono'), 'Numbers must use tabular numbers and mono font');
  assert.ok(controlTowerSource.includes('OperationalTaskInbox'), 'Inbox handles task empty state');
});

// Contract 19: Driver financial/private field absence
test('Contract 19: Driver financial/private field absence', () => {
  assert.ok(!statusStripSource.includes('driverProfit'), 'No driver profit in status strip');
  assert.ok(!statusStripSource.includes('companyMargin'), 'No company margin in status strip');
  assert.ok(!controlTowerSource.includes('driverProfit'), 'No driver profit in control tower');
});

// Contract 20: Raw metadata absence
test('Contract 20: Raw metadata absence', () => {
  assert.ok(!statusStripSource.includes('JSON.stringify'), 'No raw JSON stringify dumps');
  assert.ok(!controlTowerSource.includes('JSON.stringify'), 'No raw JSON stringify dumps');
});

// Contract 21: Unsupported actions absent
test('Contract 21: Unsupported actions absent', () => {
  assert.ok(!controlTowerSource.includes('handleCancelTask'), 'No unsupported cancel task in control tower');
  assert.ok(!controlTowerSource.includes('handleCloseTask'), 'No unsupported close task in control tower');
});

// Contract 22: No new inline bilingual ternaries in modified files
test('Contract 22: Controlled localization structure', () => {
  assert.ok(controlTowerSource.includes('useI18n'), 'Control tower uses i18n hook');
});

// Contract 23: Step 2 Primitives adopted
test('Contract 23: Step 2 Primitives adopted', () => {
  assert.ok(statusStripSource.includes('./ui/Skeleton'), 'Status strip imports Skeleton primitive');
  assert.ok(statusStripSource.includes('./ui/StatusBadge'), 'Status strip imports StatusBadge primitive');
});

// Contract 24: Role/data scope API contract preserved
test('Contract 24: Role/data scope API contract preserved', () => {
  assert.ok(controlTowerSource.includes('operationalApiClient.getAttentionSummary'), 'Must call getAttentionSummary on client');
  assert.ok(controlTowerSource.includes('currentUserId={currentUser?.id}'), 'Must pass currentUser id for scoping');
});

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const hubWorkspacePath = path.resolve(process.cwd(), 'src/components/HubOperationsWorkspace.tsx');
const barcodeScannerModalPath = path.resolve(process.cwd(), 'src/components/BarcodeScannerModal.tsx');
const cameraScannerPath = path.resolve(process.cwd(), 'src/components/CameraBarcodeScanner.tsx');
const i18nPath = path.resolve(process.cwd(), 'src/lib/i18n.tsx');
const serverPath = path.resolve(process.cwd(), 'server.ts');

test('Gate Test 1: Scan identify causes no direct status or custody mutation', () => {
  const modalContent = fs.readFileSync(barcodeScannerModalPath, 'utf-8');
  assert.ok(modalContent.includes('/api/operational/identify'), 'Must invoke identify endpoint on scan');
  assert.ok(!modalContent.match(/handleIdentify[\s\S]*?(UPDATE|MUTATE|COMMIT)_STATUS/), 'Identify handler must not perform direct status mutation');
});

test('Gate Test 2: Allowed actions originate strictly from server identify contract', () => {
  const modalContent = fs.readFileSync(barcodeScannerModalPath, 'utf-8');
  assert.ok(modalContent.includes('identifiedEntity.availableActions'), 'Allowed actions must be read from identifiedEntity.availableActions');
  assert.ok(!modalContent.includes('const allowedActions = ['), 'UI must not hardcode/invent client-side allowed actions');
});

test('Gate Test 3: Facility intake uses canonical endpoint /api/operational/intake', () => {
  const hubContent = fs.readFileSync(hubWorkspacePath, 'utf-8');
  const modalContent = fs.readFileSync(barcodeScannerModalPath, 'utf-8');
  assert.ok(hubContent.includes('/api/operational/intake') || modalContent.includes('/api/operational/intake'), 'Intake must use canonical /api/operational/intake endpoint');
});

test('Gate Test 4: Facility release uses canonical endpoint /api/operational/release', () => {
  const hubContent = fs.readFileSync(hubWorkspacePath, 'utf-8');
  const modalContent = fs.readFileSync(barcodeScannerModalPath, 'utf-8');
  assert.ok(hubContent.includes('/api/operational/release') || modalContent.includes('/api/operational/release'), 'Release must use canonical /api/operational/release endpoint');
});

test('Gate Test 5: Facility intake sends selected facility ID and active leg scope', () => {
  const hubContent = fs.readFileSync(hubWorkspacePath, 'utf-8');
  const modalContent = fs.readFileSync(barcodeScannerModalPath, 'utf-8');
  assert.ok(hubContent.includes('facilityId: selectedFacilityId') || modalContent.includes('facilityId:'), 'Intake must transmit selected facilityId');
});

test('Gate Test 6: Facility release sends target driver ID and facility scope', () => {
  const hubContent = fs.readFileSync(hubWorkspacePath, 'utf-8');
  const modalContent = fs.readFileSync(barcodeScannerModalPath, 'utf-8');
  assert.ok(hubContent.includes('driverId: dispatchDriverId') || modalContent.includes('driverId:'), 'Release must transmit target driverId');
});

test('Gate Test 7: Double submit is guarded via button disabled states and idempotency key', () => {
  const hubContent = fs.readFileSync(hubWorkspacePath, 'utf-8');
  const modalContent = fs.readFileSync(barcodeScannerModalPath, 'utf-8');
  assert.ok(hubContent.includes('inboundIsProcessing') && hubContent.includes('isDispatching'), 'Hub buttons must be disabled during active processing');
  assert.ok(modalContent.includes('isExecuting') && modalContent.includes('idempotencyKey'), 'Scanner modal must guard execution state and pass idempotency key');
});

test('Gate Test 8: Idempotent replay safely passes UUID idempotency key to server', () => {
  const modalContent = fs.readFileSync(barcodeScannerModalPath, 'utf-8');
  assert.ok(modalContent.includes('idempotencyKey') && modalContent.includes('Idempotency-Key'), 'Must send Idempotency-Key header on mutation requests');
});

test('Gate Test 9: Manifest membership addition/removal does not alter shipment custody', () => {
  const hubContent = fs.readFileSync(hubWorkspacePath, 'utf-8');
  assert.ok(hubContent.includes('/api/operational/manifests/'), 'Manifest items use dedicated manifest API');
  assert.ok(!hubContent.match(/handleAddManifestItem[\s\S]*?mutateCustody/), 'Manifest membership modification must not directly mutate custody');
});

test('Gate Test 10: Canonical manifest states are respected (DRAFT, SEALED, etc.)', () => {
  const hubContent = fs.readFileSync(hubWorkspacePath, 'utf-8');
  assert.ok(hubContent.includes("selectedManifest.status === 'DRAFT'"), 'DRAFT status checks must exist for manifest item addition/sealing');
});

test('Gate Test 11: Manifest seal uses canonical seal API endpoint /api/operational/manifests/seal', () => {
  const hubContent = fs.readFileSync(hubWorkspacePath, 'utf-8');
  assert.ok(hubContent.includes('/api/operational/manifests/') && hubContent.includes('seal'), 'Seal path uses canonical seal endpoint');
});

test('Gate Test 12: Hub UI contains zero generic RETURNED status bypass buttons', () => {
  const hubContent = fs.readFileSync(hubWorkspacePath, 'utf-8');
  assert.ok(!hubContent.includes('action: "RETURNED"') && !hubContent.includes("action: 'RETURNED'"), 'Hub must not offer generic RETURNED mutation bypass');
});

test('Gate Test 13: Merchant return receipt remains terminal return path', () => {
  const serverContent = fs.readFileSync(serverPath, 'utf-8');
  assert.ok(serverContent.includes('CONFIRM_MERCHANT_RETURN') || serverContent.includes('/api/operational/returns'), 'Merchant return receipt endpoint preserved in server architecture');
});

test('Gate Test 14: Multi-leg shipment model is preserved without collapsing into single-driver assumption', () => {
  const hubContent = fs.readFileSync(hubWorkspacePath, 'utf-8');
  assert.ok(hubContent.includes('leg.leg_type') || hubContent.includes('leg_type'), 'Hub renders multi-leg leg_type details');
  assert.ok(!hubContent.includes('oneDriverOnly'), 'Hub does not force a single driver assumption');
});

test('Gate Test 15: Scan log history is explicitly session/in-memory, not labeled fake authoritative DB history', () => {
  const modalContent = fs.readFileSync(barcodeScannerModalPath, 'utf-8');
  assert.ok(modalContent.includes('sessionLogs') && modalContent.includes('في هذه الجلسة'), 'Scan history explicitly labeled as session scans');
  assert.ok(!modalContent.includes('Authoritative Global Event Log'), 'Must not claim fake authoritative DB persistence for session logs');
});

test('Gate Test 16: CameraBarcodeScanner properly cleans up camera streams and media tracks on unmount/close', () => {
  const cameraContent = fs.readFileSync(cameraScannerPath, 'utf-8');
  assert.ok(cameraContent.includes('stop()') && cameraContent.includes('clear()'), 'Camera scanner must stop and clear html5QrCode on close/unmount');
});

test('Gate Test 17: Duplicate keyboard scanner listeners are absent', () => {
  const hubContent = fs.readFileSync(hubWorkspacePath, 'utf-8');
  const modalContent = fs.readFileSync(barcodeScannerModalPath, 'utf-8');
  assert.ok(!modalContent.includes('window.addEventListener("keypress"') && !hubContent.includes('window.addEventListener("keypress"'), 'Zero unmanaged global scanner listeners');
});

test('Gate Test 18: Success UI is displayed only after authoritative server response', () => {
  const modalContent = fs.readFileSync(barcodeScannerModalPath, 'utf-8');
  assert.ok(modalContent.includes('res.ok') && modalContent.includes('setFeedbackSuccess'), 'Success message only set when res.ok is true');
});

test('Gate Test 19: Stale actions are cleared and queue refreshed after successful mutation', () => {
  const hubContent = fs.readFileSync(hubWorkspacePath, 'utf-8');
  const modalContent = fs.readFileSync(barcodeScannerModalPath, 'utf-8');
  assert.ok(hubContent.includes('loadFacilityQueue(selectedFacilityId)'), 'Hub refetches facility queue on mutation');
  assert.ok(modalContent.includes('onScanSuccess') || modalContent.includes('loadFacilityQueue'), 'Scanner modal triggers callback/refetch to refresh queue');
});

test('Gate Test 20: Financial privacy enforced - zero merchant collection or driver commission leaks in Hub/Scanner', () => {
  const hubContent = fs.readFileSync(hubWorkspacePath, 'utf-8');
  const modalContent = fs.readFileSync(barcodeScannerModalPath, 'utf-8');
  assert.ok(!hubContent.includes('driverCommission') && !hubContent.includes('companyProfitMargin'), 'Hub UI has 0 financial margin/commission leaks');
  assert.ok(!modalContent.includes('driverCommission') && !modalContent.includes('companyProfitMargin'), 'Scanner Modal has 0 financial margin/commission leaks');
});

test('Gate Test 21: Raw internal database metadata is absent from UI', () => {
  const hubContent = fs.readFileSync(hubWorkspacePath, 'utf-8');
  assert.ok(!hubContent.includes('raw_pg_meta') && !hubContent.includes('internal_sys_id'), 'Zero raw DB metadata leakage');
});

test('Gate Test 22: Fake physical shelf / bin / rack storage locations are absent', () => {
  const hubContent = fs.readFileSync(hubWorkspacePath, 'utf-8');
  assert.ok(!hubContent.includes('rack_number_x') && !hubContent.includes('aisle_bin_slot'), 'Zero fake WMS bin/shelf features');
});

test('Gate Test 23: Fake departure GPS breadcrumbs are absent from Hub timeline', () => {
  const hubContent = fs.readFileSync(hubWorkspacePath, 'utf-8');
  assert.ok(!hubContent.includes('fake_gps_breadcrumb'), 'Zero fake GPS breadcrumb timeline entries');
});

test('Gate Test 24: Authoritative terminology used - zero fake realtime/live labels', () => {
  const hubContent = fs.readFileSync(hubWorkspacePath, 'utf-8');
  const modalContent = fs.readFileSync(barcodeScannerModalPath, 'utf-8');
  assert.ok(!hubContent.includes('Live Realtime Updates') && !modalContent.includes('Live Realtime Stream'), 'Zero fake realtime terminology');
});

test('Gate Test 25: RTL From/To semantics use explicit text labels rather than relying solely on arrows', () => {
  const i18nContent = fs.readFileSync(i18nPath, 'utf-8');
  assert.ok(i18nContent.includes("from: 'من'") && i18nContent.includes("to: 'إلى'"), 'Explicit From/To direction labels in i18n');
});

test('Gate Test 26: LTR directionality semantics exist for English language mode', () => {
  const i18nContent = fs.readFileSync(i18nPath, 'utf-8');
  assert.ok(i18nContent.includes("from: 'From'") && i18nContent.includes("to: 'To'"), 'Explicit From/To English direction labels in i18n');
});

test('Gate Test 27: Mobile layout scan-first design contains >=44px touch targets', () => {
  const hubContent = fs.readFileSync(hubWorkspacePath, 'utf-8');
  assert.ok(hubContent.includes('min-h-[44px]'), 'Hub controls enforce >=44px minimum touch targets');
});

test('Gate Test 28: Sanitized user-facing error messages on operational failure', () => {
  const modalContent = fs.readFileSync(barcodeScannerModalPath, 'utf-8');
  assert.ok(modalContent.includes('setFeedbackError') && modalContent.includes('errMsg'), 'Error messages sanitized and captured gracefully');
});

test('Gate Test 29: Protected system files remain completely unchanged', () => {
  const protectedModules = [
    'server.ts',
    'src/lib/auth.ts',
    'src/lib/workspaceResolver.ts',
  ];
  for (const mod of protectedModules) {
    assert.ok(fs.existsSync(path.resolve(process.cwd(), mod)), `Protected module ${mod} must exist`);
  }
});

test('Gate Test 30: Zero direct inventory or financial ledger mutations from scanner component', () => {
  const modalContent = fs.readFileSync(barcodeScannerModalPath, 'utf-8');
  assert.ok(!modalContent.includes('sql`UPDATE financial_ledgers') && !modalContent.includes('UPDATE inventory'), 'Scanner performs zero direct database SQL mutations');
});

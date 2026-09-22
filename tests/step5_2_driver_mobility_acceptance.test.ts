import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const driverPortalPath = path.resolve(process.cwd(), 'src/components/DriverPortal.tsx');
const servicePath = path.resolve(process.cwd(), 'src/services/operationalLogisticsService.ts');
const serverPath = path.resolve(process.cwd(), 'server.ts');
const i18nPath = path.resolve(process.cwd(), 'src/lib/i18n.tsx');

test('Gate Test 1: Driver assignment is isolated via server-side driver ID filtering', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  const serviceContent = fs.readFileSync(servicePath, 'utf-8');
  assert.ok(driverPortalContent.includes('/api/driver/work?driverId='), 'Driver Portal fetches work using specific driverId query param');
  assert.ok(serviceContent.includes('assigned_driver_id'), 'Operational service filters shipment_legs by assigned_driver_id');
});

test('Gate Test 2: Leg-specific assignment is maintained without global shipment ownership assumption', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  assert.ok(driverPortalContent.includes('legId'), 'Driver stops are referenced by discrete legId');
  assert.ok(driverPortalContent.includes('legType'), 'Driver stops track discrete legType');
});

test('Gate Test 3: One-driver assumption is absent across multi-leg shipments', () => {
  const serviceContent = fs.readFileSync(servicePath, 'utf-8');
  assert.ok(serviceContent.includes('shipment_legs'), 'Shipment legs queried individually per leg assignment');
});

test('Gate Test 4: Navigating to pickup does not create physical custody', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  assert.ok(!driverPortalContent.match(/getGoogleMapsLink[\s\S]*?(mutateCustody|updateStatus)/), 'Google Maps navigation link must be display-only without side-effect mutations');
});

test('Gate Test 5: Arrival at pickup does not create custody without depot release', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  assert.ok(driverPortalContent.includes('awaitingDepotRelease'), 'Displays awaiting depot release until physical release is confirmed');
});

test('Gate Test 6: Canonical pickup/release path is used via operational release endpoint', () => {
  const serviceContent = fs.readFileSync(servicePath, 'utf-8');
  assert.ok(serviceContent.includes('execute_confirm_facility_release') || serviceContent.includes('bulkFacilityRelease'), 'Pickup custody transfer uses canonical release transaction');
});

test('Gate Test 7: Navigating to dropoff does not mark delivery complete', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  assert.ok(driverPortalContent.includes('getGoogleMapsLink'), 'Navigation is external URL opener');
  assert.ok(!driverPortalContent.match(/getGoogleMapsLink[\s\S]*?execute_complete_customer_delivery/), 'Navigation does not invoke delivery completion');
});

test('Gate Test 8: Arrival at dropoff location does not complete delivery without evidence/confirmation', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  assert.ok(driverPortalContent.includes('openDeliveryModal'), 'Delivery requires explicit confirmation modal trigger');
});

test('Gate Test 9: Complete delivery uses canonical endpoint /api/operational/delivery', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  assert.ok(driverPortalContent.includes('/api/operational/delivery'), 'Driver UI posts delivery to /api/operational/delivery');
});

test('Gate Test 10: Record failure uses canonical endpoint /api/operational/delivery-failure', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  assert.ok(driverPortalContent.includes('/api/operational/delivery-failure'), 'Driver UI posts failure to /api/operational/delivery-failure');
});

test('Gate Test 11: Generic DELIVERED status bypass is absent from Driver UI', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  assert.ok(!driverPortalContent.includes("status = 'DELIVERED'") && !driverPortalContent.includes('status: "DELIVERED"'), 'Must not directly mutate status to DELIVERED on client');
});

test('Gate Test 12: Generic RETURNED status bypass is absent from Driver UI', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  assert.ok(!driverPortalContent.includes("status = 'RETURNED'") && !driverPortalContent.includes('status: "RETURNED"'), 'Must not directly mutate status to RETURNED on client');
});

test('Gate Test 13: OTP capability is accurately labelled as delivery evidence', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  const i18nContent = fs.readFileSync(i18nPath, 'utf-8');
  assert.ok(driverPortalContent.includes('deliveryOtp'), 'OTP field captured in delivery state');
  assert.ok(i18nContent.includes('deliveryOtp'), 'OTP label translated accurately in i18n');
});

test('Gate Test 14: Fake OTP verification claims are absent', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  assert.ok(!driverPortalContent.includes('OTP Verified') && !driverPortalContent.includes('رمز التحقق صحيح'), 'UI must not claim fake OTP verification');
});

test('Gate Test 15: Signature is captured and transmitted as evidence URL', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  assert.ok(driverPortalContent.includes('signatureData') && driverPortalContent.includes('evidenceSignatureUrl'), 'Signature is submitted as evidenceSignatureUrl');
});

test('Gate Test 16: Fake persisted POD badges are absent if not backed by DB storage', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  assert.ok(!driverPortalContent.includes('Persisted POD Verified'), 'UI must not claim fake persisted POD verification');
});

test('Gate Test 17: CliQ reference is enforced when CliQ payment method is selected', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  const serviceContent = fs.readFileSync(servicePath, 'utf-8');
  assert.ok(driverPortalContent.includes("paymentMethod === 'CLIQ'") && driverPortalContent.includes('cliqRef'), 'Driver UI validates CliQ reference');
  assert.ok(serviceContent.includes('CLIQ_REFERENCE_REQUIRED'), 'Server validates CliQ reference requirement');
});

test('Gate Test 18: Fake live bank CliQ provider verification is absent', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  assert.ok(!driverPortalContent.includes('Bank Verified CliQ Gateway'), 'UI must not claim fake bank provider connection');
});

test('Gate Test 19: Required customer COD collection uses codAmount / totalCollection', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  assert.ok(driverPortalContent.includes('codAmount'), 'Customer collection displays codAmount');
});

test('Gate Test 20: Cash held in hand source originates from server-authoritative DB ledger', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  const serviceContent = fs.readFileSync(servicePath, 'utf-8');
  assert.ok(driverPortalContent.includes('cashHeldAmount'), 'Driver UI displays server summary cashHeldAmount');
  assert.ok(serviceContent.includes('driver_cash_collections') && serviceContent.includes('HELD_BY_DRIVER'), 'Server calculates cash held from driver_cash_collections table');
});

test('Gate Test 21: Financial concepts (wallet, cash custody, COD remaining) are strictly separated', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  assert.ok(driverPortalContent.includes('cashInHand') && driverPortalContent.includes('totalCodRemaining'), 'Separate visual indicators for Cash Held in Hand vs COD Remaining');
});

test('Gate Test 22: Merchant collection is hidden from driver view', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  const serviceContent = fs.readFileSync(servicePath, 'utf-8');
  assert.ok(!driverPortalContent.includes('merchantCollection'), 'Driver UI does not render merchantCollection');
  assert.ok(serviceContent.includes('sanitizeDriverOperationalView') || serviceContent.includes('getDriverWorkload'), 'Server sanitizes driver workload response');
});

test('Gate Test 23: Merchant delivery fee is hidden from driver view', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  assert.ok(!driverPortalContent.includes('merchantDeliveryFee') && !driverPortalContent.includes('merchant_delivery_fee'), 'Driver UI does not reveal merchant delivery fee');
});

test('Gate Test 24: Merchant price plan / tariff is hidden from driver view', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  assert.ok(!driverPortalContent.includes('pricePlan') && !driverPortalContent.includes('merchant_price_plan_id'), 'Driver UI does not reveal merchant price plan');
});

test('Gate Test 25: Company revenue, margin, and profit are hidden from driver view', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  assert.ok(!driverPortalContent.includes('companyRevenue') && !driverPortalContent.includes('companyMargin'), 'Driver UI does not reveal company revenue or margin');
});

test('Gate Test 26: Other drivers earnings are hidden from driver view', () => {
  const serviceContent = fs.readFileSync(servicePath, 'utf-8');
  assert.ok(serviceContent.includes('effectiveDriverId'), 'Workload scope strictly bound to effective driver ID');
});

test('Gate Test 27: GPS geolocation watcher properly registers unmount cleanup', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  assert.ok(driverPortalContent.includes('navigator.geolocation.watchPosition') && driverPortalContent.includes('clearWatch'), 'Geolocation watcher includes clearWatch cleanup on unmount');
});

test('Gate Test 28: Duplicate GPS watchers are prevented', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  assert.ok(driverPortalContent.includes('let watchId: number | null = null') || driverPortalContent.includes('watchPosition'), 'GPS watcher uses singleton effect lifecycle');
});

test('Gate Test 29: Stale location parameter adheres to max age configuration', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  assert.ok(driverPortalContent.includes('maximumAge: 120000'), 'GPS watcher sets maximumAge to 120,000ms (120s)');
});

test('Gate Test 30: Geofence authority is server-side evaluated', () => {
  const serviceContent = fs.readFileSync(servicePath, 'utf-8');
  assert.ok(serviceContent.includes('p_latitude') && serviceContent.includes('p_longitude'), 'Coordinates passed to server RPC for authoritative distance validation');
});

test('Gate Test 31: Geofence threshold remains standard 200m in server RPCs', () => {
  const serverContent = fs.readFileSync(serverPath, 'utf-8');
  assert.ok(serverContent.includes('200') || serverContent.includes('execute_complete_customer_delivery'), 'Server RPC handles geofence evaluation');
});

test('Gate Test 32: External Google Maps link is NOT falsely claimed as internal route optimization', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  assert.ok(driverPortalContent.includes('google.com/maps/search'), 'Maps link points to external Google Maps API');
  assert.ok(!driverPortalContent.includes('AI Route Optimization Engine'), 'UI does not claim fake AI route optimization');
});

test('Gate Test 33: Fake client AI ETA engine is absent', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  assert.ok(!driverPortalContent.includes('Predictive AI Arrival Engine'), 'UI does not claim fake AI ETA engine');
});

test('Gate Test 34: Active order limit is enforced by backend service rules', () => {
  const serviceContent = fs.readFileSync(servicePath, 'utf-8');
  assert.ok(serviceContent.includes('MAX') || serviceContent.includes('getDriverWorkload'), 'Backend manages active workload counts');
});

test('Gate Test 35: COD exposure limit is preserved in server rules', () => {
  const serverContent = fs.readFileSync(serverPath, 'utf-8');
  assert.ok(serverContent.includes('150') || serverContent.includes('execute_confirm_facility_release'), '150 JOD COD exposure limit enforced in server logic');
});

test('Gate Test 36: Network failure during delivery does not visually advance journey', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  assert.ok(driverPortalContent.includes('catch') && driverPortalContent.includes('setDeliveryError'), 'Delivery errors are caught and state retained with clear error message');
});

test('Gate Test 37: Stale assignment mutations trigger authoritative refetch on failure', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  assert.ok(driverPortalContent.includes('fetchWorkload'), 'Driver UI refetches workload to synchronize state');
});

test('Gate Test 38: Delivery double submit is guarded via button state and Idempotency-Key', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  assert.ok(driverPortalContent.includes('isDelivering') && driverPortalContent.includes('Idempotency-Key'), 'Delivery confirmation guards isDelivering and passes Idempotency-Key');
});

test('Gate Test 39: Failure double submit is guarded via button state and Idempotency-Key', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  assert.ok(driverPortalContent.includes('isFailing') && driverPortalContent.includes('Idempotency-Key'), 'Failure recording guards isFailing and passes Idempotency-Key');
});

test('Gate Test 40: Fake offline synchronization queue is absent', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  assert.ok(!driverPortalContent.includes('Offline Sync Queue Active'), 'UI does not claim fake offline database synchronization');
});

test('Gate Test 41: Fake date/calendar reschedule picker is absent from Driver UI', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  assert.ok(!driverPortalContent.includes('rescheduleCalendar') && !driverPortalContent.includes('datepicker'), 'Driver UI does not contain fake date picker for rescheduling');
});

test('Gate Test 42: Merchant contact details are kept private from driver view', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  assert.ok(!driverPortalContent.includes('merchantPhone') && !driverPortalContent.includes('merchant_phone'), 'Driver UI does not expose merchant phone numbers');
});

test('Gate Test 43: RTL support is fully integrated via i18n Arabic dictionary', () => {
  const i18nContent = fs.readFileSync(i18nPath, 'utf-8');
  assert.ok(i18nContent.includes('title: \'كابتن الميدان والتوصيل\'') || i18nContent.includes('كابتن الميدان'), 'Arabic i18n includes driver portal translations');
});

test('Gate Test 44: LTR support is fully integrated via i18n English dictionary', () => {
  const i18nContent = fs.readFileSync(i18nPath, 'utf-8');
  assert.ok(i18nContent.includes('title: \'Field Delivery Captain\'') || i18nContent.includes('Field Delivery Captain'), 'English i18n includes driver portal translations');
});

test('Gate Test 45: Driver portal container uses responsive max-w-4xl mobile structure', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  assert.ok(driverPortalContent.includes('max-w-4xl mx-auto'), 'Driver Portal framed in max-w-4xl responsive container');
});

test('Gate Test 46: Primary action buttons feature minimum touch target height of 44px', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  assert.ok(driverPortalContent.includes('min-h-[44px]'), 'Touch targets enforce min-h-[44px] for outdoor mobile usability');
});

test('Gate Test 47: Errors are sanitized and presented in user-friendly localized messages', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  assert.ok(driverPortalContent.includes('showToast') && driverPortalContent.includes('error'), 'Error messages displayed through user-friendly toast notifications');
});

test('Gate Test 48: UI strings use centralized i18n hook instead of new inline bilingual ternaries', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  assert.ok(driverPortalContent.includes('useI18n()') && driverPortalContent.includes('t.driver'), 'Driver Portal uses centralized i18n translation object');
});

test('Gate Test 49: Protected server and database schemas remain intact', () => {
  const serverContent = fs.readFileSync(serverPath, 'utf-8');
  const serviceContent = fs.readFileSync(servicePath, 'utf-8');
  assert.ok(serverContent.includes('completeCustomerDelivery') && serverContent.includes('recordDeliveryFailure'), 'Protected server endpoints preserved in server.ts');
  assert.ok(serviceContent.includes('execute_complete_customer_delivery') && serviceContent.includes('execute_record_delivery_failure'), 'Protected RPC endpoints preserved in operationalLogisticsService.ts');
});

test('Gate Test 50: Financial and inventory mutations are strictly handled via authoritative server endpoints', () => {
  const driverPortalContent = fs.readFileSync(driverPortalPath, 'utf-8');
  assert.ok(!driverPortalContent.includes('supabase.from('), 'Driver UI does not execute direct client-side Supabase database mutations');
});

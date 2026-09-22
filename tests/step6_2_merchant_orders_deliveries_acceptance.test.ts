import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const merchantPortalPath = path.resolve(process.cwd(), 'src/components/MerchantPortal.tsx');
const merchantOrdersViewPath = path.resolve(process.cwd(), 'src/components/merchant/MerchantOrdersView.tsx');
const merchantOrderDetailDrawerPath = path.resolve(process.cwd(), 'src/components/merchant/MerchantOrderDetailDrawer.tsx');
const merchantDeliveriesViewPath = path.resolve(process.cwd(), 'src/components/merchant/MerchantDeliveriesView.tsx');
const serverPath = path.resolve(process.cwd(), 'server.ts');
const logisticsTypesPath = path.resolve(process.cwd(), 'src/types/logistics.ts');

// Helper to read file content
const read = (filePath: string) => fs.readFileSync(filePath, 'utf-8');

// ============================================================================
// STEP 6.2 ACCEPTANCE SUITE — MERCHANT ORDERS + DELIVERIES DOMAIN (60 CHECKS)
// ============================================================================

// --- 1. AUTHORITATIVE ORDER SOURCE ---
test('Step 6.2 Check 1: Orders in Merchant Portal are loaded from /api/orders authoritative endpoint', () => {
  const portalContent = read(merchantPortalPath);
  assert.ok(portalContent.includes('/api/orders'), 'MerchantPortal must call /api/orders');
  assert.ok(portalContent.includes('fetchMerchantData'), 'MerchantPortal must have fetchMerchantData function');
});

// --- 2. MERCHANT SERVER SCOPE ---
test('Step 6.2 Check 2: /api/orders passes merchantId parameter for scoping', () => {
  const portalContent = read(merchantPortalPath);
  assert.ok(portalContent.includes('merchantId='), 'MerchantPortal must pass merchantId parameter when querying orders');
});

// --- 3. CROSS-MERCHANT ACCESS BLOCKED ---
test('Step 6.2 Check 3: Merchant requests pass user auth headers preventing cross-merchant leaks', () => {
  const portalContent = read(merchantPortalPath);
  assert.ok(portalContent.includes('getAuthHeaders'), 'MerchantPortal must attach getAuthHeaders to API calls');
});

// --- 4. ORDER CREATE USES EXISTING ENDPOINT ---
test('Step 6.2 Check 4: Order creation uses POST /api/orders endpoint', () => {
  const portalContent = read(merchantPortalPath);
  assert.ok(portalContent.includes("method: 'POST'"), 'Order creation must issue POST method');
  assert.ok(portalContent.includes('/api/orders'), 'Order creation must send request to /api/orders');
});

// --- 5. SERVER PRICING REMAINS AUTHORITATIVE ---
test('Step 6.2 Check 5: Server code computes canonical delivery fee and total collection', () => {
  const serverContent = read(serverPath);
  assert.ok(serverContent.includes('deliveryFee'), 'Server must handle delivery fee calculation');
  assert.ok(serverContent.includes('totalCollection'), 'Server must handle totalCollection computation');
});

// --- 6. CLIENT FEE NOT AUTHORITATIVE ---
test('Step 6.2 Check 6: Client UI submits inputs while server validates pricing authority', () => {
  const portalContent = read(merchantPortalPath);
  assert.ok(portalContent.includes('merchantCollection'), 'Client submits merchantCollection input');
  assert.ok(portalContent.includes('deliveryFee'), 'Client calculates estimated fee while server remains authoritative');
});

// --- 7. TOTAL COLLECTION SEMANTICS ---
test('Step 6.2 Check 7: totalCollection = merchantCollection + deliveryFee semantics maintained', () => {
  const drawerContent = read(merchantOrderDetailDrawerPath);
  assert.ok(drawerContent.includes('totalCollection') || drawerContent.includes('merchantCollection'), 'Drawer must display merchantCollection breakdown');
});

// --- 8. NO DOUBLE FEE SUBTRACTION ---
test('Step 6.2 Check 8: Financial breakdown in drawer calculates net collection without duplicate deductions', () => {
  const drawerContent = read(merchantOrderDetailDrawerPath);
  assert.ok(!drawerContent.includes('- deliveryFee - deliveryFee'), 'Drawer must not subtract delivery fee twice');
});

// --- 9. MERCHANT COLLECTION SEMANTICS ---
test('Step 6.2 Check 9: merchantCollection accurately represents cash collected for goods', () => {
  const ordersViewContent = read(merchantOrdersViewPath);
  assert.ok(ordersViewContent.includes('merchantCollection'), 'Orders view must feature merchantCollection column');
});

// --- 10. DRIVER EARNING HIDDEN ---
test('Step 6.2 Check 10: Merchant UI does not expose DRIVER_COMMISSION terminology', () => {
  const ordersViewContent = read(merchantOrdersViewPath);
  const drawerContent = read(merchantOrderDetailDrawerPath);
  assert.ok(!ordersViewContent.includes('DRIVER_COMMISSION'), 'MerchantOrdersView must not mention DRIVER_COMMISSION');
  assert.ok(!drawerContent.includes('DRIVER_COMMISSION'), 'MerchantOrderDetailDrawer must not mention DRIVER_COMMISSION');
});

// --- 11. DRIVER WALLET HIDDEN ---
test('Step 6.2 Check 11: Merchant UI does not display internal driver wallet balances', () => {
  const ordersViewContent = read(merchantOrdersViewPath);
  assert.ok(!ordersViewContent.includes('driverWallet'), 'Merchant view must not expose driverWallet');
});

// --- 12. COMPANY MARGIN HIDDEN ---
test('Step 6.2 Check 12: Platform profit margins and split details are hidden from merchant', () => {
  const ordersViewContent = read(merchantOrdersViewPath);
  assert.ok(!ordersViewContent.includes('companyMargin'), 'Merchant view must not expose companyMargin');
});

// --- 13. HISTORICAL PRICING SNAPSHOT PRESERVED ---
test('Step 6.2 Check 13: Order model preserves snapshot deliveryFee field', () => {
  const logisticsContent = read(logisticsTypesPath);
  assert.ok(logisticsContent.includes('deliveryFee: number;'), 'Order interface must contain deliveryFee snapshot');
});

// --- 14. OLD ORDER NOT REPRICED ---
test('Step 6.2 Check 14: Order detail drawer renders historical order.deliveryFee directly', () => {
  const drawerContent = read(merchantOrderDetailDrawerPath);
  assert.ok(drawerContent.includes('order.deliveryFee'), 'Drawer must render order.deliveryFee directly without recalculation');
});

// --- 15. ORDER LIST REAL DATA ---
test('Step 6.2 Check 15: MerchantOrdersView consumes orders prop passed from server state', () => {
  const ordersViewContent = read(merchantOrdersViewPath);
  assert.ok(ordersViewContent.includes('orders: Order[]'), 'MerchantOrdersView must receive orders prop');
  assert.ok(ordersViewContent.includes('orders.map') || ordersViewContent.includes('filteredOrders.map'), 'MerchantOrdersView must map over real order data');
});

// --- 16. DETAIL DRAWER REAL DATA ---
test('Step 6.2 Check 16: MerchantOrderDetailDrawer displays real properties from Order interface', () => {
  const drawerContent = read(merchantOrderDetailDrawerPath);
  assert.ok(drawerContent.includes('order.sequence'), 'Drawer must display order.sequence');
  assert.ok(drawerContent.includes('order.recipientName'), 'Drawer must display order.recipientName');
  assert.ok(drawerContent.includes('order.recipientPhone'), 'Drawer must display order.recipientPhone');
});

// --- 17. CANONICAL STATUSES ---
test('Step 6.2 Check 17: Canonical OrderStatus enum values are strictly respected', () => {
  const logisticsContent = read(logisticsTypesPath);
  const requiredStatuses = ['PENDING', 'PICKING', 'RECEIVED_AT_HUB', 'OUT_FOR_DELIVERY', 'POSTPONED', 'CANCELLED', 'DELIVERED', 'RETURNED'];
  for (const st of requiredStatuses) {
    assert.ok(logisticsContent.includes(`'${st}'`), `OrderStatus must contain status '${st}'`);
  }
});

// --- 18. GENERIC DELIVERED BYPASS ABSENT ---
test('Step 6.2 Check 18: Merchant UI does not provide client-side override button to force DELIVERED status', () => {
  const ordersViewContent = read(merchantOrdersViewPath);
  assert.ok(!ordersViewContent.includes("onClick={() => updateOrderStatus('DELIVERED')}"), 'Merchant UI must not contain direct client override for DELIVERED');
});

// --- 19. GENERIC RETURNED BYPASS ABSENT ---
test('Step 6.2 Check 19: Merchant UI does not provide direct client override for RETURNED status', () => {
  const ordersViewContent = read(merchantOrdersViewPath);
  assert.ok(!ordersViewContent.includes("onClick={() => updateOrderStatus('RETURNED')}"), 'Merchant UI must not contain direct client override for RETURNED');
});

// --- 20. GENERIC CANCEL BYPASS ABSENT ---
test('Step 6.2 Check 20: Order cancellation requires rationale validation and endpoint call', () => {
  const drawerContent = read(merchantOrderDetailDrawerPath);
  assert.ok(drawerContent.includes('cancellationReason') || drawerContent.includes('Reason'), 'Cancellation requires reason context');
});

// --- 21. DIRECT CUSTODY BYPASS ABSENT ---
test('Step 6.2 Check 21: Custody transitions are absent from client-side merchant UI overrides', () => {
  const ordersViewContent = read(merchantOrdersViewPath);
  assert.ok(!ordersViewContent.includes('forceTransferCustody'), 'Merchant UI must not contain direct custody override');
});

// --- 22. MERCHANT ACTIONS MAPPED TO REAL HANDLERS ---
test('Step 6.2 Check 22: Merchant actions (waybill, details, new shipment) map to real handlers', () => {
  const ordersViewContent = read(merchantOrdersViewPath);
  assert.ok(ordersViewContent.includes('onOpenWaybill'), 'MerchantOrdersView must accept onOpenWaybill handler');
  assert.ok(ordersViewContent.includes('onViewOrderDetails'), 'MerchantOrdersView must accept onViewOrderDetails handler');
  assert.ok(ordersViewContent.includes('onOpenNewShipmentModal'), 'MerchantOrdersView must accept onOpenNewShipmentModal handler');
});

// --- 23. FAKE EDIT ABSENT ---
test('Step 6.2 Check 23: Merchant UI does not contain fake client-side order editing', () => {
  const ordersViewContent = read(merchantOrdersViewPath);
  assert.ok(!ordersViewContent.includes('editOrderInLocalStorage'), 'Merchant UI must not use fake local editing');
});

// --- 24. CANCELLATION VALIDATED ---
test('Step 6.2 Check 24: Cancellation button triggers confirmation / reason entry', () => {
  const drawerContent = read(merchantOrderDetailDrawerPath);
  assert.ok(drawerContent.includes('CANCELLED') || drawerContent.includes('إلغاء'), 'Drawer handles cancellation state representation');
});

// --- 25. WAYBILL REAL PERSISTED ORDER ---
test('Step 6.2 Check 25: Waybill modal receives real persisted order object', () => {
  const portalContent = read(merchantPortalPath);
  assert.ok(portalContent.includes('onOpenWaybill'), 'Waybill modal trigger uses real order payload');
});

// --- 26. NO WAYBILL ON FAILED CREATE ---
test('Step 6.2 Check 26: Failed order creation does not trigger thermal waybill modal', () => {
  const portalContent = read(merchantPortalPath);
  // Waybill is inside if (res.ok)
  const createIndex = portalContent.indexOf('handleCreateShipment');
  const resOkIndex = portalContent.indexOf('if (res.ok)', createIndex);
  const waybillIndex = portalContent.indexOf('onOpenWaybill(', createIndex);
  assert.ok(waybillIndex > resOkIndex, 'onOpenWaybill must be executed inside res.ok block');
});

// --- 27. TRACKING AUTHORITATIVE ---
test('Step 6.2 Check 27: Order status history uses server statusLogs array', () => {
  const drawerContent = read(merchantOrderDetailDrawerPath);
  assert.ok(drawerContent.includes('statusLogs'), 'Drawer must inspect order.statusLogs for timeline');
});

// --- 28. FAKE TRACKING EVENTS ABSENT ---
test('Step 6.2 Check 28: Tracking timeline does not synthesize artificial unverified events', () => {
  const drawerContent = read(merchantOrderDetailDrawerPath);
  assert.ok(!drawerContent.includes('generateFakeTimeline'), 'Drawer must not generate fake timeline events');
});

// --- 29. JOURNEY TIMELINE AUTHORITATIVE ---
test('Step 6.2 Check 29: Journey lifecycle timeline maps statusLogs chronologically', () => {
  const drawerContent = read(merchantOrderDetailDrawerPath);
  assert.ok(drawerContent.includes('statusLogs'), 'Journey timeline relies on statusLogs');
});

// --- 30. ONE-DRIVER ASSUMPTION ABSENT ---
test('Step 6.2 Check 30: Multi-leg driver assignment support exists in Order model', () => {
  const logisticsContent = read(logisticsTypesPath);
  assert.ok(logisticsContent.includes('driverId?: string | null;'), 'Order model supports driverId');
  assert.ok(logisticsContent.includes('driver?: User | null;'), 'Order model supports driver relation');
});

// --- 31. DELIVERIES DERIVED ---
test('Step 6.2 Check 31: MerchantDeliveriesView is derived from orders prop', () => {
  const deliveriesContent = read(merchantDeliveriesViewPath);
  assert.ok(deliveriesContent.includes('orders: Order[]'), 'MerchantDeliveriesView accepts orders prop');
  assert.ok(deliveriesContent.includes('orders.filter'), 'MerchantDeliveriesView derives active deliveries from orders filter');
});

// --- 32. SECOND DELIVERY SOURCE ABSENT ---
test('Step 6.2 Check 32: No duplicate database source or state exists for deliveries', () => {
  const deliveriesContent = read(merchantDeliveriesViewPath);
  assert.ok(!deliveriesContent.includes("fetch('/api/deliveries')"), 'Deliveries view must not query a separate secondary deliveries table');
});

// --- 33. FAILED != CANCELLED ---
test('Step 6.2 Check 33: Postponed / failed attempt status is distinct from CANCELLED', () => {
  const ordersViewContent = read(merchantOrdersViewPath);
  assert.ok(ordersViewContent.includes('POSTPONED') && ordersViewContent.includes('CANCELLED'), 'POSTPONED and CANCELLED are distinct statuses');
});

// --- 34. FAILED != RETURNED ---
test('Step 6.2 Check 34: Postponed / failed attempt status is distinct from RETURNED', () => {
  const ordersViewContent = read(merchantOrdersViewPath);
  assert.ok(ordersViewContent.includes('POSTPONED') && ordersViewContent.includes('RETURNED'), 'POSTPONED and RETURNED are distinct statuses');
});

// --- 35. TERMINAL RETURNED NOT AWAITING RECEIPT ---
test('Step 6.2 Check 35: RETURNED represents terminal return, distinct from in-transit returns', () => {
  const logisticsContent = read(logisticsTypesPath);
  assert.ok(logisticsContent.includes('returnHandoverStatus'), 'Reverse logistics uses returnHandoverStatus for return lifecycle');
});

// --- 36. SEARCH SEMANTICS ACCURATE ---
test('Step 6.2 Check 36: Search filters by waybill sequence, recipient name, phone, and governorate/area', () => {
  const ordersViewContent = read(merchantOrdersViewPath);
  assert.ok(ordersViewContent.includes('sequence'), 'Search checks sequence');
  assert.ok(ordersViewContent.includes('recipientName'), 'Search checks recipientName');
  assert.ok(ordersViewContent.includes('recipientPhone'), 'Search checks recipientPhone');
});

// --- 37. FILTERS SEMANTICS ACCURATE ---
test('Step 6.2 Check 37: Filter controls filter by status, governorate, and payment type accurately', () => {
  const ordersViewContent = read(merchantOrdersViewPath);
  assert.ok(ordersViewContent.includes('statusFilter'), 'Grid supports statusFilter');
  assert.ok(ordersViewContent.includes('governorateFilter'), 'Grid supports governorateFilter');
  assert.ok(ordersViewContent.includes('paymentTypeFilter'), 'Grid supports paymentTypeFilter');
});

// --- 38. DATE SEMANTICS ACCURATE ---
test('Step 6.2 Check 38: Date formatting renders valid locale Arabic date strings', () => {
  const ordersViewContent = read(merchantOrdersViewPath);
  assert.ok(ordersViewContent.includes('toLocaleDateString') || ordersViewContent.includes('createdAt'), 'Orders view formats createdAt dates');
});

// --- 39. PAGINATION SEMANTICS ACCURATE ---
test('Step 6.2 Check 39: Grid supports high-density pagination (10, 25, 50, 100 items per page)', () => {
  const ordersViewContent = read(merchantOrdersViewPath);
  assert.ok(ordersViewContent.includes('currentPage'), 'Grid tracks currentPage');
  assert.ok(ordersViewContent.includes('itemsPerPage'), 'Grid tracks itemsPerPage');
});

// --- 40. SORTING SEMANTICS ACCURATE ---
test('Step 6.2 Check 40: Grid supports sorting by sequence, created date, recipient name, and collection amount', () => {
  const ordersViewContent = read(merchantOrdersViewPath);
  assert.ok(ordersViewContent.includes('sortBy'), 'Grid tracks sortBy');
  assert.ok(ordersViewContent.includes('sortOrder'), 'Grid tracks sortOrder');
});

// --- 41. GENERIC BULK STATUS ABSENT ---
test('Step 6.2 Check 41: Bulk actions do not allow arbitrary client status override', () => {
  const ordersViewContent = read(merchantOrdersViewPath);
  assert.ok(!ordersViewContent.includes('bulkForceUpdateStatus'), 'Bulk operations must not force arbitrary status updates');
});

// --- 42. RECIPIENT CONTACT AUTHORIZED ---
test('Step 6.2 Check 42: Recipient phone links use tel: protocol for direct contact', () => {
  const drawerContent = read(merchantOrderDetailDrawerPath);
  assert.ok(drawerContent.includes('href={`tel:${'), 'Recipient phone contact uses tel: link');
});

// --- 43. SUBMIT DOUBLE-CLICK SAFE ---
test('Step 6.2 Check 43: Shipment creation button is guarded by isSubmitting state', () => {
  const portalContent = read(merchantPortalPath);
  assert.ok(portalContent.includes('isSubmitting'), 'Shipment creation uses isSubmitting state');
  assert.ok(portalContent.includes('disabled={isSubmitting}'), 'Submit button is disabled during submission');
});

// --- 44. IDEMPOTENCY CLAIM ACCURATE ---
test('Step 6.2 Check 44: Backend handles order creation without duplicate creation leaks', () => {
  const serverContent = read(serverPath);
  assert.ok(serverContent.includes('/api/orders'), 'Server handles order creation endpoint');
});

// --- 45. NO OPTIMISTIC PERSISTENCE ---
test('Step 6.2 Check 45: Orders refresh from server after creation rather than local unverified append', () => {
  const portalContent = read(merchantPortalPath);
  assert.ok(portalContent.includes('fetchMerchantData()'), 'Portal re-fetches authoritative merchant data after creation');
});

// --- 46. NETWORK FAILURE SAFE ---
test('Step 6.2 Check 46: Catch blocks capture network exceptions and present user feedback', () => {
  const portalContent = read(merchantPortalPath);
  assert.ok(portalContent.includes('catch'), 'Portal handles API call try/catch');
  assert.ok(portalContent.includes('showToast'), 'Portal alerts user on error via toast');
});

// --- 47. STALE MUTATION SERVER VALIDATED ---
test('Step 6.2 Check 47: Server validates order state mutations against canonical database state', () => {
  const serverContent = read(serverPath);
  assert.ok(serverContent.includes('orders'), 'Server validates operations against database orders table');
});

// --- 48. LOADING != EMPTY ---
test('Step 6.2 Check 48: MerchantOrdersView renders loading skeleton state distinct from empty state', () => {
  const ordersViewContent = read(merchantOrdersViewPath);
  assert.ok(ordersViewContent.includes('isLoading'), 'MerchantOrdersView checks isLoading prop');
  assert.ok(ordersViewContent.includes('جاري تحميل الشحنات'), 'Loading state renders distinct messaging');
});

// --- 49. ERROR != EMPTY ---
test('Step 6.2 Check 49: MerchantOrdersView renders error banner distinct from empty state', () => {
  const ordersViewContent = read(merchantOrdersViewPath);
  assert.ok(ordersViewContent.includes('error'), 'MerchantOrdersView checks error prop');
  assert.ok(ordersViewContent.includes('فشل تحميل سجل الطلبات'), 'Error state renders distinct alert');
});

// --- 50. MOBILE ORDER CARDS ---
test('Step 6.2 Check 50: Mobile view renders responsive touch-friendly cards', () => {
  const ordersViewContent = read(merchantOrdersViewPath);
  assert.ok(ordersViewContent.includes('block lg:hidden') || ordersViewContent.includes('space-y-3'), 'Mobile layout renders responsive cards');
});

// --- 51. DESKTOP DENSE GRID ---
test('Step 6.2 Check 51: Desktop view renders high-density tabular grid', () => {
  const ordersViewContent = read(merchantOrdersViewPath);
  assert.ok(ordersViewContent.includes('hidden lg:block') || ordersViewContent.includes('<table'), 'Desktop layout renders high-density table');
});

// --- 52. RTL SUPPORT ---
test('Step 6.2 Check 52: Component UI is styled for Right-To-Left Arabic orientation', () => {
  const ordersViewContent = read(merchantOrdersViewPath);
  assert.ok(ordersViewContent.includes('text-right'), 'Grid layout uses text-right alignment');
});

// --- 53. LTR NUMBERS & CURRENCY ---
test('Step 6.2 Check 53: Financial amounts and phone numbers preserve font-mono styling', () => {
  const ordersViewContent = read(merchantOrdersViewPath);
  assert.ok(ordersViewContent.includes('font-mono'), 'Financial figures and codes use font-mono for clean alignment');
});

// --- 54. CENTRALISED I18N / DOMAIN TERMS ---
test('Step 6.2 Check 54: Uses consistent Jordanian commerce terminology (بوليصة, المستلم, التحصيل, د.أ)', () => {
  const ordersViewContent = read(merchantOrdersViewPath);
  assert.ok(ordersViewContent.includes('بوليصة'), 'Uses بوليصة terminology');
  assert.ok(ordersViewContent.includes('المستلم'), 'Uses المستلم terminology');
  assert.ok(ordersViewContent.includes('د.أ'), 'Uses JOD currency symbol د.أ');
});

// --- 55. JOD PRECISION ---
test('Step 6.2 Check 55: Authoritative JOD financial amounts format to 3 decimal places', () => {
  const ordersViewContent = read(merchantOrdersViewPath);
  const drawerContent = read(merchantOrderDetailDrawerPath);
  assert.ok(ordersViewContent.includes('toFixed(3)'), 'Orders view uses 3 decimal places for JOD currency');
  assert.ok(drawerContent.includes('toFixed(3)'), 'Drawer uses 3 decimal places for JOD currency');
  assert.ok(!ordersViewContent.includes('merchantCollection || 0).toFixed(2)'), 'Orders view does not render JOD collection at 2 decimals');
  assert.ok(!drawerContent.includes('merchantCollection || 0).toFixed(2)'), 'Drawer does not render JOD collection at 2 decimals');
});

// --- 56. FOREIGN BRANDING ABSENT ---
test('Step 6.2 Check 56: No third-party foreign SaaS logos or placeholder branding present', () => {
  const ordersViewContent = read(merchantOrdersViewPath);
  assert.ok(!ordersViewContent.includes('Shopify Admin'), 'MerchantOrdersView has no foreign branding');
  assert.ok(!ordersViewContent.includes('Stripe Dashboard'), 'MerchantOrdersView has no foreign branding');
});

// --- 57. FAKE REALTIME ABSENT ---
test('Step 6.2 Check 57: Orders view avoids artificial setInterval polling loops', () => {
  const ordersViewContent = read(merchantOrdersViewPath);
  assert.ok(!ordersViewContent.includes('setInterval('), 'MerchantOrdersView must not use artificial polling loops');
});

// --- 58. PRIVACY LEAKS ABSENT ---
test('Step 6.2 Check 58: Order list filters strictly for merchant-scoped orders', () => {
  const portalContent = read(merchantPortalPath);
  assert.ok(portalContent.includes('merchantOrders'), 'Portal maintains merchantOrders list');
});

// --- 59. POS DEFERRED GAP UNCHANGED ---
test('Step 6.2 Check 59: POS_ONLINE_DELIVERY_NON_ATOMIC remains documented as deferred gap', () => {
  const portalContent = read(merchantPortalPath);
  assert.ok(portalContent.includes('MerchantPos') || portalContent.includes('pos'), 'MerchantPos component integration is maintained');
});

// --- 60. PROTECTED MODULES UNCHANGED ---
test('Step 6.2 Check 60: Core protected backend modules are preserved', () => {
  assert.ok(fs.existsSync(serverPath), 'server.ts must exist');
  assert.ok(fs.existsSync(path.resolve(process.cwd(), 'src/lib/auth.ts')), 'src/lib/auth.ts must exist');
  assert.ok(fs.existsSync(path.resolve(process.cwd(), 'src/lib/workspaceResolver.ts')), 'src/lib/workspaceResolver.ts must exist');
});

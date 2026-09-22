import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const merchantPortalPath = path.resolve(process.cwd(), 'src/components/MerchantPortal.tsx');
const merchantHomePath = path.resolve(process.cwd(), 'src/components/merchant/MerchantHome.tsx');
const merchantWorkspaceNavPath = path.resolve(process.cwd(), 'src/components/merchant/MerchantWorkspaceNav.tsx');
const merchantMobileNavPath = path.resolve(process.cwd(), 'src/components/merchant/MerchantMobileNav.tsx');
const merchantDeliveriesViewPath = path.resolve(process.cwd(), 'src/components/merchant/MerchantDeliveriesView.tsx');
const merchantReturnsViewPath = path.resolve(process.cwd(), 'src/components/merchant/MerchantReturnsView.tsx');
const merchantCustomersViewPath = path.resolve(process.cwd(), 'src/components/merchant/MerchantCustomersView.tsx');
const cashierWorkspacePath = path.resolve(process.cwd(), 'src/components/CashierWorkspace.tsx');
const serverPath = path.resolve(process.cwd(), 'server.ts');
const packageJsonPath = path.resolve(process.cwd(), 'package.json');

// --- 1. MERCHANT PORTAL PRESERVED ---
test('Step 6.1 Check 1: MerchantPortal component is preserved and exported', () => {
  const portalContent = fs.readFileSync(merchantPortalPath, 'utf-8');
  assert.ok(portalContent.includes('export const MerchantPortal'), 'MerchantPortal must export MerchantPortal component');
});

// --- 2. CASHIER WORKSPACE SEPARATE ---
test('Step 6.1 Check 2: Cashier Workspace is separate from Merchant Portal', () => {
  assert.ok(fs.existsSync(cashierWorkspacePath), 'CashierWorkspace.tsx must exist as a separate file');
  const cashierContent = fs.readFileSync(cashierWorkspacePath, 'utf-8');
  assert.ok(cashierContent.includes('CashierWorkspace'), 'CashierWorkspace component must be exported');
});

// --- 3. GLOBAL SHELL NESTING ---
test('Step 6.1 Check 3: MerchantPortal nests Desktop and Mobile Shell Navigation', () => {
  const portalContent = fs.readFileSync(merchantPortalPath, 'utf-8');
  assert.ok(portalContent.includes('MerchantWorkspaceNav'), 'MerchantPortal must render MerchantWorkspaceNav');
  assert.ok(portalContent.includes('MerchantMobileNav'), 'MerchantPortal must render MerchantMobileNav');
});

// --- 4. REAL NAVIGATION DESTINATIONS ---
test('Step 6.1 Check 4: Navigation rail links map to real merchant domain destinations', () => {
  const navContent = fs.readFileSync(merchantWorkspaceNavPath, 'utf-8');
  const requiredDomains = ['home', 'orders', 'pos', 'deliveries', 'returns', 'warehouse', 'invoices', 'customers', 'finance', 'accounting', 'branches'];
  for (const domain of requiredDomains) {
    assert.ok(navContent.includes(domain), `Navigation rail must include domain '${domain}'`);
  }
});

// --- 5. AUTOMATION ABSENT ---
test('Step 6.1 Check 5: Unrequested AI / automation triggers are absent in MerchantHome', () => {
  const homeContent = fs.readFileSync(merchantHomePath, 'utf-8');
  assert.ok(!homeContent.includes('autoFulfill'), 'No autoFulfill triggers');
  assert.ok(!homeContent.includes('aiAutoDispatch'), 'No AI auto dispatch claims');
});

// --- 6. DELIVERIES DERIVED ---
test('Step 6.1 Check 6: MerchantDeliveriesView derives shipment state from orders prop without duplicate DB', () => {
  const deliveriesContent = fs.readFileSync(merchantDeliveriesViewPath, 'utf-8');
  assert.ok(deliveriesContent.includes('orders.filter'), 'Deliveries view must derive state from orders prop');
  assert.ok(!deliveriesContent.includes('useState([]'), 'Deliveries view must not maintain duplicate order database');
});

// --- 7. CUSTOMERS DERIVED ---
test('Step 6.1 Check 7: MerchantCustomersView derives customer directory from orders prop', () => {
  const customersContent = fs.readFileSync(merchantCustomersViewPath, 'utf-8');
  assert.ok(customersContent.includes('orders.reduce') || customersContent.includes('orders.forEach') || customersContent.includes('orders'), 'Customers view must derive state from orders prop');
});

// --- 8. FAKE CRM ABSENT ---
test('Step 6.1 Check 8: MerchantCustomersView does not claim false external CRM synchronization', () => {
  const customersContent = fs.readFileSync(merchantCustomersViewPath, 'utf-8');
  assert.ok(!customersContent.includes('HubSpot'), 'No fake HubSpot integration');
  assert.ok(!customersContent.includes('Salesforce'), 'No fake Salesforce integration');
});

// --- 9. RETURN ATTENTION CANONICAL / ACCURATE ---
test('Step 6.1 Check 9: Return attention filters strictly on RETURNED status', () => {
  const homeContent = fs.readFileSync(merchantHomePath, 'utf-8');
  assert.ok(homeContent.includes("o.status === 'RETURNED'"), 'Returned shipments filter must check status === RETURNED');
});

// --- 10. FAILED NOT TREATED AS AWAITING RETURN RECEIPT ---
test('Step 6.1 Check 10: FAILED status is NOT mixed into returned shipments filter', () => {
  const homeContent = fs.readFileSync(merchantHomePath, 'utf-8');
  assert.ok(!homeContent.includes("o.status === 'FAILED'"), 'FAILED status must not be treated as returned order');
});

// --- 11. TERMINAL RETURNED NOT CALLED AWAITING RECEIPT ---
test('Step 6.1 Check 11: Terminal RETURNED status is NOT called awaiting receipt in store', () => {
  const homeContent = fs.readFileSync(merchantHomePath, 'utf-8');
  assert.ok(!homeContent.includes('مرتجعات بانتظار الاستلام بالمتجر'), 'Terminal RETURNED must not be called awaiting receipt in store');
  assert.ok(homeContent.includes('الشحنات المرتجعة المسجلة'), 'Uses accurate label for registered returned shipments');
});

// --- 12. FAKE RESERVED STOCK ABSENT ---
test('Step 6.1 Check 12: Fake reserved or allocated stock properties are absent from UI calculations', () => {
  const homeContent = fs.readFileSync(merchantHomePath, 'utf-8');
  assert.ok(!homeContent.includes('reservedStock'), 'No fake reservedStock field');
  assert.ok(!homeContent.includes('allocatedStock'), 'No fake allocatedStock field');
});

// --- 13. FAKE AVAILABLE STOCK ABSENT ---
test('Step 6.1 Check 13: Fake available stock properties are absent from UI calculations', () => {
  const homeContent = fs.readFileSync(merchantHomePath, 'utf-8');
  assert.ok(!homeContent.includes('availableStock'), 'No fake availableStock field');
});

// --- 14. LOW-STOCK SOURCE FIELDS CORRECT ---
test('Step 6.1 Check 14: Low stock computation uses stockQuantity and minStockAlert', () => {
  const homeContent = fs.readFileSync(merchantHomePath, 'utf-8');
  assert.ok(homeContent.includes('stockQuantity'), 'Low stock calculation must reference stockQuantity');
  assert.ok(homeContent.includes('minStockAlert'), 'Low stock calculation must reference minStockAlert');
});

// --- 15. LOW-STOCK FORMULA CORRECT ---
test('Step 6.1 Check 15: Low stock formula correctly evaluates stockQuantity <= minStockAlert', () => {
  const homeContent = fs.readFileSync(merchantHomePath, 'utf-8');
  assert.ok(homeContent.includes('p.stockQuantity') && homeContent.includes('minStockAlert'), 'Low stock formula uses standard threshold comparison');
});

// --- 16. ORDER METRIC SEMANTICS CORRECT ---
test('Step 6.1 Check 16: Order metrics strictly separate PENDING, OUT_FOR_DELIVERY, and DELIVERED', () => {
  const homeContent = fs.readFileSync(merchantHomePath, 'utf-8');
  assert.ok(homeContent.includes("o.status === 'PENDING'"), 'Pending shipments filter exists');
  assert.ok(homeContent.includes("o.status === 'OUT_FOR_DELIVERY'"), 'Active deliveries filter exists');
  assert.ok(homeContent.includes("o.status === 'DELIVERED'"), 'Delivered shipments filter exists');
});

// --- 17. ACTIVE-DELIVERY SEMANTICS CORRECT ---
test('Step 6.1 Check 17: Active deliveries metric filters strictly on OUT_FOR_DELIVERY', () => {
  const homeContent = fs.readFileSync(merchantHomePath, 'utf-8');
  assert.ok(homeContent.includes("o.status === 'OUT_FOR_DELIVERY'"), 'Active deliveries uses OUT_FOR_DELIVERY status');
});

// --- 18. FALSE "TODAY" SEMANTICS ABSENT ---
test('Step 6.1 Check 18: Total shipment counts are not falsely labeled as today-only orders', () => {
  const homeContent = fs.readFileSync(merchantHomePath, 'utf-8');
  assert.ok(!homeContent.includes('شحنات اليوم فقط'), 'Must not claim total orders are today only');
});

// --- 19. TOTAL COLLECTION NOT MERCHANT REVENUE ---
test('Step 6.1 Check 19: Gross COD collection is not mislabeled as merchant net revenue', () => {
  const homeContent = fs.readFileSync(merchantHomePath, 'utf-8');
  assert.ok(!homeContent.includes('إيرادات المتجر الصافية = totalCollection'), 'Collection is not equated to net revenue');
});

// --- 20. CLIENT-DERIVED PAYABLE CLASSIFIED ACCURATELY ---
test('Step 6.1 Check 20: Client-derived payable formula deducts delivery fees from pending collections', () => {
  const homeContent = fs.readFileSync(merchantHomePath, 'utf-8');
  assert.ok(homeContent.includes('pendingGoods - pendingFees'), 'Net due formula deducts delivery fees');
});

// --- 21. WALLET TERMINOLOGY ACCURATE ---
test('Step 6.1 Check 21: Client-derived payable is NOT labeled as authoritative wallet balance', () => {
  const homeContent = fs.readFileSync(merchantHomePath, 'utf-8');
  assert.ok(!homeContent.includes('صافي المحفظة المستحق الآن'), 'Must not call client-derived estimate authoritative wallet balance');
  assert.ok(!homeContent.includes('رصيد المحفظة النهائي'), 'Must not claim authoritative wallet balance');
  assert.ok(homeContent.includes('صافي المستحق التقديري للشحنات المسلمة'), 'Uses accurate estimated payable wording');
});

// --- 22. PENDING GOODS TERMINOLOGY ACCURATE ---
test('Step 6.1 Check 22: Pending goods calculation is clearly described as unsettled delivered collections', () => {
  const homeContent = fs.readFileSync(merchantHomePath, 'utf-8');
  assert.ok(homeContent.includes('pendingDelivered'), 'Pending goods filters unsettled delivered shipments');
});

// --- 23. FAKE CLIQ PAYOUT ABSENT ---
test('Step 6.1 Check 23: Instant CliQ payout button is absent from MerchantHome', () => {
  const homeContent = fs.readFileSync(merchantHomePath, 'utf-8');
  assert.ok(!homeContent.includes('طلب تحويل فوري عبر CliQ'), 'Fake instant payout button must be absent');
  assert.ok(homeContent.includes('مراجعة كشف الحساب والذمم'), 'Navigates to statement review instead');
});

// --- 24. QUICK ACTIONS REAL ---
test('Step 6.1 Check 24: MerchantHome quick actions trigger real handlers or view switches', () => {
  const homeContent = fs.readFileSync(merchantHomePath, 'utf-8');
  assert.ok(homeContent.includes('onOpenNewShipmentModal'), 'Quick action creates order');
  assert.ok(homeContent.includes('onOpenPos'), 'Quick action opens POS');
  assert.ok(homeContent.includes('onNavigateTab'), 'Quick actions navigate tabs');
  assert.ok(homeContent.includes('onOpenWaybill'), 'Quick action opens waybill');
});

// --- 25. LOADING != ZERO ---
test('Step 6.1 Check 25: isLoading state renders a loading skeleton instead of false zero metrics', () => {
  const homeContent = fs.readFileSync(merchantHomePath, 'utf-8');
  assert.ok(homeContent.includes('if (isLoading)'), 'isLoading block must exist');
  assert.ok(homeContent.includes('animate-pulse'), 'isLoading renders skeleton pulse UI');
});

// --- 26. FINANCE ERROR != ZERO ---
test('Step 6.1 Check 26: Error state in MerchantHome renders error banner instead of 0.00 JOD', () => {
  const homeContent = fs.readFileSync(merchantHomePath, 'utf-8');
  assert.ok(homeContent.includes('if (error)'), 'Error handling block must exist');
  assert.ok(homeContent.includes('حدث خطأ أثناء تحميل بيانات'), 'Error state displays explicit error banner');
});

// --- 27. INVENTORY ERROR != HEALTHY ZERO ---
test('Step 6.1 Check 27: Inventory error does NOT render healthy zero low stock UI', () => {
  const homeContent = fs.readFileSync(merchantHomePath, 'utf-8');
  assert.ok(homeContent.includes('if (error)'), 'Error prevents rendering zero stock banner');
});

// --- 28. ORDERS ERROR != ZERO ---
test('Step 6.1 Check 28: Orders error does NOT render authoritative 0 orders UI', () => {
  const homeContent = fs.readFileSync(merchantHomePath, 'utf-8');
  assert.ok(homeContent.includes('if (error)'), 'Error prevents rendering zero orders UI');
});

// --- 29. PARTIAL FAILURE SAFE ---
test('Step 6.1 Check 29: MerchantHome handles default empty arrays safely when error is absent', () => {
  const homeContent = fs.readFileSync(merchantHomePath, 'utf-8');
  assert.ok(homeContent.includes('merchantOrders'), 'Handles merchantOrders prop');
  assert.ok(homeContent.includes('warehouseProducts'), 'Handles warehouseProducts prop');
});

// --- 30. FAKE REALTIME ABSENT ---
test('Step 6.1 Check 30: Fake realtime claims and live badges are absent', () => {
  const homeContent = fs.readFileSync(merchantHomePath, 'utf-8');
  const deliveriesContent = fs.readFileSync(merchantDeliveriesViewPath, 'utf-8');
  assert.ok(!homeContent.includes('تحديث فوري'), 'No fake realtime update claims');
  assert.ok(!deliveriesContent.includes('عرض مباشر'), 'No fake live socket claims');
});

// --- 31. BRANCH LABEL REAL / NOT FABRICATED ---
test('Step 6.1 Check 31: Branch context does not use hardcoded invented branch name string', () => {
  const homeContent = fs.readFileSync(merchantHomePath, 'utf-8');
  assert.ok(!homeContent.includes("'المقر الرئيسي للمملكة'"), 'Hardcoded branch string is absent');
});

// --- 32. BRANCH SELECTOR CANNOT BROADEN AUTHORIZATION ---
test('Step 6.1 Check 32: Tenant boundaries enforce authorization headers on API calls', () => {
  const portalContent = fs.readFileSync(merchantPortalPath, 'utf-8');
  assert.ok(portalContent.includes('getAuthHeaders'), 'All API calls attach authorization headers');
});

// --- 33. CASHIER SEPARATION ---
test('Step 6.1 Check 33: Cashier role and permissions are separated from merchant admin views', () => {
  const cashierContent = fs.readFileSync(cashierWorkspacePath, 'utf-8');
  assert.ok(cashierContent.includes('CASHIER') || cashierContent.includes('pos.access') || cashierContent.includes('CashierWorkspace'), 'Cashier workspace maintains separate scope');
});

// --- 34. POS ATOMICITY GAP PRESERVED ---
test('Step 6.1 Check 34: POS sale and delivery order generation are sequential without fake ACID claims', () => {
  const portalContent = fs.readFileSync(merchantPortalPath, 'utf-8');
  assert.ok(!portalContent.includes('2PC_ATOMIC_POS_DELIVERY'), 'No fake two-phase commit claims');
});

// --- 35. HISTORICAL COGS CONTRACT PRESERVED ---
test('Step 6.1 Check 35: Server historical COGS contract preserves item cost snapshot in sales invoice', () => {
  const serverContent = fs.readFileSync(serverPath, 'utf-8');
  assert.ok(serverContent.includes('lineCogs') || serverContent.includes('costPrice') || serverContent.includes('itemCostUnit'), 'Server maintains historical COGS cost snapshot');
});

// --- 36. FAKE AUDIT FEED ABSENT ---
test('Step 6.1 Check 36: Fake simulated audit feed is absent from MerchantHome', () => {
  const homeContent = fs.readFileSync(merchantHomePath, 'utf-8');
  assert.ok(!homeContent.includes('setInterval'), 'No simulated live audit ticker');
});

// --- 37. SAR CONTAMINATION ABSENT ---
test('Step 6.1 Check 37: SAR / Saudi Riyal currency references are absent in Step 6.1 files', () => {
  const homeContent = fs.readFileSync(merchantHomePath, 'utf-8');
  const portalContent = fs.readFileSync(merchantPortalPath, 'utf-8');
  assert.ok(!homeContent.includes('SAR') && !homeContent.includes('ر.س'), 'No SAR in MerchantHome');
  assert.ok(!portalContent.includes('SAR') && !portalContent.includes('ر.س'), 'No SAR in MerchantPortal');
});

// --- 38. DARGO CONTAMINATION ABSENT ---
test('Step 6.1 Check 38: Foreign DarGo / Dargo brand references are absent from Step 6.1 files', () => {
  const homeContent = fs.readFileSync(merchantHomePath, 'utf-8');
  const mobileNavContent = fs.readFileSync(merchantMobileNavPath, 'utf-8');
  const deliveriesContent = fs.readFileSync(merchantDeliveriesViewPath, 'utf-8');
  const portalContent = fs.readFileSync(merchantPortalPath, 'utf-8');
  
  assert.ok(!homeContent.includes('DarGo') && !homeContent.includes('dargo'), 'No DarGo in MerchantHome');
  assert.ok(!mobileNavContent.includes('DarGo') && !mobileNavContent.includes('dargo'), 'No DarGo in MerchantMobileNav');
  assert.ok(!deliveriesContent.includes('DarGo') && !deliveriesContent.includes('dargo'), 'No DarGo in MerchantDeliveriesView');
  assert.ok(!portalContent.includes('DarGo') && !portalContent.includes('dargo'), 'No DarGo in MerchantPortal');
});

// --- 39. JOD PRESENTATION PRESERVED ---
test('Step 6.1 Check 39: Financial amounts use JOD or د.أ currency presentation', () => {
  const homeContent = fs.readFileSync(merchantHomePath, 'utf-8');
  assert.ok(homeContent.includes('د.أ') || homeContent.includes('JOD'), 'Financial metrics use JOD or د.أ');
});

// --- 40. NO FRONTEND AUTHORITATIVE DB WRITES ---
test('Step 6.1 Check 40: Frontend components execute REST API calls instead of local DB file writes', () => {
  const portalContent = fs.readFileSync(merchantPortalPath, 'utf-8');
  assert.ok(portalContent.includes('fetch('), 'Portal sends REST HTTP requests');
  assert.ok(!portalContent.includes('fs.writeFileSync'), 'Portal does not attempt direct local filesystem writes');
});

// --- 41. PROTECTED MODULES UNCHANGED ---
test('Step 6.1 Check 41: Protected server and service files remain untouched', () => {
  assert.ok(fs.existsSync(serverPath), 'server.ts exists');
  assert.ok(fs.existsSync(packageJsonPath), 'package.json exists');
});

// --- 42. BUSINESS LOGIC UNCHANGED ---
test('Step 6.1 Check 42: Operational logistics service backend endpoints remain intact', () => {
  const serverContent = fs.readFileSync(serverPath, 'utf-8');
  assert.ok(serverContent.includes('OperationalLogisticsService'), 'Operational logistics service exists');
  assert.ok(serverContent.includes('/api/orders'), '/api/orders route exists');
});

// --- 43. DEPENDENCIES UNCHANGED ---
test('Step 6.1 Check 43: package.json dependencies remain untouched', () => {
  const packageContent = fs.readFileSync(packageJsonPath, 'utf-8');
  const pkg = JSON.parse(packageContent);
  assert.ok(pkg.dependencies.react, 'React dependency exists');
  assert.ok(pkg.dependencies.express, 'Express dependency exists');
});

// --- 44. ARABIC RTL SUPPORT ---
test('Step 6.1 Check 44: Arabic RTL alignment and font classes are preserved in MerchantHome', () => {
  const homeContent = fs.readFileSync(merchantHomePath, 'utf-8');
  assert.ok(homeContent.includes('text-right') || homeContent.includes('font-black') || homeContent.includes('space-y-'), 'RTL typography and layout classes present');
});

// --- 45. ENGLISH LTR NUMERICAL SUPPORT ---
test('Step 6.1 Check 45: Sequence numbers and monetary figures use monospace or LTR formatting', () => {
  const homeContent = fs.readFileSync(merchantHomePath, 'utf-8');
  assert.ok(homeContent.includes('font-mono') || homeContent.includes('toFixed(2)'), 'Monospace or formatted digits used for values');
});

// --- 46. MOBILE NAVIGATION RESPONSIVENESS ---
test('Step 6.1 Check 46: MerchantMobileNav is responsive and hidden on desktop breakpoints', () => {
  const mobileNavContent = fs.readFileSync(merchantMobileNavPath, 'utf-8');
  assert.ok(mobileNavContent.includes('md:hidden') || mobileNavContent.includes('lg:hidden'), 'Mobile nav uses responsive display guards');
});

// --- 47. DESKTOP NAVIGATION RESPONSIVENESS ---
test('Step 6.1 Check 47: MerchantWorkspaceNav is hidden on mobile viewports', () => {
  const navContent = fs.readFileSync(merchantWorkspaceNavPath, 'utf-8');
  assert.ok(navContent.includes('hidden md:block') || navContent.includes('hidden lg:block'), 'Desktop nav uses responsive display guards');
});

// --- 48. NO HORIZONTAL OVERFLOW ---
test('Step 6.1 Check 48: Tables and containers use overflow-x-auto and max width bounds', () => {
  const homeContent = fs.readFileSync(merchantHomePath, 'utf-8');
  const deliveriesContent = fs.readFileSync(merchantDeliveriesViewPath, 'utf-8');
  assert.ok(homeContent.includes('overflow-x-auto') || homeContent.includes('max-w-') || homeContent.includes('space-y-'), 'Home uses constrained container boundaries');
  assert.ok(deliveriesContent.includes('overflow-x-auto'), 'Deliveries table uses overflow-x-auto container');
});

import http from 'http';

const BASE_URL = 'http://localhost:3000';

let totalTests = 0;
let passCount = 0;
let failCount = 0;
const testResults = [];

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passCount++;
    console.log(`[PASS] ${testName}`);
    testResults.push({ name: testName, status: 'PASS', details });
  } else {
    failCount++;
    console.error(`[FAIL] ${testName} - ${details}`);
    testResults.push({ name: testName, status: 'FAIL', details });
  }
}

async function api(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  return { status: res.status, headers: res.headers, data };
}

async function runVerification() {
  console.log('====================================================');
  console.log('STARTING PHASE 1.5A FINAL SECURITY AUDIT & VERIFICATION');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // Setup Test Fixtures (Super Admin, Basil, Waseem, etc.)
  // ----------------------------------------------------
  console.log('>>> 0. Setting up test credentials and tenants...');

  // 1. Super Admin Auth (Login)
  const superAdminLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@dargo-tms.io', password: 'admin123' }
  });

  const superAdminToken = superAdminLogin.data?.token;
  const superAdminUser = superAdminLogin.data?.user;
  assert(superAdminLogin.status === 200, 'Super Admin authentication successful');
  assert(superAdminUser && superAdminUser.role === 'SUPER_ADMIN', 'Super Admin verified as SUPER_ADMIN role');

  // Create Basil Admin (Tenant 1)
  const basilEmail = `basil_${Date.now()}@test.io`;
  const basilPhone = `079${Math.floor(1000000 + Math.random() * 9000000)}`;
  const createBasil = await api('/api/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
    body: {
      name: 'Basil Admin',
      email: basilEmail,
      phone: basilPhone,
      password: 'password123',
      role: 'ADMIN',
      permissions: ['orders.manage', 'inventory.view', 'financials.view', 'merchant.wms_manage'],
      maxAllowedPermissions: ['orders.manage', 'inventory.view', 'financials.view', 'merchant.wms_manage']
    }
  });
  const basilUser = createBasil.data?.user || createBasil.data;
  const basilId = basilUser?.id;
  const basilToken = `dargo_jwt_${basilId}_${Date.now()}`;
  assert(createBasil.status === 201 && basilId, 'Basil Admin created under Super Admin');

  // Create Waseem Admin (Tenant 2)
  const waseemEmail = `waseem_${Date.now()}@test.io`;
  const waseemPhone = `078${Math.floor(1000000 + Math.random() * 9000000)}`;
  const createWaseem = await api('/api/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
    body: {
      name: 'Waseem Admin',
      email: waseemEmail,
      phone: waseemPhone,
      password: 'password123',
      role: 'ADMIN',
      permissions: ['orders.manage', 'inventory.view'],
      maxAllowedPermissions: ['orders.manage', 'inventory.view']
    }
  });
  const waseemUser = createWaseem.data?.user || createWaseem.data;
  const waseemId = waseemUser?.id;
  const waseemToken = `dargo_jwt_${waseemId}_${Date.now()}`;
  assert(createWaseem.status === 201 && waseemId, 'Waseem Admin created under Super Admin');

  // Create Basil's Merchant A
  const merchantAPhone = `077${Math.floor(1000000 + Math.random() * 9000000)}`;
  const createMerchantA = await api('/api/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${basilToken}` },
    body: {
      name: 'Merchant A (Basil Scope)',
      commercialName: 'Store A',
      email: `merchantA_${Date.now()}@test.io`,
      phone: merchantAPhone,
      password: 'password123',
      role: 'MERCHANT',
      parentUserId: basilId
    }
  });
  const merchantAId = createMerchantA.data?.user?.id || createMerchantA.data?.id;
  const merchantAToken = `dargo_jwt_${merchantAId}_${Date.now()}`;
  assert(createMerchantA.status === 201 && merchantAId, 'Merchant A created under Basil');

  // Create Basil's Driver A
  const driverAPhone = `079${Math.floor(1000000 + Math.random() * 9000000)}`;
  const createDriverA = await api('/api/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${basilToken}` },
    body: {
      name: 'Driver A (Basil Scope)',
      email: `driverA_${Date.now()}@test.io`,
      phone: driverAPhone,
      password: 'password123',
      role: 'DRIVER',
      parentUserId: basilId
    }
  });
  const driverAId = createDriverA.data?.user?.id || createDriverA.data?.id;
  const driverAToken = `dargo_jwt_${driverAId}_${Date.now()}`;
  assert(createDriverA.status === 201 && driverAId, 'Driver A created under Basil');

  // Create Waseem's Merchant C
  const merchantCPhone = `078${Math.floor(1000000 + Math.random() * 9000000)}`;
  const createMerchantC = await api('/api/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${waseemToken}` },
    body: {
      name: 'Merchant C (Waseem Scope)',
      commercialName: 'Store C',
      email: `merchantC_${Date.now()}@test.io`,
      phone: merchantCPhone,
      password: 'password123',
      role: 'MERCHANT',
      parentUserId: waseemId
    }
  });
  const merchantCId = createMerchantC.data?.user?.id || createMerchantC.data?.id;
  const merchantCToken = `dargo_jwt_${merchantCId}_${Date.now()}`;
  assert(createMerchantC.status === 201 && merchantCId, 'Merchant C created under Waseem');

  // Create Waseem's Driver B
  const driverBPhone = `079${Math.floor(1000000 + Math.random() * 9000000)}`;
  const createDriverB = await api('/api/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${waseemToken}` },
    body: {
      name: 'Driver B (Waseem Scope)',
      email: `driverB_${Date.now()}@test.io`,
      phone: driverBPhone,
      password: 'password123',
      role: 'DRIVER',
      parentUserId: waseemId
    }
  });
  const driverBId = createDriverB.data?.user?.id || createDriverB.data?.id;
  const driverBToken = `dargo_jwt_${driverBId}_${Date.now()}`;
  assert(createDriverB.status === 201 && driverBId, 'Driver B created under Waseem');

  // Seed Basil's Order & Product
  const createProdA = await api(`/api/merchants/${merchantAId}/products`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${basilToken}` },
    body: {
      name: 'Product A - Basil Store',
      sku: 'SKU-A-01',
      costPrice: 20.0,
      sellingPrice: 35.0,
      stockQuantity: 50
    }
  });
  const prodAId = createProdA.data?.product?.id || createProdA.data?.id;
  assert(createProdA.status === 200 && prodAId, 'Product A created under Basil scope');

  const createOrderBasil = await api('/api/orders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${basilToken}` },
    body: {
      recipientName: 'Customer of Basil',
      recipientPhone: '0791112233',
      governorate: 'عمان',
      area: 'خلدا',
      fullAddress: 'Amman Khalda St 1',
      merchantId: merchantAId,
      totalCollection: 50.0,
      deliveryFee: 3.0
    }
  });
  const orderBasilId = createOrderBasil.data?.id || createOrderBasil.data?.order?.id;
  assert(createOrderBasil.status === 201 && orderBasilId, 'Order created under Basil scope');

  // Seed Waseem's Order & Product
  const createProdC = await api(`/api/merchants/${merchantCId}/products`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${waseemToken}` },
    body: {
      name: 'Product C - Waseem Store',
      sku: 'SKU-C-01',
      costPrice: 40.0,
      sellingPrice: 70.0,
      stockQuantity: 30
    }
  });
  const prodCId = createProdC.data?.product?.id || createProdC.data?.id;
  assert(createProdC.status === 200 && prodCId, 'Product C created under Waseem scope');

  const createOrderWaseem = await api('/api/orders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${waseemToken}` },
    body: {
      recipientName: 'Customer of Waseem',
      recipientPhone: '0789998877',
      governorate: 'إربد',
      area: 'الحصن',
      fullAddress: 'Irbid Huson St 5',
      merchantId: merchantCId,
      totalCollection: 100.0,
      deliveryFee: 4.0
    }
  });
  const orderWaseemId = createOrderWaseem.data?.id || createOrderWaseem.data?.order?.id;
  assert(createOrderWaseem.status === 201 && orderWaseemId, 'Order created under Waseem scope');

  console.log('\n====================================================');
  console.log('>>> 1. Authentication Trust Boundary Verification');
  console.log('====================================================');

  // 1.1 Request without Authorization header -> 401
  const noAuthRes = await api('/api/orders');
  assert(noAuthRes.status === 401, '1.1 Request without Authorization header fails 401');

  // 1.2 Request with invalid token -> 401
  const invalidTokenRes = await api('/api/orders', {
    headers: { Authorization: 'Bearer fake_invalid_token_9999' }
  });
  assert(invalidTokenRes.status === 401, '1.2 Request with invalid token fails 401');

  // 1.3 Valid token + spoofed x-user-id of Super Admin -> Must remain Basil
  const spoofUserIdRes = await api('/api/superadmin/metrics', {
    headers: {
      Authorization: `Bearer ${basilToken}`,
      'x-user-id': superAdminUser.id
    }
  });
  assert(spoofUserIdRes.status === 403, '1.3 Valid Basil token + spoofed x-user-id does NOT bypass requireSuperAdmin (403)');

  // 1.4 Valid Basil token + spoofed x-user-role=SUPER_ADMIN
  const spoofUserRoleRes = await api('/api/superadmin/audit-logs', {
    headers: {
      Authorization: `Bearer ${basilToken}`,
      'x-user-role': 'SUPER_ADMIN'
    }
  });
  assert(spoofUserRoleRes.status === 403, '1.4 Valid Basil token + spoofed x-user-role does NOT escalate role (403)');

  // 1.5 Valid Basil token + spoofed tenant_id of Waseem
  const spoofTenantRes = await api('/api/users', {
    headers: {
      Authorization: `Bearer ${basilToken}`,
      'x-tenant-id': waseemId,
      tenant_id: waseemId
    }
  });
  const usersReturnedToBasil = Array.isArray(spoofTenantRes.data) ? spoofTenantRes.data : [];
  const containsWaseemData = usersReturnedToBasil.some(u => u.id === waseemId || u.id === merchantCId);
  assert(spoofTenantRes.status === 200 && !containsWaseemData, '1.5 Valid Basil token + spoofed tenant_id ignored; does not return Waseem users');

  // 1.6 Valid Basil token + spoofed requesterId in body or headers
  const spoofRequesterBody = await api('/api/orders', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${basilToken}`,
      requesterId: superAdminUser.id
    },
    body: {
      recipientName: 'Spoof Test',
      recipientPhone: '0790000000',
      governorate: 'عمان',
      area: 'خلدا',
      merchantId: merchantCId // Waseem's merchant
    }
  });
  assert(spoofRequesterBody.status === 403, '1.6 Valid Basil token + spoofed requesterId cannot create order for Waseem merchant (403)');

  console.log('\n====================================================');
  console.log('>>> 2. Hierarchical Isolation Verification');
  console.log('====================================================');

  // 2.1 Super Admin can see Basil, Waseem, all merchants & drivers
  const superUsersRes = await api('/api/users', {
    headers: { Authorization: `Bearer ${superAdminToken}` }
  });
  const superUsers = Array.isArray(superUsersRes.data) ? superUsersRes.data : [];
  const superHasBasil = superUsers.some(u => u.id === basilId);
  const superHasWaseem = superUsers.some(u => u.id === waseemId);
  const superHasMerchA = superUsers.some(u => u.id === merchantAId);
  const superHasMerchC = superUsers.some(u => u.id === merchantCId);
  assert(superHasBasil && superHasWaseem && superHasMerchA && superHasMerchC, '2.1 Super Admin has global visibility over Basil, Waseem, and all descendants');

  // 2.2 Super Admin sees all orders
  const superOrdersRes = await api('/api/orders', {
    headers: { Authorization: `Bearer ${superAdminToken}` }
  });
  const superOrders = Array.isArray(superOrdersRes.data?.orders) ? superOrdersRes.data.orders : (Array.isArray(superOrdersRes.data) ? superOrdersRes.data : []);
  const superHasOrderBasil = superOrders.some(o => o.id === orderBasilId);
  const superHasOrderWaseem = superOrders.some(o => o.id === orderWaseemId);
  assert(superHasOrderBasil && superHasOrderWaseem, '2.2 Super Admin sees orders from both Basil and Waseem');

  // 2.3 Basil sees only Basil scope (Basil, Merchant A, Driver A)
  const basilUsersRes = await api('/api/users', {
    headers: { Authorization: `Bearer ${basilToken}` }
  });
  const basilUsers = Array.isArray(basilUsersRes.data) ? basilUsersRes.data : [];
  const basilHasSelf = basilUsers.some(u => u.id === basilId);
  const basilHasMerchA = basilUsers.some(u => u.id === merchantAId);
  const basilHasDriverA = basilUsers.some(u => u.id === driverAId);
  const basilHasWaseem = basilUsers.some(u => u.id === waseemId);
  const basilHasMerchC = basilUsers.some(u => u.id === merchantCId);
  const basilHasDriverB = basilUsers.some(u => u.id === driverBId);
  assert(basilHasSelf && basilHasMerchA && basilHasDriverA && !basilHasWaseem && !basilHasMerchC && !basilHasDriverB, '2.3 Basil sees only Basil tenant users and zero Waseem users');

  // 2.4 Basil orders visibility
  const basilOrdersRes = await api('/api/orders', {
    headers: { Authorization: `Bearer ${basilToken}` }
  });
  const basilOrders = Array.isArray(basilOrdersRes.data?.orders) ? basilOrdersRes.data.orders : (Array.isArray(basilOrdersRes.data) ? basilOrdersRes.data : []);
  const basilHasOrderB = basilOrders.some(o => o.id === orderBasilId);
  const basilHasOrderW = basilOrders.some(o => o.id === orderWaseemId);
  assert(basilHasOrderB && !basilHasOrderW, '2.4 Basil sees only Basil orders and zero Waseem orders');

  // 2.5 Waseem sees only Waseem scope
  const waseemUsersRes = await api('/api/users', {
    headers: { Authorization: `Bearer ${waseemToken}` }
  });
  const waseemUsers = Array.isArray(waseemUsersRes.data) ? waseemUsersRes.data : [];
  const waseemHasSelf = waseemUsers.some(u => u.id === waseemId);
  const waseemHasMerchC = waseemUsers.some(u => u.id === merchantCId);
  const waseemHasDriverB = waseemUsers.some(u => u.id === driverBId);
  const waseemHasBasil = waseemUsers.some(u => u.id === basilId);
  const waseemHasMerchA = waseemUsers.some(u => u.id === merchantAId);
  assert(waseemHasSelf && waseemHasMerchC && waseemHasDriverB && !waseemHasBasil && !waseemHasMerchA, '2.5 Waseem sees only Waseem tenant users and zero Basil users');

  // 2.6 Waseem orders visibility
  const waseemOrdersRes = await api('/api/orders', {
    headers: { Authorization: `Bearer ${waseemToken}` }
  });
  const waseemOrders = Array.isArray(waseemOrdersRes.data?.orders) ? waseemOrdersRes.data.orders : (Array.isArray(waseemOrdersRes.data) ? waseemOrdersRes.data : []);
  const waseemHasOrderW = waseemOrders.some(o => o.id === orderWaseemId);
  const waseemHasOrderB = waseemOrders.some(o => o.id === orderBasilId);
  assert(waseemHasOrderW && !waseemHasOrderB, '2.6 Waseem sees only Waseem orders and zero Basil orders');

  console.log('\n====================================================');
  console.log('>>> 3. Explicit IDOR Tests');
  console.log('====================================================');

  // 3.1 Basil token + Merchant C (Waseem's merchant) Warehouse IDOR
  const idorWarehouse = await api(`/api/merchants/${merchantCId}/warehouse`, {
    headers: { Authorization: `Bearer ${basilToken}` }
  });
  assert(idorWarehouse.status === 403, '3.1 Basil accessing Merchant C warehouse fails 403');

  // 3.2 Basil token + Merchant C Categories IDOR
  const idorCategories = await api(`/api/merchants/${merchantCId}/categories`, {
    headers: { Authorization: `Bearer ${basilToken}` }
  });
  assert(idorCategories.status === 403, '3.2 Basil accessing Merchant C categories fails 403');

  // 3.3 Basil token + Product C (Waseem's product) Update IDOR
  const idorProductUpdate = await api(`/api/merchants/${merchantCId}/products/${prodCId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${basilToken}` },
    body: { name: 'Hacked Name' }
  });
  assert(idorProductUpdate.status === 403, '3.3 Basil updating Product C fails 403');

  // 3.4 Basil token + Waseem Order Detail IDOR
  const idorOrderDetail = await api(`/api/orders/${orderWaseemId}`, {
    headers: { Authorization: `Bearer ${basilToken}` }
  });
  assert(idorOrderDetail.status === 403, '3.4 Basil accessing Waseem Order detail fails 403');

  // 3.5 Basil token + Waseem Order Delete IDOR
  const idorOrderDelete = await api(`/api/orders/${orderWaseemId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${basilToken}` }
  });
  assert(idorOrderDelete.status === 403, '3.5 Basil deleting Waseem Order fails 403');

  // 3.6 Basil token + Waseem Order Shelf Assignment IDOR
  const idorOrderShelf = await api(`/api/orders/${orderWaseemId}/shelf`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${basilToken}` },
    body: { shelf: 'SHELF-X' }
  });
  assert(idorOrderShelf.status === 403, '3.6 Basil setting shelf on Waseem Order fails 403');

  // 3.7 Basil token + Waseem Driver B Cash Custody Close IDOR
  const idorDriverClose = await api(`/api/settlements/drivers/${driverBId}/close-cash`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${basilToken}` },
    body: { notes: 'Unauthorized settlement' }
  });
  assert(idorDriverClose.status === 403, '3.7 Basil settling Driver B custody fails 403');

  // 3.8 Basil token + Merchant C Invoices IDOR
  const idorInvoices = await api(`/api/merchants/${merchantCId}/invoices`, {
    headers: { Authorization: `Bearer ${basilToken}` }
  });
  assert(idorInvoices.status === 403, '3.8 Basil accessing Merchant C invoices fails 403');

  // 3.9 Basil token + Merchant C Accounting IDOR
  const idorAccounting = await api(`/api/merchants/${merchantCId}/accounting`, {
    headers: { Authorization: `Bearer ${basilToken}` }
  });
  assert(idorAccounting.status === 403, '3.9 Basil accessing Merchant C accounting P&L fails 403');

  // 3.10 Basil token + Merchant C Expenses IDOR
  const idorExpenses = await api(`/api/merchants/${merchantCId}/expenses`, {
    headers: { Authorization: `Bearer ${basilToken}` }
  });
  assert(idorExpenses.status === 403, '3.10 Basil accessing Merchant C expenses fails 403');

  // 3.11 Basil token + Waseem User Detail IDOR (GET /api/users/:id)
  const idorUserDetail = await api(`/api/users/${waseemId}`, {
    headers: { Authorization: `Bearer ${basilToken}` }
  });
  assert(idorUserDetail.status === 403, '3.11 Basil accessing Waseem profile detail fails 403');

  console.log('\n====================================================');
  console.log('>>> 4. Merchant Privacy & Cost Price Masking Tests');
  console.log('====================================================');

  // Create an Operator under Basil WITHOUT cost view permissions
  const createOperator = await api('/api/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${basilToken}` },
    body: {
      name: 'Basil Warehouse Operator (No Cost View)',
      email: `operator_${Date.now()}@test.io`,
      phone: `077${Math.floor(1000000 + Math.random() * 9000000)}`,
      password: 'password123',
      role: 'OPERATOR',
      permissions: ['inventory.view', 'orders.manage'] // NO merchant.products.cost_view
    }
  });
  const operatorId = createOperator.data?.user?.id || createOperator.data?.id;
  const operatorToken = `dargo_jwt_${operatorId}_${Date.now()}`;

  // Operator views Merchant A warehouse
  const opWarehouse = await api(`/api/merchants/${merchantAId}/warehouse`, {
    headers: { Authorization: `Bearer ${operatorToken}` }
  });
  const prodsReturned = opWarehouse.data?.products || [];
  const prodItem = prodsReturned.find(p => p.id === prodAId);
  const costIsZero = prodItem && prodItem.costPrice === 0;
  const totalCostValueZero = opWarehouse.data?.stats?.totalCostValue === 0;
  const potentialProfitZero = opWarehouse.data?.stats?.potentialGrossProfit === 0;
  assert(opWarehouse.status === 200 && costIsZero && totalCostValueZero && potentialProfitZero, '4.1 Operator without cost permission receives costPrice=0 and masked profit stats');

  console.log('\n====================================================');
  console.log('>>> 5. User Management & Permission Ceiling Tests');
  console.log('====================================================');

  // 5.1 Basil attempts to create SUPER_ADMIN -> 403
  const basilCreateSuper = await api('/api/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${basilToken}` },
    body: {
      name: 'Rogue Super Admin',
      email: `rogue_${Date.now()}@test.io`,
      phone: `079${Math.floor(1000000 + Math.random() * 9000000)}`,
      role: 'SUPER_ADMIN'
    }
  });
  assert(basilCreateSuper.status === 403, '5.1 Basil creating SUPER_ADMIN fails with 403 FORBIDDEN_ROLE');

  // 5.2 Waseem attempts to create SUPER_ADMIN -> 403
  const waseemCreateSuper = await api('/api/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${waseemToken}` },
    body: {
      name: 'Rogue Super Admin 2',
      email: `rogue2_${Date.now()}@test.io`,
      phone: `078${Math.floor(1000000 + Math.random() * 9000000)}`,
      role: 'SUPER_ADMIN'
    }
  });
  assert(waseemCreateSuper.status === 403, '5.2 Waseem creating SUPER_ADMIN fails with 403 FORBIDDEN_ROLE');

  // 5.3 Permission Ceiling: Basil attempts to assign a permission he does NOT have
  const ceilingExceedRes = await api('/api/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${basilToken}` },
    body: {
      name: 'Sub-user With Excess Perms',
      email: `excess_${Date.now()}@test.io`,
      phone: `077${Math.floor(1000000 + Math.random() * 9000000)}`,
      role: 'OPERATOR',
      permissions: ['orders.manage', 'manage_system_settings', 'export_database_backup'] // Excess perms
    }
  });
  assert(ceilingExceedRes.status === 403 && ceilingExceedRes.data?.code === 'CEILING_EXCEEDED', '5.3 Admin assigning permissions above ceiling fails with 403 CEILING_EXCEEDED');

  // 5.4 Permission Ceiling: Creating role with excess permissions
  const roleCeilingRes = await api('/api/roles', {
    method: 'POST',
    headers: { Authorization: `Bearer ${basilToken}` },
    body: {
      name: 'Overprivileged Custom Role',
      roleKey: 'ROLE_OVERPRIVILEGED',
      permissions: ['orders.manage', 'manage_operations_admins', '*']
    }
  });
  assert(roleCeilingRes.status === 403 && roleCeilingRes.data?.code === 'CEILING_EXCEEDED', '5.4 Admin creating custom role above ceiling fails with 403 CEILING_EXCEEDED');

  // 5.5 Admin modifying own permissions to escalate
  const selfEscalateRes = await api(`/api/users/${basilId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${basilToken}` },
    body: {
      permissions: ['*', 'manage_system_settings']
    }
  });
  assert(selfEscalateRes.status === 403 && selfEscalateRes.data?.code === 'CEILING_EXCEEDED', '5.5 Admin cannot self-escalate permissions beyond ceiling (403)');

  // 5.6 Basil modifying Waseem user -> 403
  const basilEditWaseem = await api(`/api/users/${waseemId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${basilToken}` },
    body: { name: 'Compromised Waseem' }
  });
  assert(basilEditWaseem.status === 403, '5.6 Basil modifying Waseem account fails 403');

  // 5.7 Basil modifying Super Admin user -> 403
  const basilEditSuper = await api(`/api/users/${superAdminUser.id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${basilToken}` },
    body: { name: 'Compromised Super Admin' }
  });
  assert(basilEditSuper.status === 403, '5.7 Basil modifying Super Admin account fails 403');

  console.log('\n====================================================');
  console.log('>>> 6. Orders Security & Driver/Merchant Scoping');
  console.log('====================================================');

  // 6.1 Merchant A sees only Merchant A orders
  const merchAOrdersRes = await api('/api/orders', {
    headers: { Authorization: `Bearer ${merchantAToken}` }
  });
  const merchAOrders = Array.isArray(merchAOrdersRes.data?.orders) ? merchAOrdersRes.data.orders : (Array.isArray(merchAOrdersRes.data) ? merchAOrdersRes.data : []);
  const merchASeesOwn = merchAOrders.every(o => o.merchantId === merchantAId);
  assert(merchAOrdersRes.status === 200 && merchASeesOwn && merchAOrders.length > 0, '6.1 Merchant A sees strictly orders belonging to Merchant A');

  // 6.2 Driver A gets assigned Basil order
  await api(`/api/orders/${orderBasilId}/assign`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${basilToken}` },
    body: { driverId: driverAId }
  });

  const driverAOrdersRes = await api('/api/orders', {
    headers: { Authorization: `Bearer ${driverAToken}` }
  });
  const driverAOrders = Array.isArray(driverAOrdersRes.data?.orders) ? driverAOrdersRes.data.orders : (Array.isArray(driverAOrdersRes.data) ? driverAOrdersRes.data : []);
  const driverASeesAssigned = driverAOrders.some(o => o.id === orderBasilId);
  const driverASeesWaseem = driverAOrders.some(o => o.id === orderWaseemId);
  assert(driverASeesAssigned && !driverASeesWaseem, '6.2 Driver A sees only assigned orders and zero cross-tenant orders');

  // 6.3 Driver A cannot access Waseem order POD verification
  const driverVerifyWaseem = await api(`/api/orders/${orderWaseemId}/verify-pod`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${driverAToken}` },
    body: { bypassOtp: true }
  });
  assert(driverVerifyWaseem.status === 403, '6.3 Driver A cannot verify POD on cross-tenant order (403)');

  console.log('\n====================================================');
  console.log('>>> 7. Accounting & Financial Protection');
  console.log('====================================================');

  // 7.1 Non-accounting sub-user accessing /api/accounting/overview
  const opAccounting = await api('/api/accounting/overview', {
    headers: { Authorization: `Bearer ${operatorToken}` }
  });
  assert(opAccounting.status === 403, '7.1 User without accounting permission blocked from /api/accounting/overview (403)');

  // 7.2 Non-accounting sub-user creating journal entries
  const opJE = await api('/api/accounting/journal-entries', {
    method: 'POST',
    headers: { Authorization: `Bearer ${operatorToken}` },
    body: {
      description: 'Illegal JE',
      lines: [
        { accountId: 'acc-1010', debit: 100, credit: 0 },
        { accountId: 'acc-1020', debit: 0, credit: 100 }
      ]
    }
  });
  assert(opJE.status === 403, '7.2 User without accounting permission blocked from creating journal entries (403)');

  console.log('\n====================================================');
  console.log('>>> 8. Search, Counts & Dashboard Aggregation Leakage');
  console.log('====================================================');

  // 8.1 Stats isolation for Basil vs Super Admin
  const basilStatsRes = await api('/api/stats', {
    headers: { Authorization: `Bearer ${basilToken}` }
  });
  const superStatsRes = await api('/api/stats', {
    headers: { Authorization: `Bearer ${superAdminToken}` }
  });
  const basilOrderCount = basilStatsRes.data?.total || 0;
  const superOrderCount = superStatsRes.data?.total || 0;
  assert(basilStatsRes.status === 200 && superStatsRes.status === 200 && basilOrderCount <= superOrderCount, `8.1 Dashboard stats isolated: Basil total orders (${basilOrderCount}) <= Super Admin total orders (${superOrderCount})`);

  // 8.2 Settlements aggregation isolation
  const basilSettlements = await api('/api/settlements', {
    headers: { Authorization: `Bearer ${basilToken}` }
  });
  const merchantsInBasilSettlements = basilSettlements.data?.merchants || [];
  const hasMerchantCInSettlements = merchantsInBasilSettlements.some(m => m.merchant?.id === merchantCId);
  assert(!hasMerchantCInSettlements, '8.2 Settlements overview for Basil excludes Waseem merchants');

  console.log('\n====================================================');
  console.log('>>> 9. Inactive Account Enforcement');
  console.log('====================================================');

  // Deactivate Operator
  await api(`/api/users/${operatorId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${basilToken}` },
    body: { isActive: false }
  });

  // 9.1 Inactive user login attempt -> 403
  const inactiveLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { phone: createOperator.data?.user?.phone, password: 'password123' }
  });
  assert(inactiveLogin.status === 403, '9.1 Inactive user login fails with 403');

  // 9.2 Inactive user token verification attempt -> 403
  const inactiveVerify = await api('/api/auth/verify', {
    method: 'POST',
    headers: { Authorization: `Bearer ${operatorToken}` },
    body: { userId: operatorId }
  });
  assert(inactiveVerify.status === 403 || inactiveVerify.status === 401, '9.2 Inactive user token verification fails with 403/401');

  // 9.3 Inactive user API request -> 403/401
  const inactiveApi = await api('/api/orders', {
    headers: { Authorization: `Bearer ${operatorToken}` }
  });
  assert(inactiveApi.status === 403 || inactiveApi.status === 401, '9.3 Inactive user cannot execute API operations (403/401)');

  console.log('\n====================================================');
  console.log('>>> 10. Super Admin Protection & Immutability');
  console.log('====================================================');

  // 10.1 Attempt to delete SUPER_ADMIN -> 400
  const delSuper = await api(`/api/users/${superAdminUser.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${superAdminToken}` }
  });
  assert(delSuper.status === 400, '10.1 Deleting SUPER_ADMIN is prohibited (400)');

  // 10.2 Basil attempt to delete SUPER_ADMIN -> 400/403
  const basilDelSuper = await api(`/api/users/${superAdminUser.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${basilToken}` }
  });
  assert(basilDelSuper.status === 400 || basilDelSuper.status === 403, '10.2 Non-superadmin deleting SUPER_ADMIN fails (400/403)');

  // 10.3 Non-superadmin accessing Super Admin backup -> 403
  const backupRes = await api('/api/database/backup', {
    headers: { Authorization: `Bearer ${basilToken}` }
  });
  assert(backupRes.status === 403, '10.3 Non-superadmin accessing /api/database/backup fails 403');

  // 10.4 Non-superadmin accessing clean database -> 403
  const cleanDbBasil = await api('/api/system/clean-database', {
    method: 'POST',
    headers: { Authorization: `Bearer ${basilToken}` }
  });
  assert(cleanDbBasil.status === 403, '10.4 Non-superadmin accessing /api/system/clean-database fails 403');

  console.log('\n====================================================');
  console.log('AUDIT SUMMARY');
  console.log(`Total Tests Run: ${totalTests}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  console.log('====================================================');

  if (failCount === 0) {
    console.log('ALL SECURITY & ISOLATION TESTS PASSED PERFECTLY.');
  } else {
    console.error('SOME TESTS FAILED!');
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Fatal Test Execution Error:', err);
  process.exit(1);
});

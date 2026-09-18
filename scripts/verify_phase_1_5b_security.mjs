import fetch from 'node-fetch';
import crypto from 'crypto';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

let passedTests = 0;
let failedTests = 0;
const testResults = [];

function assert(condition, message, details = {}) {
  if (condition) {
    passedTests++;
    testResults.push({ status: 'PASS', message, details });
    console.log(`\x1b[32m[PASS]\x1b[0m ${message}`);
  } else {
    failedTests++;
    testResults.push({ status: 'FAIL', message, details });
    console.error(`\x1b[31m[FAIL]\x1b[0m ${message}`, details);
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

async function waitForServer() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`).catch(() => null);
      if (res && res.status < 500) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 600));
  }
  return false;
}

async function runPhase15bSecuritySuite() {
  await waitForServer();
  console.log('\n===============================================================');
  console.log('🛡️  PHASE 1.5B: SECURE INVITATION + GOOGLE LOGIN AUDIT & TESTS');
  console.log('===============================================================\n');

  // ----------------------------------------------------
  // 1. Authenticate Actors (SuperAdmin, Tenant A Admin, Tenant B Admin)
  // ----------------------------------------------------
  console.log('--- 1. Authenticating Actor Sessions ---');

  // Super Admin
  const superAdminLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@dargo-tms.io', password: 'admin123' },
  });

  const superAdminToken = superAdminLogin.data?.token;
  const superAdminUser = superAdminLogin.data?.user;
  assert(superAdminLogin.status === 200, 'Super Admin authentication successful', { role: superAdminUser?.role });

  // Operations Admin A (Tenant A)
  const tenantAEmail = `admin.tenanta.${Date.now()}@test.io`;
  const createAdminARes = await api('/api/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
    body: {
      name: 'مدير عمليات شركة أ',
      email: tenantAEmail,
      phone: `079${Math.floor(1000000 + Math.random() * 9000000)}`,
      password: 'password123',
      role: 'ADMIN',
      permissions: ['orders.view', 'orders.create', 'merchant.view'],
      maxAllowedPermissions: ['orders.view', 'orders.create', 'merchant.view'],
    },
  });
  const adminAUser = createAdminARes.data?.user || createAdminARes.data;
  const adminAId = adminAUser?.id;
  const adminAToken = `dargo_jwt_${adminAId}_${Date.now()}`;
  assert(createAdminARes.status === 201 && Boolean(adminAId), 'Operations Admin A created under Super Admin', { id: adminAId });

  // Operations Admin B (Tenant B)
  const tenantBEmail = `admin.tenantb.${Date.now()}@test.io`;
  const createAdminBRes = await api('/api/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
    body: {
      name: 'مدير عمليات شركة ب',
      email: tenantBEmail,
      phone: `078${Math.floor(1000000 + Math.random() * 9000000)}`,
      password: 'password123',
      role: 'ADMIN',
      permissions: ['orders.view', 'orders.create'],
      maxAllowedPermissions: ['orders.view', 'orders.create'],
    },
  });
  const adminBUser = createAdminBRes.data?.user || createAdminBRes.data;
  const adminBId = adminBUser?.id;
  const adminBToken = `dargo_jwt_${adminBId}_${Date.now()}`;
  assert(createAdminBRes.status === 201 && Boolean(adminBId), 'Operations Admin B created under Super Admin', { id: adminBId });

  // ---------------------------------------------------------------------------------
  // 2. Invitation Generation & Permission Ceilings
  // ---------------------------------------------------------------------------------
  console.log('\n--- 2. Invitation Creation & Permission Ceilings ---');

  // Test 2.1: Super Admin creates an invitation with custom permissions
  const invite1Email = `merchant.invited.${Date.now()}@test.io`;
  const createInvite1Res = await api('/api/invitations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
    body: {
      email: invite1Email,
      role: 'MERCHANT',
      commercialName: 'متجر النجاح الساطع',
      permissions: ['orders.view', 'orders.create'],
      expiresInDays: 7,
    },
  });
  const invite1Data = createInvite1Res.data;
  assert(createInvite1Res.status === 201, 'Super Admin successfully issued user invitation', { status: createInvite1Res.status });
  assert(Boolean(invite1Data?.rawToken), 'Raw token returned to creator at generation time');
  assert(Boolean(invite1Data?.invitation?.id), 'Invitation ID generated');
  assert(invite1Data?.invitation?.tokenHash === undefined, 'Token hash is NOT exposed in response payload');

  const invite1RawToken = invite1Data?.rawToken;
  const invite1Id = invite1Data?.invitation?.id;

  // Test 2.2: Operations Admin A attempts Role Escalation by creating SUPER_ADMIN invitation (MUST BE FORBIDDEN)
  const escalationInviteRes = await api('/api/invitations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminAToken}` },
    body: {
      email: `escalate.${Date.now()}@test.io`,
      role: 'SUPER_ADMIN',
    },
  });
  assert(escalationInviteRes.status === 403, 'Role escalation prevented: Operations Admin cannot invite SUPER_ADMIN', { status: escalationInviteRes.status });

  // Test 2.3: Operations Admin A creates invitation for a driver within own tenant
  const invite2Email = `driver.tenant.a.${Date.now()}@test.io`;
  const createInvite2Res = await api('/api/invitations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminAToken}` },
    body: {
      email: invite2Email,
      role: 'DRIVER',
      phone: '0799887766',
      branch: 'فرع عمان الغربية',
    },
  });
  const invite2Data = createInvite2Res.data;
  assert(createInvite2Res.status === 201, 'Admin A created driver invitation in own tenant scope', { status: createInvite2Res.status });
  assert(Boolean(invite2Data?.invitation?.tenantId), 'Server strictly enforced non-null tenantId for Admin A invitation', {
    tenantId: invite2Data?.invitation?.tenantId,
  });

  // Test 2.4: Permission Ceiling Violation in Invitation (Admin B attempts to grant permissions outside own ceiling)
  const ceilingViolateRes = await api('/api/invitations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminBToken}` },
    body: {
      email: `violator.${Date.now()}@test.io`,
      role: 'MERCHANT',
      permissions: ['orders.view', 'orders.create', 'manage_system_settings', 'export_database_backup'],
    },
  });
  assert(ceilingViolateRes.status === 403, 'Permission Ceiling enforced: Admin B cannot grant permissions exceeding own ceiling', { status: ceilingViolateRes.status });

  // ---------------------------------------------------------------------------------
  // 3. Invitation Verification & Public Endpoint Safety
  // ---------------------------------------------------------------------------------
  console.log('\n--- 3. Public Verification Endpoint Safety ---');

  // Test 3.1: Verify valid token
  const verifyRes = await api(`/api/invitations/verify?token=${invite1RawToken}`);
  const verifyData = verifyRes.data;
  assert(verifyRes.status === 200 && verifyData?.valid === true, 'Valid invitation token verified successfully');
  assert(verifyData?.invitation?.email === invite1Email, 'Verification returns matching email', { email: verifyData?.invitation?.email });
  assert(verifyData?.invitation?.tokenHash === undefined, 'Verification does not leak SHA-256 token hash');

  // Test 3.2: Verify invalid/tampered token
  const fakeToken = crypto.randomBytes(32).toString('hex');
  const fakeVerifyRes = await api(`/api/invitations/verify?token=${fakeToken}`);
  assert(fakeVerifyRes.status === 404, 'Invalid/tampered token rejected with 404', { status: fakeVerifyRes.status });

  // ---------------------------------------------------------------------------------
  // 4. Invitation Acceptance Lifecycle (New User Registration)
  // ---------------------------------------------------------------------------------
  console.log('\n--- 4. Invitation Acceptance Lifecycle ---');

  // Test 4.1: Accept invitation 1 with password
  const acceptRes = await api('/api/invitations/accept', {
    method: 'POST',
    body: {
      token: invite1RawToken,
      name: 'التاجر أحمد السعيد',
      phone: '0791234567',
      password: 'password123',
    },
  });
  const acceptData = acceptRes.data;
  assert(acceptRes.status === 200 && Boolean(acceptData?.token), 'New user accepted invitation and received session token', { userId: acceptData?.user?.id });
  assert(acceptData?.user?.role === 'MERCHANT', 'User created with role specified in invitation');

  // Test 4.2: Single-Use Enforcement: Attempt to reuse already accepted token (MUST FAIL)
  const reuseRes = await api('/api/invitations/accept', {
    method: 'POST',
    body: {
      token: invite1RawToken,
      name: 'التاجر المهاجم',
      password: 'password123',
    },
  });
  assert(reuseRes.status === 400, 'Single-Use Enforced: Re-using accepted invitation token is rejected', { status: reuseRes.status });

  // ---------------------------------------------------------------------------------
  // 5. Existing User Identity Linking (Preservation of Existing Data)
  // ---------------------------------------------------------------------------------
  console.log('\n--- 5. Existing User Identity Linking & Non-Destructive Integration ---');

  // Create an existing user with known email and pre-existing orders/data
  const existingEmail = `existing.merchant.${Date.now()}@test.io`;
  const existingPhone = `079${Math.floor(1000000 + Math.random() * 9000000)}`;
  const createExistingRes = await api('/api/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
    body: {
      name: 'تاجر أصلي قديم',
      email: existingEmail,
      phone: existingPhone,
      password: 'oldpassword123',
      role: 'MERCHANT',
      commercialName: 'المتجر التاريخي القديم',
    },
  });
  const existingUserData = createExistingRes.data?.user || createExistingRes.data;
  const originalUserId = existingUserData?.id;
  assert(createExistingRes.status === 201 && Boolean(originalUserId), 'Existing user registered in database before invitation', { id: originalUserId });

  // Issue an invitation to the existing user's email
  const inviteExistingRes = await api('/api/invitations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
    body: {
      email: existingEmail,
      role: 'MERCHANT',
    },
  });
  const inviteExistingData = inviteExistingRes.data;
  const existingInviteRawToken = inviteExistingData?.rawToken;

  // Accept the invitation for existing user with new password / google credentials
  const linkRes = await api('/api/invitations/accept', {
    method: 'POST',
    body: {
      token: existingInviteRawToken,
      password: 'newpassword123',
      googleId: 'google_linked_998877',
      googleEmail: existingEmail,
    },
  });
  const linkData = linkRes.data;
  assert(linkRes.status === 200, 'Existing user identity successfully linked', { status: linkRes.status });
  assert(linkData?.user?.id === originalUserId, 'CRITICAL: Existing User ID preserved without creation of duplicate accounts', { id: linkData?.user?.id, originalId: originalUserId });
  assert(linkData?.user?.authProvider === 'HYBRID' || linkData?.user?.authProvider === 'GOOGLE', 'Auth provider upgraded to HYBRID identity');

  // ---------------------------------------------------------------------------------
  // 6. Tenant Isolation & IDOR Protection on Invitations
  // ---------------------------------------------------------------------------------
  console.log('\n--- 6. Tenant Isolation & IDOR Protection on Invitations ---');

  // Test 6.1: Admin B tries to view invitations - MUST NOT see Admin A's invitations
  const listBRes = await api('/api/invitations', {
    headers: { Authorization: `Bearer ${adminBToken}` },
  });
  const listBData = listBRes.data;
  const exposedInviteA = listBData?.invitations?.find((i) => i.id === invite2Data?.invitation?.id);
  assert(exposedInviteA === undefined, 'Tenant Isolation PASS: Admin B cannot see Admin A invitations', { count: listBData?.invitations?.length });

  // Test 6.2: Admin B tries to REVOKE Admin A's invitation (IDOR)
  const idorRevokeRes = await api(`/api/invitations/${invite2Data?.invitation?.id}/revoke`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminBToken}` },
  });
  assert(idorRevokeRes.status === 403, 'IDOR Prevention PASS: Admin B cannot revoke Admin A invitation', { status: idorRevokeRes.status });

  // Test 6.3: Admin A successfully revokes own invitation
  const validRevokeRes = await api(`/api/invitations/${invite2Data?.invitation?.id}/revoke`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminAToken}` },
  });
  assert(validRevokeRes.status === 200, 'Admin A successfully revoked own invitation', { status: validRevokeRes.status });

  // Test 6.4: Revoked invitation cannot be verified or accepted
  const verifyRevokedRes = await api(`/api/invitations/verify?token=${invite2Data?.rawToken}`);
  assert(verifyRevokedRes.status === 400, 'Revoked invitation rejected on verify endpoint', { status: verifyRevokedRes.status });

  // ---------------------------------------------------------------------------------
  // 7. Google Login Gating & Authentication Security
  // ---------------------------------------------------------------------------------
  console.log('\n--- 7. Gated Google Authentication Security ---');

  // Test 7.1: Gated Public Registration: Unregistered user without invitation tries to login via Google (MUST BE REJECTED 403)
  const uninvitedGoogleEmail = `uninvited.stranger.${Date.now()}@gmail.com`;
  const uninvitedGoogleRes = await api('/api/auth/google/verify-token', {
    method: 'POST',
    body: {
      email: uninvitedGoogleEmail,
      googleId: 'google_stranger_123',
    },
  });
  const uninvitedGoogleData = uninvitedGoogleRes.data;
  assert(uninvitedGoogleRes.status === 403, 'Gated Google Login: Public registration rejected without invitation token', {
    status: uninvitedGoogleRes.status,
    code: uninvitedGoogleData?.code,
  });

  // Test 7.2: Google Login with valid invitation token (Invited Google Registration)
  const googleInviteeEmail = `google.invitee.${Date.now()}@gmail.com`;
  const createGoogleInviteRes = await api('/api/invitations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
    body: {
      email: googleInviteeEmail,
      role: 'MERCHANT',
      commercialName: 'متجر جوجل المميز',
    },
  });
  const googleInviteData = createGoogleInviteRes.data;
  const googleInviteRawToken = googleInviteData?.rawToken;

  const validGoogleAcceptRes = await api('/api/auth/google/verify-token', {
    method: 'POST',
    body: {
      email: googleInviteeEmail,
      name: 'تاجر جوجل الرسمي',
      googleId: `google_oauth_${Date.now()}`,
      invitationToken: googleInviteRawToken,
    },
  });
  const validGoogleAcceptData = validGoogleAcceptRes.data;
  assert(validGoogleAcceptRes.status === 200 && Boolean(validGoogleAcceptData?.token), 'Google registration succeeded with valid invitation token', {
    userId: validGoogleAcceptData?.user?.id,
    authProvider: validGoogleAcceptData?.user?.authProvider,
  });

  // Test 7.3: Subsequent Google Login for existing/registered user (No invitation token needed now)
  const subsequentGoogleLoginRes = await api('/api/auth/google/verify-token', {
    method: 'POST',
    body: {
      email: googleInviteeEmail,
      googleId: validGoogleAcceptData?.user?.googleId,
    },
  });
  const subsequentGoogleData = subsequentGoogleLoginRes.data;
  assert(subsequentGoogleLoginRes.status === 200 && Boolean(subsequentGoogleData?.token), 'Subsequent Google login works seamlessly for registered user', {
    userId: subsequentGoogleData?.user?.id,
  });

  // ---------------------------------------------------------------------------------
  // 8. Existing Core Functionality Regression Check
  // ---------------------------------------------------------------------------------
  console.log('\n--- 8. Core System Integrity & Regression Verification ---');

  // Verify Orders API
  const ordersRes = await api('/api/orders?page=1&limit=5', {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const ordersData = ordersRes.data;
  assert(ordersRes.status === 200 && Array.isArray(ordersData?.orders), 'Orders API responds healthy with intact pagination and data');
  assert(ordersRes.status === 200 && Boolean(ordersData?.stats), 'Operations KPI and statistics data intact');

  console.log('\n===============================================================');
  console.log(`📊 PHASE 1.5B TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('===============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPhase15bSecuritySuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

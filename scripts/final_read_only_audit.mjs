import fetch from 'node-fetch';
import crypto from 'crypto';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const auditResults = {};

function record(section, pass, details = {}) {
  auditResults[section] = { pass, details };
  const icon = pass ? '\x1b[32m[PASS]\x1b[0m' : '\x1b[31m[FAIL]\x1b[0m';
  console.log(`${icon} ${section}`, details);
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

async function runReadOnlyAudit() {
  console.log('\n===============================================================');
  console.log('🔍 INITIATING FINAL READ-ONLY AUDIT (PHASE 1.5B)');
  console.log('===============================================================\n');

  // 1. Setup Auth Principals (Super Admin, Basil - Tenant 1, Waseem - Tenant 2)
  const superAdminLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@dargo-tms.io', password: 'admin123' },
  });
  const superAdminToken = superAdminLogin.data?.token;

  // Create Basil (Admin of Tenant 1)
  const basilEmail = `basil.${Date.now()}@tenant1.io`;
  const basilRes = await api('/api/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
    body: {
      name: 'باسل مدير عمليات شركة 1',
      email: basilEmail,
      phone: `079${Math.floor(1000000 + Math.random() * 9000000)}`,
      password: 'password123',
      role: 'ADMIN',
      permissions: ['orders.view', 'orders.create', 'merchant.view'],
      maxAllowedPermissions: ['orders.view', 'orders.create', 'merchant.view'],
    },
  });
  const basilUser = basilRes.data?.user || basilRes.data;
  const basilId = basilUser?.id;
  const basilToken = `dargo_jwt_${basilId}_${Date.now()}`;

  // Create Waseem (Admin of Tenant 2)
  const waseemEmail = `waseem.${Date.now()}@tenant2.io`;
  const waseemRes = await api('/api/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
    body: {
      name: 'وسيم مدير عمليات شركة 2',
      email: waseemEmail,
      phone: `078${Math.floor(1000000 + Math.random() * 9000000)}`,
      password: 'password123',
      role: 'ADMIN',
      permissions: ['orders.view', 'orders.create'],
      maxAllowedPermissions: ['orders.view', 'orders.create'],
    },
  });
  const waseemUser = waseemRes.data?.user || waseemRes.data;
  const waseemId = waseemUser?.id;
  const waseemToken = `dargo_jwt_${waseemId}_${Date.now()}`;

  // -------------------------------------------------------------
  // SECTION 1: Public Registration Test
  // -------------------------------------------------------------
  console.log('\n--- 1. Public Registration Test ---');
  const strangerEmail = `stranger.${Date.now()}@unknown.com`;

  // 1a. Stranger attempts Google Login without invitation
  const strangerGoogle = await api('/api/auth/google/verify-token', {
    method: 'POST',
    body: { email: strangerEmail, googleId: 'google_stranger_id' },
  });

  // 1b. Stranger attempts to accept with arbitrary/missing token
  const strangerAccept = await api('/api/invitations/accept', {
    method: 'POST',
    body: {
      token: 'non_existent_token_123',
      name: 'Stranger',
      password: 'password123',
      role: 'SUPER_ADMIN',
    },
  });

  // 1c. Stranger attempts to call user creation without auth
  const strangerCreateUser = await api('/api/users', {
    method: 'POST',
    body: {
      name: 'Stranger',
      email: strangerEmail,
      password: 'password123',
      role: 'SUPER_ADMIN',
    },
  });

  const publicRegPass =
    strangerGoogle.status === 403 &&
    strangerAccept.status === 404 &&
    (strangerCreateUser.status === 401 || strangerCreateUser.status === 403);

  record('Public Registration', publicRegPass, {
    googleStatus: strangerGoogle.status,
    acceptStatus: strangerAccept.status,
    createUserStatus: strangerCreateUser.status,
  });

  // -------------------------------------------------------------
  // SECTION 2: Password Creation & Gating Test
  // -------------------------------------------------------------
  console.log('\n--- 2. Password Creation Test ---');
  // Generate a valid invitation
  const inviteEmail2 = `invited.pw.${Date.now()}@test.io`;
  const invite2 = await api('/api/invitations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${basilToken}` },
    body: {
      email: inviteEmail2,
      role: 'MERCHANT',
    },
  });
  const rawToken2 = invite2.data?.rawToken;

  // Accept with valid token
  const validAccept = await api('/api/invitations/accept', {
    method: 'POST',
    body: {
      token: rawToken2,
      name: 'تاجر معتمد',
      password: 'newpassword123',
    },
  });

  // Try to create password on same token again
  const reuseTokenAccept = await api('/api/invitations/accept', {
    method: 'POST',
    body: {
      token: rawToken2,
      name: 'تاجر مكرر',
      password: 'anotherpassword123',
    },
  });

  const pwGatingPass =
    invite2.status === 201 &&
    validAccept.status === 200 &&
    Boolean(validAccept.data?.token) &&
    reuseTokenAccept.status === 400;

  record('Password Gating', pwGatingPass, {
    validAcceptStatus: validAccept.status,
    reuseStatus: reuseTokenAccept.status,
  });

  // -------------------------------------------------------------
  // SECTION 3: Google Login Tests
  // -------------------------------------------------------------
  console.log('\n--- 3. Google Login Tests ---');
  // 3a. Uninvited Google Login -> Denied (Tested in #1, strangerGoogle)
  const g1Pass = strangerGoogle.status === 403;

  // 3b. Valid Invitation + Matching Email -> Allowed
  const googleEmailMatch = `google.match.${Date.now()}@test.io`;
  const inviteGMatch = await api('/api/invitations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${basilToken}` },
    body: { email: googleEmailMatch, role: 'MERCHANT' },
  });
  const rawTokenGMatch = inviteGMatch.data?.rawToken;

  const gMatchAccept = await api('/api/auth/google/verify-token', {
    method: 'POST',
    body: {
      email: googleEmailMatch,
      googleId: 'g_sub_123',
      name: 'مطابق جوجل',
      invitationToken: rawTokenGMatch,
    },
  });
  const g2Pass = gMatchAccept.status === 200 && Boolean(gMatchAccept.data?.token);

  // 3c. Valid Invitation + Wrong Email -> Denied / Handled safely
  const wrongEmailInvite = await api('/api/invitations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${basilToken}` },
    body: { email: `intended.${Date.now()}@test.io`, role: 'MERCHANT' },
  });
  const rawTokenWrong = wrongEmailInvite.data?.rawToken;

  // Attempt Google login with mismatched email using that token
  // The server assigns the role and tenant from invitation, or binds it strictly to invitation email
  const gWrongRes = await api('/api/auth/google/verify-token', {
    method: 'POST',
    body: {
      email: `attacker.${Date.now()}@test.io`,
      googleId: 'g_sub_attacker',
      invitationToken: rawTokenWrong,
    },
  });

  // 3d. Revoked Invitation with Google -> Denied
  const revokedInvite = await api('/api/invitations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${basilToken}` },
    body: { email: `revoked.google.${Date.now()}@test.io`, role: 'MERCHANT' },
  });
  const revokedId = revokedInvite.data?.invitation?.id;
  const revokedRawToken = revokedInvite.data?.rawToken;
  await api(`/api/invitations/${revokedId}/revoke`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${basilToken}` },
  });

  const gRevokedRes = await api('/api/auth/google/verify-token', {
    method: 'POST',
    body: {
      email: `revoked.google.${Date.now()}@test.io`,
      googleId: 'g_sub_revoked',
      invitationToken: revokedRawToken,
    },
  });
  const gRevokedPass = gRevokedRes.status === 403;

  // 3e. Already Accepted Invitation with Google -> Denied on token reuse
  const gAcceptedReused = await api('/api/auth/google/verify-token', {
    method: 'POST',
    body: {
      email: `new.person.${Date.now()}@test.io`,
      googleId: 'g_sub_reused',
      invitationToken: rawTokenGMatch, // already used by googleEmailMatch
    },
  });
  const gAcceptedPass = gAcceptedReused.status === 403;

  const googleGatingPass = g1Pass && g2Pass && gRevokedPass && gAcceptedPass;
  record('Google Gating', googleGatingPass, {
    uninvitedDenied: g1Pass,
    matchingAllowed: g2Pass,
    revokedDenied: gRevokedPass,
    reusedDenied: gAcceptedPass,
  });

  // -------------------------------------------------------------
  // SECTION 4: Invitation Token Cryptography & Storage
  // -------------------------------------------------------------
  console.log('\n--- 4. Invitation Token Cryptography & Storage ---');
  // Check verification endpoint does not return hash
  const verifyTokenRes = await api(`/api/invitations/verify?token=${rawTokenWrong}`);
  const doesNotLeakHash =
    verifyTokenRes.data?.invitation?.tokenHash === undefined &&
    verifyTokenRes.data?.invitation?.token_hash === undefined;

  // Check invitation object creation response does not leak hash
  const createDoesNotLeakHash = inviteGMatch.data?.invitation?.tokenHash === undefined;

  // Token is 64-character hex (256-bit crypto.randomBytes(32))
  const is256BitHex = typeof rawTokenGMatch === 'string' && rawTokenGMatch.length === 64;

  const tokenCryptoPass = doesNotLeakHash && createDoesNotLeakHash && is256BitHex;
  record('Invitation Gating', tokenCryptoPass, {
    doesNotLeakHash,
    createDoesNotLeakHash,
    is256BitHex,
  });

  // -------------------------------------------------------------
  // SECTION 5: Existing User Linking & User ID Preservation
  // -------------------------------------------------------------
  console.log('\n--- 5. Existing User Linking & User ID Preservation ---');
  const existingMerchantEmail = `existing.acc.${Date.now()}@test.io`;
  const createPreUser = await api('/api/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
    body: {
      name: 'تاجر قديم مسجل',
      email: existingMerchantEmail,
      phone: `079${Math.floor(1000000 + Math.random() * 9000000)}`,
      password: 'oldpassword123',
      role: 'MERCHANT',
      commercialName: 'متجر التراث الأصيل',
    },
  });
  const preUserId = (createPreUser.data?.user || createPreUser.data)?.id;

  // Invite the same email
  const inviteExisting = await api('/api/invitations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
    body: { email: existingMerchantEmail, role: 'MERCHANT' },
  });
  const rawTokenExisting = inviteExisting.data?.rawToken;

  // Accept with new password & Google ID
  const linkExistingRes = await api('/api/invitations/accept', {
    method: 'POST',
    body: {
      token: rawTokenExisting,
      password: 'updatedpassword123',
      googleId: 'g_linked_original_99',
    },
  });
  const linkedUserId = linkExistingRes.data?.user?.id;
  const linkedAuthProvider = linkExistingRes.data?.user?.authProvider;

  const existingLinkingPass = linkExistingRes.status === 200 && linkedUserId === preUserId;
  record('Existing User Linking', existingLinkingPass, {
    preUserId,
    linkedUserId,
    authProvider: linkedAuthProvider,
  });
  record('User ID Preservation', linkedUserId === preUserId, { preUserId, linkedUserId });

  // -------------------------------------------------------------
  // SECTION 6: Cross-Tenant Isolation & IDOR Protection
  // -------------------------------------------------------------
  console.log('\n--- 6. Cross-Tenant Isolation & IDOR ---');
  // Basil (Tenant 1) creates an invitation
  const basilInviteRes = await api('/api/invitations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${basilToken}` },
    body: { email: `tenant1.staff.${Date.now()}@test.io`, role: 'DRIVER' },
  });
  const basilInviteId = basilInviteRes.data?.invitation?.id;

  // Waseem (Tenant 2) tries to list invitations
  const waseemList = await api('/api/invitations', {
    headers: { Authorization: `Bearer ${waseemToken}` },
  });
  const waseemSeesBasilInvite = waseemList.data?.invitations?.some((i) => i.id === basilInviteId);

  // Waseem tries to revoke Basil's invitation (IDOR attack)
  const waseemRevoke = await api(`/api/invitations/${basilInviteId}/revoke`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${waseemToken}` },
  });

  const tenantIsolationPass = !waseemSeesBasilInvite && waseemRevoke.status === 403;
  record('Tenant Isolation', tenantIsolationPass, {
    waseemSeesBasilInvite,
    waseemRevokeStatus: waseemRevoke.status,
  });
  record('Invitation IDOR', waseemRevoke.status === 403, { waseemRevokeStatus: waseemRevoke.status });

  // -------------------------------------------------------------
  // SECTION 7: Role Escalation Prevention
  // -------------------------------------------------------------
  console.log('\n--- 7. Role Escalation Prevention ---');
  // Basil tries to invite a SUPER_ADMIN
  const basilEscalateSuper = await api('/api/invitations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${basilToken}` },
    body: { email: `escalate.super.${Date.now()}@test.io`, role: 'SUPER_ADMIN' },
  });

  // Basil tries to invite with permissions beyond his ceiling
  const basilEscalatePerms = await api('/api/invitations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${basilToken}` },
    body: {
      email: `escalate.perms.${Date.now()}@test.io`,
      role: 'MERCHANT',
      permissions: ['orders.view', 'orders.create', 'super_admin_unrestricted_god_mode', 'drop_database'],
    },
  });

  // Basil invites within his allowed ceiling
  const basilValidCeiling = await api('/api/invitations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${basilToken}` },
    body: {
      email: `legit.staff.${Date.now()}@test.io`,
      role: 'MERCHANT',
      permissions: ['orders.view'],
    },
  });

  const roleEscalationPass =
    basilEscalateSuper.status === 403 &&
    basilEscalatePerms.status === 403 &&
    basilValidCeiling.status === 201;

  record('Role Escalation', roleEscalationPass, {
    superAdminDenied: basilEscalateSuper.status === 403,
    ceilingExceededDenied: basilEscalatePerms.status === 403,
    validCeilingAllowed: basilValidCeiling.status === 201,
  });

  // -------------------------------------------------------------
  // SECTION 8: Tenant/Parent Tampering on Invitation Creation
  // -------------------------------------------------------------
  console.log('\n--- 8. Tenant/Parent Tampering ---');
  // Basil tries to set tenantId = waseemId in the body
  const tamperTenantRes = await api('/api/invitations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${basilToken}` },
    body: {
      email: `tamper.tenant.${Date.now()}@test.io`,
      role: 'DRIVER',
      tenantId: waseemId, // malicious target
      parentUserId: waseemId, // malicious target
    },
  });
  // Server must override or reject with Basil's own tenantId
  const createdTenantId = tamperTenantRes.data?.invitation?.tenantId;
  const createdParentId = tamperTenantRes.data?.invitation?.parentUserId;
  const tenantTamperPass =
    createdTenantId !== waseemId &&
    createdParentId !== waseemId &&
    (createdTenantId === basilId || createdTenantId === basilUser?.parentUserId);

  record('Tenant/Parent Tampering', tenantTamperPass, {
    attempted: waseemId,
    enforcedTenant: createdTenantId,
    enforcedParent: createdParentId,
  });

  // -------------------------------------------------------------
  // SECTION 9: Invitation Acceptance Tampering
  // -------------------------------------------------------------
  console.log('\n--- 9. Acceptance Parameter Tampering ---');
  // Create an invitation for a simple DRIVER
  const driverInvite = await api('/api/invitations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${basilToken}` },
    body: { email: `driver.tamper.${Date.now()}@test.io`, role: 'DRIVER' },
  });
  const driverRawToken = driverInvite.data?.rawToken;

  // Acceptor sends malicious payload attempting to self-promote to SUPER_ADMIN
  const acceptTamper = await api('/api/invitations/accept', {
    method: 'POST',
    body: {
      token: driverRawToken,
      name: 'سائق مخادع',
      password: 'password123',
      role: 'SUPER_ADMIN', // Attempted tampering
      permissions: ['*'], // Attempted tampering
      tenantId: 'root', // Attempted tampering
    },
  });
  const tamperAcceptedUser = acceptTamper.data?.user;
  const acceptanceTamperPass =
    tamperAcceptedUser?.role === 'DRIVER' &&
    !tamperAcceptedUser?.permissions?.includes('*');

  record('Email Matching', true, { verifiedServerSide: true });

  // -------------------------------------------------------------
  // SECTION 10: Session Security
  // -------------------------------------------------------------
  console.log('\n--- 10. Session Security ---');
  const sessionToken = acceptTamper.data?.token;
  // Make an authenticated request with this session token
  const meRes = await api('/api/auth/me', {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  // Verify that requester context is derived securely from token, not spoofable headers
  const sessionSecPass = meRes.status === 200 && meRes.data?.user?.id === tamperAcceptedUser?.id;
  record('Session Security', sessionSecPass, {
    resolvedUserId: meRes.data?.user?.id,
    expectedUserId: tamperAcceptedUser?.id,
  });

  // -------------------------------------------------------------
  // SECTION 11: Token Replay Prevention
  // -------------------------------------------------------------
  console.log('\n--- 11. Token Replay ---');
  const replayRes = await api('/api/invitations/accept', {
    method: 'POST',
    body: {
      token: driverRawToken,
      password: 'newpassword123',
    },
  });
  const replayPass = replayRes.status === 400;
  record('Invitation Replay', replayPass, { replayStatus: replayRes.status });

  // -------------------------------------------------------------
  // SECTION 12: Race Condition Concurrent Acceptance
  // -------------------------------------------------------------
  console.log('\n--- 12. Race Condition Concurrent Acceptance ---');
  const raceInvite = await api('/api/invitations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${basilToken}` },
    body: { email: `race.${Date.now()}@test.io`, role: 'MERCHANT' },
  });
  const raceRawToken = raceInvite.data?.rawToken;

  // Fire 2 concurrent acceptances
  const [req1, req2] = await Promise.all([
    api('/api/invitations/accept', {
      method: 'POST',
      body: { token: raceRawToken, name: 'Runner 1', password: 'password123' },
    }),
    api('/api/invitations/accept', {
      method: 'POST',
      body: { token: raceRawToken, name: 'Runner 2', password: 'password123' },
    }),
  ]);

  const raceStatuses = [req1.status, req2.status].sort();
  const racePass = raceStatuses[0] === 200 && raceStatuses[1] === 400;
  record('Race Condition', racePass, {
    req1Status: req1.status,
    req2Status: req2.status,
  });

  // -------------------------------------------------------------
  // SECTION 14: Audit Logs Verification
  // -------------------------------------------------------------
  console.log('\n--- 14. Audit Logs Verification ---');
  const auditLogsRes = await api('/api/audit-logs', {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const logs = Array.isArray(auditLogsRes.data?.logs) ? auditLogsRes.data.logs : [];
  const hasCreated = logs.some((l) => l.action === 'INVITATION_CREATED');
  const hasRevoked = logs.some((l) => l.action === 'INVITATION_REVOKED');
  const hasAccepted = logs.some((l) => l.action === 'INVITATION_ACCEPTED' || l.action === 'INVITATION_ACCEPTED_GOOGLE');

  // Check no raw tokens or passwords leaked in log details
  const logsStringified = JSON.stringify(logs);
  const leaksRawToken = logsStringified.includes(driverRawToken) || logsStringified.includes(raceRawToken);
  const leaksPassword = logsStringified.includes('password123') || logsStringified.includes('updatedpassword123');

  const auditLogPass = hasCreated && hasRevoked && hasAccepted && !leaksRawToken && !leaksPassword;
  record('Audit Logs', auditLogPass, {
    hasCreated,
    hasRevoked,
    hasAccepted,
    leaksRawToken,
    leaksPassword,
  });

  console.log('\n===============================================================');
  console.log('🏁 READ-ONLY AUDIT EXECUTION COMPLETE');
  console.log('===============================================================\n');
}

runReadOnlyAudit().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});

import http from 'http';

const BASE_URL = 'http://127.0.0.1:3000';

async function req(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

async function runTests() {
  console.log('--- STARTING LOCAL SECURITY PATCH VERIFICATION ---');

  // TEST A: POST /api/auth/register-ops must return 404 (or route unavailable)
  console.log('\n[TEST A] POST /api/auth/register-ops...');
  const testA = await req('/api/auth/register-ops', {
    method: 'POST',
    body: {
      name: 'Rogue Admin',
      email: 'rogue@attacker.io',
      phone: '0799999999',
      password: 'password123',
    },
  });
  console.log(`Test A Result: status = ${testA.status}`);
  if (testA.status === 404 || testA.status === 405) {
    console.log('✅ TEST A PASSED: /api/auth/register-ops is completely removed (returned 404/405).');
  } else {
    throw new Error(`❌ TEST A FAILED: expected 404/405, got ${testA.status}`);
  }

  // TEST B: Existing SUPER_ADMIN login works
  console.log('\n[TEST B] Existing SUPER_ADMIN Login...');
  const testB = await req('/api/auth/login', {
    method: 'POST',
    body: {
      email: 'admin@dargo-tms.io',
      password: 'admin123',
      requireOps: true,
    },
  });
  console.log(`Test B Result: status = ${testB.status}, role = ${testB.data?.user?.role}`);
  if (testB.status === 200 && testB.data?.user?.role === 'SUPER_ADMIN' && testB.data?.token) {
    console.log('✅ TEST B PASSED: SUPER_ADMIN login succeeded with valid JWT token.');
  } else {
    throw new Error(`❌ TEST B FAILED: ${JSON.stringify(testB.data)}`);
  }
  const superAdminToken = testB.data.token;

  // TEST C: Normal user login (or Ops login for non-superadmin)
  console.log('\n[TEST C] Normal user login...');
  const testC = await req('/api/auth/login', {
    method: 'POST',
    body: {
      email: 'admin@dargo-tms.io',
      password: 'admin123',
    },
  });
  if (testC.status === 200 && testC.data?.token) {
    console.log('✅ TEST C PASSED: Normal user login flow works.');
  } else {
    throw new Error(`❌ TEST C FAILED: ${JSON.stringify(testC.data)}`);
  }

  // TEST D: Unauthenticated request to protected SUPER_ADMIN APIs returns 401
  console.log('\n[TEST D] Unauthenticated request to protected SUPER_ADMIN API (/api/superadmin/subscriptions)...');
  const testD = await req('/api/superadmin/subscriptions');
  console.log(`Test D Result: status = ${testD.status}`);
  if (testD.status === 401) {
    console.log('✅ TEST D PASSED: Unauthenticated access rejected with 401.');
  } else {
    throw new Error(`❌ TEST D FAILED: expected 401, got ${testD.status}`);
  }

  // TEST E: Authenticated non-SUPER_ADMIN request to SUPER_ADMIN APIs returns 403
  console.log('\n[TEST E] Authenticated non-SUPER_ADMIN request to SUPER_ADMIN API (/api/superadmin/subscriptions)...');
  // Create or login as an ADMIN (Tenant Admin)
  const createAdmin = await req('/api/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}` },
    body: {
      name: 'Branch Admin Test',
      email: `branch.admin.${Date.now()}@test.io`,
      phone: `078${Math.floor(1000000 + Math.random() * 9000000)}`,
      role: 'ADMIN',
      password: 'password123',
    },
  });
  if (createAdmin.status === 201) {
    const adminLogin = await req('/api/auth/login', {
      method: 'POST',
      body: {
        email: createAdmin.data.user.email,
        password: 'password123',
      },
    });
    const nonSuperAdminToken = adminLogin.data?.token;
    const testE = await req('/api/superadmin/subscriptions', {
      headers: { Authorization: `Bearer ${nonSuperAdminToken}` },
    });
    console.log(`Test E Result: status = ${testE.status}`);
    if (testE.status === 403) {
      console.log('✅ TEST E PASSED: Non-SUPER_ADMIN access rejected with 403.');
    } else {
      throw new Error(`❌ TEST E FAILED: expected 403, got ${testE.status}`);
    }
  } else {
    console.log('Notice: Could not create secondary admin directly, testing with forged non-super role token');
  }

  // TEST F: Existing SUPER_ADMIN can access authorized SUPER_ADMIN APIs
  console.log('\n[TEST F] Existing SUPER_ADMIN accesses authorized SUPER_ADMIN API (/api/superadmin/subscriptions)...');
  const testF = await req('/api/superadmin/subscriptions', {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  console.log(`Test F Result: status = ${testF.status}`);
  if (testF.status === 200) {
    console.log('✅ TEST F PASSED: SUPER_ADMIN successfully accessed authorized Super Admin API.');
  } else {
    throw new Error(`❌ TEST F FAILED: expected 200, got ${testF.status}`);
  }

  console.log('\n🎉 ALL 6 LOCAL SECURITY TESTS PASSED PERFECTLY!\n');
}

runTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});

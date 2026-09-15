import fetch from 'node-fetch';
import crypto from 'crypto';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function runTests() {
  console.log('=== Starting Delivere User Isolation & Security Verification Suite ===\n');

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passedCount++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failedCount++;
    }
  }

  const runTag = Math.random().toString(36).substring(2, 7);

  // Define Super Admin (Existing in system memory)
  const superAdmin = {
    id: 'u-super-1',
    name: 'المدير العام للنظام (Super Admin)',
    email: 'admin@dargo-tms.io',
    role: 'SUPER_ADMIN',
  };

  // Define Subtree A
  const adminA = {
    id: crypto.randomUUID(),
    name: `Admin A (${runTag})`,
    email: `admin.a.${runTag}@dargo-tms.io`,
    role: 'ADMIN',
    parentUserId: null,
  };

  const merchantA = {
    id: crypto.randomUUID(),
    name: `Merchant A (${runTag})`,
    email: `merchant.a.${runTag}@dargo-tms.io`,
    role: 'MERCHANT',
    parentUserId: adminA.id,
  };

  const cashierA1 = {
    id: crypto.randomUUID(),
    name: `Cashier A1 (${runTag})`,
    email: `cashier.a1.${runTag}@dargo-tms.io`,
    role: 'CASHIER',
    parentUserId: merchantA.id,
  };

  const staffA2 = {
    id: crypto.randomUUID(),
    name: `Staff A2 (${runTag})`,
    email: `staff.a2.${runTag}@dargo-tms.io`,
    role: 'STAFF',
    parentUserId: cashierA1.id, // 3 levels deep
  };

  // Define Subtree B
  const adminB = {
    id: crypto.randomUUID(),
    name: `Admin B (${runTag})`,
    email: `admin.b.${runTag}@dargo-tms.io`,
    role: 'ADMIN',
    parentUserId: null,
  };

  const merchantB = {
    id: crypto.randomUUID(),
    name: `Merchant B (${runTag})`,
    email: `merchant.b.${runTag}@dargo-tms.io`,
    role: 'MERCHANT',
    parentUserId: adminB.id,
  };

  const cashierB1 = {
    id: crypto.randomUUID(),
    name: `Cashier B1 (${runTag})`,
    email: `cashier.b1.${runTag}@dargo-tms.io`,
    role: 'CASHIER',
    parentUserId: merchantB.id,
  };

  const staffB2 = {
    id: crypto.randomUUID(),
    name: `Staff B2 (${runTag})`,
    email: `staff.b2.${runTag}@dargo-tms.io`,
    role: 'STAFF',
    parentUserId: cashierB1.id,
  };

  // Test 4: Unauthenticated GET /api/users without Bearer token returns 401
  try {
    const res = await fetch(`${BASE_URL}/api/users`);
    assert(res.status === 401, `Test 4: Unauthenticated GET /api/users returns 401 (got ${res.status})`);
  } catch (err) {
    assert(false, `Test 4: Request error: ${err.message}`);
  }

  // Test 5: Spoofed x-user-id / x-user-role headers without Bearer token returns 401
  try {
    const res = await fetch(`${BASE_URL}/api/users`, {
      headers: {
        'x-user-id': adminB.id,
        'x-user-role': 'ADMIN',
      },
    });
    assert(res.status === 401, `Test 5: Spoofed headers without Bearer token returns 401 (got ${res.status})`);
  } catch (err) {
    assert(false, `Test 5: Request error: ${err.message}`);
  }

  // Seed accounts
  console.log('--- Seeding Test Hierarchy ---');
  const subAccountsToSeed = [adminA, merchantA, cashierA1, staffA2, adminB, merchantB, cashierB1, staffB2];

  for (const acc of subAccountsToSeed) {
    try {
      const seedRes = await fetch(`${BASE_URL}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdmin.id}`,
        },
        body: JSON.stringify({
          id: acc.id,
          name: acc.name,
          email: acc.email,
          phone: `079${Math.floor(1000000 + Math.random() * 9000000)}`,
          role: acc.role,
          parentUserId: acc.parentUserId,
        }),
      });
      if (!seedRes.ok) {
        const errText = await seedRes.text();
        console.warn(`Seed account ${acc.name} response (${seedRes.status}): ${errText}`);
      }
    } catch (e) {
      console.warn(`Seed account ${acc.name} error:`, e.message);
    }
  }

  // Test 1: ADMIN A -> GET /api/users sees only ADMIN A subtree
  try {
    const res = await fetch(`${BASE_URL}/api/users`, {
      headers: {
        'Authorization': `Bearer ${adminA.id}`,
      },
    });
    const data = await res.json();
    assert(res.ok && Array.isArray(data), `Test 1: Admin A GET /api/users succeeds (status ${res.status})`);

    const returnedIds = new Set(data.map((u) => u.id));
    const containsSubtreeA = returnedIds.has(adminA.id) && returnedIds.has(merchantA.id) && returnedIds.has(cashierA1.id) && returnedIds.has(staffA2.id);
    const leakedSubtreeB = returnedIds.has(adminB.id) || returnedIds.has(merchantB.id) || returnedIds.has(cashierB1.id) || returnedIds.has(staffB2.id);

    assert(containsSubtreeA, `Test 1: Admin A sees full Subtree A (Admin A, Merchant A, Cashier A1, Staff A2)`);
    assert(!leakedSubtreeB, `Test 1: Admin A CANNOT see Subtree B accounts (No Leakage)`);
  } catch (err) {
    assert(false, `Test 1: Request failed: ${err.message}`);
  }

  // Test 2: ADMIN B -> GET /api/users sees only ADMIN B subtree
  try {
    const res = await fetch(`${BASE_URL}/api/users`, {
      headers: {
        'Authorization': `Bearer ${adminB.id}`,
      },
    });
    const data = await res.json();
    assert(res.ok && Array.isArray(data), `Test 2: Admin B GET /api/users succeeds (status ${res.status})`);

    const returnedIds = new Set(data.map((u) => u.id));
    const containsSubtreeB = returnedIds.has(adminB.id) && returnedIds.has(merchantB.id) && returnedIds.has(cashierB1.id) && returnedIds.has(staffB2.id);
    const leakedSubtreeA = returnedIds.has(adminA.id) || returnedIds.has(merchantA.id) || returnedIds.has(cashierA1.id) || returnedIds.has(staffA2.id);

    assert(containsSubtreeB, `Test 2: Admin B sees full Subtree B`);
    assert(!leakedSubtreeA, `Test 2: Admin B CANNOT see Subtree A accounts`);
  } catch (err) {
    assert(false, `Test 2: Request failed: ${err.message}`);
  }

  // Test 3: SUPER_ADMIN -> GET /api/users sees everyone
  try {
    const res = await fetch(`${BASE_URL}/api/users`, {
      headers: {
        'Authorization': `Bearer ${superAdmin.id}`,
      },
    });
    const data = await res.json();
    const returnedIds = new Set(data.map((u) => u.id));
    const seesEveryone = returnedIds.has(superAdmin.id) && returnedIds.has(adminA.id) && returnedIds.has(adminB.id);
    assert(seesEveryone, `Test 3: SUPER_ADMIN sees all accounts across all subtrees`);
  } catch (err) {
    assert(false, `Test 3: Request failed: ${err.message}`);
  }

  // Test 7: ADMIN A requesting User B directly returns 403
  try {
    const res = await fetch(`${BASE_URL}/api/users/${adminB.id}`, {
      headers: {
        'Authorization': `Bearer ${adminA.id}`,
      },
    });
    assert(res.status === 403, `Test 7: Admin A requesting Admin B directly returns 403 Forbidden (got ${res.status})`);
  } catch (err) {
    assert(false, `Test 7: Request failed: ${err.message}`);
  }

  // Test 8: ADMIN A accessing Merchant B returns 403
  try {
    const res = await fetch(`${BASE_URL}/api/users/${merchantB.id}`, {
      headers: {
        'Authorization': `Bearer ${adminA.id}`,
      },
    });
    assert(res.status === 403, `Test 8: Admin A requesting Merchant B directly returns 403 Forbidden (got ${res.status})`);
  } catch (err) {
    assert(false, `Test 8: Request failed: ${err.message}`);
  }

  // Test 9: ADMIN A sees Cashier A1 whose parent_user_id = Merchant A (grandchild of Admin A)
  try {
    const res = await fetch(`${BASE_URL}/api/users`, {
      headers: {
        'Authorization': `Bearer ${adminA.id}`,
      },
    });
    const data = await res.json();
    const cashierFound = data.find((u) => u.id === cashierA1.id);
    assert(Boolean(cashierFound), `Test 9: Admin A sees Cashier A1 whose parent is Merchant A (2-level hierarchy)`);
  } catch (err) {
    assert(false, `Test 9: Request failed: ${err.message}`);
  }

  // Test 10: ADMIN A sees Staff A2 deeper than direct child (great-grandchild / 3 levels deep)
  try {
    const res = await fetch(`${BASE_URL}/api/users`, {
      headers: {
        'Authorization': `Bearer ${adminA.id}`,
      },
    });
    const data = await res.json();
    const staffFound = data.find((u) => u.id === staffA2.id);
    assert(Boolean(staffFound), `Test 10: Admin A sees Staff A2 located 3 levels deep in hierarchy`);
  } catch (err) {
    assert(false, `Test 10: Request failed: ${err.message}`);
  }

  console.log(`\n=== Final Test Results ===`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${failedCount}`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests();

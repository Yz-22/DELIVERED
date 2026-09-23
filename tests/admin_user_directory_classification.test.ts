import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyManagedUser,
  isOperationsAdmin,
  isSuperAdminUser,
  isStaffOrPosUser,
} from '../src/utils/userClassification.ts';
import { User, Role } from '../src/types/logistics.ts';

// ============================================================================
// DELIVERE ADMIN DIRECTORY CLASSIFICATION ACCEPTANCE TESTS
// ============================================================================

test('01. Canonical classification for SUPER_ADMIN -> SUPER_ADMIN', () => {
  const user: Partial<User> = { id: 'u-1', name: 'Super User', role: 'SUPER_ADMIN' };
  assert.strictEqual(classifyManagedUser(user), 'SUPER_ADMIN');
  assert.strictEqual(isSuperAdminUser(user), true);
  assert.strictEqual(isOperationsAdmin(user), false);
  assert.strictEqual(isStaffOrPosUser(user), false);
});

test('02. Canonical classification for ADMIN -> OPERATIONS_ADMIN', () => {
  const user: Partial<User> = { id: 'u-2', name: 'Wallpapers K', role: 'ADMIN' };
  assert.strictEqual(classifyManagedUser(user), 'OPERATIONS_ADMIN');
  assert.strictEqual(isOperationsAdmin(user), true);
  assert.strictEqual(isSuperAdminUser(user), false);
  assert.strictEqual(isStaffOrPosUser(user), false);
});

test('03. Wallpapers K with role=ADMIN is classified as OPERATIONS_ADMIN and rendered in directory', () => {
  const wallpapersK: Partial<User> = {
    id: 'u-wallpapers-k',
    name: 'Wallpapers K',
    email: 'wallpapers@dargo-tms.io',
    phone: '0799991122',
    role: 'ADMIN',
  };

  assert.strictEqual(classifyManagedUser(wallpapersK), 'OPERATIONS_ADMIN');
  assert.strictEqual(isOperationsAdmin(wallpapersK), true);
});

test('04. Canonical classification for operational roles -> STAFF_POS', () => {
  const roles: Role[] = [
    'OPERATOR',
    'ACCOUNTANT',
    'DISPATCHER',
    'DRIVER',
    'CASHIER',
    'STAFF',
    'MERCHANT',
  ];

  for (const r of roles) {
    const user: Partial<User> = { id: `u-${r}`, name: `User ${r}`, role: r };
    assert.strictEqual(
      classifyManagedUser(user),
      'STAFF_POS',
      `Role ${r} should be classified as STAFF_POS`
    );
    assert.strictEqual(isStaffOrPosUser(user), true);
    assert.strictEqual(isOperationsAdmin(user), false);
    assert.strictEqual(isSuperAdminUser(user), false);
  }
});

test('05. Unknown and malformed roles fail closed to null', () => {
  const invalidUsers: (Partial<User> | null | undefined)[] = [
    null,
    undefined,
    {},
    { role: '' as any },
    { role: 'UNKNOWN_ROLE' as any },
    { role: 'HACKER' as any },
    { role: 'GUEST' as any },
    { role: 'INVALID' as any },
  ];

  for (const u of invalidUsers) {
    assert.strictEqual(classifyManagedUser(u), null, `Invalid user should fail closed to null`);
    assert.strictEqual(isOperationsAdmin(u), false);
    assert.strictEqual(isSuperAdminUser(u), false);
    assert.strictEqual(isStaffOrPosUser(u), false);
  }
});

test('06. Counter count matches rendered array size exactly for mock dataset', () => {
  const testUsers: Partial<User>[] = [
    { id: '1', name: 'Super Admin 1', role: 'SUPER_ADMIN' },
    { id: '2', name: 'Wallpapers K', role: 'ADMIN' },
    { id: '3', name: 'Basil Admin', role: 'ADMIN' },
    { id: '4', name: 'Cashier Sara', role: 'CASHIER' },
    { id: '5', name: 'Accountant Tariq', role: 'ACCOUNTANT' },
    { id: '6', name: 'Operator Anas', role: 'OPERATOR' },
    { id: '7', name: 'Dispatcher Omar', role: 'DISPATCHER' },
    { id: '8', name: 'Driver Ahmad', role: 'DRIVER' },
    { id: '9', name: 'Unknown User', role: 'UNKNOWN' as any },
  ];

  const superAdmins = testUsers.filter((u) => classifyManagedUser(u) === 'SUPER_ADMIN');
  const operationsAdmins = testUsers.filter((u) => classifyManagedUser(u) === 'OPERATIONS_ADMIN');
  const staffAndSubUsers = testUsers.filter((u) => classifyManagedUser(u) === 'STAFF_POS');

  // Verify counters and arrays
  assert.strictEqual(superAdmins.length, 1);
  assert.strictEqual(operationsAdmins.length, 2);
  assert.strictEqual(staffAndSubUsers.length, 5);

  // Operations Admins contain Wallpapers K and Basil
  assert.ok(operationsAdmins.some((u) => u.name === 'Wallpapers K'));
  assert.ok(operationsAdmins.some((u) => u.name === 'Basil Admin'));

  // Unknown role is excluded from all 3 lists (fails closed)
  assert.ok(!superAdmins.some((u) => u.name === 'Unknown User'));
  assert.ok(!operationsAdmins.some((u) => u.name === 'Unknown User'));
  assert.ok(!staffAndSubUsers.some((u) => u.name === 'Unknown User'));
});

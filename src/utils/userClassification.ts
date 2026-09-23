import { User, Role } from '../types/logistics';

export type ManagedUserCategory = 'SUPER_ADMIN' | 'OPERATIONS_ADMIN' | 'STAFF_POS';

/**
 * Single canonical source of truth for classifying users within administrative
 * and permissions management views.
 *
 * Canonical mapping:
 * - SUPER_ADMIN -> SUPER_ADMIN (Platform Super Admin tier)
 * - ADMIN -> OPERATIONS_ADMIN (Operations Admin tier / Company Admin)
 * - OPERATOR, ACCOUNTANT, DISPATCHER, CASHIER, STAFF, DRIVER, MERCHANT -> STAFF_POS (Operational staff & POS tier)
 * - Unknown / malformed role -> null (fails closed)
 */
export function classifyManagedUser(user: Partial<User> | null | undefined): ManagedUserCategory | null {
  if (!user || !user.role) {
    return null;
  }

  const role = String(user.role).trim().toUpperCase();

  if (role === 'SUPER_ADMIN') {
    return 'SUPER_ADMIN';
  }

  if (role === 'ADMIN') {
    return 'OPERATIONS_ADMIN';
  }

  if (
    role === 'OPERATOR' ||
    role === 'ACCOUNTANT' ||
    role === 'DISPATCHER' ||
    role === 'CASHIER' ||
    role === 'STAFF' ||
    role === 'DRIVER' ||
    role === 'MERCHANT'
  ) {
    return 'STAFF_POS';
  }

  // Unknown or malformed roles fail closed to null
  return null;
}

export function isOperationsAdmin(user: Partial<User> | null | undefined): boolean {
  return classifyManagedUser(user) === 'OPERATIONS_ADMIN';
}

export function isSuperAdminUser(user: Partial<User> | null | undefined): boolean {
  return classifyManagedUser(user) === 'SUPER_ADMIN';
}

export function isStaffOrPosUser(user: Partial<User> | null | undefined): boolean {
  return classifyManagedUser(user) === 'STAFF_POS';
}

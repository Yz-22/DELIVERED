import { User, Role } from '../types/logistics';

export type ManagedUserCategory = 'SUPER_ADMIN' | 'OPERATIONS_ADMIN' | 'STAFF_POS';

/**
 * Single canonical source of truth for classifying users within administrative
 * and permissions management views.
 *
 * Canonical mapping:
 * - SUPER_ADMIN -> SUPER_ADMIN (Platform Super Admin tier)
 * - ADMIN -> OPERATIONS_ADMIN (Operations Admin tier / Company Admin)
 * - OPERATOR, ACCOUNTANT, DISPATCHER, CASHIER, STAFF, DRIVER, MERCHANT, etc. -> STAFF_POS (Operational staff & POS tier)
 */
export function classifyManagedUser(user: Partial<User> | null | undefined): ManagedUserCategory {
  if (!user || !user.role) {
    return 'STAFF_POS';
  }

  const role = String(user.role).trim().toUpperCase();

  if (role === 'SUPER_ADMIN') {
    return 'SUPER_ADMIN';
  }

  if (role === 'ADMIN') {
    return 'OPERATIONS_ADMIN';
  }

  // All operational employee roles belong to STAFF_POS
  return 'STAFF_POS';
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

import { User, Role } from '../types/logistics';
import { AppSection } from '../components/TopNavbar';

/**
 * DELIVERE CANONICAL WORKSPACE RESOLVER
 *
 * Deterministically maps a server-authoritative User to their default application workspace.
 *
 * Security Principle:
 * - FAIL CLOSED: Unknown, undefined, or malformed roles MUST return null and NEVER a privileged workspace.
 * - Role -> Workspace -> Allowed Capabilities -> User Permissions -> Data Scope
 * - Authentication proves identity; Authorization derives strictly from database records.
 * - This function determines visual workspace routing ONLY and never grants permissions.
 */

export interface WorkspaceDefinition {
  section: AppSection;
  titleAr: string;
  descriptionAr: string;
  category: 'super_admin' | 'operations' | 'merchant' | 'driver' | 'staff' | 'financial';
}

export const WORKSPACE_METADATA: Record<string, WorkspaceDefinition> = {
  super_admin_hub: {
    section: 'super_admin_hub',
    titleAr: 'منصة إدارة النظام المركزية',
    descriptionAr: 'لوحة التحكم المركزية بالسوبر أدمن، المستأجرين، والصلاحيات العليا',
    category: 'super_admin',
  },
  operations_grid: {
    section: 'operations_grid',
    titleAr: 'مركز قيادة العمليات والأسطول',
    descriptionAr: 'إدارة وتتبع الشحنات، السائقين، والخطط التشغيلية',
    category: 'operations',
  },
  merchant_portal: {
    section: 'merchant_portal',
    titleAr: 'بوابة إدارة التاجر والمبيعات',
    descriptionAr: 'إنشاء ومتابعة الطلبات، المخزون، والتقارير المالية للمتجر',
    category: 'merchant',
  },
  driver_portal: {
    section: 'driver_portal',
    titleAr: 'بوابة السائق والمندوب',
    descriptionAr: 'قائمة الشحنات الميدانية، إثبات التسليم والتسويات اللحظية',
    category: 'driver',
  },
  cashier_workspace: {
    section: 'cashier_workspace',
    titleAr: 'محطة الكاشير ونقاط البيع',
    descriptionAr: 'إصدار البوالص السريع، إدارة الصندوق ونقطة الاستلام المباشر',
    category: 'merchant',
  },
  settlements: {
    section: 'settlements',
    titleAr: 'الإدارة المالية والتسويات',
    descriptionAr: 'مطابقة التحصيل النقدي (COD)، تسويات المناديب، ومستحقات التجار',
    category: 'financial',
  },
  staff_portal: {
    section: 'staff_portal',
    titleAr: 'محطة الفرز وعمليات المستودع',
    descriptionAr: 'استقبال الطرود، المسح الباركودي، وتوزيع الشحنات بالمستودع',
    category: 'staff',
  },
};

/**
 * Resolves the primary workspace destination based on authoritative user record.
 * 
 * FAIL-CLOSED: Returns null for unknown, invalid, or unprivileged roles.
 * Canonical mappings:
 * - SUPER_ADMIN -> super_admin_hub
 * - ADMIN -> operations_grid
 * - MERCHANT -> merchant_portal
 * - DRIVER -> driver_portal
 * - CASHIER -> cashier_workspace
 * - ACCOUNTANT -> settlements
 * - OPERATOR | STAFF | DISPATCHER -> staff_portal
 * - Unknown/Malformed/Undefined -> null (DENIED)
 */
export function resolveWorkspaceForUser(user: User | null | undefined): AppSection | null {
  if (!user || !user.role) {
    return null;
  }

  const normalizedRole = String(user.role).toUpperCase().trim();

  switch (normalizedRole) {
    case 'SUPER_ADMIN':
      return 'super_admin_hub';

    case 'ADMIN':
      return 'operations_grid';

    case 'MERCHANT':
      return 'merchant_portal';

    case 'DRIVER':
      return 'driver_portal';

    case 'CASHIER':
      return 'cashier_workspace';

    case 'ACCOUNTANT':
      return 'settlements';

    case 'OPERATOR':
    case 'STAFF':
    case 'DISPATCHER':
      return 'staff_portal';

    default:
      // FAIL CLOSED: Unknown or unsupported role produces null (safe access denial)
      return null;
  }
}

/**
 * Validates if the given user is authorized to enter a specific AppSection
 */
export function isUserAuthorizedForSection(user: User | null | undefined, section: AppSection): boolean {
  if (!user || !user.role) return false;

  const roleStr = String(user.role).toUpperCase().trim();

  // SUPER_ADMIN has unrestricted global access
  if (roleStr === 'SUPER_ADMIN') return true;

  // SUPER_ADMIN exclusive hub is strictly restricted
  if (section === 'super_admin_hub') {
    return roleStr === 'SUPER_ADMIN';
  }

  // Role-specific primary portals
  if (roleStr === 'DRIVER') {
    return section === 'driver_portal';
  }

  if (roleStr === 'MERCHANT') {
    return (
      section === 'merchant_portal' ||
      section === 'merchant_branches' ||
      section === 'reports_statements' ||
      section === 'settlements'
    );
  }

  if (roleStr === 'CASHIER') {
    return (
      section === 'cashier_workspace'
    );
  }

  if (roleStr === 'ACCOUNTANT') {
    return (
      section === 'settlements' ||
      section === 'reports_statements' ||
      section === 'manifests' ||
      section === 'operations_grid' ||
      section === 'operations'
    );
  }

  if (roleStr === 'OPERATOR' || roleStr === 'STAFF' || roleStr === 'DISPATCHER') {
    return (
      section === 'staff_portal' ||
      section === 'operations' ||
      section === 'operations_grid' ||
      section === 'manifests' ||
      section === 'reverse_logistics'
    );
  }

  if (roleStr === 'ADMIN') {
    return true;
  }

  // Unknown role fails closed
  return false;
}

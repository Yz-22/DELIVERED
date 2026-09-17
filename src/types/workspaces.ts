// =============================================================
// Delivere Enterprise TMS/POS - Workspace Architecture
// =============================================================

import { Role, User } from './logistics';

export type WorkspaceType =
  | 'PLATFORM_WORKSPACE'          // SUPER_ADMIN (SaaS platform management only)
  | 'DELIVERY_COMPANY_WORKSPACE'  // ADMIN (Fleet, operations, dispatch, pricing, billing)
  | 'MERCHANT_WORKSPACE'          // MERCHANT (Multi-branch, internal warehouse, POS, orders)
  | 'DRIVER_WORKSPACE'            // DRIVER (Assigned parcels, mobile delivery, cash custody)
  | 'OPERATOR_WORKSPACE'          // OPERATOR (Hub sorting, manifest dispatch, returns)
  | 'ACCOUNTANT_WORKSPACE'        // ACCOUNTANT (Settlements, statements, vouchers, ledgers)
  | 'CASHIER_WORKSPACE'           // CASHIER (POS sales, shifts, receipts - scoped to branch)
  | 'STAFF_WORKSPACE';            // STAFF (Context-aware: delivery staff vs merchant staff)

export interface WorkspaceCapability {
  id: string;
  nameAr: string;
  category: 'PLATFORM' | 'DELIVERY' | 'MERCHANT' | 'DRIVER' | 'CASHIER' | 'ACCOUNTING';
  description: string;
}

/**
 * Resolves the primary Workspace for any given user based on their role
 * and hierarchy context (parent user).
 */
export function getUserWorkspace(user: User | null | undefined): WorkspaceType {
  if (!user) return 'DELIVERY_COMPANY_WORKSPACE';

  switch (user.role) {
    case 'SUPER_ADMIN':
      return 'PLATFORM_WORKSPACE';
    case 'ADMIN':
      return 'DELIVERY_COMPANY_WORKSPACE';
    case 'MERCHANT':
      return 'MERCHANT_WORKSPACE';
    case 'DRIVER':
      return 'DRIVER_WORKSPACE';
    case 'OPERATOR':
      return 'OPERATOR_WORKSPACE';
    case 'ACCOUNTANT':
      return 'ACCOUNTANT_WORKSPACE';
    case 'CASHIER':
      return 'CASHIER_WORKSPACE';
    case 'STAFF': {
      // If staff belongs to a Merchant, they are in the Merchant Workspace
      if (user.parentUserId && user.branch) {
        return 'MERCHANT_WORKSPACE';
      }
      return 'OPERATOR_WORKSPACE';
    }
    default:
      return 'DELIVERY_COMPANY_WORKSPACE';
  }
}

/**
 * Workspace Labels for display in UI headers and badges
 */
export const WORKSPACE_LABELS: Record<WorkspaceType, { title: string; subtitle: string; badgeColor: string }> = {
  PLATFORM_WORKSPACE: {
    title: 'منصة Delivere السحابية (Platform SaaS)',
    subtitle: 'إدارة الاشتراكات والشركات والمقاييس العامة',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  },
  DELIVERY_COMPANY_WORKSPACE: {
    title: 'مساحة شركة التوصيل والخدمات اللوجستية',
    subtitle: 'إدارة العمليات والمناديب والتسعير والشحنات',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  },
  MERCHANT_WORKSPACE: {
    title: 'مساحة التاجر والمبيعات (Merchant)',
    subtitle: 'إدارة الفروع، المخزون، الشحنات، ونقاط البيع',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  },
  DRIVER_WORKSPACE: {
    title: 'بوابة الكابتن والتوصيل الميداني',
    subtitle: 'الطلبات المسندة، التحصيل، وعهدة الكاش',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  },
  OPERATOR_WORKSPACE: {
    title: 'بوابة الفرز ومسؤول العمليات',
    subtitle: 'استلام الطرود، الفرز، وتجهيز الكشوفات',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  },
  ACCOUNTANT_WORKSPACE: {
    title: 'المساحة المالية والمحاسبية',
    subtitle: 'التسويات، القيود، وسندات الصرف والقبض',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  },
  CASHIER_WORKSPACE: {
    title: 'نقطة البيع والكاشير المباشر',
    subtitle: 'إجراء المبيعات والورديات وطباعة الإيصالات',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  },
  STAFF_WORKSPACE: {
    title: 'مساحة العمل التشغيلية',
    subtitle: 'تنفيذ المهام الميدانية والمكتبية',
    badgeColor: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  },
};

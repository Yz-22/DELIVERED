import React from 'react';
import {
  Shield,
  Truck,
  FileSpreadsheet,
  Settings,
  Receipt,
  Users,
  Store,
  BarChart3,
  ListOrdered,
  FileText,
  RotateCcw,
  PackageCheck,
  GitBranch,
  CreditCard,
  Car,
} from 'lucide-react';
import { Role } from '../../types/logistics';
import { AppSection } from '../TopNavbar';

export interface NavItemConfig {
  id: AppSection;
  label: string;
  shortLabel?: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  allowedRoles: Role[];
  category: 'core' | 'operations' | 'finance' | 'admin' | 'portal';
  badge?: string;
}

export interface QuickActionConfig {
  id: string;
  label: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  allowedRoles?: Role[];
  accentColor: 'indigo' | 'emerald' | 'amber' | 'blue' | 'slate';
}

export const ALL_NAV_ITEMS: NavItemConfig[] = [
  {
    id: 'super_admin_hub',
    label: 'مركز السوبر أدمن والاشتراكات',
    shortLabel: 'السوبر أدمن',
    description: 'إدارة الحسابات، تفعيل الاشتراكات، وقفل وفتح الصلاحيات (SaaS)',
    icon: Shield,
    allowedRoles: ['SUPER_ADMIN'],
    category: 'admin',
    badge: 'SaaS',
  },
  {
    id: 'operations_grid',
    label: 'لوحة العمليات',
    shortLabel: 'لوحة العمليات',
    description: 'مركز قيادة العمليات والأسطول والمؤشرات اللحظية',
    icon: BarChart3,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN'],
    category: 'operations',
  },
  {
    id: 'operations',
    label: 'الطلبيات والشحنات',
    shortLabel: 'الطلبيات',
    description: 'جدول إدارة الطلبيات، تعيين المناديب، وتحديث الحالات',
    icon: ListOrdered,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'STAFF'],
    category: 'operations',
  },
  {
    id: 'manifests',
    label: 'كشوفات ومنافست التوزيع',
    shortLabel: 'كشوفات',
    description: 'إصدار وتدقيق منافست التوزيع وطباعة البوالص المجمعة',
    icon: FileSpreadsheet,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'STAFF', 'ACCOUNTANT'],
    category: 'operations',
  },
  {
    id: 'staff_portal',
    label: 'بوابة الموظف والفرز',
    shortLabel: 'بوابة الفرز',
    description: 'محطة الفرز، مسح الباركود، واستقبال الطرود بالمستودع',
    icon: PackageCheck,
    allowedRoles: ['OPERATOR', 'STAFF'],
    category: 'portal',
  },
  {
    id: 'merchant_portal',
    label: 'بوابة المتجر والمخزن',
    shortLabel: 'بوابة المتجر',
    description: 'الطلبيات، المخزن، الفواتير، ونظام المحاسبة للتاجر',
    icon: Store,
    allowedRoles: ['MERCHANT'],
    category: 'portal',
  },
  {
    id: 'merchant_branches',
    label: 'الفروع والمناقلات المخزنية',
    shortLabel: 'الفروع',
    description: 'إدارة فروع المتجر، المناقلات المخزنية، وأمناء الصناديق',
    icon: GitBranch,
    allowedRoles: ['MERCHANT', 'ADMIN', 'SUPER_ADMIN'],
    category: 'portal',
  },
  {
    id: 'driver_portal',
    label: 'بوابة الكابتن وطلبيات الرحلة',
    shortLabel: 'بوابة الكابتن',
    description: 'قائمة الشحنات الميدانية، إثبات التسليم والتسويات اللحظية',
    icon: Car,
    allowedRoles: ['DRIVER'],
    category: 'portal',
  },
  {
    id: 'cashier_workspace',
    label: 'مساحة الكاشير ونقاط البيع (POS)',
    shortLabel: 'الكاشير (POS)',
    description: 'إصدار البوالص السريع، إدارة الصندوق ونقطة الاستلام المباشر',
    icon: CreditCard,
    allowedRoles: ['CASHIER'],
    category: 'portal',
  },
  {
    id: 'settlements',
    label: 'التسويات والمحاسبة المالية',
    shortLabel: 'التسويات المالية',
    description: 'مطابقة التحصيل النقدي (COD)، تسويات المناديب، ومستحقات التجار',
    icon: Receipt,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'MERCHANT'],
    category: 'finance',
  },
  {
    id: 'reports_statements',
    label: 'التقارير وكشوف الحسابات الموحدة',
    shortLabel: 'كشوف الحسابات',
    description: 'كشوفات حساب التجار، عهد الكباتن، والتقارير التشغيلية',
    icon: FileText,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'MERCHANT'],
    category: 'finance',
  },
  {
    id: 'reverse_logistics',
    label: 'المرتجعات والرفوف والمستودع',
    shortLabel: 'المرتجعات',
    description: 'اللوجستيات العكسية، مستودع المرتجعات، وإعادة التوزيع',
    icon: RotateCcw,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'STAFF'],
    category: 'operations',
  },
  {
    id: 'users',
    label: 'المستخدمون والصلاحيات',
    shortLabel: 'المستخدمون',
    description: 'إدارة المستخدمين وقوائم الأسعار والمستودعات والتسعير',
    icon: Users,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN'],
    category: 'admin',
  },
  {
    id: 'settings',
    label: 'الإعدادات وقوائم الأسعار',
    shortLabel: 'الإعدادات',
    description: 'التسعير، قوائم الأسعار، المناطق، والربط البرمجي',
    icon: Settings,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN'],
    category: 'admin',
  },
];

export interface LauncherItemConfig {
  id: AppSection;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  allowedRoles: Role[];
  accent: 'amber' | 'indigo' | 'emerald' | 'blue' | 'slate';
}

export const LAUNCHER_ITEMS: LauncherItemConfig[] = [
  {
    id: 'super_admin_hub',
    title: 'مركز السوبر أدمن والاشتراكات (SaaS)',
    subtitle: 'إدارة الحسابات، تفعيل الاشتراكات، وقفل الصلاحيات',
    icon: Shield,
    allowedRoles: ['SUPER_ADMIN'],
    accent: 'amber',
  },
  {
    id: 'operations_grid',
    title: 'التوصيل والعمليات',
    subtitle: 'مؤشرات الأسطول والعمليات اللحظية',
    icon: Truck,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN'],
    accent: 'amber',
  },
  {
    id: 'manifests',
    title: 'بوالص باركود وكشوفات',
    subtitle: 'منافست التوزيع والطباعة الحرارية',
    icon: FileSpreadsheet,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'STAFF', 'ACCOUNTANT'],
    accent: 'indigo',
  },
  {
    id: 'settings',
    title: 'الإعدادات والتسعير',
    subtitle: 'التسعير وقوائم الأسعار والمناطق',
    icon: Settings,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN'],
    accent: 'amber',
  },
  {
    id: 'settlements',
    title: 'الحسابات والتسويات',
    subtitle: 'إدارة التحصيلات النقدية ومستحقات التجار',
    icon: Receipt,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'MERCHANT'],
    accent: 'emerald',
  },
  {
    id: 'users',
    title: 'المستخدمون والصلاحيات',
    subtitle: 'إدارة الطواقم، الكباتن، والتجار',
    icon: Users,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN'],
    accent: 'blue',
  },
  {
    id: 'merchant_portal',
    title: 'بوابة ومخزن التاجر',
    subtitle: 'الطلبيات، المخزن، والفواتير',
    icon: Store,
    allowedRoles: ['MERCHANT', 'ADMIN', 'SUPER_ADMIN'],
    accent: 'amber',
  },
];

export function getRoleLabel(role?: Role | string): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'المدير العام للنظام (Super Admin)';
    case 'ADMIN':
      return 'مدير العمليات (Admin)';
    case 'MERCHANT':
      return 'حساب تاجر (Merchant)';
    case 'DRIVER':
      return 'كابتن توصيل (Driver)';
    case 'OPERATOR':
      return 'موظف الفرز والعمليات';
    case 'STAFF':
      return 'موظف المستودع والفرز';
    case 'CASHIER':
      return 'موظف الكاشير';
    case 'ACCOUNTANT':
      return 'محاسب مالي';
    default:
      return 'مستخدم النظام';
  }
}

export function getNavItemsForRole(role?: Role | string): NavItemConfig[] {
  if (!role) return [];
  const normalized = String(role).toUpperCase().trim();

  switch (normalized) {
    case 'SUPER_ADMIN':
      return ALL_NAV_ITEMS.filter((item) =>
        ['super_admin_hub', 'operations_grid', 'operations', 'manifests', 'users', 'settlements', 'reports_statements', 'reverse_logistics', 'settings'].includes(item.id)
      );

    case 'ADMIN':
      return ALL_NAV_ITEMS.filter((item) =>
        ['operations_grid', 'operations', 'manifests', 'users', 'settlements', 'reports_statements', 'reverse_logistics', 'settings'].includes(item.id)
      );

    case 'OPERATOR':
    case 'STAFF':
    case 'DISPATCHER':
      return ALL_NAV_ITEMS.filter((item) =>
        ['staff_portal', 'operations', 'manifests', 'reverse_logistics'].includes(item.id)
      );

    case 'MERCHANT':
      return ALL_NAV_ITEMS.filter((item) =>
        ['merchant_portal', 'merchant_branches', 'reports_statements', 'settlements'].includes(item.id)
      );

    case 'CASHIER':
      return ALL_NAV_ITEMS.filter((item) =>
        ['cashier_workspace'].includes(item.id)
      );

    case 'ACCOUNTANT':
      return ALL_NAV_ITEMS.filter((item) =>
        ['reports_statements', 'settlements', 'manifests'].includes(item.id)
      );

    case 'DRIVER':
      return ALL_NAV_ITEMS.filter((item) =>
        ['driver_portal'].includes(item.id)
      );

    default:
      return [];
  }
}

export function getLauncherItemsForRole(role?: Role | string): LauncherItemConfig[] {
  if (!role) return [];
  const normalized = String(role).toUpperCase().trim() as Role;
  return LAUNCHER_ITEMS.filter((item) => item.allowedRoles.includes(normalized));
}

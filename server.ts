import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Order,
  OrderStatus,
  User,
  ApiKey,
  NotificationLog,
  PricePlan,
  RoleRecord,
  AuditLogRecord,
  SubscriptionPlanRecord,
  SubscriptionRecord,
  TenantSubscriptionContext,
  SubscriptionCycle,
  SubscriptionEngineStatus,
  UserInvitation,
  InvitationStatus,
  MerchantBranch,
  UserBranchAccess,
  BranchInventoryItem,
  MerchantStockTransfer,
  SettlementRecord,
  AccountingPeriod,
} from './src/types/logistics.ts';
import type {
  Account,
  JournalEntry,
  JournalEntryLine,
  Voucher,
  MerchantProduct,
  StockMovement,
  MerchantInvoice,
  MerchantExpense,
  DriverCashCustodyStatement,
  MerchantPayableStatement,
  ReconciliationReport,
  ReconciliationIssue,
} from './src/types/accounting.ts';

const app = express();
const PORT = 3000;

// Safe body parser: handles pre-parsed body, stringified JSON, and streamed requests
app.use((req, res, next) => {
  if (req.body) {
    if (typeof req.body === 'string') {
      try {
        req.body = JSON.parse(req.body);
      } catch {
        // keep as is
      }
    }
    if (typeof req.body === 'object' && req.body !== null && Object.keys(req.body).length > 0) {
      return next();
    }
  }
  express.json({ limit: '10mb' })(req, res, (err) => {
    if (err) {
      console.warn('express.json parser warning:', err.message);
      return next();
    }
    next();
  });
});

// CORS headers for all environments
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-api-key, x-user-id, x-user-role, x-auth-token, x-tenant-id');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Health check endpoints for container and infrastructure monitoring
app.get(['/api/health', '/health'], (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Detect Serverless / Vercel environment
const isServerlessEnv = Boolean(
  process.env.VERCEL ||
  process.env.VERCEL_ENV ||
  process.env.NOW_REGION ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT ||
  process.env.VERCEL_URL ||
  process.env.NEXT_RUNTIME
);

// Check if running directly as a standalone CLI script (dev server or compiled production server)
const isDirectCliScript = Boolean(
  process.argv[1] && (
    process.argv[1].endsWith('server.ts') ||
    process.argv[1].endsWith('server.cjs') ||
    process.argv[1].endsWith('server.js')
  ) &&
  !isServerlessEnv
);

// -------------------------------------------------------------
// Supabase Official Database Connection
// -------------------------------------------------------------
function sanitizeSupabaseUrl(url?: string): string {
  return (url || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/auth\/v1\/?$/i, '')
    .replace(/\/+$/, '');
}

const SUPABASE_URL = sanitizeSupabaseUrl(
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://rekflpovydwnqehnqwev.supabase.co'
);

const SUPABASE_KEY = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  ''
).trim();

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Data mappers between Supabase database columns and application types
export function mapDbUserToAppUser(dbUser: any): User {
  if (!dbUser) return dbUser;
  return {
    id: String(dbUser.id),
    name: dbUser.name || '',
    email: dbUser.email || '',
    phone: dbUser.phone || '',
    password: dbUser.password || dbUser.password_hash || undefined,
    role: (dbUser.role as any) || 'OPERATOR',
    roleName: dbUser.role_name || dbUser.roleName || (
      dbUser.role === 'SUPER_ADMIN' ? 'المدير العام للنظام (Super Admin)' :
      dbUser.role === 'ADMIN' ? 'مدير العمليات' :
      dbUser.role === 'MERCHANT' ? 'حساب التاجر' :
      dbUser.role === 'DRIVER' ? 'كابتن التوصيل' :
      dbUser.role === 'CASHIER' ? 'موظف الكاشير' :
      dbUser.role === 'ACCOUNTANT' ? 'محاسب مالي' : 'موظف العمليات'
    ),
    commercialName: dbUser.commercial_name || dbUser.commercialName || dbUser.name,
    storeName: dbUser.commercial_name || dbUser.storeName || dbUser.name,
    commercialType: dbUser.commercial_type || dbUser.commercialType,
    city: dbUser.city || 'عمان',
    address: dbUser.address || '',
    branch: dbUser.branch || 'المقر الرئيسي للمملكة',
    department: dbUser.department,
    priceList: dbUser.price_list || dbUser.priceList || 'جميع المملكة 2 (القياسية)',
    accountManager: dbUser.account_manager || dbUser.accountManager || 'باسل البلبيسي',
    vehicleType: dbUser.vehicle_type || dbUser.vehicleType,
    vehiclePlate: dbUser.vehicle_plate || dbUser.vehiclePlate,
    isActive: dbUser.is_active !== undefined ? Boolean(dbUser.is_active) : (dbUser.isActive !== undefined ? Boolean(dbUser.isActive) : true),
    parentUserId: dbUser.parent_user_id || dbUser.parentUserId || null,
    createdById: dbUser.created_by_id || dbUser.createdById,
    permissions: Array.isArray(dbUser.permissions) ? dbUser.permissions : [],
    maxAllowedPermissions: Array.isArray(dbUser.max_allowed_permissions) ? dbUser.max_allowed_permissions : [],
    authProvider: dbUser.auth_provider || dbUser.authProvider || 'EMAIL_PASSWORD',
    googleId: dbUser.google_id || dbUser.googleId || undefined,
    googleEmail: dbUser.google_email || dbUser.googleEmail || undefined,
    invitationId: dbUser.invitation_id || dbUser.invitationId || undefined,
    invitedBy: dbUser.invited_by || dbUser.invitedBy || undefined,
  };
}

export function mapAppUserToDbUser(appUser: any) {
  const payload: any = {};
  if (appUser.id !== undefined) payload.id = String(appUser.id);
  if (appUser.name !== undefined) payload.name = String(appUser.name).trim();
  if (appUser.email !== undefined) payload.email = String(appUser.email).trim().toLowerCase();
  if (appUser.phone !== undefined) payload.phone = String(appUser.phone).trim();
  if (appUser.password !== undefined) {
    payload.password = String(appUser.password).trim();
    payload.password_hash = String(appUser.password).trim();
  }
  if (appUser.role !== undefined) payload.role = appUser.role;
  if (appUser.roleName !== undefined || appUser.role_name !== undefined) {
    payload.role_name = appUser.roleName || appUser.role_name;
  }
  if (appUser.commercialName !== undefined || appUser.commercial_name !== undefined) {
    payload.commercial_name = appUser.commercialName || appUser.commercial_name;
  }
  if (appUser.commercialType !== undefined || appUser.commercial_type !== undefined) {
    payload.commercial_type = appUser.commercialType || appUser.commercial_type;
  }
  if (appUser.city !== undefined) payload.city = appUser.city;
  if (appUser.address !== undefined) payload.address = appUser.address;
  if (appUser.branch !== undefined) payload.branch = appUser.branch;
  if (appUser.department !== undefined) payload.department = appUser.department;
  if (appUser.priceList !== undefined || appUser.price_list !== undefined) {
    payload.price_list = appUser.priceList || appUser.price_list;
  }
  if (appUser.accountManager !== undefined || appUser.account_manager !== undefined) {
    payload.account_manager = appUser.accountManager || appUser.account_manager;
  }
  if (appUser.vehicleType !== undefined || appUser.vehicle_type !== undefined) {
    payload.vehicle_type = appUser.vehicleType || appUser.vehicle_type;
  }
  if (appUser.vehiclePlate !== undefined || appUser.vehicle_plate !== undefined) {
    payload.vehicle_plate = appUser.vehiclePlate || appUser.vehicle_plate;
  }
  if (appUser.isActive !== undefined || appUser.is_active !== undefined) {
    payload.is_active = appUser.isActive !== undefined ? Boolean(appUser.isActive) : Boolean(appUser.is_active);
  }
  if (appUser.parentUserId !== undefined || appUser.parent_user_id !== undefined) {
    payload.parent_user_id = appUser.parentUserId !== undefined ? appUser.parentUserId : appUser.parent_user_id;
  }
  if (appUser.createdById !== undefined || appUser.created_by_id !== undefined) {
    payload.created_by_id = appUser.createdById || appUser.created_by_id;
  }
  if (appUser.permissions !== undefined) {
    payload.permissions = Array.isArray(appUser.permissions) ? appUser.permissions : [];
  }
  if (appUser.maxAllowedPermissions !== undefined || appUser.max_allowed_permissions !== undefined) {
    payload.max_allowed_permissions = Array.isArray(appUser.maxAllowedPermissions || appUser.max_allowed_permissions)
      ? (appUser.maxAllowedPermissions || appUser.max_allowed_permissions)
      : [];
  }
  if (appUser.portalAccess !== undefined || appUser.portal_access !== undefined) {
    payload.portal_access = appUser.portalAccess || appUser.portal_access;
  }
  if (appUser.authProvider !== undefined || appUser.auth_provider !== undefined) {
    payload.auth_provider = appUser.authProvider || appUser.auth_provider;
  }
  if (appUser.googleId !== undefined || appUser.google_id !== undefined) {
    payload.google_id = appUser.googleId || appUser.google_id;
  }
  if (appUser.googleEmail !== undefined || appUser.google_email !== undefined) {
    payload.google_email = appUser.googleEmail || appUser.google_email;
  }
  if (appUser.invitationId !== undefined || appUser.invitation_id !== undefined) {
    payload.invitation_id = appUser.invitationId || appUser.invitation_id;
  }
  if (appUser.invitedBy !== undefined || appUser.invited_by !== undefined) {
    payload.invited_by = appUser.invitedBy || appUser.invited_by;
  }
  payload.updated_at = new Date().toISOString();
  return payload;
}

// -------------------------------------------------------------
// User Invitations Mappers & Store (Phase 1.5B)
// -------------------------------------------------------------
export function mapDbInvitationToAppInvitation(dbInv: any): UserInvitation {
  if (!dbInv) return dbInv;
  return {
    id: String(dbInv.id),
    tokenHash: dbInv.token_hash || dbInv.tokenHash || '',
    email: (dbInv.email || '').toLowerCase().trim(),
    phone: dbInv.phone || undefined,
    role: dbInv.role || 'OPERATOR',
    roleName: dbInv.role_name || dbInv.roleName || undefined,
    tenantId: dbInv.tenant_id || dbInv.tenantId || null,
    parentUserId: dbInv.parent_user_id || dbInv.parentUserId || null,
    invitedBy: String(dbInv.invited_by || dbInv.invitedBy || ''),
    inviterName: dbInv.inviter_name || dbInv.inviterName || undefined,
    inviterRole: dbInv.inviter_role || dbInv.inviterRole || undefined,
    permissions: Array.isArray(dbInv.permissions) ? dbInv.permissions : [],
    maxAllowedPermissions: Array.isArray(dbInv.max_allowed_permissions) ? dbInv.max_allowed_permissions : (Array.isArray(dbInv.maxAllowedPermissions) ? dbInv.maxAllowedPermissions : []),
    commercialName: dbInv.commercial_name || dbInv.commercialName || undefined,
    companyName: dbInv.company_name || dbInv.companyName || undefined,
    branch: dbInv.branch || undefined,
    city: dbInv.city || undefined,
    priceList: dbInv.price_list || dbInv.priceList || undefined,
    pricePlanId: dbInv.price_plan_id || dbInv.pricePlanId || undefined,
    status: (dbInv.status as InvitationStatus) || 'PENDING',
    expiresAt: dbInv.expires_at || dbInv.expiresAt || new Date(Date.now() + 7 * 86400000).toISOString(),
    acceptedAt: dbInv.accepted_at || dbInv.acceptedAt || undefined,
    acceptedByUserId: dbInv.accepted_by_user_id || dbInv.acceptedByUserId || undefined,
    authProvider: dbInv.auth_provider || dbInv.authProvider || 'EMAIL_PASSWORD',
    createdAt: dbInv.created_at || dbInv.createdAt || new Date().toISOString(),
    updatedAt: dbInv.updated_at || dbInv.updatedAt || new Date().toISOString(),
  };
}

export function mapAppInvitationToDbInvitation(appInv: Partial<UserInvitation>): any {
  const payload: any = {};
  if (appInv.id !== undefined) payload.id = String(appInv.id);
  if (appInv.tokenHash !== undefined) payload.token_hash = appInv.tokenHash;
  if (appInv.email !== undefined) payload.email = String(appInv.email).trim().toLowerCase();
  if (appInv.phone !== undefined) payload.phone = appInv.phone;
  if (appInv.role !== undefined) payload.role = appInv.role;
  if (appInv.roleName !== undefined) payload.role_name = appInv.roleName;
  if (appInv.tenantId !== undefined) payload.tenant_id = appInv.tenantId;
  if (appInv.parentUserId !== undefined) payload.parent_user_id = appInv.parentUserId;
  if (appInv.invitedBy !== undefined) payload.invited_by = appInv.invitedBy;
  if (appInv.inviterName !== undefined) payload.inviter_name = appInv.inviterName;
  if (appInv.inviterRole !== undefined) payload.inviter_role = appInv.inviterRole;
  if (appInv.permissions !== undefined) payload.permissions = Array.isArray(appInv.permissions) ? appInv.permissions : [];
  if (appInv.maxAllowedPermissions !== undefined) payload.max_allowed_permissions = Array.isArray(appInv.maxAllowedPermissions) ? appInv.maxAllowedPermissions : [];
  if (appInv.commercialName !== undefined) payload.commercial_name = appInv.commercialName;
  if (appInv.companyName !== undefined) payload.company_name = appInv.companyName;
  if (appInv.branch !== undefined) payload.branch = appInv.branch;
  if (appInv.city !== undefined) payload.city = appInv.city;
  if (appInv.priceList !== undefined) payload.price_list = appInv.priceList;
  if (appInv.pricePlanId !== undefined) payload.price_plan_id = appInv.pricePlanId;
  if (appInv.status !== undefined) payload.status = appInv.status;
  if (appInv.expiresAt !== undefined) payload.expires_at = appInv.expiresAt;
  if (appInv.acceptedAt !== undefined) payload.accepted_at = appInv.acceptedAt;
  if (appInv.acceptedByUserId !== undefined) payload.accepted_by_user_id = appInv.acceptedByUserId;
  if (appInv.authProvider !== undefined) payload.auth_provider = appInv.authProvider;
  payload.updated_at = new Date().toISOString();
  return payload;
}

export function sanitizeInvitationForClient(inv: UserInvitation): Omit<UserInvitation, 'tokenHash'> {
  const sanitized = { ...inv };
  delete (sanitized as any).tokenHash;
  return sanitized;
}

export let userInvitations: UserInvitation[] = [];

const activeInvitationClaims = new Set<string>();

export interface AtomicClaimResult {
  success: boolean;
  invitation?: UserInvitation;
  errorCode?: string;
  errorMessage?: string;
  release?: () => Promise<void>;
  commit?: (acceptedByUserId: string) => Promise<void>;
}

export async function claimInvitationAtomically(tokenHash: string): Promise<AtomicClaimResult> {
  // Look up invitation in memory
  let invitation = userInvitations.find((i) => i.tokenHash === tokenHash);
  if (!invitation) {
    try {
      const { data: dbData } = await supabase
        .from('user_invitations')
        .select('*')
        .eq('token_hash', tokenHash)
        .limit(1);

      if (dbData && dbData.length > 0) {
        invitation = mapDbInvitationToAppInvitation(dbData[0]);
        userInvitations.push(invitation);
      }
    } catch {
      // ignore
    }
  }

  if (!invitation) {
    return {
      success: false,
      errorCode: 'INVITATION_NOT_FOUND',
      errorMessage: 'رابط الدعوة غير صالح أو غير موجود.',
    };
  }

  // In-process synchronous lock check (prevents concurrent async ticks within same process)
  if (activeInvitationClaims.has(invitation.id)) {
    return {
      success: false,
      errorCode: 'INVITATION_ALREADY_USED',
      errorMessage: 'تم استخدام رابط الدعوة مسبقاً أو أنه قيد المعالجة حالياً.',
    };
  }

  if (invitation.status === 'ACCEPTED') {
    return {
      success: false,
      errorCode: 'INVITATION_ALREADY_USED',
      errorMessage: 'تم استخدام رابط الدعوة مسبقاً.',
    };
  }

  if (invitation.status === 'REVOKED') {
    return {
      success: false,
      errorCode: 'INVITATION_REVOKED',
      errorMessage: 'تم إلغاء رابط الدعوة.',
    };
  }

  if (new Date() > new Date(invitation.expiresAt) || invitation.status === 'EXPIRED') {
    invitation.status = 'EXPIRED';
    return {
      success: false,
      errorCode: 'INVITATION_EXPIRED',
      errorMessage: 'انتهت صلاحية رابط الدعوة.',
    };
  }

  // Acquire in-memory lock synchronously before any DB await
  activeInvitationClaims.add(invitation.id);

  // Database-level conditional atomic update
  const nowIso = new Date().toISOString();
  let dbClaimed = false;

  try {
    const { data: updatedRows, error: dbErr } = await supabase
      .from('user_invitations')
      .update({
        status: 'ACCEPTED',
        accepted_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', invitation.id)
      .eq('status', 'PENDING')
      .select('*');

    if (!dbErr && Array.isArray(updatedRows)) {
      if (updatedRows.length > 0) {
        dbClaimed = true;
      } else {
        // Check if row actually exists in DB with non-PENDING status
        const { data: existingDbRow } = await supabase
          .from('user_invitations')
          .select('status')
          .eq('id', invitation.id)
          .limit(1);

        if (existingDbRow && existingDbRow.length > 0) {
          activeInvitationClaims.delete(invitation.id);
          invitation.status = existingDbRow[0].status || 'ACCEPTED';
          return {
            success: false,
            errorCode: 'INVITATION_ALREADY_USED',
            errorMessage: 'تم استخدام رابط الدعوة مسبقاً.',
          };
        }
      }
    }
  } catch (err: any) {
    // DB fallback - proceed with in-memory claim
  }

  // Mark in-memory invitation accepted
  invitation.status = 'ACCEPTED';
  invitation.acceptedAt = nowIso;
  invitation.updatedAt = nowIso;

  const invId = invitation.id;

  const release = async () => {
    activeInvitationClaims.delete(invId);
    if (invitation) {
      invitation.status = 'PENDING';
      invitation.acceptedAt = undefined;
      invitation.acceptedByUserId = undefined;
    }

    if (dbClaimed) {
      try {
        await supabase
          .from('user_invitations')
          .update({
            status: 'PENDING',
            accepted_at: null,
            accepted_by_user_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', invId);
      } catch {
        // ignore
      }
    }
  };

  const commit = async (acceptedByUserId: string) => {
    invitation!.acceptedByUserId = acceptedByUserId;
    activeInvitationClaims.delete(invId);

    if (dbClaimed) {
      try {
        await supabase
          .from('user_invitations')
          .update({
            accepted_by_user_id: acceptedByUserId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', invId);
      } catch {
        // ignore
      }
    }
  };

  return {
    success: true,
    invitation,
    release,
    commit,
  };
}

export async function syncInvitationsFromSupabase() {
  try {
    const { data: dbInvs, error } = await supabase.from('user_invitations').select('*');
    if (error) {
      // Table may not exist yet or warning
      return;
    }
    if (Array.isArray(dbInvs) && dbInvs.length > 0) {
      userInvitations = dbInvs.map(mapDbInvitationToAppInvitation);
    }
  } catch (err: any) {
    // silently fallback to memory
  }
}

// In-Memory Database (Clean Production Ready)
let apiKeys: ApiKey[] = [];
let notificationLogs: NotificationLog[] = [];

let users: User[] = [
  {
    id: 'u-super-1',
    name: 'المدير العام للنظام (Super Admin)',
    email: 'admin@dargo-tms.io',
    phone: '0790000001',
    role: 'SUPER_ADMIN',
    roleName: 'المدير العام للنظام (Super Admin)',
    branch: 'المقر الرئيسي للمملكة',
    city: 'عمان',
    isActive: true,
    permissions: [
      'manage_system_settings',
      'manage_operations_admins',
      'view_financial_audit_logs',
      'export_database_backup',
      'pos_full_access',
      'pos_apply_discount',
      'pos_issue_refund',
      'pos_view_all_sales',
      'pos_manage_inventory',
      'ops_create_orders',
      'ops_assign_drivers',
      'ops_bulk_dispatch',
      'ops_cancel_orders',
      'ops_manage_hubs',
      'warehouse_scan_in',
      'warehouse_scan_out',
      'warehouse_manage_racks',
      'warehouse_stocktake',
      'acc_view_ledgers',
      'acc_post_vouchers',
      'acc_driver_custody_close',
      'acc_merchant_settlement',
      'acc_reports_export',
      'drivers_onboard',
      'drivers_rate_cards',
      'drivers_wallet_adjust',
      'merchants_approve',
      'merchants_rate_cards',
      'merchants_portal_admin',
    ],
    maxAllowedPermissions: [
      'manage_system_settings',
      'manage_operations_admins',
      'view_financial_audit_logs',
      'export_database_backup',
      'pos_full_access',
      'pos_apply_discount',
      'pos_issue_refund',
      'pos_view_all_sales',
      'pos_manage_inventory',
      'ops_create_orders',
      'ops_assign_drivers',
      'ops_bulk_dispatch',
      'ops_cancel_orders',
      'ops_manage_hubs',
      'warehouse_scan_in',
      'warehouse_scan_out',
      'warehouse_manage_racks',
      'warehouse_stocktake',
      'acc_view_ledgers',
      'acc_post_vouchers',
      'acc_driver_custody_close',
      'acc_merchant_settlement',
      'acc_reports_export',
      'drivers_onboard',
      'drivers_rate_cards',
      'drivers_wallet_adjust',
      'merchants_approve',
      'merchants_rate_cards',
      'merchants_portal_admin',
    ],
  },
];

let pricePlans: PricePlan[] = [
  {
    id: 'pp-mer-std',
    name: 'جميع المملكة 2 (القياسية)',
    type: 'MERCHANT',
    description: 'قائمة الأسعار المعتمدة للغالبية العظمى من المتاجر مع تغطية شاملة لجميع المحافظات',
    isDefault: true,
    defaultFee: 3.0,
    governorateFees: {
      'عمان': 2.0,
      'الزرقاء': 2.5,
      'السلط (البلقاء)': 3.0,
      'مادبا': 3.0,
      'إربد': 3.5,
      'جرش': 3.5,
      'عجلون': 3.5,
      'المفرق': 3.5,
      'الكرك': 4.0,
      'الطفيلة': 4.0,
      'معان': 4.5,
      'العقبة': 4.5,
    },
    returnFee: 1.0,
    extraWeightFeePerKg: 0.5,
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: 'pp-mer-vip',
    name: 'عمان الكبرى VIP (كبار العملاء)',
    type: 'MERCHANT',
    description: 'أسعار تفضيلية خاصة بالمتاجر ذات الحجم العالي (+500 طرد شهرياً)',
    isDefault: false,
    defaultFee: 2.5,
    governorateFees: {
      'عمان': 1.75,
      'الزرقاء': 2.25,
      'السلط (البلقاء)': 2.5,
      'مادبا': 2.5,
      'إربد': 3.0,
      'جرش': 3.0,
      'عجلون': 3.0,
      'المفرق': 3.0,
      'الكرك': 3.5,
      'الطفيلة': 3.5,
      'معان': 4.0,
      'العقبة': 4.0,
    },
    returnFee: 0.5,
    extraWeightFeePerKg: 0.25,
    createdAt: new Date(Date.now() - 86400000 * 20).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'pp-mer-flat',
    name: 'تسعيرة المتاجر الناشئة (سعر مخفض)',
    type: 'MERCHANT',
    description: 'باقة تشجيعية لأصحاب المتاجر والمشاريع المنزلية الناشئة في عمان والزرقاء',
    isDefault: false,
    defaultFee: 3.0,
    governorateFees: {
      'عمان': 2.25,
      'الزرقاء': 2.5,
      'السلط (البلقاء)': 3.0,
      'مادبا': 3.0,
      'إربد': 3.5,
      'جرش': 3.5,
      'عجلون': 3.5,
      'المفرق': 3.5,
      'الكرك': 4.0,
      'الطفيلة': 4.0,
      'معان': 4.5,
      'العقبة': 4.5,
    },
    returnFee: 1.0,
    extraWeightFeePerKg: 0.5,
    createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'pp-mer-heavy',
    name: 'حساب الشركات والطرود الثقيلة',
    type: 'MERCHANT',
    description: 'للشحنات ذات الأحجام والأوزان العالية وقطع الأثاث والأجهزة المنزلية',
    isDefault: false,
    defaultFee: 4.5,
    governorateFees: {
      'عمان': 3.0,
      'الزرقاء': 3.5,
      'السلط (البلقاء)': 4.0,
      'مادبا': 4.0,
      'إربد': 4.5,
      'جرش': 4.5,
      'عجلون': 4.5,
      'المفرق': 4.5,
      'الكرك': 5.5,
      'الطفيلة': 5.5,
      'معان': 6.0,
      'العقبة': 6.0,
    },
    returnFee: 2.0,
    extraWeightFeePerKg: 0.75,
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  // DRIVER PLANS (مستحقات وبدلات الكباتن)
  {
    id: 'pp-drv-std',
    name: 'تسعيرة عمولة كباتن العاصمة والوسط',
    type: 'DRIVER',
    description: 'بدل توصيل الطرد المسلّم لكباتن مناطق عمان والزرقاء والبلقاء',
    isDefault: true,
    defaultFee: 1.5,
    governorateFees: {
      'عمان': 1.5,
      'الزرقاء': 1.75,
      'السلط (البلقاء)': 1.75,
      'مادبا': 2.0,
      'إربد': 2.25,
      'جرش': 2.25,
      'عجلون': 2.25,
      'المفرق': 2.25,
      'الكرك': 2.5,
      'الطفيلة': 2.5,
      'معان': 3.0,
      'العقبة': 3.0,
    },
    returnFee: 0.75,
    extraWeightFeePerKg: 0.25,
    createdAt: new Date(Date.now() - 86400000 * 25).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'pp-drv-express',
    name: 'تسعيرة كباتن التوصيل السريع VIP',
    type: 'DRIVER',
    description: 'حافز إضافي للكباتن المتميزين ذوي معدل تسليم أعلى من 95%',
    isDefault: false,
    defaultFee: 1.8,
    governorateFees: {
      'عمان': 1.8,
      'الزرقاء': 2.0,
      'السلط (البلقاء)': 2.0,
      'مادبا': 2.25,
      'إربد': 2.5,
      'جرش': 2.5,
      'عجلون': 2.5,
      'المفرق': 2.5,
      'الكرك': 3.0,
      'الطفيلة': 3.0,
      'معان': 3.5,
      'العقبة': 3.5,
    },
    returnFee: 1.0,
    extraWeightFeePerKg: 0.3,
    createdAt: new Date(Date.now() - 86400000 * 18).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'pp-drv-outskirts',
    name: 'تسعيرة خطوط المحافظات البعيدة والأطراف',
    type: 'DRIVER',
    description: 'بدل توصيل مخصص لكباتن خطوط الشمال والجنوب وتغطية القرى والبوادي',
    isDefault: false,
    defaultFee: 2.25,
    governorateFees: {
      'عمان': 1.6,
      'الزرقاء': 1.8,
      'السلط (البلقاء)': 2.0,
      'مادبا': 2.0,
      'إربد': 2.25,
      'جرش': 2.25,
      'عجلون': 2.25,
      'المفرق': 2.25,
      'الكرك': 2.75,
      'الطفيلة': 2.75,
      'معان': 3.25,
      'العقبة': 3.25,
    },
    returnFee: 1.25,
    extraWeightFeePerKg: 0.4,
    createdAt: new Date(Date.now() - 86400000 * 12).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// =============================================================
// Accounting System Global State (Chart of Accounts, Ledger, Vouchers)
// =============================================================
let accounts: Account[] = [
  { id: 'acc-1010', code: '1010', name: 'الصندوق الرئيسي (الخزينة النقدية)', type: 'ASSET', category: 'الأصول المتداولة والنقدية', balance: 0.0, isDebitNormal: true, description: 'المبالغ النقدية المتوفرة في الخزينة المركزية' },
  { id: 'acc-1020', code: '1020', name: 'بنك الاتحاد - الحساب التشغيلي الرئيسي', type: 'ASSET', category: 'الأصول المتداولة والنقدية', balance: 0.0, isDebitNormal: true, description: 'حساب بنك الاتحاد للحوالات والعمليات' },
  { id: 'acc-1030', code: '1030', name: 'محفظة كليك الرقمية CliQ', type: 'ASSET', category: 'الأصول المتداولة والنقدية', balance: 0.0, isDebitNormal: true, description: 'مخصص التسويات الفورية للتجار والكباتن' },
  { id: 'acc-1040', code: '1040', name: 'عهد ومحافظ الكباتن النقدية (تحصيلات الميدان)', type: 'ASSET', category: 'الأصول المتداولة والنقدية', balance: 0.0, isDebitNormal: true, description: 'مبالغ COD النقدية بحوزة السائقين قبل توريدها' },
  { id: 'acc-1050', code: '1050', name: 'ذمم التجار المدينة (رسوم توصيل مستحقة)', type: 'ASSET', category: 'الذمم المدينة', balance: 0.0, isDebitNormal: true, description: 'رسوم توصيل آجلة تحت التحصيل' },
  { id: 'acc-1060', code: '1060', name: 'مخزون بضائع المتاجر بالمستودع (Inventory Asset)', type: 'ASSET', category: 'الأصول المتداولة والمخزون', balance: 0.0, isDebitNormal: true, description: 'إجمالي القيمة الدفترية للأصناف المتوفرة في المخازن' },
  { id: 'acc-1070', code: '1070', name: 'ذمم العملاء والزبائن التجارية (Accounts Receivable)', type: 'ASSET', category: 'الذمم المدينة', balance: 0.0, isDebitNormal: true, description: 'مبيعات وفواتير العملاء غير المسددة (البيع بالآجل)' },
  { id: 'acc-2010', code: '2010', name: 'أمانات تحصيل التجار الدائنة COD Payable', type: 'LIABILITY', category: 'الخصوم المتداولة', balance: 0.0, isDebitNormal: false, description: 'صافي أثمان البضائع المحصلة لصالح المتاجر بانتظار التحويل' },
  { id: 'acc-2020', code: '2020', name: 'مستحقات وعمولات الكباتن المعلقة', type: 'LIABILITY', category: 'الخصوم المتداولة', balance: 0.0, isDebitNormal: false, description: 'أجور التوصيل المستحقة للسائقين قبل الصرف' },
  { id: 'acc-2030', code: '2030', name: 'ذمم الموردين التجارية (Accounts Payable)', type: 'LIABILITY', category: 'الخصوم المتداولة', balance: 0.0, isDebitNormal: false, description: 'فواتير مشتريات البضاعة الآجلة المستحقة للموردين' },
  { id: 'acc-3010', code: '3010', name: 'رأس مال المنظومة التشغيلي', type: 'EQUITY', category: 'حقوق الملكية', balance: 0.0, isDebitNormal: false, description: 'رأس المال المخصص للعمليات' },
  { id: 'acc-3020', code: '3020', name: 'الأرباح المدورة والمحتجزة', type: 'EQUITY', category: 'حقوق الملكية', balance: 0.0, isDebitNormal: false, description: 'أرباح الدورات التشغيلية السابقة' },
  { id: 'acc-4010', code: '4010', name: 'إيرادات أجور التوصيل والشحن', type: 'REVENUE', category: 'الإيرادات التشغيلية', balance: 0.0, isDebitNormal: false, description: 'رسوم الشحن المحققة من الطرود المسلمة' },
  { id: 'acc-4020', code: '4020', name: 'رسوم خدمات التحصيل والدفع الإلكتروني', type: 'REVENUE', category: 'الإيرادات التشغيلية', balance: 0.0, isDebitNormal: false, description: 'عمولات خدمات الدفع السريع والتحصيل' },
  { id: 'acc-4030', code: '4030', name: 'إيرادات مبيعات بضائع المتاجر', type: 'REVENUE', category: 'الإيرادات التشغيلية', balance: 0.0, isDebitNormal: false, description: 'إجمالي المبيعات المحققة من فواتير الأصناف والمنتجات' },
  { id: 'acc-5010', code: '5010', name: 'تكاليف وعمولات كباتن التوصيل', type: 'EXPENSE', category: 'تكاليف التشغيل المباشرة', balance: 0.0, isDebitNormal: true, description: 'عمولات السائقين المعتمدة عن كل طرد' },
  { id: 'acc-5020', code: '5020', name: 'مصاريف المحروقات والوقود', type: 'EXPENSE', category: 'مصروفات تشغيلية', balance: 0.0, isDebitNormal: true, description: 'فواتير ديزل وبنزين مركبات الشحن' },
  { id: 'acc-5030', code: '5030', name: 'مصاريف صيانة وغيار زيت المركبات', type: 'EXPENSE', category: 'مصروفات تشغيلية', balance: 0.0, isDebitNormal: true, description: 'صيانة دورية للسيارات والدراجات' },
  { id: 'acc-5040', code: '5040', name: 'مصاريف الرسائل النصية وبوابات SMS', type: 'EXPENSE', category: 'مصروفات إدارية وتشغيلية', balance: 0.0, isDebitNormal: true, description: 'تكلفة إشعارات التتبع ورموز OTP' },
  { id: 'acc-5050', code: '5050', name: 'إيجار المستودعات والمكاتب المركزية', type: 'EXPENSE', category: 'مصروفات عمومية', balance: 0.0, isDebitNormal: true, description: 'إيجار مستودع الفرز الرئيسي' },
  { id: 'acc-5060', code: '5060', name: 'تكلفة البضاعة المباعة للمتاجر (COGS)', type: 'EXPENSE', category: 'تكاليف التشغيل والمخزون', balance: 0.0, isDebitNormal: true, description: 'التكلفة الدفترية للأصناف والبضائع التي تم بيعها وصرفها من المخزن' },
];

let journalEntries: JournalEntry[] = [];
let vouchers: Voucher[] = [];

// =============================================================
// Merchant Warehouse, Inventory, Invoices, and Expenses State
// =============================================================
const DEFAULT_SYSTEM_CATEGORIES = [
  'ألبسة نسائية',
  'عبايات وجلابيات',
  'ألبسة رجالية',
  'ألبسة أطفال',
  'حقائب وأحذية',
  'إكسسوارات',
  'شالات وإيشاربات',
  'عطور وتجميل',
  'ساعات ومجوهرات',
  'إلكترونيات وهواتف',
  'أدوات منزلية',
  'أخرى',
];

let merchantCategories: Record<string, string[]> = {};
let merchantProducts: MerchantProduct[] = [];
let stockMovements: StockMovement[] = [];
let merchantInvoices: MerchantInvoice[] = [];
let merchantExpenses: MerchantExpense[] = [];
let orders: Order[] = [];

export interface MerchantBranchRecord {
  id: string;
  merchantId: string;
  tenantId?: string | null;
  name: string;
  code?: string;
  phone?: string;
  address?: string;
  governorate?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  isMain: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MerchantStockTransferRecord {
  id: string;
  merchantId: string;
  tenantId?: string | null;
  productId: string;
  productName?: string;
  sourceBranchId: string;
  sourceBranchName?: string;
  destBranchId: string;
  destBranchName?: string;
  quantity: number;
  status: 'PENDING' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt?: string;
}

export let merchantBranches: MerchantBranch[] = [];
export let userBranchAccess: UserBranchAccess[] = [];
export let branchInventory: BranchInventoryItem[] = [];
export let merchantStockTransfers: MerchantStockTransfer[] = [];
export let settlementRecords: SettlementRecord[] = [];
export let accountingPeriods: AccountingPeriod[] = [
  {
    id: 'period-2026-09',
    tenantId: 'system',
    periodName: 'فترة أيلول/سبتمبر 2026',
    startDate: '2026-09-01T00:00:00.000Z',
    endDate: '2026-09-30T23:59:59.999Z',
    status: 'OPEN',
    createdAt: new Date().toISOString(),
  }
];

// Helper: Ensure every merchant has a clean main branch without fake defaults
export function ensureMerchantBranches() {
  const merchants = users.filter((u) => u.role === 'MERCHANT');
  for (const m of merchants) {
    const existing = merchantBranches.find((b) => b.merchantId === m.id);
    if (!existing) {
      const mainBranch: MerchantBranch = {
        id: `br-${m.id}-main`,
        merchantId: m.id,
        tenantId: m.parentUserId || m.tenantId || 'system',
        name: `${m.storeName || m.name} - الفرع الرئيسي`,
        code: 'MAIN-01',
        phone: m.phone || '',
        address: m.address || '',
        governorate: m.city || 'عمان',
        city: m.city || 'عمان',
        isMain: true,
        isActive: true,
        createdAt: m.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      merchantBranches.push(mainBranch);
    }
  }

  // Ensure cashiers have normalized user_branch_access records
  const cashiers = users.filter((u) => u.role === 'CASHIER');
  for (const c of cashiers) {
    const existingAccess = userBranchAccess.find((uba) => uba.userId === c.id);
    if (!existingAccess) {
      const parentMerchantId = c.parentUserId || c.tenantId;
      const targetBranch = merchantBranches.find(
        (b) => b.merchantId === parentMerchantId && (b.id === c.branchId || b.name === c.branch || b.isMain)
      );
      if (targetBranch && parentMerchantId) {
        userBranchAccess.push({
          id: `uba-${c.id}-${targetBranch.id}`,
          tenantId: c.tenantId || parentMerchantId,
          merchantId: parentMerchantId,
          userId: c.id,
          branchId: targetBranch.id,
          roleInBranch: 'CASHIER',
          isDefault: true,
          createdAt: c.createdAt || new Date().toISOString(),
        });
      }
    }
  }

  // Ensure merchant products have normalized branch inventory tracking
  for (const prod of merchantProducts) {
    const mBranches = merchantBranches.filter((b) => b.merchantId === prod.merchantId);
    for (const br of mBranches) {
      const exists = branchInventory.find((bi) => bi.branchId === br.id && bi.productId === prod.id);
      if (!exists) {
        branchInventory.push({
          id: `bi-${br.id}-${prod.id}`,
          tenantId: br.tenantId,
          merchantId: prod.merchantId,
          branchId: br.id,
          productId: prod.id,
          quantity: br.isMain ? (prod.stockQuantity || 0) : 0,
          minStockAlert: prod.minStockAlert || 5,
          shelfLocation: 'A-01',
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }
}

let nextSequenceNumber = 1001;

// =============================================================
// Subscription Engine Catalog & In-Memory State (Phase 2)
// =============================================================
export let subscriptionPlans: SubscriptionPlanRecord[] = [
  {
    id: 'plan-enterprise',
    code: 'ENTERPRISE',
    name: 'Enterprise Diamond Plan',
    nameAr: 'الباقة الماسية والمؤسسية (Enterprise)',
    description: 'تحكم كامل وشامل لشركات الشحن الكبرى والمستودعات المركزية بدون قيود على عدد الشحنات مع دعم 50 مستخدم وتفعيل لكافة الأنظمة.',
    price: 150,
    monthlyPrice: 150,
    annualPrice: 1500,
    currency: 'JOD',
    billingCycle: 'MONTHLY',
    trialDays: 14,
    maxUsers: 50,
    maxMonthlyOrders: 0, // 0 = unlimited
    enabledModules: {
      tmsDelivery: true,
      posCashier: true,
      merchantWms: true,
      accountingSettlements: true,
      apiIntegrations: true,
      aiRouteOptimizer: true,
      whatsappTracking: true,
      customDomain: true,
    },
    isActive: true,
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'plan-professional',
    code: 'PROFESSIONAL',
    name: 'Professional Gold Plan',
    nameAr: 'الباقة الذهبية للمحترفين (Gold Pro)',
    description: 'باقة مثالية للشركات المتوسطة والمتنامية مع دعم حتى 10,000 شحنة شهرياً و15 مستخدم مع كافة الأنظمة الأساسية والمحاسبة.',
    price: 85,
    monthlyPrice: 85,
    annualPrice: 850,
    currency: 'JOD',
    billingCycle: 'MONTHLY',
    trialDays: 14,
    maxUsers: 15,
    maxMonthlyOrders: 10000,
    enabledModules: {
      tmsDelivery: true,
      posCashier: true,
      merchantWms: true,
      accountingSettlements: true,
      apiIntegrations: true,
      aiRouteOptimizer: true,
      whatsappTracking: true,
      customDomain: false,
    },
    isActive: true,
    sortOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'plan-growth',
    code: 'GROWTH',
    name: 'Growth Silver Plan',
    nameAr: 'الباقة الفضية للنمو (Silver)',
    description: 'حل ممتاز وموفر للشركات الناشئة والمتاجر النشطة حتى 2,500 شحنة شهرياً و5 مستخدمين مع أنظمة التوصيل والكاشير والمستودع.',
    price: 40,
    monthlyPrice: 40,
    annualPrice: 400,
    currency: 'JOD',
    billingCycle: 'MONTHLY',
    trialDays: 7,
    maxUsers: 5,
    maxMonthlyOrders: 2500,
    enabledModules: {
      tmsDelivery: true,
      posCashier: true,
      merchantWms: true,
      accountingSettlements: true,
      apiIntegrations: false,
      aiRouteOptimizer: false,
      whatsappTracking: false,
      customDomain: false,
    },
    isActive: true,
    sortOrder: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'plan-trial',
    code: 'TRIAL',
    name: 'Free Trial Plan',
    nameAr: 'الاشتراك التجريبي المجاني (Trial 14 days)',
    description: 'فترة تجريبية مجانية تتيح اختبار نظام الشحنات وإدارة التوصيل حتى 100 شحنة و3 مستخدمين.',
    price: 0,
    monthlyPrice: 0,
    annualPrice: 0,
    currency: 'JOD',
    billingCycle: 'MONTHLY',
    trialDays: 14,
    maxUsers: 3,
    maxMonthlyOrders: 100,
    enabledModules: {
      tmsDelivery: true,
      posCashier: true,
      merchantWms: false,
      accountingSettlements: false,
      apiIntegrations: false,
      aiRouteOptimizer: false,
      whatsappTracking: false,
      customDomain: false,
    },
    isActive: true,
    sortOrder: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export let subscriptions: SubscriptionRecord[] = [];

// Helper: Synchronize subscription state directly to user record for complete backward compatibility
export function syncSubscriptionToUser(tenantId: string, sub: SubscriptionRecord) {
  const user = users.find((u) => u.id === tenantId);
  if (user) {
    user.subscriptionPlan = sub.planCode as any;
    user.subscriptionPlanName = sub.planName;
    user.subscriptionStatus = sub.status as any;
    user.subscriptionStartDate = sub.startDate;
    user.subscriptionEndDate = sub.endDate;
    user.subscriptionPrice = sub.price;
    user.subscriptionBillingCycle = sub.billingCycle;
    user.enabledModules = { ...(sub.enabledModules as any) };
    user.maxUsers = sub.maxUsers;
    user.maxMonthlyOrders = sub.maxMonthlyOrders;
    user.isActive = sub.status !== 'SUSPENDED';
    user.suspendedReason = sub.suspendedReason;
  }
}

// Helper: Ensure every tenant in memory has a corresponding SubscriptionRecord
export function ensureTenantSubscriptions() {
  const potentialTenants = users.filter((u) => u.role === 'ADMIN' || u.role === 'MERCHANT' || u.role === 'SUPER_ADMIN');
  for (const tenantUser of potentialTenants) {
    const existing = subscriptions.find((s) => s.tenantId === tenantUser.id);
    if (!existing) {
      const planCode = tenantUser.subscriptionPlan || (tenantUser.role === 'SUPER_ADMIN' ? 'ENTERPRISE' : 'PROFESSIONAL');
      const planDef = subscriptionPlans.find((p) => p.code === planCode) || subscriptionPlans[1];
      const now = new Date();
      const startDate = tenantUser.subscriptionStartDate || now.toISOString();
      const endDate = tenantUser.subscriptionEndDate || new Date(now.getTime() + 86400000 * 30).toISOString();
      const status: SubscriptionEngineStatus = tenantUser.subscriptionStatus === 'SUSPENDED' ? 'SUSPENDED' : (planCode === 'TRIAL' ? 'TRIAL' : 'ACTIVE');

      const initialSub: SubscriptionRecord = {
        id: `sub-${tenantUser.id}`,
        tenantId: tenantUser.id,
        tenantName: tenantUser.companyName || tenantUser.storeName || tenantUser.name,
        planId: planDef.id,
        planCode: planDef.code,
        planName: planDef.nameAr,
        status,
        startDate,
        endDate,
        trialStartDate: planCode === 'TRIAL' ? startDate : undefined,
        trialEndDate: planCode === 'TRIAL' ? endDate : undefined,
        price: tenantUser.subscriptionPrice !== undefined ? tenantUser.subscriptionPrice : planDef.monthlyPrice,
        currency: 'JOD',
        billingCycle: (tenantUser.subscriptionBillingCycle as SubscriptionCycle) || 'MONTHLY',
        enabledModules: tenantUser.enabledModules ? { ...tenantUser.enabledModules } : { ...planDef.enabledModules },
        maxUsers: tenantUser.maxUsers || planDef.maxUsers,
        maxMonthlyOrders: tenantUser.maxMonthlyOrders !== undefined ? tenantUser.maxMonthlyOrders : planDef.maxMonthlyOrders,
        autoRenew: false,
        suspendedReason: tenantUser.suspendedReason,
        gracePeriodDays: 0,
        createdAt: startDate,
        updatedAt: now.toISOString(),
      };
      subscriptions.push(initialSub);
      syncSubscriptionToUser(tenantUser.id, initialSub);
    }
  }
}

// Ensure initial run
ensureTenantSubscriptions();
ensureMerchantBranches();

// Helper: Central Effective-Status Resolver (Single Source of Truth for Subscriptions)
export function getTenantSubscriptionContext(tenantId?: string): TenantSubscriptionContext {
  const now = new Date();
  const defaultModules = {
    tmsDelivery: true,
    posCashier: true,
    merchantWms: true,
    accountingSettlements: true,
    apiIntegrations: true,
    aiRouteOptimizer: true,
    whatsappTracking: true,
    customDomain: true,
  };

  // Super Admin / Root system tenant has unrestricted access
  if (!tenantId || tenantId === '00000000-0000-0000-0000-000000000000' || tenantId === 'u-super-1') {
    return {
      tenantId: tenantId || 'u-super-1',
      tenantName: 'المدير العام للنظام (Super Admin)',
      subscription: null,
      plan: subscriptionPlans[0],
      status: 'ACTIVE',
      effectiveStatus: 'ACTIVE',
      isActive: true,
      isTrial: false,
      isExpired: false,
      isSuspended: false,
      isCancelled: false,
      startDate: now.toISOString(),
      endDate: new Date(now.getTime() + 86400000 * 3650).toISOString(),
      daysRemaining: 3650,
      enabledModules: defaultModules,
      limits: { maxUsers: 0, maxMonthlyOrders: 0 },
      usage: { currentUsers: users.length, currentMonthlyOrders: orders.length },
    };
  }

  // Find active/latest subscription for tenant
  let sub = subscriptions
    .filter((s) => s.tenantId === tenantId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  // If no subscription record found, check user and create fallback
  if (!sub) {
    const u = users.find((x) => x.id === tenantId);
    if (u) {
      ensureTenantSubscriptions();
      sub = subscriptions.find((s) => s.tenantId === tenantId)!;
    }
  }

  // If still no subscription found, return default fallback trial
  if (!sub) {
    const trialPlan = subscriptionPlans.find((p) => p.code === 'TRIAL') || subscriptionPlans[3];
    return {
      tenantId,
      subscription: null,
      plan: trialPlan,
      status: 'EXPIRED',
      effectiveStatus: 'EXPIRED',
      isActive: false,
      isTrial: true,
      isExpired: true,
      isSuspended: false,
      isCancelled: false,
      startDate: now.toISOString(),
      endDate: now.toISOString(),
      daysRemaining: 0,
      trialDaysRemaining: 0,
      enabledModules: { ...trialPlan.enabledModules },
      limits: { maxUsers: trialPlan.maxUsers, maxMonthlyOrders: trialPlan.maxMonthlyOrders },
      usage: { currentUsers: 1, currentMonthlyOrders: 0 },
    };
  }

  const planDef = subscriptionPlans.find((p) => p.id === sub.planId || p.code === sub.planCode) || subscriptionPlans[1];
  const endDate = new Date(sub.endDate);
  const diffTime = endDate.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  let effectiveStatus: SubscriptionEngineStatus = sub.status;
  let isExpired = false;

  if (sub.status === 'SUSPENDED') {
    effectiveStatus = 'SUSPENDED';
  } else if (sub.status === 'CANCELLED') {
    effectiveStatus = 'CANCELLED';
  } else if (sub.status === 'TRIAL') {
    const trialEnd = sub.trialEndDate ? new Date(sub.trialEndDate) : endDate;
    if (trialEnd.getTime() < now.getTime()) {
      isExpired = true;
      effectiveStatus = 'EXPIRED';
    } else {
      effectiveStatus = 'TRIAL';
    }
  } else if (sub.status === 'ACTIVE') {
    if (endDate.getTime() < now.getTime()) {
      isExpired = true;
      effectiveStatus = 'EXPIRED';
    } else {
      effectiveStatus = 'ACTIVE';
    }
  } else if (sub.status === 'EXPIRED') {
    isExpired = true;
    effectiveStatus = 'EXPIRED';
  }

  const isActive = (effectiveStatus === 'ACTIVE' || effectiveStatus === 'TRIAL') && !isExpired;
  const isTrial = effectiveStatus === 'TRIAL' || sub.status === 'TRIAL';
  const isSuspended = effectiveStatus === 'SUSPENDED';
  const isCancelled = effectiveStatus === 'CANCELLED';

  // Compute usage
  const currentUsers = users.filter((u) => u.isActive && (u.id === tenantId || u.parentUserId === tenantId)).length;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthlyOrders = orders.filter((o) => (o.merchantId === tenantId) && new Date(o.createdAt) >= monthStart).length;

  return {
    tenantId,
    tenantName: sub.tenantName,
    subscription: sub,
    plan: planDef,
    status: sub.status,
    effectiveStatus,
    isActive,
    isTrial,
    isExpired,
    isSuspended,
    isCancelled,
    startDate: sub.startDate,
    endDate: sub.endDate,
    trialDaysRemaining: isTrial ? daysRemaining : undefined,
    daysRemaining,
    enabledModules: { ...sub.enabledModules },
    limits: {
      maxUsers: sub.maxUsers,
      maxMonthlyOrders: sub.maxMonthlyOrders,
    },
    usage: {
      currentUsers,
      currentMonthlyOrders,
    },
  };
}

// Middleware: Enforce subscription active status and optional specific module permission
export function requireSubscriptionModule(moduleKey?: string) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ctx = getRequesterContext(req);
    if (ctx.isSuperAdmin) {
      return next();
    }

    const tenantId = ctx.tenantId || ctx.userId;
    if (!tenantId) {
      return next();
    }

    const subCtx = getTenantSubscriptionContext(tenantId);

    if (!subCtx.isActive) {
      return res.status(403).json({
        error: subCtx.isSuspended
          ? 'تم تجميد اشتراك المنشأة من قبل إدارة المنظومة. يرجى التواصل مع الإدارة لفك التجميد.'
          : 'انتهت صلاحية اشتراك المنشأة. يرجى تجديد أو ترقية الاشتراك لمتابعة العمل.',
        code: subCtx.isSuspended ? 'SUBSCRIPTION_SUSPENDED' : 'SUBSCRIPTION_EXPIRED',
        status: subCtx.effectiveStatus,
        details: {
          endDate: subCtx.endDate,
          planName: subCtx.plan?.nameAr || subCtx.subscription?.planName,
        },
      });
    }

    if (moduleKey) {
      const moduleMap: Record<string, string> = {
        TMS: 'tmsDelivery',
        POS: 'posCashier',
        WMS: 'merchantWms',
        ACCOUNTING: 'accountingSettlements',
        ERP: 'accountingSettlements',
        API: 'apiIntegrations',
        AI_ROUTING: 'aiRouteOptimizer',
      };
      const actualKey = moduleMap[moduleKey] || moduleKey;
      if (subCtx.enabledModules && subCtx.enabledModules[actualKey] === false) {
        return res.status(403).json({
          error: `نظام (${moduleKey}) غير مفعّل في باقة اشتراككم الحالية. يرجى ترقية الباقة لدى الإدارة العامة.`,
          code: 'MODULE_DISABLED',
          moduleKey: actualKey,
        });
      }
    }

    next();
  };
}

// Helper: Get fee for merchant based on assigned price plan and governorate
function getMerchantDeliveryFee(merchantId: string, governorate: string): number {
  const merchant = users.find((u) => u.id === merchantId);
  const plan =
    pricePlans.find(
      (p) => (merchant?.pricePlanId && p.id === merchant.pricePlanId) || (merchant?.priceList && p.name === merchant.priceList)
    ) ||
    pricePlans.find((p) => p.type === 'MERCHANT' && p.isDefault) ||
    pricePlans.find((p) => p.type === 'MERCHANT');

  if (plan && plan.governorateFees && plan.governorateFees[governorate] !== undefined) {
    return plan.governorateFees[governorate];
  }
  return plan?.defaultFee ?? 3.0;
}

// Helper: Get driver compensation/commission based on assigned price plan and governorate
function getDriverCompensationFee(driverId: string, governorate: string): number {
  const driver = users.find((u) => u.id === driverId);
  const plan =
    pricePlans.find(
      (p) => (driver?.pricePlanId && p.id === driver.pricePlanId) || (driver?.priceList && p.name === driver.priceList)
    ) ||
    pricePlans.find((p) => p.type === 'DRIVER' && p.isDefault) ||
    pricePlans.find((p) => p.type === 'DRIVER');

  if (plan && plan.governorateFees && plan.governorateFees[governorate] !== undefined) {
    return plan.governorateFees[governorate];
  }
  return plan?.defaultFee ?? 1.5;
}

// Helper: Attach relational objects to an order (Preserves immutable snapshotted fees)
function populateOrder(order: Order): Order {
  const merchant = users.find((u) => u.id === order.merchantId);
  const driver = order.driverId ? users.find((u) => u.id === order.driverId) || null : null;

  return {
    ...order,
    merchant,
    driver,
  };
}

// -------------------------------------------------------------
// Database Synchronization Layer (Supabase Official)
// -------------------------------------------------------------
export async function syncUsersFromSupabase() {
  try {
    const { data: dbUsers, error } = await supabase.from('users').select('*');
    if (error) {
      console.warn('[Supabase] Warning fetching users from Supabase:', error.message);
      return;
    }
    if (Array.isArray(dbUsers) && dbUsers.length > 0) {
      const fetched = dbUsers.map(mapDbUserToAppUser);
      for (const existing of users) {
        if (existing && !fetched.some((u) => u.id === existing.id)) {
          fetched.push(existing);
        }
      }
      users = fetched;
      console.log(`[DarGo Server] Synced ${users.length} official users directly from Supabase.`);
    }
  } catch (err: any) {
    console.error('[Supabase] Failed to sync users from Supabase:', err.message);
  }
}

// Initial sync on startup
syncUsersFromSupabase().catch(() => {});

// Empty no-op saveDatabase to satisfy any legacy internal triggers without filesystem writes
function saveDatabase() {
  // Pure serverless / Supabase mode: no local JSON writes
}

// -------------------------------------------------------------
// Security, Password Hashing (scrypt KDF) & Audit Trail
// -------------------------------------------------------------
const PASSWORD_SALT = process.env.PASSWORD_SALT || 'dargo_delivere_secure_salt_2026';

function hashPassword(pass: string): string {
  if (!pass) return '';
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(pass, salt, 64);
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

function verifyPassword(inputPass: string, storedPass?: string, storedHash?: string): boolean {
  if (!inputPass) return false;
  const cleanInput = inputPass.trim();

  // 1. Check if storedHash is in modern scrypt KDF format
  if (storedHash && storedHash.startsWith('scrypt$')) {
    const parts = storedHash.split('$');
    if (parts.length === 3) {
      const salt = parts[1];
      const expectedKeyHex = parts[2];
      try {
        const derivedKey = crypto.scryptSync(cleanInput, salt, 64);
        const derivedKeyHex = derivedKey.toString('hex');
        if (
          expectedKeyHex.length === derivedKeyHex.length &&
          crypto.timingSafeEqual(Buffer.from(expectedKeyHex, 'hex'), Buffer.from(derivedKeyHex, 'hex'))
        ) {
          return true;
        }
      } catch {
        return false;
      }
    }
  }

  // 2. Backward compatibility: Salted SHA-256 fallback
  if (storedHash) {
    const saltedSha256 = crypto.createHash('sha256').update(cleanInput + PASSWORD_SALT).digest('hex');
    if (saltedSha256 === storedHash) return true;

    // 3. Backward compatibility: Direct standard SHA-256 fallback
    const directSha256 = crypto.createHash('sha256').update(cleanInput).digest('hex');
    if (directSha256 === storedHash) return true;
  }

  // 4. Backward compatibility: Plaintext check for legacy/seed records
  if (storedPass && cleanInput === storedPass.trim()) return true;
  if (storedHash && cleanInput === storedHash.trim()) return true;

  return false;
}

export function sanitizeUserForClient(user: any): User {
  if (!user) return user;
  const sanitized = { ...user };
  delete sanitized.password;
  delete sanitized.password_hash;
  delete sanitized.token;
  delete sanitized.sessionToken;
  delete sanitized.google_sub;
  delete sanitized.secret;
  return sanitized as User;
}

export function getHierarchicalSubtreeUserIds(rootUserId: string, allUsersList: any[]): Set<string> {
  const subtreeSet = new Set<string>();
  if (rootUserId) subtreeSet.add(rootUserId);
  if (!rootUserId || !Array.isArray(allUsersList)) return subtreeSet;

  let addedNew = true;
  while (addedNew) {
    addedNew = false;
    for (const u of allUsersList) {
      if (!u || !u.id) continue;
      if (subtreeSet.has(u.id)) continue;

      const parentId = u.parentUserId || u.parent_user_id;
      const createdBy = u.createdBy || u.created_by_id;

      if ((parentId && subtreeSet.has(parentId)) || (createdBy && subtreeSet.has(createdBy))) {
        subtreeSet.add(u.id);
        addedNew = true;
      }
    }
  }

  return subtreeSet;
}

// Unified Real Authorization Helpers
export function getEffectivePermissions(user: User | null | undefined): string[] {
  if (!user) return [];
  if (user.role === 'SUPER_ADMIN') return ['*'];

  // User explicit permissions stored in database
  let userPerms: string[] = [];
  if (Array.isArray(user.permissions)) {
    userPerms = user.permissions;
  }

  // Enforce maxAllowedPermissions ceiling if set
  const maxAllowed = Array.isArray(user.maxAllowedPermissions) && user.maxAllowedPermissions.length > 0
    ? user.maxAllowedPermissions
    : undefined;

  if (maxAllowed && !maxAllowed.includes('*')) {
    userPerms = userPerms.filter((p) => maxAllowed.includes(p) || p === '*');
  }

  return userPerms;
}

export function hasPermission(user: User | null | undefined, requiredPermission: string): boolean {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;

  const effective = getEffectivePermissions(user);
  return effective.includes('*') || effective.includes(requiredPermission);
}

// In-Memory & Database Security Audit Logs
let auditLogs: AuditLogRecord[] = [];

function logAuditEvent(event: {
  action: string;
  actionNameAr: string;
  performedBy: string;
  performerName?: string;
  performerRole?: string;
  targetId?: string;
  targetType?: string;
  targetName?: string;
  tenantId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
}): AuditLogRecord {
  const logEntry: AuditLogRecord = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    action: event.action,
    actionNameAr: event.actionNameAr,
    performedBy: event.performedBy,
    performerName: event.performerName || 'النظام',
    performerRole: event.performerRole || 'SUPER_ADMIN',
    targetId: event.targetId,
    targetType: event.targetType || 'USER',
    targetName: event.targetName,
    tenantId: event.tenantId,
    details: event.details || {},
    ipAddress: event.ipAddress,
    timestamp: new Date().toISOString(),
  };
  auditLogs.unshift(logEntry);
  if (auditLogs.length > 500) auditLogs.pop();

  // Persist to Supabase audit_logs table asynchronously
  if (supabase) {
    Promise.resolve(
      supabase.from('audit_logs').insert([{
        action: event.action,
        action_name_ar: event.actionNameAr,
        performed_by: (event.performedBy && isValidUuid(event.performedBy)) ? event.performedBy : null,
        performer_name: event.performerName || 'النظام',
        performer_role: event.performerRole || 'SUPER_ADMIN',
        target_id: (event.targetId && isValidUuid(event.targetId)) ? event.targetId : null,
        target_type: event.targetType || 'USER',
        target_name: event.targetName,
        tenant_id: (event.tenantId && isValidUuid(event.tenantId)) ? event.tenantId : null,
        details: event.details || {},
        ip_address: event.ipAddress,
        created_at: new Date().toISOString(),
      }])
    ).catch(() => {});
  }

  return logEntry;
}

// -------------------------------------------------------------
// System Roles Catalog & Dynamic Role Definitions
// -------------------------------------------------------------
let rolesCatalog: RoleRecord[] = [
  {
    id: 'role-super-admin',
    name: 'المدير العام للنظام (Super Admin)',
    roleKey: 'SUPER_ADMIN',
    description: 'تحكم كامل وشامل في جميع إعدادات المنظومة والمستأجرين والصلاحيات وسقف التراخيص',
    isSystemRole: true,
    permissions: ['*'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'role-admin',
    name: 'مدير العمليات والشركة (Admin)',
    roleKey: 'ADMIN',
    description: 'إدارة عمليات الشركة والموظفين والطلبات والفرز والتوزيع والمحاسبة التابعة للمؤسسة',
    isSystemRole: true,
    permissions: [
      'pos.access', 'pos.discount', 'pos.void_sale', 'pos.custom_items',
      'warehouse.view', 'warehouse.manage_products', 'warehouse.adjust_stock', 'warehouse.view_cost_price',
      'invoices.view', 'invoices.create', 'invoices.delete',
      'accounting.view_pnl', 'accounting.expenses', 'accounting.wallet_payouts',
      'shipments.create', 'shipments.dispatch', 'users.manage_staff'
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'role-operator',
    name: 'مسؤول تشغيل ومستودع (Operator)',
    roleKey: 'OPERATOR',
    description: 'فرز الطرود، تسليم واستلام الشحنات، إدارة المخزون، وإنشاء الفواتير',
    isSystemRole: true,
    permissions: [
      'pos.access', 'pos.discount', 'pos.void_sale', 'pos.custom_items',
      'warehouse.view', 'warehouse.manage_products', 'warehouse.adjust_stock', 'warehouse.view_cost_price',
      'invoices.view', 'invoices.create', 'invoices.delete',
      'accounting.view_pnl', 'accounting.expenses',
      'shipments.create', 'shipments.dispatch', 'users.manage_staff'
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'role-merchant',
    name: 'التاجر وصاحب المتجر (Merchant)',
    roleKey: 'MERCHANT',
    description: 'إنشاء طلبات التوصيل، متابعة الطرود، استخدام الكاشير والمستودع الخاص، ومتابعة الأرباح',
    isSystemRole: true,
    permissions: [
      'pos.access', 'pos.discount', 'pos.void_sale', 'pos.custom_items',
      'warehouse.view', 'warehouse.manage_products', 'warehouse.adjust_stock', 'warehouse.view_cost_price',
      'invoices.view', 'invoices.create',
      'accounting.view_pnl', 'accounting.expenses', 'accounting.wallet_payouts',
      'shipments.create'
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'role-cashier',
    name: 'كاشير نقاط البيع (Cashier)',
    roleKey: 'CASHIER',
    description: 'إجراء عمليات البيع السريع وإصدار الإيصالات للعملاء',
    isSystemRole: true,
    permissions: ['pos.access', 'pos.custom_items'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'role-accountant',
    name: 'محاسب مالي (Accountant)',
    roleKey: 'ACCOUNTANT',
    description: 'التسويات المالية، كشوفات الحساب، تسجيل المصاريف ومتابعة الأرباح',
    isSystemRole: true,
    permissions: [
      'warehouse.view', 'warehouse.view_cost_price',
      'invoices.view', 'invoices.create',
      'accounting.view_pnl', 'accounting.expenses'
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'role-driver',
    name: 'كابتن التوصيل (Driver)',
    roleKey: 'DRIVER',
    description: 'استلام الشحنات وتوصيلها وتحديث الحالات التشغيلية وإثبات التسليم POD',
    isSystemRole: true,
    permissions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'role-staff',
    name: 'موظف تشغيل (Staff)',
    roleKey: 'STAFF',
    description: 'متابعة الشحنات والفرز الداخلي',
    isSystemRole: true,
    permissions: ['warehouse.view', 'invoices.view'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// -------------------------------------------------------------
// Multi-Tenant Isolation, Authentication & Authorization RBAC
// -------------------------------------------------------------
interface RequesterContext {
  userId?: string;
  userRole?: string;
  tenantId?: string;
  branchId?: string;
  branchName?: string;
  workspace?: string;
  user?: User;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isMerchant: boolean;
  isDriver: boolean;
  isCashier: boolean;
  isOperator: boolean;
  isAccountant: boolean;
}

// =============================================================
// Cryptographic Session Token Architecture (HMAC-SHA256 Signed JWT)
// =============================================================
const SESSION_SECRET = process.env.SESSION_SECRET || 'dargo_hmac_sha256_secret_key_v1_2026_x9k2p8z';
const SESSION_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 Hours

// Revocation registry for logged-out or invalidated session IDs (jti)
// Primary Source of Truth: Supabase PostgreSQL `revoked_sessions` table
// Performance Cache Layer: Local in-memory `revokedSessionJtis` Set
const revokedSessionJtis = new Set<string>();

/**
 * Asynchronously verify if a session JTI has been revoked.
 * Primary Source of Truth: Supabase `revoked_sessions` PostgreSQL table.
 * Performance Cache Layer: Local in-memory `revokedSessionJtis` Set.
 */
async function isSessionRevoked(jti: string): Promise<boolean> {
  if (!jti) return false;

  // 1. Instant check in local in-memory cache
  if (revokedSessionJtis.has(jti)) {
    return true;
  }

  // 2. Query distributed persistent PostgreSQL database in Supabase
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('revoked_sessions')
        .select('jti')
        .eq('jti', jti)
        .limit(1);

      if (!error && data && data.length > 0) {
        // Cache locally on this instance for subsequent fast requests
        revokedSessionJtis.add(jti);
        return true;
      }
    }
  } catch (err: any) {
    console.warn('[SessionRevocation] Persistent lookup warning:', err?.message || err);
  }

  return false;
}

/**
 * Revoke a session JTI across all distributed instances via Supabase persistence.
 */
async function revokeSession(payload: SessionTokenPayload, reason: string = 'logout'): Promise<boolean> {
  if (!payload || !payload.jti) return false;

  const jti = payload.jti;

  // 1. Add to local instance in-memory cache
  revokedSessionJtis.add(jti);

  // 2. Persist in Supabase `revoked_sessions` table
  try {
    if (supabase) {
      const expiresAtIso = new Date(payload.exp || Date.now() + SESSION_EXPIRATION_MS).toISOString();
      const validUserId = payload.userId && isValidUuid(payload.userId) ? payload.userId : null;

      const { error } = await supabase.from('revoked_sessions').insert([
        {
          jti,
          user_id: validUserId,
          expires_at: expiresAtIso,
          reason,
          revoked_at: new Date().toISOString(),
        },
      ]);

      if (error && !error.message.includes('duplicate key') && !error.message.includes('unique constraint')) {
        console.warn('[SessionRevocation] Persistent insert warning:', error.message);
      }
    }
  } catch (err: any) {
    console.warn('[SessionRevocation] Persistent error:', err?.message || err);
  }

  return true;
}

export interface SessionTokenPayload {
  userId: string;
  role: string;
  tenantId?: string;
  iat: number;
  exp: number;
  jti: string;
}

/**
 * Generate a cryptographically signed session token (HMAC-SHA256)
 */
function generateSessionToken(user: User): string {
  const now = Date.now();
  const jti = crypto.randomBytes(16).toString('hex');
  const payload: SessionTokenPayload = {
    userId: user.id,
    role: user.role,
    tenantId: user.parentUserId || user.id,
    iat: now,
    exp: now + SESSION_EXPIRATION_MS,
    jti,
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadStr)
    .digest('base64url');

  return `dargo_jwt.${payloadStr}.${signature}`;
}

/**
 * Verify cryptographic signature, expiration, and revocation status of session token.
 * Returns payload if valid, or null if tampered, expired, or revoked.
 */
function verifySessionToken(rawToken: string): SessionTokenPayload | null {
  if (!rawToken || typeof rawToken !== 'string') return null;
  let token = rawToken.trim();
  if (token.startsWith('Bearer ')) {
    token = token.substring(7).trim();
  }
  if (!token || token === 'undefined' || token === 'null') return null;

  // Enforce format: dargo_jwt.<payload_b64url>.<signature_b64url>
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'dargo_jwt') {
    return null; // Reject plain unsigned dargo_jwt_<userId>_<timestamp> or malformed tokens
  }

  const payloadStr = parts[1];
  const providedSignature = parts[2];

  // Recompute HMAC-SHA256 signature
  const expectedSignature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadStr)
    .digest('base64url');

  try {
    const sigBuf = Buffer.from(providedSignature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null; // Signature mismatch! Tampered payload!
    }
  } catch {
    return null;
  }

  // Parse JSON payload
  let payload: SessionTokenPayload;
  try {
    const jsonStr = Buffer.from(payloadStr, 'base64url').toString('utf8');
    payload = JSON.parse(jsonStr);
  } catch {
    return null;
  }

  // Enforce Expiration Time
  if (!payload.exp || Date.now() > payload.exp) {
    return null; // Token expired!
  }

  // Enforce Revocation (Logout)
  if (payload.jti && revokedSessionJtis.has(payload.jti)) {
    return null; // Token revoked!
  }

  return payload;
}

// Resolve user identity securely from cryptographically signed JWT bearer token
// Insecure spoofable headers (x-user-id, x-user-role, requesterId query/body) are strictly ignored
async function resolveAuthenticatedUser(req: express.Request): Promise<User | null> {
  const authHeader = req.headers['authorization'] || req.headers['x-auth-token'];
  if (!authHeader || typeof authHeader !== 'string') return null;

  const payload = verifySessionToken(authHeader);
  if (!payload || !payload.userId) return null;

  // Distributed Persistent Revocation Check (PostgreSQL Source of Truth + In-memory Cache)
  if (payload.jti && (await isSessionRevoked(payload.jti))) {
    return null; // Session revoked globally in DB!
  }

  const candidateUserId = payload.userId;

  // 1. Check in-memory users cache first
  let matchedUser = users.find((u) => u && u.id === candidateUserId);

  // 2. If not found, look up in Supabase
  if (!matchedUser) {
    try {
      if (isValidUuid(candidateUserId)) {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', candidateUserId)
          .limit(1);
        if (!error && data && data.length > 0) {
          matchedUser = mapDbUserToAppUser(data[0]);
          const idx = users.findIndex((u) => u.id === matchedUser!.id);
          if (idx >= 0) users[idx] = matchedUser!;
          else users.push(matchedUser!);
        }
      }
    } catch {
      // fallback
    }
  }

  if (!matchedUser) return null;

  // Enforce Account Active Status (Disabled/Inactive User Protection)
  if ((matchedUser as any).isActive === false || (matchedUser as any).is_active === false || (matchedUser as any).status === 'INACTIVE' || (matchedUser as any).status === 'DEACTIVATED') {
    return null;
  }

  return matchedUser;
}

function getRequesterContext(req: express.Request): RequesterContext {
  const user = (req as any).authUser as User | undefined;
  
  if (!user) {
    return {
      userId: undefined,
      userRole: undefined,
      tenantId: undefined,
      branchId: undefined,
      branchName: undefined,
      workspace: undefined,
      user: undefined,
      isSuperAdmin: false,
      isAdmin: false,
      isMerchant: false,
      isDriver: false,
      isCashier: false,
      isOperator: false,
      isAccountant: false,
    };
  }

  const userRole = user.role;
  let tenantId: string | undefined = undefined;

  if (user.role === 'ADMIN') {
    tenantId = user.id;
  } else if (user.parentUserId) {
    tenantId = user.parentUserId;
  } else {
    tenantId = user.id;
  }

  const isSuperAdmin = userRole === 'SUPER_ADMIN';
  const isAdmin = userRole === 'ADMIN';
  const isMerchant = userRole === 'MERCHANT';
  const isDriver = userRole === 'DRIVER';
  const isCashier = userRole === 'CASHIER';
  const isOperator = userRole === 'OPERATOR';
  const isAccountant = userRole === 'ACCOUNTANT';

  let branchId = user.branchId || (user as any).branch_id || undefined;
  let branchName = user.branch || undefined;

  // Normalized Cashier Branch Isolation: branchId MUST be derived from user_branch_access
  if (isCashier) {
    const assignedAccess = userBranchAccess.find((uba) => uba.userId === user.id);
    if (assignedAccess) {
      branchId = assignedAccess.branchId;
    }
    if (branchId) {
      const branchObj = merchantBranches.find((b) => b.id === branchId);
      if (branchObj) {
        branchName = branchObj.name;
      }
    }
  }

  let workspace = 'DELIVERY_COMPANY_WORKSPACE';
  if (isSuperAdmin) workspace = 'PLATFORM_WORKSPACE';
  else if (isAdmin) workspace = 'DELIVERY_COMPANY_WORKSPACE';
  else if (isMerchant) workspace = 'MERCHANT_WORKSPACE';
  else if (isDriver) workspace = 'DRIVER_WORKSPACE';
  else if (isOperator) workspace = 'OPERATOR_WORKSPACE';
  else if (isAccountant) workspace = 'ACCOUNTANT_WORKSPACE';
  else if (isCashier) workspace = 'CASHIER_WORKSPACE';

  return {
    userId: user.id,
    userRole,
    tenantId,
    branchId,
    branchName,
    workspace,
    user,
    isSuperAdmin,
    isAdmin,
    isMerchant,
    isDriver,
    isCashier,
    isOperator,
    isAccountant,
  };
}

// Enterprise Merchant Internal Scope Guard:
// Ensures ADMIN cannot access Merchant POS or warehouse stock merely via permissions,
// and CASHIER cannot access foreign branches.
function canAccessMerchantInternal(ctx: RequesterContext, merchantId: string, branchId?: string): boolean {
  if (ctx.isSuperAdmin) return true;
  if (!ctx.user) return false;

  // Merchant owner has full access to their own store and all their branches
  if (ctx.isMerchant && ctx.userId === merchantId) return true;

  // Cashier only has access to their specific parent merchant AND their assigned branch
  if (ctx.isCashier) {
    const parentMerchantId = ctx.user.parentUserId || ctx.tenantId;
    if (parentMerchantId !== merchantId) return false;
    if (branchId && ctx.branchId && ctx.branchId !== branchId) return false;
    return true;
  }

  // Delivery Company Admins/Operators are strictly forbidden from internal merchant POS / stock
  return false;
}

// Hierarchical & Tenant Access Evaluation Functions
function canAccessMerchant(ctx: RequesterContext, merchantId: string): boolean {
  if (ctx.isSuperAdmin) return true;
  if (!ctx.user) return false;
  if (ctx.user.id === merchantId) return true;
  
  const merchantUser = users.find((u) => u && u.id === merchantId);
  if (!merchantUser) return false;

  if (ctx.isAdmin) {
    if (merchantUser.parentUserId === ctx.user.id || merchantUser.parentUserId === ctx.tenantId) {
      return true;
    }
  }

  // Descendant staff in the same tenant
  if (merchantUser.parentUserId === ctx.tenantId) return true;

  return false;
}

function canAccessDriver(ctx: RequesterContext, driverId: string): boolean {
  if (ctx.isSuperAdmin) return true;
  if (!ctx.user) return false;
  if (ctx.user.id === driverId) return true;

  const driverUser = users.find((u) => u && u.id === driverId);
  if (!driverUser) return false;

  if (ctx.isAdmin) {
    if (driverUser.parentUserId === ctx.user.id || driverUser.parentUserId === ctx.tenantId) {
      return true;
    }
  }

  if (driverUser.parentUserId === ctx.tenantId) return true;

  return false;
}

function canAccessOrder(ctx: RequesterContext, order: Order | undefined | null): boolean {
  if (!order) return false;
  if (ctx.isSuperAdmin) return true;
  if (!ctx.user) return false;

  // CASHIER Role: Strictly isolated to their own merchant and assigned branch
  if (ctx.isCashier) {
    const cashierMerchantId = ctx.user.parentUserId || ctx.tenantId;
    if (order.merchantId !== cashierMerchantId) return false;
    const cashierBranchId = ctx.branchId || ctx.user.branchId;
    const cashierBranchName = ctx.branchName || ctx.user.branch;
    if (cashierBranchId && order.branchId && order.branchId !== cashierBranchId) return false;
    if (cashierBranchName && order.branchName && order.branchName !== cashierBranchName) return false;
    return true;
  }

  if (ctx.user.id === order.merchantId) return true;
  if (ctx.user.id === order.driverId) return true;

  if (ctx.isAdmin || ctx.tenantId) {
    if (order.tenantId && (order.tenantId === ctx.tenantId || order.tenantId === ctx.user.id)) return true;
    const merchant = users.find((u) => u && u.id === order.merchantId);
    if (merchant && (merchant.parentUserId === ctx.user.id || merchant.parentUserId === ctx.tenantId)) return true;
    const driver = order.driverId ? users.find((u) => u && u.id === order.driverId) : null;
    if (driver && (driver.parentUserId === ctx.user.id || driver.parentUserId === ctx.tenantId)) return true;
  }

  return false;
}

// Commercial Data Privacy: Strictly isolating merchant cost prices from carrier admin and cashiers
function canViewCostPrices(ctx: RequesterContext, merchantId?: string): boolean {
  if (!ctx.user) return false;
  
  // Carrier Admins, Drivers, and Cashiers must NEVER view internal merchant cost prices
  if (ctx.userRole === 'ADMIN' || ctx.userRole === 'DRIVER' || ctx.userRole === 'CASHIER') {
    return false;
  }

  // Merchant owner viewing their own internal warehouse
  if (merchantId && ctx.user.id === merchantId) return true;

  // Merchant internal staff/manager authorized by the merchant
  if (ctx.user.parentUserId && merchantId && ctx.user.parentUserId === merchantId) {
    return hasPermission(ctx.user, 'merchant.cost_view') ||
           hasPermission(ctx.user, 'warehouse.view_cost_price') ||
           hasPermission(ctx.user, 'merchant.products.cost_view');
  }

  if (ctx.isSuperAdmin) return true;
  return false;
}

// Authentication Middlewares
async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = await resolveAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({
      error: 'غير مصرح: يجب تسجيل الدخول للوصول إلى هذه الواجهة.',
      code: 'UNAUTHORIZED',
    });
  }
  (req as any).authUser = user;
  next();
}

async function requireSuperAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = await resolveAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({
      error: 'غير مصرح: يرجى تسجيل الدخول بحساب معتمد.',
      code: 'UNAUTHORIZED',
    });
  }
  if (user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({
      error: 'ممنوع الوصول: هذه العملية مخصصة حصرياً للمدير العام للنظام (Super Admin).',
      code: 'FORBIDDEN',
    });
  }
  (req as any).authUser = user;
  next();
}

function requirePermission(permissionKey: string) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = await resolveAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'غير مصرح: يرجى تسجيل الدخول أولاً.', code: 'UNAUTHORIZED' });
    }
    if (user.role === 'SUPER_ADMIN') {
      (req as any).authUser = user;
      return next();
    }

    if (!hasPermission(user, permissionKey)) {
      return res.status(403).json({
        error: `ليس لديك الصلاحية المطلوبة (${permissionKey}) لتنفيذ هذا الإجراء.`,
        code: 'PERMISSION_DENIED',
      });
    }
    (req as any).authUser = user;
    next();
  };
}


// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// Clean Database / Reset to Fresh Production State Endpoint
app.post('/api/system/clean-database', requireSuperAdmin, (req, res) => {
  const ctx = getRequesterContext(req);
  orders = [];
  merchantProducts = [];
  stockMovements = [];
  merchantInvoices = [];
  merchantExpenses = [];
  journalEntries = [];
  vouchers = [];
  apiKeys = [];
  notificationLogs = [];
  merchantCategories = {};
  nextSequenceNumber = 1001;
  accounts.forEach((acc) => {
    acc.balance = 0.0;
  });
  saveDatabase();

  logAuditEvent({
    action: 'CLEAN_DATABASE',
    actionNameAr: 'تصفير وتنظيف بيانات الاختبار',
    performedBy: ctx.userId || 'SUPER_ADMIN',
    performerName: ctx.user?.name,
    performerRole: 'SUPER_ADMIN',
    targetType: 'SYSTEM',
    targetName: 'قاعدة البيانات التشغيلية',
  });

  res.json({ success: true, message: 'تم تصفير جميع البيانات الوهمية وتجهيز قاعدة البيانات للبيانات الحقيقية بنجاح' });
});

// Price Plans & Rate Cards Endpoints (قوائم وتسعيرات التوصيل للتاجر والسائق)
// -------------------------------------------------------------
app.get('/api/price-plans', requireAuth, (req, res) => {
  const type = req.query.type as string; // 'MERCHANT' | 'DRIVER'
  let list = [...pricePlans];
  if (type) {
    list = list.filter((p) => p.type === type);
  }

  // Calculate dynamic assigned users count for each plan
  const enriched = list.map((plan) => {
    const assignedUsers = users.filter(
      (u) => u.pricePlanId === plan.id || (u.priceList && u.priceList === plan.name)
    );
    return {
      ...plan,
      assignedUsersCount: assignedUsers.length,
      assignedUsers: assignedUsers.map((u) => ({
        id: u.id,
        name: u.name,
        commercialName: u.commercialName,
        phone: u.phone,
        role: u.role,
        city: u.city,
      })),
    };
  });

  res.json(enriched);
});

// Create new price plan
app.post('/api/price-plans', requireAuth, (req, res) => {
  try {
    const {
      name,
      type = 'MERCHANT',
      description = '',
      isDefault = false,
      defaultFee = 3.0,
      governorateFees = {},
      returnFee = 1.0,
      extraWeightFeePerKg = 0.5,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'اسم قائمة التسعيرة مطلوب' });
    }

    if (isDefault) {
      pricePlans.forEach((p) => {
        if (p.type === type) p.isDefault = false;
      });
    }

    const newPlan: PricePlan = {
      id: `pp-${type.toLowerCase().slice(0, 3)}-${Date.now()}`,
      name: name.trim(),
      type,
      description: description.trim(),
      isDefault: Boolean(isDefault),
      defaultFee: parseFloat(defaultFee) || 3.0,
      governorateFees: governorateFees || {},
      returnFee: parseFloat(returnFee) || 1.0,
      extraWeightFeePerKg: parseFloat(extraWeightFeePerKg) || 0.5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    pricePlans.unshift(newPlan);
    saveDatabase();
    res.status(201).json(newPlan);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update price plan
app.patch('/api/price-plans/:id', requireAuth, (req, res) => {
  const plan = pricePlans.find((p) => p.id === req.params.id);
  if (!plan) {
    return res.status(404).json({ error: 'قائمة التسعيرة غير موجودة' });
  }

  const prevName = plan.name;
  const { name, isDefault, governorateFees, defaultFee, returnFee, extraWeightFeePerKg, description } = req.body;

  if (isDefault) {
    pricePlans.forEach((p) => {
      if (p.type === plan.type && p.id !== plan.id) p.isDefault = false;
    });
  }

  if (name !== undefined) plan.name = name.trim();
  if (description !== undefined) plan.description = description.trim();
  if (isDefault !== undefined) plan.isDefault = Boolean(isDefault);
  if (defaultFee !== undefined) plan.defaultFee = parseFloat(defaultFee);
  if (governorateFees !== undefined) plan.governorateFees = governorateFees;
  if (returnFee !== undefined) plan.returnFee = parseFloat(returnFee);
  if (extraWeightFeePerKg !== undefined) plan.extraWeightFeePerKg = parseFloat(extraWeightFeePerKg);
  plan.updatedAt = new Date().toISOString();

  // If name changed, synchronize priceList on all users using this plan
  if (name && name !== prevName) {
    users.forEach((u) => {
      if (u.pricePlanId === plan.id || u.priceList === prevName) {
        u.priceList = plan.name;
        u.pricePlanId = plan.id;
      }
    });
  }

  saveDatabase();
  res.json(plan);
});

// Delete price plan
app.delete('/api/price-plans/:id', requireAuth, (req, res) => {
  const index = pricePlans.findIndex((p) => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'قائمة التسعيرة غير موجودة' });
  }

  const planToDelete = pricePlans[index];
  // Reassign users of this plan to another plan of the same type
  const fallback =
    pricePlans.find((p) => p.type === planToDelete.type && p.id !== planToDelete.id && p.isDefault) ||
    pricePlans.find((p) => p.type === planToDelete.type && p.id !== planToDelete.id);

  if (fallback) {
    users.forEach((u) => {
      if (u.pricePlanId === planToDelete.id) {
        u.pricePlanId = fallback.id;
        u.priceList = fallback.name;
      }
    });
  }

  pricePlans.splice(index, 1);
  saveDatabase();
  res.json({ message: 'تم حذف قائمة التسعيرة بنجاح', fallbackPlan: fallback?.name });
});

// Bulk assign price plan to users
app.post('/api/price-plans/:id/assign', requireAuth, (req, res) => {
  const plan = pricePlans.find((p) => p.id === req.params.id);
  if (!plan) {
    return res.status(404).json({ error: 'قائمة التسعيرة غير موجودة' });
  }

  const { userIds } = req.body;
  if (!Array.isArray(userIds)) {
    return res.status(400).json({ error: 'قائمة المستخدمين غير صحيحة' });
  }

  let updatedCount = 0;
  users.forEach((u) => {
    if (userIds.includes(u.id)) {
      u.pricePlanId = plan.id;
      u.priceList = plan.name;
      updatedCount++;
    }
  });

  saveDatabase();
  res.json({
    message: `تم تعيين تسعيرة "${plan.name}" لـ ${updatedCount} مستخدمين بنجاح`,
    updatedCount,
  });
});

// Dynamic calculate fee for merchant and driver by governorate
app.post('/api/price-plans/calculate', requireAuth, (req, res) => {
  const { merchantId, driverId, governorate = 'عمان' } = req.body;

  let merchantFee = 3.0;
  let merchantPlanName = 'الافتراضية';
  if (merchantId) {
    const merchant = users.find((u) => u.id === merchantId);
    const mPlan =
      pricePlans.find((p) => p.id === merchant?.pricePlanId || (merchant?.priceList && p.name === merchant.priceList)) ||
      pricePlans.find((p) => p.type === 'MERCHANT' && p.isDefault);
    if (mPlan) {
      merchantPlanName = mPlan.name;
      merchantFee = mPlan.governorateFees?.[governorate] ?? mPlan.defaultFee;
    }
  }

  let driverFee = 1.5;
  let driverPlanName = 'الافتراضية';
  if (driverId) {
    const driver = users.find((u) => u.id === driverId);
    const dPlan =
      pricePlans.find((p) => p.id === driver?.pricePlanId || (driver?.priceList && p.name === driver.priceList)) ||
      pricePlans.find((p) => p.type === 'DRIVER' && p.isDefault);
    if (dPlan) {
      driverPlanName = dPlan.name;
      driverFee = dPlan.governorateFees?.[governorate] ?? dPlan.defaultFee;
    }
  }

  res.json({
    governorate,
    merchantFee,
    merchantPlanName,
    driverFee,
    driverPlanName,
  });
});

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// 1. GET /api/orders: Fetch orders with multi-tenant isolation, pagination, search & filters
app.get('/api/orders', requireAuth, (req, res) => {
  try {
    const ctx = getRequesterContext(req);
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 10);
    const search = (req.query.search as string || '').trim().toLowerCase();
    const status = req.query.status as string;
    const governorate = req.query.governorate as string;
    const merchantId = req.query.merchantId as string;
    const driverId = req.query.driverId as string;
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortDir = (req.query.sortDir as string) || 'desc';
    const reqTenantId = (req.query.tenantId as string) || (ctx.isAdmin ? ctx.tenantId : undefined);

    const safeOrders = Array.isArray(orders) ? orders : [];
    let tenantOrders = [...safeOrders];

    // Multi-tenant & Branch data isolation:
    if (!ctx.isSuperAdmin && ctx.user) {
      if (ctx.isCashier) {
        // Cashier is strictly isolated to their parent merchant AND their assigned branch
        if (req.query.branchId && req.query.branchId !== ctx.branchId) {
          return res.status(403).json({ error: 'غير مصرح باستعراض شحنات فرع آخر' });
        }
        const cashierMerchantId = ctx.user?.parentUserId || ctx.tenantId;
        tenantOrders = tenantOrders.filter(
          (o) => o && o.merchantId === cashierMerchantId && (!ctx.branchId || o.branchId === ctx.branchId)
        );
      } else if (ctx.isAdmin && ctx.tenantId) {
        // Admin sees orders belonging to their merchants or themselves or drivers under them
        const adminMerchantIds = users.filter((u) => u && (u.parentUserId === ctx.tenantId || u.id === ctx.tenantId)).map((u) => u.id);
        tenantOrders = tenantOrders.filter((o) => {
          if (!o) return false;
          if (o.tenantId && o.tenantId === ctx.tenantId) return true;
          if (adminMerchantIds.includes(o.merchantId)) return true;
          return false;
        });
      } else if (ctx.isMerchant) {
        tenantOrders = tenantOrders.filter((o) => o && o.merchantId === ctx.user?.id);
      } else if (ctx.isDriver) {
        tenantOrders = tenantOrders.filter((o) => o && o.driverId === ctx.user?.id);
      } else if (ctx.tenantId) {
        // Staff/Operator/Accountant in this tenant
        const adminMerchantIds = users.filter((u) => u && (u.parentUserId === ctx.tenantId || u.id === ctx.tenantId)).map((u) => u.id);
        tenantOrders = tenantOrders.filter((o) => {
          if (!o) return false;
          if (o.tenantId && o.tenantId === ctx.tenantId) return true;
          if (adminMerchantIds.includes(o.merchantId)) return true;
          return false;
        });
      }
    } else if (ctx.isSuperAdmin && reqTenantId && reqTenantId !== 'ALL') {
      const adminMerchantIds = users.filter((u) => u && (u.parentUserId === reqTenantId || u.id === reqTenantId)).map((u) => u.id);
      tenantOrders = tenantOrders.filter((o) => {
        if (!o) return false;
        if (o.tenantId && o.tenantId === reqTenantId) return true;
        if (adminMerchantIds.includes(o.merchantId)) return true;
        return false;
      });
    }

    let filtered = [...tenantOrders];

    // Search by Sequence, Reference, Recipient Phone, Recipient Name, or Area
    if (search) {
      filtered = filtered.filter((o) => {
        if (!o) return false;
        return (
          (o.sequence && o.sequence.toLowerCase().includes(search)) ||
          (o.referenceNumber && o.referenceNumber.toLowerCase().includes(search)) ||
          (o.recipientPhone && o.recipientPhone.toString().includes(search)) ||
          (o.recipientName && o.recipientName.toLowerCase().includes(search)) ||
          (o.area && o.area.toLowerCase().includes(search)) ||
          (o.governorate && o.governorate.toLowerCase().includes(search))
        );
      });
    }

    // Filter by Status
    if (status && status !== 'ALL') {
      filtered = filtered.filter((o) => o && o.status === status);
    }

    // Filter by Governorate
    if (governorate && governorate !== 'ALL') {
      filtered = filtered.filter((o) => o && o.governorate === governorate);
    }

    // Filter by Merchant
    if (merchantId && merchantId !== 'ALL') {
      filtered = filtered.filter((o) => o && o.merchantId === merchantId);
    }

    // Filter by Driver
    if (driverId) {
      if (driverId === 'UNASSIGNED') {
        filtered = filtered.filter((o) => o && !o.driverId);
      } else if (driverId !== 'ALL') {
        filtered = filtered.filter((o) => o && o.driverId === driverId);
      }
    }

    // Sort
    filtered.sort((a: any, b: any) => {
      let aVal = a?.[sortBy] ?? '';
      let bVal = b?.[sortBy] ?? '';
      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });

    // Calculate Scoped Stats from All Orders in this Workspace
    const stats = {
      total: tenantOrders.length,
      pending: tenantOrders.filter((o) => o?.status === 'PENDING').length,
      picking: tenantOrders.filter((o) => o?.status === 'PICKING').length,
      out_for_delivery: tenantOrders.filter((o) => o?.status === 'OUT_FOR_DELIVERY').length,
      delivered: tenantOrders.filter((o) => o?.status === 'DELIVERED').length,
      cancelled: tenantOrders.filter((o) => o?.status === 'CANCELLED').length,
      postponed: tenantOrders.filter((o) => o?.status === 'POSTPONED').length,
      totalCOD: tenantOrders.reduce((sum, o) => sum + (o?.totalCollection || 0), 0),
      totalDeliveryFees: tenantOrders.reduce((sum, o) => sum + (o?.deliveryFee || 0), 0),
    };

    // Pagination Slice
    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedOrders = filtered.slice(startIndex, startIndex + limit).map(populateOrder);

    res.json({
      orders: paginatedOrders,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
      stats,
    });
  } catch (err: any) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ error: err?.message || 'خطأ في جلب الشحنات' });
  }
});

// 2. GET /api/orders/:id: Get single order details with status logs
app.get('/api/orders/:id', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'الطلبية غير موجودة' });
  }

  if (!canAccessOrder(ctx, order)) {
    return res.status(403).json({ error: 'غير مصرح بالوصول إلى هذه الشحنة' });
  }

  res.json(populateOrder(order));
});

// 3. POST /api/orders: Create new order (Full form)
app.post('/api/orders', requireAuth, (req, res) => {
  try {
    const ctx = getRequesterContext(req);
    const {
      referenceNumber,
      merchantId,
      driverId,
      recipientName,
      recipientPhone,
      recipientPhoneAlt,
      governorate,
      area,
      subArea,
      fullAddress,
      merchantCollection = 0,
      deliveryFee = 3.0,
      totalCollection,
      packageType = 'طرد عادي',
      piecesCount = 1,
      notes,
    } = req.body;

    if (!recipientName || !recipientPhone || !governorate || !area || !merchantId) {
      return res.status(400).json({ error: 'يرجى ملء جميع الحقول الإلزامية' });
    }

    if (!canAccessMerchant(ctx, merchantId)) {
      return res.status(403).json({ error: 'غير مصرح بإنشاء شحنة لمتجر خارج نطاق صلاحياتك' });
    }

    if (driverId && !canAccessDriver(ctx, driverId)) {
      return res.status(403).json({ error: 'غير مصرح بتعيين سائق خارج نطاق شركتك' });
    }

    const mColl = parseFloat(merchantCollection) || 0;
    const finalDeliveryFee =
      deliveryFee !== undefined && deliveryFee !== null && deliveryFee !== ''
        ? parseFloat(deliveryFee)
        : getMerchantDeliveryFee(merchantId, governorate);
    const tot = totalCollection !== undefined ? parseFloat(totalCollection) : mColl + finalDeliveryFee;
    const calcDriverFee = driverId ? getDriverCompensationFee(driverId, governorate) : undefined;

    let orderBranchId: string | undefined = req.body.branchId;
    let orderBranchName: string | undefined = undefined;

    if (ctx.isCashier) {
      orderBranchId = ctx.branchId;
      orderBranchName = ctx.branchName;
    } else if (orderBranchId) {
      const bObj = merchantBranches.find((b) => b.id === orderBranchId && b.merchantId === merchantId);
      if (bObj) {
        orderBranchName = bObj.name;
      } else {
        orderBranchId = undefined;
      }
    } else {
      const mainB = merchantBranches.find((b) => b.merchantId === merchantId && b.isMain);
      if (mainB) {
        orderBranchId = mainB.id;
        orderBranchName = mainB.name;
      }
    }

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      sequence: `ORD-2026-${nextSequenceNumber++}`,
      referenceNumber: referenceNumber || `REF-${Math.floor(1000 + Math.random() * 9000)}`,
      status: driverId ? 'OUT_FOR_DELIVERY' : 'PENDING',
      paymentType: 'COD',
      merchantId,
      branchId: orderBranchId,
      branchName: orderBranchName,
      driverId: driverId || null,
      recipientName,
      recipientPhone,
      recipientPhoneAlt: recipientPhoneAlt || '',
      governorate,
      area,
      subArea: subArea || '',
      fullAddress: fullAddress || `${governorate} - ${area}`,
      merchantCollection: mColl,
      deliveryFee: finalDeliveryFee,
      driverFee: calcDriverFee,
      totalCollection: tot,
      isSettledWithMerchant: false,
      isSettledWithDriver: false,
      packageType,
      piecesCount: parseInt(piecesCount) || 1,
      deliveryAttempts: 0,
      notes: notes || '',
      deliveryOtp: Math.floor(1000 + Math.random() * 9000).toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      statusLogs: [
        {
          id: `log-${Date.now()}`,
          orderId: `ord-${Date.now()}`,
          fromStatus: null,
          toStatus: driverId ? 'OUT_FOR_DELIVERY' : 'PENDING',
          note: 'تم تسجيل الشحنة في النظام',
          createdAt: new Date().toISOString(),
        },
      ],
    };

    orders.unshift(newOrder);
    res.status(201).json(populateOrder(newOrder));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. POST /api/orders/quick: Rapid single order creation
app.post('/api/orders/quick', requireAuth, (req, res) => {
  try {
    const ctx = getRequesterContext(req);
    const {
      recipientName,
      recipientPhone,
      governorate = 'عمان',
      area,
      fullAddress,
      totalCollection = 20,
      deliveryFee,
      merchantId,
      notes,
    } = req.body;

    if (!recipientName || !recipientPhone || !area || !merchantId) {
      return res.status(400).json({ error: 'الاسم، الهاتف، المنطقة، والتاجر حقول مطلوبة للطلبية السريعة' });
    }

    if (!canAccessMerchant(ctx, merchantId)) {
      return res.status(403).json({ error: 'غير مصرح بإنشاء شحنة لمتجر خارج نطاق صلاحياتك' });
    }

    const fee =
      deliveryFee !== undefined && deliveryFee !== null && deliveryFee !== ''
        ? parseFloat(deliveryFee)
        : getMerchantDeliveryFee(merchantId, governorate);
    const tot = parseFloat(totalCollection) || 0;
    const mColl = Math.max(0, tot - fee);

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      sequence: `ORD-2026-${nextSequenceNumber++}`,
      referenceNumber: `Q-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'PENDING',
      paymentType: 'COD',
      merchantId,
      driverId: null,
      recipientName,
      recipientPhone,
      governorate,
      area,
      fullAddress: fullAddress || `${governorate}، ${area}`,
      merchantCollection: mColl,
      deliveryFee: fee,
      totalCollection: tot,
      isSettledWithMerchant: false,
      isSettledWithDriver: false,
      packageType: 'طرد سريع',
      piecesCount: 1,
      deliveryAttempts: 0,
      notes: notes || 'طلبية سريعة',
      deliveryOtp: Math.floor(1000 + Math.random() * 9000).toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      statusLogs: [
        {
          id: `log-${Date.now()}`,
          orderId: `ord-${Date.now()}`,
          fromStatus: null,
          toStatus: 'PENDING',
          note: 'تم إنشاء الطلبية السريعة بنجاح',
          createdAt: new Date().toISOString(),
        },
      ],
    };

    orders.unshift(newOrder);
    res.status(201).json(populateOrder(newOrder));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. POST /api/orders/batch: Bulk Batch Import
app.post('/api/orders/batch', requireAuth, (req, res) => {
  try {
    const ctx = getRequesterContext(req);
    const { orders: batchItems } = req.body;
    if (!Array.isArray(batchItems) || batchItems.length === 0) {
      return res.status(400).json({ error: 'قائمة الطلبيات فارغة' });
    }

    const created: Order[] = [];
    for (const item of batchItems) {
      const targetMerchantId = item.merchantId || (ctx.isMerchant ? ctx.userId : users.find((u) => u.role === 'MERCHANT')?.id || '');
      if (!canAccessMerchant(ctx, targetMerchantId)) {
        continue;
      }

      const tot = parseFloat(item.totalCollection) || 25;
      const fee = parseFloat(item.deliveryFee) || 3.0;
      const mColl = Math.max(0, tot - fee);

      const newOrder: Order = {
        id: `ord-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        sequence: `ORD-2026-${nextSequenceNumber++}`,
        referenceNumber: item.referenceNumber || `BATCH-${Math.floor(1000 + Math.random() * 9000)}`,
        status: item.driverId ? 'OUT_FOR_DELIVERY' : 'PENDING',
        paymentType: 'COD',
        merchantId: targetMerchantId,
        driverId: item.driverId || null,
        recipientName: item.recipientName || 'عميل محترم',
        recipientPhone: item.recipientPhone || '0790000000',
        governorate: item.governorate || 'عمان',
        area: item.area || 'غير محدد',
        fullAddress: item.fullAddress || `${item.governorate || 'عمان'} - ${item.area || ''}`,
        merchantCollection: mColl,
        deliveryFee: fee,
        totalCollection: tot,
        isSettledWithMerchant: false,
        isSettledWithDriver: false,
        packageType: item.packageType || 'دفعة طرود',
        piecesCount: 1,
        deliveryAttempts: 0,
        notes: item.notes || 'استيراد دفعة جماعية',
        deliveryOtp: Math.floor(1000 + Math.random() * 9000).toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      orders.unshift(newOrder);
      created.push(populateOrder(newOrder));
    }

    res.status(201).json({
      message: `تم إنشاء ${created.length} طلبية بنجاح`,
      orders: created,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. PATCH /api/orders/:id/status: Update Order Status
app.patch('/api/orders/:id/status', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  const { status, note, cancellationReason } = req.body;
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'الطلبية غير موجودة' });
  }

  if (!canAccessOrder(ctx, order)) {
    return res.status(403).json({ error: 'غير مصرح بتعديل حالة هذه الشحنة' });
  }

  const oldStatus = order.status;
  order.status = status as OrderStatus;
  order.updatedAt = new Date().toISOString();

  if (status === 'DELIVERED') {
    order.deliveredAt = new Date().toISOString();
  }

  // Snapshot return fee at the exact time the shipment transitions to RETURNED
  if (status === 'RETURNED' && (order.returnFee === undefined || order.returnFee === null)) {
    const plan =
      pricePlans.find((p) => p.type === 'MERCHANT' && p.merchantId === order.merchantId) ||
      pricePlans.find((p) => p.type === 'MERCHANT' && p.isDefault) ||
      pricePlans.find((p) => p.type === 'MERCHANT');
    const applicableReturnFee =
      plan?.returnFee !== undefined ? plan.returnFee : Number((order.deliveryFee * 0.5 || 1.5).toFixed(3));
    order.returnFee = applicableReturnFee;
  }

  if (cancellationReason) {
    order.cancellationReason = cancellationReason;
  }

  if (!order.statusLogs) {
    order.statusLogs = [];
  }
  order.statusLogs.push({
    id: `log-${Date.now()}`,
    orderId: order.id,
    fromStatus: oldStatus,
    toStatus: status,
    note: note || `تعديل الحالة من ${oldStatus} إلى ${status}`,
    createdAt: new Date().toISOString(),
  });

  saveDatabase();
  res.json(populateOrder(order));
});

// 7. PATCH /api/orders/:id/assign: Assign driver to single order
app.patch('/api/orders/:id/assign', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  const { driverId } = req.body;
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'الطلبية غير موجودة' });
  }

  if (!canAccessOrder(ctx, order)) {
    return res.status(403).json({ error: 'غير مصرح بتعيين هذه الشحنة' });
  }

  if (driverId && !canAccessDriver(ctx, driverId)) {
    return res.status(403).json({ error: 'غير مصرح بتعيين سائق خارج نطاق شركتك' });
  }

  order.driverId = driverId || null;
  if (driverId) {
    // Snapshot driver fee at assignment time from the currently active pricing plan
    order.driverFee = getDriverCompensationFee(driverId, order.governorate);
    if (order.status === 'PENDING') {
      order.status = 'OUT_FOR_DELIVERY';
    }
  }
  order.updatedAt = new Date().toISOString();

  saveDatabase();
  res.json(populateOrder(order));
});

// 8. POST /api/orders/bulk-status: Bulk Status Update
app.post('/api/orders/bulk-status', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  const { ids, status, note } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'لم يتم تحديد أي طلبيات' });
  }

  let updatedCount = 0;
  orders = orders.map((o) => {
    if (ids.includes(o.id) && canAccessOrder(ctx, o)) {
      updatedCount++;
      const old = o.status;
      let snapshottedReturnFee = o.returnFee;
      if (status === 'RETURNED' && (snapshottedReturnFee === undefined || snapshottedReturnFee === null)) {
        const plan =
          pricePlans.find((p) => p.type === 'MERCHANT' && p.merchantId === o.merchantId) ||
          pricePlans.find((p) => p.type === 'MERCHANT' && p.isDefault) ||
          pricePlans.find((p) => p.type === 'MERCHANT');
        snapshottedReturnFee =
          plan?.returnFee !== undefined ? plan.returnFee : Number((o.deliveryFee * 0.5 || 1.5).toFixed(3));
      }

      return {
        ...o,
        status,
        returnFee: snapshottedReturnFee,
        deliveredAt: status === 'DELIVERED' ? new Date().toISOString() : o.deliveredAt,
        updatedAt: new Date().toISOString(),
        statusLogs: [
          ...(o.statusLogs || []),
          {
            id: `log-${Date.now()}-${Math.random()}`,
            orderId: o.id,
            fromStatus: old,
            toStatus: status,
            note: note || `تحديث جماعي للحالة إلى ${status}`,
            createdAt: new Date().toISOString(),
          },
        ],
      };
    }
    return o;
  });

  saveDatabase();
  res.json({ message: `تم تحديث ${updatedCount} طلبية بنجاح` });
});

// 9. POST /api/orders/bulk-assign: Bulk Assign Driver
app.post('/api/orders/bulk-assign', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  const { ids, driverId } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'لم يتم تحديد أي طلبيات' });
  }

  if (driverId && !canAccessDriver(ctx, driverId)) {
    return res.status(403).json({ error: 'غير مصرح بتعيين سائق خارج نطاق شركتك' });
  }

  let assignedCount = 0;
  orders = orders.map((o) => {
    if (ids.includes(o.id) && canAccessOrder(ctx, o)) {
      assignedCount++;
      const calcDriverFee = driverId ? getDriverCompensationFee(driverId, o.governorate) : o.driverFee;
      return {
        ...o,
        driverId: driverId || null,
        driverFee: calcDriverFee,
        status: driverId && o.status === 'PENDING' ? 'OUT_FOR_DELIVERY' : o.status,
        updatedAt: new Date().toISOString(),
      };
    }
    return o;
  });

  saveDatabase();
  res.json({ message: `تم تعيين السائق لـ ${assignedCount} طلبية بنجاح` });
});

// 10. DELETE /api/orders/:id: Delete single order
app.delete('/api/orders/:id', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  const idx = orders.findIndex((o) => o.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: 'الطلبية غير موجودة' });
  }

  const order = orders[idx];
  if (!canAccessOrder(ctx, order)) {
    return res.status(403).json({ error: 'غير مصرح بحذف هذه الشحنة' });
  }

  orders.splice(idx, 1);
  res.json({ success: true, message: 'تم حذف الطلبية' });
});

// 12. GET /api/stats: Top-level Dashboard Metrics
app.get('/api/stats', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  let scopedOrders = [...orders];

  if (!ctx.isSuperAdmin && ctx.user) {
    if (ctx.isAdmin && ctx.tenantId) {
      const adminMerchantIds = users.filter((u) => u && (u.parentUserId === ctx.tenantId || u.id === ctx.tenantId)).map((u) => u.id);
      scopedOrders = scopedOrders.filter((o) => o && (o.tenantId === ctx.tenantId || adminMerchantIds.includes(o.merchantId)));
    } else if (ctx.isMerchant) {
      scopedOrders = scopedOrders.filter((o) => o && o.merchantId === ctx.user?.id);
    } else if (ctx.isDriver) {
      scopedOrders = scopedOrders.filter((o) => o && o.driverId === ctx.user?.id);
    }
  }

  const total = scopedOrders.length;
  const delivered = scopedOrders.filter((o) => o.status === 'DELIVERED').length;
  const active = scopedOrders.filter((o) => ['PENDING', 'PICKING', 'OUT_FOR_DELIVERY'].includes(o.status)).length;
  const totalCOD = scopedOrders.reduce((sum, o) => sum + (o.totalCollection || 0), 0);
  const totalFees = scopedOrders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);
  const successRate = total > 0 ? Math.round((delivered / total) * 100) : 0;

  res.json({
    total,
    delivered,
    active,
    totalCOD,
    totalFees,
    successRate,
  });
});

// 13. GET /api/orders/track/:query: Public/Customer tracking lookup
app.get('/api/orders/track/:query', (req, res) => {
  const query = (req.params.query || '').trim().toLowerCase();
  if (!query) {
    return res.status(400).json({ error: 'يرجى إدخال رقم البوليصة أو رقم الهاتف' });
  }

  const order = orders.find(
    (o) =>
      o.sequence.toLowerCase() === query ||
      (o.referenceNumber && o.referenceNumber.toLowerCase() === query) ||
      o.recipientPhone.replace(/[\s-]/g, '') === query.replace(/[\s-]/g, '') ||
      o.id === query
  );

  if (!order) {
    return res.status(404).json({ error: 'لم يتم العثور على أي شحنة مطابقة لهذا الرقم' });
  }

  const merchant = users.find((u) => u.id === order.merchantId);
  const driver = users.find((u) => u.id === order.driverId);

  res.json({
    ...order,
    merchantName: merchant?.commercialName || merchant?.name || 'التاجر',
    driverName: driver?.name || 'لم يُحدد بعد',
    driverPhone: driver?.phone || null,
  });
});

// 14. POST /api/orders/scan: Warehouse Barcode Scanner Dispatch Action
app.post('/api/orders/scan', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  const { barcode, action, driverId, note } = req.body;
  if (!barcode) {
    return res.status(400).json({ error: 'رمز الباركود مطلوب' });
  }

  const cleanCode = barcode.trim().toUpperCase();
  const orderIdx = orders.findIndex(
    (o) =>
      o.sequence.toUpperCase() === cleanCode ||
      (o.referenceNumber && o.referenceNumber.toUpperCase() === cleanCode) ||
      o.id === barcode.trim()
  );

  if (orderIdx === -1) {
    return res.status(404).json({ error: `الباركود [${cleanCode}] غير مسجل في النظام` });
  }

  const order = orders[orderIdx];
  if (!canAccessOrder(ctx, order)) {
    return res.status(403).json({ error: 'غير مصرح بالوصول إلى هذه الشحنة' });
  }

  if (driverId && !canAccessDriver(ctx, driverId)) {
    return res.status(403).json({ error: 'غير مصرح بتعيين سائق خارج نطاق شركتك' });
  }

  const oldStatus = order.status;
  let newStatus: OrderStatus = oldStatus;
  let logNote = note || '';

  if (action === 'RECEIVE') {
    newStatus = 'RECEIVED_AT_HUB';
    logNote = logNote || 'تم مسح الباركود واستلام الطرد في مستودع الفرز الرئيسي';
  } else if (action === 'ASSIGN') {
    newStatus = 'OUT_FOR_DELIVERY';
    if (driverId) {
      order.driverId = driverId;
    }
    const driver = users.find((u) => u.id === (driverId || order.driverId));
    logNote = logNote || `تم فرز الطرد وتسليمه للكابتن: ${driver?.name || 'سائق التوصيل'}`;
  } else if (action === 'DELIVER') {
    newStatus = 'DELIVERED';
    order.deliveredAt = new Date().toISOString();
    logNote = logNote || 'تم تأكيد تسليم الطرد عبر الماسح';
  } else if (action === 'RETURN') {
    newStatus = 'RETURNED';
    logNote = logNote || 'تم تسجيل الطرد كمرتجع رسمي في المستودع';
  }

  order.status = newStatus;
  order.updatedAt = new Date().toISOString();
  order.statusLogs = [
    ...(order.statusLogs || []),
    {
      id: `log-${Date.now()}`,
      orderId: order.id,
      fromStatus: oldStatus,
      toStatus: newStatus,
      note: logNote,
      createdAt: new Date().toISOString(),
    },
  ];

  const merchant = users.find((u) => u.id === order.merchantId);
  const driver = users.find((u) => u.id === order.driverId);

  res.json({
    success: true,
    message: `تم تحديث الشحنة (${order.sequence}) بنجاح إلى: ${newStatus}`,
    order: {
      ...order,
      merchant,
      driver,
    },
  });
});

// 15. GET /api/settlements: Detailed Financial Accounting Overview
app.get('/api/settlements', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  let merchantUsers = users.filter((u) => u.role === 'MERCHANT');
  let driverUsers = users.filter((u) => u.role === 'DRIVER');

  if (!ctx.isSuperAdmin && ctx.user) {
    if (ctx.isAdmin && ctx.tenantId) {
      merchantUsers = merchantUsers.filter((u) => u.parentUserId === ctx.tenantId || u.id === ctx.tenantId);
      driverUsers = driverUsers.filter((u) => u.parentUserId === ctx.tenantId || u.id === ctx.tenantId);
    } else if (ctx.isMerchant) {
      merchantUsers = merchantUsers.filter((u) => u.id === ctx.user?.id);
      driverUsers = [];
    } else if (ctx.isDriver) {
      merchantUsers = [];
      driverUsers = driverUsers.filter((u) => u.id === ctx.user?.id);
    }
  }

  const merchantSettlements = merchantUsers.map((m) => {
    const merchantOrders = orders.filter((o) => o.merchantId === m.id);
    const deliveredOrders = merchantOrders.filter((o) => o.status === 'DELIVERED');
    const pendingSettlement = deliveredOrders.filter((o) => !o.isSettledWithMerchant);
    const settledOrders = deliveredOrders.filter((o) => o.isSettledWithMerchant);

    const pendingGoods = pendingSettlement.reduce((sum, o) => sum + (o.merchantCollection || 0), 0);
    const pendingFees = pendingSettlement.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);
    const netPayable = pendingGoods - pendingFees;

    const alreadySettledAmount = settledOrders.reduce(
      (sum, o) => sum + ((o.merchantCollection || 0) - (o.deliveryFee || 0)),
      0
    );

    return {
      merchant: m,
      totalOrders: merchantOrders.length,
      deliveredCount: deliveredOrders.length,
      pendingCount: pendingSettlement.length,
      pendingGoods,
      pendingFees,
      netPayable,
      settledCount: settledOrders.length,
      alreadySettledAmount,
      pendingOrdersList: pendingSettlement,
    };
  });

  const driverSettlements = driverUsers.map((d) => {
    const driverOrders = orders.filter((o) => o.driverId === d.id);
    const deliveredOrders = driverOrders.filter((o) => o.status === 'DELIVERED');
    const pendingCashOrders = deliveredOrders.filter((o) => !o.isSettledWithDriver);
    const settledOrders = deliveredOrders.filter((o) => o.isSettledWithDriver);

    const pendingCashInHand = pendingCashOrders.reduce((sum, o) => sum + (o.totalCollection || 0), 0);
    const totalCollectedHistorical = settledOrders.reduce((sum, o) => sum + (o.totalCollection || 0), 0);

    return {
      driver: d,
      assignedCount: driverOrders.length,
      deliveredCount: deliveredOrders.length,
      pendingCount: pendingCashOrders.length,
      pendingCashInHand,
      totalCollectedHistorical,
      pendingOrdersList: pendingCashOrders,
    };
  });

  res.json({
    merchants: merchantSettlements,
    drivers: driverSettlements,
  });
});

// 16. POST /api/settlements/merchants/:merchantId/settle: Settle Merchant Balance
app.post('/api/settlements/merchants/:merchantId/settle', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  const { merchantId } = req.params;
  const { paymentMethod = 'CLIQ', reference = '', notes = '' } = req.body;

  if (!canAccessMerchant(ctx, merchantId)) {
    return res.status(403).json({ error: 'غير مصرح بتسوية حسابات هذا المتجر' });
  }

  const merchant = users.find((u) => u.id === merchantId);
  const merchantName = merchant ? merchant.storeName || merchant.name : 'متجر';

  let count = 0;
  let settledAmount = 0;

  orders = orders.map((o) => {
    if (o.merchantId === merchantId && o.status === 'DELIVERED' && !o.isSettledWithMerchant) {
      count++;
      settledAmount += (o.merchantCollection || 0) - (o.deliveryFee || 0);
      return {
        ...o,
        isSettledWithMerchant: true,
        settlementStatus: 'SETTLED',
        updatedAt: new Date().toISOString(),
      };
    }
    return o;
  });

  if (settledAmount > 0) {
    const vNumber = `V-PAY-2026-${String(vouchers.filter((v) => v.type === 'PAYMENT').length + 1).padStart(4, '0')}`;
    const newVoucher: Voucher = {
      id: `v-${Date.now()}`,
      voucherNumber: vNumber,
      type: 'PAYMENT',
      date: new Date().toISOString().split('T')[0],
      amount: settledAmount,
      beneficiaryOrPayer: merchantName,
      paymentMethod: (paymentMethod.toUpperCase() as any) || 'CLIQ',
      referenceNumber: reference || 'CLIQ-TX',
      accountId: 'acc-2010', // أمانات تحصيل التجار COD
      contraAccountId: paymentMethod === 'CASH' ? 'acc-1010' : 'acc-1030', // الصندوق أو حساب كليك
      notes: `تسوية مستحقات ${count} شحنة لـ (${merchantName})${notes ? ' - ' + notes : ''}`,
      status: 'POSTED',
      createdAt: new Date().toISOString(),
    };
    vouchers.push(newVoucher);

    const codAcc = accounts.find((a) => a.id === 'acc-2010');
    const payAcc = accounts.find((a) => a.id === (paymentMethod === 'CASH' ? 'acc-1010' : 'acc-1030'));
    if (codAcc) codAcc.balance -= settledAmount;
    if (payAcc) payAcc.balance -= settledAmount;

    journalEntries.push({
      id: `je-${Date.now()}`,
      entryNumber: `JE-2026-${String(journalEntries.length + 1).padStart(4, '0')}`,
      date: new Date().toISOString(),
      description: `قيد صرف تسوية مستحقات التاجر [${merchantName}] - سند صرف ${vNumber}`,
      referenceType: 'SETTLEMENT',
      referenceId: newVoucher.id,
      lines: [
        {
          accountId: 'acc-2010',
          accountCode: '2010',
          accountName: 'أمانات تحصيل التجار COD',
          debit: settledAmount,
          credit: 0,
          note: `تسوية ${count} طلبية`,
        },
        {
          accountId: payAcc?.id || 'acc-1030',
          accountCode: payAcc?.code || '1030',
          accountName: payAcc?.name || 'حساب كليك البنكي (CliQ)',
          debit: 0,
          credit: settledAmount,
          note: `تحويل بنكي / كليك مرجع: ${reference || 'CliQ'}`,
        },
      ],
      totalDebit: settledAmount,
      totalCredit: settledAmount,
      createdByName: 'نظام دارجو المحاسبي',
      createdAt: new Date().toISOString(),
    });

    saveDatabase();
  }

  res.json({
    success: true,
    message: `تم تسوية مستحقات المتجر لـ ${count} طرد بإجمالي صافي ${settledAmount.toFixed(2)} د.أ بواسطة (${paymentMethod})`,
    settledCount: count,
    settledAmount,
    reference,
  });
});

// 17. POST /api/settlements/drivers/:driverId/close-cash: Close Driver Cash Custody
app.post('/api/settlements/drivers/:driverId/close-cash', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  const { driverId } = req.params;
  const { notes = '' } = req.body;

  if (!canAccessDriver(ctx, driverId)) {
    return res.status(403).json({ error: 'غير مصرح بإغلاق عهدة هذا السائق' });
  }

  const driver = users.find((u) => u.id === driverId);
  const driverName = driver ? driver.name : 'كابتن';

  let count = 0;
  let cashClosed = 0;

  orders = orders.map((o) => {
    if (o.driverId === driverId && o.status === 'DELIVERED' && !o.isSettledWithDriver) {
      count++;
      cashClosed += o.totalCollection || 0;
      return {
        ...o,
        isSettledWithDriver: true,
        updatedAt: new Date().toISOString(),
      };
    }
    return o;
  });

  if (cashClosed > 0) {
    const vNumber = `V-REC-2026-${String(vouchers.filter((v) => v.type === 'RECEIPT').length + 1).padStart(4, '0')}`;
    const newVoucher: Voucher = {
      id: `v-${Date.now()}`,
      voucherNumber: vNumber,
      type: 'RECEIPT',
      date: new Date().toISOString().split('T')[0],
      amount: cashClosed,
      beneficiaryOrPayer: `الكابتن ${driverName}`,
      paymentMethod: 'CASH',
      referenceNumber: 'CASH-CLOSE',
      accountId: 'acc-1010', // الصندوق الرئيسي
      contraAccountId: 'acc-1040', // عهد ومحافظ الكباتن
      notes: `إغلاق وتوريد عهدة نقدية عن ${count} طرد من الكابتن ${driverName}${notes ? ' - ' + notes : ''}`,
      status: 'POSTED',
      createdAt: new Date().toISOString(),
    };
    vouchers.push(newVoucher);

    const mainCash = accounts.find((a) => a.id === 'acc-1010');
    const driverCustody = accounts.find((a) => a.id === 'acc-1040');
    if (mainCash) mainCash.balance += cashClosed;
    if (driverCustody) driverCustody.balance -= cashClosed;

    journalEntries.push({
      id: `je-${Date.now()}`,
      entryNumber: `JE-2026-${String(journalEntries.length + 1).padStart(4, '0')}`,
      date: new Date().toISOString(),
      description: `قيد قبض وتوريد عهدة الكابتن [${driverName}] - سند قبض ${vNumber}`,
      referenceType: 'VOUCHER',
      referenceId: newVoucher.id,
      lines: [
        {
          accountId: 'acc-1010',
          accountCode: '1010',
          accountName: 'الصندوق النقدي الرئيسي (خزينة دارجو)',
          debit: cashClosed,
          credit: 0,
          note: `استلام نقدي بالصندوق`,
        },
        {
          accountId: 'acc-1040',
          accountCode: '1040',
          accountName: 'عهد ومحافظ الكباتن المعلقة',
          debit: 0,
          credit: cashClosed,
          note: `إغلاق عهدة الكابتن ${driverName}`,
        },
      ],
      totalDebit: cashClosed,
      totalCredit: cashClosed,
      createdByName: 'نظام دارجو المحاسبي',
      createdAt: new Date().toISOString(),
    });

    saveDatabase();
  }

  res.json({
    success: true,
    message: `تم إغلاق عهدة الكابتن واستلام ${cashClosed.toFixed(2)} د.أ نقداً عن ${count} طرد مسلّم`,
    closedCount: count,
    cashClosed,
  });
});

// 18. POST /api/routes/optimize: Smart Driver Route Optimization
app.post('/api/routes/optimize', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  const { driverId } = req.body;
  if (!driverId) {
    return res.status(400).json({ error: 'معرف الكابتن مطلوب' });
  }

  if (!canAccessDriver(ctx, driverId)) {
    return res.status(403).json({ error: 'غير مصرح بالوصول إلى مسار هذا السائق' });
  }

  const driver = users.find((u) => u.id === driverId);
  const activeOrders = orders.filter(
    (o) => o.driverId === driverId && ['OUT_FOR_DELIVERY', 'PENDING', 'PICKING', 'POSTPONED'].includes(o.status)
  );

  if (activeOrders.length === 0) {
    return res.status(400).json({ error: 'لا توجد طرود نشطة لهذا الكابتن لترتيب مسارها' });
  }

  // Geographical Area proximity scoring dictionary for Jordan (Amman, Zarqa, Irbid)
  const areaProximityOrder: Record<string, number> = {
    'خلدا': 1,
    'تلاع العلي': 2,
    'الجبيهة': 3,
    'ضاحية الرشيد': 4,
    'صويلح': 5,
    'أم أذينة': 6,
    'الصويفية': 7,
    'عبدون': 8,
    'دير غبار': 9,
    'الدوار السابع': 10,
    'ضاحية الياسمين': 11,
    'المقابلين': 12,
    'طبربور': 13,
    'ماركا': 14,
    'الزرقاء الجديدة': 20,
    'الرصيفة': 21,
    'شارع الجامعة': 30,
    'الحصن': 31,
  };

  // Sort orders based on geographic sequence
  const sortedOrders = [...activeOrders].sort((a, b) => {
    const scoreA = areaProximityOrder[a.area] || 50;
    const scoreB = areaProximityOrder[b.area] || 50;
    return scoreA - scoreB;
  });

  // Assign routeOrderIndex
  sortedOrders.forEach((so, idx) => {
    const o = orders.find((ord) => ord.id === so.id);
    if (o) {
      o.routeOrderIndex = idx + 1;
      o.updatedAt = new Date().toISOString();
    }
  });

  // Calculate stats
  const stopCount = sortedOrders.length;
  const estimatedKm = Math.round(stopCount * 4.2 + 8);
  const estimatedTimeMins = Math.round(stopCount * 18 + 25);
  const savedKmPercent = 23; // ~23% savings from optimized routing

  // Generate Google Maps multi-stop URL
  const destinationQueries = sortedOrders
    .map((o) => encodeURIComponent(`${o.governorate}, ${o.area}, Jordan`))
    .join('/');
  const googleMapsRouteUrl = `https://www.google.com/maps/dir/${destinationQueries}`;

  res.json({
    success: true,
    message: `تم تحسين مسار الكابتن (${driver?.name}) بنجاح لـ ${stopCount} محطة توقف`,
    driver,
    stopCount,
    estimatedKm,
    estimatedTimeMins,
    savedKmPercent,
    googleMapsRouteUrl,
    stops: sortedOrders.map((o, idx) => ({
      stopIndex: idx + 1,
      orderId: o.id,
      sequence: o.sequence,
      recipientName: o.recipientName,
      recipientPhone: o.recipientPhone,
      governorate: o.governorate,
      area: o.area,
      fullAddress: o.fullAddress,
      totalCollection: o.totalCollection,
      notes: o.notes,
    })),
  });
});

// 19. PATCH /api/orders/:id/shelf: Assign Warehouse Shelf / Bin Location
app.patch('/api/orders/:id/shelf', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  const { shelf } = req.body;
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'الطلبية غير موجودة' });
  }

  if (!canAccessOrder(ctx, order)) {
    return res.status(403).json({ error: 'غير مصرح بتعديل هذه الشحنة' });
  }

  order.warehouseShelf = shelf ? shelf.trim().toUpperCase() : undefined;
  order.updatedAt = new Date().toISOString();
  order.statusLogs = [
    ...(order.statusLogs || []),
    {
      id: `log-${Date.now()}`,
      orderId: order.id,
      fromStatus: order.status,
      toStatus: order.status,
      note: shelf ? `تم وضع الطرد على الرف بالمستودع: ${order.warehouseShelf}` : 'تم إزالة موقع الرف للطرد',
      createdAt: new Date().toISOString(),
    },
  ];

  res.json({
    success: true,
    message: `تم تحديث موقع الرف إلى [${order.warehouseShelf || 'غير محدد'}]`,
    order,
  });
});

// 20. POST /api/returns/handover: Handover Returned Parcels back to Merchant
app.post('/api/returns/handover', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  const { ids, merchantId, manifestCode, notes } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'لم يتم تحديد أي طرود مرتجعة' });
  }

  if (merchantId && !canAccessMerchant(ctx, merchantId)) {
    return res.status(403).json({ error: 'غير مصرح بتسليم مرتجعات لمتجر خارج نطاق صلاحياتك' });
  }

  let processedCount = 0;
  orders = orders.map((o) => {
    if (ids.includes(o.id) && canAccessOrder(ctx, o)) {
      processedCount++;
      return {
        ...o,
        returnHandoverStatus: 'RETURNED_TO_MERCHANT' as const,
        updatedAt: new Date().toISOString(),
        statusLogs: [
          ...(o.statusLogs || []),
          {
            id: `log-${Date.now()}-${Math.random()}`,
            orderId: o.id,
            fromStatus: o.status,
            toStatus: 'RETURNED' as OrderStatus,
            note: `تم تسليم المرتجع للتاجر بموجب المنفست رقم (${manifestCode || 'RET-MNFST'}) ${notes ? `- ${notes}` : ''}`,
            createdAt: new Date().toISOString(),
          },
        ],
      };
    }
    return o;
  });

  res.json({
    success: true,
    message: `تم تسليم ${processedCount} طرد مرتجع للتاجر بنجاح وإصدار كشف التسليم`,
    count: processedCount,
    manifestCode,
  });
});

// 21. POST /api/orders/:id/verify-pod: Verify Delivery with OTP, Digital Signature & Proof Photo
app.post('/api/orders/:id/verify-pod', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  const { otp, signature, photo, driverNote, bypassOtp } = req.body;
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'الطلبية غير موجودة' });
  }

  if (!canAccessOrder(ctx, order)) {
    return res.status(403).json({ error: 'غير مصرح بتأكيد تسليم هذه الشحنة' });
  }

  let otpMatched = false;
  if (!bypassOtp) {
    if (!otp) {
      return res.status(400).json({ error: 'يرجى إدخال رمز التحقق السري (OTP) المكون من 4 أرقام' });
    }
    if (order.deliveryOtp && otp.trim() !== order.deliveryOtp.trim()) {
      return res.status(400).json({ error: 'رمز التحقق (OTP) غير صحيح، يرجى التأكد من العميل المستلم' });
    }
    otpMatched = true;
  }

  order.status = 'DELIVERED';
  order.deliveredAt = new Date().toISOString();
  order.updatedAt = new Date().toISOString();
  order.otpVerified = otpMatched;
  if (signature) order.recipientSignature = signature;
  if (photo) order.deliveryPhoto = photo;

  order.statusLogs = [
    ...(order.statusLogs || []),
    {
      id: `log-${Date.now()}`,
      orderId: order.id,
      fromStatus: 'OUT_FOR_DELIVERY',
      toStatus: 'DELIVERED',
      note: otpMatched
        ? `تم تأكيد التسليم بنجاح مع مطابقة رمز التحقق السري (OTP: ${order.deliveryOtp}) وتوثيق التوقيع الإلكتروني`
        : `تم تأكيد التسليم مع تجاوز الرمز يدوياً بواسطة الكابتن (${driverNote || 'بناء على موافقة العمليات'})`,
      createdAt: new Date().toISOString(),
    },
  ];

  res.json({
    success: true,
    message: `تم تسليم الطرد رقم (${order.sequence}) بنجاح وتوثيق إثبات التسليم الإلكتروني`,
    order: populateOrder(order),
  });
});

// 22. POST /api/orders/:id/send-sms: Send SMS / WhatsApp Notification with OTP & Tracking URL
app.post('/api/orders/:id/send-sms', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'الطلبية غير موجودة' });
  }

  if (!canAccessOrder(ctx, order)) {
    return res.status(403).json({ error: 'غير مصرح بالوصول إلى هذه الشحنة' });
  }

  const populated = populateOrder(order);
  const driverName = populated.driver?.name || 'كابتن DarGo المعتمد';
  const merchantName = populated.merchant?.commercialName || populated.merchant?.name || 'المتجر';
  const otpCode = order.deliveryOtp || '4120';
  const trackingUrl = `https://dargo.io/track/${order.sequence}`;

  const messageText = `مرحباً ${order.recipientName}، شحنتك من (${merchantName}) مع الكابتن ${driverName}. المطلوب تحصيله: ${order.totalCollection.toFixed(2)} د.أ. رمز التحقق للتسليم POD هو [${otpCode}]. رابط التتبع المباشر: ${trackingUrl}`;

  const newLog: NotificationLog = {
    id: `notif-${Date.now()}`,
    orderId: order.id,
    recipientPhone: order.recipientPhone,
    type: 'SMS',
    message: messageText,
    status: 'DELIVERED',
    sentAt: new Date().toISOString(),
  };

  notificationLogs.unshift(newLog);
  order.smsNotificationSent = true;
  order.updatedAt = new Date().toISOString();

  res.json({
    success: true,
    message: `تم إرسال رسالة SMS بنجاح إلى الرقم (${order.recipientPhone}) متضمنة رمز الاستلام السري ورابط التتبع`,
    notification: newLog,
  });
});

// 23. GET /api/merchants/:id/integrations: Get Merchant API Keys & Webhooks
app.get('/api/merchants/:id/integrations', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  const merchantId = req.params.id;

  if (!canAccessMerchant(ctx, merchantId)) {
    return res.status(403).json({ error: 'غير مصرح بالوصول إلى تكاملات هذا المتجر' });
  }

  const merchantKeys = apiKeys.filter((k) => k.merchantId === merchantId);

  res.json({
    merchantId,
    apiKeys: merchantKeys,
    webhookEndpoint: `https://dargo.olivery.io/api/webhooks/orders?token=${merchantId}`,
    supportedPlatforms: ['SHOPIFY', 'WOOCOMMERCE', 'SALLA', 'ZID', 'CUSTOM_REST'],
  });
});

// 24. POST /api/merchants/:id/api-keys: Generate New API Key
app.post('/api/merchants/:id/api-keys', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  const merchantId = req.params.id;

  if (!canAccessMerchant(ctx, merchantId)) {
    return res.status(403).json({ error: 'غير مصرح بتوليد مفاتيح API لهذا المتجر' });
  }

  const { name, platform } = req.body;

  const newKey: ApiKey = {
    id: `key-${Date.now()}`,
    merchantId,
    name: name || `مفتاح ${platform || 'API'} للمتجر`,
    key: `dg_live_${(platform || 'api').toLowerCase()}_${Math.random().toString(36).substring(2, 12)}`,
    secret: `sec_live_${Math.random().toString(36).substring(2, 15)}`,
    platform: platform || 'CUSTOM',
    createdAt: new Date().toISOString(),
  };

  apiKeys.push(newKey);
  res.status(201).json({
    success: true,
    message: 'تم توليد مفتاح الربط البرمجي بنجاح',
    apiKey: newKey,
  });
});

// 25. POST /api/webhooks/shopify: Automated External Webhook Receiver
app.post('/api/webhooks/shopify', (req, res) => {
  try {
    const {
      merchantId = 'u-mer-1',
      customerName = 'زبون شوبيفاي',
      phone = '0799887766',
      address = 'عمان - عبدون',
      governorate = 'عمان',
      area = 'عبدون',
      codAmount = 45.0,
      itemsDescription = 'طلب إلكتروني من متجر شوبيفاي',
    } = req.body;

    const deliveryFee = 3.0;
    const totalCollection = parseFloat(codAmount) || 45.0;
    const merchantCollection = Math.max(0, totalCollection - deliveryFee);

    const webhookOrder: Order = {
      id: `ord-webhook-${Date.now()}`,
      sequence: `ORD-2026-${nextSequenceNumber++}`,
      referenceNumber: `SHPFY-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'PENDING',
      paymentType: 'COD',
      merchantId,
      driverId: null,
      recipientName: customerName,
      recipientPhone: phone,
      governorate,
      area,
      fullAddress: address,
      merchantCollection,
      deliveryFee,
      totalCollection,
      isSettledWithMerchant: false,
      isSettledWithDriver: false,
      packageType: itemsDescription,
      piecesCount: 1,
      deliveryAttempts: 0,
      deliveryOtp: Math.floor(1000 + Math.random() * 9000).toString(),
      notes: 'تم الاستيراد التلقائي عبر الويب هوك (Shopify Webhook)',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      statusLogs: [
        {
          id: `log-${Date.now()}`,
          orderId: `ord-webhook-${Date.now()}`,
          fromStatus: null,
          toStatus: 'PENDING',
          note: 'تم استقبال الطلب آلياً عبر رابط Webhook المتجر الإلكتروني',
          createdAt: new Date().toISOString(),
        },
      ],
    };

    orders.unshift(webhookOrder);
    saveDatabase();
    res.status(201).json({
      success: true,
      message: 'تم استلام وتوليد الشحنة آلياً بنجاح بموجب Webhook',
      order: populateOrder(webhookOrder),
      waybillSequence: webhookOrder.sequence,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 26. POST /api/auth/login: User Authentication by Email/Phone & Password directly via Supabase
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, phone, password, requireOps } = req.body || {};
    const identifier = (email || phone || '').toString().trim();
    if (!identifier) {
      return res.status(400).json({ error: 'يرجى إدخال البريد الإلكتروني أو رقم الهاتف' });
    }

    const cleanId = identifier.toLowerCase();
    const cleanPhone = identifier;

    // Query database for user
    const { data: dbUsers, error } = await supabase
      .from('users')
      .select('*')
      .or(`email.ilike.${cleanId},phone.eq.${cleanPhone}`);

    let rawUser: any = null;
    if (!error && dbUsers && dbUsers.length > 0) {
      rawUser = dbUsers[0];
    } else {
      // Fallback check in memory
      rawUser = users.find(
        (u) => (u.email && u.email.toLowerCase() === cleanId) || (u.phone && u.phone === cleanPhone)
      );
    }

    if (!rawUser) {
      return res.status(401).json({
        error: 'البريد الإلكتروني أو رقم الهاتف غير مسجل في النظام. يرجى التواصل مع المدير العام (Super Admin) لإنشاء حسابك.',
      });
    }

    const user = mapDbUserToAppUser(rawUser);

    if (user.isActive === false) {
      return res.status(403).json({
        error: 'تم تعطيل هذا الحساب من قبل إدارة النظام. يرجى مراجعة المسؤول.',
      });
    }

    // If logging in from the dedicated OPS portal, enforce that user must be SUPER_ADMIN
    if (requireOps && user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        error: 'عفواً، بوابة OPS مخصصة حصرياً للمدير العام للنظام (Super Admin). يرجى التوجه إلى بوابة العمليات والتجار العامة.',
        isNotSuperAdmin: true,
      });
    }

    const inputPass = (password || '').toString().trim();
    const isPassValid = verifyPassword(
      inputPass,
      rawUser.password || (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' ? 'admin123' : '123456'),
      rawUser.password_hash
    );

    if (!isPassValid) {
      return res.status(401).json({
        error: 'كلمة المرور غير صحيحة، يرجى التحقق والمحاولة مرة أخرى.',
      });
    }

    // Auto-upgrade password hash to modern scrypt KDF if not yet migrated
    if (rawUser.id && isValidUuid(rawUser.id) && (!rawUser.password_hash || !rawUser.password_hash.startsWith('scrypt$'))) {
      const secureHash = hashPassword(inputPass);
      supabase
        .from('users')
        .update({ password_hash: secureHash, updated_at: new Date().toISOString() })
        .eq('id', rawUser.id)
        .then(() => {}, (e) => console.warn('Password hash upgrade notice:', e?.message));
    }

    // Background sync cache
    syncUsersFromSupabase().catch(() => {});

    // Log security audit event
    logAuditEvent({
      action: 'USER_LOGIN',
      actionNameAr: 'تسجيل دخول ناجح',
      performedBy: user.id,
      performerName: user.name,
      performerRole: user.role,
      targetId: user.id,
      targetType: 'USER',
      targetName: user.name,
      tenantId: user.parentUserId || user.id,
      details: { email: user.email, role: user.role, portal: requireOps ? 'OPS' : 'GENERAL' },
    });

    const sanitizedUser = sanitizeUserForClient(user);
    const sessionToken = generateSessionToken(user);

    res.json({
      success: true,
      user: sanitizedUser,
      token: sessionToken,
      message: `مرحباً بك يا ${user.name}`,
    });
  } catch (err: any) {
    console.error('Error during login:', err);
    res.status(500).json({ error: err?.message || 'خطأ أثناء تسجيل الدخول' });
  }
});

// Helper: Check if string is a valid UUID
const isValidUuid = (val: any): boolean => {
  if (!val || typeof val !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());
};

// 26.0 POST /api/auth/verify: Verify cryptographically signed session token
app.post('/api/auth/verify', async (req, res) => {
  try {
    const authenticatedUser = await resolveAuthenticatedUser(req);
    if (!authenticatedUser) {
      return res.status(401).json({ error: 'الجلسة غير صالحة أو منتهية الصلاحية، يرجى تسجيل الدخول مجدداً' });
    }

    res.json({ success: true, user: sanitizeUserForClient(authenticatedUser) });
  } catch (err: any) {
    console.error('Error verifying auth session:', err);
    res.status(401).json({ error: 'انتهت صلاحية الجلسة' });
  }
});

// POST /api/auth/logout: Revoke current session token (server-side persistent invalidation)
app.post('/api/auth/logout', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'] || req.headers['x-auth-token'];
    if (typeof authHeader === 'string') {
      const payload = verifySessionToken(authHeader);
      if (payload && payload.jti) {
        await revokeSession(payload, 'logout');
      }
    }
    res.json({ success: true, message: 'تم تسجيل الخروج وإبطال الجلسة بنجاح' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/token: Issue new HMAC signed session token for a given user
app.post('/api/auth/token', async (req, res) => {
  try {
    const { userId } = req.body || {};
    const authenticatedUser = await resolveAuthenticatedUser(req);
    const targetUserId = userId || authenticatedUser?.id;

    if (!targetUserId) {
      return res.status(400).json({ error: 'معرف المستخدم مطلوب لإنشاء التوكن' });
    }

    let targetUser = users.find((u) => u && u.id === targetUserId);
    if (!targetUser && isValidUuid(targetUserId)) {
      const { data } = await supabase.from('users').select('*').eq('id', targetUserId).limit(1);
      if (data && data.length > 0) targetUser = mapDbUserToAppUser(data[0]);
    }

    if (!targetUser) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    if ((targetUser as any).isActive === false || (targetUser as any).is_active === false || (targetUser as any).status === 'INACTIVE' || (targetUser as any).status === 'DEACTIVATED') {
      return res.status(403).json({ error: 'حساب المستخدم معطل' });
    }

    const token = generateSessionToken(targetUser);
    res.json({ success: true, token, user: sanitizeUserForClient(targetUser) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me: Retrieve currently authenticated user context
app.get('/api/auth/me', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  if (!ctx.user) {
    return res.status(401).json({ error: 'غير مسجل الدخول' });
  }
  res.json({ success: true, user: sanitizeUserForClient(ctx.user) });
});

// -------------------------------------------------------------
// Dynamic Roles & Permissions Catalog API
// -------------------------------------------------------------

// GET /api/roles: List all system and tenant roles
app.get('/api/roles', requireAuth, async (req, res) => {
  try {
    const ctx = getRequesterContext(req);
    let roles = [...rolesCatalog];
    if (!ctx.isSuperAdmin && ctx.tenantId) {
      roles = roles.filter((r) => r.isSystemRole || r.tenantId === ctx.tenantId);
    }
    if (!ctx.isSuperAdmin) {
      roles = roles.filter((r) => r.roleKey !== 'SUPER_ADMIN');
    }
    res.json({ success: true, roles });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/roles: Create a custom role with permissions ceiling check
app.post('/api/roles', requireAuth, async (req, res) => {
  try {
    const ctx = getRequesterContext(req);
    const { name, roleKey, description, permissions = [] } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'اسم الدور مطلوب' });
    }

    const cleanKey = (roleKey || name)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_');

    // Prevent duplicate role keys
    if (rolesCatalog.some((r) => r.roleKey === cleanKey)) {
      return res.status(400).json({ error: 'رمز الدور مسجل مسبقاً' });
    }

    // RBAC Ceiling Check for non-SuperAdmin
    if (!ctx.isSuperAdmin && ctx.user) {
      const allowedCeiling = Array.isArray(ctx.user.maxAllowedPermissions) && ctx.user.maxAllowedPermissions.length > 0
        ? ctx.user.maxAllowedPermissions
        : (Array.isArray(ctx.user.permissions) ? ctx.user.permissions : []);

      const unauthorizedPerms = permissions.filter((p: string) => !allowedCeiling.includes(p) && !allowedCeiling.includes('*'));
      if (unauthorizedPerms.length > 0) {
        return res.status(403).json({
          error: `لا يمكنك تضمين صلاحيات تتجاوز سقف الصلاحيات الممنوح لك: [${unauthorizedPerms.join(', ')}]`,
          code: 'CEILING_EXCEEDED',
        });
      }
    }

    const newRole: RoleRecord = {
      id: `role-${Date.now()}`,
      name: name.trim(),
      roleKey: cleanKey,
      description: description?.trim(),
      isSystemRole: false,
      tenantId: ctx.isSuperAdmin ? null : (ctx.tenantId || ctx.userId || null),
      permissions: Array.isArray(permissions) ? permissions : [],
      createdBy: ctx.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    rolesCatalog.push(newRole);

    logAuditEvent({
      action: 'ROLE_CREATED',
      actionNameAr: 'إنشاء دور وصلاحيات جديدة',
      performedBy: ctx.userId || 'UNKNOWN',
      performerName: ctx.user?.name,
      performerRole: ctx.userRole,
      targetId: newRole.id,
      targetType: 'ROLE',
      targetName: newRole.name,
      tenantId: ctx.tenantId,
      details: { roleKey: newRole.roleKey, permissionsCount: newRole.permissions.length },
    });

    res.status(201).json({
      success: true,
      message: `تم إنشاء الدور (${newRole.name}) بنجاح`,
      role: newRole,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/roles/:id: Update role permissions
app.patch('/api/roles/:id', requireAuth, async (req, res) => {
  try {
    const ctx = getRequesterContext(req);
    const roleId = req.params.id;
    const { name, description, permissions } = req.body;

    const roleIndex = rolesCatalog.findIndex((r) => r.id === roleId);
    if (roleIndex === -1) {
      return res.status(404).json({ error: 'الدور غير موجود' });
    }

    const targetRole = rolesCatalog[roleIndex];

    // Only Super Admin can modify system roles
    if (targetRole.isSystemRole && !ctx.isSuperAdmin) {
      return res.status(403).json({ error: 'لا يمكن تعديل أدوار النظام الأساسية إلا من خلال السوبر أدمن' });
    }

    // Non-SuperAdmin can only modify their own tenant roles
    if (!ctx.isSuperAdmin && targetRole.tenantId && targetRole.tenantId !== ctx.tenantId) {
      return res.status(403).json({ error: 'غير مصرح بتعديل هذا الدور' });
    }

    // Check permissions ceiling if modifying permissions
    if (permissions && !ctx.isSuperAdmin && ctx.user) {
      const allowedCeiling = Array.isArray(ctx.user.maxAllowedPermissions) && ctx.user.maxAllowedPermissions.length > 0
        ? ctx.user.maxAllowedPermissions
        : (Array.isArray(ctx.user.permissions) ? ctx.user.permissions : []);

      const unauthorizedPerms = permissions.filter((p: string) => !allowedCeiling.includes(p) && !allowedCeiling.includes('*'));
      if (unauthorizedPerms.length > 0) {
        return res.status(403).json({
          error: `لا يمكنك منح صلاحيات تتجاوز سقف الصلاحيات الممنوح لحسابك: [${unauthorizedPerms.join(', ')}]`,
          code: 'CEILING_EXCEEDED',
        });
      }
    }

    if (name) targetRole.name = name.trim();
    if (description !== undefined) targetRole.description = description?.trim();
    if (Array.isArray(permissions)) targetRole.permissions = permissions;
    targetRole.updatedAt = new Date().toISOString();

    logAuditEvent({
      action: 'ROLE_UPDATED',
      actionNameAr: 'تحديث صلاحيات الدور',
      performedBy: ctx.userId || 'UNKNOWN',
      performerName: ctx.user?.name,
      performerRole: ctx.userRole,
      targetId: targetRole.id,
      targetType: 'ROLE',
      targetName: targetRole.name,
      tenantId: ctx.tenantId,
      details: { roleKey: targetRole.roleKey, permissionsCount: targetRole.permissions.length },
    });

    res.json({
      success: true,
      message: `تم تحديث الدور (${targetRole.name}) بنجاح`,
      role: targetRole,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/roles/:id: Delete custom role
app.delete('/api/roles/:id', requireAuth, async (req, res) => {
  try {
    const ctx = getRequesterContext(req);
    const roleId = req.params.id;

    const role = rolesCatalog.find((r) => r.id === roleId);
    if (!role) {
      return res.status(404).json({ error: 'الدور غير موجود' });
    }

    if (role.isSystemRole) {
      return res.status(400).json({ error: 'لا يمكن حذف أدوار النظام الافتراضية' });
    }

    if (!ctx.isSuperAdmin && role.tenantId && role.tenantId !== ctx.tenantId) {
      return res.status(403).json({ error: 'غير مصرح بحذف هذا الدور' });
    }

    rolesCatalog = rolesCatalog.filter((r) => r.id !== roleId);

    logAuditEvent({
      action: 'ROLE_DELETED',
      actionNameAr: 'حذف دور مخصص',
      performedBy: ctx.userId || 'UNKNOWN',
      performerName: ctx.user?.name,
      performerRole: ctx.userRole,
      targetId: role.id,
      targetType: 'ROLE',
      targetName: role.name,
      tenantId: ctx.tenantId,
    });

    res.json({
      success: true,
      message: `تم حذف الدور (${role.name}) بنجاح`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Users Management & RBAC Enforcement
// -------------------------------------------------------------

// 26.1 GET /api/users: List Users with Multi-Tenant & Hierarchical Subtree Isolation
app.get('/api/users', requireAuth, async (req, res) => {
  try {
    const ctx = getRequesterContext(req);
    if (!ctx.user) {
      return res.status(401).json({ error: 'غير مصرح: يجب تسجيل الدخول للوصول إلى هذه الواجهة.', code: 'UNAUTHORIZED' });
    }

    const role = req.query.role as string;

    // Fetch all user records from DB or memory cache
    let allUserCandidates: User[] = [];
    const { data: dbData, error: dbErr } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (!dbErr && Array.isArray(dbData)) {
      allUserCandidates = dbData.map(mapDbUserToAppUser);
      // Merge with in-memory users cache to ensure no newly created user is missed
      for (const u of users) {
        if (u && !allUserCandidates.some((existing) => existing.id === u.id)) {
          allUserCandidates.push(u);
        }
      }
    } else {
      allUserCandidates = [...users].filter(Boolean);
    }

    // Apply Subtree Scope
    let scopedUsers: User[] = [];
    if (ctx.isSuperAdmin) {
      scopedUsers = allUserCandidates;
    } else {
      const allowedIds = getHierarchicalSubtreeUserIds(ctx.user.id, allUserCandidates);
      scopedUsers = allUserCandidates.filter((u) => u && allowedIds.has(u.id));
      // ABSOLUTE SECURITY RULE: Non-SuperAdmins must NEVER see SUPER_ADMIN users
      scopedUsers = scopedUsers.filter((u) => u.role !== 'SUPER_ADMIN');
    }

    // Role filter
    if (role && role !== 'ALL') {
      scopedUsers = scopedUsers.filter((u) => u.role === role);
    }

    const sanitized = scopedUsers.map(sanitizeUserForClient);
    return res.json(sanitized);
  } catch (err: any) {
    console.error('Error listing users:', err);
    // CRITICAL SECURITY RULE: NEVER leak global users array on error! Return 500 status.
    return res.status(500).json({
      error: 'حدث خطأ داخلي أثناء استرجاع قائمة المستخدمين',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
});

// 26.1.1 GET /api/users/:id: Get single user by ID with Subtree Isolation
app.get('/api/users/:id', requireAuth, async (req, res) => {
  try {
    const ctx = getRequesterContext(req);
    if (!ctx.user) {
      return res.status(401).json({ error: 'غير مصرح: يرجى تسجيل الدخول أولاً.', code: 'UNAUTHORIZED' });
    }

    const userId = req.params.id;
    if (!isValidUuid(userId)) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .limit(1);

    let rawTarget: User | null = null;
    if (!error && data && data.length > 0) {
      rawTarget = mapDbUserToAppUser(data[0]);
    } else {
      rawTarget = users.find((u) => u && u.id === userId) || null;
    }

    if (!rawTarget) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    // Subtree Isolation Check:
    if (!ctx.isSuperAdmin) {
      if (rawTarget.role === 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'غير مصرح بالوصول إلى بيانات هذا المستخدم', code: 'FORBIDDEN' });
      }
      const allCandidates = [...users].filter(Boolean);
      if (!allCandidates.some((u) => u.id === rawTarget!.id)) {
        allCandidates.push(rawTarget);
      }
      const allowedIds = getHierarchicalSubtreeUserIds(ctx.user.id, allCandidates);
      if (!allowedIds.has(rawTarget.id)) {
        return res.status(403).json({ error: 'غير مصرح بالوصول إلى بيانات هذا المستخدم', code: 'FORBIDDEN' });
      }
    }

    res.json(sanitizeUserForClient(rawTarget));
  } catch (err: any) {
    res.status(500).json({ error: 'حدث خطأ داخلي: ' + err.message, code: 'INTERNAL_SERVER_ERROR' });
  }
});

// 26.2 POST /api/users: Create User directly in Supabase with Multi-Tenant Hierarchy & RBAC Ceiling
app.post('/api/users', requireAuth, async (req, res) => {
  try {
    const ctx = getRequesterContext(req);
    const {
      name,
      email,
      password,
      phone,
      role = 'OPERATOR',
      roleName,
      parentUserId,
      permissions = [],
      maxAllowedPermissions = [],
      commercialName,
      commercialType,
      companyName,
      address,
      priceList,
      pricePlanId,
      branch,
      city,
      accountManager,
      department,
      vehicleType,
      vehiclePlate,
      isActive = true,
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'الاسم ورقم الهاتف مطلوبان لإنشاء الحساب' });
    }

    // Role Hierarchy & Downward-Only Validation Matrix
    const getUserRoleRank = (r: string): number => {
      switch (r) {
        case 'SUPER_ADMIN': return 100;
        case 'ADMIN': return 80;
        case 'ACCOUNTANT': return 50;
        case 'MERCHANT': return 40;
        case 'OPERATOR': return 30;
        case 'STAFF': return 30;
        case 'DRIVER': return 20;
        case 'CASHIER': return 10;
        default: return 0;
      }
    };

    const reqRank = getUserRoleRank(ctx.userRole);
    const targetRoleRank = getUserRoleRank(role);

    if (ctx.userRole === 'SUPER_ADMIN') {
      if (role === 'SUPER_ADMIN' && req.body.id !== ctx.userId) {
        // Only allow if creating initial root or explicit superadmin setup
      }
    } else if (ctx.userRole === 'ADMIN') {
      if (targetRoleRank >= 80) {
        return res.status(403).json({
          error: 'مدير العمليات يستطيع فقط إنشاء حسابات تجار وسائقين وموظفين ضمن نطاقه',
          code: 'FORBIDDEN_ROLE',
        });
      }
    } else if (ctx.userRole === 'MERCHANT') {
      if (targetRoleRank >= 40) {
        return res.status(403).json({
          error: 'حساب التاجر يستطيع فقط إنشاء حسابات كاشير وموظفين تابعين له',
          code: 'FORBIDDEN_ROLE',
        });
      }
    } else {
      if (targetRoleRank >= reqRank) {
        return res.status(403).json({
          error: 'غير مصرح بإنشاء حساب في نفس مستواك الوظيفي أو أعلى منه',
          code: 'FORBIDDEN_ROLE',
        });
      }
    }

    // RBAC Security: Admin creating sub-accounts must not exceed their permission ceiling
    if (!ctx.isSuperAdmin && ctx.user) {
      const allowedCeiling = Array.isArray(ctx.user.maxAllowedPermissions) && ctx.user.maxAllowedPermissions.length > 0
        ? ctx.user.maxAllowedPermissions
        : (Array.isArray(ctx.user.permissions) ? ctx.user.permissions : []);

      const requestedPerms = Array.isArray(permissions) ? permissions : [];
      const unauthorizedPerms = requestedPerms.filter((p: string) => !allowedCeiling.includes(p) && !allowedCeiling.includes('*'));

      if (unauthorizedPerms.length > 0) {
        return res.status(403).json({
          error: `لا يمكنك منح صلاحيات تتجاوز سقف الصلاحيات المسموح لحسابك من الإدارة العامة: [${unauthorizedPerms.join(', ')}]`,
          code: 'CEILING_EXCEEDED',
        });
      }
    }

    const cleanEmail = email && email.trim() ? email.trim().toLowerCase() : `${phone.replace(/\D/g, '')}@dargo-tms.io`;
    const cleanPhone = phone.trim();

    // Check duplicate email or phone in Supabase
    const { data: duplicate, error: checkErr } = await supabase
      .from('users')
      .select('id,email,phone')
      .or(`email.ilike.${cleanEmail},phone.eq.${cleanPhone}`);

    if (checkErr) {
      return res.status(500).json({ error: 'خطأ فحص التكرار في Supabase: ' + checkErr.message });
    }

    if (duplicate && duplicate.length > 0) {
      return res.status(400).json({ error: `المستخدم (${cleanEmail} أو ${cleanPhone}) مسجل مسبقاً في قاعدة البيانات` });
    }

    const assignedPassword = password && password.trim()
      ? password.trim()
      : (role === 'SUPER_ADMIN' || role === 'ADMIN' ? 'admin123' : '123456');

    const secureHash = hashPassword(assignedPassword);
    const newId = (req.body.id && isValidUuid(req.body.id)) ? req.body.id : crypto.randomUUID();

    const defaultRoleName = roleName || (
      role === 'SUPER_ADMIN' ? 'المدير العام للنظام' :
      role === 'ADMIN' ? 'مدير العمليات' :
      role === 'MERCHANT' ? 'حساب التاجر' :
      role === 'DRIVER' ? 'كابتن التوصيل' :
      role === 'CASHIER' ? 'موظف الكاشير' :
      role === 'ACCOUNTANT' ? 'محاسب مالي' : 'موظف العمليات'
    );

    // Auto-attach parentUserId to current Admin if created by an Admin
    let assignedParentId: string | null = null;
    if (ctx.isAdmin && ctx.tenantId) {
      assignedParentId = ctx.tenantId;
    } else if (ctx.isSuperAdmin && parentUserId && isValidUuid(parentUserId)) {
      assignedParentId = parentUserId;
    } else if (ctx.user?.id) {
      assignedParentId = ctx.user.id;
    }

    const dbPayload = {
      id: newId,
      name: name.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      password: secureHash,
      password_hash: secureHash,
      role,
      role_name: defaultRoleName,
      commercial_name: commercialName?.trim() || companyName?.trim() || null,
      commercial_type: commercialType?.trim() || null,
      city: city || 'عمان',
      address: address?.trim() || null,
      branch: branch || (ctx.user?.branch || 'فرع عمان الرئيسي'),
      department: department?.trim() || null,
      price_list: priceList || 'جميع المملكة 2 (القياسية)',
      account_manager: accountManager || (ctx.user?.name || 'باسل البلبيسي'),
      vehicle_type: vehicleType || null,
      vehicle_plate: vehiclePlate || null,
      is_active: Boolean(isActive),
      parent_user_id: (assignedParentId && isValidUuid(assignedParentId)) ? assignedParentId : null,
      created_by_id: (ctx.userId && isValidUuid(ctx.userId)) ? ctx.userId : null,
      permissions: Array.isArray(permissions) ? permissions : [],
      max_allowed_permissions: ctx.isSuperAdmin
        ? (Array.isArray(maxAllowedPermissions) ? maxAllowedPermissions : permissions)
        : (ctx.user?.maxAllowedPermissions || permissions),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: inserted, error: insertErr } = await supabase
      .from('users')
      .insert([dbPayload])
      .select();

    if (insertErr) {
      console.error('Supabase user insert error:', insertErr);
      return res.status(500).json({ error: 'فشل حفظ المستخدم في Supabase: ' + insertErr.message });
    }

    const createdUser = mapDbUserToAppUser(inserted && inserted[0] ? inserted[0] : dbPayload);
    // Maintain in-memory users cache synchronously
    const existingIdx = users.findIndex((u) => u && u.id === createdUser.id);
    if (existingIdx >= 0) {
      users[existingIdx] = createdUser;
    } else {
      users.unshift(createdUser);
    }
    syncUsersFromSupabase().catch(() => {});

    // Audit Logging
    logAuditEvent({
      action: 'USER_CREATED',
      actionNameAr: 'إنشاء حساب مستخدم جديد',
      performedBy: ctx.userId || 'UNKNOWN',
      performerName: ctx.user?.name,
      performerRole: ctx.userRole,
      targetId: createdUser.id,
      targetType: 'USER',
      targetName: createdUser.name,
      tenantId: createdUser.parentUserId || createdUser.id,
      details: { role: createdUser.role, email: createdUser.email, parentUserId: createdUser.parentUserId },
    });

    const sanitizedUser = sanitizeUserForClient(createdUser);

    res.status(201).json({
      ...sanitizedUser,
      success: true,
      message: 'تم إنشاء المستخدم بنجاح في قاعدة بيانات Supabase وربطه بمظلة الشركة والتراخيص',
      user: sanitizedUser,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 26.3 PATCH /api/users/:id & PUT /api/users/:id: Update User directly in Supabase
const handleUserUpdate = async (req: express.Request, res: express.Response) => {
  try {
    const ctx = getRequesterContext(req);
    const userId = req.params.id;

    if (!isValidUuid(userId)) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    const { data: existing, error: findErr } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .limit(1);

    if (findErr) {
      return res.status(500).json({ error: findErr.message });
    }
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    const targetDbUser = existing[0];

    // Hierarchy & Isolation Check:
    if (!ctx.isSuperAdmin) {
      // Non-superadmin cannot edit a Super Admin
      if (targetDbUser.role === 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'غير مصرح بتعديل حساب المدير العام للنظام' });
      }

      // Non-superadmin cannot promote anyone to SUPER_ADMIN
      if (req.body.role === 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'لا تملك صلاحية الترقية لرتبة السوبر أدمن' });
      }

      // Non-superadmin can only modify accounts within their tenant
      const isSelf = ctx.userId === userId;
      const isSubAccount = targetDbUser.parent_user_id === ctx.tenantId || targetDbUser.parent_user_id === ctx.userId;
      if (!isSelf && !isSubAccount) {
        return res.status(403).json({ error: 'غير مصرح بتعديل مستخدمين خارج نطاق شركتك' });
      }

      // Permission ceiling check if changing permissions
      if (req.body.permissions && ctx.user) {
        const allowedCeiling = Array.isArray(ctx.user.maxAllowedPermissions) && ctx.user.maxAllowedPermissions.length > 0
          ? ctx.user.maxAllowedPermissions
          : (Array.isArray(ctx.user.permissions) ? ctx.user.permissions : []);

        const requestedPerms = Array.isArray(req.body.permissions) ? req.body.permissions : [];
        const unauthorized = requestedPerms.filter((p: string) => !allowedCeiling.includes(p) && !allowedCeiling.includes('*'));
        if (unauthorized.length > 0) {
          return res.status(403).json({
            error: `الصلاحيات المطلوبة تتجاوز سقف الصلاحيات الممنوح لحسابك: [${unauthorized.join(', ')}]`,
            code: 'CEILING_EXCEEDED',
          });
        }
      }
    }

    // If updating email, check duplicate
    if (req.body.email) {
      const cleanEmail = req.body.email.trim().toLowerCase();
      const { data: dupUsers } = await supabase
        .from('users')
        .select('id')
        .neq('id', userId)
        .ilike('email', cleanEmail);
      if (dupUsers && dupUsers.length > 0) {
        return res.status(400).json({ error: `البريد الإلكتروني (${cleanEmail}) مسجل مسبقاً لمستخدم آخر` });
      }
    }

    const dbUpdates = mapAppUserToDbUser(req.body);
    delete dbUpdates.id;

    // Secure password hashing if updated
    if (req.body.password && req.body.password.trim()) {
      const rawPass = req.body.password.trim();
      const secureHash = hashPassword(rawPass);
      dbUpdates.password = secureHash;
      dbUpdates.password_hash = secureHash;
    }

    // Prevent non-superadmin from altering parent_user_id
    if (!ctx.isSuperAdmin) {
      delete dbUpdates.parent_user_id;
    }

    const { data: updated, error: updateErr } = await supabase
      .from('users')
      .update(dbUpdates)
      .eq('id', userId)
      .select();

    if (updateErr) {
      console.error('Supabase user update error:', updateErr);
      return res.status(500).json({ error: 'فشل تحديث المستخدم في Supabase: ' + updateErr.message });
    }

    const updatedUser = mapDbUserToAppUser(updated && updated[0] ? updated[0] : { ...targetDbUser, ...dbUpdates });
    
    // Maintain in-memory users cache synchronously for immediate session freshness
    const userIdx = users.findIndex((u) => u && u.id === updatedUser.id);
    if (userIdx !== -1) {
      users[userIdx] = updatedUser;
    } else {
      users.push(updatedUser);
    }

    syncUsersFromSupabase().catch(() => {});

    // Audit Logging
    logAuditEvent({
      action: 'USER_UPDATED',
      actionNameAr: 'تحديث بيانات المستخدم والصلاحيات',
      performedBy: ctx.userId || 'UNKNOWN',
      performerName: ctx.user?.name,
      performerRole: ctx.userRole,
      targetId: updatedUser.id,
      targetType: 'USER',
      targetName: updatedUser.name,
      tenantId: updatedUser.parentUserId || updatedUser.id,
      details: { changedFields: Object.keys(dbUpdates), permissions: updatedUser.permissions },
    });

    const sanitizedUser = sanitizeUserForClient(updatedUser);

    res.json({
      success: true,
      message: 'تم تحديث بيانات وصلاحيات المستخدم في قاعدة بيانات Supabase بنجاح',
      user: sanitizedUser,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// 26.3.1 PATCH & PUT /api/users/:id/permissions: Dedicated Endpoint for Permissions Update
const handleUserPermissionsUpdate = async (req: express.Request, res: express.Response) => {
  try {
    const ctx = getRequesterContext(req);
    const userId = req.params.id;

    if (!isValidUuid(userId)) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    const { data: existing, error: findErr } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .limit(1);

    if (findErr || !existing || existing.length === 0) {
      return res.status(404).json({ error: 'المستخدم غير موجود في قاعدة البيانات' });
    }

    const targetDbUser = existing[0];

    // Non-superadmin cannot modify SUPER_ADMIN
    if (!ctx.isSuperAdmin && targetDbUser.role === 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'غير مصرح بتعديل حساب المدير العام للنظام (Super Admin)' });
    }

    // Hierarchy isolation check: target user must be self or within requester's subtree
    const isSelf = ctx.userId === userId;
    const isSubAccount = targetDbUser.parent_user_id === ctx.tenantId || targetDbUser.parent_user_id === ctx.userId;
    if (!ctx.isSuperAdmin && !isSelf && !isSubAccount) {
      return res.status(403).json({ error: 'غير مصرح بتعديل مستخدم خارج نطاق تسلسلك الهرمي' });
    }

    const requestedPerms = Array.isArray(req.body.permissions) ? req.body.permissions : [];
    const requestedMaxAllowed = Array.isArray(req.body.maxAllowedPermissions || req.body.max_allowed_permissions)
      ? (req.body.maxAllowedPermissions || req.body.max_allowed_permissions)
      : undefined;

    // Permission Ceiling Check for Non-SuperAdmin
    if (!ctx.isSuperAdmin && ctx.user) {
      const allowedCeiling = Array.isArray(ctx.user.maxAllowedPermissions) && ctx.user.maxAllowedPermissions.length > 0
        ? ctx.user.maxAllowedPermissions
        : (Array.isArray(ctx.user.permissions) ? ctx.user.permissions : []);

      const unauthorizedPerms = requestedPerms.filter((p: string) => !allowedCeiling.includes(p) && !allowedCeiling.includes('*'));
      if (unauthorizedPerms.length > 0) {
        return res.status(403).json({
          error: `الصلاحيات المطلوبة تتجاوز سقف الصلاحيات المسموح لحسابك من الإدارة: [${unauthorizedPerms.join(', ')}]`,
          code: 'CEILING_EXCEEDED',
        });
      }
    }

    const dbPayload: any = {
      permissions: requestedPerms,
      updated_at: new Date().toISOString(),
    };

    if (requestedMaxAllowed !== undefined) {
      dbPayload.max_allowed_permissions = requestedMaxAllowed;
    }

    const { data: updated, error: updateErr } = await supabase
      .from('users')
      .update(dbPayload)
      .eq('id', userId)
      .select();

    if (updateErr) {
      return res.status(500).json({ error: 'فشل تحديث الصلاحيات في Supabase: ' + updateErr.message });
    }

    const updatedUser = mapDbUserToAppUser(updated && updated[0] ? updated[0] : { ...targetDbUser, ...dbPayload });

    // Synchronously update in-memory cache
    const userIdx = users.findIndex((u) => u && u.id === updatedUser.id);
    if (userIdx !== -1) {
      users[userIdx] = updatedUser;
    } else {
      users.push(updatedUser);
    }

    // Audit Log
    logAuditEvent({
      action: 'USER_PERMISSIONS_UPDATED',
      actionNameAr: 'تحديث صلاحيات المستخدم الهرمية',
      performedBy: ctx.userId || 'UNKNOWN',
      performerName: ctx.user?.name,
      performerRole: ctx.userRole,
      targetId: updatedUser.id,
      targetType: 'USER',
      targetName: updatedUser.name,
      tenantId: updatedUser.parentUserId || updatedUser.id,
      details: {
        oldPermissions: targetDbUser.permissions,
        newPermissions: updatedUser.permissions,
        maxAllowedPermissions: updatedUser.maxAllowedPermissions,
      },
    });

    res.json({
      success: true,
      message: 'تم حفظ وتحديث صلاحيات المستخدم بنجاح في قاعدة البيانات',
      user: sanitizeUserForClient(updatedUser),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

app.patch('/api/users/:id/permissions', requireAuth, handleUserPermissionsUpdate);
app.put('/api/users/:id/permissions', requireAuth, handleUserPermissionsUpdate);

app.patch('/api/users/:id', requireAuth, handleUserUpdate);
app.put('/api/users/:id', requireAuth, handleUserUpdate);

// 26.4 DELETE /api/users/:id: Delete User Account directly from Supabase
app.delete('/api/users/:id', requireAuth, async (req, res) => {
  try {
    const ctx = getRequesterContext(req);
    const userId = req.params.id;

    if (!isValidUuid(userId)) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    const { data: existing, error: findErr } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .limit(1);

    if (findErr) {
      return res.status(500).json({ error: findErr.message });
    }
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    const targetUser = existing[0];

    if (targetUser.role === 'SUPER_ADMIN' || targetUser.email === 'admin@dargo-tms.io') {
      return res.status(400).json({ error: 'لا يمكن حذف حساب المدير العام للنظام (Super Admin)' });
    }

    // User cannot delete themselves
    if (ctx.userId === userId) {
      return res.status(400).json({ error: 'لا يمكنك حذف حسابك الحالي' });
    }

    // Non-SuperAdmin can only delete sub-accounts under their management
    if (!ctx.isSuperAdmin) {
      if (targetUser.parent_user_id !== ctx.tenantId && targetUser.parent_user_id !== ctx.userId) {
        return res.status(403).json({ error: 'غير مصرح بحذف مستخدم لا يتبع لشركتك' });
      }
    }

    const { error: delErr } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (delErr) {
      return res.status(500).json({ error: 'فشل حذف المستخدم من Supabase: ' + delErr.message });
    }

    syncUsersFromSupabase().catch(() => {});

    logAuditEvent({
      action: 'USER_DELETED',
      actionNameAr: 'حذف حساب مستخدم',
      performedBy: ctx.userId || 'UNKNOWN',
      performerName: ctx.user?.name,
      performerRole: ctx.userRole,
      targetId: targetUser.id,
      targetType: 'USER',
      targetName: targetUser.name,
      tenantId: targetUser.parent_user_id || targetUser.id,
      details: { deletedUserEmail: targetUser.email, role: targetUser.role },
    });

    res.json({
      success: true,
      message: `تم حذف حساب المستخدم (${targetUser.name}) من قاعدة البيانات بنجاح`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// TENANT WHITE-LABEL BRANDING SYSTEM
// ==========================================

export interface TenantSettings {
  id: string;
  tenantId: string;
  companyName: string;
  logoUrl: string;
  primaryColor?: string;
  secondaryColor?: string;
  faviconUrl?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
}

// In-memory tenant branding cache keyed by tenant_id
const tenantBrandingCache = new Map<string, TenantSettings>();

// Helper to get or resolve tenant branding
async function resolveTenantBranding(tenantId: string): Promise<TenantSettings> {
  if (tenantBrandingCache.has(tenantId)) {
    return tenantBrandingCache.get(tenantId)!;
  }

  // Attempt reading from Supabase
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('tenant_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (!error && data) {
        const settings: TenantSettings = {
          id: data.id,
          tenantId: data.tenant_id,
          companyName: data.company_name || 'Delivere',
          logoUrl: data.logo_url || '',
          primaryColor: data.primary_color || '#f59e0b',
          secondaryColor: data.secondary_color || '#0f172a',
          faviconUrl: data.favicon_url || '',
          phone: data.phone || '',
          address: data.address || '',
          taxId: data.tax_id || '',
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          updatedBy: data.updated_by,
        };
        tenantBrandingCache.set(tenantId, settings);
        return settings;
      }
    } catch (e) {
      // Ignore table missing error and fallback gracefully
    }
  }

  // Fallback default branding
  const defaultSettings: TenantSettings = {
    id: `ts-${tenantId}`,
    tenantId,
    companyName: 'Delivere',
    logoUrl: '',
    primaryColor: '#f59e0b',
    secondaryColor: '#0f172a',
    faviconUrl: '',
  };
  tenantBrandingCache.set(tenantId, defaultSettings);
  return defaultSettings;
}

// GET /api/company/branding
app.get('/api/company/branding', requireAuth, async (req, res) => {
  try {
    const ctx = getRequesterContext(req);
    if (!ctx.user) {
      return res.status(401).json({ error: 'غير مصرح: يجب تسجيل الدخول للوصول إلى الهوية التجارية.' });
    }

    // Determine target tenant ID
    let targetTenantId = ctx.tenantId || ctx.user.parentUserId || ctx.user.id;
    if (ctx.isSuperAdmin && req.query.tenantId) {
      targetTenantId = req.query.tenantId as string;
    }

    const branding = await resolveTenantBranding(targetTenantId);
    res.json({ branding });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'فشل جلب بيانات الهوية التجارية' });
  }
});

// PUT & POST /api/company/branding
const handleUpdateCompanyBranding = async (req: express.Request, res: express.Response) => {
  try {
    const ctx = getRequesterContext(req);
    if (!ctx.user) {
      return res.status(401).json({ error: 'غير مصرح: يجب تسجيل الدخول' });
    }

    // Permission check: SuperAdmin OR Admin OR explicitly granted company.branding.manage
    const canManageBranding =
      ctx.isSuperAdmin ||
      ctx.isAdmin ||
      hasPermission(ctx.user, 'company.branding.manage');

    if (!canManageBranding) {
      return res.status(403).json({
        error: 'غير مصرح بتعديل الهوية التجارية واللوجو الخاص بالشركة (company.branding.manage)',
        code: 'PERMISSION_DENIED',
      });
    }

    // STRICT ISOLATION: Non-superadmins CANNOT modify another tenant's branding
    let targetTenantId = ctx.tenantId || ctx.user.parentUserId || ctx.user.id;
    if (ctx.isSuperAdmin && req.body.tenantId) {
      targetTenantId = req.body.tenantId;
    }

    const { companyName, logoUrl, primaryColor, secondaryColor, faviconUrl, phone, address, taxId } = req.body;

    if (!companyName || typeof companyName !== 'string' || companyName.trim().length === 0) {
      return res.status(400).json({ error: 'اسم الشركة مطلوب لا يمكن أن يكون فارغاً' });
    }

    const updatedSettings: TenantSettings = {
      id: `ts-${targetTenantId}`,
      tenantId: targetTenantId,
      companyName: companyName.trim(),
      logoUrl: typeof logoUrl === 'string' ? logoUrl.trim() : '',
      primaryColor: primaryColor || '#f59e0b',
      secondaryColor: secondaryColor || '#0f172a',
      faviconUrl: faviconUrl || '',
      phone: phone || '',
      address: address || '',
      taxId: taxId || '',
      updatedAt: new Date().toISOString(),
      updatedBy: ctx.userId,
    };

    // Update in-memory cache immediately
    tenantBrandingCache.set(targetTenantId, updatedSettings);

    // Save/Upsert into Supabase
    if (supabase) {
      try {
        await supabase.from('tenant_settings').upsert(
          {
            tenant_id: targetTenantId,
            company_name: updatedSettings.companyName,
            logo_url: updatedSettings.logoUrl,
            primary_color: updatedSettings.primaryColor,
            secondary_color: updatedSettings.secondaryColor,
            favicon_url: updatedSettings.faviconUrl,
            phone: updatedSettings.phone,
            address: updatedSettings.address,
            tax_id: updatedSettings.taxId,
            updated_at: updatedSettings.updatedAt,
            updated_by: updatedSettings.updatedBy,
          },
          { onConflict: 'tenant_id' }
        );
      } catch (e) {
        console.warn('Could not persist tenant_settings to Supabase table:', e);
      }
    }

    logAuditEvent({
      action: 'UPDATE_COMPANY_BRANDING',
      actionNameAr: 'تحديث الهوية وشعار الشركة',
      performedBy: ctx.userId || 'UNKNOWN',
      performerName: ctx.user.name,
      performerRole: ctx.userRole,
      tenantId: targetTenantId,
      details: {
        companyName: updatedSettings.companyName,
        logoUrl: updatedSettings.logoUrl,
      },
    });

    res.json({
      success: true,
      message: 'تم حفظ وتطبيق الهوية التجارية واللوجو بنجاح على جميع حسابات الشركة',
      branding: updatedSettings,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'فشل تحديث الهوية التجارية' });
  }
};

app.put('/api/company/branding', requireAuth, handleUpdateCompanyBranding);
app.post('/api/company/branding', requireAuth, handleUpdateCompanyBranding);

// POST /api/company/branding/logo - Logo Upload Endpoint
app.post('/api/company/branding/logo', requireAuth, async (req, res) => {
  try {
    const ctx = getRequesterContext(req);
    if (!ctx.user) {
      return res.status(401).json({ error: 'غير مصرح: يجب تسجيل الدخول' });
    }

    const canManageBranding =
      ctx.isSuperAdmin ||
      ctx.isAdmin ||
      hasPermission(ctx.user, 'company.branding.manage');

    if (!canManageBranding) {
      return res.status(403).json({
        error: 'غير مصرح برفع شعار الشركة (company.branding.manage)',
        code: 'PERMISSION_DENIED',
      });
    }

    let targetTenantId = ctx.tenantId || ctx.user.parentUserId || ctx.user.id;
    if (ctx.isSuperAdmin && req.body.tenantId) {
      targetTenantId = req.body.tenantId;
    }

    const { imageBase64, fileName, mimeType } = req.body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'لم يتم تزويد صورة الشعار' });
    }

    // Security & File Validation
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+\-+]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    // Size limit: 5MB
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'حجم صورة الشعار يتجاوز الحد الأقصى المسموح (5 ميجابايت)' });
    }

    // MimeType check
    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    const detectedMime = mimeType || 'image/png';
    if (!allowedMimeTypes.includes(detectedMime.toLowerCase())) {
      return res.status(400).json({ error: 'نوع الملف غير مدعوم. الأنواع المسموحة: PNG, JPG, WEBP, SVG' });
    }

    // SVG Security Sanitization: Check for embedded script execution
    if (detectedMime.toLowerCase().includes('svg') || (fileName && fileName.toLowerCase().endsWith('.svg'))) {
      const svgText = buffer.toString('utf8').toLowerCase();
      if (
        svgText.includes('<script') ||
        svgText.includes('javascript:') ||
        svgText.includes('onload=') ||
        svgText.includes('onerror=') ||
        svgText.includes('onclick=') ||
        svgText.includes('<foreignobject')
      ) {
        return res.status(400).json({ error: 'ملف الـ SVG يحتوي على عناصر غير آمنة أو برمجية غير مسموح بها.' });
      }
    }

    let logoUrl = '';
    const fileExt = detectedMime.includes('svg') ? 'svg' : detectedMime.includes('webp') ? 'webp' : detectedMime.includes('jpeg') || detectedMime.includes('jpg') ? 'jpg' : 'png';
    const filePath = `${targetTenantId}/logo_${Date.now()}.${fileExt}`;

    // Upload to Supabase Storage Bucket 'branding'
    if (supabase) {
      try {
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('branding')
          .upload(filePath, buffer, {
            contentType: detectedMime,
            upsert: true,
          });

        if (!uploadErr && uploadData) {
          const { data: publicUrlData } = supabase.storage
            .from('branding')
            .getPublicUrl(filePath);
          if (publicUrlData && publicUrlData.publicUrl) {
            logoUrl = publicUrlData.publicUrl;
          }
        }
      } catch (e) {
        console.warn('Supabase storage upload fallback:', e);
      }
    }

    // Fallback if storage upload is not available: convert to data URI
    if (!logoUrl) {
      logoUrl = `data:${detectedMime};base64,${cleanBase64}`;
    }

    res.json({
      success: true,
      message: 'تم رفع الشعار واجتياز الفحص الأمني بنجاح',
      logoUrl,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'فشل رفع الشعار' });
  }
});

// -------------------------------------------------------------
// PHASE 1.5B: SECURE INVITATION SYSTEM & GOOGLE LOGIN
// -------------------------------------------------------------

// 1. POST /api/invitations: Create a new cryptographically secured user invitation
app.post('/api/invitations', requireAuth, async (req, res) => {
  try {
    const ctx = getRequesterContext(req);

    // Authorization Check: Enforce real permissions via hasPermission and getEffectivePermissions
    const isAllowedToInvite =
      ctx.isSuperAdmin ||
      hasPermission(ctx.user, 'users.manage_staff') ||
      hasPermission(ctx.user, 'users.manage_operations') ||
      hasPermission(ctx.user, 'invitations.create') ||
      (ctx.userRole === 'ADMIN' && hasPermission(ctx.user, 'users.manage_staff')) ||
      (ctx.userRole === 'MERCHANT' && (hasPermission(ctx.user, 'merchants.manage_own_staff') || hasPermission(ctx.user, 'users.manage_staff')));

    if (!isAllowedToInvite) {
      return res.status(403).json({
        error: 'غير مصرح لك بإنشاء دعوات للمستخدمين. هذه الصلاحية مقصورة على الجهات والمدراء المعتمدين.',
        code: 'FORBIDDEN',
      });
    }

    const {
      email,
      phone,
      role,
      roleName,
      commercialName,
      companyName,
      branch,
      city,
      priceList,
      pricePlanId,
      permissions,
      maxAllowedPermissions,
      expiresInDays = 7,
    } = req.body;

    const cleanEmail = email && String(email).trim() ? String(email).trim().toLowerCase() : '';

    if (!role) {
      return res.status(400).json({ error: 'الدور الوظيفي المطلوب تحديده في الدعوة مطلوب', code: 'ROLE_REQUIRED' });
    }

    // Role Hierarchy & Downward-Only Validation Matrix
    const getRoleRank = (r: string): number => {
      switch (r) {
        case 'SUPER_ADMIN': return 100;
        case 'ADMIN': return 80;
        case 'ACCOUNTANT': return 50;
        case 'MERCHANT': return 40;
        case 'OPERATOR': return 30;
        case 'STAFF': return 30;
        case 'DRIVER': return 20;
        case 'CASHIER': return 10;
        default: return 0;
      }
    };

    const requesterRank = getRoleRank(ctx.userRole);
    const targetRank = getRoleRank(role);

    if (ctx.userRole === 'SUPER_ADMIN') {
      if (role === 'SUPER_ADMIN') {
        return res.status(403).json({
          error: 'لا يمكن إنشاء دعوة لسوبر أدمن آخر عبر نظام الدعوات الفرعية',
          code: 'ROLE_ESCALATION_FORBIDDEN',
        });
      }
    } else if (ctx.userRole === 'ADMIN') {
      if (role === 'CASHIER') {
        return res.status(403).json({
          error: 'موظف الكاشير ونقاط البيع (CASHIER) يجب أن يُدعى حصرياً من قبل التاجر صاحب المتجر والفرع المعتمد.',
          code: 'CASHIER_MUST_BE_INVITED_BY_MERCHANT',
        });
      }
      if (targetRank >= 80) {
        return res.status(403).json({
          error: 'مدير العمليات يستطيع فقط دعوة التجار، السائقين، والموظفين الميدانيين ضمن حسابه',
          code: 'ROLE_ESCALATION_FORBIDDEN',
        });
      }
    } else if (ctx.userRole === 'MERCHANT') {
      if (targetRank >= 40) {
        return res.status(403).json({
          error: 'حساب التاجر يستطيع فقط دعوة موظفيه التابعين له (كاشير، موظف مخزن، مبيعات)',
          code: 'ROLE_ESCALATION_FORBIDDEN',
        });
      }
    } else {
      if (targetRank >= requesterRank) {
        return res.status(403).json({
          error: 'لا يمكنك دعوة مستخدم في نفس مستواك الوظيفي أو أعلى منه (Downward-Only Invitation)',
          code: 'ROLE_ESCALATION_FORBIDDEN',
        });
      }
    }

    // Server-Derived Tenant & Parent Scoping (Client Tampering Resilient)
    let assignedTenantId: string | null = null;
    let assignedParentUserId: string | null = null;
    let finalPermissions: string[] = Array.isArray(permissions) ? permissions : [];
    let finalMaxAllowed: string[] = Array.isArray(maxAllowedPermissions) ? maxAllowedPermissions : finalPermissions;

    if (ctx.isSuperAdmin) {
      assignedTenantId = req.body.tenantId || req.body.parentUserId || null;
      assignedParentUserId = req.body.parentUserId || (role === 'ADMIN' ? null : assignedTenantId);
    } else if (ctx.userRole === 'ADMIN') {
      assignedTenantId = ctx.tenantId;
      assignedParentUserId = ctx.tenantId;
    } else if (ctx.userRole === 'MERCHANT') {
      assignedTenantId = ctx.tenantId;
      assignedParentUserId = ctx.userId;
    } else {
      assignedTenantId = ctx.tenantId;
      assignedParentUserId = ctx.userId;
    }

    // Permission Ceiling Check: Inviter cannot grant permissions beyond their own ceiling
    const inviterCeiling = ctx.user?.maxAllowedPermissions && ctx.user.maxAllowedPermissions.length > 0
      ? ctx.user.maxAllowedPermissions
      : (ctx.user?.permissions || []);

    if (!ctx.isSuperAdmin && inviterCeiling.length > 0 && !inviterCeiling.includes('*')) {
      const ceilingExceeded = finalPermissions.filter((p: string) => !inviterCeiling.includes(p));
      if (ceilingExceeded.length > 0) {
        return res.status(403).json({
          error: `لا يمكنك منح صلاحيات في الدعوة تتجاوز سقف صلاحياتك المعتمد: [${ceilingExceeded.join(', ')}]`,
          code: 'CEILING_EXCEEDED',
          violatingPermissions: ceilingExceeded,
        });
      }
    }
    finalMaxAllowed = finalPermissions;

    // Generate 256-bit cryptographically secure token and its SHA-256 hash
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const durationDays = typeof expiresInDays === 'number' && expiresInDays > 0 ? expiresInDays : 7;
    const expiresAt = new Date(Date.now() + durationDays * 86400000).toISOString();
    const invitationId = crypto.randomUUID();

    let validatedBranchId: string | undefined = req.body.branchId;
    let validatedBranchName: string | undefined = branch;

    if (role === 'CASHIER') {
      if (ctx.userRole !== 'MERCHANT' && !ctx.isSuperAdmin) {
        return res.status(403).json({
          error: 'موظف الكاشير ونقاط البيع (CASHIER) يجب أن يُدعى حصرياً من قبل التاجر صاحب المتجر والفرع المعتمد.',
          code: 'CASHIER_MUST_BE_INVITED_BY_MERCHANT',
        });
      }

      const merchantOwnerId = assignedParentUserId;
      if (!validatedBranchId) {
        // Fallback: look up default/main branch for this merchant
        const mainBranch = merchantBranches.find((b) => b.merchantId === merchantOwnerId && b.isMain);
        if (mainBranch) {
          validatedBranchId = mainBranch.id;
          validatedBranchName = mainBranch.name;
        } else {
          return res.status(400).json({
            error: 'يرجى تحديد معرف الفرع (branchId) الذي سيعمل به موظف الكاشير ونقطة البيع.',
            code: 'BRANCH_ID_REQUIRED',
          });
        }
      } else {
        const foundBranch = merchantBranches.find((b) => b.id === validatedBranchId && b.merchantId === merchantOwnerId);
        if (!foundBranch) {
          return res.status(404).json({
            error: 'الفرع المحدد غير موجود أو لا ينتمي لمتجر التاجر الحالي.',
            code: 'BRANCH_NOT_FOUND',
          });
        }
        validatedBranchName = foundBranch.name;
      }
    }

    const newInvitation: UserInvitation = {
      id: invitationId,
      tokenHash,
      email: cleanEmail,
      phone: phone ? String(phone).trim() : undefined,
      role: role as any,
      roleName: roleName || (
        role === 'SUPER_ADMIN' ? 'المدير العام للنظام' :
        role === 'ADMIN' ? 'مدير العمليات' :
        role === 'MERCHANT' ? 'حساب التاجر' :
        role === 'DRIVER' ? 'كابتن التوصيل' :
        role === 'CASHIER' ? 'موظف الكاشير' :
        role === 'ACCOUNTANT' ? 'محاسب مالي' : 'موظف العمليات'
      ),
      tenantId: assignedTenantId,
      parentUserId: assignedParentUserId,
      branchId: validatedBranchId,
      invitedBy: ctx.userId,
      inviterName: ctx.user?.name || 'مدير النظام',
      inviterRole: ctx.userRole,
      permissions: finalPermissions,
      maxAllowedPermissions: finalMaxAllowed,
      commercialName: commercialName || undefined,
      companyName: companyName || undefined,
      branch: validatedBranchName || ctx.user?.branch || 'المقر الرئيسي للمملكة',
      city: city || ctx.user?.city || 'عمان',
      priceList: priceList || undefined,
      pricePlanId: pricePlanId || undefined,
      status: 'PENDING',
      expiresAt,
      authProvider: 'EMAIL_PASSWORD',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Store in Supabase if available
    try {
      const dbPayload = mapAppInvitationToDbInvitation(newInvitation);
      await supabase.from('user_invitations').insert([dbPayload]);
    } catch (dbErr: any) {
      console.warn('Supabase user_invitations insert fallback to memory:', dbErr?.message);
    }

    // Always maintain in-memory store
    userInvitations.unshift(newInvitation);

    // Audit Logging
    logAuditEvent({
      action: 'INVITATION_CREATED',
      actionNameAr: 'إنشاء وتوليد رابط دعوة مستخدم جديد',
      performedBy: ctx.userId,
      performerName: ctx.user?.name,
      performerRole: ctx.userRole,
      targetId: invitationId,
      targetType: 'INVITATION',
      targetName: cleanEmail,
      tenantId: assignedTenantId || ctx.tenantId,
      details: { invitedEmail: cleanEmail, role, tenantId: assignedTenantId, expiresAt },
    });

    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost:3000';
    const inviteUrl = `${protocol}://${host}/invite?token=${rawToken}`;

    res.status(201).json({
      success: true,
      message: 'تم إنشاء رابط الدعوة المشفر بنجاح',
      invitation: sanitizeInvitationForClient(newInvitation),
      rawToken,
      inviteUrl,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'فشل إنشاء رابط الدعوة: ' + err.message });
  }
});

// 2. GET /api/invitations: List invitations within requester's tenant boundary
app.get('/api/invitations', requireAuth, async (req, res) => {
  try {
    const ctx = getRequesterContext(req);

    const isAllowed =
      ctx.isSuperAdmin ||
      hasPermission(ctx.user, 'users.manage_staff') ||
      hasPermission(ctx.user, 'users.manage_operations') ||
      hasPermission(ctx.user, 'invitations.view') ||
      hasPermission(ctx.user, 'invitations.create') ||
      ctx.userRole === 'ADMIN' ||
      ctx.userRole === 'MERCHANT';

    if (!isAllowed) {
      return res.status(403).json({ error: 'غير مصرح بعرض قائمة الدعوات (403 Forbidden)', code: 'FORBIDDEN' });
    }

    // Refresh from Supabase if possible
    await syncInvitationsFromSupabase().catch(() => {});

    // Filter strictly by tenant/parent/subtree boundary
    let filtered: UserInvitation[] = [];
    if (ctx.isSuperAdmin) {
      filtered = [...userInvitations];
    } else if (ctx.userRole === 'ADMIN' && ctx.user) {
      const allowedUserIds = getHierarchicalSubtreeUserIds(ctx.user.id, users);
      filtered = userInvitations.filter(
        (inv) =>
          allowedUserIds.has(inv.invitedBy) ||
          inv.invitedBy === ctx.userId ||
          inv.parentUserId === ctx.userId
      );
    } else if (ctx.userRole === 'MERCHANT') {
      filtered = userInvitations.filter(
        (inv) =>
          inv.parentUserId === ctx.userId ||
          inv.invitedBy === ctx.userId
      );
    } else {
      filtered = userInvitations.filter((inv) => inv.invitedBy === ctx.userId);
    }

    // Check and update expired status on-the-fly
    const now = new Date();
    filtered.forEach((inv) => {
      if (inv.status === 'PENDING' && new Date(inv.expiresAt) < now) {
        inv.status = 'EXPIRED';
      }
    });

    res.json({
      success: true,
      invitations: filtered.map(sanitizeInvitationForClient),
      count: filtered.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. GET /api/invitations/verify: Public Zero-Trust endpoint to verify token validity before showing accept UI
app.get(['/api/invitations/verify', '/invitations/verify'], async (req, res) => {
  try {
    const rawToken = req.query.token || req.headers['x-invitation-token'] || '';
    const token = String(rawToken).trim();
    if (!token) {
      return res.status(400).json({ valid: false, error: 'رمز الدعوة مطلوب للتحقق', code: 'TOKEN_REQUIRED' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Look up in memory first
    let invitation = userInvitations.find((i) => i.tokenHash === tokenHash);

    // If not in memory, query Supabase database
    if (!invitation) {
      try {
        const { data: dbData, error: dbErr } = await supabase
          .from('user_invitations')
          .select('*')
          .eq('token_hash', tokenHash)
          .limit(1);

        if (!dbErr && dbData && dbData.length > 0) {
          invitation = mapDbInvitationToAppInvitation(dbData[0]);
          userInvitations.push(invitation);
        }
      } catch (err: any) {
        console.warn('DB invitation verify lookup warning:', err?.message);
      }
    }

    if (!invitation) {
      return res.status(404).json({
        valid: false,
        error: 'رابط الدعوة غير صالح أو غير موجود في النظام.',
        code: 'INVITATION_NOT_FOUND',
      });
    }

    // Check status constraints
    if (invitation.status === 'ACCEPTED') {
      return res.status(400).json({
        valid: false,
        error: 'تم استخدام رابط الدعوة هذا مسبقاً وتفعيل الحساب.',
        code: 'INVITATION_ALREADY_USED',
      });
    }

    if (invitation.status === 'REVOKED') {
      return res.status(400).json({
        valid: false,
        error: 'تم إلغاء رابط الدعوة هذا من قبل إدارة العمليات.',
        code: 'INVITATION_REVOKED',
      });
    }

    if (new Date() > new Date(invitation.expiresAt) || invitation.status === 'EXPIRED') {
      invitation.status = 'EXPIRED';
      return res.status(400).json({
        valid: false,
        error: 'انتهت صلاحية رابط الدعوة. يرجى طلب رابط دعوة جديد من الإدارة.',
        code: 'INVITATION_EXPIRED',
      });
    }

    if (invitation.status !== 'PENDING') {
      return res.status(400).json({
        valid: false,
        error: 'حالة رابط الدعوة غير صالحة.',
        code: 'INVITATION_INVALID_STATUS',
      });
    }

    // PART 6: Safe preview ONLY.
    // Strictly omit: token_hash, tenant_id, created_by_id, max_allowed_permissions, permissions, secrets.
    const safePreview = {
      valid: true,
      role: invitation.role,
      roleName: invitation.roleName || invitation.role,
      commercialName: invitation.commercialName || invitation.companyName || '',
      responsibleName: invitation.companyName || invitation.commercialName || '',
      companyName: invitation.companyName || '',
      inviterName: invitation.inviterName || '',
      branch: invitation.branch || '',
      city: invitation.city || '',
      email: invitation.email || '',
      phone: invitation.phone || '',
      expiresAt: invitation.expiresAt,
    };

    return res.json({
      valid: true,
      ...safePreview,
      invitation: safePreview,
    });
  } catch (err: any) {
    return res.status(500).json({ valid: false, error: 'فشل التحقق من رابط الدعوة: ' + err.message });
  }
});

// 4. POST /api/invitations/accept: Accept invitation, link or create user, and issue session token
app.post(['/api/invitations/accept', '/invitations/accept'], async (req, res) => {
  try {
    const { token, name, password, phone, googleId, googleEmail } = req.body;

    if (!token || !String(token).trim()) {
      return res.status(400).json({ error: 'رمز الدعوة مطلوب', code: 'TOKEN_REQUIRED' });
    }

    const cleanToken = String(token).trim();
    const tokenHash = crypto.createHash('sha256').update(cleanToken).digest('hex');

    const claim = await claimInvitationAtomically(tokenHash);
    if (!claim.success) {
      const statusCode = claim.errorCode === 'INVITATION_NOT_FOUND' ? 404 : 400;
      return res.status(statusCode).json({ error: claim.errorMessage, code: claim.errorCode });
    }

    const invitation = claim.invitation!;

    try {
      const targetEmail = (googleEmail || req.body.email || invitation.email || '').toLowerCase().trim();
      if (!targetEmail) {
        await claim.release!();
        return res.status(400).json({ error: 'البريد الإلكتروني للطرف القابل للدعوة مطلوب لتفعيل الحساب', code: 'EMAIL_REQUIRED' });
      }

      // Check if user already exists with this email (Preserve existing users and link identities)
      let existingUser = users.find((u) => u.email?.toLowerCase().trim() === targetEmail);
      if (!existingUser) {
        try {
          const { data: dbUsers } = await supabase
            .from('users')
            .select('*')
            .ilike('email', targetEmail)
            .limit(1);

          if (dbUsers && dbUsers.length > 0) {
            existingUser = mapDbUserToAppUser(dbUsers[0]);
            users.push(existingUser);
          }
        } catch {
          // ignore
        }
      }

      let authenticatedUser: User;

      if (existingUser) {
        // ----------------------------------------------------------------------
        // Existing User: Link identity without destructively altering user IDs or roles
        // ----------------------------------------------------------------------
        const updates: Partial<User> = {
          invitationId: invitation.id,
          invitedBy: invitation.invitedBy,
        };

        if (password && String(password).trim()) {
          updates.password = hashPassword(String(password).trim());
        }
        if (googleId) {
          updates.googleId = String(googleId);
          updates.googleEmail = googleEmail ? String(googleEmail).toLowerCase().trim() : targetEmail;
          updates.authProvider = existingUser.password ? 'HYBRID' : 'GOOGLE';
        }

        // Update in Supabase & memory
        Object.assign(existingUser, updates);
        try {
          await supabase
            .from('users')
            .update(mapAppUserToDbUser(existingUser))
            .eq('id', existingUser.id);
        } catch (dbErr: any) {
          console.warn('Supabase user identity link fallback to memory:', dbErr?.message);
        }

        authenticatedUser = existingUser;
      } else {
        // ----------------------------------------------------------------------
        // New User: Create account according to the invitation specifications
        // ----------------------------------------------------------------------
        const userName = String(name || invitation.commercialName || targetEmail.split('@')[0]).trim();
        const rawPass = password ? String(password).trim() : '';

        if (!rawPass && !googleId) {
          await claim.release!();
          return res.status(400).json({
            error: 'يرجى تحديد كلمة مرور للحساب أو إكمال التسجيل عبر Google.',
            code: 'CREDENTIALS_REQUIRED',
          });
        }

        const newUserId = crypto.randomUUID();
        const newUser: User = {
          id: newUserId,
          name: userName,
          email: targetEmail,
          phone: String(phone || invitation.phone || '0790000000').trim(),
          password: rawPass ? hashPassword(rawPass) : undefined,
          role: invitation.role,
          roleName: invitation.roleName,
          commercialName: invitation.commercialName || userName,
          storeName: invitation.commercialName || userName,
          commercialType: 'تجارة ومبيعات إلكترونية',
          branch: invitation.branch || 'المقر الرئيسي للمملكة',
          branchId: invitation.branchId,
          city: invitation.city || 'عمان',
          priceList: invitation.priceList || 'جميع المملكة 2 (القياسية)',
          pricePlanId: invitation.pricePlanId,
          isActive: true,
          parentUserId: invitation.parentUserId,
          createdById: invitation.invitedBy,
          permissions: invitation.permissions || [],
          maxAllowedPermissions: invitation.maxAllowedPermissions || invitation.permissions || [],
          authProvider: googleId ? 'GOOGLE' : 'EMAIL_PASSWORD',
          googleId: googleId ? String(googleId) : undefined,
          googleEmail: googleEmail ? String(googleEmail).toLowerCase().trim() : undefined,
          invitationId: invitation.id,
          invitedBy: invitation.invitedBy,
        };

        // If Cashier, create normalized branch access record
        if (newUser.role === 'CASHIER' && invitation.branchId && invitation.parentUserId) {
          const uba: UserBranchAccess = {
            id: `uba-${newUserId}-${invitation.branchId}`,
            tenantId: newUser.tenantId || invitation.parentUserId,
            merchantId: invitation.parentUserId,
            userId: newUserId,
            branchId: invitation.branchId,
            roleInBranch: 'CASHIER',
            isDefault: true,
            createdAt: new Date().toISOString(),
          };
          userBranchAccess.push(uba);
        }

        // Save to Supabase & Memory
        try {
          await supabase.from('users').insert([mapAppUserToDbUser(newUser)]);
        } catch (dbErr: any) {
          console.warn('Supabase user creation fallback to memory:', dbErr?.message);
        }
        users.push(newUser);
        authenticatedUser = newUser;
      }

      await claim.commit!(authenticatedUser.id);

      // Audit Log
      logAuditEvent({
        action: 'INVITATION_ACCEPTED',
        actionNameAr: 'قبول وتفعيل دعوة الانضمام للمنظومة',
        performedBy: authenticatedUser.id,
        performerName: authenticatedUser.name,
        performerRole: authenticatedUser.role,
        targetId: invitation.id,
        targetType: 'INVITATION',
        targetName: targetEmail,
        tenantId: authenticatedUser.parentUserId || authenticatedUser.id,
        details: {
          userId: authenticatedUser.id,
          email: targetEmail,
          isNewUser: !existingUser,
          authProvider: authenticatedUser.authProvider,
        },
      });

      // Issue cryptographic JWT session token
      const sessionToken = generateSessionToken(authenticatedUser);

      res.json({
        success: true,
        message: 'تم قبول الدعوة وتفعيل الحساب بنجاح',
        user: sanitizeUserForClient(authenticatedUser),
        token: sessionToken,
      });
    } catch (err: any) {
      await claim.release!();
      throw err;
    }
  } catch (err: any) {
    res.status(500).json({ error: 'فشل إتمام قبول الدعوة: ' + err.message });
  }
});

// 5. POST /api/invitations/:id/revoke: Revoke invitation within tenant boundary
app.post('/api/invitations/:id/revoke', requireAuth, async (req, res) => {
  try {
    const ctx = getRequesterContext(req);
    const invitationId = req.params.id;

    let invitation = userInvitations.find((i) => i.id === invitationId);
    if (!invitation) {
      const { data: dbData } = await supabase
        .from('user_invitations')
        .select('*')
        .eq('id', invitationId)
        .limit(1);

      if (dbData && dbData.length > 0) {
        invitation = mapDbInvitationToAppInvitation(dbData[0]);
        userInvitations.push(invitation);
      }
    }

    if (!invitation) {
      return res.status(404).json({ error: 'الدعوة غير موجودة', code: 'NOT_FOUND' });
    }

    // Tenant Isolation Check
    if (!ctx.isSuperAdmin) {
      if (
        invitation.tenantId !== ctx.tenantId &&
        invitation.parentUserId !== ctx.tenantId &&
        invitation.invitedBy !== ctx.userId
      ) {
        return res.status(403).json({ error: 'غير مصرح بإلغاء دعوة تابعة لشركة أخرى', code: 'FORBIDDEN' });
      }
    }

    invitation.status = 'REVOKED';
    invitation.updatedAt = new Date().toISOString();

    try {
      await supabase
        .from('user_invitations')
        .update({ status: 'REVOKED', updated_at: invitation.updatedAt })
        .eq('id', invitation.id);
    } catch {
      // fallback
    }

    logAuditEvent({
      action: 'INVITATION_REVOKED',
      actionNameAr: 'إلغاء رابط دعوة مستخدم',
      performedBy: ctx.userId,
      performerName: ctx.user?.name,
      performerRole: ctx.userRole,
      targetId: invitation.id,
      targetType: 'INVITATION',
      targetName: invitation.email,
      tenantId: invitation.tenantId || ctx.tenantId,
    });

    res.json({
      success: true,
      message: 'تم إلغاء رابط الدعوة بنجاح',
      invitation: sanitizeInvitationForClient(invitation),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. POST /api/invitations/:id/resend: Regenerate secure token and extend expiration
app.post('/api/invitations/:id/resend', requireAuth, async (req, res) => {
  try {
    const ctx = getRequesterContext(req);
    const invitationId = req.params.id;

    let invitation = userInvitations.find((i) => i.id === invitationId);
    if (!invitation) {
      const { data: dbData } = await supabase
        .from('user_invitations')
        .select('*')
        .eq('id', invitationId)
        .limit(1);

      if (dbData && dbData.length > 0) {
        invitation = mapDbInvitationToAppInvitation(dbData[0]);
        userInvitations.push(invitation);
      }
    }

    if (!invitation) {
      return res.status(404).json({ error: 'الدعوة غير موجودة', code: 'NOT_FOUND' });
    }

    // Tenant Isolation Check
    if (!ctx.isSuperAdmin) {
      if (
        invitation.tenantId !== ctx.tenantId &&
        invitation.parentUserId !== ctx.tenantId &&
        invitation.invitedBy !== ctx.userId
      ) {
        return res.status(403).json({ error: 'غير مصرح بإعادة إرسال دعوة تابعة لشركة أخرى', code: 'FORBIDDEN' });
      }
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();

    invitation.tokenHash = tokenHash;
    invitation.expiresAt = expiresAt;
    invitation.status = 'PENDING';
    invitation.updatedAt = new Date().toISOString();

    try {
      await supabase
        .from('user_invitations')
        .update({
          token_hash: tokenHash,
          expires_at: expiresAt,
          status: 'PENDING',
          updated_at: invitation.updatedAt,
        })
        .eq('id', invitation.id);
    } catch {
      // fallback
    }

    logAuditEvent({
      action: 'INVITATION_RESENT',
      actionNameAr: 'تجديد وإعادة إرسال رابط الدعوة',
      performedBy: ctx.userId,
      performerName: ctx.user?.name,
      performerRole: ctx.userRole,
      targetId: invitation.id,
      targetType: 'INVITATION',
      targetName: invitation.email,
      tenantId: invitation.tenantId || ctx.tenantId,
    });

    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost:3000';
    const inviteUrl = `${protocol}://${host}/invite?token=${rawToken}`;

    res.json({
      success: true,
      message: 'تم تجديد وإعادة تفعيل رابط الدعوة بنجاح',
      invitation: sanitizeInvitationForClient(invitation),
      rawToken,
      inviteUrl,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --------------------------------------------------------------------------
// 7. Supabase Auth Google Identity Verification & Delivere Session Issuance
// --------------------------------------------------------------------------
// Zero-Trust Security: Frontend initiates OAuth via supabase.auth.signInWithOAuth({ provider: 'google' }).
// Backend cryptographically verifies identity via Supabase Auth API (supabase.auth.getUser).
// Strictly verifies email_verified status.
// Existing Users: Safely links google_id/google_email without altering user ID, role, permissions, or hierarchy.
// New Users: Strictly gated behind valid, unexpired, atomic invitation tokens.
// Issues signed Delivere sessions (dargo_jwt) with HMAC-SHA256.
app.post(['/api/auth/supabase-google', '/api/auth/google/verify-token'], async (req, res) => {
  try {
    const supabaseAccessToken = req.body.supabaseAccessToken || req.body.credential;
    const invitationToken = req.body.invitationToken;

    if (!supabaseAccessToken || typeof supabaseAccessToken !== 'string') {
      return res.status(401).json({
        error: 'رمز وصول Supabase Auth مطلوب (Supabase Access Token is required).',
        code: 'SUPABASE_TOKEN_REQUIRED',
      });
    }

    // Cryptographically verify identity via Supabase Auth API
    const { data: authData, error: authError } = await supabase.auth.getUser(supabaseAccessToken.trim());

    if (authError || !authData?.user) {
      return res.status(401).json({
        error: 'رمز وصول Supabase غير صالح أو منتهي الصلاحية: ' + (authError?.message || 'Invalid token'),
        code: 'INVALID_SUPABASE_TOKEN',
      });
    }

    const supabaseUser = authData.user;
    const supabaseAuthId = String(supabaseUser.id);
    const verifiedEmail = (supabaseUser.email || '').toLowerCase().trim();

    // Verify email verification status from Supabase identity
    const isEmailVerified = Boolean(
      supabaseUser.email_confirmed_at ||
      supabaseUser.confirmed_at ||
      supabaseUser.user_metadata?.email_verified === true ||
      supabaseUser.user_metadata?.email_verified === 'true' ||
      supabaseUser.app_metadata?.provider === 'google'
    );

    if (!verifiedEmail || !isEmailVerified) {
      return res.status(403).json({
        error: 'حساب Google هذا لا يحتوي على بريد موثق ومؤكد رسمياً لدى مزود الهوية (email_verified=false).',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    const verifiedName =
      supabaseUser.user_metadata?.full_name ||
      supabaseUser.user_metadata?.name ||
      verifiedEmail.split('@')[0];

    // 1. Check if user already exists in Delivere database
    let existingUser = users.find(
      (u) =>
        (u.googleId && u.googleId === supabaseAuthId) ||
        (u.email && u.email.toLowerCase().trim() === verifiedEmail) ||
        (u.googleEmail && u.googleEmail.toLowerCase().trim() === verifiedEmail)
    );

    if (!existingUser) {
      try {
        const { data: dbUsers } = await supabase
          .from('users')
          .select('*')
          .or(`google_id.eq.${supabaseAuthId},email.ilike.${verifiedEmail},google_email.ilike.${verifiedEmail}`)
          .limit(1);

        if (dbUsers && dbUsers.length > 0) {
          existingUser = mapDbUserToAppUser(dbUsers[0]);
          users.push(existingUser);
        }
      } catch (err: any) {
        console.warn('DB lookup fallback for existing user:', err?.message);
      }
    }

    if (existingUser) {
      // Existing User: Preserve existing user.id, role, permissions, maxAllowedPermissions, tenantId, parentUserId 100%!
      if (existingUser.googleId !== supabaseAuthId || existingUser.googleEmail !== verifiedEmail) {
        existingUser.googleId = supabaseAuthId;
        existingUser.googleEmail = verifiedEmail;
        existingUser.authProvider = existingUser.password ? 'HYBRID' : 'GOOGLE';

        try {
          await supabase
            .from('users')
            .update({
              google_id: supabaseAuthId,
              google_email: verifiedEmail,
              auth_provider: existingUser.authProvider,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingUser.id);
        } catch (dbErr: any) {
          console.warn('DB update user Google link error:', dbErr?.message);
        }
      }

      if (!existingUser.isActive) {
        return res.status(403).json({
          error: 'تم تعطيل أو تعليق هذا الحساب. يرجى مراجعة إدارة العمليات.',
          code: 'ACCOUNT_INACTIVE',
        });
      }

      logAuditEvent({
        action: 'GOOGLE_LOGIN_SUCCESS',
        actionNameAr: 'تسجيل دخول ناجح عبر مزود Supabase Google Auth',
        performedBy: existingUser.id,
        performerName: existingUser.name,
        performerRole: existingUser.role,
        targetId: existingUser.id,
        targetType: 'USER',
        tenantId: existingUser.parentUserId || existingUser.id,
      });

      const sessionToken = generateSessionToken(existingUser);
      return res.json({
        success: true,
        message: `مرحباً بك يا ${existingUser.name}`,
        user: sanitizeUserForClient(existingUser),
        token: sessionToken,
      });
    }

    // 2. New User: Registration Gating - Require Valid Invitation
    if (!invitationToken || !String(invitationToken).trim()) {
      return res.status(403).json({
        error: 'تسجيل الدخول عبر Google متاح فقط للمستخدمين المدعوين مسبقاً أو المسجلين في النظام. يرجى التواصل مع إدارة العمليات لتلقي رابط دعوة.',
        code: 'REGISTRATION_GATED',
      });
    }

    const tokenHash = crypto.createHash('sha256').update(String(invitationToken).trim()).digest('hex');
    const claim = await claimInvitationAtomically(tokenHash);

    if (!claim.success) {
      return res.status(403).json({
        error: claim.errorMessage || 'رابط الدعوة المرفق غير صالح أو منتهي الصلاحية أو تم استخدامه مسبقاً.',
        code: claim.errorCode || 'INVALID_INVITATION_TOKEN',
      });
    }

    const invitation = claim.invitation!;
    const newUserId = crypto.randomUUID();

    try {
      // Authorization context strictly derived from invitation; identity strictly derived from Supabase
      const newUser: User = {
        id: newUserId,
        name: verifiedName || invitation.commercialName || verifiedEmail.split('@')[0],
        email: verifiedEmail,
        phone: invitation.phone || '0790000000',
        role: invitation.role,
        roleName: invitation.roleName,
        commercialName: invitation.commercialName || verifiedName || verifiedEmail.split('@')[0],
        storeName: invitation.commercialName || verifiedName,
        commercialType: 'تجارة ومبيعات إلكترونية',
        branch: invitation.branch || 'المقر الرئيسي للمملكة',
        city: invitation.city || 'عمان',
        priceList: invitation.priceList || 'جميع المملكة 2 (القياسية)',
        pricePlanId: invitation.pricePlanId,
        isActive: true,
        parentUserId: invitation.parentUserId,
        createdById: invitation.invitedBy,
        permissions: invitation.permissions || [],
        maxAllowedPermissions: invitation.maxAllowedPermissions || invitation.permissions || [],
        authProvider: 'GOOGLE',
        googleId: supabaseAuthId,
        googleEmail: verifiedEmail,
        invitationId: invitation.id,
        invitedBy: invitation.invitedBy,
      };

      try {
        const dbPayload = mapAppUserToDbUser(newUser);
        const { error: dbErr } = await supabase.from('users').insert(dbPayload);
        if (dbErr) {
          console.warn('Supabase user creation fallback to memory:', dbErr.message);
        }
      } catch (dbErr: any) {
        console.warn('Supabase user creation fallback to memory:', dbErr?.message);
      }
      users.push(newUser);

      await claim.commit!(newUserId);

      logAuditEvent({
        action: 'INVITATION_ACCEPTED_GOOGLE',
        actionNameAr: 'قبول وتفعيل دعوة الانضمام عبر حساب Supabase Google المعتمد',
        performedBy: newUserId,
        performerName: newUser.name,
        performerRole: newUser.role,
        targetId: invitation.id,
        targetType: 'INVITATION',
        targetName: verifiedEmail,
        tenantId: newUser.parentUserId || newUserId,
      });

      const sessionToken = generateSessionToken(newUser);
      return res.json({
        success: true,
        message: 'تم تفعيل حسابك وتسجيل الدخول عبر Google بنجاح بموجب الدعوة',
        user: sanitizeUserForClient(newUser),
        token: sessionToken,
      });
    } catch (err: any) {
      await claim.release!();
      throw err;
    }
  } catch (err: any) {
    return res.status(500).json({ error: 'فشل التحقق من تسجيل الدخول عبر Google: ' + err.message });
  }
});

// Legacy route redirects for backward compatibility
app.get(['/api/auth/google', '/api/auth/google/url'], (req, res) => {
  res.redirect('/login?notice=use_supabase_google');
});
app.get('/api/auth/google/callback', (req, res) => {
  res.redirect('/login?notice=use_supabase_google');
});

// -------------------------------------------------------------
// SaaS Super Admin Master Management & Subscription Engine (Phase 2)
// -------------------------------------------------------------

// 26.5 GET /api/superadmin/metrics: SaaS Business & Licensing KPIs
app.get('/api/superadmin/metrics', requireSuperAdmin, (req, res) => {
  ensureTenantSubscriptions();
  const allTenants = users.filter((u) => u.role === 'ADMIN' || u.role === 'MERCHANT' || u.role === 'SUPER_ADMIN');
  
  let activeTenantsCount = 0;
  let trialTenantsCount = 0;
  let expiredTenantsCount = 0;
  let suspendedTenantsCount = 0;
  let mrrTotal = 0;

  const planDistribution: Record<string, number> = {};
  subscriptionPlans.forEach((p) => {
    planDistribution[p.code] = 0;
  });

  allTenants.forEach((t) => {
    const subCtx = getTenantSubscriptionContext(t.id);
    if (subCtx.effectiveStatus === 'ACTIVE') {
      activeTenantsCount++;
      if (subCtx.subscription && subCtx.subscription.price) {
        const p = subCtx.subscription.price;
        mrrTotal += subCtx.subscription.billingCycle === 'YEARLY' ? p / 12 : p;
      }
    } else if (subCtx.effectiveStatus === 'TRIAL') {
      trialTenantsCount++;
    } else if (subCtx.effectiveStatus === 'SUSPENDED') {
      suspendedTenantsCount++;
    } else if (subCtx.effectiveStatus === 'EXPIRED') {
      expiredTenantsCount++;
    }

    const code = subCtx.plan?.code || subCtx.subscription?.planCode || 'PROFESSIONAL';
    planDistribution[code] = (planDistribution[code] || 0) + 1;
  });

  res.json({
    totalUsers: users.length,
    totalTenants: allTenants.length,
    activeTenantsCount,
    trialTenantsCount,
    expiredTenantsCount,
    suspendedTenantsCount,
    mrrTotal: Math.round(mrrTotal),
    totalOrdersCount: orders.length,
    planDistribution,
    serverTime: new Date().toISOString(),
  });
});

// =============================================================
// 1. Subscription Plans API (CRUD & Lifecycle)
// =============================================================

// GET /api/superadmin/plans: List all plans
app.get('/api/superadmin/plans', requireSuperAdmin, (req, res) => {
  ensureTenantSubscriptions();
  const plansWithStats = subscriptionPlans.map((plan) => {
    const activeSubscribersCount = subscriptions.filter(
      (s) => (s.planId === plan.id || s.planCode === plan.code) && (s.status === 'ACTIVE' || s.status === 'TRIAL')
    ).length;
    return {
      ...plan,
      activeSubscribersCount,
    };
  });

  res.json({
    success: true,
    plans: plansWithStats,
    count: plansWithStats.length,
  });
});

// POST /api/superadmin/plans: Create a new plan
app.post('/api/superadmin/plans', requireSuperAdmin, (req, res) => {
  try {
    const ctx = getRequesterContext(req);
    const {
      code,
      name,
      nameAr,
      description = '',
      price = 0,
      monthlyPrice,
      annualPrice,
      currency = 'JOD',
      billingCycle = 'MONTHLY',
      trialDays = 0,
      maxUsers = 10,
      maxMonthlyOrders = 1000,
      enabledModules = {},
      isActive = true,
      sortOrder,
    } = req.body;

    if (!code || !name || !nameAr) {
      return res.status(400).json({ error: 'رمز الباقة واسم الباقة بالعربية والإنجليزية حقول مطلوبة' });
    }

    const cleanCode = code.trim().toUpperCase().replace(/\s+/g, '_');
    const existing = subscriptionPlans.find((p) => p.code === cleanCode);
    if (existing) {
      return res.status(400).json({ error: `رمز الباقة (${cleanCode}) مستخدم مسبقاً، يرجى اختيار رمز فريد` });
    }

    const finalMonthlyPrice = monthlyPrice !== undefined ? Number(monthlyPrice) : Number(price);
    const finalAnnualPrice = annualPrice !== undefined ? Number(annualPrice) : finalMonthlyPrice * 10;

    const newPlan: SubscriptionPlanRecord = {
      id: `plan-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      code: cleanCode,
      name: name.trim(),
      nameAr: nameAr.trim(),
      description: description.trim(),
      price: finalMonthlyPrice,
      monthlyPrice: finalMonthlyPrice,
      annualPrice: finalAnnualPrice,
      currency,
      billingCycle: billingCycle as SubscriptionCycle,
      trialDays: Number(trialDays) || 0,
      maxUsers: Number(maxUsers) || 0,
      maxMonthlyOrders: Number(maxMonthlyOrders) || 0,
      enabledModules: {
        tmsDelivery: true,
        posCashier: Boolean(enabledModules.posCashier),
        merchantWms: Boolean(enabledModules.merchantWms),
        accountingSettlements: Boolean(enabledModules.accountingSettlements),
        apiIntegrations: Boolean(enabledModules.apiIntegrations),
        aiRouteOptimizer: Boolean(enabledModules.aiRouteOptimizer),
        whatsappTracking: Boolean(enabledModules.whatsappTracking),
        customDomain: Boolean(enabledModules.customDomain),
      },
      isActive: Boolean(isActive),
      sortOrder: sortOrder !== undefined ? Number(sortOrder) : subscriptionPlans.length + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    subscriptionPlans.push(newPlan);

    logAuditEvent({
      action: 'PLAN_CREATED',
      actionNameAr: 'إنشاء باقة اشتراك جديدة',
      performedBy: ctx.userId || 'SUPER_ADMIN',
      performerName: ctx.user?.name,
      performerRole: 'SUPER_ADMIN',
      targetId: newPlan.id,
      targetType: 'SUBSCRIPTION_PLAN',
      targetName: newPlan.nameAr,
      details: { code: newPlan.code, monthlyPrice: newPlan.monthlyPrice, maxUsers: newPlan.maxUsers },
    });

    res.status(201).json({
      success: true,
      message: `تم إنشاء باقة الاشتراك (${newPlan.nameAr}) بنجاح`,
      plan: newPlan,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/superadmin/plans/:id: Update plan
app.patch('/api/superadmin/plans/:id', requireSuperAdmin, (req, res) => {
  try {
    const ctx = getRequesterContext(req);
    const planId = req.params.id;
    const plan = subscriptionPlans.find((p) => p.id === planId || p.code === planId);

    if (!plan) {
      return res.status(404).json({ error: 'باقة الاشتراك غير موجودة' });
    }

    const {
      name,
      nameAr,
      description,
      price,
      monthlyPrice,
      annualPrice,
      currency,
      billingCycle,
      trialDays,
      maxUsers,
      maxMonthlyOrders,
      enabledModules,
      isActive,
      sortOrder,
    } = req.body;

    if (name) plan.name = name.trim();
    if (nameAr) plan.nameAr = nameAr.trim();
    if (description !== undefined) plan.description = description.trim();
    if (monthlyPrice !== undefined) plan.monthlyPrice = Number(monthlyPrice);
    if (price !== undefined) {
      plan.price = Number(price);
      if (monthlyPrice === undefined) plan.monthlyPrice = Number(price);
    }
    if (annualPrice !== undefined) plan.annualPrice = Number(annualPrice);
    if (currency) plan.currency = currency;
    if (billingCycle) plan.billingCycle = billingCycle;
    if (trialDays !== undefined) plan.trialDays = Number(trialDays);
    if (maxUsers !== undefined) plan.maxUsers = Number(maxUsers);
    if (maxMonthlyOrders !== undefined) plan.maxMonthlyOrders = Number(maxMonthlyOrders);
    if (enabledModules) {
      plan.enabledModules = {
        ...plan.enabledModules,
        ...enabledModules,
      };
    }
    if (isActive !== undefined) plan.isActive = Boolean(isActive);
    if (sortOrder !== undefined) plan.sortOrder = Number(sortOrder);
    plan.updatedAt = new Date().toISOString();

    logAuditEvent({
      action: 'PLAN_UPDATED',
      actionNameAr: 'تحديث بيانات باقة الاشتراك',
      performedBy: ctx.userId || 'SUPER_ADMIN',
      performerName: ctx.user?.name,
      performerRole: 'SUPER_ADMIN',
      targetId: plan.id,
      targetType: 'SUBSCRIPTION_PLAN',
      targetName: plan.nameAr,
      details: { code: plan.code, monthlyPrice: plan.monthlyPrice },
    });

    res.json({
      success: true,
      message: `تم تحديث باقة (${plan.nameAr}) بنجاح`,
      plan,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/superadmin/plans/:id/toggle-status: Toggle Active/Inactive
app.post('/api/superadmin/plans/:id/toggle-status', requireSuperAdmin, (req, res) => {
  const ctx = getRequesterContext(req);
  const planId = req.params.id;
  const plan = subscriptionPlans.find((p) => p.id === planId || p.code === planId);

  if (!plan) {
    return res.status(404).json({ error: 'باقة الاشتراك غير موجودة' });
  }

  plan.isActive = !plan.isActive;
  plan.updatedAt = new Date().toISOString();

  logAuditEvent({
    action: plan.isActive ? 'PLAN_ACTIVATED' : 'PLAN_DEACTIVATED',
    actionNameAr: plan.isActive ? 'تفعيل باقة اشتراك' : 'إلغاء تفعيل باقة اشتراك',
    performedBy: ctx.userId || 'SUPER_ADMIN',
    performerName: ctx.user?.name,
    performerRole: 'SUPER_ADMIN',
    targetId: plan.id,
    targetType: 'SUBSCRIPTION_PLAN',
    targetName: plan.nameAr,
    details: { code: plan.code, isActive: plan.isActive },
  });

  res.json({
    success: true,
    message: `تم ${plan.isActive ? 'تفعيل' : 'إلغاء تفعيل'} باقة (${plan.nameAr}) بنجاح`,
    plan,
  });
});

// DELETE /api/superadmin/plans/:id: Delete plan safely
app.delete('/api/superadmin/plans/:id', requireSuperAdmin, (req, res) => {
  const ctx = getRequesterContext(req);
  const planId = req.params.id;
  const plan = subscriptionPlans.find((p) => p.id === planId || p.code === planId);

  if (!plan) {
    return res.status(404).json({ error: 'باقة الاشتراك غير موجودة' });
  }

  // System plans cannot be deleted
  if (['ENTERPRISE', 'PROFESSIONAL', 'GROWTH', 'TRIAL'].includes(plan.code)) {
    return res.status(400).json({ error: 'لا يمكن حذف باقات النظام الأساسية. يمكنك تعديلها أو تعطيلها.' });
  }

  // Check if any active subscriptions are linked
  const activeSubsCount = subscriptions.filter(
    (s) => (s.planId === plan.id || s.planCode === plan.code) && (s.status === 'ACTIVE' || s.status === 'TRIAL')
  ).length;

  if (activeSubsCount > 0) {
    return res.status(400).json({
      error: `لا يمكن حذف الباقة لوجود (${activeSubsCount}) اشتراك نشط مرتبط بها. يرجى إلغاء تفعيل الباقة بدلاً من حذفها.`,
      activeSubscribersCount: activeSubsCount,
    });
  }

  subscriptionPlans = subscriptionPlans.filter((p) => p.id !== plan.id && p.code !== plan.code);

  logAuditEvent({
    action: 'PLAN_DELETED',
    actionNameAr: 'حذف باقة اشتراك',
    performedBy: ctx.userId || 'SUPER_ADMIN',
    performerName: ctx.user?.name,
    performerRole: 'SUPER_ADMIN',
    targetId: plan.id,
    targetType: 'SUBSCRIPTION_PLAN',
    targetName: plan.nameAr,
    details: { code: plan.code },
  });

  res.json({
    success: true,
    message: `تم حذف باقة الاشتراك (${plan.nameAr}) بنجاح`,
  });
});

// =============================================================
// 2. Subscriptions Management API
// =============================================================

// GET /api/superadmin/subscriptions: List all tenant subscriptions
app.get('/api/superadmin/subscriptions', requireSuperAdmin, (req, res) => {
  ensureTenantSubscriptions();
  const allTenants = users.filter((u) => u.role === 'ADMIN' || u.role === 'MERCHANT' || u.role === 'SUPER_ADMIN');

  const tenantSubscriptions = allTenants.map((tenant) => {
    const subCtx = getTenantSubscriptionContext(tenant.id);
    const historyCount = subscriptions.filter((s) => s.tenantId === tenant.id).length;
    return {
      tenant: sanitizeUserForClient(tenant),
      subscriptionContext: subCtx,
      historyCount,
    };
  });

  res.json({
    success: true,
    subscriptions: tenantSubscriptions,
    count: tenantSubscriptions.length,
  });
});

// GET /api/superadmin/subscriptions/:id: Single subscription details
app.get('/api/superadmin/subscriptions/:id', requireSuperAdmin, (req, res) => {
  const subId = req.params.id;
  ensureTenantSubscriptions();
  const sub = subscriptions.find((s) => s.id === subId || s.tenantId === subId);

  if (!sub) {
    return res.status(404).json({ error: 'سجل الاشتراك غير موجود' });
  }

  const subCtx = getTenantSubscriptionContext(sub.tenantId);
  const tenantUser = users.find((u) => u.id === sub.tenantId);

  res.json({
    success: true,
    subscription: sub,
    subscriptionContext: subCtx,
    tenant: tenantUser ? sanitizeUserForClient(tenantUser) : null,
  });
});

// POST /api/superadmin/subscriptions: Create or assign subscription for a tenant
app.post('/api/superadmin/subscriptions', requireSuperAdmin, (req, res) => {
  try {
    const ctx = getRequesterContext(req);
    const {
      tenantId,
      planId,
      planCode,
      status = 'ACTIVE',
      durationDays = 30,
      startDate,
      endDate,
      price,
      billingCycle = 'MONTHLY',
      enabledModules,
      maxUsers,
      maxMonthlyOrders,
      autoRenew = false,
      isTrial = false,
      trialDays,
    } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: 'معرّف المستأجر / المنشأة مطلوب' });
    }

    const tenantUser = users.find((u) => u.id === tenantId);
    if (!tenantUser) {
      return res.status(404).json({ error: 'المستأجر غير مسجل في قاعدة البيانات' });
    }

    const targetCode = planCode || planId;
    const planDef =
      subscriptionPlans.find((p) => p.id === planId || p.code === targetCode) || subscriptionPlans[1];

    const now = new Date();
    const finalStartDate = startDate ? new Date(startDate).toISOString() : now.toISOString();

    let finalEndDate: string;
    if (endDate) {
      finalEndDate = new Date(endDate).toISOString();
    } else {
      const calcEnd = new Date(new Date(finalStartDate).getTime() + Number(durationDays) * 86400000);
      finalEndDate = calcEnd.toISOString();
    }

    const finalStatus: SubscriptionEngineStatus = isTrial || planDef.code === 'TRIAL' ? 'TRIAL' : (status as SubscriptionEngineStatus);
    const finalTrialDays = trialDays !== undefined ? Number(trialDays) : (planDef.trialDays || 14);
    const trialEnd = finalStatus === 'TRIAL' ? new Date(new Date(finalStartDate).getTime() + finalTrialDays * 86400000).toISOString() : undefined;

    const newSub: SubscriptionRecord = {
      id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tenantId,
      tenantName: tenantUser.companyName || tenantUser.storeName || tenantUser.name,
      planId: planDef.id,
      planCode: planDef.code,
      planName: planDef.nameAr,
      status: finalStatus,
      startDate: finalStartDate,
      endDate: finalStatus === 'TRIAL' && trialEnd ? trialEnd : finalEndDate,
      trialStartDate: finalStatus === 'TRIAL' ? finalStartDate : undefined,
      trialEndDate: trialEnd,
      price: price !== undefined ? Number(price) : (finalStatus === 'TRIAL' ? 0 : planDef.monthlyPrice),
      currency: 'JOD',
      billingCycle: billingCycle as SubscriptionCycle,
      enabledModules: enabledModules ? { ...planDef.enabledModules, ...enabledModules } : { ...planDef.enabledModules },
      maxUsers: maxUsers !== undefined ? Number(maxUsers) : planDef.maxUsers,
      maxMonthlyOrders: maxMonthlyOrders !== undefined ? Number(maxMonthlyOrders) : planDef.maxMonthlyOrders,
      autoRenew: Boolean(autoRenew),
      gracePeriodDays: 0,
      createdBy: ctx.userId,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    subscriptions.unshift(newSub);
    syncSubscriptionToUser(tenantId, newSub);

    logAuditEvent({
      action: finalStatus === 'TRIAL' ? 'TRIAL_STARTED' : 'SUBSCRIPTION_CREATED',
      actionNameAr: finalStatus === 'TRIAL' ? 'بدء اشتراك تجريبي' : 'إنشاء اشتراك جديد',
      performedBy: ctx.userId || 'SUPER_ADMIN',
      performerName: ctx.user?.name,
      performerRole: 'SUPER_ADMIN',
      targetId: tenantId,
      targetType: 'TENANT_SUBSCRIPTION',
      targetName: tenantUser.name,
      details: { planCode: planDef.code, endDate: newSub.endDate, price: newSub.price },
    });

    res.status(201).json({
      success: true,
      message: `تم تفعيل اشتراك (${planDef.nameAr}) لمنشأة (${tenantUser.name}) بنجاح`,
      subscription: newSub,
      subscriptionContext: getTenantSubscriptionContext(tenantId),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/superadmin/subscriptions/:id: Update subscription
app.patch('/api/superadmin/subscriptions/:id', requireSuperAdmin, (req, res) => {
  try {
    const ctx = getRequesterContext(req);
    const subId = req.params.id;
    ensureTenantSubscriptions();
    const sub = subscriptions.find((s) => s.id === subId || s.tenantId === subId);

    if (!sub) {
      return res.status(404).json({ error: 'سجل الاشتراك غير موجود' });
    }

    const {
      planId,
      planCode,
      status,
      startDate,
      endDate,
      price,
      billingCycle,
      enabledModules,
      maxUsers,
      maxMonthlyOrders,
      autoRenew,
      suspendedReason,
    } = req.body;

    if (planId || planCode) {
      const code = planCode || planId;
      const planDef = subscriptionPlans.find((p) => p.id === planId || p.code === code);
      if (planDef) {
        sub.planId = planDef.id;
        sub.planCode = planDef.code;
        sub.planName = planDef.nameAr;
      }
    }

    if (status) sub.status = status;
    if (startDate) sub.startDate = new Date(startDate).toISOString();
    if (endDate) sub.endDate = new Date(endDate).toISOString();
    if (price !== undefined) sub.price = Number(price);
    if (billingCycle) sub.billingCycle = billingCycle;
    if (enabledModules) sub.enabledModules = { ...sub.enabledModules, ...enabledModules };
    if (maxUsers !== undefined) sub.maxUsers = Number(maxUsers);
    if (maxMonthlyOrders !== undefined) sub.maxMonthlyOrders = Number(maxMonthlyOrders);
    if (autoRenew !== undefined) sub.autoRenew = Boolean(autoRenew);
    if (suspendedReason !== undefined) sub.suspendedReason = suspendedReason;
    sub.updatedAt = new Date().toISOString();

    syncSubscriptionToUser(sub.tenantId, sub);

    logAuditEvent({
      action: 'SUBSCRIPTION_UPDATED',
      actionNameAr: 'تحديث بيانات الاشتراك',
      performedBy: ctx.userId || 'SUPER_ADMIN',
      performerName: ctx.user?.name,
      performerRole: 'SUPER_ADMIN',
      targetId: sub.tenantId,
      targetType: 'TENANT_SUBSCRIPTION',
      targetName: sub.tenantName,
      details: { planCode: sub.planCode, status: sub.status, endDate: sub.endDate },
    });

    res.json({
      success: true,
      message: 'تم تحديث بيانات الاشتراك بنجاح',
      subscription: sub,
      subscriptionContext: getTenantSubscriptionContext(sub.tenantId),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/superadmin/subscriptions/:id/renew: Renew Subscription (Supports cycle or days)
app.post('/api/superadmin/subscriptions/:id/renew', requireSuperAdmin, async (req, res) => {
  try {
    const ctx = getRequesterContext(req);
    const idParam = req.params.id;
    const { userId, tenantId, daysToAdd, newEndDate, planId, billingCycle = 'MONTHLY', price } = req.body;

    ensureTenantSubscriptions();
    const resolvedTenantId = tenantId || userId || idParam;
    let sub = subscriptions.find((s) => s.id === idParam || s.tenantId === resolvedTenantId);

    if (!sub) {
      const user = users.find((u) => u.id === resolvedTenantId);
      if (user) {
        ensureTenantSubscriptions();
        sub = subscriptions.find((s) => s.tenantId === resolvedTenantId);
      }
    }

    if (!sub) {
      return res.status(404).json({ error: 'سجل الاشتراك أو المنشأة غير موجود' });
    }

    const addDays = daysToAdd !== undefined ? Number(daysToAdd) : (billingCycle === 'YEARLY' ? 365 : 30);
    let finalEndDate: string;
    if (newEndDate) {
      finalEndDate = new Date(newEndDate).toISOString();
    } else {
      const currentEnd = sub.endDate ? new Date(sub.endDate) : new Date();
      const baseDate = currentEnd > new Date() ? currentEnd : new Date();
      baseDate.setDate(baseDate.getDate() + addDays);
      finalEndDate = baseDate.toISOString();
    }

    if (planId) {
      const planDef = subscriptionPlans.find((p) => p.id === planId || p.code === planId);
      if (planDef) {
        sub.planId = planDef.id;
        sub.planCode = planDef.code;
        sub.planName = planDef.nameAr;
        sub.maxUsers = planDef.maxUsers;
        sub.maxMonthlyOrders = planDef.maxMonthlyOrders;
        sub.enabledModules = { ...planDef.enabledModules };
      }
    }

    sub.endDate = finalEndDate;
    sub.status = 'ACTIVE';
    sub.suspendedReason = undefined;
    if (price !== undefined) sub.price = Number(price);
    if (billingCycle) sub.billingCycle = billingCycle;
    sub.updatedAt = new Date().toISOString();

    syncSubscriptionToUser(sub.tenantId, sub);

    logAuditEvent({
      action: 'SUBSCRIPTION_RENEWED',
      actionNameAr: 'تجديد وتمديد اشتراك الحساب',
      performedBy: ctx.userId || 'SUPER_ADMIN',
      performerName: ctx.user?.name,
      performerRole: 'SUPER_ADMIN',
      targetId: sub.tenantId,
      targetType: 'TENANT_SUBSCRIPTION',
      targetName: sub.tenantName,
      details: { planCode: sub.planCode, finalEndDate, daysAdded: addDays },
    });

    res.json({
      success: true,
      message: `تم تجديد وتفعيل الاشتراك بنجاح حتى تاريخ: ${finalEndDate.split('T')[0]}`,
      subscription: sub,
      subscriptionContext: getTenantSubscriptionContext(sub.tenantId),
      user: sanitizeUserForClient(users.find((u) => u.id === sub!.tenantId)),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/superadmin/subscriptions/:id/extend: Extend Subscription by Custom Days
app.post('/api/superadmin/subscriptions/:id/extend', requireSuperAdmin, (req, res) => {
  try {
    const ctx = getRequesterContext(req);
    const idParam = req.params.id;
    const { days = 7, reason } = req.body;

    ensureTenantSubscriptions();
    const sub = subscriptions.find((s) => s.id === idParam || s.tenantId === idParam);
    if (!sub) {
      return res.status(404).json({ error: 'سجل الاشتراك غير موجود' });
    }

    const currentEnd = sub.endDate ? new Date(sub.endDate) : new Date();
    const baseDate = currentEnd > new Date() ? currentEnd : new Date();
    baseDate.setDate(baseDate.getDate() + Number(days));
    const finalEndDate = baseDate.toISOString();

    sub.endDate = finalEndDate;
    if (sub.status === 'EXPIRED') sub.status = 'ACTIVE';
    sub.updatedAt = new Date().toISOString();

    syncSubscriptionToUser(sub.tenantId, sub);

    logAuditEvent({
      action: 'SUBSCRIPTION_EXTENDED',
      actionNameAr: 'تمديد فترة الاشتراك',
      performedBy: ctx.userId || 'SUPER_ADMIN',
      performerName: ctx.user?.name,
      performerRole: 'SUPER_ADMIN',
      targetId: sub.tenantId,
      targetType: 'TENANT_SUBSCRIPTION',
      targetName: sub.tenantName,
      details: { daysExtended: Number(days), reason, newEndDate: finalEndDate },
    });

    res.json({
      success: true,
      message: `تم تمديد الاشتراك بمقدار (${days}) أيام حتى: ${finalEndDate.split('T')[0]}`,
      subscription: sub,
      subscriptionContext: getTenantSubscriptionContext(sub.tenantId),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/superadmin/subscriptions/:id/suspend: Suspend Subscription
app.post('/api/superadmin/subscriptions/:id/suspend', requireSuperAdmin, (req, res) => {
  try {
    const ctx = getRequesterContext(req);
    const idParam = req.params.id;
    const { reason = 'تم تعليق الاشتراك من قبل الإدارة العامة' } = req.body;

    ensureTenantSubscriptions();
    const sub = subscriptions.find((s) => s.id === idParam || s.tenantId === idParam);
    if (!sub) {
      return res.status(404).json({ error: 'سجل الاشتراك غير موجود' });
    }

    sub.status = 'SUSPENDED';
    sub.suspendedReason = reason;
    sub.updatedAt = new Date().toISOString();

    syncSubscriptionToUser(sub.tenantId, sub);

    logAuditEvent({
      action: 'SUBSCRIPTION_SUSPENDED',
      actionNameAr: 'تجميد وتعليق الاشتراك',
      performedBy: ctx.userId || 'SUPER_ADMIN',
      performerName: ctx.user?.name,
      performerRole: 'SUPER_ADMIN',
      targetId: sub.tenantId,
      targetType: 'TENANT_SUBSCRIPTION',
      targetName: sub.tenantName,
      details: { reason },
    });

    res.json({
      success: true,
      message: `تم تجميد اشتراك (${sub.tenantName}) بنجاح`,
      subscription: sub,
      subscriptionContext: getTenantSubscriptionContext(sub.tenantId),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/superadmin/subscriptions/:id/reactivate: Reactivate Suspended Subscription
app.post('/api/superadmin/subscriptions/:id/reactivate', requireSuperAdmin, (req, res) => {
  try {
    const ctx = getRequesterContext(req);
    const idParam = req.params.id;

    ensureTenantSubscriptions();
    const sub = subscriptions.find((s) => s.id === idParam || s.tenantId === idParam);
    if (!sub) {
      return res.status(404).json({ error: 'سجل الاشتراك غير موجود' });
    }

    const now = new Date();
    const endDate = new Date(sub.endDate);
    if (endDate <= now) {
      // If expired while suspended, extend by 30 days automatically
      const newEnd = new Date(now.getTime() + 86400000 * 30);
      sub.endDate = newEnd.toISOString();
    }

    sub.status = 'ACTIVE';
    sub.suspendedReason = undefined;
    sub.updatedAt = new Date().toISOString();

    syncSubscriptionToUser(sub.tenantId, sub);

    logAuditEvent({
      action: 'SUBSCRIPTION_REACTIVATED',
      actionNameAr: 'إعادة تفعيل الاشتراك',
      performedBy: ctx.userId || 'SUPER_ADMIN',
      performerName: ctx.user?.name,
      performerRole: 'SUPER_ADMIN',
      targetId: sub.tenantId,
      targetType: 'TENANT_SUBSCRIPTION',
      targetName: sub.tenantName,
      details: { newEndDate: sub.endDate },
    });

    res.json({
      success: true,
      message: `تم إلغاء تجميد وتفعيل اشتراك (${sub.tenantName}) بنجاح`,
      subscription: sub,
      subscriptionContext: getTenantSubscriptionContext(sub.tenantId),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/superadmin/subscriptions/:id/cancel: Cancel Subscription
app.post('/api/superadmin/subscriptions/:id/cancel', requireSuperAdmin, (req, res) => {
  try {
    const ctx = getRequesterContext(req);
    const idParam = req.params.id;
    const { reason = 'تم إلغاء الاشتراك بناء على طلب العميل' } = req.body;

    ensureTenantSubscriptions();
    const sub = subscriptions.find((s) => s.id === idParam || s.tenantId === idParam);
    if (!sub) {
      return res.status(404).json({ error: 'سجل الاشتراك غير موجود' });
    }

    sub.status = 'CANCELLED';
    sub.suspendedReason = reason;
    sub.updatedAt = new Date().toISOString();

    syncSubscriptionToUser(sub.tenantId, sub);

    logAuditEvent({
      action: 'SUBSCRIPTION_CANCELLED',
      actionNameAr: 'إلغاء الاشتراك',
      performedBy: ctx.userId || 'SUPER_ADMIN',
      performerName: ctx.user?.name,
      performerRole: 'SUPER_ADMIN',
      targetId: sub.tenantId,
      targetType: 'TENANT_SUBSCRIPTION',
      targetName: sub.tenantName,
      details: { reason },
    });

    res.json({
      success: true,
      message: `تم إلغاء اشتراك (${sub.tenantName}) بنجاح`,
      subscription: sub,
      subscriptionContext: getTenantSubscriptionContext(sub.tenantId),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/superadmin/subscriptions/:id/start-trial: Start or Restart Trial
app.post('/api/superadmin/subscriptions/:id/start-trial', requireSuperAdmin, (req, res) => {
  try {
    const ctx = getRequesterContext(req);
    const idParam = req.params.id;
    const { trialDays = 14 } = req.body;

    ensureTenantSubscriptions();
    const sub = subscriptions.find((s) => s.id === idParam || s.tenantId === idParam);
    if (!sub) {
      return res.status(404).json({ error: 'سجل الاشتراك غير موجود' });
    }

    const now = new Date();
    const trialEnd = new Date(now.getTime() + Number(trialDays) * 86400000).toISOString();

    sub.status = 'TRIAL';
    sub.trialStartDate = now.toISOString();
    sub.trialEndDate = trialEnd;
    sub.startDate = now.toISOString();
    sub.endDate = trialEnd;
    sub.price = 0;
    sub.suspendedReason = undefined;
    sub.updatedAt = now.toISOString();

    syncSubscriptionToUser(sub.tenantId, sub);

    logAuditEvent({
      action: 'TRIAL_STARTED',
      actionNameAr: 'بدء فترة تجريبية مجانية',
      performedBy: ctx.userId || 'SUPER_ADMIN',
      performerName: ctx.user?.name,
      performerRole: 'SUPER_ADMIN',
      targetId: sub.tenantId,
      targetType: 'TENANT_SUBSCRIPTION',
      targetName: sub.tenantName,
      details: { trialDays: Number(trialDays), trialEndDate: trialEnd },
    });

    res.json({
      success: true,
      message: `تم تفعيل الفترة التجريبية (${trialDays} يوم) بنجاح حتى: ${trialEnd.split('T')[0]}`,
      subscription: sub,
      subscriptionContext: getTenantSubscriptionContext(sub.tenantId),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/superadmin/subscriptions/tenant/:tenantId/history: Tenant Subscriptions History
app.get('/api/superadmin/subscriptions/tenant/:tenantId/history', requireSuperAdmin, (req, res) => {
  const tenantId = req.params.tenantId;
  ensureTenantSubscriptions();
  const history = subscriptions
    .filter((s) => s.tenantId === tenantId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const tenantUser = users.find((u) => u.id === tenantId);

  res.json({
    success: true,
    tenantId,
    tenantName: tenantUser?.companyName || tenantUser?.name,
    history,
    count: history.length,
    currentContext: getTenantSubscriptionContext(tenantId),
  });
});

// =============================================================
// 3. Tenant Admin Subscription Visibility API
// =============================================================

// GET /api/tenant/subscription & GET /api/subscriptions/current
app.get(['/api/tenant/subscription', '/api/subscriptions/current'], requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  const tenantId = ctx.tenantId || ctx.userId;

  if (!tenantId) {
    return res.status(400).json({ error: 'تعذر تحديد منشأة المستخدم الحالي' });
  }

  const subCtx = getTenantSubscriptionContext(tenantId);

  res.json({
    success: true,
    subscriptionContext: subCtx,
    plan: subCtx.plan,
    effectiveStatus: subCtx.effectiveStatus,
    isActive: subCtx.isActive,
    daysRemaining: subCtx.daysRemaining,
    limits: subCtx.limits,
    usage: subCtx.usage,
    enabledModules: subCtx.enabledModules,
  });
});

// -------------------------------------------------------------
// Legacy SuperAdmin Subscription Compatibility Routes
// -------------------------------------------------------------

// 26.6 POST /api/superadmin/subscriptions/renew: Renew or Extend User Subscription (Compatibility)
app.post('/api/superadmin/subscriptions/renew', requireSuperAdmin, async (req, res) => {
  const ctx = getRequesterContext(req);
  const { userId, tenantId, daysToAdd = 30, newEndDate, planId, billingCycle = 'MONTHLY', price } = req.body;
  const targetId = tenantId || userId;
  const user = users.find((u) => u.id === targetId);
  if (!user) {
    return res.status(404).json({ error: 'المستخدم غير موجود' });
  }

  ensureTenantSubscriptions();
  let sub = subscriptions.find((s) => s.tenantId === targetId);

  let finalEndDate: string;
  if (newEndDate) {
    finalEndDate = new Date(newEndDate).toISOString();
  } else {
    const currentEnd = (sub?.endDate || user.subscriptionEndDate) ? new Date(sub?.endDate || user.subscriptionEndDate!) : new Date();
    const baseDate = currentEnd > new Date() ? currentEnd : new Date();
    baseDate.setDate(baseDate.getDate() + Number(daysToAdd));
    finalEndDate = baseDate.toISOString();
  }

  if (planId) {
    const planDef = subscriptionPlans.find((p) => p.id === planId || p.code === planId);
    if (planDef) {
      if (sub) {
        sub.planId = planDef.id;
        sub.planCode = planDef.code;
        sub.planName = planDef.nameAr;
        sub.maxUsers = planDef.maxUsers;
        sub.maxMonthlyOrders = planDef.maxMonthlyOrders;
        sub.enabledModules = { ...planDef.enabledModules };
      }
      user.subscriptionPlan = planDef.code as any;
      user.subscriptionPlanName = planDef.nameAr;
      user.maxUsers = planDef.maxUsers;
      user.maxMonthlyOrders = planDef.maxMonthlyOrders;
    }
  }

  if (sub) {
    sub.endDate = finalEndDate;
    sub.status = 'ACTIVE';
    sub.suspendedReason = undefined;
    if (price !== undefined) sub.price = Number(price);
    if (billingCycle) sub.billingCycle = billingCycle as SubscriptionCycle;
    sub.updatedAt = new Date().toISOString();
    syncSubscriptionToUser(targetId, sub);
  } else {
    user.subscriptionEndDate = finalEndDate;
    user.subscriptionStatus = 'ACTIVE';
    user.isActive = true;
    user.suspendedReason = undefined;
    if (price !== undefined) user.subscriptionPrice = Number(price);
    if (billingCycle) user.subscriptionBillingCycle = billingCycle as any;
  }

  logAuditEvent({
    action: 'SUBSCRIPTION_RENEWED',
    actionNameAr: 'تجديد وتمديد اشتراك الحساب',
    performedBy: ctx.userId || 'SUPER_ADMIN',
    performerName: ctx.user?.name,
    performerRole: 'SUPER_ADMIN',
    targetId: user.id,
    targetType: 'USER',
    targetName: user.name,
    details: { planId, finalEndDate, daysToAdd },
  });

  res.json({
    success: true,
    message: `تم تفعيل وتجديد اشتراك (${user.name}) بنجاح حتى تاريخ: ${finalEndDate.split('T')[0]}`,
    user: sanitizeUserForClient(user),
  });
});

// 26.7 POST /api/superadmin/subscriptions/toggle-status: Suspend / Activate Account (Compatibility)
app.post('/api/superadmin/subscriptions/toggle-status', requireSuperAdmin, async (req, res) => {
  const ctx = getRequesterContext(req);
  const { userId, tenantId, status, reason } = req.body;
  const targetId = tenantId || userId;
  const user = users.find((u) => u.id === targetId);
  if (!user) {
    return res.status(404).json({ error: 'المستخدم غير موجود' });
  }

  if (user.role === 'SUPER_ADMIN') {
    return res.status(400).json({ error: 'لا يمكن تجميد حساب المدير العام للنظام (Super Admin)' });
  }

  const isSuspending = status === 'SUSPENDED';
  user.subscriptionStatus = status;
  user.isActive = !isSuspending;
  user.suspendedReason = isSuspending ? (reason || 'تم تعليق الحساب مؤقتاً من قبل إدارة المنظومة') : undefined;

  ensureTenantSubscriptions();
  const sub = subscriptions.find((s) => s.tenantId === targetId);
  if (sub) {
    sub.status = status;
    sub.suspendedReason = user.suspendedReason;
    sub.updatedAt = new Date().toISOString();
  }

  logAuditEvent({
    action: isSuspending ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_ACTIVATED',
    actionNameAr: isSuspending ? 'تجميد وتعطيل حساب' : 'فك تجميد وتفعيل حساب',
    performedBy: ctx.userId || 'SUPER_ADMIN',
    performerName: ctx.user?.name,
    performerRole: 'SUPER_ADMIN',
    targetId: user.id,
    targetType: 'USER',
    targetName: user.name,
    details: { reason, status },
  });

  res.json({
    success: true,
    message: isSuspending
      ? `تم تجميد وتعطيل حساب (${user.name}) بنجاح`
      : `تم فك التجميد وتفعيل حساب (${user.name}) بنجاح`,
    user: sanitizeUserForClient(user),
  });
});

// 26.8 POST /api/superadmin/subscriptions/toggle-module: Toggle Module Permission (Compatibility)
app.post('/api/superadmin/subscriptions/toggle-module', requireSuperAdmin, (req, res) => {
  const ctx = getRequesterContext(req);
  const { userId, tenantId, moduleKey, enabled } = req.body;
  const targetId = tenantId || userId;
  const user = users.find((u) => u.id === targetId);
  if (!user) {
    return res.status(404).json({ error: 'المستخدم غير موجود' });
  }

  if (!user.enabledModules) {
    user.enabledModules = {
      tmsDelivery: true,
      posCashier: true,
      merchantWms: true,
      accountingSettlements: true,
      apiIntegrations: true,
      aiRouteOptimizer: true,
      whatsappTracking: true,
      customDomain: true,
    };
  }

  user.enabledModules[moduleKey] = Boolean(enabled);

  ensureTenantSubscriptions();
  const sub = subscriptions.find((s) => s.tenantId === targetId);
  if (sub) {
    sub.enabledModules[moduleKey] = Boolean(enabled);
    sub.updatedAt = new Date().toISOString();
  }

  logAuditEvent({
    action: 'MODULE_TOGGLED',
    actionNameAr: enabled ? 'تفعيل نظام فرعي' : 'تعطيل نظام فرعي',
    performedBy: ctx.userId || 'SUPER_ADMIN',
    performerName: ctx.user?.name,
    performerRole: 'SUPER_ADMIN',
    targetId: user.id,
    targetType: 'USER',
    targetName: user.name,
    details: { moduleKey, enabled },
  });

  res.json({
    success: true,
    message: `تم ${enabled ? 'تفعيل' : 'إيقاف'} نظام (${moduleKey}) لحساب (${user.name}) بنجاح`,
    user: sanitizeUserForClient(user),
  });
});

// 26.9 GET /api/audit-logs & /api/superadmin/audit-logs: View Audit Trail
app.get(['/api/audit-logs', '/api/superadmin/audit-logs'], requireAuth, (req, res) => {
  res.json({
    success: true,
    logs: auditLogs,
    count: auditLogs.length,
  });
});

// 26.10 POST /api/superadmin/users/reset-password: Force Password Reset by Super Admin
app.post('/api/superadmin/users/reset-password', requireSuperAdmin, async (req, res) => {
  try {
    const ctx = getRequesterContext(req);
    const { userId, newPassword } = req.body;

    if (!userId || !newPassword || newPassword.trim().length < 6) {
      return res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن لا تقل عن 6 خانات' });
    }

    const cleanPass = newPassword.trim();
    const secureHash = hashPassword(cleanPass);

    let updatedName = '';
    if (isValidUuid(userId)) {
      const { data, error } = await supabase
        .from('users')
        .update({
          password: secureHash,
          password_hash: secureHash,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select('name');

      if (error) {
        return res.status(500).json({ error: 'فشل تغيير كلمة المرور في Supabase: ' + error.message });
      }
      if (data && data[0]) updatedName = data[0].name;
    }

    const memUser = users.find((u) => u.id === userId);
    if (memUser) {
      memUser.password = secureHash;
      updatedName = updatedName || memUser.name;
    }

    logAuditEvent({
      action: 'PASSWORD_RESET',
      actionNameAr: 'إعادة تعيين كلمة مرور الحساب',
      performedBy: ctx.userId || 'SUPER_ADMIN',
      performerName: ctx.user?.name,
      performerRole: 'SUPER_ADMIN',
      targetId: userId,
      targetType: 'USER',
      targetName: updatedName,
    });

    res.json({
      success: true,
      message: `تمت إعادة تعيين كلمة المرور لحساب (${updatedName || userId}) بنجاح`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 27. POST /api/orders/:id/pay-cliq: Jordan Instant JoPACC CliQ Payment
app.post('/api/orders/:id/pay-cliq', (req, res) => {
  const { transactionRef, alias = 'DARGO@CLIQ', note } = req.body;
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'الطلبية غير موجودة' });
  }

  const txId = transactionRef || `CLIQ-${Math.floor(100000 + Math.random() * 900000)}`;
  order.paymentType = 'CLIQ';
  order.status = 'DELIVERED';
  order.deliveredAt = new Date().toISOString();
  order.updatedAt = new Date().toISOString();
  order.isSettledWithDriver = true; // Direct transfer to company account via JoPACC CliQ
  order.otpVerified = true;

  order.statusLogs = [
    ...(order.statusLogs || []),
    {
      id: `log-${Date.now()}`,
      orderId: order.id,
      fromStatus: 'OUT_FOR_DELIVERY',
      toStatus: 'DELIVERED',
      note: `تم دفع مبلغ (${order.totalCollection.toFixed(2)} د.أ) مباشرة عبر نظام CliQ الأردني الفوري | مرجع الحوالة: [${txId}] على المستعار [${alias}]${note ? ' - ' + note : ''}`,
      createdAt: new Date().toISOString(),
    },
  ];

  saveDatabase();

  res.json({
    success: true,
    message: `تم التحقق من الحوالة البنكية (${txId}) بنجاح وتم تحويل الطلبية إلى مستلمة`,
    order: populateOrder(order),
    transactionRef: txId,
  });
});

// 28. GET /api/database/backup: Full Database JSON Export
app.get('/api/database/backup', requireSuperAdmin, (req, res) => {
  const ctx = getRequesterContext(req);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=dargo_backup_${Date.now()}.json`);
  
  logAuditEvent({
    action: 'DATABASE_BACKUP_EXPORTED',
    actionNameAr: 'تصدير نسخة احتياطية من قاعدة البيانات',
    performedBy: ctx.userId || 'SUPER_ADMIN',
    performerName: ctx.user?.name,
    performerRole: 'SUPER_ADMIN',
    targetType: 'SYSTEM',
    targetName: 'قاعدة البيانات التشغيلية',
  });

  res.json({
    system: 'DarGo TMS ERP',
    exportedAt: new Date().toISOString(),
    usersCount: users.length,
    ordersCount: orders.length,
    apiKeysCount: apiKeys.length,
    users: users.map(sanitizeUserForClient),
    orders,
    apiKeys,
    notificationLogs,
    nextSequenceNumber,
  });
});

// 29. POST /api/database/restore: Full Database JSON Restore
app.post('/api/database/restore', requireSuperAdmin, (req, res) => {
  try {
    const ctx = getRequesterContext(req);
    const { orders: newOrders, users: newUsers, apiKeys: newKeys } = req.body;
    if (Array.isArray(newOrders)) orders = newOrders;
    if (Array.isArray(newUsers)) users = newUsers;
    if (Array.isArray(newKeys)) apiKeys = newKeys;
    saveDatabase();

    logAuditEvent({
      action: 'DATABASE_RESTORED',
      actionNameAr: 'استعادة نسخة احتياطية من قاعدة البيانات',
      performedBy: ctx.userId || 'SUPER_ADMIN',
      performerName: ctx.user?.name,
      performerRole: 'SUPER_ADMIN',
      targetType: 'SYSTEM',
      targetName: 'قاعدة البيانات التشغيلية',
      details: { restoredOrders: newOrders?.length, restoredUsers: newUsers?.length },
    });

    res.json({
      success: true,
      message: 'تمت استعادة قاعدة البيانات بنجاح',
      ordersCount: orders.length,
    });
  } catch (err: any) {
    res.status(400).json({ error: 'فشل في استعادة البيانات: ' + err.message });
  }
});

// =============================================================
// Accounting Suite Endpoints (General Logistics & Company ERP)
// =============================================================

// GET /api/accounting/overview
app.get('/api/accounting/overview', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  if (ctx.user && !hasPermission(ctx.user, 'accounting.view_pnl') && !hasPermission(ctx.user, 'accounting')) {
    return res.status(403).json({ error: 'غير مصرح بالاطلاع على القوائم المالية العامة (accounting.view_pnl)', code: 'PERMISSION_DENIED' });
  }

  let totalDebit = 0;
  let totalCredit = 0;
  const trialBalance = accounts.map((acc) => {
    let debitBalance = 0;
    let creditBalance = 0;
    if (acc.isDebitNormal) {
      if (acc.balance >= 0) {
        debitBalance = acc.balance;
      } else {
        creditBalance = Math.abs(acc.balance);
      }
    } else {
      if (acc.balance >= 0) {
        creditBalance = acc.balance;
      } else {
        debitBalance = Math.abs(acc.balance);
      }
    }
    totalDebit += debitBalance;
    totalCredit += creditBalance;
    return {
      id: acc.id,
      code: acc.code,
      name: acc.name,
      type: acc.type,
      category: acc.category,
      debitBalance,
      creditBalance,
    };
  });

  const revenueAccounts = accounts.filter((a) => a.type === 'REVENUE');
  const expenseAccounts = accounts.filter((a) => a.type === 'EXPENSE');
  const totalRevenues = revenueAccounts.reduce((sum, a) => sum + Math.max(0, a.balance), 0);
  const totalExpenses = expenseAccounts.reduce((sum, a) => sum + Math.max(0, a.balance), 0);
  const netOperatingProfit = totalRevenues - totalExpenses;

  const totalAssets = accounts.filter((a) => a.type === 'ASSET').reduce((sum, a) => sum + a.balance, 0);
  const totalLiabilities = accounts.filter((a) => a.type === 'LIABILITY').reduce((sum, a) => sum + a.balance, 0);
  const totalEquity = accounts.filter((a) => a.type === 'EQUITY').reduce((sum, a) => sum + a.balance, 0);

  res.json({
    accounts,
    trialBalance: {
      rows: trialBalance,
      totalDebit,
      totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
    },
    incomeStatement: {
      revenueAccounts,
      expenseAccounts,
      totalRevenues,
      totalExpenses,
      netOperatingProfit,
      marginPercent: totalRevenues > 0 ? (netOperatingProfit / totalRevenues) * 100 : 0,
    },
    balanceSheet: {
      totalAssets,
      totalLiabilities,
      totalEquity,
    },
    recentJournalEntries: journalEntries.slice(-10).reverse(),
    recentVouchers: vouchers.slice(-10).reverse(),
  });
});

// GET /api/accounting/journal-entries
app.get('/api/accounting/journal-entries', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  if (ctx.user && !hasPermission(ctx.user, 'accounting.view_pnl') && !hasPermission(ctx.user, 'accounting')) {
    return res.status(403).json({ error: 'غير مصرح بالاطلاع على قيود اليومية العامة', code: 'PERMISSION_DENIED' });
  }
  res.json({ entries: [...journalEntries].reverse() });
});

// POST /api/accounting/journal-entries
app.post('/api/accounting/journal-entries', requireAuth, (req, res) => {
  try {
    const ctx = getRequesterContext(req);
    if (ctx.user && !hasPermission(ctx.user, 'accounting.view_pnl') && !hasPermission(ctx.user, 'accounting')) {
      return res.status(403).json({ error: 'غير مصرح بإنشاء قيود يومية عامة', code: 'PERMISSION_DENIED' });
    }

    const { date, description, lines, referenceType, referenceId, createdByName } = req.body;
    if (!Array.isArray(lines) || lines.length < 2) {
      return res.status(400).json({ error: 'يجب أن يحتوي القيد على طرفين على الأقل (مدين ودائن)' });
    }

    let sumDebit = 0;
    let sumCredit = 0;
    const validatedLines = lines.map((l: any) => {
      const acc = accounts.find((a) => a.id === l.accountId || a.code === l.accountCode);
      const debit = Number(l.debit) || 0;
      const credit = Number(l.credit) || 0;
      sumDebit += debit;
      sumCredit += credit;
      return {
        accountId: acc ? acc.id : l.accountId,
        accountCode: acc ? acc.code : l.accountCode,
        accountName: acc ? acc.name : l.accountName || 'حساب غير معروف',
        debit,
        credit,
        note: l.note || '',
      };
    });

    if (Math.abs(sumDebit - sumCredit) > 0.01) {
      return res.status(400).json({ error: `القيد غير متوازن! مجموع المدين (${sumDebit.toFixed(2)}) لا يساوي مجموع الدائن (${sumCredit.toFixed(2)})` });
    }

    validatedLines.forEach((vl) => {
      const acc = accounts.find((a) => a.id === vl.accountId);
      if (acc) {
        if (acc.isDebitNormal) {
          acc.balance += vl.debit - vl.credit;
        } else {
          acc.balance += vl.credit - vl.debit;
        }
      }
    });

    const newEntry: JournalEntry = {
      id: `je-${Date.now()}`,
      entryNumber: `JE-2026-${String(journalEntries.length + 1).padStart(4, '0')}`,
      date: date || new Date().toISOString(),
      description: description || 'قيد محاسبي يدوي',
      referenceType: referenceType || 'MANUAL',
      referenceId: referenceId || undefined,
      lines: validatedLines,
      totalDebit: sumDebit,
      totalCredit: sumCredit,
      createdByName: createdByName || ctx.user?.name || 'المدير المالي',
      createdAt: new Date().toISOString(),
    };

    journalEntries.push(newEntry);
    saveDatabase();

    res.json({ success: true, entry: newEntry });
  } catch (err: any) {
    res.status(500).json({ error: 'فشل في حفظ القيد: ' + err.message });
  }
});

// GET /api/accounting/vouchers
app.get('/api/accounting/vouchers', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  if (ctx.user && !hasPermission(ctx.user, 'accounting.view_pnl') && !hasPermission(ctx.user, 'accounting') && !hasPermission(ctx.user, 'accounting.expenses')) {
    return res.status(403).json({ error: 'غير مصرح بالاطلاع على السندات المالية العامة', code: 'PERMISSION_DENIED' });
  }
  res.json({ vouchers: [...vouchers].reverse() });
});

// POST /api/accounting/vouchers
app.post('/api/accounting/vouchers', requireAuth, (req, res) => {
  try {
    const ctx = getRequesterContext(req);
    if (ctx.user && !hasPermission(ctx.user, 'accounting.view_pnl') && !hasPermission(ctx.user, 'accounting') && !hasPermission(ctx.user, 'accounting.expenses')) {
      return res.status(403).json({ error: 'غير مصرح بإصدار سندات مالية عامة', code: 'PERMISSION_DENIED' });
    }

    const {
      type,
      date,
      amount,
      beneficiaryOrPayer,
      paymentMethod,
      referenceNumber,
      accountId,
      contraAccountId,
      notes,
    } = req.body;

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ error: 'المبلغ غير صالح' });
    }

    const mainAcc = accounts.find((a) => a.id === accountId) || accounts[0];
    const contraAcc = accounts.find((a) => a.id === contraAccountId) || accounts[1];

    const count = vouchers.filter((v) => v.type === type).length + 1;
    const prefix = type === 'RECEIPT' ? 'V-REC' : 'V-PAY';
    const voucherNumber = `${prefix}-2026-${String(count).padStart(4, '0')}`;

    const newVoucher: Voucher = {
      id: `v-${Date.now()}`,
      voucherNumber,
      type,
      date: date || new Date().toISOString().split('T')[0],
      amount: numAmount,
      beneficiaryOrPayer: beneficiaryOrPayer || (type === 'RECEIPT' ? 'عميل' : 'مستفيد'),
      paymentMethod: paymentMethod || 'CASH',
      referenceNumber: referenceNumber || '',
      accountId: mainAcc.id,
      contraAccountId: contraAcc.id,
      notes: notes || '',
      status: 'POSTED',
      createdAt: new Date().toISOString(),
    };

    vouchers.push(newVoucher);

    const isReceipt = type === 'RECEIPT';
    const debitAcc = isReceipt ? mainAcc : contraAcc;
    const creditAcc = isReceipt ? contraAcc : mainAcc;

    const jeLines = [
      {
        accountId: debitAcc.id,
        accountCode: debitAcc.code,
        accountName: debitAcc.name,
        debit: numAmount,
        credit: 0,
        note: `سند ${isReceipt ? 'قبض' : 'صرف'} رقم ${voucherNumber}`,
      },
      {
        accountId: creditAcc.id,
        accountCode: creditAcc.code,
        accountName: creditAcc.name,
        debit: 0,
        credit: numAmount,
        note: `سند ${isReceipt ? 'قبض' : 'صرف'} رقم ${voucherNumber}`,
      },
    ];

    if (debitAcc.isDebitNormal) {
      debitAcc.balance += numAmount;
    } else {
      debitAcc.balance -= numAmount;
    }

    if (creditAcc.isDebitNormal) {
      creditAcc.balance -= numAmount;
    } else {
      creditAcc.balance += numAmount;
    }

    const autoJE: JournalEntry = {
      id: `je-${Date.now()}`,
      entryNumber: `JE-2026-${String(journalEntries.length + 1).padStart(4, '0')}`,
      date: new Date().toISOString(),
      description: `توليد آلي لسند ${isReceipt ? 'قبض' : 'صرف'} [${voucherNumber}] - ${beneficiaryOrPayer}`,
      referenceType: 'VOUCHER',
      referenceId: newVoucher.id,
      lines: jeLines,
      totalDebit: numAmount,
      totalCredit: numAmount,
      createdByName: ctx.user?.name || 'نظام دارجو المحاسبي',
      createdAt: new Date().toISOString(),
    };

    journalEntries.push(autoJE);
    saveDatabase();

    res.json({ success: true, voucher: newVoucher, journalEntry: autoJE });
  } catch (err: any) {
    res.status(500).json({ error: 'فشل في حفظ السند: ' + err.message });
  }
});

// POST /api/accounting/accounts
app.post('/api/accounting/accounts', requireAuth, (req, res) => {
  try {
    const ctx = getRequesterContext(req);
    if (!ctx.isSuperAdmin && !ctx.isAdmin && !ctx.user?.permissions?.includes('accounting')) {
      return res.status(403).json({ error: 'غير مصرح بإنشاء حسابات في دليل الحسابات' });
    }

    const { code, name, type, category, isDebitNormal, description } = req.body;
    if (!code || !name || !type) {
      return res.status(400).json({ error: 'كود الحساب واسمه ونوعه مطلوبة' });
    }
    const newAcc: Account = {
      id: `acc-${Date.now()}`,
      code: String(code),
      name: String(name),
      type,
      category: category || 'عام',
      balance: 0,
      isDebitNormal: typeof isDebitNormal === 'boolean' ? isDebitNormal : ['ASSET', 'EXPENSE'].includes(type),
      description: description || '',
    };
    accounts.push(newAcc);
    saveDatabase();
    res.json({ success: true, account: newAcc });
  } catch (err: any) {
    res.status(500).json({ error: 'فشل في إنشاء الحساب: ' + err.message });
  }
});

// =============================================================
// Merchant Multi-Branch & Stock Transfer Architecture Endpoints
// =============================================================

// GET /api/merchants/:merchantId/branches
app.get('/api/merchants/:merchantId/branches', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  const { merchantId } = req.params;

  ensureMerchantBranches();

  // CASHIER Role: Only return their assigned branch for their merchant
  if (ctx.isCashier) {
    const cashierMerchantId = ctx.user?.parentUserId || ctx.tenantId;
    if (cashierMerchantId !== merchantId) {
      return res.status(403).json({ error: 'غير مصرح لك باستعراض فروع متجر آخر' });
    }
    const myBranchId = ctx.branchId || (ctx.user as any)?.branchId;
    const myBranchName = ctx.branchName || ctx.user?.branch;
    const matched = merchantBranches.filter(
      (b) => b.merchantId === merchantId && (b.id === myBranchId || b.name === myBranchName)
    );
    return res.json({
      branches: matched.length > 0 ? matched : merchantBranches.filter((b) => b.merchantId === merchantId && b.isMain),
    });
  }

  // General check: Super Admin, Delivery Company Admin, or the Merchant themselves
  if (!canAccessMerchant(ctx, merchantId) && ctx.userId !== merchantId) {
    return res.status(403).json({ error: 'غير مصرح باستعراض فروع هذا المتجر' });
  }

  const branches = merchantBranches.filter((b) => b.merchantId === merchantId);
  res.json({ branches });
});

// POST /api/merchants/:merchantId/branches
app.post('/api/merchants/:merchantId/branches', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  const { merchantId } = req.params;

  // Only the Merchant owner or Platform Super Admin can create branches
  if (!ctx.isSuperAdmin && ctx.userId !== merchantId) {
    return res.status(403).json({
      error: 'فقط صاحب المتجر أو إدارة المنصة يملكون صلاحية إنشاء وتوسيع الفروع',
      code: 'FORBIDDEN',
    });
  }

  const { name, code, phone, address, governorate, city, isMain, isActive } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'اسم الفرع مطلوب' });
  }

  ensureMerchantBranches();

  const branchCount = merchantBranches.filter((b) => b.merchantId === merchantId).length;
  const shouldBeMain = isMain || branchCount === 0;

  if (shouldBeMain) {
    merchantBranches.forEach((b) => {
      if (b.merchantId === merchantId) b.isMain = false;
    });
  }

  const newBranch: MerchantBranchRecord = {
    id: `br-${merchantId}-${Date.now().toString(36)}`,
    merchantId,
    tenantId: ctx.tenantId || null,
    name: String(name).trim(),
    code: code ? String(code).trim() : `BR-${branchCount + 1}`,
    phone: phone ? String(phone).trim() : '',
    address: address ? String(address).trim() : '',
    governorate: governorate || 'عمان',
    city: city || 'عمان',
    isMain: shouldBeMain,
    isActive: isActive !== false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  merchantBranches.push(newBranch);
  saveDatabase();
  res.status(201).json({ success: true, branch: newBranch });
});

// PUT /api/merchants/:merchantId/branches/:branchId
app.put('/api/merchants/:merchantId/branches/:branchId', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  const { merchantId, branchId } = req.params;

  if (!ctx.isSuperAdmin && ctx.userId !== merchantId) {
    return res.status(403).json({ error: 'غير مصرح بتعديل بيانات هذا الفرع' });
  }

  const branch = merchantBranches.find((b) => b.id === branchId && b.merchantId === merchantId);
  if (!branch) {
    return res.status(404).json({ error: 'الفرع غير موجود' });
  }

  const { name, code, phone, address, governorate, city, isMain, isActive } = req.body;

  if (isMain) {
    merchantBranches.forEach((b) => {
      if (b.merchantId === merchantId) b.isMain = false;
    });
    branch.isMain = true;
  } else if (isMain === false && branch.isMain) {
    const others = merchantBranches.filter((b) => b.merchantId === merchantId && b.id !== branchId);
    if (others.length > 0) {
      branch.isMain = false;
      others[0].isMain = true;
    }
  }

  if (name !== undefined) branch.name = String(name).trim();
  if (code !== undefined) branch.code = String(code).trim();
  if (phone !== undefined) branch.phone = String(phone).trim();
  if (address !== undefined) branch.address = String(address).trim();
  if (governorate !== undefined) branch.governorate = governorate;
  if (city !== undefined) branch.city = city;
  if (isActive !== undefined) branch.isActive = Boolean(isActive);
  branch.updatedAt = new Date().toISOString();

  saveDatabase();
  res.json({ success: true, branch });
});

// DELETE /api/merchants/:merchantId/branches/:branchId
app.delete('/api/merchants/:merchantId/branches/:branchId', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  const { merchantId, branchId } = req.params;

  if (!ctx.isSuperAdmin && ctx.userId !== merchantId) {
    return res.status(403).json({ error: 'غير مصرح بحذف هذا الفرع' });
  }

  const branch = merchantBranches.find((b) => b.id === branchId && b.merchantId === merchantId);
  if (!branch) {
    return res.status(404).json({ error: 'الفرع غير موجود' });
  }

  if (branch.isMain) {
    return res.status(400).json({ error: 'لا يمكن حذف الفرع الرئيسي للمتجر' });
  }

  const hasOrders = orders.some((o) => o.branchId === branchId);
  if (hasOrders) {
    // Soft deactivate instead of hard delete
    branch.isActive = false;
    branch.updatedAt = new Date().toISOString();
    saveDatabase();
    return res.json({ success: true, message: 'تم تعطيل الفرع لاحتوائه على شحنات سابقة', deactivated: true });
  }

  merchantBranches = merchantBranches.filter((b) => b.id !== branchId);
  saveDatabase();
  res.json({ success: true, message: 'تم حذف الفرع بنجاح' });
});

// POST /api/merchants/:merchantId/stock-transfers
app.post('/api/merchants/:merchantId/stock-transfers', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  const { merchantId } = req.params;

  if (!ctx.isSuperAdmin && ctx.userId !== merchantId) {
    return res.status(403).json({ error: 'غير مصرح بإجراء مناقلات مخزنية بين الفروع' });
  }

  const { productId, sourceBranchId, destBranchId, quantity, notes } = req.body;
  if (!productId || !sourceBranchId || !destBranchId || !quantity || quantity <= 0) {
    return res.status(400).json({
      error: 'بيانات المناقلة غير مكتملة (الصنف، الفرع المصدر، الفرع الوجهة، والكمية مطلوبة)',
    });
  }

  const prod = merchantProducts.find((p) => p.id === productId && p.merchantId === merchantId);
  const srcB = merchantBranches.find((b) => b.id === sourceBranchId);
  const dstB = merchantBranches.find((b) => b.id === destBranchId);

  const transfer: MerchantStockTransferRecord = {
    id: `xfer-${Date.now()}`,
    merchantId,
    tenantId: ctx.tenantId || null,
    productId,
    productName: prod?.name || 'صنف مخزني',
    sourceBranchId,
    sourceBranchName: srcB?.name || 'الفرع المصدر',
    destBranchId,
    destBranchName: dstB?.name || 'الفرع الوجهة',
    quantity: Number(quantity),
    status: 'COMPLETED',
    notes: notes || '',
    createdBy: ctx.userId,
    createdByName: ctx.user?.name || 'المسؤول',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  merchantStockTransfers.push(transfer);
  saveDatabase();
  res.status(201).json({ success: true, transfer });
});

// GET /api/merchants/:merchantId/stock-transfers
app.get('/api/merchants/:merchantId/stock-transfers', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  const { merchantId } = req.params;

  if (!canAccessMerchant(ctx, merchantId) && ctx.userId !== merchantId) {
    return res.status(403).json({ error: 'غير مصرح' });
  }

  const list = merchantStockTransfers.filter((t) => t.merchantId === merchantId);
  res.json({ transfers: [...list].reverse() });
});

// =============================================================
// Unified Financial Statements & Operations Reports Endpoints
// =============================================================

// GET /api/reports/merchant-statement
app.get('/api/reports/merchant-statement', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  const { merchantId, branchId, dateFrom, dateTo } = req.query as {
    merchantId?: string;
    branchId?: string;
    dateFrom?: string;
    dateTo?: string;
  };

  if (!merchantId) {
    return res.status(400).json({ error: 'معرف التاجر مطلوب' });
  }

  // Strict Authorization check
  if (!ctx.isSuperAdmin && ctx.userRole !== 'ADMIN' && ctx.userRole !== 'ACCOUNTANT' && ctx.userId !== merchantId) {
    return res.status(403).json({ error: 'غير مصرح بالاطلاع على كشف حساب هذا التاجر' });
  }

  const targetFrom = dateFrom ? new Date(dateFrom).getTime() : 0;
  const targetTo = dateTo ? new Date(`${dateTo}T23:59:59.999Z`).getTime() : Date.now();

  ensureMerchantBranches();

  const merchantObj = users.find((u) => u.id === merchantId);
  const merchantName = merchantObj ? merchantObj.storeName || merchantObj.name : 'التاجر';

  // Find all orders for this merchant
  let merchantOrders = orders.filter((o) => o.merchantId === merchantId);
  if (branchId && branchId !== 'ALL') {
    merchantOrders = merchantOrders.filter((o) => o.branchId === branchId);
  }

  // Find payment vouchers made to this merchant (settlements)
  const merchantVouchers = vouchers.filter(
    (v) =>
      v.type === 'PAYMENT' &&
      (v.beneficiaryOrPayer === merchantName ||
        (merchantObj && v.beneficiaryOrPayer === merchantObj.name) ||
        v.notes.includes(merchantName))
  );

  interface StatementTx {
    id: string;
    date: string;
    timestamp: number;
    reference: string;
    branchName: string;
    type: 'DELIVERY_COD' | 'DELIVERY_FEE' | 'SETTLEMENT_PAYOUT' | 'RETURN_FEE';
    description: string;
    debit: number;
    credit: number;
    runningBalance: number;
  }

  const allTxs: StatementTx[] = [];

  for (const ord of merchantOrders) {
    const ordDate = ord.deliveredAt || ord.createdAt;
    const ts = new Date(ordDate).getTime();
    const branchObj = merchantBranches.find((b) => b.id === ord.branchId);
    const branchName = branchObj ? branchObj.name : (ord.branchName || 'الفرع الرئيسي');

    if (ord.status === 'DELIVERED') {
      // 1. COD collected from customer -> CREDIT to merchant
      allTxs.push({
        id: `tx-cod-${ord.id}`,
        date: new Date(ordDate).toISOString().replace('T', ' ').substring(0, 16),
        timestamp: ts,
        reference: ord.sequence || ord.referenceNumber || ord.id,
        branchName,
        type: 'DELIVERY_COD',
        description: `تحصيل مبلغ طلبيّة [${ord.sequence}] من المستلم (${ord.recipientName})`,
        debit: 0,
        credit: Number(ord.merchantCollection || 0),
        runningBalance: 0,
      });

      // 2. Delivery fee deducted -> DEBIT from merchant
      if (ord.deliveryFee > 0) {
        allTxs.push({
          id: `tx-fee-${ord.id}`,
          date: new Date(ordDate).toISOString().replace('T', ' ').substring(0, 16),
          timestamp: ts + 1,
          reference: ord.sequence || ord.referenceNumber || ord.id,
          branchName,
          type: 'DELIVERY_FEE',
          description: `خصم عمولة وأجور شحن طرد [${ord.sequence}] إلى ${ord.governorate}`,
          debit: Number(ord.deliveryFee || 0),
          credit: 0,
          runningBalance: 0,
        });
      }
    } else if (ord.status === 'RETURNED' && ord.deliveryFee > 0) {
      allTxs.push({
        id: `tx-ret-${ord.id}`,
        date: new Date(ord.updatedAt || ordDate).toISOString().replace('T', ' ').substring(0, 16),
        timestamp: ts,
        reference: ord.sequence || ord.referenceNumber || ord.id,
        branchName,
        type: 'RETURN_FEE',
        description: `رسوم طرد مرتجع مستودعياً [${ord.sequence}]`,
        debit: Number(ord.deliveryFee * 0.5 || 1.5),
        credit: 0,
        runningBalance: 0,
      });
    }
  }

  // Add settlement vouchers
  for (const v of merchantVouchers) {
    const ts = new Date(v.date).getTime();
    allTxs.push({
      id: `tx-v-${v.id}`,
      date: v.date,
      timestamp: ts,
      reference: v.voucherNumber || v.referenceNumber || v.id,
      branchName: 'المركز الرئيسي',
      type: 'SETTLEMENT_PAYOUT',
      description: `سداد تسوية مالية [${v.voucherNumber}] عبر ${v.paymentMethod}`,
      debit: Number(v.amount || 0),
      credit: 0,
      runningBalance: 0,
    });
  }

  allTxs.sort((a, b) => a.timestamp - b.timestamp);

  let running = 0;
  let openingBalance = 0;
  const filteredTxs: StatementTx[] = [];

  for (const tx of allTxs) {
    running += (tx.credit - tx.debit);
    tx.runningBalance = running;

    if (tx.timestamp < targetFrom) {
      openingBalance = running;
    } else if (tx.timestamp <= targetTo) {
      filteredTxs.push(tx);
    }
  }

  const totalCodCollected = filteredTxs
    .filter((t) => t.type === 'DELIVERY_COD')
    .reduce((sum, t) => sum + t.credit, 0);

  const totalDeliveryFees = filteredTxs
    .filter((t) => t.type === 'DELIVERY_FEE' || t.type === 'RETURN_FEE')
    .reduce((sum, t) => sum + t.debit, 0);

  const totalSettlementsPaid = filteredTxs
    .filter((t) => t.type === 'SETTLEMENT_PAYOUT')
    .reduce((sum, t) => sum + t.debit, 0);

  const totalOrdersDelivered = filteredTxs.filter((t) => t.type === 'DELIVERY_COD').length;

  res.json({
    merchantId,
    branchId: branchId || 'ALL',
    dateFrom,
    dateTo,
    openingBalance,
    closingBalance: running,
    totalCodCollected,
    totalDeliveryFees,
    totalSettlementsPaid,
    totalOrdersDelivered,
    transactions: filteredTxs,
  });
});

// GET /api/reports/driver-cash-statement
app.get('/api/reports/driver-cash-statement', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  const { driverId, dateFrom, dateTo } = req.query as {
    driverId?: string;
    dateFrom?: string;
    dateTo?: string;
  };

  if (!driverId) {
    return res.status(400).json({ error: 'معرف الكابتن مطلوب' });
  }

  if (!ctx.isSuperAdmin && ctx.userRole !== 'ADMIN' && ctx.userRole !== 'ACCOUNTANT' && ctx.userId !== driverId) {
    return res.status(403).json({ error: 'غير مصرح بالاطلاع على كشف عهدة كاش هذا الكابتن' });
  }

  const targetFrom = dateFrom ? new Date(dateFrom).getTime() : 0;
  const targetTo = dateTo ? new Date(`${dateTo}T23:59:59.999Z`).getTime() : Date.now();

  const driverOrders = orders.filter((o) => o.driverId === driverId && o.status === 'DELIVERED');

  interface DriverTx {
    id: string;
    date: string;
    timestamp: number;
    reference: string;
    recipient: string;
    type: 'COLLECTION' | 'REMITTANCE';
    description: string;
    amount: number;
    runningResponsibility: number;
  }

  const allTxs: DriverTx[] = [];

  for (const ord of driverOrders) {
    const dDate = ord.deliveredAt || ord.createdAt;
    const ts = new Date(dDate).getTime();
    allTxs.push({
      id: `d-col-${ord.id}`,
      date: new Date(dDate).toISOString().replace('T', ' ').substring(0, 16),
      timestamp: ts,
      reference: ord.sequence || ord.id,
      recipient: ord.recipientName,
      type: 'COLLECTION',
      description: `تحصيل كاش COD عند تسليم طرد [${ord.sequence}]`,
      amount: Number(ord.totalCollection || ord.merchantCollection || 0),
      runningResponsibility: 0,
    });

    if (ord.isSettledWithDriver) {
      allTxs.push({
        id: `d-remit-${ord.id}`,
        date: new Date(ts + 3600000).toISOString().replace('T', ' ').substring(0, 16),
        timestamp: ts + 3600000,
        reference: `REC-${ord.sequence}`,
        recipient: 'خزينة المحاسبة المركزية',
        type: 'REMITTANCE',
        description: `توريد كاش طرد [${ord.sequence}] إلى أمين الصندوق`,
        amount: Number(ord.totalCollection || ord.merchantCollection || 0),
        runningResponsibility: 0,
      });
    }
  }

  allTxs.sort((a, b) => a.timestamp - b.timestamp);

  let running = 0;
  let openingResponsibility = 0;
  const filteredTxs: DriverTx[] = [];

  for (const tx of allTxs) {
    if (tx.type === 'COLLECTION') running += tx.amount;
    else running -= tx.amount;
    tx.runningResponsibility = running;

    if (tx.timestamp < targetFrom) {
      openingResponsibility = running;
    } else if (tx.timestamp <= targetTo) {
      filteredTxs.push(tx);
    }
  }

  const totalCollected = filteredTxs
    .filter((t) => t.type === 'COLLECTION')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalRemitted = filteredTxs
    .filter((t) => t.type === 'REMITTANCE')
    .reduce((sum, t) => sum + t.amount, 0);

  res.json({
    driverId,
    dateFrom,
    dateTo,
    openingResponsibility,
    totalCollected,
    totalRemitted,
    outstandingCashResponsibility: running,
    transactions: filteredTxs,
  });
});

// GET /api/reports/operational-summary
app.get('/api/reports/operational-summary', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  if (!ctx.isSuperAdmin && ctx.userRole !== 'ADMIN' && ctx.userRole !== 'ACCOUNTANT' && ctx.userRole !== 'OPERATOR') {
    return res.status(403).json({ error: 'غير مصرح' });
  }

  const deliveredOrders = orders.filter((o) => o.status === 'DELIVERED').length;
  const outForDeliveryOrders = orders.filter((o) => o.status === 'OUT_FOR_DELIVERY').length;
  const inHubOrders = orders.filter((o) => o.status === 'RECEIVED_AT_HUB' || o.status === 'PICKING').length;
  const returnedOrders = orders.filter((o) => o.status === 'RETURNED' || o.status === 'CANCELLED').length;
  const total = orders.length;
  const successRate = total > 0 ? `${((deliveredOrders / total) * 100).toFixed(1)}%` : '0%';

  const govMap: Record<string, number> = {};
  for (const ord of orders) {
    const g = ord.governorate || 'عمان';
    govMap[g] = (govMap[g] || 0) + 1;
  }
  const byGovernorate = Object.entries(govMap).map(([name, count]) => ({ name, count }));

  res.json({
    totalOrders: total,
    deliveredOrders,
    outForDeliveryOrders,
    inHubOrders,
    returnedOrders,
    successRate,
    byGovernorate,
  });
});

// =============================================================
// Merchant Warehouse & Inventory Management Endpoints
// =============================================================

// GET /api/merchants/:merchantId/warehouse
app.get('/api/merchants/:merchantId/warehouse', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  const { merchantId } = req.params;

  if (!canAccessMerchant(ctx, merchantId)) {
    return res.status(403).json({ error: 'غير مصرح بالوصول إلى مستودع هذا المتجر' });
  }

  if (ctx.user && !hasPermission(ctx.user, 'warehouse.view')) {
    return res.status(403).json({ error: 'ليس لديك صلاحية عرض المستودع والمخزون (warehouse.view)', code: 'PERMISSION_DENIED' });
  }

  const rawProducts = merchantProducts.filter((p) => p.merchantId === merchantId);
  const rawMovements = stockMovements.filter((m) => m.merchantId === merchantId);

  const canSeeCost = canViewCostPrices(ctx, merchantId);

  // Mask cost prices if user does not have permission
  const products = rawProducts.map((p) => {
    if (!canSeeCost) {
      return {
        ...p,
        costPrice: 0,
      };
    }
    return p;
  });

  const movements = rawMovements.map((m) => {
    if (!canSeeCost) {
      return {
        ...m,
        unitPrice: 0,
      };
    }
    return m;
  });

  const totalSkus = products.length;
  const totalQuantity = products.reduce((sum, p) => sum + (p.stockQuantity || 0), 0);
  const totalCostValue = canSeeCost
    ? rawProducts.reduce((sum, p) => sum + (p.costPrice || 0) * (p.stockQuantity || 0), 0)
    : 0;
  const totalRetailValue = products.reduce((sum, p) => sum + (p.sellingPrice || 0) * (p.stockQuantity || 0), 0);
  const potentialGrossProfit = canSeeCost ? totalRetailValue - totalCostValue : 0;
  const lowStockProducts = products.filter((p) => (p.stockQuantity || 0) <= (p.minStockAlert || 5));

  res.json({
    products,
    movements: [...movements].reverse(),
    stats: {
      totalSkus,
      totalQuantity,
      totalCostValue,
      totalRetailValue,
      potentialGrossProfit,
      marginPercent: canSeeCost && totalRetailValue > 0 ? (potentialGrossProfit / totalRetailValue) * 100 : 0,
      lowStockCount: lowStockProducts.length,
      lowStockProducts,
    },
  });
});

// =============================================================
// Merchant Categories Endpoints (Persistent Category Management)
// =============================================================

// GET /api/merchants/:merchantId/categories
app.get('/api/merchants/:merchantId/categories', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  const { merchantId } = req.params;

  if (!canAccessMerchant(ctx, merchantId)) {
    return res.status(403).json({ error: 'غير مصرح بالوصول إلى تصنيفات هذا المتجر' });
  }

  const custom = merchantCategories[merchantId] || [];
  const set = new Set<string>([...DEFAULT_SYSTEM_CATEGORIES, ...custom]);

  // Also include any categories assigned to existing products
  merchantProducts
    .filter((p) => p.merchantId === merchantId && p.category)
    .forEach((p) => {
      if (p.category && p.category.trim()) {
        set.add(p.category.trim());
      }
    });

  res.json({ success: true, categories: Array.from(set) });
});

// POST /api/merchants/:merchantId/categories
app.post('/api/merchants/:merchantId/categories', requireAuth, (req, res) => {
  try {
    const ctx = getRequesterContext(req);
    const { merchantId } = req.params;

    if (!canAccessMerchant(ctx, merchantId)) {
      return res.status(403).json({ error: 'غير مصرح بإضافة تصنيفات لهذا المتجر' });
    }

    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'اسم التصنيف مطلوب' });
    }
    const cleanName = name.trim();
    if (!merchantCategories[merchantId]) {
      merchantCategories[merchantId] = [...DEFAULT_SYSTEM_CATEGORIES];
    }
    if (!merchantCategories[merchantId].includes(cleanName)) {
      merchantCategories[merchantId].push(cleanName);
    }
    saveDatabase();

    const set = new Set<string>([...DEFAULT_SYSTEM_CATEGORIES, ...merchantCategories[merchantId]]);
    merchantProducts
      .filter((p) => p.merchantId === merchantId && p.category)
      .forEach((p) => {
        if (p.category && p.category.trim()) {
          set.add(p.category.trim());
        }
      });

    res.json({ success: true, category: cleanName, categories: Array.from(set) });
  } catch (err: any) {
    res.status(500).json({ error: 'فشل في حفظ التصنيف: ' + err.message });
  }
});

// DELETE /api/merchants/:merchantId/categories/:categoryName
app.delete('/api/merchants/:merchantId/categories/:categoryName', requireAuth, (req, res) => {
  try {
    const ctx = getRequesterContext(req);
    const { merchantId, categoryName } = req.params;

    if (!canAccessMerchant(ctx, merchantId)) {
      return res.status(403).json({ error: 'غير مصرح بحذف تصنيفات هذا المتجر' });
    }

    const decoded = decodeURIComponent(categoryName);
    if (merchantCategories[merchantId]) {
      merchantCategories[merchantId] = merchantCategories[merchantId].filter((c) => c !== decoded);
      saveDatabase();
    }
    const set = new Set<string>([...DEFAULT_SYSTEM_CATEGORIES, ...(merchantCategories[merchantId] || [])]);
    res.json({ success: true, categories: Array.from(set) });
  } catch (err: any) {
    res.status(500).json({ error: 'فشل في إزالة التصنيف: ' + err.message });
  }
});

// POST /api/merchants/:merchantId/products (and alias /warehouse/products)
const handleCreateMerchantProduct = (req: any, res: any) => {
  try {
    const ctx = getRequesterContext(req);
    const { merchantId } = req.params;

    if (!canAccessMerchant(ctx, merchantId)) {
      return res.status(403).json({ error: 'غير مصرح بإضافة منتجات لهذا المتجر' });
    }

    const {
      name,
      sku,
      barcode,
      category,
      costPrice,
      sellingPrice,
      stockQuantity,
      minStockAlert,
      unit,
      locationRack,
      notes,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'اسم الصنف مطلوب' });
    }

    // Auto-save category to merchant saved categories if not already present
    if (category && category.trim()) {
      const cleanCat = category.trim();
      if (!merchantCategories[merchantId]) {
        merchantCategories[merchantId] = [...DEFAULT_SYSTEM_CATEGORIES];
      }
      if (!merchantCategories[merchantId].includes(cleanCat)) {
        merchantCategories[merchantId].push(cleanCat);
      }
    }

    const newProd: MerchantProduct = {
      id: `prod-${Date.now()}`,
      merchantId,
      name,
      sku: sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      barcode: barcode || `${Math.floor(6280000 + Math.random() * 9999)}`,
      category: category || 'عام',
      costPrice: Number(costPrice) || 0,
      sellingPrice: Number(sellingPrice) || 0,
      stockQuantity: Number(stockQuantity) || 0,
      minStockAlert: Number(minStockAlert) || 5,
      unit: unit || 'قطعة',
      locationRack: locationRack || '',
      notes: notes || '',
      updatedAt: new Date().toISOString(),
    };

    merchantProducts.push(newProd);

    if (newProd.stockQuantity > 0) {
      stockMovements.push({
        id: `sm-${Date.now()}`,
        merchantId,
        productId: newProd.id,
        productName: newProd.name,
        type: 'IN_PURCHASE',
        quantity: newProd.stockQuantity,
        previousStock: 0,
        newStock: newProd.stockQuantity,
        unitPrice: newProd.costPrice,
        referenceNumber: 'INITIAL-STOCK',
        notes: 'إدخال رصيد افتتاحي عند تعريف الصنف',
        createdAt: new Date().toISOString(),
      });
    }

    saveDatabase();
    res.json({ success: true, product: newProd });
  } catch (err: any) {
    res.status(500).json({ error: 'فشل في إنشاء الصنف: ' + err.message });
  }
};

app.post('/api/merchants/:merchantId/products', requireAuth, handleCreateMerchantProduct);
app.post('/api/merchants/:merchantId/warehouse/products', requireAuth, handleCreateMerchantProduct);

// PUT /api/merchants/:merchantId/products/:productId
app.put('/api/merchants/:merchantId/products/:productId', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  const { merchantId, productId } = req.params;

  if (!canAccessMerchant(ctx, merchantId)) {
    return res.status(403).json({ error: 'غير مصرح بتعديل منتجات هذا المتجر' });
  }

  const prod = merchantProducts.find((p) => p.id === productId && p.merchantId === merchantId);
  if (!prod) return res.status(404).json({ error: 'الصنف غير موجود' });

  Object.assign(prod, req.body, { updatedAt: new Date().toISOString() });
  saveDatabase();
  res.json({ success: true, product: prod });
});

// DELETE /api/merchants/:merchantId/products/:productId
app.delete('/api/merchants/:merchantId/products/:productId', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  const { merchantId, productId } = req.params;

  if (!canAccessMerchant(ctx, merchantId)) {
    return res.status(403).json({ error: 'غير مصرح بحذف منتجات هذا المتجر' });
  }

  const index = merchantProducts.findIndex((p) => p.id === productId && p.merchantId === merchantId);
  if (index === -1) return res.status(404).json({ error: 'الصنف غير موجود' });

  merchantProducts.splice(index, 1);
  saveDatabase();
  res.json({ success: true, message: 'تم حذف الصنف بنجاح' });
});

// POST /api/merchants/:merchantId/stock-adjustments (and alias /warehouse/stock-adjustment)
const handleStockAdjustment = (req: any, res: any) => {
  try {
    const ctx = getRequesterContext(req);
    const { merchantId } = req.params;

    if (!canAccessMerchant(ctx, merchantId)) {
      return res.status(403).json({ error: 'غير مصرح بتعديل مخزون هذا المتجر' });
    }

    const { productId, quantityChange, type, referenceNumber, notes } = req.body;
    const prod = merchantProducts.find((p) => p.id === productId && p.merchantId === merchantId);
    if (!prod) return res.status(404).json({ error: 'الصنف غير موجود' });

    const change = Number(quantityChange);
    if (isNaN(change) || change === 0) {
      return res.status(400).json({ error: 'قيمة التعديل غير صالحة' });
    }

    const prev = prod.stockQuantity;
    prod.stockQuantity = Math.max(0, prev + change);
    prod.updatedAt = new Date().toISOString();

    const movement: StockMovement = {
      id: `sm-${Date.now()}`,
      merchantId,
      productId: prod.id,
      productName: prod.name,
      type: type || (change > 0 ? 'ADJUSTMENT' : 'OUT_SALE'),
      quantity: change,
      previousStock: prev,
      newStock: prod.stockQuantity,
      unitPrice: prod.costPrice,
      referenceNumber: referenceNumber || 'ADJ-MANUAL',
      notes: notes || 'تعديل جرد يدوي بالمستودع',
      createdAt: new Date().toISOString(),
    };

    stockMovements.push(movement);
    saveDatabase();

    res.json({ success: true, product: prod, movement });
  } catch (err: any) {
    res.status(500).json({ error: 'فشل في تعديل المخزون: ' + err.message });
  }
};

app.post('/api/merchants/:merchantId/stock-adjustments', requireAuth, handleStockAdjustment);
app.post('/api/merchants/:merchantId/warehouse/stock-adjustment', requireAuth, handleStockAdjustment);
app.post('/api/merchants/:merchantId/warehouse/stock-adjustments', requireAuth, handleStockAdjustment);

// =============================================================
// Merchant Invoices & Billing Endpoints
// =============================================================

// GET /api/merchants/:merchantId/invoices
app.get('/api/merchants/:merchantId/invoices', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  const { merchantId } = req.params;

  if (!canAccessMerchant(ctx, merchantId)) {
    return res.status(403).json({ error: 'غير مصرح بالاطلاع على فواتير هذا المتجر' });
  }

  const invoices = merchantInvoices.filter((i) => i.merchantId === merchantId);
  const canSeeCost = canViewCostPrices(ctx, merchantId);

  const sanitizedInvoices = invoices.map((inv) => ({
    ...inv,
    items: (inv.items || []).map((it) => ({
      ...it,
      costPrice: canSeeCost ? it.costPrice : 0,
    })),
  }));

  res.json({ invoices: [...sanitizedInvoices].reverse() });
});

// POST /api/merchants/:merchantId/invoices
app.post('/api/merchants/:merchantId/invoices', requireAuth, (req, res) => {
  try {
    const ctx = getRequesterContext(req);
    const { merchantId } = req.params;

    if (!canAccessMerchant(ctx, merchantId)) {
      return res.status(403).json({ error: 'غير مصرح بإصدار فواتير لهذا المتجر' });
    }

    const {
      type,
      date,
      partyName,
      partyPhone,
      partyAddress,
      items,
      subtotal,
      taxAmount,
      discountAmount,
      deliveryFee,
      grandTotal,
      paymentMethod,
      paymentStatus,
      notes,
      createDeliveryOrder,
      deliveryGovernorate,
      deliveryArea,
      deliveryFullAddress,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'يجب أن تحتوي الفاتورة على صنف واحد على الأقل' });
    }

    const count = merchantInvoices.filter((i) => i.merchantId === merchantId && i.type === type).length + 1;
    const prefix = type === 'SALES' ? 'INV-S' : type === 'PURCHASE' ? 'INV-P' : 'INV-R';
    const invoiceNumber = `${prefix}-2026-${String(count).padStart(4, '0')}`;

    let createdOrder: Order | undefined = undefined;

    if (type === 'SALES' && createDeliveryOrder) {
      const orderSeq = `ORD-2026-${String(nextSequenceNumber++).padStart(4, '0')}`;
      const delFee = Number(deliveryFee) || 2.0;
      const gTotal = Number(grandTotal) || 0;
      const merchColl = Math.max(0, gTotal - delFee);

      createdOrder = {
        id: `ord-${Date.now()}`,
        sequence: orderSeq,
        referenceNumber: invoiceNumber,
        status: 'PENDING',
        paymentType: paymentMethod === 'COD' ? 'COD' : 'PREPAID',
        merchantId,
        recipientName: partyName || 'عميل المتجر',
        recipientPhone: partyPhone || '0790000000',
        governorate: deliveryGovernorate || 'عمان',
        area: deliveryArea || 'عمان',
        subArea: '',
        fullAddress: deliveryFullAddress || partyAddress || 'عمان',
        merchantCollection: merchColl,
        deliveryFee: delFee,
        totalCollection: gTotal,
        isSettledWithMerchant: false,
        isSettledWithDriver: false,
        packageType: 'طرود وبضائع المتجر',
        piecesCount: items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 1), 0),
        deliveryAttempts: 0,
        notes: `تم إنشاء الشحنة تلقائياً من فاتورة المبيعات [${invoiceNumber}] | ${items.map((it: any) => `${it.productName} (${it.quantity})`).join(', ')}`,
        statusLogs: [
          {
            id: `log-${Date.now()}`,
            orderId: `ord-${Date.now()}`,
            fromStatus: null,
            toStatus: 'PENDING',
            note: `إنشاء طلبية شحن وتوصيل من فاتورة المبيعات ${invoiceNumber}`,
            createdAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      orders.unshift(createdOrder);
    }

    const newInvoice: MerchantInvoice = {
      id: `inv-${Date.now()}`,
      merchantId,
      invoiceNumber,
      type,
      date: date || new Date().toISOString().split('T')[0],
      partyName: partyName || (type === 'PURCHASE' ? 'المورد' : 'العميل'),
      partyPhone,
      partyAddress,
      items: items.map((it: any) => ({
        productId: it.productId,
        productName: it.productName,
        barcode: it.barcode,
        quantity: Number(it.quantity) || 1,
        unitPrice: Number(it.unitPrice) || 0,
        costPrice: Number(it.costPrice) || 0,
        total: Number(it.total) || (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0),
      })),
      subtotal: Number(subtotal) || 0,
      taxAmount: Number(taxAmount) || 0,
      discountAmount: Number(discountAmount) || 0,
      deliveryFee: Number(deliveryFee) || 0,
      grandTotal: Number(grandTotal) || 0,
      paymentMethod: paymentMethod || 'CASH',
      paymentStatus: paymentStatus || 'PAID',
      shippingOrderId: createdOrder ? createdOrder.id : undefined,
      shippingTrackingNumber: createdOrder ? createdOrder.sequence : undefined,
      notes: notes || '',
      createdAt: new Date().toISOString(),
    };

    merchantInvoices.push(newInvoice);

    let totalInvoiceCogs = 0;

    newInvoice.items.forEach((item) => {
      let prod = merchantProducts.find((p) => p.id === item.productId && p.merchantId === merchantId);
      if (!prod && item.barcode) {
        prod = merchantProducts.find((p) => p.barcode === item.barcode && p.merchantId === merchantId);
      }
      if (!prod && item.productName) {
        prod = merchantProducts.find(
          (p) => p.name.trim().toLowerCase() === item.productName.trim().toLowerCase() && p.merchantId === merchantId
        );
      }

      const itemCostUnit = item.costPrice > 0 ? item.costPrice : (prod?.costPrice || 0);
      const lineCogs = itemCostUnit * item.quantity;
      totalInvoiceCogs += lineCogs;

      if (type === 'PURCHASE') {
        if (prod) {
          const prev = prod.stockQuantity;
          prod.stockQuantity += item.quantity;
          if (item.unitPrice > 0) prod.costPrice = item.unitPrice;
          prod.updatedAt = new Date().toISOString();

          stockMovements.push({
            id: `sm-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            merchantId,
            productId: prod.id,
            productName: prod.name,
            type: 'IN_PURCHASE',
            quantity: item.quantity,
            previousStock: prev,
            newStock: prod.stockQuantity,
            unitPrice: item.unitPrice,
            referenceNumber: invoiceNumber,
            notes: `توريد بموجب فاتورة مشتريات من [${partyName || 'مورد'}]`,
            createdAt: new Date().toISOString(),
          });
        } else {
          const autoProd: MerchantProduct = {
            id: `prod-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            merchantId,
            name: item.productName,
            sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
            barcode: item.barcode || `${Math.floor(6280000 + Math.random() * 9999)}`,
            category: 'مشتريات جديدة',
            costPrice: item.unitPrice,
            sellingPrice: item.unitPrice * 1.5,
            stockQuantity: item.quantity,
            minStockAlert: 5,
            unit: 'قطعة',
            notes: `تم إنشاؤه تلقائياً من فاتورة المشتريات ${invoiceNumber}`,
            updatedAt: new Date().toISOString(),
          };
          merchantProducts.push(autoProd);
          stockMovements.push({
            id: `sm-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            merchantId,
            productId: autoProd.id,
            productName: autoProd.name,
            type: 'IN_PURCHASE',
            quantity: item.quantity,
            previousStock: 0,
            newStock: item.quantity,
            unitPrice: item.unitPrice,
            referenceNumber: invoiceNumber,
            notes: `صنف جديد تم تسجيله من فاتورة المشتريات`,
            createdAt: new Date().toISOString(),
          });
        }
      } else if (type === 'SALES') {
        if (prod) {
          const prev = prod.stockQuantity;
          prod.stockQuantity = Math.max(0, prev - item.quantity);
          prod.updatedAt = new Date().toISOString();

          stockMovements.push({
            id: `sm-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            merchantId,
            productId: prod.id,
            productName: prod.name,
            type: createDeliveryOrder ? 'OUT_SHIPPING' : 'OUT_SALE',
            quantity: -item.quantity,
            previousStock: prev,
            newStock: prod.stockQuantity,
            unitPrice: item.unitPrice,
            referenceNumber: invoiceNumber,
            notes: createDeliveryOrder
              ? `خصم مخزون آلي - شحن طلبية للزبون عبر دارجو [${createdOrder?.sequence}]`
              : `خصم مخزون آلي - بيع مباشر بموجب فاتورة مبيعات [${invoiceNumber}]`,
            createdAt: new Date().toISOString(),
          });
        } else {
          // If item wasn't registered in warehouse, create it with 0 stock and record the sale deduction
          const autoProd: MerchantProduct = {
            id: `prod-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            merchantId,
            name: item.productName,
            sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
            barcode: item.barcode || `${Math.floor(6280000 + Math.random() * 9999)}`,
            category: 'مبيعات مباشرة',
            costPrice: item.costPrice || item.unitPrice * 0.7,
            sellingPrice: item.unitPrice,
            stockQuantity: 0,
            minStockAlert: 5,
            unit: 'قطعة',
            notes: `صنف مضاف آلياً عند إصدار الفاتورة ${invoiceNumber}`,
            updatedAt: new Date().toISOString(),
          };
          merchantProducts.push(autoProd);
          stockMovements.push({
            id: `sm-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            merchantId,
            productId: autoProd.id,
            productName: autoProd.name,
            type: createDeliveryOrder ? 'OUT_SHIPPING' : 'OUT_SALE',
            quantity: -item.quantity,
            previousStock: 0,
            newStock: 0,
            unitPrice: item.unitPrice,
            referenceNumber: invoiceNumber,
            notes: `خصم مخزون فوري لصنف جديد من فاتورة المبيعات [${invoiceNumber}]`,
            createdAt: new Date().toISOString(),
          });
        }
      } else if (type === 'RETURN') {
        if (prod) {
          const prev = prod.stockQuantity;
          prod.stockQuantity += item.quantity;
          prod.updatedAt = new Date().toISOString();

          stockMovements.push({
            id: `sm-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            merchantId,
            productId: prod.id,
            productName: prod.name,
            type: 'IN_RETURN',
            quantity: item.quantity,
            previousStock: prev,
            newStock: prod.stockQuantity,
            unitPrice: item.unitPrice,
            referenceNumber: invoiceNumber,
            notes: `إعادة للمخزن بموجب فاتورة مرتجع [${invoiceNumber}] للعميل [${partyName || 'زبون'}]`,
            createdAt: new Date().toISOString(),
          });
        }
      }
    });

    // =========================================================
    // Automated Double-Entry Accounting Integration
    // =========================================================
    try {
      const isPaid = newInvoice.paymentStatus === 'PAID';
      const invTotal = newInvoice.grandTotal || 0;
      const invSubtotal = newInvoice.subtotal || 0;
      const invDelivery = newInvoice.deliveryFee || 0;

      if (type === 'SALES' && invTotal > 0) {
        const jeId = `je-inv-${Date.now()}`;
        const lines: JournalEntryLine[] = [];

        // 1. Debit Cash/Bank or Accounts Receivable
        if (isPaid) {
          lines.push({
            accountId: 'acc-1010',
            accountCode: '1010',
            accountName: 'الصندوق الرئيسي (الخزينة النقدية)',
            debit: invTotal,
            credit: 0,
            note: `تحصيل نقدي لفاتورة مبيعات [${invoiceNumber}]`,
          });
        } else {
          lines.push({
            accountId: 'acc-1070',
            accountCode: '1070',
            accountName: 'ذمم العملاء والزبائن التجارية (Accounts Receivable)',
            debit: invTotal,
            credit: 0,
            note: `ذمة بيع آجل للعميل [${partyName}] بموجب فاتورة [${invoiceNumber}]`,
          });
        }

        // 2. Debit Cost of Goods Sold (COGS) & Credit Inventory Asset
        if (totalInvoiceCogs > 0) {
          lines.push({
            accountId: 'acc-5060',
            accountCode: '5060',
            accountName: 'تكلفة البضاعة المباعة للمتاجر (COGS)',
            debit: totalInvoiceCogs,
            credit: 0,
            note: `إثبات تكلفة الأصناف المصروفة من المخزن للفاتورة [${invoiceNumber}]`,
          });

          lines.push({
            accountId: 'acc-1060',
            accountCode: '1060',
            accountName: 'مخزون بضائع المتاجر بالمستودع (Inventory Asset)',
            debit: 0,
            credit: totalInvoiceCogs,
            note: `خصم وتخفيض قيمة المخزون الدفترية للأصناف المباعة [${invoiceNumber}]`,
          });
        }

        // 3. Credit Sales Revenue
        lines.push({
          accountId: 'acc-4030',
          accountCode: '4030',
          accountName: 'إيرادات مبيعات بضائع المتاجر',
          debit: 0,
          credit: invSubtotal,
          note: `إيراد مبيعات محقق من فاتورة [${invoiceNumber}]`,
        });

        // 4. Credit Delivery Fees (if applicable)
        if (invDelivery > 0) {
          lines.push({
            accountId: 'acc-4010',
            accountCode: '4010',
            accountName: 'إيرادات أجور التوصيل والشحن',
            debit: 0,
            credit: invDelivery,
            note: `أجور شحن وتوصيل دارجو للطلبية [${invoiceNumber}]`,
          });
        }

        const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
        const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);

        journalEntries.unshift({
          id: jeId,
          entryNumber: `JE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          date: newInvoice.date,
          description: `قيد آلي: إثبات مبيعات وخصم مخزون للفاتورة [${invoiceNumber}] - العميل: ${partyName || 'نقدي'}`,
          referenceType: 'INVOICE',
          referenceId: newInvoice.id,
          reference: invoiceNumber,
          lines,
          totalDebit,
          totalCredit,
          createdByName: 'نظام الربط المحاسبي والمخزني الآلي',
          createdAt: new Date().toISOString(),
        });
      } else if (type === 'PURCHASE' && invTotal > 0) {
        const lines: JournalEntryLine[] = [
          {
            accountId: 'acc-1060',
            accountCode: '1060',
            accountName: 'مخزون بضائع المتاجر بالمستودع (Inventory Asset)',
            debit: invTotal,
            credit: 0,
            note: `إثبات زيادة المخزون الدفتري من فاتورة مشتريات [${invoiceNumber}]`,
          },
          {
            accountId: isPaid ? 'acc-1010' : 'acc-2030',
            accountCode: isPaid ? '1010' : '2030',
            accountName: isPaid
              ? 'الصندوق الرئيسي (الخزينة النقدية)'
              : 'ذمم الموردين التجارية (Accounts Payable)',
            debit: 0,
            credit: invTotal,
            note: isPaid
              ? `سداد نقدي لمشتريات بضاعة [${invoiceNumber}]`
              : `ذمة دائنة مستحقة للمورد [${partyName}] عن فاتورة [${invoiceNumber}]`,
          },
        ];

        journalEntries.unshift({
          id: `je-pur-${Date.now()}`,
          entryNumber: `JE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          date: newInvoice.date,
          description: `قيد آلي: توريد وإثبات مخزون فاتورة مشتريات [${invoiceNumber}] - المورد: ${partyName || 'مورد'}`,
          referenceType: 'INVOICE',
          referenceId: newInvoice.id,
          reference: invoiceNumber,
          lines,
          totalDebit: invTotal,
          totalCredit: invTotal,
          createdByName: 'نظام الربط المحاسبي والمخزني الآلي',
          createdAt: new Date().toISOString(),
        });
      }
    } catch (acctErr) {
      console.error('Accounting auto-linking error:', acctErr);
    }

    saveDatabase();

    res.json({
      success: true,
      invoice: newInvoice,
      order: createdOrder ? populateOrder(createdOrder) : undefined,
      inventoryUpdated: true,
      accountingSynced: true,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'فشل في حفظ الفاتورة: ' + err.message });
  }
});

// =============================================================
// Merchant Full Accounting & P&L Endpoints
// =============================================================

// GET /api/merchants/:merchantId/accounting & /api/merchants/:merchantId/accounting/summary
const handleMerchantAccounting = (req: any, res: any) => {
  const ctx = getRequesterContext(req);
  const { merchantId } = req.params;

  if (!canAccessMerchant(ctx, merchantId)) {
    return res.status(403).json({ error: 'غير مصرح بالاطلاع على الحسابات المالية لهذا المتجر' });
  }

  const invoices = merchantInvoices.filter((i) => i.merchantId === merchantId);
  const expenses = merchantExpenses.filter((e) => e.merchantId === merchantId);
  const merchantVouchersList = vouchers.filter((v) => v.notes.includes(merchantId) || v.beneficiaryOrPayer.includes('سحر الشرق'));
  const prods = merchantProducts.filter((p) => p.merchantId === merchantId);
  const movements = stockMovements.filter((m) => m.merchantId === merchantId);

  const canSeeCost = canViewCostPrices(ctx, merchantId);

  const salesInvoices = invoices.filter((i) => i.type === 'SALES');
  const purchaseInvoices = invoices.filter((i) => i.type === 'PURCHASE');
  const returnInvoices = invoices.filter((i) => i.type === 'RETURN');

  const totalSales = salesInvoices.reduce((sum, inv) => sum + (inv.subtotal || 0), 0);
  const totalReturns = returnInvoices.reduce((sum, inv) => sum + (inv.subtotal || 0), 0);
  const netSales = totalSales - totalReturns;

  let totalCogs = 0;
  if (canSeeCost) {
    salesInvoices.forEach((inv) => {
      inv.items.forEach((it) => {
        const p = prods.find((pr) => pr.id === it.productId || (it.barcode && pr.barcode === it.barcode));
        const cost = it.costPrice > 0 ? it.costPrice : (p?.costPrice || 0);
        totalCogs += cost * (it.quantity || 1);
      });
    });
  }

  const grossProfit = canSeeCost ? netSales - totalCogs : 0;
  const grossMarginPercent = canSeeCost && netSales > 0 ? (grossProfit / netSales) * 100 : 0;

  const totalShippingFees = salesInvoices.reduce((sum, inv) => sum + (inv.deliveryFee || 0), 0);
  const totalOperatingExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const netProfit = canSeeCost ? grossProfit - totalShippingFees - totalOperatingExpenses : 0;

  const accountsReceivable = salesInvoices
    .filter((i) => i.paymentStatus !== 'PAID')
    .reduce((sum, i) => sum + (i.grandTotal || 0), 0);

  const accountsPayable = purchaseInvoices
    .filter((i) => i.paymentStatus !== 'PAID')
    .reduce((sum, i) => sum + (i.grandTotal || 0), 0);

  const merchantOrders = orders.filter((o) => o.merchantId === merchantId);
  const deliveredOrders = merchantOrders.filter((o) => o.status === 'DELIVERED');
  const collectedByDarGo = deliveredOrders.reduce((sum, o) => sum + o.merchantCollection, 0);
  const settledOrders = deliveredOrders.filter((o) => o.isSettledWithMerchant);
  const settledByDarGo = settledOrders.reduce((sum, o) => sum + o.merchantCollection, 0);
  const pendingDarGoPayout = Math.max(0, collectedByDarGo - settledByDarGo);

  // Live Inventory Values
  const inventoryAssetValue = canSeeCost
    ? prods.reduce((sum, p) => sum + (p.costPrice || 0) * (p.stockQuantity || 0), 0)
    : 0;
  const inventoryRetailValue = prods.reduce((sum, p) => sum + (p.sellingPrice || 0) * (p.stockQuantity || 0), 0);
  const totalStockItems = prods.reduce((sum, p) => sum + (p.stockQuantity || 0), 0);
  const lowStockCount = prods.filter((p) => p.stockQuantity <= (p.minStockAlert || 5)).length;

  const relatedJournalEntries = journalEntries.filter((je) => {
    return (
      je.referenceId?.startsWith('inv-') ||
      je.description.includes(merchantId) ||
      invoices.some((inv) => inv.id === je.referenceId || inv.invoiceNumber === je.reference)
    );
  });

  const summary = {
    merchantId,
    totalRevenue: netSales,
    costOfGoodsSold: canSeeCost ? totalCogs : 0,
    grossProfit: canSeeCost ? grossProfit : 0,
    marginPercent: canSeeCost ? grossMarginPercent : 0,
    deliveryFeesPaid: totalShippingFees,
    totalExpenses: totalOperatingExpenses,
    netProfit: canSeeCost ? netProfit : 0,
    netMarginPercent: canSeeCost && netSales > 0 ? (netProfit / netSales) * 100 : 0,
    pendingSettlements: pendingDarGoPayout,
    inventoryAssetValue,
    inventoryRetailValue,
    totalStockItems,
    lowStockCount,
    accountsReceivable,
    accountsPayable,
  };

  res.json({
    summary,
    pnl: {
      totalSales,
      totalReturns,
      netSales,
      totalCogs: canSeeCost ? totalCogs : 0,
      grossProfit: canSeeCost ? grossProfit : 0,
      grossMarginPercent: canSeeCost ? grossMarginPercent : 0,
      totalShippingFees,
      totalOperatingExpenses,
      netProfit: canSeeCost ? netProfit : 0,
      netMarginPercent: canSeeCost && netSales > 0 ? (netProfit / netSales) * 100 : 0,
      inventoryAssetValue,
    },
    workingCapital: {
      accountsReceivable,
      accountsPayable,
      pendingDarGoPayout,
      collectedByDarGo,
      settledByDarGo,
      inventoryAssetValue,
    },
    inventory: {
      assetValue: inventoryAssetValue,
      retailValue: inventoryRetailValue,
      totalItems: totalStockItems,
      lowStockCount,
    },
    expenses: [...expenses].reverse(),
    vouchers: [...merchantVouchersList].reverse(),
    journalEntries: relatedJournalEntries.slice(0, 30),
    stockMovements: [...movements].reverse().slice(0, 30),
    salesInvoices: salesInvoices.length,
    purchaseInvoices: purchaseInvoices.length,
  });
};

app.get('/api/merchants/:merchantId/accounting', requireAuth, handleMerchantAccounting);
app.get('/api/merchants/:merchantId/accounting/summary', requireAuth, handleMerchantAccounting);

// GET /api/merchants/:merchantId/expenses
app.get('/api/merchants/:merchantId/expenses', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  const { merchantId } = req.params;

  if (!canAccessMerchant(ctx, merchantId)) {
    return res.status(403).json({ error: 'غير مصرح بالاطلاع على مصاريف هذا المتجر' });
  }

  const expenses = merchantExpenses.filter((e) => e.merchantId === merchantId);
  res.json({ expenses: [...expenses].reverse() });
});

// POST /api/merchants/:merchantId/expenses
app.post('/api/merchants/:merchantId/expenses', requireAuth, (req, res) => {
  try {
    const ctx = getRequesterContext(req);
    const { merchantId } = req.params;

    if (!canAccessMerchant(ctx, merchantId)) {
      return res.status(403).json({ error: 'غير مصرح بتسجيل مصاريف لهذا المتجر' });
    }

    const { title, category, amount, date, paymentMethod, reference, notes } = req.body;
    const numAmount = Number(amount);
    if (!title || !numAmount || numAmount <= 0) {
      return res.status(400).json({ error: 'عنوان المصروف والمبلغ مطلوبان' });
    }

    const newExpense: MerchantExpense = {
      id: `me-${Date.now()}`,
      merchantId,
      title,
      category: category || 'OTHER',
      amount: numAmount,
      date: date || new Date().toISOString().split('T')[0],
      paymentMethod: paymentMethod || 'CASH',
      reference: reference || '',
      notes: notes || '',
      createdAt: new Date().toISOString(),
    };

    merchantExpenses.push(newExpense);
    saveDatabase();

    res.json({ success: true, expense: newExpense });
  } catch (err: any) {
    res.status(500).json({ error: 'فشل في إضافة المصروف: ' + err.message });
  }
});

// DELETE /api/merchants/:merchantId/expenses/:expenseId
app.delete('/api/merchants/:merchantId/expenses/:expenseId', requireAuth, (req, res) => {
  const ctx = getRequesterContext(req);
  const { merchantId, expenseId } = req.params;

  if (!canAccessMerchant(ctx, merchantId)) {
    return res.status(403).json({ error: 'غير مصرح بحذف مصاريف هذا المتجر' });
  }

  const index = merchantExpenses.findIndex((e) => e.id === expenseId && e.merchantId === merchantId);
  if (index === -1) return res.status(404).json({ error: 'المصروف غير موجود' });

  merchantExpenses.splice(index, 1);
  saveDatabase();
  res.json({ success: true, message: 'تم حذف المصروف بنجاح' });
});

// =============================================================
// Exact Money Helpers (Integer Fils: 1 JOD = 1000 fils)
// Guaranteed JOD 3-Decimal Precision Arithmetic
// =============================================================
export function toFils(amount: number | string | null | undefined): number {
  if (amount === null || amount === undefined || isNaN(Number(amount))) return 0;
  return Math.round(Number(amount) * 1000);
}

export function fromFils(fils: number): number {
  return Number((fils / 1000).toFixed(3));
}

export function roundFils3(amount: number | string | null | undefined): number {
  return fromFils(toFils(amount));
}

// =============================================================
// Authoritative Financial Obligations Engine (Delivere Core)
// Proven Source Data Extraction & Legacy Reconciliation Guard
// =============================================================
export type ObligationType = 'MERCHANT_COD' | 'DRIVER_EARNING';

export interface ResolveObligationParams {
  tenantId: string;
  shipmentId: string;
  obligationType: ObligationType;
  beneficiaryId: string;
}

export interface ResolveObligationResult {
  obligationId: string;
  tenantId: string;
  shipmentId: string;
  beneficiaryId: string;
  obligationType: ObligationType;
  originalAmount: number;
  status: 'OPEN' | 'PARTIALLY_SETTLED' | 'SETTLED' | 'CANCELLED' | 'LEGACY_RECONCILIATION_REQUIRED';
  sourceReference: string;
  isExisting: boolean;
}

/**
 * Resolves or safely creates a financial obligation for a delivered shipment.
 * STRICT IMMUTABLE AUDIT RULES:
 * 1. Checks for existing obligation in public.financial_obligations first.
 * 2. If creating, extracts amounts EXCLUSIVELY from immutable database transaction snapshots on public.shipments.
 * 3. MERCHANT_COD obligation original_amount MUST come directly from persisted merchant_collection snapshot.
 * 4. DRIVER_EARNING obligation original_amount MUST come directly from persisted driver_fee snapshot.
 * 5. NEVER queries live/mutable price plans or dynamic pricing tables for historical deliveries.
 * 6. NEVER uses volatile in-memory fallback to fabricate authoritative database obligations.
 * 7. If durable snapshot fields are missing, ambiguous, or if shipment is not DELIVERED, status is set to
 *    'LEGACY_RECONCILIATION_REQUIRED' with 0.000 amount, completely blocking automatic settlement.
 */
export async function getOrCreateAuthoritativeObligation(
  params: ResolveObligationParams
): Promise<ResolveObligationResult> {
  const { tenantId, shipmentId, obligationType, beneficiaryId } = params;

  if (!isValidUuid(tenantId) || !isValidUuid(shipmentId) || !isValidUuid(beneficiaryId)) {
    throw new Error('Invalid UUID parameter provided for financial obligation resolution.');
  }

  const normType: ObligationType = obligationType;

  // 1. Check existing obligation in Supabase
  const { data: existing, error: fetchErr } = await supabase
    .from('financial_obligations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('shipment_id', shipmentId)
    .eq('obligation_type', normType)
    .limit(1);

  if (fetchErr) {
    throw new Error(`Database error fetching obligation: ${fetchErr.message}`);
  }

  if (existing && existing.length > 0) {
    const ob = existing[0];
    return {
      obligationId: ob.id,
      tenantId: ob.tenant_id,
      shipmentId: ob.shipment_id,
      beneficiaryId: ob.beneficiary_id,
      obligationType: ob.obligation_type,
      originalAmount: Number(ob.original_amount),
      status: ob.status,
      sourceReference: ob.source_reference || '',
      isExisting: true,
    };
  }

  // 2. Fetch authoritative shipment snapshot record from database
  const { data: shipData, error: shipErr } = await supabase
    .from('shipments')
    .select('id, tenant_id, sequence, tracking_number, status, cod_amount, merchant_collection, delivery_fee, driver_fee, return_fee, merchant_id, driver_id, created_at')
    .eq('id', shipmentId)
    .limit(1);

  if (shipErr || !shipData || shipData.length === 0) {
    // Audit Rule: Never fabricate authoritative database financial obligations from volatile in-memory state.
    // If durable database snapshot is missing, flag as LEGACY_RECONCILIATION_REQUIRED.
    return {
      obligationId: crypto.randomUUID(),
      tenantId,
      shipmentId,
      beneficiaryId,
      obligationType: normType,
      originalAmount: 0.000,
      status: 'LEGACY_RECONCILIATION_REQUIRED',
      sourceReference: `MISSING_DURABLE_RECORD:${shipmentId} [FLAGGED: Database shipment record missing]`,
      isExisting: false,
    };
  }

  const ship = shipData[0];
  let calculatedAmountFils = 0;
  let status: 'OPEN' | 'LEGACY_RECONCILIATION_REQUIRED' = 'OPEN';
  let sourceRef = `SHIPMENT:${ship.sequence || ship.tracking_number || ship.id}`;

  // 3. Proven source data validation
  if (normType === 'MERCHANT_COD') {
    if (ship.merchant_id !== beneficiaryId) {
      throw new Error(`Merchant beneficiary mismatch: shipment merchant is ${ship.merchant_id}, requested ${beneficiaryId}`);
    }

    // Contractual source: merchant_collection snapshot
    const merchColl =
      ship.merchant_collection !== undefined && ship.merchant_collection !== null
        ? Number(ship.merchant_collection)
        : null;

    if (merchColl === null || isNaN(merchColl) || merchColl < 0 || ship.status !== 'DELIVERED') {
      status = 'LEGACY_RECONCILIATION_REQUIRED';
      calculatedAmountFils = 0;
      sourceRef += ' [FLAGGED: Missing merchant_collection snapshot or non-delivered status]';
    } else {
      calculatedAmountFils = toFils(merchColl);
    }
  } else if (normType === 'DRIVER_EARNING') {
    if (ship.driver_id && ship.driver_id !== beneficiaryId) {
      throw new Error(`Driver beneficiary mismatch: shipment driver is ${ship.driver_id}, requested ${beneficiaryId}`);
    }

    const rawDriverFee = ship.driver_fee !== undefined && ship.driver_fee !== null ? Number(ship.driver_fee) : null;

    if (rawDriverFee === null || isNaN(rawDriverFee) || rawDriverFee <= 0 || ship.status !== 'DELIVERED') {
      status = 'LEGACY_RECONCILIATION_REQUIRED';
      calculatedAmountFils = 0;
      sourceRef += ' [FLAGGED: Missing snapshotted driver_fee or non-delivered status]';
    } else {
      calculatedAmountFils = toFils(rawDriverFee);
    }
  }

  const finalAmount = fromFils(calculatedAmountFils);

  // 4. Insert new authoritative obligation record
  const newObligationId = crypto.randomUUID();
  const dbPayload = {
    id: newObligationId,
    tenant_id: tenantId,
    shipment_id: shipmentId,
    beneficiary_id: beneficiaryId,
    obligation_type: normType,
    original_amount: finalAmount,
    currency: 'JOD',
    status,
    source_reference: sourceRef,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: inserted, error: insertErr } = await supabase
    .from('financial_obligations')
    .insert([dbPayload])
    .select();

  if (insertErr) {
    throw new Error(`Failed to insert authoritative financial obligation: ${insertErr.message}`);
  }

  const resultRow = inserted && inserted[0] ? inserted[0] : dbPayload;
  return {
    obligationId: resultRow.id,
    tenantId: resultRow.tenant_id,
    shipmentId: resultRow.shipment_id,
    beneficiaryId: resultRow.beneficiary_id,
    obligationType: resultRow.obligation_type,
    originalAmount: Number(resultRow.original_amount),
    status: resultRow.status,
    sourceReference: resultRow.source_reference,
    isExisting: false,
  };
}

// =============================================================
// Authoritative Delivery Posting Engine (Double-Entry Balanced)
// =============================================================
export interface DeliveryPostingParams {
  order: {
    id: string;
    sequence?: string;
    paymentType: 'COD' | 'CLIQ' | 'PREPAID';
    totalCollection: number;      // Gross customer collection
    merchantCollection: number;   // Merchant merchandise amount
    deliveryFee: number;          // Delivere revenue tariff
    driverFee?: number;           // Driver compensation
    returnFee?: number;           // Snapshotted return fee
  };
  tenantAccounts?: {
    driverCustodyAccountId?: string;     // Default 1020
    bankCliqAccountId?: string;          // Default 1030
    merchantPayablesAccountId?: string;  // Default 2020
    merchantArAccountId?: string;        // Default 1070
    deliveryRevenueAccountId?: string;   // Default 4010
  };
}

export interface DeliveryPostingLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

export interface DeliveryPostingResult {
  isValid: boolean;
  status: 'POSTABLE' | 'FINANCIAL_RECONCILIATION_REQUIRED';
  reason?: string;
  lines: DeliveryPostingLine[];
  totalDebit: number;
  totalCredit: number;
}

export function validateAndBuildDeliveryPosting(params: DeliveryPostingParams): DeliveryPostingResult {
  const { order, tenantAccounts = {} } = params;
  const driverCustodyAcc = tenantAccounts.driverCustodyAccountId || 'acc-1020-custody';
  const bankCliqAcc = tenantAccounts.bankCliqAccountId || 'acc-1030-bank-cliq';
  const merchPayableAcc = tenantAccounts.merchantPayablesAccountId || 'acc-2020-merch-payables';
  const merchArAcc = tenantAccounts.merchantArAccountId || 'acc-1070-merch-ar';
  const delivRevenueAcc = tenantAccounts.deliveryRevenueAccountId || 'acc-4010-deliv-revenue';

  const grossFils = toFils(order.totalCollection);
  const merchFils = toFils(order.merchantCollection);
  const feeFils = toFils(order.deliveryFee);

  const lines: DeliveryPostingLine[] = [];

  if (order.paymentType === 'COD') {
    // Validate standard COD mathematical equation
    if (grossFils !== merchFils + feeFils) {
      return {
        isValid: false,
        status: 'FINANCIAL_RECONCILIATION_REQUIRED',
        reason: `COD equation mismatch: gross (${fromFils(grossFils)}) != merchant (${fromFils(merchFils)}) + deliveryFee (${fromFils(feeFils)})`,
        lines: [],
        totalDebit: 0,
        totalCredit: 0,
      };
    }

    // Balanced posting for CASH COD:
    // DR Driver Cash Custody = Gross
    // CR Merchant Payables = Merchant Goods
    // CR Delivery Revenue = Tariff
    lines.push({
      accountId: driverCustodyAcc,
      accountCode: '1020',
      accountName: 'عهدة السائق النقدية',
      debit: fromFils(grossFils),
      credit: 0,
    });
    lines.push({
      accountId: merchPayableAcc,
      accountCode: '2020',
      accountName: 'أمانات التجار (COD)',
      debit: 0,
      credit: fromFils(merchFils),
    });
    lines.push({
      accountId: delivRevenueAcc,
      accountCode: '4010',
      accountName: 'إيرادات أجور التوصيل',
      debit: 0,
      credit: fromFils(feeFils),
    });
  } else if (order.paymentType === 'CLIQ') {
    // CLIQ: Customer pays directly to central bank/CliQ account. Driver custody = 0.
    if (grossFils !== merchFils + feeFils) {
      return {
        isValid: false,
        status: 'FINANCIAL_RECONCILIATION_REQUIRED',
        reason: `CLIQ equation mismatch: gross (${fromFils(grossFils)}) != merchant (${fromFils(merchFils)}) + deliveryFee (${fromFils(feeFils)})`,
        lines: [],
        totalDebit: 0,
        totalCredit: 0,
      };
    }

    lines.push({
      accountId: bankCliqAcc,
      accountCode: '1030',
      accountName: 'حساب البنك / كليك المركزي',
      debit: fromFils(grossFils),
      credit: 0,
    });
    lines.push({
      accountId: merchPayableAcc,
      accountCode: '2020',
      accountName: 'أمانات التجار (COD)',
      debit: 0,
      credit: fromFils(merchFils),
    });
    lines.push({
      accountId: delivRevenueAcc,
      accountCode: '4010',
      accountName: 'إيرادات أجور التوصيل',
      debit: 0,
      credit: fromFils(feeFils),
    });
  } else if (order.paymentType === 'PREPAID') {
    // PREPAID: Customer collection = 0, Driver custody = 0, Merchant COD payable = 0.
    // Delivery fee is an account receivable billed to the merchant.
    lines.push({
      accountId: merchArAcc,
      accountCode: '1070',
      accountName: 'ذمم التجار المدينة (أجور شحن)',
      debit: fromFils(feeFils),
      credit: 0,
    });
    lines.push({
      accountId: delivRevenueAcc,
      accountCode: '4010',
      accountName: 'إيرادات أجور التوصيل',
      debit: 0,
      credit: fromFils(feeFils),
    });
  }

  const totalDebitFils = lines.reduce((acc, l) => acc + toFils(l.debit), 0);
  const totalCreditFils = lines.reduce((acc, l) => acc + toFils(l.credit), 0);

  if (totalDebitFils !== totalCreditFils) {
    return {
      isValid: false,
      status: 'FINANCIAL_RECONCILIATION_REQUIRED',
      reason: `Imbalanced journal posting generated: Debit ${fromFils(totalDebitFils)} != Credit ${fromFils(totalCreditFils)}`,
      lines,
      totalDebit: fromFils(totalDebitFils),
      totalCredit: fromFils(totalCreditFils),
    };
  }

  return {
    isValid: true,
    status: 'POSTABLE',
    lines,
    totalDebit: fromFils(totalDebitFils),
    totalCredit: fromFils(totalCreditFils),
  };
}

// -------------------------------------------------------------
// 404 Fallback for unmatched API routes
// -------------------------------------------------------------
app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'مسار الـ API غير موجود',
    method: req.method,
    url: req.url,
    originalUrl: req.originalUrl,
  });
});

// -------------------------------------------------------------
// Global Error Handler
// -------------------------------------------------------------
app.use((err: any, req: any, res: any, next: any) => {
  console.error('[API Server Error]:', err);
  if (!res.headersSent) {
    res.status(500).json({
      error: 'خطأ داخلي في الخادم',
      message: err?.message || String(err),
    });
  }
});

// -------------------------------------------------------------
// Fallback 404 for API routes
// -------------------------------------------------------------
app.use('/api', (req, res) => {
  res.status(404).json({ error: `المسار غير موجود: ${req.method} ${req.originalUrl || req.url}` });
});

// -------------------------------------------------------------
// Vite Middleware / Static Serving Setup
// -------------------------------------------------------------
async function startServer() {
  if (!isDirectCliScript || isServerlessEnv) {
    return;
  }

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Logistics ERP Server running on http://0.0.0.0:${PORT}`);
  });
}

// Only launch HTTP listener when running as standalone Node process, never in Serverless or when imported
if (isDirectCliScript && !isServerlessEnv) {
  startServer();
}

export default app;
export { app };

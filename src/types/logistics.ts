export type Role =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'OPERATOR'
  | 'DISPATCHER'
  | 'MERCHANT'
  | 'CASHIER'
  | 'ACCOUNTANT'
  | 'DRIVER'
  | 'STAFF';

export type PermissionCategory =
  | 'POS'
  | 'WAREHOUSE'
  | 'INVOICES'
  | 'ACCOUNTING'
  | 'SHIPMENTS'
  | 'USERS_PERMISSIONS'
  | 'SETTINGS';

export interface TenantBranding {
  id?: string;
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

export interface PermissionDefinition {
  key: string;
  category: PermissionCategory;
  name: string;
  description: string;
  defaultForRoles: Role[];
}

export const ALL_SYSTEM_PERMISSIONS: PermissionDefinition[] = [
  // POS & Cashier
  {
    key: 'pos.access',
    category: 'POS',
    name: 'الدخول لنظام الكاشير (POS)',
    description: 'إجراء عمليات البيع المباشر للزبائن',
    defaultForRoles: ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'MERCHANT', 'CASHIER'],
  },
  {
    key: 'pos.discount',
    category: 'POS',
    name: 'منح خصومات في الكاشير',
    description: 'تطبيق خصم نقدي أو نسبة مئوية على إجمالي الفاتورة',
    defaultForRoles: ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'MERCHANT'],
  },
  {
    key: 'pos.void_sale',
    category: 'POS',
    name: 'إلغاء واسترجاع فواتير البيع',
    description: 'إلغاء عملية بيع بعد طباعة الإيصال وإعادة البضاعة للمخزن',
    defaultForRoles: ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'MERCHANT'],
  },
  {
    key: 'pos.custom_items',
    category: 'POS',
    name: 'إضافة أصناف يدوية سريعة',
    description: 'إدراج صنف حر بالسعر والاسم دون وجوده مسبقاً بالكتالوج',
    defaultForRoles: ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'MERCHANT', 'CASHIER'],
  },

  // Warehouse & Inventory
  {
    key: 'warehouse.view',
    category: 'WAREHOUSE',
    name: 'عرض المخزون والمستودع',
    description: 'الاطلاع على قوائم المنتجات والكميات المتبقية',
    defaultForRoles: ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'MERCHANT', 'ACCOUNTANT'],
  },
  {
    key: 'warehouse.manage_products',
    category: 'WAREHOUSE',
    name: 'إضافة وتعديل المنتجات والتصنيفات',
    description: 'تعريف أصناف جديدة، تعديل الباركود، وإضافة تصنيفات',
    defaultForRoles: ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'MERCHANT'],
  },
  {
    key: 'warehouse.adjust_stock',
    category: 'WAREHOUSE',
    name: 'تسجيل حركات الجرد وتعديل الكميات',
    description: 'تسجيل تسوية جردية، بضاعة تالفة، أو إضافة رصيد يدوي',
    defaultForRoles: ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'MERCHANT'],
  },
  {
    key: 'warehouse.view_cost_price',
    category: 'WAREHOUSE',
    name: 'الاطلاع على أسعار التكلفة',
    description: 'إظهار سعر التكلفة ورأس المال المستثمر',
    defaultForRoles: ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'MERCHANT', 'ACCOUNTANT'],
  },

  // Invoices & Billing
  {
    key: 'invoices.view',
    category: 'INVOICES',
    name: 'عرض سجل الفواتير والمبيعات',
    description: 'الاطلاع على فواتير المبيعات والمشتريات',
    defaultForRoles: ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'MERCHANT', 'ACCOUNTANT'],
  },
  {
    key: 'invoices.create',
    category: 'INVOICES',
    name: 'إنشاء فواتير جديدة',
    description: 'إصدار فواتير بيع آجلة ونقدية وفواتير موردين',
    defaultForRoles: ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'MERCHANT', 'ACCOUNTANT'],
  },
  {
    key: 'invoices.delete',
    category: 'INVOICES',
    name: 'حذف وإلغاء الفواتير',
    description: 'حذف فاتورة معتمدة وعكس القيود المحاسبية التابعة لها',
    defaultForRoles: ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'],
  },

  // Accounting & Financials
  {
    key: 'accounting.view_pnl',
    category: 'ACCOUNTING',
    name: 'الاطلاع على تقرير الأرباح والخسائر (P&L)',
    description: 'عرض الإيرادات وتكلفة البضاعة وصافي الربح المحقق',
    defaultForRoles: ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'MERCHANT', 'ACCOUNTANT'],
  },
  {
    key: 'accounting.expenses',
    category: 'ACCOUNTING',
    name: 'إدارة وتسجيل المصروفات التشغيلية',
    description: 'إضافة قيود المصاريف (إيجار، رواتب، كهرباء، صيانة)',
    defaultForRoles: ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'MERCHANT', 'ACCOUNTANT'],
  },
  {
    key: 'accounting.wallet_payouts',
    category: 'ACCOUNTING',
    name: 'المطالبات المالية وسحب المحفظة',
    description: 'طلب تحويل المستحقات وإصدار كشوفات الحساب',
    defaultForRoles: ['SUPER_ADMIN', 'ADMIN', 'MERCHANT'],
  },

  // Shipments & Operations
  {
    key: 'shipments.create',
    category: 'SHIPMENTS',
    name: 'إنشاء بوالص وشحنات دارجو',
    description: 'إضافة طلبات توصيل للمحافظات والمناطق',
    defaultForRoles: ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'MERCHANT'],
  },
  {
    key: 'shipments.dispatch',
    category: 'SHIPMENTS',
    name: 'تعيين المناديب وتوزيع الشحنات',
    description: 'إسناد الطرود لكباتن التوصيل وتغيير الحالات التشغيلية',
    defaultForRoles: ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'],
  },

  // Users & Permissions Hierarchy
  {
    key: 'users.manage_operations',
    category: 'USERS_PERMISSIONS',
    name: 'إدارة مسؤولي العمليات (خاص بالسوبر أدمن)',
    description: 'إنشاء حسابات مدراء العمليات وتحديد سقف صلاحياتهم الأقصى',
    defaultForRoles: ['SUPER_ADMIN'],
  },
  {
    key: 'users.manage_staff',
    category: 'USERS_PERMISSIONS',
    name: 'إدارة فريق العمل والمستخدمين التابعين',
    description: 'إنشاء حسابات الكاشير والمحاسبين ومنح الصلاحيات ضمن السقف المسموح',
    defaultForRoles: ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'],
  },

  // Settings & Branding
  {
    key: 'company.branding.manage',
    category: 'SETTINGS',
    name: 'إدارة الهوية وشعار الشركة (White-Label Branding)',
    description: 'رفع شعار الشركة وتغيير الاسم التجاري لتطبيقه تلقائياً على كل الحسابات التابعة',
    defaultForRoles: ['SUPER_ADMIN', 'ADMIN'],
  },
];

export type OrderStatus =
  | 'PENDING' // بالانتظار
  | 'PICKING' // جاري الاستلام
  | 'RECEIVED_AT_HUB' // بالمستودع
  | 'OUT_FOR_DELIVERY' // جاري التوصيل
  | 'POSTPONED' // مؤجل
  | 'CANCELLED' // ملغي
  | 'DELIVERED' // تم التسليم
  | 'RETURNED'; // مرتجع

export type PaymentType = 'COD' | 'CLIQ' | 'PREPAID';

export type SubscriptionPlanType = 'ENTERPRISE' | 'PROFESSIONAL' | 'GROWTH' | 'TRIAL' | 'CUSTOM';
export type SubscriptionStatus = 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'TRIAL';

export interface SubscriptionPlanPreset {
  id: SubscriptionPlanType;
  name: string;
  nameAr: string;
  monthlyPriceJod: number;
  annualPriceJod: number;
  maxMonthlyOrders: number; // 0 for unlimited
  maxUsers: number;
  description: string;
  color: string;
  badge: string;
  includedModules: {
    tmsDelivery: boolean;
    posCashier: boolean;
    merchantWms: boolean;
    accountingSettlements: boolean;
    apiIntegrations: boolean;
    aiRouteOptimizer: boolean;
    whatsappTracking: boolean;
    customDomain: boolean;
  };
}

export const SAAS_SUBSCRIPTION_PLANS: SubscriptionPlanPreset[] = [
  {
    id: 'ENTERPRISE',
    name: 'Enterprise Diamond',
    nameAr: 'الباقة الماسية والمؤسسية (Enterprise)',
    monthlyPriceJod: 150,
    annualPriceJod: 1500,
    maxMonthlyOrders: 0, // غير محدود
    maxUsers: 50,
    description: 'كافة الموديلات والأنظمة مفتوحة بالكامل بدون قيود، دعم فني VIP، وربط API مفتوح.',
    color: 'indigo',
    badge: 'الأكثر تكاملاً وقوة',
    includedModules: {
      tmsDelivery: true,
      posCashier: true,
      merchantWms: true,
      accountingSettlements: true,
      apiIntegrations: true,
      aiRouteOptimizer: true,
      whatsappTracking: true,
      customDomain: true,
    },
  },
  {
    id: 'PROFESSIONAL',
    name: 'Professional Gold',
    nameAr: 'الباقة الذهبية للمحترفين (Gold Pro)',
    monthlyPriceJod: 85,
    annualPriceJod: 850,
    maxMonthlyOrders: 10000,
    maxUsers: 15,
    description: 'مثالية لشركات التوصيل المتوسطة والمتاجر الكبيرة، تشمل الشحنات ونقاط البيع والمخزن والمحاسبة.',
    color: 'amber',
    badge: 'الأكثر شعبية',
    includedModules: {
      tmsDelivery: true,
      posCashier: true,
      merchantWms: true,
      accountingSettlements: true,
      apiIntegrations: true,
      aiRouteOptimizer: true,
      whatsappTracking: false,
      customDomain: false,
    },
  },
  {
    id: 'GROWTH',
    name: 'Growth Silver',
    nameAr: 'الباقة الفضية للنمو (Silver)',
    monthlyPriceJod: 40,
    annualPriceJod: 400,
    maxMonthlyOrders: 2500,
    maxUsers: 5,
    description: 'باقة مخصصة للمتاجر وشركات الخدمات الناشئة الراغبة بإدارة التوصيل والمخزون.',
    color: 'emerald',
    badge: 'للشركات الناشئة',
    includedModules: {
      tmsDelivery: true,
      posCashier: true,
      merchantWms: true,
      accountingSettlements: true,
      apiIntegrations: false,
      aiRouteOptimizer: false,
      whatsappTracking: false,
      customDomain: false,
    },
  },
  {
    id: 'TRIAL',
    name: 'Free Trial',
    nameAr: 'الاشتراك التجريبي المجاني (14 يوم)',
    monthlyPriceJod: 0,
    annualPriceJod: 0,
    maxMonthlyOrders: 100,
    maxUsers: 3,
    description: 'فترة تجريبية تتيح فحص واستكشاف قدرات منظومة TMS والعمليات.',
    color: 'slate',
    badge: 'تجريبي 14 يوم',
    includedModules: {
      tmsDelivery: true,
      posCashier: false,
      merchantWms: false,
      accountingSettlements: false,
      apiIntegrations: false,
      aiRouteOptimizer: false,
      whatsappTracking: false,
      customDomain: false,
    },
  },
];

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  password?: string;
  role: Role;
  roleName?: string;
  commercialName?: string;
  storeName?: string;
  commercialType?: string;
  city?: string;
  address?: string;
  vehicleType?: string;
  vehiclePlate?: string;
  priceList?: string;
  pricePlanId?: string;
  previousPriceList?: string;
  branch?: string;
  branchId?: string;
  department?: string;
  accountManager?: string;
  isActive: boolean;
  
  // SaaS Subscription & Tenant Licensing
  subscriptionPlan?: SubscriptionPlanType;
  subscriptionPlanName?: string;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  maxMonthlyOrders?: number;
  maxUsers?: number;
  monthlyOrdersUsed?: number;
  subscriptionPrice?: number;
  subscriptionBillingCycle?: SubscriptionCycle | 'MONTHLY' | 'ANNUAL';
  suspendedReason?: string;
  enabledModules?: {
    tmsDelivery?: boolean;
    posCashier?: boolean;
    merchantWms?: boolean;
    accountingSettlements?: boolean;
    apiIntegrations?: boolean;
    aiRouteOptimizer?: boolean;
    whatsappTracking?: boolean;
    customDomain?: boolean;
    [key: string]: boolean | undefined;
  };
  companyName?: string;
  customDomain?: string;
  notes?: string;

  // Hierarchical RBAC Properties
  tenantId?: string | null;         // Tenant ID for multi-tenant isolation
  businessName?: string;            // Business or trade name
  createdAt?: string;               // Account registration timestamp
  updatedAt?: string;               // Last updated timestamp
  parentUserId?: string | null;     // ID of the Operations Admin who manages this user
  createdById?: string;             // Who created this account
  permissions?: string[];           // Active specific permissions assigned to this user
  maxAllowedPermissions?: string[]; // Boundary ceiling set by Super Admin for an Operations Admin
  portalAccess?: 'OPS' | 'MERCHANT' | 'DRIVER' | 'CASHIER' | 'STAFF' | string;
  portal_access?: string;

  // Phase 1.5B Identity & Invitation Fields
  authProvider?: 'EMAIL_PASSWORD' | 'GOOGLE' | 'HYBRID';
  authUserId?: string;
  auth_user_id?: string;
  googleId?: string;
  google_id?: string;
  googleEmail?: string;
  google_email?: string;
  invitationId?: string;
  invitedBy?: string;
}

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';

export interface UserInvitation {
  id: string;
  tokenHash: string;
  email: string;
  phone?: string;
  role: Role;
  roleName?: string;
  tenantId?: string | null;
  parentUserId?: string | null;
  invitedBy: string;
  inviterName?: string;
  inviterRole?: string;
  permissions?: string[];
  maxAllowedPermissions?: string[];
  commercialName?: string;
  companyName?: string;
  branch?: string;
  branchId?: string | null;
  city?: string;
  priceList?: string;
  pricePlanId?: string;
  status: InvitationStatus;
  expiresAt: string;
  acceptedAt?: string;
  acceptedByUserId?: string;
  authProvider?: 'EMAIL_PASSWORD' | 'GOOGLE';
  createdAt: string;
  updatedAt: string;
}

export interface PricePlan {
  id: string;
  name: string;
  type: 'MERCHANT' | 'DRIVER';
  merchantId?: string;
  description?: string;
  isDefault: boolean;
  defaultFee: number;
  governorateFees: Record<string, number>;
  returnFee?: number;
  extraWeightFeePerKg?: number;
  createdAt: string;
  updatedAt: string;
}

export interface StatusLog {
  id: string;
  orderId: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  note: string;
  createdAt: string;
}

export interface Order {
  id: string;
  sequence: string;           // ORD-2026-XXXX
  referenceNumber?: string;    // REF-XXXX
  tenantId?: string;          // Multi-Tenant Isolation: ID of the managing Operations Admin / Company
  adminId?: string;
  status: OrderStatus;
  paymentType: PaymentType;
  
  merchantId: string;
  merchant?: User;
  branchId?: string;
  branchName?: string;

  driverId?: string | null;
  driver?: User | null;

  recipientName: string;
  recipientPhone: string;
  recipientPhoneAlt?: string;
  governorate: string;         // عمان، إربد، الزرقاء...
  area: string;                // ضاحية الياسمين، خلدا...
  subArea?: string;
  fullAddress: string;
  locationCoordinates?: string;

  merchantCollection: number;  // دينار
  deliveryFee: number;         // دينار
  driverFee?: number;          // دينار (عمولة الكابتن)
  returnFee?: number;          // دينار (رسوم إرجاع الطرد الموثقة)
  totalCollection: number;     // دينار

  isSettledWithMerchant: boolean;
  isSettledWithDriver: boolean;
  settlementStatus?: 'PENDING' | 'SETTLED' | 'CANCELLED';

  packageType: string;
  packageWeightKg?: number;
  piecesCount: number;
  deliveryAttempts: number;
  notes?: string;
  cancellationReason?: string;

  scheduledDate?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;

  // Shelf & Reverse Logistics
  warehouseShelf?: string;     // مثال: A-04, R-01 (رف المرتجعات)
  routeOrderIndex?: number;    // ترتيب المحطة في المسار الذكي
  returnHandoverStatus?: 'AT_WAREHOUSE' | 'OUT_TO_MERCHANT' | 'RETURNED_TO_MERCHANT';

  // Proof of Delivery (POD) & Verification
  deliveryOtp?: string;        // رمز التحقق السري للاستلام (4 أرقام)
  otpVerified?: boolean;       // هل تم التحقق بالرمز
  recipientSignature?: string; // توقيع العميل الرقمي
  deliveryPhoto?: string;      // صورة إثبات التسليم (عند الباب)
  smsNotificationSent?: boolean;

  statusLogs?: StatusLog[];
}

export interface ApiKey {
  id: string;
  merchantId: string;
  name: string;
  key: string;
  secret: string;
  createdAt: string;
  lastUsedAt?: string;
  platform: 'SHOPIFY' | 'WOOCOMMERCE' | 'SALLA' | 'ZID' | 'CUSTOM';
}

export interface NotificationLog {
  id: string;
  orderId: string;
  recipientPhone: string;
  type: 'SMS' | 'WHATSAPP';
  message: string;
  status: 'SENT' | 'DELIVERED' | 'FAILED';
  sentAt: string;
}

export interface OrdersQueryResponse {
  orders: Order[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  stats: {
    total: number;
    pending: number;
    picking: number;
    out_for_delivery: number;
    delivered: number;
    cancelled: number;
    postponed: number;
    totalCOD: number;
    totalDeliveryFees: number;
  };
}

export interface QuickOrderPayload {
  recipientName: string;
  recipientPhone: string;
  governorate: string;
  area: string;
  fullAddress: string;
  totalCollection: number;
  deliveryFee: number;
  merchantId: string;
  driverId?: string;
  notes?: string;
}

export interface BatchOrderPayload {
  orders: QuickOrderPayload[];
}

export interface RoleRecord {
  id: string;
  name: string;
  roleKey: string;
  description?: string;
  isSystemRole: boolean;
  tenantId?: string | null;
  permissions: string[];
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogRecord {
  id: string;
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
  timestamp: string;
}

export type SubscriptionCycle = 'MONTHLY' | 'YEARLY' | 'CUSTOM';
export type SubscriptionEngineStatus = 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'CANCELLED';

export interface SubscriptionPlanRecord {
  id: string;
  code: string;
  name: string;
  nameAr: string;
  description: string;
  price: number;
  monthlyPrice: number;
  annualPrice: number;
  currency: string;
  billingCycle: SubscriptionCycle;
  trialDays: number;
  maxUsers: number;
  maxMonthlyOrders: number; // 0 for unlimited
  enabledModules: {
    tmsDelivery: boolean;
    posCashier: boolean;
    merchantWms: boolean;
    accountingSettlements: boolean;
    apiIntegrations: boolean;
    aiRouteOptimizer: boolean;
    whatsappTracking?: boolean;
    customDomain?: boolean;
    [key: string]: boolean | undefined;
  };
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionRecord {
  id: string;
  tenantId: string;
  tenantName?: string;
  planId: string;
  planCode: string;
  planName: string;
  status: SubscriptionEngineStatus;
  effectiveStatus?: SubscriptionEngineStatus;
  startDate: string;
  endDate: string;
  trialStartDate?: string;
  trialEndDate?: string;
  price: number;
  currency: string;
  billingCycle: SubscriptionCycle;
  enabledModules: Record<string, boolean>;
  maxUsers: number;
  maxMonthlyOrders: number;
  autoRenew: boolean;
  suspendedReason?: string;
  gracePeriodDays?: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TenantSubscriptionContext {
  tenantId: string;
  tenantName?: string;
  subscription: SubscriptionRecord | null;
  plan: SubscriptionPlanRecord | null;
  status: SubscriptionEngineStatus;
  effectiveStatus: SubscriptionEngineStatus;
  isActive: boolean;
  isTrial: boolean;
  isExpired: boolean;
  isSuspended: boolean;
  isCancelled: boolean;
  startDate: string;
  endDate: string;
  trialDaysRemaining?: number;
  daysRemaining: number;
  enabledModules: Record<string, boolean>;
  limits: {
    maxUsers: number;
    maxMonthlyOrders: number;
  };
  usage: {
    currentUsers: number;
    currentMonthlyOrders: number;
  };
}

// ==============================================================================
// Enterprise Multi-Branch & Normalized Authorization Types
// ==============================================================================

export interface MerchantBranch {
  id: string;
  tenantId?: string;
  merchantId: string;
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

export interface UserBranchAccess {
  id: string;
  tenantId?: string;
  merchantId: string;
  userId: string;
  branchId: string;
  roleInBranch: 'CASHIER' | 'BRANCH_MANAGER' | 'STAFF';
  isDefault: boolean;
  createdBy?: string;
  createdAt: string;
}

export interface BranchInventoryItem {
  id: string;
  tenantId?: string;
  merchantId: string;
  branchId: string;
  productId: string;
  quantity: number;
  minStockAlert: number;
  shelfLocation?: string;
  updatedAt: string;
}

export type StockTransferLifecycle = 'PENDING' | 'APPROVED' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';

export interface MerchantStockTransfer {
  id: string;
  tenantId?: string;
  merchantId: string;
  productId: string;
  productName?: string;
  sourceBranchId: string;
  sourceBranchName?: string;
  destBranchId: string;
  destBranchName?: string;
  quantity: number;
  status: StockTransferLifecycle;
  notes?: string;
  transferNumber?: string;
  createdBy?: string;
  approvedBy?: string;
  receivedBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface FinancialObligation {
  id: string;
  tenantId: string;
  shipmentId: string;
  beneficiaryId: string;
  obligationType: 'MERCHANT_COD' | 'DRIVER_EARNING';
  originalAmount: number;
  currency: string;
  status: 'OPEN' | 'PARTIALLY_SETTLED' | 'SETTLED' | 'CANCELLED';
  sourceReference?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SettlementItem {
  id: string;
  settlementId: string;
  tenantId: string;
  obligationId?: string;
  orderId?: string;
  shipmentId?: string;
  beneficiaryId?: string;
  obligationType?: 'MERCHANT_COD' | 'DRIVER_EARNING';
  allocatedAmount?: number;
  trackingNumber?: string;
  totalCodCollected: number;
  deliveryFeeDeducted: number;
  driverFeePaid?: number;
  netSettledAmount: number;
  allocatedAt: string;
}

export interface SettlementRecord {
  id: string;
  tenantId: string;
  settlementNumber: string;
  type: 'MERCHANT' | 'DRIVER';
  beneficiaryId: string;
  beneficiaryName?: string;
  totalAmount: number;
  paymentMethod: 'CASH' | 'CLIQ' | 'BANK_TRANSFER' | 'CHEQUE';
  voucherId?: string;
  journalEntryId?: string;
  idempotencyKey?: string;
  status: 'DRAFT' | 'APPROVED' | 'POSTED' | 'CANCELLED';
  items?: SettlementItem[];
  orderIds?: string[];
  notes?: string;
  createdBy?: string;
  approvedBy?: string;
  postedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountingPeriod {
  id: string;
  tenantId: string;
  periodName: string;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'CLOSED' | 'LOCKED';
  closedAt?: string;
  closedBy?: string;
  reopenedAt?: string;
  reopenedBy?: string;
  reopenReason?: string;
  createdAt: string;
}


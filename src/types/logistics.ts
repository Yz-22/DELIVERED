export type Role =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'OPERATOR'
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
  | 'USERS_PERMISSIONS';

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
  subscriptionBillingCycle?: 'MONTHLY' | 'ANNUAL';
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
  parentUserId?: string | null;     // ID of the Operations Admin who manages this user
  createdById?: string;             // Who created this account
  permissions?: string[];           // Active specific permissions assigned to this user
  maxAllowedPermissions?: string[]; // Boundary ceiling set by Super Admin for an Operations Admin
}

export interface PricePlan {
  id: string;
  name: string;
  type: 'MERCHANT' | 'DRIVER';
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

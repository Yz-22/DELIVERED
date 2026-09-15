import express from 'express';
import path from 'path';
import fs from 'fs';
import { Order, OrderStatus, User, ApiKey, NotificationLog, PricePlan } from './src/types/logistics';
import {
  Account,
  JournalEntry,
  JournalEntryLine,
  Voucher,
  MerchantProduct,
  StockMovement,
  MerchantInvoice,
  MerchantExpense,
} from './src/types/accounting';

const app = express();
const PORT = 3000;

// Safe body parser: if Vercel serverless environment already parsed the JSON body, do not re-read stream
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
    return next();
  }
  express.json()(req, res, next);
});

// CORS headers for all environments
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-api-key');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Detect Serverless / Vercel environment
const isServerlessEnv = Boolean(
  process.env.VERCEL ||
  process.env.VERCEL_ENV ||
  process.env.NOW_REGION ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT
);

// Persistent File-Based Storage Path (Vercel uses /tmp for writable storage)
const DB_DIR = isServerlessEnv ? path.join('/tmp', 'data') : path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'dargo_db.json');
const INITIAL_SEED_FILE = path.join(process.cwd(), 'data', 'dargo_db.json');

// Auto-persist on any state mutation (Direct write for serverless environments to avoid frozen setTimeout)
app.use((req, res, next) => {
  if (typeof res.json === 'function') {
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) && (!res.statusCode || res.statusCode < 400)) {
        try {
          saveDatabase();
        } catch (err) {
          console.error('Auto-persist error:', err);
        }
      }
      return originalJson(body);
    };
  }
  next();
});

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

let nextSequenceNumber = 1001;

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

// Helper: Attach relational objects to an order
function populateOrder(order: Order): Order {
  const merchant = users.find((u) => u.id === order.merchantId);
  const driver = order.driverId ? users.find((u) => u.id === order.driverId) || null : null;
  const driverFee =
    order.driverFee !== undefined
      ? order.driverFee
      : order.driverId
      ? getDriverCompensationFee(order.driverId, order.governorate)
      : 1.5;

  return {
    ...order,
    driverFee,
    merchant,
    driver,
  };
}

// -------------------------------------------------------------
// Database Persistence Layer (Auto-Save & Auto-Load)
// -------------------------------------------------------------
function saveDatabase() {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    const payload = {
      users,
      orders,
      pricePlans,
      apiKeys,
      notificationLogs,
      nextSequenceNumber,
      accounts,
      journalEntries,
      vouchers,
      merchantProducts,
      stockMovements,
      merchantInvoices,
      merchantExpenses,
      merchantCategories,
      savedAt: new Date().toISOString(),
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save to dargo_db.json:', err);
  }
}

function loadDatabase() {
  try {
    const sourceFile = fs.existsSync(DB_FILE) ? DB_FILE : (fs.existsSync(INITIAL_SEED_FILE) ? INITIAL_SEED_FILE : null);
    if (sourceFile) {
      const raw = fs.readFileSync(sourceFile, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.orders)) orders = data.orders;
      if (Array.isArray(data.users) && data.users.length > 0) {
        users = data.users;
      }
      if (Array.isArray(data.pricePlans) && data.pricePlans.length > 0) pricePlans = data.pricePlans;
      if (Array.isArray(data.apiKeys)) apiKeys = data.apiKeys;
      if (Array.isArray(data.notificationLogs)) notificationLogs = data.notificationLogs;
      if (typeof data.nextSequenceNumber === 'number') nextSequenceNumber = data.nextSequenceNumber;
      if (Array.isArray(data.accounts) && data.accounts.length > 0) accounts = data.accounts;
      if (Array.isArray(data.journalEntries)) journalEntries = data.journalEntries;
      if (Array.isArray(data.vouchers)) vouchers = data.vouchers;
      if (Array.isArray(data.merchantProducts)) merchantProducts = data.merchantProducts;
      if (Array.isArray(data.stockMovements)) stockMovements = data.stockMovements;
      if (Array.isArray(data.merchantInvoices)) merchantInvoices = data.merchantInvoices;
      if (Array.isArray(data.merchantExpenses)) merchantExpenses = data.merchantExpenses;
      if (data.merchantCategories && typeof data.merchantCategories === 'object') {
        merchantCategories = data.merchantCategories;
      }

      // Ensure Super Admin always exists in database
      const hasSuperAdmin = users.some((u) => u.role === 'SUPER_ADMIN');
      if (!hasSuperAdmin) {
        users.unshift({
          id: 'u-super-1',
          name: 'المدير العام للنظام (Super Admin)',
          email: 'admin@dargo-tms.io',
          phone: '0790000001',
          password: 'admin123',
          role: 'SUPER_ADMIN',
          roleName: 'المدير العام للنظام (Super Admin)',
          branch: 'المقر الرئيسي للمملكة',
          city: 'عمان',
          isActive: true,
          permissions: ['manage_system_settings', 'manage_operations_admins', 'view_financial_audit_logs', 'export_database_backup'],
          maxAllowedPermissions: ['manage_system_settings', 'manage_operations_admins', 'view_financial_audit_logs', 'export_database_backup'],
        });
        saveDatabase();
      }

      console.log(`[DarGo DB] Loaded ${orders.length} orders, ${users.length} users, ${accounts.length} accounts, and ${merchantProducts.length} merchant products from persistent storage.`);
    } else {
      saveDatabase();
    }
  } catch (err) {
    console.error('Failed to read dargo_db.json, using clean defaults:', err);
  }
}

// Ensure database is loaded from persistent storage or initial seed file
if (fs.existsSync(DB_FILE)) {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.orders) && parsed.orders.some((o: any) => o.id === 'ord-101' || o.id === 'ord-102')) {
      saveDatabase();
    } else {
      loadDatabase();
    }
  } catch {
    saveDatabase();
  }
} else {
  // If running on Vercel /tmp or first run, load from INITIAL_SEED_FILE if available
  loadDatabase();
}

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// Clean Database / Reset to Fresh Production State Endpoint
app.post('/api/system/clean-database', (req, res) => {
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
  res.json({ success: true, message: 'تم تصفير جميع البيانات الوهمية وتجهيز قاعدة البيانات للبيانات الحقيقية بنجاح' });
});

// Price Plans & Rate Cards Endpoints (قوائم وتسعيرات التوصيل للتاجر والسائق)
// -------------------------------------------------------------
app.get('/api/price-plans', (req, res) => {
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
app.post('/api/price-plans', (req, res) => {
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
app.patch('/api/price-plans/:id', (req, res) => {
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
app.delete('/api/price-plans/:id', (req, res) => {
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
app.post('/api/price-plans/:id/assign', (req, res) => {
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
app.post('/api/price-plans/calculate', (req, res) => {
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

// 1. GET /api/orders: Fetch orders with pagination, search & filters
app.get('/api/orders', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.max(1, parseInt(req.query.limit as string) || 10);
  const search = (req.query.search as string || '').trim().toLowerCase();
  const status = req.query.status as string;
  const governorate = req.query.governorate as string;
  const merchantId = req.query.merchantId as string;
  const driverId = req.query.driverId as string;
  const sortBy = (req.query.sortBy as string) || 'createdAt';
  const sortDir = (req.query.sortDir as string) || 'desc';

  let filtered = [...orders];

  // Search by Sequence, Reference, Recipient Phone, Recipient Name, or Area
  if (search) {
    filtered = filtered.filter((o) => {
      return (
        o.sequence.toLowerCase().includes(search) ||
        (o.referenceNumber && o.referenceNumber.toLowerCase().includes(search)) ||
        o.recipientPhone.includes(search) ||
        o.recipientName.toLowerCase().includes(search) ||
        o.area.toLowerCase().includes(search) ||
        o.governorate.toLowerCase().includes(search)
      );
    });
  }

  // Filter by Status
  if (status && status !== 'ALL') {
    filtered = filtered.filter((o) => o.status === status);
  }

  // Filter by Governorate
  if (governorate && governorate !== 'ALL') {
    filtered = filtered.filter((o) => o.governorate === governorate);
  }

  // Filter by Merchant
  if (merchantId && merchantId !== 'ALL') {
    filtered = filtered.filter((o) => o.merchantId === merchantId);
  }

  // Filter by Driver
  if (driverId) {
    if (driverId === 'UNASSIGNED') {
      filtered = filtered.filter((o) => !o.driverId);
    } else if (driverId !== 'ALL') {
      filtered = filtered.filter((o) => o.driverId === driverId);
    }
  }

  // Sort
  filtered.sort((a: any, b: any) => {
    let aVal = a[sortBy] ?? '';
    let bVal = b[sortBy] ?? '';
    if (typeof aVal === 'string') {
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
  });

  // Calculate Global Stats from All Current Orders
  const stats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === 'PENDING').length,
    picking: orders.filter((o) => o.status === 'PICKING').length,
    out_for_delivery: orders.filter((o) => o.status === 'OUT_FOR_DELIVERY').length,
    delivered: orders.filter((o) => o.status === 'DELIVERED').length,
    cancelled: orders.filter((o) => o.status === 'CANCELLED').length,
    postponed: orders.filter((o) => o.status === 'POSTPONED').length,
    totalCOD: orders.reduce((sum, o) => sum + (o.totalCollection || 0), 0),
    totalDeliveryFees: orders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0),
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
});

// 2. GET /api/orders/:id: Get single order details with status logs
app.get('/api/orders/:id', (req, res) => {
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'الطلبية غير موجودة' });
  }
  res.json(populateOrder(order));
});

// 3. POST /api/orders: Create new order (Full form)
app.post('/api/orders', (req, res) => {
  try {
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

    const mColl = parseFloat(merchantCollection) || 0;
    const finalDeliveryFee =
      deliveryFee !== undefined && deliveryFee !== null && deliveryFee !== ''
        ? parseFloat(deliveryFee)
        : getMerchantDeliveryFee(merchantId, governorate);
    const tot = totalCollection !== undefined ? parseFloat(totalCollection) : mColl + finalDeliveryFee;
    const calcDriverFee = driverId ? getDriverCompensationFee(driverId, governorate) : undefined;

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      sequence: `ORD-2026-${nextSequenceNumber++}`,
      referenceNumber: referenceNumber || `REF-${Math.floor(1000 + Math.random() * 9000)}`,
      status: driverId ? 'OUT_FOR_DELIVERY' : 'PENDING',
      paymentType: 'COD',
      merchantId,
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
app.post('/api/orders/quick', (req, res) => {
  try {
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
app.post('/api/orders/batch', (req, res) => {
  try {
    const { orders: batchItems } = req.body;
    if (!Array.isArray(batchItems) || batchItems.length === 0) {
      return res.status(400).json({ error: 'قائمة الطلبيات فارغة' });
    }

    const created: Order[] = [];
    for (const item of batchItems) {
      const tot = parseFloat(item.totalCollection) || 25;
      const fee = parseFloat(item.deliveryFee) || 3.0;
      const mColl = Math.max(0, tot - fee);

      const newOrder: Order = {
        id: `ord-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        sequence: `ORD-2026-${nextSequenceNumber++}`,
        referenceNumber: item.referenceNumber || `BATCH-${Math.floor(1000 + Math.random() * 9000)}`,
        status: item.driverId ? 'OUT_FOR_DELIVERY' : 'PENDING',
        paymentType: 'COD',
        merchantId: item.merchantId || users.find((u) => u.role === 'MERCHANT')?.id || '',
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
app.patch('/api/orders/:id/status', (req, res) => {
  const { status, note, cancellationReason } = req.body;
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'الطلبية غير موجودة' });
  }

  const oldStatus = order.status;
  order.status = status as OrderStatus;
  order.updatedAt = new Date().toISOString();

  if (status === 'DELIVERED') {
    order.deliveredAt = new Date().toISOString();
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

  res.json(populateOrder(order));
});

// 7. PATCH /api/orders/:id/assign: Assign driver to single order
app.patch('/api/orders/:id/assign', (req, res) => {
  const { driverId } = req.body;
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'الطلبية غير موجودة' });
  }

  order.driverId = driverId || null;
  if (driverId && order.status === 'PENDING') {
    order.status = 'OUT_FOR_DELIVERY';
  }
  order.updatedAt = new Date().toISOString();

  res.json(populateOrder(order));
});

// 8. POST /api/orders/bulk-status: Bulk Status Update
app.post('/api/orders/bulk-status', (req, res) => {
  const { ids, status, note } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'لم يتم تحديد أي طلبيات' });
  }

  orders = orders.map((o) => {
    if (ids.includes(o.id)) {
      const old = o.status;
      return {
        ...o,
        status,
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

  res.json({ message: `تم تحديث ${ids.length} طلبية بنجاح` });
});

// 9. POST /api/orders/bulk-assign: Bulk Assign Driver
app.post('/api/orders/bulk-assign', (req, res) => {
  const { ids, driverId } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'لم يتم تحديد أي طلبيات' });
  }

  orders = orders.map((o) => {
    if (ids.includes(o.id)) {
      return {
        ...o,
        driverId: driverId || null,
        status: driverId && o.status === 'PENDING' ? 'OUT_FOR_DELIVERY' : o.status,
        updatedAt: new Date().toISOString(),
      };
    }
    return o;
  });

  res.json({ message: `تم تعيين السائق لـ ${ids.length} طلبية بنجاح` });
});

// 10. DELETE /api/orders/:id: Delete single order
app.delete('/api/orders/:id', (req, res) => {
  const idx = orders.findIndex((o) => o.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: 'الطلبية غير موجودة' });
  }
  orders.splice(idx, 1);
  res.json({ success: true, message: 'تم حذف الطلبية' });
});

// 11. GET /api/users: Return Merchants and Drivers
app.get('/api/users', (req, res) => {
  const role = req.query.role as string;
  let result = [...users];
  if (role) {
    result = result.filter((u) => u.role === role);
  }
  res.json(result);
});

// 11b. POST /api/users: Create new User with Price List & Role
app.post('/api/users', (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      role = 'MERCHANT',
      roleName,
      commercialName,
      commercialType,
      city = 'عمان',
      address,
      priceList = 'جميع المملكة 2',
      branch = 'فرع عمان الرئيسي',
      accountManager = 'باسل البلبيسي',
      isActive = true,
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'الاسم ورقم الهاتف مطلوبان' });
    }

    const newUser: User = {
      id: `u-${role.toLowerCase().slice(0, 3)}-${Date.now()}`,
      name,
      email: email || `${phone}@dargo-tms.io`,
      phone,
      role,
      roleName,
      commercialName,
      commercialType,
      city,
      address,
      priceList,
      branch,
      accountManager,
      isActive,
    };

    users.unshift(newUser);
    saveDatabase();
    res.status(201).json(newUser);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 11c. PATCH /api/users/:id: Update User
app.patch('/api/users/:id', (req, res) => {
  const user = users.find((u) => u.id === req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'المستخدم غير موجود' });
  }

  Object.assign(user, req.body);
  saveDatabase();
  res.json(user);
});

// 12. GET /api/stats: Top-level Dashboard Metrics
app.get('/api/stats', (req, res) => {
  const total = orders.length;
  const delivered = orders.filter((o) => o.status === 'DELIVERED').length;
  const active = orders.filter((o) => ['PENDING', 'PICKING', 'OUT_FOR_DELIVERY'].includes(o.status)).length;
  const totalCOD = orders.reduce((sum, o) => sum + (o.totalCollection || 0), 0);
  const totalFees = orders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);
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
app.post('/api/orders/scan', (req, res) => {
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
app.get('/api/settlements', (req, res) => {
  const merchantUsers = users.filter((u) => u.role === 'MERCHANT');
  const driverUsers = users.filter((u) => u.role === 'DRIVER');

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
app.post('/api/settlements/merchants/:merchantId/settle', (req, res) => {
  const { merchantId } = req.params;
  const { paymentMethod = 'CLIQ', reference = '', notes = '' } = req.body;

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
app.post('/api/settlements/drivers/:driverId/close-cash', (req, res) => {
  const { driverId } = req.params;
  const { notes = '' } = req.body;

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
app.post('/api/routes/optimize', (req, res) => {
  const { driverId } = req.body;
  if (!driverId) {
    return res.status(400).json({ error: 'معرف الكابتن مطلوب' });
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
app.patch('/api/orders/:id/shelf', (req, res) => {
  const { shelf } = req.body;
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'الطلبية غير موجودة' });
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
app.post('/api/returns/handover', (req, res) => {
  const { ids, merchantId, manifestCode, notes } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'لم يتم تحديد أي طرود مرتجعة' });
  }

  let processedCount = 0;
  orders = orders.map((o) => {
    if (ids.includes(o.id)) {
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
app.post('/api/orders/:id/verify-pod', (req, res) => {
  const { otp, signature, photo, driverNote, bypassOtp } = req.body;
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'الطلبية غير موجودة' });
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
app.post('/api/orders/:id/send-sms', (req, res) => {
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'الطلبية غير موجودة' });
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
app.get('/api/merchants/:id/integrations', (req, res) => {
  const merchantId = req.params.id;
  const merchantKeys = apiKeys.filter((k) => k.merchantId === merchantId);

  res.json({
    merchantId,
    apiKeys: merchantKeys,
    webhookEndpoint: `https://dargo.olivery.io/api/webhooks/orders?token=${merchantId}`,
    supportedPlatforms: ['SHOPIFY', 'WOOCOMMERCE', 'SALLA', 'ZID', 'CUSTOM_REST'],
  });
});

// 24. POST /api/merchants/:id/api-keys: Generate New API Key
app.post('/api/merchants/:id/api-keys', (req, res) => {
  const merchantId = req.params.id;
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

// 26. POST /api/auth/login: User Authentication by Email/Phone & Password (managed by Super Admin)
app.post('/api/auth/login', (req, res) => {
  const { email, phone, password, requireOps } = req.body;
  let user: User | undefined = undefined;

  const identifier = email || phone;
  if (!identifier || !identifier.toString().trim()) {
    return res.status(400).json({ error: 'يرجى إدخال البريد الإلكتروني أو رقم الهاتف' });
  }

  const cleanId = identifier.toString().trim().toLowerCase();
  user = users.find(
    (u) =>
      (u.email && u.email.trim().toLowerCase() === cleanId) ||
      (u.phone && u.phone.trim() === cleanId)
  );

  if (!user) {
    return res.status(401).json({
      error: 'البريد الإلكتروني أو رقم الهاتف غير مسجل في النظام. يرجى التواصل مع المدير العام (Super Admin) لإنشاء حسابك.',
    });
  }

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

  const inputPass = password ? password.toString().trim() : '';
  const expectedPass = user.password || (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' ? 'admin123' : '123456');

  if (inputPass !== expectedPass) {
    return res.status(401).json({
      error: 'كلمة المرور غير صحيحة، يرجى التحقق والمحاولة مرة أخرى.',
    });
  }

  res.json({
    success: true,
    user,
    token: `dargo_jwt_${user.id}_${Date.now()}`,
    message: `مرحباً بك يا ${user.name}`,
  });
});

// 26.0 POST /api/auth/register-ops: Direct Super Admin Registration from OPS Portal
app.post('/api/auth/register-ops', (req, res) => {
  try {
    const { name, email, phone, password, securityPasscode } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'يرجى إدخال الاسم الكامل للسوبر أدمن' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: 'يرجى إدخال رقم الهاتف المعتمد' });
    }
    if (!password || password.trim().length < 6) {
      return res.status(400).json({ error: 'كلمة المرور يجب أن لا تقل عن 6 خانات' });
    }

    const cleanEmail = email && email.trim() ? email.trim().toLowerCase() : `${phone.replace(/\D/g, '')}@dargo-ops.io`;
    const cleanPhone = phone.trim();

    // Check duplicate
    const existing = users.find(
      (u) =>
        (u.email && u.email.toLowerCase() === cleanEmail) ||
        (u.phone && u.phone === cleanPhone)
    );

    if (existing) {
      return res.status(400).json({
        error: `المستخدم مسجل مسبقاً في قاعدة البيانات (${cleanEmail}). يمكنك تسجيل الدخول مباشرة.`,
      });
    }

    const newSuperAdmin: User = {
      id: `u-super-${Date.now()}`,
      name: name.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      password: password.trim(),
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
        'users.manage_operations',
        'users.manage_staff',
      ],
      maxAllowedPermissions: [
        'manage_system_settings',
        'manage_operations_admins',
        'view_financial_audit_logs',
        'export_database_backup',
        'users.manage_operations',
        'users.manage_staff',
      ],
    };

    users.unshift(newSuperAdmin);
    saveDatabase();

    const token = `dargo_jwt_${newSuperAdmin.id}_${Date.now()}`;

    res.status(201).json({
      success: true,
      message: 'تم تسجيل وإنشاء حساب السوبر أدمن الجديد في قاعدة البيانات بنجاح',
      user: newSuperAdmin,
      token,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 26.0 POST /api/auth/verify: Verify session token and current user
app.post('/api/auth/verify', (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'معرف المستخدم مطلوب' });
  }

  const user = users.find((u) => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: 'المستخدم غير موجود' });
  }

  if (!user.isActive) {
    return res.status(403).json({ error: 'الحساب غير نشط' });
  }

  res.json({ success: true, user });
});

// 26.1 GET /api/users: List Users with RBAC Hierarchy
app.get('/api/users', (req, res) => {
  const role = req.query.role as string;
  const parentUserId = req.query.parentUserId as string;

  let filtered = [...users];
  if (role && role !== 'ALL') {
    filtered = filtered.filter((u) => u.role === role);
  }
  if (parentUserId) {
    filtered = filtered.filter((u) => u.parentUserId === parentUserId);
  }

  res.json(filtered);
});

// 26.2 POST /api/users: Create User with Hierarchy, Password and Permissions
app.post('/api/users', (req, res) => {
  try {
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
      return res.status(400).json({ error: 'الاسم ورقم الهاتف مطلوبان' });
    }

    const cleanEmail = email && email.trim() ? email.trim().toLowerCase() : `${phone.replace(/\D/g, '')}@dargo-tms.io`;

    // Check duplicate email
    const duplicate = users.find((u) => u.email && u.email.toLowerCase() === cleanEmail);
    if (duplicate) {
      return res.status(400).json({ error: `البريد الإلكتروني (${cleanEmail}) مسجل مسبقاً لمستخدم آخر` });
    }

    const assignedPassword = password && password.trim() ? password.trim() : (role === 'SUPER_ADMIN' || role === 'ADMIN' ? 'admin123' : '123456');

    const newUser: User = {
      id: `u-${role.toLowerCase().slice(0, 3)}-${Date.now()}`,
      name: name.trim(),
      email: cleanEmail,
      password: assignedPassword,
      phone: phone.trim(),
      role,
      roleName: roleName || (role === 'SUPER_ADMIN' ? 'المدير العام للنظام' : role === 'ADMIN' ? 'مدير العمليات' : role === 'MERCHANT' ? 'حساب التاجر' : role === 'DRIVER' ? 'كابتن التوصيل' : role === 'CASHIER' ? 'موظف الكاشير' : role === 'ACCOUNTANT' ? 'محاسب مالي' : 'موظف العمليات'),
      parentUserId: parentUserId || null,
      permissions: Array.isArray(permissions) ? permissions : [],
      maxAllowedPermissions: Array.isArray(maxAllowedPermissions) ? maxAllowedPermissions : [],
      commercialName: commercialName?.trim(),
      commercialType: commercialType?.trim(),
      priceList: priceList || 'جميع المملكة (القياسية)',
      pricePlanId: pricePlanId || (role === 'DRIVER' ? 'pp-drv-std' : 'pp-mer-std'),
      branch: branch || 'فرع عمان الرئيسي',
      city: city || 'عمان',
      accountManager: accountManager || 'باسل البلبيسي',
      department: department?.trim(),
      vehicleType,
      vehiclePlate,
      isActive: Boolean(isActive),
    };

    users.push(newUser);
    saveDatabase();

    res.status(201).json({
      success: true,
      message: 'تم إنشاء المستخدم بنجاح وتعيين الصلاحيات وكلمة المرور',
      user: newUser,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 26.3 PATCH /api/users/:id: Update User, Password and Granular RBAC Permissions
app.patch('/api/users/:id', (req, res) => {
  const user = users.find((u) => u.id === req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'المستخدم غير موجود' });
  }

  // If updating email, check duplicate
  if (req.body.email) {
    const cleanEmail = req.body.email.trim().toLowerCase();
    const duplicate = users.find((u) => u.id !== user.id && u.email && u.email.toLowerCase() === cleanEmail);
    if (duplicate) {
      return res.status(400).json({ error: `البريد الإلكتروني (${cleanEmail}) مسجل مسبقاً لمستخدم آخر` });
    }
  }

  const allowedUpdates = [
    'name',
    'email',
    'password',
    'phone',
    'role',
    'roleName',
    'parentUserId',
    'permissions',
    'maxAllowedPermissions',
    'commercialName',
    'commercialType',
    'priceList',
    'pricePlanId',
    'branch',
    'city',
    'accountManager',
    'department',
    'vehicleType',
    'vehiclePlate',
    'isActive',
    'address',
    'subscriptionPlan',
    'subscriptionPlanName',
    'subscriptionStatus',
    'subscriptionStartDate',
    'subscriptionEndDate',
    'maxMonthlyOrders',
    'maxUsers',
    'monthlyOrdersUsed',
    'subscriptionPrice',
    'subscriptionBillingCycle',
    'suspendedReason',
    'enabledModules',
    'companyName',
    'customDomain',
    'notes',
  ];

  for (const key of allowedUpdates) {
    if (req.body[key] !== undefined) {
      (user as any)[key] = req.body[key];
    }
  }

  saveDatabase();

  res.json({
    success: true,
    message: 'تم تحديث بيانات وصلاحيات المستخدم والاشتراك بنجاح',
    user,
  });
});

// 26.4 DELETE /api/users/:id: Delete User Account
app.delete('/api/users/:id', (req, res) => {
  const index = users.findIndex((u) => u.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'المستخدم غير موجود' });
  }

  if (users[index].role === 'SUPER_ADMIN') {
    return res.status(400).json({ error: 'لا يمكن حذف حساب المدير العام للنظام (Super Admin)' });
  }

  const deletedUser = users.splice(index, 1)[0];
  saveDatabase();

  res.json({
    success: true,
    message: `تم حذف حساب المستخدم (${deletedUser.name}) بنجاح`,
  });
});

// -------------------------------------------------------------
// SaaS Super Admin Master Subscription & Tenant Management
// -------------------------------------------------------------

// 26.5 GET /api/superadmin/metrics: SaaS Business & Licensing KPIs
app.get('/api/superadmin/metrics', (req, res) => {
  const allTenants = users.filter((u) => u.role === 'ADMIN' || u.role === 'MERCHANT' || u.role === 'SUPER_ADMIN');
  const activeTenants = users.filter((u) => u.isActive && u.subscriptionStatus !== 'SUSPENDED');
  const suspendedTenants = users.filter((u) => !u.isActive || u.subscriptionStatus === 'SUSPENDED');
  
  const mrrTotal = users.reduce((sum, u) => {
    if (u.subscriptionStatus === 'ACTIVE' && u.subscriptionPrice) {
      return sum + (u.subscriptionBillingCycle === 'ANNUAL' ? u.subscriptionPrice / 12 : u.subscriptionPrice);
    }
    return sum;
  }, 0);

  const totalOrdersCount = orders.length;

  // Plan distribution
  const planDistribution: Record<string, number> = {
    ENTERPRISE: users.filter((u) => u.subscriptionPlan === 'ENTERPRISE').length,
    PROFESSIONAL: users.filter((u) => u.subscriptionPlan === 'PROFESSIONAL').length,
    GROWTH: users.filter((u) => u.subscriptionPlan === 'GROWTH').length,
    TRIAL: users.filter((u) => u.subscriptionPlan === 'TRIAL').length,
  };

  res.json({
    totalUsers: users.length,
    totalTenants: allTenants.length,
    activeTenantsCount: activeTenants.length,
    suspendedTenantsCount: suspendedTenants.length,
    mrrTotal: Math.round(mrrTotal),
    totalOrdersCount,
    planDistribution,
    serverTime: new Date().toISOString(),
  });
});

// 26.6 POST /api/superadmin/subscriptions/renew: Renew or Extend User Subscription
app.post('/api/superadmin/subscriptions/renew', (req, res) => {
  const { userId, daysToAdd = 30, newEndDate, planId, billingCycle = 'MONTHLY', price } = req.body;
  const user = users.find((u) => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: 'المستخدم غير موجود' });
  }

  let finalEndDate: string;
  if (newEndDate) {
    finalEndDate = new Date(newEndDate).toISOString();
  } else {
    const currentEnd = user.subscriptionEndDate ? new Date(user.subscriptionEndDate) : new Date();
    const baseDate = currentEnd > new Date() ? currentEnd : new Date();
    baseDate.setDate(baseDate.getDate() + Number(daysToAdd));
    finalEndDate = baseDate.toISOString();
  }

  user.subscriptionEndDate = finalEndDate;
  user.subscriptionStatus = 'ACTIVE';
  user.isActive = true;
  user.suspendedReason = undefined;

  if (planId) {
    user.subscriptionPlan = planId;
    if (planId === 'ENTERPRISE') {
      user.subscriptionPlanName = 'الباقة الماسية والمؤسسية (Enterprise)';
      user.maxMonthlyOrders = 0;
      user.maxUsers = 50;
    } else if (planId === 'PROFESSIONAL') {
      user.subscriptionPlanName = 'الباقة الذهبية للمحترفين (Gold Pro)';
      user.maxMonthlyOrders = 10000;
      user.maxUsers = 15;
    } else if (planId === 'GROWTH') {
      user.subscriptionPlanName = 'الباقة الفضية للنمو (Silver)';
      user.maxMonthlyOrders = 2500;
      user.maxUsers = 5;
    } else if (planId === 'TRIAL') {
      user.subscriptionPlanName = 'الاشتراك التجريبي المجاني (14 يوم)';
      user.maxMonthlyOrders = 100;
      user.maxUsers = 3;
    }
  }

  if (price !== undefined) {
    user.subscriptionPrice = Number(price);
  }
  if (billingCycle) {
    user.subscriptionBillingCycle = billingCycle;
  }

  saveDatabase();

  res.json({
    success: true,
    message: `تم تفعيل وتجديد اشتراك (${user.name}) بنجاح حتى تاريخ: ${finalEndDate.split('T')[0]}`,
    user,
  });
});

// 26.7 POST /api/superadmin/subscriptions/toggle-status: Suspend / Activate Account
app.post('/api/superadmin/subscriptions/toggle-status', (req, res) => {
  const { userId, status, reason } = req.body;
  const user = users.find((u) => u.id === userId);
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

  saveDatabase();

  res.json({
    success: true,
    message: isSuspending
      ? `تم تجميد وتعطيل حساب (${user.name}) بنجاح`
      : `تم فك التجميد وتفعيل حساب (${user.name}) بنجاح`,
    user,
  });
});

// 26.8 POST /api/superadmin/subscriptions/toggle-module: Toggle Module Permission
app.post('/api/superadmin/subscriptions/toggle-module', (req, res) => {
  const { userId, moduleKey, enabled } = req.body;
  const user = users.find((u) => u.id === userId);
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
  saveDatabase();

  res.json({
    success: true,
    message: `تم ${enabled ? 'تفعيل' : 'إيقاف'} نظام (${moduleKey}) لحساب (${user.name}) بنجاح`,
    user,
  });
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
app.get('/api/database/backup', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=dargo_backup_${Date.now()}.json`);
  res.json({
    system: 'DarGo TMS ERP',
    exportedAt: new Date().toISOString(),
    usersCount: users.length,
    ordersCount: orders.length,
    apiKeysCount: apiKeys.length,
    users,
    orders,
    apiKeys,
    notificationLogs,
    nextSequenceNumber,
  });
});

// 29. POST /api/database/restore: Full Database JSON Restore
app.post('/api/database/restore', (req, res) => {
  try {
    const { orders: newOrders, users: newUsers, apiKeys: newKeys } = req.body;
    if (Array.isArray(newOrders)) orders = newOrders;
    if (Array.isArray(newUsers)) users = newUsers;
    if (Array.isArray(newKeys)) apiKeys = newKeys;
    saveDatabase();
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
app.get('/api/accounting/overview', (req, res) => {
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
app.get('/api/accounting/journal-entries', (req, res) => {
  res.json({ entries: [...journalEntries].reverse() });
});

// POST /api/accounting/journal-entries
app.post('/api/accounting/journal-entries', (req, res) => {
  try {
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
      createdByName: createdByName || 'المدير المالي',
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
app.get('/api/accounting/vouchers', (req, res) => {
  res.json({ vouchers: [...vouchers].reverse() });
});

// POST /api/accounting/vouchers
app.post('/api/accounting/vouchers', (req, res) => {
  try {
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
      createdByName: 'نظام دارجو المحاسبي',
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
app.post('/api/accounting/accounts', (req, res) => {
  try {
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
// Merchant Warehouse & Inventory Management Endpoints
// =============================================================

// GET /api/merchants/:merchantId/warehouse
app.get('/api/merchants/:merchantId/warehouse', (req, res) => {
  const { merchantId } = req.params;
  const products = merchantProducts.filter((p) => p.merchantId === merchantId);
  const movements = stockMovements.filter((m) => m.merchantId === merchantId);

  const totalSkus = products.length;
  const totalQuantity = products.reduce((sum, p) => sum + (p.stockQuantity || 0), 0);
  const totalCostValue = products.reduce((sum, p) => sum + (p.costPrice || 0) * (p.stockQuantity || 0), 0);
  const totalRetailValue = products.reduce((sum, p) => sum + (p.sellingPrice || 0) * (p.stockQuantity || 0), 0);
  const potentialGrossProfit = totalRetailValue - totalCostValue;
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
      marginPercent: totalRetailValue > 0 ? (potentialGrossProfit / totalRetailValue) * 100 : 0,
      lowStockCount: lowStockProducts.length,
      lowStockProducts,
    },
  });
});

// =============================================================
// Merchant Categories Endpoints (Persistent Category Management)
// =============================================================

// GET /api/merchants/:merchantId/categories
app.get('/api/merchants/:merchantId/categories', (req, res) => {
  const { merchantId } = req.params;
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
app.post('/api/merchants/:merchantId/categories', (req, res) => {
  try {
    const { merchantId } = req.params;
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
app.delete('/api/merchants/:merchantId/categories/:categoryName', (req, res) => {
  try {
    const { merchantId, categoryName } = req.params;
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
    const { merchantId } = req.params;
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

app.post('/api/merchants/:merchantId/products', handleCreateMerchantProduct);
app.post('/api/merchants/:merchantId/warehouse/products', handleCreateMerchantProduct);

// PUT /api/merchants/:merchantId/products/:productId
app.put('/api/merchants/:merchantId/products/:productId', (req, res) => {
  const { merchantId, productId } = req.params;
  const prod = merchantProducts.find((p) => p.id === productId && p.merchantId === merchantId);
  if (!prod) return res.status(404).json({ error: 'الصنف غير موجود' });

  Object.assign(prod, req.body, { updatedAt: new Date().toISOString() });
  saveDatabase();
  res.json({ success: true, product: prod });
});

// DELETE /api/merchants/:merchantId/products/:productId
app.delete('/api/merchants/:merchantId/products/:productId', (req, res) => {
  const { merchantId, productId } = req.params;
  const index = merchantProducts.findIndex((p) => p.id === productId && p.merchantId === merchantId);
  if (index === -1) return res.status(404).json({ error: 'الصنف غير موجود' });

  merchantProducts.splice(index, 1);
  saveDatabase();
  res.json({ success: true, message: 'تم حذف الصنف بنجاح' });
});

// POST /api/merchants/:merchantId/stock-adjustments (and alias /warehouse/stock-adjustment)
const handleStockAdjustment = (req: any, res: any) => {
  try {
    const { merchantId } = req.params;
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

app.post('/api/merchants/:merchantId/stock-adjustments', handleStockAdjustment);
app.post('/api/merchants/:merchantId/warehouse/stock-adjustment', handleStockAdjustment);
app.post('/api/merchants/:merchantId/warehouse/stock-adjustments', handleStockAdjustment);

// =============================================================
// Merchant Invoices & Billing Endpoints
// =============================================================

// GET /api/merchants/:merchantId/invoices
app.get('/api/merchants/:merchantId/invoices', (req, res) => {
  const { merchantId } = req.params;
  const invoices = merchantInvoices.filter((i) => i.merchantId === merchantId);
  res.json({ invoices: [...invoices].reverse() });
});

// POST /api/merchants/:merchantId/invoices
app.post('/api/merchants/:merchantId/invoices', (req, res) => {
  try {
    const {
      merchantId,
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
  const { merchantId } = req.params;
  const invoices = merchantInvoices.filter((i) => i.merchantId === merchantId);
  const expenses = merchantExpenses.filter((e) => e.merchantId === merchantId);
  const merchantVouchersList = vouchers.filter((v) => v.notes.includes(merchantId) || v.beneficiaryOrPayer.includes('سحر الشرق'));
  const prods = merchantProducts.filter((p) => p.merchantId === merchantId);
  const movements = stockMovements.filter((m) => m.merchantId === merchantId);

  const salesInvoices = invoices.filter((i) => i.type === 'SALES');
  const purchaseInvoices = invoices.filter((i) => i.type === 'PURCHASE');
  const returnInvoices = invoices.filter((i) => i.type === 'RETURN');

  const totalSales = salesInvoices.reduce((sum, inv) => sum + (inv.subtotal || 0), 0);
  const totalReturns = returnInvoices.reduce((sum, inv) => sum + (inv.subtotal || 0), 0);
  const netSales = totalSales - totalReturns;

  let totalCogs = 0;
  salesInvoices.forEach((inv) => {
    inv.items.forEach((it) => {
      const p = prods.find((pr) => pr.id === it.productId || (it.barcode && pr.barcode === it.barcode));
      const cost = it.costPrice > 0 ? it.costPrice : (p?.costPrice || 0);
      totalCogs += cost * (it.quantity || 1);
    });
  });

  const grossProfit = netSales - totalCogs;
  const grossMarginPercent = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

  const totalShippingFees = salesInvoices.reduce((sum, inv) => sum + (inv.deliveryFee || 0), 0);
  const totalOperatingExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const netProfit = grossProfit - totalShippingFees - totalOperatingExpenses;

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
  const inventoryAssetValue = prods.reduce((sum, p) => sum + (p.costPrice || 0) * (p.stockQuantity || 0), 0);
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
    costOfGoodsSold: totalCogs,
    grossProfit,
    marginPercent: grossMarginPercent,
    deliveryFeesPaid: totalShippingFees,
    totalExpenses: totalOperatingExpenses,
    netProfit,
    netMarginPercent: netSales > 0 ? (netProfit / netSales) * 100 : 0,
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
      totalCogs,
      grossProfit,
      grossMarginPercent,
      totalShippingFees,
      totalOperatingExpenses,
      netProfit,
      netMarginPercent: netSales > 0 ? (netProfit / netSales) * 100 : 0,
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

app.get('/api/merchants/:merchantId/accounting', handleMerchantAccounting);
app.get('/api/merchants/:merchantId/accounting/summary', handleMerchantAccounting);

// GET /api/merchants/:merchantId/expenses
app.get('/api/merchants/:merchantId/expenses', (req, res) => {
  const { merchantId } = req.params;
  const expenses = merchantExpenses.filter((e) => e.merchantId === merchantId);
  res.json({ expenses: [...expenses].reverse() });
});

// POST /api/merchants/:merchantId/expenses
app.post('/api/merchants/:merchantId/expenses', (req, res) => {
  try {
    const { merchantId } = req.params;
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
app.delete('/api/merchants/:merchantId/expenses/:expenseId', (req, res) => {
  const { merchantId, expenseId } = req.params;
  const index = merchantExpenses.findIndex((e) => e.id === expenseId && e.merchantId === merchantId);
  if (index === -1) return res.status(404).json({ error: 'المصروف غير موجود' });

  merchantExpenses.splice(index, 1);
  saveDatabase();
  res.json({ success: true, message: 'تم حذف المصروف بنجاح' });
});

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
// Vite Middleware / Static Serving Setup
// -------------------------------------------------------------
async function startServer() {
  if (isServerlessEnv) {
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

// Only launch HTTP listener when running directly, not in Serverless / Vercel
if (!isServerlessEnv) {
  startServer();
}

export default app;
export { app };

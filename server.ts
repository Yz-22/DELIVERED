import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { Order, OrderStatus, User, ApiKey, NotificationLog, PricePlan } from './src/types/logistics';

const app = express();
const PORT = 3000;

app.use(express.json());

// Persistent File-Based Storage Path
const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'dargo_db.json');

// Auto-persist on any state mutation
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) && (!res.statusCode || res.statusCode < 400)) {
      setTimeout(saveDatabase, 50);
    }
    return originalJson(body);
  };
  next();
});

// In-Memory Realistic Logistics Database
let apiKeys: ApiKey[] = [
  {
    id: 'key-1',
    merchantId: 'u-mer-1',
    name: 'متجر سحر الشرق - شوبيفاي',
    key: 'dg_live_sh_9238479238',
    secret: 'sec_live_9f82348a0f98b',
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    lastUsedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    platform: 'SHOPIFY',
  },
  {
    id: 'key-2',
    merchantId: 'u-mer-2',
    name: 'تيك زون - ووكومرس',
    key: 'dg_live_wc_1092830192',
    secret: 'sec_live_4a1239c09d812',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    platform: 'WOOCOMMERCE',
  },
];

let notificationLogs: NotificationLog[] = [];
let users: User[] = [
  {
    id: 'u-admin-1',
    name: 'باسل البلبيسي',
    email: 'operations@dargo-tms.io',
    phone: '0795551234',
    role: 'ADMIN',
    roleName: 'صلاحية الإدارة العليا',
    priceList: 'جميع المملكة 2 (2.0 د.أ / 3.0 د.أ)',
    branch: 'فرع عمان الرئيسي',
    accountManager: 'باسل البلبيسي',
    city: 'عمان',
    isActive: true,
  },
  {
    id: 'u-op-1',
    name: 'أنس الرواشدة (مسؤول الفرز والمستودع)',
    email: 'anas@dargo-tms.io',
    phone: '0791112233',
    role: 'OPERATOR',
    roleName: 'صلاحية موظف العمليات والفرز',
    priceList: 'جميع المملكة 2',
    branch: 'فرع عمان الرئيسي',
    accountManager: 'باسل البلبيسي',
    city: 'عمان',
    isActive: true,
  },
  {
    id: 'u-mer-1',
    name: 'متجر سحر الشرق للأزياء',
    email: 'sahar@orient-fashion.com',
    phone: '0788123456',
    role: 'MERCHANT',
    roleName: 'صلاحية التاجر',
    commercialName: 'سحر الشرق فاشن',
    commercialType: 'ألبسة واكسسوارات',
    pricePlanId: 'pp-mer-std',
    priceList: 'جميع المملكة 2 (القياسية)',
    branch: 'فرع عمان الرئيسي',
    accountManager: 'باسل البلبيسي',
    city: 'عمان',
    address: 'الصويفية، شارع الوكالات',
    isActive: true,
  },
  {
    id: 'u-mer-2',
    name: 'تيك زون للإلكترونيات',
    email: 'sales@techzone-jo.com',
    phone: '0799988776',
    role: 'MERCHANT',
    roleName: 'صلاحية التاجر',
    commercialName: 'تيك زون الأردن',
    commercialType: 'إلكترونيات وهواتف',
    pricePlanId: 'pp-mer-vip',
    priceList: 'عمان الكبرى VIP (كبار العملاء)',
    branch: 'فرع عمان الرئيسي',
    accountManager: 'باسل البلبيسي',
    city: 'عمان',
    address: 'الجبيهة، شارع الجامعة',
    isActive: true,
  },
  {
    id: 'u-mer-3',
    name: 'عطور دار الفخامة',
    email: 'luxury@fakhamaperfumes.jo',
    phone: '0777441122',
    role: 'MERCHANT',
    commercialName: 'دار الفخامة للعطور',
    commercialType: 'عطور ومستحضرات تجميل',
    pricePlanId: 'pp-mer-flat',
    priceList: 'تسعيرة المتاجر الناشئة (سعر مخفض)',
    city: 'الزرقاء',
    address: 'الزرقاء الجديدة، شارع 36',
    isActive: true,
  },
  {
    id: 'u-mer-4',
    name: 'مكتبة ومستلزمات القلم الذهبي',
    email: 'qalam@goldenpen.com',
    phone: '0785112233',
    role: 'MERCHANT',
    commercialName: 'القلم الذهبي',
    commercialType: 'قرطاسية وهدايا',
    pricePlanId: 'pp-mer-std',
    priceList: 'جميع المملكة 2 (القياسية)',
    city: 'إربد',
    address: 'إربد، شارع الجامعة',
    isActive: true,
  },
  {
    id: 'u-drv-1',
    name: 'محمد الزعبي (كابتن عمان الغربية)',
    email: 'm.zoubi@dargo-driver.com',
    phone: '0791234567',
    role: 'DRIVER',
    city: 'عمان',
    pricePlanId: 'pp-drv-std',
    priceList: 'تسعيرة عمولة كباتن العاصمة والوسط',
    vehicleType: 'سيارة تويوتا بريوس',
    vehiclePlate: '12-98432',
    isActive: true,
  },
  {
    id: 'u-drv-2',
    name: 'أحمد الكردي (كابتن عمان الشرقية)',
    email: 'a.kurdi@dargo-driver.com',
    phone: '0786543210',
    role: 'DRIVER',
    city: 'عمان',
    pricePlanId: 'pp-drv-express',
    priceList: 'تسعيرة كباتن التوصيل السريع VIP',
    vehicleType: 'هيونداي أفانتي',
    vehiclePlate: '44-11890',
    isActive: true,
  },
  {
    id: 'u-drv-3',
    name: 'عمر الخلايلة (كابتن الزرقاء والرصيفة)',
    email: 'o.khalayleh@dargo-driver.com',
    phone: '0775556677',
    role: 'DRIVER',
    city: 'الزرقاء',
    pricePlanId: 'pp-drv-std',
    priceList: 'تسعيرة عمولة كباتن العاصمة والوسط',
    vehicleType: 'كيا سيفيا',
    vehiclePlate: '31-40291',
    isActive: true,
  },
  {
    id: 'u-drv-4',
    name: 'حمزة البطاينة (كابتن إربد والشمال)',
    email: 'h.batayneh@dargo-driver.com',
    phone: '0798765432',
    role: 'DRIVER',
    city: 'إربد',
    pricePlanId: 'pp-drv-outskirts',
    priceList: 'تسعيرة خطوط المحافظات البعيدة والأطراف',
    vehicleType: 'ميتسوبيشي لانسر',
    vehiclePlate: '18-55209',
    isActive: true,
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

let orders: Order[] = [
  {
    id: 'ord-101',
    sequence: 'ORD-2026-1001',
    referenceNumber: 'REF-7801',
    status: 'OUT_FOR_DELIVERY',
    paymentType: 'COD',
    merchantId: 'u-mer-1',
    driverId: 'u-drv-1',
    recipientName: 'رانية القاسم',
    recipientPhone: '0796112233',
    governorate: 'عمان',
    area: 'خلدا',
    subArea: 'قرب إشارات البنك العربي',
    fullAddress: 'عمان، خلدا، شارع وصفي التل، بناية 42، الطابق 2',
    merchantCollection: 35.0,
    deliveryFee: 3.0,
    totalCollection: 38.0,
    isSettledWithMerchant: false,
    isSettledWithDriver: false,
    packageType: 'ملابس نسائية',
    piecesCount: 2,
    deliveryAttempts: 1,
    notes: 'التسليم بعد الساعة 4 عصراً، يرجى الرن قبل الوصول',
    createdAt: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    statusLogs: [
      {
        id: 'log-1',
        orderId: 'ord-101',
        fromStatus: null,
        toStatus: 'PENDING',
        note: 'تم إنشاء الطلبية بنجاح عبر النظام',
        createdAt: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
      },
      {
        id: 'log-2',
        orderId: 'ord-101',
        fromStatus: 'PENDING',
        toStatus: 'OUT_FOR_DELIVERY',
        note: 'تم تعيين الكابتن محمد الزعبي وخروج الشحنة للتوصيل',
        createdAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
      },
    ],
  },
  {
    id: 'ord-102',
    sequence: 'ORD-2026-1002',
    referenceNumber: 'REF-7802',
    status: 'DELIVERED',
    paymentType: 'COD',
    merchantId: 'u-mer-2',
    driverId: 'u-drv-1',
    recipientName: 'سامي عبد الرحمن',
    recipientPhone: '0789004455',
    governorate: 'عمان',
    area: 'عبدون',
    subArea: 'قرب السفارة البريطانية',
    fullAddress: 'عمان، عبدون الشمالي، فيلا رقم 14',
    merchantCollection: 120.0,
    deliveryFee: 3.0,
    totalCollection: 123.0,
    isSettledWithMerchant: true,
    isSettledWithDriver: true,
    packageType: 'سماعات بلوتوث + شاحن',
    piecesCount: 1,
    deliveryAttempts: 1,
    notes: 'الدفع كاش كامل مع الفكة',
    deliveredAt: new Date(Date.now() - 3600 * 1000 * 1).toISOString(),
    createdAt: new Date(Date.now() - 3600 * 1000 * 8).toISOString(),
    updatedAt: new Date(Date.now() - 3600 * 1000 * 1).toISOString(),
    statusLogs: [
      {
        id: 'log-3',
        orderId: 'ord-102',
        fromStatus: 'OUT_FOR_DELIVERY',
        toStatus: 'DELIVERED',
        note: 'تم تسليم الطرد للمستلم واستلام كامل المبلغ 123 د.أ',
        createdAt: new Date(Date.now() - 3600 * 1000 * 1).toISOString(),
      },
    ],
  },
  {
    id: 'ord-103',
    sequence: 'ORD-2026-1003',
    referenceNumber: 'REF-7803',
    status: 'PENDING',
    paymentType: 'COD',
    merchantId: 'u-mer-3',
    driverId: null,
    recipientName: 'منى الحداد',
    recipientPhone: '0778899001',
    governorate: 'الزرقاء',
    area: 'الزرقاء الجديدة',
    subArea: 'شارع مكة، حي البتراوي',
    fullAddress: 'الزرقاء، الزرقاء الجديدة، عمارة الأمل، طابق 3',
    merchantCollection: 45.0,
    deliveryFee: 2.5,
    totalCollection: 47.5,
    isSettledWithMerchant: false,
    isSettledWithDriver: false,
    packageType: 'عطر فرنسي فاخر',
    piecesCount: 1,
    deliveryAttempts: 0,
    notes: 'بانتظار تعيين مندوب لاستلام الشحنة من المتجر',
    createdAt: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
    statusLogs: [
      {
        id: 'log-4',
        orderId: 'ord-103',
        fromStatus: null,
        toStatus: 'PENDING',
        note: 'بوليصة مسجلة من لوحة تحكم التاجر',
        createdAt: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
      },
    ],
  },
  {
    id: 'ord-104',
    sequence: 'ORD-2026-1004',
    referenceNumber: 'REF-7804',
    status: 'PICKING',
    paymentType: 'COD',
    merchantId: 'u-mer-4',
    driverId: 'u-drv-4',
    recipientName: 'إبراهيم غنيم',
    recipientPhone: '0795432198',
    governorate: 'إربد',
    area: 'الحي الشرقي',
    subArea: 'قرب مجمع عمان القديم',
    fullAddress: 'إربد، الحي الشرقي، شارع القدس، منزل 19',
    merchantCollection: 22.0,
    deliveryFee: 2.5,
    totalCollection: 24.5,
    isSettledWithMerchant: false,
    isSettledWithDriver: false,
    packageType: 'مجموعة دفاتر وروايات',
    piecesCount: 3,
    deliveryAttempts: 0,
    notes: 'المندوب متوجه للمستودع لاستلام الشحنة',
    createdAt: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    statusLogs: [],
  },
  {
    id: 'ord-105',
    sequence: 'ORD-2026-1005',
    referenceNumber: 'REF-7805',
    status: 'POSTPONED',
    paymentType: 'COD',
    merchantId: 'u-mer-1',
    driverId: 'u-drv-2',
    recipientName: 'هبة العجلوني',
    recipientPhone: '0780123987',
    governorate: 'عمان',
    area: 'طبربور',
    subArea: 'قرب مجمع مشاغل الأمن العام',
    fullAddress: 'عمان، طبربور، إسكان المعلمين، عمارة 8',
    merchantCollection: 55.0,
    deliveryFee: 3.0,
    totalCollection: 58.0,
    isSettledWithMerchant: false,
    isSettledWithDriver: false,
    packageType: 'فستان مناسبات',
    piecesCount: 1,
    deliveryAttempts: 1,
    notes: 'العميل خارج المنزل، طلب التأجيل للغد صباحاً',
    cancellationReason: 'تأجيل بناء على طلب المستلم (خارج المحافظة حالياً)',
    createdAt: new Date(Date.now() - 3600 * 1000 * 14).toISOString(),
    updatedAt: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
    statusLogs: [],
  },
  {
    id: 'ord-106',
    sequence: 'ORD-2026-1006',
    referenceNumber: 'REF-7806',
    status: 'CANCELLED',
    paymentType: 'COD',
    merchantId: 'u-mer-2',
    driverId: 'u-drv-2',
    recipientName: 'خالد مبيضين',
    recipientPhone: '0776541230',
    governorate: 'عمان',
    area: 'ضاحية الياسمين',
    subArea: 'قرب دوار الياسمين',
    fullAddress: 'عمان، ضاحية الياسمين، شارع بطحاء قريش، شقة 5',
    merchantCollection: 18.0,
    deliveryFee: 3.0,
    totalCollection: 21.0,
    isSettledWithMerchant: false,
    isSettledWithDriver: false,
    packageType: 'كابلات وشاحن سيارة',
    piecesCount: 1,
    deliveryAttempts: 2,
    notes: 'العميل رفض الاستلام لعدم توفر المبلغ',
    cancellationReason: 'رفض الاستلام من قبل العميل',
    createdAt: new Date(Date.now() - 3600 * 1000 * 18).toISOString(),
    updatedAt: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
    statusLogs: [],
  },
  {
    id: 'ord-107',
    sequence: 'ORD-2026-1007',
    referenceNumber: 'REF-7807',
    status: 'OUT_FOR_DELIVERY',
    paymentType: 'COD',
    merchantId: 'u-mer-3',
    driverId: 'u-drv-3',
    recipientName: 'سوسن التميمي',
    recipientPhone: '0799881122',
    governorate: 'الزرقاء',
    area: 'الرصيفة',
    subArea: 'حي الرشيد',
    fullAddress: 'الرصيفة، حي الرشيد، بجانب صيدلية الشفاء',
    merchantCollection: 70.0,
    deliveryFee: 2.5,
    totalCollection: 72.5,
    isSettledWithMerchant: false,
    isSettledWithDriver: false,
    packageType: 'باكج بخور ودهن عود',
    piecesCount: 2,
    deliveryAttempts: 1,
    notes: 'يرجى تسليم الطرد للوالدة في حال عدم التواجد',
    createdAt: new Date(Date.now() - 3600 * 1000 * 6).toISOString(),
    updatedAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    statusLogs: [],
  },
  {
    id: 'ord-108',
    sequence: 'ORD-2026-1008',
    referenceNumber: 'REF-7808',
    status: 'DELIVERED',
    paymentType: 'COD',
    merchantId: 'u-mer-1',
    driverId: 'u-drv-1',
    recipientName: 'علاء النجار',
    recipientPhone: '0785544332',
    governorate: 'عمان',
    area: 'الصويفية',
    subArea: 'قرب مجمع البركة مول',
    fullAddress: 'عمان، الصويفية، شارع باريس، عمارة 12',
    merchantCollection: 60.0,
    deliveryFee: 3.0,
    totalCollection: 63.0,
    isSettledWithMerchant: false,
    isSettledWithDriver: true,
    packageType: 'قميص وبنطال جينز',
    piecesCount: 2,
    deliveryAttempts: 1,
    notes: 'تم الدفع كاش بنجاح',
    deliveredAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    createdAt: new Date(Date.now() - 3600 * 1000 * 10).toISOString(),
    updatedAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    statusLogs: [],
  },
  {
    id: 'ord-109',
    sequence: 'ORD-2026-1009',
    referenceNumber: 'REF-7809',
    status: 'PENDING',
    paymentType: 'COD',
    merchantId: 'u-mer-2',
    driverId: null,
    recipientName: 'نور الدين منصور',
    recipientPhone: '0793210987',
    governorate: 'عمان',
    area: 'مرج الحمام',
    subArea: 'دوار الباشا',
    fullAddress: 'عمان، مرج الحمام، إسكان الضباط، فيلا 7',
    merchantCollection: 88.0,
    deliveryFee: 3.0,
    totalCollection: 91.0,
    isSettledWithMerchant: false,
    isSettledWithDriver: false,
    packageType: 'ماوس وكيبورد ميكانيكي',
    piecesCount: 2,
    deliveryAttempts: 0,
    notes: 'الطلب بحاجة لمندوب استلام سريع',
    createdAt: new Date(Date.now() - 3600 * 1000 * 1).toISOString(),
    updatedAt: new Date(Date.now() - 3600 * 1000 * 1).toISOString(),
    statusLogs: [],
  },
];

let nextSequenceNumber = 1010;

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
      savedAt: new Date().toISOString(),
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save to dargo_db.json:', err);
  }
}

function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.orders) && data.orders.length > 0) orders = data.orders;
      if (Array.isArray(data.users) && data.users.length > 0) users = data.users;
      if (Array.isArray(data.pricePlans) && data.pricePlans.length > 0) pricePlans = data.pricePlans;
      if (Array.isArray(data.apiKeys) && data.apiKeys.length > 0) apiKeys = data.apiKeys;
      if (Array.isArray(data.notificationLogs)) notificationLogs = data.notificationLogs;
      if (typeof data.nextSequenceNumber === 'number') nextSequenceNumber = data.nextSequenceNumber;

      // Ensure every merchant and driver has a pricePlanId
      users.forEach((u) => {
        if (!u.pricePlanId) {
          const match = pricePlans.find((p) => p.name === u.priceList);
          if (match) {
            u.pricePlanId = match.id;
          } else if (u.role === 'MERCHANT') {
            u.pricePlanId = 'pp-mer-std';
            u.priceList = u.priceList || 'جميع المملكة 2 (القياسية)';
          } else if (u.role === 'DRIVER') {
            u.pricePlanId = 'pp-drv-std';
            u.priceList = u.priceList || 'تسعيرة عمولة كباتن العاصمة والوسط';
          }
        }
      });

      console.log(`[DarGo DB] Loaded ${orders.length} orders, ${users.length} users, and ${pricePlans.length} price plans from persistent storage.`);
    } else {
      saveDatabase();
    }
  } catch (err) {
    console.error('Failed to read dargo_db.json, using seeded defaults:', err);
  }
}

// Initialize and ensure OTPs
loadDatabase();
orders.forEach((o, idx) => {
  if (!o.deliveryOtp) {
    o.deliveryOtp = (4100 + idx).toString();
  }
});
saveDatabase();

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

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

  let count = 0;
  let settledAmount = 0;

  orders = orders.map((o) => {
    if (o.merchantId === merchantId && o.status === 'DELIVERED' && !o.isSettledWithMerchant) {
      count++;
      settledAmount += (o.merchantCollection || 0) - (o.deliveryFee || 0);
      return {
        ...o,
        isSettledWithMerchant: true,
        updatedAt: new Date().toISOString(),
      };
    }
    return o;
  });

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

// 26. POST /api/auth/login: User Authentication & Role Switching
app.post('/api/auth/login', (req, res) => {
  const { userId, email, phone, role } = req.body;
  let user = null;
  if (userId) {
    user = users.find((u) => u.id === userId);
  } else if (email) {
    user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  } else if (phone) {
    user = users.find((u) => u.phone === phone);
  } else if (role) {
    user = users.find((u) => u.role === role);
  }

  if (!user) {
    return res.status(401).json({ error: 'بيانات الحساب أو المستخدم غير موجودة' });
  }

  res.json({
    success: true,
    user,
    token: `dargo_jwt_${user.id}_${Date.now()}`,
    message: `مرحباً بك يا ${user.name}`,
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

// -------------------------------------------------------------
// Vite Middleware / Static Serving Setup
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
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

startServer();

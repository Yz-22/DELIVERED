import React, { useState } from 'react';
import { X, Copy, Check, Database, Server, Code, Layers } from 'lucide-react';

interface SchemaAndApiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SchemaAndApiModal: React.FC<SchemaAndApiModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'prisma' | 'api' | 'architecture'>('prisma');
  const [copied, setCopied] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const PRISMA_CODE = `// prisma/schema.prisma
// قاعدة بيانات PostgreSQL عبر Prisma ORM

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN     // مدير النظام
  OPERATOR  // موظف عمليات
  MERCHANT  // التاجر / المتجر
  DRIVER    // المندوب / السائق
}

enum OrderStatus {
  PENDING           // بالانتظار
  PICKING           // جاري الاستلام من التاجر
  RECEIVED_AT_HUB   // في المستودع الرئيسي
  OUT_FOR_DELIVERY  // جاري التوصيل
  POSTPONED         // مؤجل
  CANCELLED         // ملغي
  DELIVERED         // تم التسليم بنجاح
  RETURNED          // مرتجع للمتجر
}

enum PaymentType {
  COD     // الدفع عند الاستلام
  CLIQ    // تحويل كليك فوري
  PREPAID // مدفوع مسبقاً
}

model User {
  id              String       @id @default(uuid())
  name            String
  email           String       @unique
  phone           String       @unique
  password        String
  role            Role         @default(MERCHANT)
  commercialName  String?
  commercialType  String?
  city            String?
  address         String?
  vehicleType     String?
  vehiclePlate    String?
  bankName        String?
  bankIban        String?
  cliqAlias       String?
  isActive        Boolean      @default(true)
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  merchantOrders  Order[]      @relation("MerchantOrders")
  driverOrders    Order[]      @relation("DriverOrders")
  auditLogs       AuditLog[]

  @@map("users")
}

model Order {
  id                    String        @id @default(uuid())
  sequence              String        @unique // ORD-2026-XXXX
  referenceNumber       String?       // REF-XXXX
  status                OrderStatus   @default(PENDING)
  paymentType           PaymentType   @default(COD)

  merchantId            String
  merchant              User          @relation("MerchantOrders", fields: [merchantId], references: [id])
  
  driverId              String?
  driver                User?         @relation("DriverOrders", fields: [driverId], references: [id])

  recipientName         String
  recipientPhone        String
  recipientPhoneAlt     String?
  governorate           String
  area                  String
  subArea               String?
  fullAddress           String

  merchantCollection    Decimal       @default(0.0) @db.Decimal(10, 2)
  deliveryFee           Decimal       @default(0.0) @db.Decimal(10, 2)
  totalCollection       Decimal       @default(0.0) @db.Decimal(10, 2)
  isSettledWithMerchant Boolean       @default(false)
  isSettledWithDriver   Boolean       @default(false)

  packageType           String?       @default("طرد عادي")
  piecesCount           Int           @default(1)
  deliveryAttempts      Int           @default(0)
  notes                 String?

  deliveredAt           DateTime?
  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt

  statusLogs            OrderStatusLog[]

  @@map("orders")
}

model OrderStatusLog {
  id          String       @id @default(uuid())
  orderId     String
  order       Order        @relation(fields: [orderId], references: [id], onDelete: Cascade)
  fromStatus  OrderStatus?
  toStatus    OrderStatus
  note        String?
  createdAt   DateTime     @default(now())

  @@map("order_status_logs")
}`;

  const API_CODE = `// server.ts (Express.js REST APIs with Prisma/Database)
import express from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = express.Router();

// 1. جلب الطلبيات مع الترقيم (Pagination) والفلترة والبحث
router.get('/api/orders', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 10);
    const search = (req.query.search as string || '').trim();
    const status = req.query.status as string;
    const governorate = req.query.governorate as string;
    const driverId = req.query.driverId as string;

    const where: any = {};

    if (search) {
      where.OR = [
        { sequence: { contains: search, mode: 'insensitive' } },
        { referenceNumber: { contains: search, mode: 'insensitive' } },
        { recipientPhone: { contains: search } },
        { recipientName: { contains: search, mode: 'insensitive' } },
        { area: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status && status !== 'ALL') where.status = status;
    if (governorate && governorate !== 'ALL') where.governorate = governorate;
    if (driverId === 'UNASSIGNED') where.driverId = null;
    else if (driverId && driverId !== 'ALL') where.driverId = driverId;

    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          merchant: { select: { id: true, name: true, commercialName: true, phone: true } },
          driver: { select: { id: true, name: true, phone: true, vehicleType: true } },
        },
      }),
    ]);

    res.json({
      orders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. إنشاء طلبية جديدة مع رقم تسلسلي فريد
router.post('/api/orders', async (req, res) => {
  try {
    const data = req.body;
    const count = await prisma.order.count();
    const sequence = \`ORD-2026-\${1000 + count + 1}\`;

    const newOrder = await prisma.order.create({
      data: {
        sequence,
        referenceNumber: data.referenceNumber,
        merchantId: data.merchantId,
        driverId: data.driverId || null,
        recipientName: data.recipientName,
        recipientPhone: data.recipientPhone,
        governorate: data.governorate,
        area: data.area,
        fullAddress: data.fullAddress,
        merchantCollection: data.merchantCollection,
        deliveryFee: data.deliveryFee,
        totalCollection: data.totalCollection,
        status: data.driverId ? 'OUT_FOR_DELIVERY' : 'PENDING',
        notes: data.notes,
      },
      include: { merchant: true, driver: true },
    });

    res.status(201).json(newOrder);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. تحديث حالة الطلبية وتعيين السائق
router.patch('/api/orders/:id/status', async (req, res) => {
  const { status, note } = req.body;
  const updated = await prisma.order.update({
    where: { id: req.params.id },
    data: {
      status,
      deliveredAt: status === 'DELIVERED' ? new Date() : undefined,
    },
  });
  res.json(updated);
});`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
              <Code className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">
                كود Prisma Schema ومسارات الـ Backend (Node/Express)
              </h3>
              <p className="text-xs text-slate-400">
                الأكواد البرمجية الجاهزة للمشروع وقاعدة البيانات PostgreSQL
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="bg-slate-800 px-6 pt-2 flex items-center gap-2 border-b border-slate-700">
          <button
            onClick={() => setActiveTab('prisma')}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'prisma'
                ? 'bg-slate-900 text-amber-400 border-t-2 border-amber-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>1. Prisma Schema (PostgreSQL)</span>
          </button>
          <button
            onClick={() => setActiveTab('api')}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'api'
                ? 'bg-slate-900 text-amber-400 border-t-2 border-amber-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>2. Backend Express API</span>
          </button>
          <button
            onClick={() => setActiveTab('architecture')}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'architecture'
                ? 'bg-slate-900 text-amber-400 border-t-2 border-amber-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>3. هيكل مجلدات المشروع</span>
          </button>
        </div>

        {/* Code Content Area */}
        <div className="p-6 max-h-[65vh] overflow-y-auto bg-slate-900 text-slate-100 font-mono text-xs">
          {activeTab === 'prisma' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-sans text-xs">
                  ملف قاعدة البيانات: <code className="text-amber-400">prisma/schema.prisma</code>
                </span>
                <button
                  onClick={() => copyToClipboard(PRISMA_CODE, 'prisma')}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded text-xs flex items-center gap-1 font-sans"
                >
                  {copied === 'prisma' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied === 'prisma' ? 'تم النسخ!' : 'نسخ الكود'}</span>
                </button>
              </div>
              <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-x-auto text-[11px] leading-relaxed text-slate-200" dir="ltr">
                {PRISMA_CODE}
              </pre>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-sans text-xs">
                  مسارات Express: <code className="text-amber-400">server/routes/orders.ts</code>
                </span>
                <button
                  onClick={() => copyToClipboard(API_CODE, 'api')}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded text-xs flex items-center gap-1 font-sans"
                >
                  {copied === 'api' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied === 'api' ? 'تم النسخ!' : 'نسخ الكود'}</span>
                </button>
              </div>
              <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-x-auto text-[11px] leading-relaxed text-slate-200" dir="ltr">
                {API_CODE}
              </pre>
            </div>
          )}

          {activeTab === 'architecture' && (
            <div className="space-y-4 font-sans text-slate-200">
              <h4 className="text-sm font-bold text-amber-400">هيكل المجلدات الموصى به للمشروع:</h4>
              <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-emerald-300 leading-normal" dir="ltr">
{`my-logistics-tms/
├── prisma/
│   └── schema.prisma         # Schema قاعدة البيانات PostgreSQL
├── server.ts                 # سيرفر Express مع مسارات API والربط مع Vite
├── src/
│   ├── components/
│   │   ├── TopNavbar.tsx           # شريط التنقل العلوي وهوية النظام
│   │   ├── OperationsHeader.tsx    # أزرار الإجراءات (إنشاء، سريعة، دفعة)
│   │   ├── ToolbarFilter.tsx       # شريط البحث، الفلاتر، وتجميع حسب
│   │   ├── OrdersDataGrid.tsx      # جدول البيانات مع Checkbox وواتساب
│   │   ├── KanbanBoard.tsx         # لوحة كانبان للأعمدة والحالات
│   │   ├── CreateOrderModal.tsx    # نافذة إنشاء بوليصة كاملة
│   │   ├── QuickOrderModal.tsx     # نافذة الطلبية السريعة
│   │   ├── BatchImportModal.tsx    # استيراد وإضافة دفعة طرود
│   │   ├── OrderDetailsDrawer.tsx  # درج تفاصيل الطلبية وسجل التتبع
│   │   └── ThermalWaybillModal.tsx # معاينة وطباعة البوليصة الحرارية
│   ├── types/
│   │   └── logistics.ts            # واجهات وبيانات الـ Typescript
│   ├── utils/
│   │   └── logisticsHelpers.ts     # تحويل أرقام الواتساب ورسائل التتبع
│   ├── App.tsx                     # إدارة الحالة الرئيسية والطلبات
│   └── main.tsx
└── package.json`}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>
    </div>
  );
};

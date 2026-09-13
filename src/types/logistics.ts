export type Role = 'ADMIN' | 'OPERATOR' | 'MERCHANT' | 'DRIVER';

export type OrderStatus =
  | 'PENDING'          // بالانتظار
  | 'PICKING'          // جاري الاستلام
  | 'RECEIVED_AT_HUB'  // بالمستودع
  | 'OUT_FOR_DELIVERY' // جاري التوصيل
  | 'POSTPONED'        // مؤجل
  | 'CANCELLED'        // ملغي
  | 'DELIVERED'        // تم التسليم
  | 'RETURNED';        // مرتجع

export type PaymentType = 'COD' | 'CLIQ' | 'PREPAID';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  roleName?: string;
  commercialName?: string;
  commercialType?: string;
  city?: string;
  address?: string;
  vehicleType?: string;
  vehiclePlate?: string;
  priceList?: string;
  previousPriceList?: string;
  branch?: string;
  accountManager?: string;
  isActive: boolean;
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
  totalCollection: number;     // دينار

  isSettledWithMerchant: boolean;
  isSettledWithDriver: boolean;

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

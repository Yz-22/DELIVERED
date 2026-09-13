import { OrderStatus } from '../types/logistics';

export const GOVERNORATES = [
  'عمان',
  'إربد',
  'الزرقاء',
  'العقبة',
  'السلط (البلقاء)',
  'مادبا',
  'جرش',
  'عجلون',
  'المفرق',
  'الكرك',
  'الطفيلة',
  'معان',
];

export const JORDAN_AREAS_MAP: Record<string, string[]> = {
  'عمان': [
    'خلدا',
    'تلاع العلي',
    'الجبيهة',
    'ضاحية الرشيد',
    'صويلح',
    'أم أذينة',
    'الصويفية',
    'عبدون',
    'دير غبار',
    'الدوار السابع',
    'ضاحية الياسمين',
    'المقابلين',
    'طبربور',
    'ماركا',
    'الشميساني',
    'جبل عمان',
    'اللويبدة',
  ],
  'الزرقاء': ['الزرقاء الجديدة', 'الرصيفة', 'حي معصوم', 'الوسط التجاري', 'ياجوز'],
  'إربد': ['شارع الجامعة', 'الحصن', 'إيدون', 'الحي الشرقي', 'الحي الجنوبي'],
  'السلط (البلقاء)': ['السلط المركز', 'الفحيص', 'ماحص', 'عين الباشا', 'البقعة'],
  'مادبا': ['مادبا المركز', 'حنينا', 'ماعين', 'ذيبان'],
  'العقبة': ['العقبة المركز', 'التاسعة', 'المنطقة السكنية الثامنة', 'الشاطئ الجنوبي'],
  'جرش': ['جرش المركز', 'سوف', 'ساكب', 'برما'],
  'عجلون': ['عجلون المركز', 'عنجرة', 'كفرنجة', 'صخرة'],
  'المفرق': ['المفرق المركز', 'البلعما', 'الخالدية'],
  'الكرك': ['الكرك المركز', 'المزار الجنوبي', 'مؤتة', 'القصر', 'الأغوار الجنوبية'],
  'الطفيلة': ['الطفيلة المركز', 'العين البيضاء', 'بصيرا'],
  'معان': ['معان المركز', 'الشوبك', 'وادي موسى / البتراء'],
};

export const STANDARD_DELIVERY_FEES: Record<string, number> = {
  'عمان': 3.0,
  'الزرقاء': 3.0,
  'إربد': 4.0,
  'السلط (البلقاء)': 3.5,
  'مادبا': 3.5,
  'جرش': 4.0,
  'عجلون': 4.0,
  'المفرق': 4.0,
  'الكرك': 5.0,
  'الطفيلة': 5.0,
  'معان': 5.0,
  'العقبة': 5.0,
};

export const STATUS_CONFIG: Record<
  OrderStatus,
  {
    label: string;
    bg: string;
    text: string;
    border: string;
    badgeBg: string;
    iconName: string;
  }
> = {
  PENDING: {
    label: 'بالانتظار',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    badgeBg: 'bg-amber-100',
    iconName: 'Clock',
  },
  PICKING: {
    label: 'جاري الاستلام',
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
    badgeBg: 'bg-blue-100',
    iconName: 'PackageCheck',
  },
  RECEIVED_AT_HUB: {
    label: 'في المستودع',
    bg: 'bg-purple-50',
    text: 'text-purple-800',
    border: 'border-purple-200',
    badgeBg: 'bg-purple-100',
    iconName: 'Warehouse',
  },
  OUT_FOR_DELIVERY: {
    label: 'جاري التوصيل',
    bg: 'bg-indigo-50',
    text: 'text-indigo-800',
    border: 'border-indigo-200',
    badgeBg: 'bg-indigo-100',
    iconName: 'Truck',
  },
  POSTPONED: {
    label: 'مؤجل',
    bg: 'bg-orange-50',
    text: 'text-orange-800',
    border: 'border-orange-200',
    badgeBg: 'bg-orange-100',
    iconName: 'CalendarClock',
  },
  CANCELLED: {
    label: 'ملغي / راجع',
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200',
    badgeBg: 'bg-rose-100',
    iconName: 'XCircle',
  },
  DELIVERED: {
    label: 'تم التسليم',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    badgeBg: 'bg-emerald-100',
    iconName: 'CheckCircle2',
  },
  RETURNED: {
    label: 'مرتجع للمتجر',
    bg: 'bg-slate-100',
    text: 'text-slate-800',
    border: 'border-slate-300',
    badgeBg: 'bg-slate-200',
    iconName: 'RotateCcw',
  },
};

/**
 * Format Jordanian / Arab phone numbers into international format for WhatsApp wa.me link
 * Examples: '0796112233' -> '962796112233'
 */
export function formatWhatsAppUrl(phone: string, textMessage: string): string {
  if (!phone) return '#';
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('0')) {
    cleaned = '962' + cleaned.substring(1);
  } else if (!cleaned.startsWith('962') && cleaned.length === 9) {
    cleaned = '962' + cleaned;
  }
  const encodedText = encodeURIComponent(textMessage);
  return `https://wa.me/${cleaned}?text=${encodedText}`;
}

export function buildRecipientWhatsAppMessage(
  recipientName: string,
  sequence: string,
  totalCollection: number,
  area: string
): string {
  return `مرحباً ${recipientName}،\nمعكم شركة التوصيل بخصوص طردكم رقم (${sequence}).\nالمبلغ المطلوب للتحصيل: ${totalCollection.toFixed(2)} د.أ\nالعنوان المسجل: ${area}.\nهل الوقت مناسب لاستلام الطلبية اليوم؟`;
}

export function buildMerchantWhatsAppMessage(
  merchantName: string,
  sequence: string,
  status: string
): string {
  return `مرحباً ${merchantName}،\nتحديث من قسم العمليات بخصوص الشحنة رقم (${sequence}):\nالحالة الحالية: ${status}.`;
}

export function formatCurrency(amount: number): string {
  return `${amount.toFixed(2)} د.أ`;
}

export function formatDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('ar-JO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return dateString;
  }
}

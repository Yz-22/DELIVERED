import React from 'react';
import {
  X,
  Package,
  Printer,
  Phone,
  MessageCircle,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Truck,
  UserCheck,
  FileText,
  DollarSign,
  Calendar,
  Building2,
  ShieldCheck
} from 'lucide-react';
import { Order } from '../../types/logistics';

interface MerchantOrderDetailDrawerProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenWaybill: (order: Order) => void;
  onTrackOrder?: (order: Order) => void;
}

export const MerchantOrderDetailDrawer: React.FC<MerchantOrderDetailDrawerProps> = ({
  order,
  isOpen,
  onClose,
  onOpenWaybill,
  onTrackOrder,
}) => {
  if (!isOpen || !order) return null;

  // Format Jordan phone number for WhatsApp link
  const cleanPhone = (order.recipientPhone || '').replace(/\D/g, '');
  const formattedWaPhone = cleanPhone.startsWith('0')
    ? '962' + cleanPhone.substring(1)
    : cleanPhone.startsWith('962')
    ? cleanPhone
    : '962' + cleanPhone;

  // Operational status localized labels & colors
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return {
          label: 'تم التسليم بنجاح',
          bg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          icon: CheckCircle2,
        };
      case 'OUT_FOR_DELIVERY':
        return {
          label: 'جاري التوصيل مع الكابتن',
          bg: 'bg-amber-100 text-amber-900 border-amber-300',
          icon: Truck,
        };
      case 'RETURNED':
        return {
          label: 'شحنة مرتجعة',
          bg: 'bg-rose-100 text-rose-800 border-rose-300',
          icon: RotateCcw,
        };
      case 'FAILED':
        return {
          label: 'تعذر التسليم / محاولة فاشلة',
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          icon: AlertCircle,
        };
      case 'POSTPONED':
        return {
          label: 'مؤجل بطلب الزبون',
          bg: 'bg-slate-100 text-slate-800 border-slate-300',
          icon: Clock,
        };
      case 'PENDING':
      default:
        return {
          label: 'جاهز بالمركز / بانتظار الحركة',
          bg: 'bg-blue-50 text-blue-800 border-blue-200',
          icon: Package,
        };
    }
  };

  const statusInfo = getStatusBadge(order.status);
  const StatusIcon = statusInfo.icon;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-xs flex justify-end transition-opacity">
      <div
        className="relative w-full max-w-lg bg-white h-full shadow-2xl border-r border-slate-200 flex flex-col overflow-y-auto animate-in slide-in-from-left duration-200"
        dir="rtl"
      >
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white sticky top-0 z-10 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-base text-amber-400 tracking-wide">
                  {order.sequence}
                </span>
                <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-md text-slate-300 border border-slate-700">
                  {order.packageType || 'طرد اعتيادي'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                تاريخ الإنشاء: {order.createdAt ? new Date(order.createdAt).toLocaleDateString('ar-JO') : 'اليوم'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="إغلاق التفاصيل"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-6 space-y-5 flex-1">
          {/* Operational Status Card */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between ${statusInfo.bg}`}>
            <div className="flex items-center gap-2.5">
              <StatusIcon className="w-5 h-5 shrink-0" />
              <div>
                <div className="text-xs font-black">{statusInfo.label}</div>
                <div className="text-[11px] opacity-80 mt-0.5">
                  كود الحالة التشغيلية: <span className="font-mono">{order.status}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => onOpenWaybill(order)}
              className="px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              <span>طباعة بوليصة</span>
            </button>
          </div>

          {/* Recipient Contact Card */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
              <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-amber-500" />
                <span>بيانات الزبون وعنوان التسليم</span>
              </span>
              <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                {order.governorate}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="text-sm font-black text-slate-900">{order.recipientName}</div>
              <div className="text-xs text-slate-600 font-semibold leading-relaxed">
                {order.governorate} - {order.area} {order.fullAddress ? `| ${order.fullAddress}` : ''}
              </div>
            </div>

            {/* Direct Contact Actions */}
            <div className="pt-2 flex items-center gap-2">
              <a
                href={`tel:${order.recipientPhone}`}
                className="flex-1 py-2 px-3 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-blue-600" />
                <span className="font-mono">{order.recipientPhone}</span>
              </a>

              <a
                href={`https://wa.me/${formattedWaPhone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>واتساب</span>
              </a>
            </div>
          </div>

          {/* Financial Collection Breakdown */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl p-4 border border-slate-800 space-y-3 shadow-md">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span>تفاصيل المبالغ المالية والتحصيل (COD)</span>
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  order.isSettledWithMerchant
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {order.isSettledWithMerchant ? 'تم صرف الحساب' : 'قيد التسوية المالية'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
                <div className="text-[10px] text-slate-400 mb-1">ثمن البضاعة (للتاجر)</div>
                <div className="text-sm font-black text-amber-400 font-mono">
                  {Number(order.merchantCollection || 0).toFixed(3)}
                </div>
                <div className="text-[9px] text-slate-500">د.أ</div>
              </div>

              <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
                <div className="text-[10px] text-slate-400 mb-1">أجرة التوصيل</div>
                <div className="text-sm font-black text-slate-200 font-mono">
                  {Number(order.deliveryFee || 0).toFixed(3)}
                </div>
                <div className="text-[9px] text-slate-500">د.أ</div>
              </div>

              <div className="bg-emerald-950/80 p-2.5 rounded-xl border border-emerald-800/80">
                <div className="text-[10px] text-emerald-300 font-bold mb-1">المطلوب من الزبون</div>
                <div className="text-sm font-black text-emerald-400 font-mono">
                  {Number(order.totalCollection || Number(order.merchantCollection || 0) + Number(order.deliveryFee || 0)).toFixed(3)}
                </div>
                <div className="text-[9px] text-emerald-300">د.أ</div>
              </div>
            </div>
          </div>

          {/* Package Details & Notes */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-2 text-xs">
            <div className="font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center justify-between">
              <span>تفاصيل محتوى الطرد</span>
              <span className="text-slate-500 text-[11px]">عدد القطع: {order.piecesCount || 1}</span>
            </div>
            <div className="text-slate-700">
              <span className="font-semibold text-slate-500">نوع الشحنة: </span>
              {order.packageType || 'عام'}
            </div>
            {order.cancellationReason && (
              <div className="bg-rose-50 text-rose-900 p-2.5 rounded-xl border border-rose-200 text-[11px] font-semibold mt-2">
                <span className="font-bold">سبب إلغاء الطلب / Cancellation Reason: </span>
                {order.cancellationReason}
              </div>
            )}
            {order.notes && (
              <div className="bg-amber-50/80 text-amber-900 p-2.5 rounded-xl border border-amber-200 text-[11px] font-semibold mt-2">
                <span className="font-bold">ملاحظات التوصيل: </span>
                {order.notes}
              </div>
            )}
          </div>

          {/* Status Logs Journey Timeline */}
          {order.statusLogs && order.statusLogs.length > 0 && (
            <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3 text-xs">
              <div className="font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center justify-between">
                <span>سجل التتبع وتحديثات الحالة التشغيلية</span>
                <span className="text-slate-400 font-mono text-[10px]">{order.statusLogs.length} سجلات</span>
              </div>
              <div className="space-y-2">
                {order.statusLogs.map((log, idx) => (
                  <div key={log.id || idx} className="flex items-start gap-2.5 text-[11px] border-r-2 border-amber-500 pr-2.5 py-1">
                    <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-slate-900">{log.note || `تغيير الحالة إلى ${log.toStatus}`}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {new Date(log.createdAt || (log as any).timestamp || Date.now()).toLocaleString('ar-JO')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assigned Captain Driver Context */}
          {(order.driver || order.driverId) && (
            <div className="bg-blue-50/80 rounded-2xl p-3.5 border border-blue-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <UserCheck className="w-5 h-5 text-blue-600 shrink-0" />
                <div>
                  <div className="font-bold text-blue-950">الكابتن المكلف بالاستلام/التوصيل</div>
                  <div className="text-blue-800 text-[11px] mt-0.5">
                    {order.driver?.name || 'كابتن الشحن المعتمد'}
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-mono bg-blue-100 text-blue-900 px-2 py-0.5 rounded-md font-bold">
                مكلف ميدانياً
              </span>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 sticky bottom-0">
          <button
            onClick={() => onOpenWaybill(order)}
            className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة البوليصة الحرارية</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import {
  X,
  Printer,
  MessageSquare,
  MapPin,
  Clock,
  Truck,
  Package,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Phone,
  User,
  History,
  ShieldCheck,
  KeyRound,
  Send,
  QrCode,
} from 'lucide-react';
import { Order, OrderStatus, User as UserType } from '../types/logistics';
import {
  formatCurrency,
  formatDate,
  formatWhatsAppUrl,
  buildRecipientWhatsAppMessage,
  STATUS_CONFIG,
} from '../utils/logisticsHelpers';

interface OrderDetailsDrawerProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onPrintWaybill: (order: Order) => void;
  onChangeStatus: (orderId: string, status: OrderStatus, note?: string) => void;
  onAssignDriver: (orderId: string, driverId: string) => void;
  onOpenCliqPayment?: (order: Order) => void;
  drivers: UserType[];
}

export const OrderDetailsDrawer: React.FC<OrderDetailsDrawerProps> = ({
  order,
  isOpen,
  onClose,
  onPrintWaybill,
  onChangeStatus,
  onAssignDriver,
  onOpenCliqPayment,
  drivers,
}) => {
  const [newStatusNote, setNewStatusNote] = useState('');
  const [selectedNewStatus, setSelectedNewStatus] = useState<OrderStatus>('OUT_FOR_DELIVERY');
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [smsNotice, setSmsNotice] = useState<string | null>(null);

  if (!isOpen || !order) return null;

  const handleSendSms = async () => {
    if (!order) return;
    setIsSendingSms(true);
    setSmsNotice(null);
    try {
      const res = await fetch(`/api/orders/${order.id}/send-sms`, { method: 'POST' });
      if (res.ok) {
        setSmsNotice('تم إرسال رسالة SMS تتضمن رمز الاستلام والرابط');
      }
    } catch {
      // ignore
    } finally {
      setIsSendingSms(false);
    }
  };

  const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;

  // WhatsApp link for recipient
  const recipientMsg = buildRecipientWhatsAppMessage(
    order.recipientName,
    order.sequence,
    order.totalCollection,
    `${order.governorate} - ${order.area}`
  );
  const recipientWhatsAppUrl = formatWhatsAppUrl(order.recipientPhone, recipientMsg);

  const handleStatusUpdate = () => {
    onChangeStatus(order.id, selectedNewStatus, newStatusNote);
    setNewStatusNote('');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/50 backdrop-blur-xs flex justify-start">
      <div className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col overflow-hidden border-l border-slate-200 animate-in slide-in-from-left duration-200">
        {/* Drawer Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-extrabold text-amber-400">
                {order.sequence}
              </span>
              {order.referenceNumber && (
                <span className="text-xs font-mono text-slate-400">({order.referenceNumber})</span>
              )}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              تاريخ التسجيل: {formatDate(order.createdAt)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onPrintWaybill(order)}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold"
              title="طباعة بوليصة الشحن الحرارية (40×60 مم)"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>طباعة بوليصة (40×60)</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status Banner */}
          <div
            className={`p-4 rounded-xl border flex items-center justify-between ${statusCfg.bg} ${statusCfg.border}`}
          >
            <div>
              <div className="text-xs font-semibold text-slate-600">حالة الشحنة الحالية</div>
              <div className={`text-lg font-black ${statusCfg.text}`}>{statusCfg.label}</div>
            </div>
            <a
              href={recipientWhatsAppUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
            >
              <MessageSquare className="w-4 h-4 fill-current" />
              <span>محادثة واتساب سريعة</span>
            </a>
          </div>

          {/* Recipient & Destination Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-amber-600" />
              وجهة التوصيل والمستلم
            </h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">اسم المستلم:</span>
                <strong className="text-slate-900 text-sm">{order.recipientName}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">الهاتف الرئيسي:</span>
                <strong className="text-slate-900 font-mono text-sm">{order.recipientPhone}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">المحافظة والمنطقة:</span>
                <span className="font-semibold text-slate-800">
                  {order.governorate} - {order.area}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">المنطقة الفرعية:</span>
                <span className="text-slate-700">{order.subArea || 'غير محدد'}</span>
              </div>
            </div>
            <div className="text-xs border-t border-slate-200/80 pt-2">
              <span className="text-slate-500 block mb-0.5">العنوان بالتفصيل:</span>
              <p className="text-slate-800 font-medium bg-white p-2 rounded border border-slate-200">
                {order.fullAddress}
              </p>
            </div>
          </div>

          {/* Financial Breakdown (COD) */}
          <div className="bg-emerald-50/50 border border-emerald-200/70 rounded-xl p-4 space-y-2">
            <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              التسوية المالية (Cash On Delivery)
            </h4>
            <div className="grid grid-cols-3 gap-2 text-center pt-2">
              <div className="bg-white p-2.5 rounded-lg border border-emerald-200">
                <div className="text-[11px] text-slate-500">مبلغ البضاعة للتاجر</div>
                <div className="text-sm font-bold text-slate-900 font-mono">
                  {formatCurrency(order.merchantCollection)}
                </div>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-emerald-200">
                <div className="text-[11px] text-slate-500">أجرة التوصيل</div>
                <div className="text-sm font-bold text-slate-900 font-mono">
                  {formatCurrency(order.deliveryFee)}
                </div>
              </div>
              <div className="bg-emerald-600 text-white p-2.5 rounded-lg shadow-xs">
                <div className="text-[11px] text-emerald-100">إجمالي التحصيل COD</div>
                <div className="text-base font-extrabold font-mono">
                  {formatCurrency(order.totalCollection)}
                </div>
              </div>
            </div>
          </div>

          {/* Merchant & Driver Assignment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
              <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-500" />
                التاجر المرسل
              </div>
              <div className="font-bold text-slate-900 text-xs">
                {order.merchant?.commercialName || order.merchant?.name}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                {order.merchant?.phone || 'لا يوجد رقم'}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
              <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-slate-500" />
                الكابتن المسؤول
              </div>
              <select
                value={order.driverId || ''}
                onChange={(e) => onAssignDriver(order.id, e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 text-slate-800"
              >
                <option value="">بدون سائق</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Proof of Delivery (POD) & Customer OTP Security */}
          <div className="bg-slate-900 text-white rounded-xl p-4 space-y-3 shadow-sm border border-slate-800">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                توثيق التسليم الذكي (Proof of Delivery - POD)
              </h4>
              {order.otpVerified ? (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded border border-emerald-500/30">
                  تم التحقق بالرمز OTP ✓
                </span>
              ) : (
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded border border-amber-500/30">
                  قيد انتظار التسليم
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-950/70 p-3 rounded-lg border border-slate-800 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block">رمز الاستلام السري للعميل (OTP):</span>
                <span className="font-mono text-lg font-black tracking-widest text-amber-300">
                  {order.deliveryOtp || '4821'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">التوقيع الإلكتروني:</span>
                <span className="font-bold text-slate-200">
                  {order.recipientSignature ? 'تم توثيق توقيع المستلم ✓' : 'لم يتم التوقيع بعد'}
                </span>
              </div>
            </div>

            {smsNotice && (
              <div className="text-[11px] bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 p-2 rounded-lg font-semibold">
                {smsNotice}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-slate-400">
                {order.smsNotificationSent ? 'تم إرسال إشعار SMS مسبقاً' : 'لم يتم إرسال SMS بعد'}
              </span>
              <div className="flex items-center gap-2">
                {onOpenCliqPayment && (
                  <button
                    type="button"
                    onClick={() => onOpenCliqPayment(order)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>دفع إلكتروني CliQ</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSendSms}
                  disabled={isSendingSms}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Send className="w-3 h-3" />
                  <span>{isSendingSms ? 'جاري الإرسال...' : 'إرسال الرمز للعميل عبر SMS'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Status Update Quick Tool */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              تحديث حالة الطلبية وإضافة ملاحظة
            </h4>
            <div className="flex gap-2">
              <select
                value={selectedNewStatus}
                onChange={(e) => setSelectedNewStatus(e.target.value as OrderStatus)}
                className="text-xs bg-white border border-slate-300 rounded-lg p-2 text-slate-900 flex-1 font-bold"
              >
                <option value="OUT_FOR_DELIVERY">جاري التوصيل</option>
                <option value="DELIVERED">تم التسليم بنجاح</option>
                <option value="POSTPONED">مؤجل</option>
                <option value="CANCELLED">ملغي</option>
                <option value="PICKING">جاري الاستلام من التاجر</option>
                <option value="RETURNED">مرتجع للمتجر</option>
              </select>
              <button
                type="button"
                onClick={handleStatusUpdate}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors"
              >
                تحديث الحالة
              </button>
            </div>
            <input
              type="text"
              placeholder="سبب التغيير أو ملاحظة الكابتن..."
              value={newStatusNote}
              onChange={(e) => setNewStatusNote(e.target.value)}
              className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 text-slate-800"
            />
          </div>

          {/* Timeline / History Logs */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-slate-500" />
              سجل التتبع والعمليات (Status Logs)
            </h4>
            <div className="space-y-2.5 relative border-r-2 border-slate-200 pr-4 mr-2">
              {(order.statusLogs || []).length > 0 ? (
                order.statusLogs?.map((log) => (
                  <div key={log.id} className="relative">
                    <div className="absolute -right-[21px] top-1 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-white shadow-xs"></div>
                    <div className="text-xs font-bold text-slate-800">
                      {STATUS_CONFIG[log.toStatus]?.label || log.toStatus}
                    </div>
                    <div className="text-[11px] text-slate-600">{log.note}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {formatDate(log.createdAt)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400">لا يوجد سجل تاريخي مسجل بعد.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

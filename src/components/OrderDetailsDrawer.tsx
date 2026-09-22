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
  Store,
  Building2,
  FileText,
  RotateCcw,
  ListTodo,
  AlertTriangle,
  Copy,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { Order, OrderStatus, User as UserType } from '../types/logistics';
import {
  formatCurrency,
  formatDate,
  formatWhatsAppUrl,
  buildRecipientWhatsAppMessage,
  STATUS_CONFIG,
} from '../utils/logisticsHelpers';
import { useI18n } from '../lib/i18n';
import { ShipmentJourney } from './ShipmentJourney';
import { ShipmentTimeline } from './ShipmentTimeline';
import { getAuthHeaders } from '../lib/auth';

export type DrawerTab =
  | 'overview'
  | 'journey'
  | 'timeline'
  | 'customer'
  | 'shipment'
  | 'finance'
  | 'pod'
  | 'returns'
  | 'tasks'
  | 'audit';

interface OrderDetailsDrawerProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onPrintWaybill: (order: Order) => void;
  onChangeStatus: (orderId: string, status: OrderStatus, note?: string) => void;
  onAssignDriver: (orderId: string, driverId: string) => void;
  onOpenCliqPayment?: (order: Order) => void;
  drivers: UserType[];
  userRole?: string;
  currentUser?: UserType | null;
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
  userRole = 'ADMIN',
  currentUser,
}) => {
  const { t, direction } = useI18n();
  const [activeTab, setActiveTab] = useState<DrawerTab>('overview');
  const [newStatusNote, setNewStatusNote] = useState('');
  const [selectedNewStatus, setSelectedNewStatus] = useState<OrderStatus>('OUT_FOR_DELIVERY');
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [smsNotice, setSmsNotice] = useState<string | null>(null);
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Return operations state
  const [returnReason, setReturnReason] = useState<string>('CUSTOMER_REFUSED');
  const [returnNotes, setReturnNotes] = useState<string>('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returnSuccess, setReturnSuccess] = useState<string | null>(null);

  if (!isOpen || !order) return null;

  const isDriverRole = userRole?.toUpperCase() === 'DRIVER';

  const handleSendSms = async () => {
    if (!order) return;
    setIsSendingSms(true);
    setSmsNotice(null);
    try {
      const headers = getAuthHeaders(currentUser);
      const res = await fetch(`/api/orders/${order.id}/send-sms`, {
        method: 'POST',
        headers,
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setSmsNotice(data?.message || 'تم إرسال رسالة SMS تتضمن رمز الاستلام والرابط');
      } else {
        setSmsNotice(data?.error || 'تعذر إرسال رسالة SMS');
      }
    } catch {
      setSmsNotice('حدث خطأ أثناء الاتصال بالخادم لإرسال الرسالة');
    } finally {
      setIsSendingSms(false);
    }
  };

  const handleCopyPhone = (phone: string) => {
    navigator.clipboard?.writeText(phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
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

  const merchantPhone = order.merchant?.phone || '';
  const merchantWhatsAppUrl = formatWhatsAppUrl(merchantPhone, `مرحباً، استفسار بخصوص الشحنة رقم ${order.sequence}`);

  const handleStatusUpdate = () => {
    onChangeStatus(order.id, selectedNewStatus, newStatusNote);
    setNewStatusNote('');
  };

  const tabs: { id: DrawerTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: t.orders.drawerTabs.overview, icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'journey', label: t.orders.drawerTabs.journey, icon: <MapPin className="w-3.5 h-3.5" /> },
    { id: 'timeline', label: t.orders.drawerTabs.timeline, icon: <History className="w-3.5 h-3.5" /> },
    { id: 'customer', label: t.orders.drawerTabs.customer, icon: <User className="w-3.5 h-3.5" /> },
    { id: 'shipment', label: t.orders.drawerTabs.shipment, icon: <Package className="w-3.5 h-3.5" /> },
    { id: 'finance', label: t.orders.drawerTabs.finance, icon: <DollarSign className="w-3.5 h-3.5" /> },
    { id: 'pod', label: t.orders.drawerTabs.pod, icon: <ShieldCheck className="w-3.5 h-3.5" /> },
    { id: 'returns', label: t.orders.drawerTabs.returns, icon: <RotateCcw className="w-3.5 h-3.5" /> },
    { id: 'tasks', label: t.orders.drawerTabs.tasks, icon: <ListTodo className="w-3.5 h-3.5" /> },
    { id: 'audit', label: t.orders.drawerTabs.audit, icon: <Clock className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-xs flex justify-end font-sans">
      <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col overflow-hidden border-r border-slate-200 animate-in slide-in-from-right duration-200">
        
        {/* Top Drawer Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-extrabold text-amber-400">
                {order.sequence}
              </span>
              {order.referenceNumber && (
                <span className="text-xs font-mono text-slate-400">({order.referenceNumber})</span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2 font-mono">
              <span>تاريخ التسجيل: {formatDate(order.createdAt)}</span>
              <span>•</span>
              <span>الفرع: {order.branchName || 'فرع عمان الرئيسي'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isDriverRole && (
              <button
                onClick={() => onPrintWaybill(order)}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold"
                title="طباعة بوليصة الشحن الحرارية (40×60 مم)"
              >
                <Printer className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">طباعة (40×60)</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Strip */}
        <div className="bg-slate-100 border-b border-slate-200 px-3 pt-2 flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-lg transition-colors whitespace-nowrap border-t border-x ${
                  isActive
                    ? 'bg-white text-amber-700 border-slate-200 border-b-white -mb-px shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Drawer Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Status Banner */}
              <div className={`p-4 rounded-xl border flex items-center justify-between ${statusCfg.bg} ${statusCfg.border}`}>
                <div>
                  <div className="text-[11px] font-semibold text-slate-600">حالة الشحنة الحالية</div>
                  <div className={`text-lg font-black ${statusCfg.text}`}>{statusCfg.label}</div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={recipientWhatsAppUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5 fill-current" />
                    <span>واتساب العميل</span>
                  </a>
                </div>
              </div>

              {/* Overview Quick Summary Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Customer Summary Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-amber-600" />
                    المستلم
                  </div>
                  <div>
                    <div className="font-extrabold text-slate-900 text-sm">{order.recipientName}</div>
                    <div className="font-mono text-slate-600">{order.recipientPhone}</div>
                    <div className="text-slate-500 mt-1">{order.governorate} - {order.area}</div>
                    <div className="text-slate-400 text-[10px] truncate">{order.fullAddress}</div>
                  </div>
                </div>

                {/* Merchant & Driver Summary Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Store className="w-4 h-4 text-amber-600" />
                    التاجر والمسؤول
                  </div>
                  <div>
                    <div className="font-extrabold text-slate-900 text-sm">{order.merchant?.commercialName || order.merchant?.name}</div>
                    <div className="text-slate-500 text-[11px]">الكابتن: <strong className="text-slate-800">{order.driver?.name || 'غير معين'}</strong></div>
                    <div className="text-slate-500 text-[11px]">الفرع: <strong className="text-slate-800">{order.branchName || 'الفرع الرئيسي'}</strong></div>
                  </div>
                </div>
              </div>

              {/* Financial Snapshot Card */}
              <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 space-y-2">
                <div className="text-xs font-bold text-emerald-900 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    تحصيل النقد عند التسليم (COD)
                  </span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-mono font-bold">
                    شامل رسوم التوصيل
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-center">
                  <div className="bg-emerald-600 text-white p-2.5 rounded-lg shadow-2xs">
                    <div className="text-[10px] text-emerald-100">المبلغ من العميل</div>
                    <div className="text-base font-black font-mono">{formatCurrency(order.totalCollection)}</div>
                  </div>
                  {!isDriverRole && (
                    <>
                      <div className="bg-white p-2.5 rounded-lg border border-emerald-200">
                        <div className="text-[10px] text-slate-500">أجرة التوصيل</div>
                        <div className="text-sm font-bold text-slate-900 font-mono">{formatCurrency(order.deliveryFee)}</div>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-emerald-200">
                        <div className="text-[10px] text-slate-500">صافي التاجر</div>
                        <div className="text-sm font-bold text-slate-900 font-mono">{formatCurrency(order.merchantCollection)}</div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Status Update Quick Bar */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  تحديث حالة الشحنة المباشر
                </h4>
                <div className="flex gap-2">
                  <select
                    value={selectedNewStatus}
                    onChange={(e) => setSelectedNewStatus(e.target.value as OrderStatus)}
                    className="text-xs bg-white border border-slate-300 rounded-lg p-2 text-slate-900 flex-1 font-bold"
                  >
                    <option value="OUT_FOR_DELIVERY">جاري التوصيل (Out for Delivery)</option>
                    <option value="DELIVERED">تم التسليم بنجاح (Delivered)</option>
                    <option value="POSTPONED">مؤجل (Postponed)</option>
                    <option value="CANCELLED">ملغي (Cancelled)</option>
                    <option value="PICKING">جاري البيك أب (Picking)</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleStatusUpdate}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs"
                  >
                    حفظ التحديث
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="سبب التغيير أو ملاحظة الكابتن الميدانية..."
                  value={newStatusNote}
                  onChange={(e) => setNewStatusNote(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 text-slate-800"
                />
              </div>
            </div>
          )}

          {/* TAB 2: JOURNEY */}
          {activeTab === 'journey' && <ShipmentJourney order={order} userRole={userRole} />}

          {/* TAB 3: TIMELINE */}
          {activeTab === 'timeline' && <ShipmentTimeline order={order} />}

          {/* TAB 4: CUSTOMER */}
          {activeTab === 'customer' && (
            <div className="space-y-4 text-xs font-sans">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
                    <User className="w-4 h-4 text-amber-600" />
                    تفاصيل المستلم ووسائل الاتصال
                  </h4>
                  <button
                    type="button"
                    onClick={() => handleCopyPhone(order.recipientPhone)}
                    className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 rounded text-[11px] font-bold flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3 text-slate-500" />
                    <span>{copiedPhone ? 'تم النسخ!' : 'نسخ رقم الهاتف'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-slate-500 block text-[11px]">الاسم الكامل:</span>
                    <strong className="text-slate-900 text-sm">{order.recipientName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">رقم الهاتف الرئيسي:</span>
                    <strong className="text-slate-900 font-mono text-sm">{order.recipientPhone}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">رقم الهاتف البديل:</span>
                    <span className="text-slate-800 font-mono">{order.recipientPhoneAlt || 'لا يوجد'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">المحافظة والمنطقة:</span>
                    <span className="font-bold text-slate-800">{order.governorate} - {order.area}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-500 block text-[11px] mb-1">العنوان السكني التفصيلي:</span>
                  <div className="p-2.5 bg-white rounded border border-slate-200 text-slate-800 font-medium">
                    {order.fullAddress}
                  </div>
                </div>

                {/* Quick Actions Bar */}
                <div className="flex items-center gap-2 pt-2">
                  <a
                    href={`tel:${order.recipientPhone}`}
                    className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-center font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5 text-amber-400" />
                    <span>اتصال بالعميل</span>
                  </a>
                  <a
                    href={recipientWhatsAppUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-center font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>محادثة واتساب</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SHIPMENT */}
          {activeTab === 'shipment' && (
            <div className="space-y-4 text-xs font-sans">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-sm border-b border-slate-200 pb-2">
                  <Package className="w-4 h-4 text-amber-600" />
                  بيانات ومحتويات الطرد اللوجستي
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-500 block text-[11px]">رقم التتبع (Tracking Number):</span>
                    <strong className="text-slate-900 font-mono text-sm">{order.sequence}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">الرقم المرجعي للتاجر:</span>
                    <strong className="text-slate-900 font-mono">{order.referenceNumber || 'لا يوجد'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">نوع المحتوى / الطرد:</span>
                    <span className="font-semibold text-slate-800">{order.packageType || 'طرد عادي'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">عدد القطع:</span>
                    <span className="font-bold text-slate-800 font-mono">{order.piecesCount || 1} قطعة</span>
                  </div>
                </div>

                {order.notes && (
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-slate-500 block text-[11px] mb-1">تعليمات وتوجيهات الشحنة:</span>
                    <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded font-medium">
                      {order.notes}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: FINANCE (ROLE RESTRICTED) */}
          {activeTab === 'finance' && (
            <div className="space-y-4 text-xs font-sans">
              <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-emerald-900 flex items-center gap-1.5 text-sm border-b border-emerald-200 pb-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  المقاصة والبيانات المالية للشحنة
                </h4>

                <div className="p-3 bg-white rounded-lg border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-semibold">المبلغ الإجمالي المطلوب تحصيله من العميل (COD):</span>
                    <span className="font-mono text-base font-black text-emerald-700">{formatCurrency(order.totalCollection)}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    * هذا المبلغ يشمل أجرة التوصيل كاملاً وهو المبلغ المعتمد تحصيله ميدانياً.
                  </div>
                </div>

                {!isDriverRole ? (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-slate-500 block text-[11px]">رسوم التوصيل المحتسبة:</span>
                      <strong className="text-slate-900 font-mono text-sm">{formatCurrency(order.deliveryFee)}</strong>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-slate-500 block text-[11px]">صافي مستحقات التاجر (Merchant Net):</span>
                      <strong className="text-slate-900 font-mono text-sm">{formatCurrency(order.merchantCollection)}</strong>
                    </div>
                    {order.driverFee !== undefined && (
                      <div className="p-3 bg-white rounded-lg border border-slate-200">
                        <span className="text-slate-500 block text-[11px]">عمولة/استحقاق السائق:</span>
                        <strong className="text-slate-900 font-mono text-sm">{formatCurrency(order.driverFee)}</strong>
                      </div>
                    )}
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-slate-500 block text-[11px]">حالة التسوية مع التاجر:</span>
                      <span className={`font-bold ${order.isSettledWithMerchant ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {order.isSettledWithMerchant ? 'تمت التسوية والمقاصة ✓' : 'معلقة (بانتظار التسوية)'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs font-semibold">
                    ملاحظة للسائق: يرجى تحصيل المبلغ المطلوب أعلاه كاملاً وتوريده للفرع/العهدة النقدية.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 7: POD */}
          {activeTab === 'pod' && (
            <div className="space-y-4 text-xs font-sans">
              <div className="bg-slate-900 text-white rounded-xl p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="font-bold text-amber-400 flex items-center gap-1.5 text-sm">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    توثيق وإثبات التسليم (Proof of Delivery)
                  </h4>
                  {order.otpVerified ? (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded border border-emerald-500/30">
                      تم التحقق بالرمز OTP ✓
                    </span>
                  ) : (
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded border border-amber-500/30">
                      بانتظار التسليم
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-400 block">رمز الاستلام OTP للعميل:</span>
                    <span className="font-mono text-lg font-black text-amber-300 tracking-widest">
                      {order.deliveryOtp || '4821'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">حالة التوقيع الرقمي:</span>
                    <span className="font-semibold text-slate-200">
                      {order.recipientSignature ? 'تم توثيق التوقيع ✓' : 'لم يوقع بعد'}
                    </span>
                  </div>
                </div>

                {smsNotice && (
                  <div className="text-[11px] bg-emerald-950 border border-emerald-500/40 text-emerald-300 p-2 rounded-lg font-semibold">
                    {smsNotice}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  {onOpenCliqPayment && (
                    <button
                      type="button"
                      onClick={() => onOpenCliqPayment(order)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>دفع CliQ</span>
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
          )}

          {/* TAB 8: RETURNS */}
          {activeTab === 'returns' && (
            <div className="space-y-4 text-xs font-sans">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-rose-900 flex items-center gap-1.5 text-sm border-b border-rose-200 pb-2">
                  <RotateCcw className="w-4 h-4 text-rose-600" />
                  حالة المرتجعات والمسار العكسي (Phase 3C Reverse Logistics)
                </h4>
                <div className="grid grid-cols-2 gap-3 text-slate-800">
                  <div>
                    <span className="text-slate-500 block text-[11px]">حالة المرتجع:</span>
                    <strong className="font-bold text-rose-800">
                      {order.status === 'RETURNED' ? 'شحنة مرتجعة بالكامل (RETURNED)' : 'ليست مرتجعة حالياً'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">عدد محاولات التسليم الفاشلة:</span>
                    <strong className="font-mono text-slate-900">{order.deliveryAttempts || 0} محاولات</strong>
                  </div>
                </div>
              </div>

              {returnError && (
                <div className="p-3 bg-rose-100 border border-rose-300 text-rose-900 rounded-xl text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="font-bold flex-1">{returnError}</span>
                </div>
              )}

              {returnSuccess && (
                <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-bold flex-1">{returnSuccess}</span>
                </div>
              )}

              {order.status !== 'RETURNED' && order.status !== 'CANCELLED' && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs">
                  <h5 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                    بدء مسار إرجاع رسمي وموثق (Initiate Return Engine)
                  </h5>
                  <p className="text-[11px] text-slate-500">
                    يقوم هذا الإجراء باستدعاء المعاملة الذرية execute_initiate_shipment_return لإنشاء مرحلة RETURN مخصصة وحساب التسلسل التشغيلي وتوثيق سبب الإرجاع.
                  </p>

                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        سبب الإرجاع:
                      </label>
                      <select
                        value={returnReason}
                        onChange={(e) => setReturnReason(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                      >
                        <option value="CUSTOMER_REFUSED">رفض الزبون الاستلام (Customer Refused)</option>
                        <option value="CUSTOMER_UNREACHABLE">تعذر الوصول للزبون (Unreachable)</option>
                        <option value="RETURN_REQUESTED">طلب إرجاع رسمي من المتجر (Return Requested)</option>
                        <option value="WRONG_ITEM">الصنف غير مطابق للطلب (Wrong Item)</option>
                        <option value="DAMAGED_ITEM">طرد متضرر أو تالف (Damaged)</option>
                        <option value="CANCELLED_BY_CUSTOMER">إلغاء الطلب من الزبون (Cancelled)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        ملاحظات مسار الإرجاع:
                      </label>
                      <input
                        type="text"
                        value={returnNotes}
                        onChange={(e) => setReturnNotes(e.target.value)}
                        placeholder="أي تفاصيل تشغيلية أو توجيهات لفرع التاجر..."
                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900"
                      />
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        disabled={isSubmittingReturn}
                        onClick={async () => {
                          setIsSubmittingReturn(true);
                          setReturnError(null);
                          setReturnSuccess(null);
                          try {
                            const res = await fetch('/api/operational/returns/initiate', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                'Idempotency-Key': crypto.randomUUID(),
                                ...getAuthHeaders(currentUser),
                              },
                              body: JSON.stringify({
                                shipmentId: order.id,
                                returnReason,
                                notes: returnNotes || undefined,
                              }),
                            });
                            const data = await res.json();
                            if (!res.ok) {
                              throw new Error(data.error?.message || data.message || 'فشل في بدء مسار الإرجاع');
                            }
                            setReturnSuccess('تم بدء مسار الإرجاع التشغيلي بنجاح (RETURN Leg Created)');
                            setReturnNotes('');
                          } catch (err: any) {
                            setReturnError(err.message || 'فشل في بدء مسار الإرجاع');
                          } finally {
                            setIsSubmittingReturn(false);
                          }
                        }}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
                      >
                        {isSubmittingReturn ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        <span>بدء مسار الإرجاع (Initiate Return)</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 9: TASKS */}
          {activeTab === 'tasks' && (
            <div className="space-y-4 text-xs font-sans">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-amber-900 flex items-center gap-1.5 text-sm border-b border-amber-200 pb-2">
                  <ListTodo className="w-4 h-4 text-amber-600" />
                  التنبيهات التشغيلية والمهام المطلوبة (Derived Alerts)
                </h4>
                <div className="space-y-2">
                  {!order.driverId && (
                    <div className="p-2.5 bg-white border border-amber-300 rounded-lg flex items-center gap-2 text-amber-900 font-semibold">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>شحنة بدون سائق: تطلب تعيين كابتن ميداني في أقرب وقت.</span>
                    </div>
                  )}
                  {(order.deliveryAttempts || 0) > 0 && (
                    <div className="p-2.5 bg-white border border-rose-300 rounded-lg flex items-center gap-2 text-rose-900 font-semibold">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>تم تسجيل {order.deliveryAttempts} محاولات تسليم سابقة غير مكتملة.</span>
                    </div>
                  )}
                  {order.status === 'POSTPONED' && (
                    <div className="p-2.5 bg-white border border-orange-300 rounded-lg flex items-center gap-2 text-orange-900 font-semibold">
                      <Clock className="w-4 h-4 text-orange-600 shrink-0" />
                      <span>تم تأجيل موعد التسليم بناءً على طلب العميل/السائق.</span>
                    </div>
                  )}
                  {order.driverId && (order.deliveryAttempts || 0) === 0 && order.status !== 'POSTPONED' && (
                    <div className="p-2.5 bg-white border border-emerald-300 rounded-lg flex items-center gap-2 text-emerald-900 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>لا توجد تنبيهات تشغيلية حرجة على هذه الشحنة حالياً.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 10: AUDIT */}
          {activeTab === 'audit' && <ShipmentTimeline order={order} />}

        </div>
      </div>
    </div>
  );
};

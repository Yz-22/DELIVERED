import React, { useState, useEffect } from 'react';
import {
  Phone,
  MessageCircle,
  MapPin,
  CheckCircle2,
  Clock,
  PhoneOff,
  XCircle,
  Car,
  DollarSign,
  Package,
  Navigation,
  Check,
  Calendar,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  ChevronRight,
  ShieldCheck,
  Send,
  UserCheck,
  QrCode,
  Smartphone
} from 'lucide-react';
import { Order, OrderStatus, User } from '../types/logistics';
import { getAuthHeaders } from '../lib/auth';
import { PodVerificationModal } from './PodVerificationModal';
import { CliqPaymentModal } from './CliqPaymentModal';

interface DriverPortalProps {
  drivers: User[];
  currentUser?: User | null;
  onOrderUpdated?: () => void;
  onOpenWaybill?: (order: Order) => void;
}

export const DriverPortal: React.FC<DriverPortalProps> = ({
  drivers,
  currentUser,
  onOrderUpdated,
  onOpenWaybill,
}) => {
  // Lock to the logged-in driver account only
  const currentDriver =
    (currentUser?.role === 'DRIVER' ? currentUser : null) ||
    drivers.find((d) => d.id === currentUser?.id) ||
    drivers[0];

  const selectedDriverId = currentDriver?.id || 'u-drv-1';
  const [driverOrders, setDriverOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterTab, setFilterTab] = useState<'ALL' | 'PENDING' | 'DELIVERED' | 'POSTPONED'>('PENDING');
  const [searchQuery, setSearchQuery] = useState('');

  // Proof of Delivery (POD) Modal State
  const [podOrder, setPodOrder] = useState<Order | null>(null);
  const [cliqOrder, setCliqOrder] = useState<Order | null>(null);

  // Action Modal State
  const [activeModalOrder, setActiveModalOrder] = useState<Order | null>(null);
  const [modalAction, setModalAction] = useState<'DELIVER' | 'POSTPONE' | 'NO_ANSWER' | 'CANCEL' | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'CLIQ'>('COD');
  const [postponeDate, setPostponeDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Fetch driver orders
  const fetchDriverOrders = async () => {
    if (!selectedDriverId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/orders?driverId=${selectedDriverId}&limit=100`, {
        headers: getAuthHeaders(currentUser),
      });
      if (res.ok) {
        const data = await res.json();
        setDriverOrders(data.orders || []);
      }
    } catch (e) {
      console.error('Failed to fetch driver orders:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDriverOrders();
  }, [selectedDriverId]);

  // Statistics for this driver
  const totalAssigned = driverOrders.length;
  const deliveredOrders = driverOrders.filter((o) => o.status === 'DELIVERED');
  const deliveredCount = deliveredOrders.length;
  const pendingOrders = driverOrders.filter((o) => ['OUT_FOR_DELIVERY', 'PICKING', 'PENDING'].includes(o.status));
  const pendingCount = pendingOrders.length;
  const postponedOrders = driverOrders.filter((o) => ['POSTPONED', 'CANCELLED', 'RETURNED'].includes(o.status));
  
  // Total cash in custody for delivered orders that are not yet settled with cashier
  const cashInHand = deliveredOrders
    .filter((o) => !o.isSettledWithDriver)
    .reduce((sum, o) => sum + (o.totalCollection || 0), 0);

  // Filtered orders list
  const filteredOrders = driverOrders.filter((o) => {
    // Tab filter
    if (filterTab === 'PENDING' && !['OUT_FOR_DELIVERY', 'PICKING', 'PENDING'].includes(o.status)) {
      return false;
    }
    if (filterTab === 'DELIVERED' && o.status !== 'DELIVERED') {
      return false;
    }
    if (filterTab === 'POSTPONED' && !['POSTPONED', 'CANCELLED', 'RETURNED'].includes(o.status)) {
      return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchSeq = o.sequence.toLowerCase().includes(q);
      const matchName = o.recipientName.toLowerCase().includes(q);
      const matchPhone = o.recipientPhone.includes(q);
      const matchArea = o.area.toLowerCase().includes(q);
      if (!matchSeq && !matchName && !matchPhone && !matchArea) return false;
    }

    return true;
  });

  // Action submission
  const handleConfirmAction = async () => {
    if (!activeModalOrder || !modalAction) return;
    setIsSubmitting(true);

    try {
      let toStatus: OrderStatus = activeModalOrder.status;
      let note = actionNotes.trim();

      if (modalAction === 'DELIVER') {
        toStatus = 'DELIVERED';
        note = note || `تم التسليم بنجاح واستلام ${activeModalOrder.totalCollection} د.أ بواسطة (${paymentMethod === 'COD' ? 'الدفع نقداً' : 'تحويل كليك CliQ'})`;
      } else if (modalAction === 'POSTPONE') {
        toStatus = 'POSTPONED';
        note = note || `تم تأجيل التسليم بناء على طلب الزبون${postponeDate ? ` إلى تاريخ: ${postponeDate}` : ''}`;
      } else if (modalAction === 'NO_ANSWER') {
        toStatus = 'POSTPONED';
        note = note || 'الزبون لم يرد على الهاتف (محاولة تسليم غير مكتملة)';
      } else if (modalAction === 'CANCEL') {
        toStatus = 'CANCELLED';
        note = note || 'رفض العميل استلام الطرد';
      }

      const res = await fetch(`/api/orders/${activeModalOrder.id}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(currentUser),
        body: JSON.stringify({
          status: toStatus,
          note,
        }),
      });

      if (res.ok) {
        setSuccessToast(`تم تحديث حالة الشحنة (${activeModalOrder.sequence})`);
        setTimeout(() => setSuccessToast(null), 3000);
        closeModal();
        fetchDriverOrders();
        onOrderUpdated?.();
      }
    } catch (e) {
      console.error('Error updating status:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openActionModal = (order: Order, action: 'DELIVER' | 'POSTPONE' | 'NO_ANSWER' | 'CANCEL') => {
    setActiveModalOrder(order);
    setModalAction(action);
    setActionNotes('');
    setPaymentMethod(order.paymentType === 'CLIQ' ? 'CLIQ' : 'COD');
    setPostponeDate('');
  };

  const closeModal = () => {
    setActiveModalOrder(null);
    setModalAction(null);
  };

  // WhatsApp quick text generator
  const getWhatsAppLink = (order: Order) => {
    let phone = order.recipientPhone.replace(/[\s-]/g, '');
    if (phone.startsWith('07')) {
      phone = '962' + phone.substring(1);
    }
    const merchantName = order.merchant?.commercialName || order.merchant?.name || 'المتجر';
    const text = encodeURIComponent(
      `مرحباً ${order.recipientName}، معك كابتن التوصيل من شركة DarGo اللوجستية.\nلدينا طرد خاص بك من (${merchantName}) بقيمة (${order.totalCollection} د.أ).\nيرجى تأكيد تواجدك لاستلام الطلبية في (${order.governorate} - ${order.area}).`
    );
    return `https://wa.me/${phone}?text=${text}`;
  };

  // Google Maps link
  const getGoogleMapsLink = (order: Order) => {
    if (order.locationCoordinates) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.locationCoordinates)}`;
    }
    const query = `${order.governorate}, ${order.area}, ${order.fullAddress}, Jordan`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4">
      {/* Toast */}
      {successToast && (
        <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-50 bg-emerald-600 text-white px-5 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-sm font-bold border border-emerald-400">
          <CheckCircle2 className="w-5 h-5 text-white" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Driver Header & Selector */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-4 sm:p-6 text-white shadow-lg border border-slate-700/60 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-xl shadow-md">
              <Car className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded border border-amber-500/30">
                  بوابة تطبيق الكابتن الميداني
                </span>
                <span className="text-xs text-slate-400">DarGo Mobile Captain</span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-white mt-1">
                {currentDriver?.name || 'الكابتن'}
              </h1>
              <p className="text-xs text-slate-400">
                مركبة: {currentDriver?.vehicleType || 'سيارة توصيل'} | لوحة: {currentDriver?.vehiclePlate || '12-98432'}
              </p>
            </div>
          </div>

          {/* Driver Status Badge */}
          <div className="bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700/80 text-right flex items-center justify-between sm:justify-end gap-3">
            <div>
              <div className="text-[10px] text-slate-400">حالة الكابتن الميداني</div>
              <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 justify-end">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>على رأس العمل (متصل)</span>
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <Car className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Driver KPIs Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-700/60">
          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/40">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>إجمالي مهام اليوم</span>
              <Package className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-bold text-white mt-1">{totalAssigned}</div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/40">
            <div className="text-[11px] text-amber-400 flex items-center justify-between">
              <span>قيد التوصيل الآن</span>
              <Clock className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-bold text-amber-400 mt-1">{pendingCount}</div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/40">
            <div className="text-[11px] text-emerald-400 flex items-center justify-between">
              <span>تم التسليم بنجاح</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-bold text-emerald-400 mt-1">{deliveredCount}</div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-amber-500/40 bg-amber-500/10">
            <div className="text-[11px] text-amber-300 font-semibold flex items-center justify-between">
              <span>العهدة النقدية بيدك</span>
              <DollarSign className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-extrabold text-amber-400 mt-1">
              {cashInHand.toFixed(2)}{' '}
              <span className="text-xs font-normal text-slate-300">د.أ</span>
            </div>
          </div>
        </div>

        {/* PWA Mobile Offline & Install Banner */}
        <div className="mt-4 pt-3 border-t border-slate-700/60 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-800/40 rounded-xl p-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <div className="text-right">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>تطبيق الكابتن PWA الميداني</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.2 rounded border border-emerald-500/30">
                  يعمل بدون إنترنت (Offline Ready)
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                يمكن تثبيت التطبيق مباشرة على شاشة الهاتف للوصول السريع ومسح وتوثيق الطرود
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setSuccessToast('جاهز للتثبيت! افتح خيارات المتصفح واختر "إضافة إلى الشاشة الرئيسية (Install PWA)"');
              setTimeout(() => setSuccessToast(null), 4500);
            }}
            className="w-full sm:w-auto px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 shrink-0"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>تثبيت التطبيق على الهاتف</span>
          </button>
        </div>
      </div>

      {/* Tabs & Search Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setFilterTab('PENDING')}
              className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                filterTab === 'PENDING'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>قيد التوصيل</span>
              <span className="bg-white/80 text-slate-900 px-1.5 py-0.2 rounded-full text-[10px]">
                {pendingCount}
              </span>
            </button>
            <button
              onClick={() => setFilterTab('DELIVERED')}
              className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                filterTab === 'DELIVERED'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>تم تسليمها</span>
              <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full text-[10px]">
                {deliveredCount}
              </span>
            </button>
            <button
              onClick={() => setFilterTab('POSTPONED')}
              className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                filterTab === 'POSTPONED'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>مؤجل / ملغي</span>
              <span className="bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded-full text-[10px]">
                {postponedOrders.length}
              </span>
            </button>
            <button
              onClick={() => setFilterTab('ALL')}
              className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                filterTab === 'ALL'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              الكل ({totalAssigned})
            </button>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث بالاسم أو البوليصة أو الهاتف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-9 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Orders List */}
      {isLoading ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-500 border border-slate-200">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-500 mb-3" />
          <p className="text-sm font-semibold">جاري جلب مهام التوصيل...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-200">
          <Package className="w-12 h-12 mx-auto text-slate-300 mb-2" />
          <h3 className="text-base font-bold text-slate-700">لا توجد شحنات مطابقة</h3>
          <p className="text-xs text-slate-500 mt-1">
            لا توجد مهام توصيل في هذا القسم حالياً. يمكنك تغيير القسم أو البحث باسم آخر.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const isDelivered = order.status === 'DELIVERED';
            const isPostponed = order.status === 'POSTPONED';
            const isCancelled = order.status === 'CANCELLED';

            return (
              <div
                key={order.id}
                className={`bg-white rounded-2xl shadow-sm border transition-all overflow-hidden ${
                  isDelivered
                    ? 'border-emerald-200 bg-emerald-50/20'
                    : isPostponed
                    ? 'border-amber-200 bg-amber-50/20'
                    : isCancelled
                    ? 'border-rose-200 bg-rose-50/20'
                    : 'border-slate-200 hover:border-amber-400'
                }`}
              >
                {/* Card Top: Sequence & Amount */}
                <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {order.sequence}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      متجر: {order.merchant?.commercialName || order.merchant?.name || 'سحر الشرق'}
                    </span>
                  </div>

                  {/* COD Collection Amount */}
                  <div className="text-left">
                    <div className="text-xs text-slate-500">المطلوب تحصيله:</div>
                    <div className="text-base font-extrabold text-slate-950">
                      {order.totalCollection.toFixed(2)}{' '}
                      <span className="text-xs font-normal text-slate-600">د.أ</span>
                    </div>
                  </div>
                </div>

                {/* Card Body: Customer Info */}
                <div className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-slate-900">
                          {order.recipientName}
                        </h2>
                        {isDelivered && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Check className="w-3 h-3" /> تم التسليم
                          </span>
                        )}
                        {isPostponed && (
                          <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Clock className="w-3 h-3" /> مؤجل
                          </span>
                        )}
                        {isCancelled && (
                          <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> ملغي / مرفوض
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-600 mt-1 font-mono">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{order.recipientPhone}</span>
                        {order.recipientPhoneAlt && (
                          <span className="text-slate-400">({order.recipientPhoneAlt})</span>
                        )}
                      </div>

                      <div className="flex items-start gap-1.5 text-xs text-slate-700 mt-2">
                        <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        <span>
                          <strong className="text-slate-900">{order.governorate}</strong> - {order.area}
                          {order.subArea && ` (${order.subArea})`} - {order.fullAddress}
                        </span>
                      </div>

                      {order.notes && (
                        <div className="mt-2 text-xs bg-amber-50 text-amber-900 p-2 rounded-lg border border-amber-200/60">
                          <strong>ملاحظات المتجر:</strong> {order.notes}
                        </div>
                      )}
                    </div>

                    {/* Quick Communication & Navigation Buttons */}
                    <div className="flex sm:flex-col gap-2 shrink-0">
                      <a
                        href={`tel:${order.recipientPhone}`}
                        className="flex-1 sm:flex-none px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Phone className="w-4 h-4 text-emerald-600" />
                        <span>اتصال</span>
                      </a>

                      <a
                        href={getWhatsAppLink(order)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 sm:flex-none px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border border-emerald-200"
                      >
                        <MessageCircle className="w-4 h-4 text-emerald-600" />
                        <span>واتساب</span>
                      </a>

                      <a
                        href={getGoogleMapsLink(order)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 sm:flex-none px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border border-blue-200"
                      >
                        <Navigation className="w-4 h-4 text-blue-600" />
                        <span>الخريطة</span>
                      </a>
                    </div>
                  </div>

                  {/* Delivery Actions Footer */}
                  {!isDelivered && (
                    <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setPodOrder(order)}
                        className="flex-1 min-w-[170px] px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>تسليم وتوثيق POD (رمز + توقيع)</span>
                      </button>

                      <button
                        onClick={() => openActionModal(order, 'DELIVER')}
                        className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition-all"
                        title="تسليم سريع عادي"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="hidden sm:inline">تسليم سريع</span>
                      </button>

                      <button
                        onClick={() => setCliqOrder(order)}
                        className="px-3 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all border border-indigo-200"
                        title="تحصيل القيمة فوراً عبر نظام CliQ الأردني بالـ QR"
                      >
                        <QrCode className="w-4 h-4 text-indigo-600" />
                        <span>دفع CliQ</span>
                      </button>

                      <button
                        onClick={() => openActionModal(order, 'POSTPONE')}
                        className="px-3 py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Clock className="w-4 h-4" />
                        <span>تأجيل</span>
                      </button>

                      <button
                        onClick={() => openActionModal(order, 'NO_ANSWER')}
                        className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
                      >
                        <PhoneOff className="w-4 h-4 text-slate-500" />
                        <span>لم يرد</span>
                      </button>

                      <button
                        onClick={() => openActionModal(order, 'CANCEL')}
                        className="px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>إلغاء</span>
                      </button>
                    </div>
                  )}

                  {/* Already Delivered Info */}
                  {isDelivered && (
                    <div className="mt-3 pt-3 border-t border-emerald-100 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-800">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>تم تحصيل المبلغ نقداً ويوجد بعهدة الكابتن</span>
                        {order.otpVerified && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-black px-2 py-0.5 rounded-full border border-emerald-300">
                            ✓ رمز OTP موثق
                          </span>
                        )}
                        {order.recipientSignature && (
                          <span className="text-[10px] bg-indigo-100 text-indigo-800 font-black px-2 py-0.5 rounded-full border border-indigo-300">
                            ✓ توقيع إلكتروني
                          </span>
                        )}
                      </div>
                      {onOpenWaybill && (
                        <button
                          onClick={() => onOpenWaybill(order)}
                          className="text-slate-600 hover:text-slate-900 underline text-xs font-bold"
                        >
                          عرض البوليصة
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Action Modal (Deliver / Postpone / Cancel) */}
      {activeModalOrder && modalAction && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 text-right animate-in fade-in zoom-in duration-150">
            {/* Modal Title */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                {modalAction === 'DELIVER' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                {modalAction === 'POSTPONE' && <Clock className="w-5 h-5 text-amber-600" />}
                {modalAction === 'NO_ANSWER' && <PhoneOff className="w-5 h-5 text-slate-600" />}
                {modalAction === 'CANCEL' && <XCircle className="w-5 h-5 text-rose-600" />}

                <span>
                  {modalAction === 'DELIVER' && 'تأكيد تسليم الطلبية واستلام التحصيل'}
                  {modalAction === 'POSTPONE' && 'تأجيل موعد تسليم الطلبية'}
                  {modalAction === 'NO_ANSWER' && 'تسجيل محاولة اتصال دون إجابة'}
                  {modalAction === 'CANCEL' && 'إلغاء الطلبية أو رفض الاستلام'}
                </span>
              </h3>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Modal Order Summary */}
            <div className="my-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">رقم البوليصة:</span>
                <span className="font-mono font-bold text-slate-900">{activeModalOrder.sequence}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">العميل:</span>
                <span className="font-bold text-slate-900">{activeModalOrder.recipientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">مبلغ التحصيل:</span>
                <span className="font-extrabold text-emerald-700 text-sm">
                  {activeModalOrder.totalCollection.toFixed(2)} دينار أردني
                </span>
              </div>
            </div>

            {/* Delivery Payment Mode */}
            {modalAction === 'DELIVER' && (
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  طريقة استلام المبلغ من العميل:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('COD')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      paymentMethod === 'COD'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>نقداً (كاش COD)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CLIQ')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      paymentMethod === 'CLIQ'
                        ? 'border-purple-600 bg-purple-50 text-purple-800'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    <Send className="w-4 h-4" />
                    <span>تحويل كليك CliQ</span>
                  </button>
                </div>
              </div>
            )}

            {/* Postpone specific input */}
            {modalAction === 'POSTPONE' && (
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  تاريخ التسليم الجديد المقترح:
                </label>
                <input
                  type="date"
                  value={postponeDate}
                  onChange={(e) => setPostponeDate(e.target.value)}
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500"
                />
              </div>
            )}

            {/* Note text field */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ملاحظات الكابتن (اختياري):
              </label>
              <textarea
                rows={2}
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder={
                  modalAction === 'DELIVER'
                    ? 'تم استلام الكاش والتسليم باليد...'
                    : modalAction === 'POSTPONE'
                    ? 'العميل طلب التوصيل بعد الساعة 5...'
                    : 'سبب الإلغاء أو عدم التجاوب...'
                }
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={closeModal}
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
              >
                تراجع
              </button>

              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={isSubmitting}
                className={`flex-1 py-2.5 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 ${
                  modalAction === 'DELIVER'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : modalAction === 'POSTPONE'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>تأكيد الإجراء</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Electronic Proof of Delivery Modal (OTP + Signature + Photo) */}
      <PodVerificationModal
        isOpen={!!podOrder}
        order={podOrder}
        onClose={() => setPodOrder(null)}
        onSuccess={() => {
          setSuccessToast(`تم توثيق تسليم الشحنة (${podOrder?.sequence}) برمز OTP والتوقيع الإلكتروني بنجاح!`);
          setTimeout(() => setSuccessToast(null), 4000);
          setPodOrder(null);
          fetchDriverOrders();
          onOrderUpdated?.();
        }}
      />

      {/* Jordanian Instant CliQ QR Payment Modal */}
      <CliqPaymentModal
        isOpen={!!cliqOrder}
        order={cliqOrder}
        onClose={() => setCliqOrder(null)}
        onSuccess={(updatedOrder) => {
          setSuccessToast(`تم استلام وتسجيل حوالة CliQ للشحنة (${updatedOrder.sequence}) بنجاح!`);
          setTimeout(() => setSuccessToast(null), 4000);
          setCliqOrder(null);
          fetchDriverOrders();
          onOrderUpdated?.();
        }}
      />
    </div>
  );
};

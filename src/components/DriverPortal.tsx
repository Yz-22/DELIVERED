import React, { useState, useEffect, useRef } from 'react';
import {
  Phone,
  MessageCircle,
  MapPin,
  CheckCircle2,
  Clock,
  XCircle,
  Car,
  DollarSign,
  Package,
  Navigation,
  Check,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  ShieldCheck,
  Send,
  QrCode,
  Smartphone,
  Copy,
  PenTool,
  KeyRound,
  FileText,
  Building2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  TrendingUp,
  ArrowRight,
  Eraser,
  Compass
} from 'lucide-react';
import { Order, User } from '../types/logistics';
import { getAuthHeaders } from '../lib/auth';
import { useI18n } from '../lib/i18n';

interface DriverStop {
  legId: string;
  shipmentId: string;
  sequence: string;
  trackingNumber: string;
  legType: string;
  legStatus: string;
  shipmentStatus: string;
  recipientName: string;
  recipientPhone: string;
  recipientPhoneAlt?: string;
  governorate: string;
  area: string;
  subArea?: string;
  streetAddress?: string;
  locationCoordinates?: string;
  notes?: string;
  paymentType: 'COD' | 'CLIQ' | 'PREPAID';
  codAmount: number;
  deliveryAttempts: number;
  failureReason?: string;
  failureNotes?: string;
  custody: {
    currentHolderType: string;
    currentDriverId?: string | null;
    isWithCustomer: boolean;
    isInDriverCustody: boolean;
    isAtFacility: boolean;
  };
  isEligibleForDelivery: boolean;
  isLastMile: boolean;
}

interface DriverWorkloadSummary {
  totalAssigned: number;
  inCustodyCount: number;
  awaitingHandoffCount: number;
  completedCount: number;
  failedCount: number;
  totalCodToCollect: number;
  cashHeldAmount: number;
  todayCollectedAmount: number;
}

interface DriverCashRecord {
  id: string;
  shipment_id: string;
  leg_id: string;
  cash_amount: number;
  remittance_status: string;
  collected_at: string;
  created_at?: string;
}

interface DriverPortalProps {
  drivers: User[];
  currentUser?: User | null;
  onOrderUpdated?: () => void;
  onOpenWaybill?: (order: Order) => void;
}

// Standardized Application Failure Reasons (APPLICATION_CONSTANT, non-DB-enum)
const STANDARDIZED_FAILURE_REASONS = [
  { code: 'CUSTOMER_UNAVAILABLE', labelAr: 'الزبون غير متواجد في الموقع', labelEn: 'Customer Unavailable' },
  { code: 'NO_ANSWER', labelAr: 'لا يوجد رد على الهاتف / الهاتف مغلق', labelEn: 'No Answer / Phone Off' },
  { code: 'CUSTOMER_POSTPONED', labelAr: 'طلب الزبون تأجيل موعد الاستلام', labelEn: 'Customer Requested Reschedule' },
  { code: 'CUSTOMER_REFUSED', labelAr: 'رفض الزبون استلام الشحنة', labelEn: 'Customer Refused Delivery' },
  { code: 'INCORRECT_ADDRESS', labelAr: 'العنوان غير صحيح أو غير مكتمل', labelEn: 'Incorrect / Incomplete Address' },
  { code: 'PAYMENT_ISSUE', labelAr: 'مشكلة في الدفع / عدم توفر النقد', labelEn: 'Payment Issue / No Cash' },
  { code: 'DAMAGED_PACKAGE', labelAr: 'الطرد تالف أو به كسر', labelEn: 'Damaged Package' },
  { code: 'OUT_OF_COVERAGE_AREA', labelAr: 'الموقع خارج نطاق التغطية', labelEn: 'Out of Coverage Area' },
];

export const DriverPortal: React.FC<DriverPortalProps> = ({
  drivers,
  currentUser,
  onOrderUpdated,
  onOpenWaybill,
}) => {
  const { t, language } = useI18n();

  // Authoritative driver assignment
  const currentDriver =
    (currentUser?.role === 'DRIVER' ? currentUser : null) ||
    drivers.find((d) => d.id === currentUser?.id) ||
    drivers[0];

  const selectedDriverId = currentDriver?.id || 'u-drv-1';

  // Navigation & Data State
  const [activeTab, setActiveTab] = useState<'STOPS' | 'MY_LOAD' | 'COMPLETED' | 'FAILED' | 'CASH'>('STOPS');
  const [summary, setSummary] = useState<DriverWorkloadSummary>({
    totalAssigned: 0,
    inCustodyCount: 0,
    awaitingHandoffCount: 0,
    completedCount: 0,
    failedCount: 0,
    totalCodToCollect: 0,
    cashHeldAmount: 0,
    todayCollectedAmount: 0,
  });

  const [activeStops, setActiveStops] = useState<DriverStop[]>([]);
  const [inCustodyStops, setInCustodyStops] = useState<DriverStop[]>([]);
  const [awaitingHandoffStops, setAwaitingHandoffStops] = useState<DriverStop[]>([]);
  const [completedStops, setCompletedStops] = useState<DriverStop[]>([]);
  const [failedStops, setFailedStops] = useState<DriverStop[]>([]);
  const [cashRecords, setCashRecords] = useState<DriverCashRecord[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Delivery Modal State
  const [deliveryModalStop, setDeliveryModalStop] = useState<DriverStop | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CLIQ' | 'PREPAID'>('CASH');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [cliqRef, setCliqRef] = useState('');
  const [deliveryOtp, setDeliveryOtp] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isDelivering, setIsDelivering] = useState(false);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);

  // Failure Modal State
  const [failureModalStop, setFailureModalStop] = useState<DriverStop | null>(null);
  const [failureReason, setFailureReason] = useState<string>('CUSTOMER_UNAVAILABLE');
  const [failureNotes, setFailureNotes] = useState('');
  const [isFailing, setIsFailing] = useState(false);
  const [failureError, setFailureError] = useState<string | null>(null);

  // Location / GPS Watcher Lifecycle
  const [locationStatus, setLocationStatus] = useState<'IDLE' | 'PERMISSION_PENDING' | 'GRANTED' | 'DENIED' | 'UNAVAILABLE'>('IDLE');
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    let watchId: number | null = null;
    if ('geolocation' in navigator) {
      setLocationStatus('PERMISSION_PENDING');
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setLocationStatus('GRANTED');
          setCurrentCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setLocationStatus('DENIED');
          } else {
            setLocationStatus('UNAVAILABLE');
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 120000 }
      );
    } else {
      setLocationStatus('UNAVAILABLE');
    }

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  // Signature Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);

  // Show Toast
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // --------------------------------------------------------------------------
  // FETCH DRIVER WORKLOAD
  // --------------------------------------------------------------------------
  const fetchWorkload = async () => {
    setIsLoading(true);
    try {
      // 1. Primary: Authoritative Driver Workload Endpoint
      const res = await fetch(`/api/driver/work?driverId=${selectedDriverId}`, {
        headers: getAuthHeaders(currentUser),
      });

      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary || {
          totalAssigned: 0,
          inCustodyCount: 0,
          awaitingHandoffCount: 0,
          completedCount: 0,
          failedCount: 0,
          totalCodToCollect: 0,
          cashHeldAmount: 0,
          todayCollectedAmount: 0,
        });
        setActiveStops(data.stops || []);
        setInCustodyStops(data.myLoad?.heldInCustody || []);
        setAwaitingHandoffStops(data.myLoad?.awaitingHandoff || []);
        setCompletedStops(data.completedStops || []);
        setFailedStops(data.failedStops || []);
        setCashRecords(data.cashSummary?.recentCollections || []);
        return;
      }

      // 2. Fallback: Query via /api/orders if driver endpoint is in transition
      const fallbackRes = await fetch(`/api/orders?driverId=${selectedDriverId}&limit=100`, {
        headers: getAuthHeaders(currentUser),
      });
      if (fallbackRes.ok) {
        const data = await fallbackRes.json();
        const orders: Order[] = data.orders || [];

        const mappedStops: DriverStop[] = orders.map((o) => ({
          legId: `leg-${o.id}`,
          shipmentId: o.id,
          sequence: o.sequence,
          trackingNumber: o.sequence,
          legType: 'LAST_MILE',
          legStatus: o.status === 'DELIVERED' ? 'COMPLETED' : o.status === 'POSTPONED' ? 'FAILED' : 'IN_TRANSIT',
          shipmentStatus: o.status,
          recipientName: o.recipientName,
          recipientPhone: o.recipientPhone,
          recipientPhoneAlt: o.recipientPhoneAlt,
          governorate: o.governorate,
          area: o.area,
          subArea: o.subArea,
          streetAddress: o.fullAddress,
          locationCoordinates: o.locationCoordinates,
          notes: o.notes,
          paymentType: (o.paymentType as any) || 'COD',
          codAmount: o.totalCollection || 0,
          deliveryAttempts: o.deliveryAttempts || 0,
          custody: {
            currentHolderType: o.status === 'OUT_FOR_DELIVERY' ? 'DRIVER' : 'FACILITY',
            currentDriverId: selectedDriverId,
            isWithCustomer: o.status === 'DELIVERED',
            isInDriverCustody: o.status === 'OUT_FOR_DELIVERY',
            isAtFacility: o.status !== 'OUT_FOR_DELIVERY' && o.status !== 'DELIVERED',
          },
          isEligibleForDelivery: o.status === 'OUT_FOR_DELIVERY',
          isLastMile: true,
        }));

        const active = mappedStops.filter((s) => ['OUT_FOR_DELIVERY', 'PICKING', 'PENDING'].includes(s.shipmentStatus));
        const completed = mappedStops.filter((s) => s.shipmentStatus === 'DELIVERED');
        const failed = mappedStops.filter((s) => ['POSTPONED', 'CANCELLED', 'RETURNED'].includes(s.shipmentStatus));

        const inCustody = active.filter((s) => s.custody.isInDriverCustody);
        const awaiting = active.filter((s) => !s.custody.isInDriverCustody);
        const cashHeld = completed
          .filter((s) => s.paymentType === 'COD')
          .reduce((sum, s) => sum + s.codAmount, 0);

        setSummary({
          totalAssigned: active.length,
          inCustodyCount: inCustody.length,
          awaitingHandoffCount: awaiting.length,
          completedCount: completed.length,
          failedCount: failed.length,
          totalCodToCollect: inCustody.reduce((sum, s) => sum + s.codAmount, 0),
          cashHeldAmount: cashHeld,
          todayCollectedAmount: cashHeld,
        });

        setActiveStops(active);
        setInCustodyStops(inCustody);
        setAwaitingHandoffStops(awaiting);
        setCompletedStops(completed);
        setFailedStops(failed);
      }
    } catch (err) {
      console.error('Failed to load driver workload:', err);
      showToast('خطأ في تحميل بيانات الكابتن', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkload();
  }, [selectedDriverId]);

  // --------------------------------------------------------------------------
  // CANONICAL DELIVERY ACTION (EXECUTE_COMPLETE_CUSTOMER_DELIVERY)
  // --------------------------------------------------------------------------
  const openDeliveryModal = (stop: DriverStop) => {
    if (!stop.custody.isInDriverCustody) {
      showToast('تنبيه: الطرد غير موجود في حوزتك الفعلية بالمركبة، يجب استلامه أولاً من المستودع', 'error');
      return;
    }
    setDeliveryModalStop(stop);
    const initialMethod = stop.paymentType === 'PREPAID' ? 'PREPAID' : stop.paymentType === 'CLIQ' ? 'CLIQ' : 'CASH';
    setPaymentMethod(initialMethod);
    setAmountPaid(initialMethod === 'PREPAID' ? 0 : stop.codAmount);
    setCliqRef('');
    setDeliveryOtp('');
    setDeliveryNotes('');
    setSignatureData(null);
    setDeliveryError(null);
  };

  const handleConfirmDelivery = async () => {
    if (!deliveryModalStop) return;
    setDeliveryError(null);

    // Validation
    if (paymentMethod === 'CLIQ' && !cliqRef.trim()) {
      setDeliveryError('يرجى إدخال الرقم المرجعي لحوالة CliQ البنكية');
      return;
    }

    if (paymentMethod === 'CASH' && amountPaid < deliveryModalStop.codAmount) {
      setDeliveryError(`المبلغ المستلم (${amountPaid} د.أ) أقل من المطلوب (${deliveryModalStop.codAmount} د.أ)`);
      return;
    }

    setIsDelivering(true);
    const idempotencyKey = `deliv-${deliveryModalStop.shipmentId}-${Date.now()}`;

    try {
      const res = await fetch('/api/operational/delivery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          ...getAuthHeaders(currentUser),
        },
        body: JSON.stringify({
          shipmentId: deliveryModalStop.shipmentId,
          legId: deliveryModalStop.legId,
          paymentMethod,
          amountPaid,
          amountExpected: deliveryModalStop.codAmount,
          currency: 'JOD',
          cliqReference: cliqRef.trim() || undefined,
          evidenceOtp: deliveryOtp.trim() || undefined,
          evidenceSignatureUrl: signatureData || undefined,
          notes: deliveryNotes.trim() || undefined,
          idempotencyKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || 'فشل توثيق تسليم الشحنة');
      }

      showToast(`تم تأكيد تسليم الشحنة (${deliveryModalStop.sequence}) بنجاح وتسجيل الدفعة!`, 'success');
      setDeliveryModalStop(null);
      fetchWorkload();
      onOrderUpdated?.();
    } catch (err: any) {
      console.error('Delivery confirmation failed:', err);
      setDeliveryError(err.message || 'فشل توثيق التسليم');
    } finally {
      setIsDelivering(false);
    }
  };

  // --------------------------------------------------------------------------
  // CANONICAL FAILURE ACTION (EXECUTE_RECORD_DELIVERY_FAILURE)
  // --------------------------------------------------------------------------
  const openFailureModal = (stop: DriverStop) => {
    setFailureModalStop(stop);
    setFailureReason('CUSTOMER_UNAVAILABLE');
    setFailureNotes('');
    setFailureError(null);
  };

  const handleConfirmFailure = async () => {
    if (!failureModalStop) return;
    setFailureError(null);
    setIsFailing(true);
    const idempotencyKey = `fail-${failureModalStop.shipmentId}-${Date.now()}`;

    try {
      const res = await fetch('/api/operational/delivery-failure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          ...getAuthHeaders(currentUser),
        },
        body: JSON.stringify({
          shipmentId: failureModalStop.shipmentId,
          legId: failureModalStop.legId,
          reason: failureReason,
          notes: failureNotes.trim() || undefined,
          idempotencyKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || 'فشل تسجيل تعذر التسليم');
      }

      showToast(`تم تسجيل تعذر تسليم الشحنة (${failureModalStop.sequence}) بنجاح`, 'success');
      setFailureModalStop(null);
      fetchWorkload();
      onOrderUpdated?.();
    } catch (err: any) {
      console.error('Failure recording failed:', err);
      setFailureError(err.message || 'فشل تسجيل تعذر التسليم');
    } finally {
      setIsFailing(false);
    }
  };

  // --------------------------------------------------------------------------
  // SIGNATURE CANVAS HANDLERS
  // --------------------------------------------------------------------------
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    isDrawing.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    if (canvasRef.current) {
      setSignatureData(canvasRef.current.toDataURL());
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData(null);
  };

  // --------------------------------------------------------------------------
  // QUICK MESSAGING & MAPS LINKS
  // --------------------------------------------------------------------------
  const getWhatsAppLink = (stop: DriverStop) => {
    let phone = stop.recipientPhone.replace(/[\s-]/g, '');
    if (phone.startsWith('07')) {
      phone = '962' + phone.substring(1);
    }
    const text = encodeURIComponent(
      `السلام عليكم ${stop.recipientName}، معك كابتن التوصيل من شركة ديلفري (Delivere).\n` +
      `لدينا طرد خاص بك رقم [${stop.sequence}] بقيمة تحصيل (${stop.codAmount.toFixed(2)} د.أ).\n` +
      `يرجى تأكيد تواجدك في (${stop.governorate} - ${stop.area}) لاستلام الطلب.`
    );
    return `https://wa.me/${phone}?text=${text}`;
  };

  const getGoogleMapsLink = (stop: DriverStop) => {
    if (stop.locationCoordinates) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.locationCoordinates)}`;
    }
    const query = `${stop.governorate}, ${stop.area}, ${stop.streetAddress || ''}, Jordan`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  };

  // Filter items by search
  const filterList = (list: DriverStop[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (s) =>
        s.sequence.toLowerCase().includes(q) ||
        s.recipientName.toLowerCase().includes(q) ||
        s.recipientPhone.includes(q) ||
        s.area.toLowerCase().includes(q) ||
        s.governorate.toLowerCase().includes(q)
    );
  };

  const filteredActiveStops = filterList(activeStops);
  const priorityStop = filteredActiveStops.length > 0 ? filteredActiveStops[0] : null;
  const remainingStops = filteredActiveStops.length > 1 ? filteredActiveStops.slice(1) : [];

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-16 left-1/2 transform -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-sm font-bold border transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-400'
              : 'bg-rose-600 text-white border-rose-400'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-white" />
          ) : (
            <AlertCircle className="w-5 h-5 text-white" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Driver Identity Card & High Density Header */}
      <div className="bg-slate-900 rounded-3xl p-5 text-white shadow-xl border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xl shadow-md">
              <Car className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                  {t.driver.title}
                </span>
                <span className="text-[10px] text-slate-400">{t.driver.subtitle}</span>
                {locationStatus === 'GRANTED' && (
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                    <Compass className="w-2.5 h-2.5" />
                    <span>GPS Active</span>
                  </span>
                )}
              </div>
              <h1 className="text-lg font-black text-white mt-0.5">
                {currentDriver?.name || 'الكابتن المعتمد'}
              </h1>
              <p className="text-xs text-slate-400">
                {t.driver.vehicle}: {currentDriver?.vehicleType || 'مركبة توزيع'} | {t.driver.plate}: {currentDriver?.vehiclePlate || '12-98432'}
              </p>
            </div>
          </div>

          {/* Authoritative Cash Held Status (On-Demand Refresh) */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <div className="bg-slate-950/80 border border-emerald-500/30 rounded-2xl px-4 py-2 text-right">
              <div className="text-[10px] text-emerald-400 font-medium">{t.driver.cashInHand}</div>
              <div className="text-base font-black text-emerald-400 flex items-center gap-1">
                <span>{summary.cashHeldAmount.toFixed(2)}</span>
                <span className="text-[11px] text-emerald-300">د.أ</span>
              </div>
            </div>

            <button
              onClick={fetchWorkload}
              disabled={isLoading}
              title={t.driver.refreshWorkload}
              className="p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl text-slate-200 transition-all disabled:opacity-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Operational Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5 pt-4 border-t border-slate-800">
          <div className="bg-slate-800/60 rounded-2xl p-2.5 text-center border border-slate-700/50">
            <div className="text-[11px] text-slate-400">{t.driver.inVehicleCustody}</div>
            <div className="text-lg font-black text-amber-400">{summary.inCustodyCount}</div>
          </div>
          <div className="bg-slate-800/60 rounded-2xl p-2.5 text-center border border-slate-700/50">
            <div className="text-[11px] text-slate-400">{t.driver.awaitingDepotRelease}</div>
            <div className="text-lg font-black text-slate-300">{summary.awaitingHandoffCount}</div>
          </div>
          <div className="bg-slate-800/60 rounded-2xl p-2.5 text-center border border-slate-700/50">
            <div className="text-[11px] text-slate-400">{t.driver.deliveredToday}</div>
            <div className="text-lg font-black text-emerald-400">{summary.completedCount}</div>
          </div>
          <div className="bg-slate-800/60 rounded-2xl p-2.5 text-center border border-slate-700/50">
            <div className="text-[11px] text-slate-400">{t.driver.totalCodRemaining}</div>
            <div className="text-lg font-black text-cyan-400">{summary.totalCodToCollect.toFixed(2)} د.أ</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex bg-slate-200/80 p-1.5 rounded-2xl gap-1 overflow-x-auto text-xs font-bold border border-slate-300/60">
        <button
          onClick={() => setActiveTab('STOPS')}
          className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all whitespace-nowrap min-h-[44px] ${
            activeTab === 'STOPS'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <MapPin className="w-4 h-4 text-amber-500" />
          <span>{t.driver.tabActiveStops}</span>
          <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-800 text-[10px]">
            {activeStops.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('MY_LOAD')}
          className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all whitespace-nowrap min-h-[44px] ${
            activeTab === 'MY_LOAD'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Package className="w-4 h-4 text-indigo-500" />
          <span>{t.driver.tabMyLoad}</span>
          <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-800 text-[10px]">
            {inCustodyStops.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('COMPLETED')}
          className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all whitespace-nowrap min-h-[44px] ${
            activeTab === 'COMPLETED'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span>{t.driver.tabCompleted}</span>
          <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-800 text-[10px]">
            {completedStops.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('FAILED')}
          className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all whitespace-nowrap min-h-[44px] ${
            activeTab === 'FAILED'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-rose-500" />
          <span>{t.driver.tabExceptions}</span>
          <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-800 text-[10px]">
            {failedStops.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('CASH')}
          className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all whitespace-nowrap min-h-[44px] ${
            activeTab === 'CASH'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <DollarSign className="w-4 h-4 text-emerald-600" />
          <span>{t.driver.tabCashLedger}</span>
        </button>
      </div>

      {/* Search Filter Input */}
      <div className="relative">
        <Search className="w-4 h-4 absolute right-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t.common.searchPlaceholder}
          className="w-full pl-4 pr-10 py-3 bg-white border border-slate-300 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
        />
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 1: ACTIVE STOPS (HERO PRIORITY CARD + QUEUE) */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'STOPS' && (
        <div className="space-y-4">
          {filteredActiveStops.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 shadow-xs">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
              <h3 className="text-sm font-black text-slate-800">{t.driver.noActiveStops}</h3>
              <p className="text-xs text-slate-500 mt-1">
                {t.driver.noActiveStopsSub}
              </p>
            </div>
          ) : (
            <>
              {/* HERO CARD: PRIORITY #1 STOP */}
              {priorityStop && (
                <div className="bg-gradient-to-br from-amber-50/90 via-white to-slate-50 rounded-3xl p-5 border-2 border-amber-400/80 shadow-md space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-amber-200/60">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full bg-amber-500 text-slate-950 font-black text-xs flex items-center gap-1 shadow-xs">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>{t.driver.priorityStopHeader}</span>
                      </span>
                      <span className="font-mono font-black text-sm text-slate-900">{priorityStop.sequence}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(priorityStop.sequence);
                          showToast('تم نسخ رقم الشحنة');
                        }}
                        title="نسخ رقم الشحنة"
                        className="text-slate-400 hover:text-slate-700 p-1"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Custody Indicator */}
                    {priorityStop.custody.isInDriverCustody ? (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full border border-emerald-300 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        <span>{t.driver.inVehicleCustody}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2.5 py-1 rounded-full border border-amber-300 flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        <span>{t.driver.awaitingDepotRelease}</span>
                      </span>
                    )}
                  </div>

                  {/* Recipient & Location Info */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                    <div>
                      <div className="text-base font-black text-slate-900 flex items-center gap-2">
                        <span>{priorityStop.recipientName}</span>
                        {priorityStop.deliveryAttempts > 0 && (
                          <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-bold">
                            محاولة رقم {priorityStop.deliveryAttempts + 1}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 flex items-center gap-1 mt-1 font-medium">
                        <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          {priorityStop.governorate} - {priorityStop.area} {priorityStop.streetAddress ? `(${priorityStop.streetAddress})` : ''}
                        </span>
                      </div>
                      {priorityStop.notes && (
                        <div className="text-[11px] text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg mt-2 border border-amber-200 font-medium">
                          ملاحظة: {priorityStop.notes}
                        </div>
                      )}
                    </div>

                    {/* Collection Price Pill */}
                    <div className="text-left bg-emerald-50 px-4 py-2.5 rounded-2xl border border-emerald-200">
                      <div className="text-[10px] text-emerald-800 font-bold">{t.driver.requiredCollection}:</div>
                      <div className="text-lg font-black text-emerald-950">
                        {priorityStop.paymentType === 'PREPAID' ? t.driver.prepaid : `${priorityStop.codAmount.toFixed(2)} د.أ`}
                      </div>
                      <div className="text-[9px] text-emerald-700 font-bold">
                        {priorityStop.paymentType === 'COD' ? 'دفع نقدي COD' : priorityStop.paymentType === 'CLIQ' ? 'حوالة CliQ' : 'مدفوع'}
                      </div>
                    </div>
                  </div>

                  {/* Touch Action Buttons Grid (>=44px target) */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                    <a
                      href={`tel:${priorityStop.recipientPhone}`}
                      className="min-h-[44px] py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border border-slate-300/60"
                    >
                      <Phone className="w-4 h-4 text-emerald-600" />
                      <span>{t.driver.call}</span>
                    </a>

                    <a
                      href={getWhatsAppLink(priorityStop)}
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-[44px] py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border border-emerald-200"
                    >
                      <MessageCircle className="w-4 h-4 text-emerald-600" />
                      <span>{t.driver.whatsapp}</span>
                    </a>

                    <a
                      href={getGoogleMapsLink(priorityStop)}
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-[44px] py-2.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border border-indigo-200"
                    >
                      <Navigation className="w-4 h-4 text-indigo-600" />
                      <span>{t.driver.navigate}</span>
                    </a>

                    <button
                      onClick={() => openFailureModal(priorityStop)}
                      className="min-h-[44px] py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-900 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border border-rose-200"
                    >
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      <span>{t.driver.recordFailure}</span>
                    </button>

                    <button
                      onClick={() => openDeliveryModal(priorityStop)}
                      className={`col-span-2 sm:col-span-1 min-h-[44px] py-2.5 px-3 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition-all ${
                        priorityStop.custody.isInDriverCustody
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      <span>{t.driver.confirmDelivery}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* REMAINING QUEUE STOPS */}
              {remainingStops.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-black text-slate-700 px-1">
                    باقي توقفات الجولة ({remainingStops.length})
                  </h4>
                  {remainingStops.map((stop, idx) => (
                    <div
                      key={stop.legId}
                      className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs hover:border-slate-300 transition-all space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-[11px] font-black flex items-center justify-center">
                            {idx + 2}
                          </span>
                          <span className="font-mono font-black text-sm text-slate-900">{stop.sequence}</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(stop.sequence);
                              showToast('تم نسخ رقم الشحنة');
                            }}
                            title="نسخ رقم الشحنة"
                            className="text-slate-400 hover:text-slate-700 p-1"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {stop.custody.isInDriverCustody ? (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            <span>{t.driver.inVehicleCustody}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-2.5 py-1 rounded-full border border-amber-200 flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            <span>{t.driver.awaitingDepotRelease}</span>
                          </span>
                        )}
                      </div>

                      <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                            <span>{stop.recipientName}</span>
                            {stop.deliveryAttempts > 0 && (
                              <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded font-bold">
                                محاولة رقم {stop.deliveryAttempts + 1}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>
                              {stop.governorate} - {stop.area} {stop.streetAddress ? `(${stop.streetAddress})` : ''}
                            </span>
                          </div>
                          {stop.notes && (
                            <div className="text-[11px] text-amber-800 bg-amber-50 px-2 py-1 rounded-lg mt-1.5 border border-amber-200">
                              ملاحظة: {stop.notes}
                            </div>
                          )}
                        </div>

                        <div className="text-left bg-white px-3.5 py-2 rounded-xl border border-slate-200">
                          <div className="text-[10px] text-slate-500 font-bold">{t.driver.requiredCollection}:</div>
                          <div className="text-base font-black text-emerald-700">
                            {stop.paymentType === 'PREPAID' ? t.driver.prepaid : `${stop.codAmount.toFixed(2)} د.أ`}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                        <a
                          href={`tel:${stop.recipientPhone}`}
                          className="min-h-[44px] py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{t.driver.call}</span>
                        </a>

                        <a
                          href={getWhatsAppLink(stop)}
                          target="_blank"
                          rel="noreferrer"
                          className="min-h-[44px] py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border border-emerald-200"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{t.driver.whatsapp}</span>
                        </a>

                        <a
                          href={getGoogleMapsLink(stop)}
                          target="_blank"
                          rel="noreferrer"
                          className="min-h-[44px] py-2.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border border-indigo-200"
                        >
                          <Navigation className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{t.driver.navigate}</span>
                        </a>

                        <button
                          onClick={() => openFailureModal(stop)}
                          className="min-h-[44px] py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border border-rose-200"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                          <span>{t.driver.recordFailure}</span>
                        </button>

                        <button
                          onClick={() => openDeliveryModal(stop)}
                          className={`col-span-2 sm:col-span-1 min-h-[44px] py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition-all ${
                            stop.custody.isInDriverCustody
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          <Check className="w-4 h-4" />
                          <span>{t.driver.confirmDelivery}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 2: MY LOAD & CUSTODY */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'MY_LOAD' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Car className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-black text-slate-900">
                  {t.driver.inVehicleCustody} ({inCustodyStops.length})
                </h3>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                جاهزة للتوصيل الفوري
              </span>
            </div>

            {inCustodyStops.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">لا توجد طرود بحوزتك في المركبة حالياً.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {inCustodyStops.map((s) => (
                  <div key={s.legId} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-mono font-bold text-slate-900">{s.sequence}</div>
                      <div className="text-slate-500">{s.recipientName} - {s.area}</div>
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-emerald-700">{s.codAmount.toFixed(2)} د.أ</div>
                      <span className="text-[10px] text-slate-400 font-medium">{s.paymentType}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-black text-slate-900">
                  {t.driver.awaitingDepotRelease} ({awaitingHandoffStops.length})
                </h3>
              </div>
              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                تتطلب مسح خروج من المنشأة
              </span>
            </div>

            {awaitingHandoffStops.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">تم استلام جميع الطرود المعينة لك من المستودع.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {awaitingHandoffStops.map((s) => (
                  <div key={s.legId} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-mono font-bold text-slate-900">{s.sequence}</div>
                      <div className="text-slate-500">{s.recipientName} - {s.area}</div>
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-slate-700">{s.codAmount.toFixed(2)} د.أ</div>
                      <span className="text-[10px] text-amber-600 font-medium">في المستودع</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 3: COMPLETED STOPS */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'COMPLETED' && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>الشحنات المسلمة بنجاح ({completedStops.length})</span>
            </h3>
          </div>

          {filterList(completedStops).length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">لا توجد شحنات مسلمة مسجلة اليوم.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {filterList(completedStops).map((s) => (
                <div key={s.legId} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-mono font-bold text-slate-900">{s.sequence}</div>
                    <div className="text-slate-600 font-medium">{s.recipientName}</div>
                    <div className="text-[10px] text-slate-400">{s.governorate} - {s.area}</div>
                  </div>
                  <div className="text-left">
                    <div className="font-black text-emerald-700">{s.codAmount.toFixed(2)} د.أ</div>
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold">
                      تم التسليم بنجاح
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 4: FAILED / POSTPONED STOPS */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'FAILED' && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <span>محاولات التسليم المتعذرة ({failedStops.length})</span>
            </h3>
          </div>

          {filterList(failedStops).length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">لا توجد محاولات تسليم متعذرة.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {filterList(failedStops).map((s) => (
                <div key={s.legId} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="font-mono font-bold text-slate-900">{s.sequence}</div>
                    <div className="text-slate-600 font-medium">{s.recipientName} ({s.recipientPhone})</div>
                    <div className="text-[11px] text-rose-700 font-bold mt-1">
                      السبب: {STANDARDIZED_FAILURE_REASONS.find((r) => r.code === s.failureReason)?.labelAr || s.failureReason || 'تعذر التسليم'}
                    </div>
                    {s.failureNotes && <div className="text-[10px] text-slate-500">{s.failureNotes}</div>}
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      onClick={() => openDeliveryModal(s)}
                      className="py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200"
                    >
                      إعادة المحاولة
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 5: CASH & CUSTODY LEDGER */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'CASH' && (
        <div className="space-y-4">
          <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-emerald-400 font-bold">{t.driver.cashInHand}</div>
                <div className="text-3xl font-black text-white mt-1">
                  {summary.cashHeldAmount.toFixed(2)} <span className="text-base text-emerald-300">دينار أردني</span>
                </div>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
                <DollarSign className="w-8 h-8" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-slate-800 text-xs">
              <div>
                <div className="text-slate-400">إجمالي التحصيل اليوم:</div>
                <div className="font-bold text-white text-sm">{summary.todayCollectedAmount.toFixed(2)} د.أ</div>
              </div>
              <div>
                <div className="text-slate-400">حالة التوريد لأمين الصندوق:</div>
                <div className="font-bold text-amber-300 text-sm">
                  {summary.cashHeldAmount > 0 ? 'بانتظار التوريد نهاية الوردية' : 'تمت التسوية بالكامل'}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3">
            <h4 className="text-xs font-black text-slate-900">سجل التحصيلات النقدية الأخيرة</h4>
            {cashRecords.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">{t.driver.noCashRecords}</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {cashRecords.map((c) => (
                  <div key={c.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-800">تحصيل كاش COD</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(c.collected_at).toLocaleTimeString('ar-JO', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="font-black text-emerald-700">+{Number(c.cash_amount).toFixed(2)} د.أ</div>
                      <span className="text-[10px] text-amber-600 font-bold">{c.remittance_status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL: COMPLETE CUSTOMER DELIVERY (CANONICAL RPC) */}
      {/* ---------------------------------------------------------------------- */}
      {deliveryModalStop && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black">
                  <Check className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-emerald-400/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-400/30">
                      توثيق التسليم واستلام المبلغ
                    </span>
                  </div>
                  <h3 className="text-base font-black mt-0.5">
                    تأكيد تسليم الطرد ({deliveryModalStop.sequence})
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setDeliveryModalStop(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
              {deliveryError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{deliveryError}</span>
                </div>
              )}

              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-slate-500">{t.driver.recipient}:</div>
                  <div className="text-sm font-black text-slate-900">{deliveryModalStop.recipientName}</div>
                  <div className="text-slate-400 font-mono text-[11px]">{deliveryModalStop.recipientPhone}</div>
                </div>
                <div className="text-left bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-xl">
                  <div className="text-[10px] text-emerald-700 font-bold">{t.driver.requiredCollection}:</div>
                  <div className="text-lg font-black text-emerald-900">
                    {deliveryModalStop.paymentType === 'PREPAID' ? '0.00 د.أ (مدفوع)' : `${deliveryModalStop.codAmount.toFixed(2)} د.أ`}
                  </div>
                </div>
              </div>

              {deliveryModalStop.paymentType !== 'PREPAID' && (
                <div className="space-y-2">
                  <label className="block font-black text-slate-800">{t.driver.paymentMethod}:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMethod('CASH');
                        setAmountPaid(deliveryModalStop.codAmount);
                      }}
                      className={`p-3 rounded-2xl border text-xs font-black flex items-center justify-center gap-2 transition-all min-h-[44px] ${
                        paymentMethod === 'CASH'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-xs'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>{t.driver.cashCod}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMethod('CLIQ');
                        setAmountPaid(deliveryModalStop.codAmount);
                      }}
                      className={`p-3 rounded-2xl border text-xs font-black flex items-center justify-center gap-2 transition-all min-h-[44px] ${
                        paymentMethod === 'CLIQ'
                          ? 'border-purple-600 bg-purple-50 text-purple-800 shadow-xs'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <Send className="w-4 h-4" />
                      <span>{t.driver.cliqTransfer}</span>
                    </button>
                  </div>
                </div>
              )}

              {paymentMethod === 'CLIQ' && (
                <div className="space-y-1.5 p-3.5 bg-purple-50 rounded-2xl border border-purple-200">
                  <label className="block font-bold text-purple-900">
                    {t.driver.cliqRefPlaceholder}
                  </label>
                  <input
                    type="text"
                    value={cliqRef}
                    onChange={(e) => setCliqRef(e.target.value)}
                    placeholder="مثال: CLIQ-984321 / Ref Number"
                    className="w-full p-2.5 bg-white border border-purple-300 rounded-xl text-xs font-mono font-bold text-purple-950 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-800 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                  <span>{t.driver.deliveryOtp}:</span>
                </label>
                <input
                  type="text"
                  value={deliveryOtp}
                  onChange={(e) => setDeliveryOtp(e.target.value)}
                  placeholder="أدخل رمز التسليم إن توفر كإثبات..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-center tracking-widest focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <PenTool className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{t.driver.recipientSignature}:</span>
                  </label>
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="text-[10px] text-slate-400 hover:text-slate-700 flex items-center gap-1"
                  >
                    <Eraser className="w-3 h-3" />
                    <span>{t.driver.clearSignature}</span>
                  </button>
                </div>
                <div className="border border-slate-300 rounded-2xl bg-slate-50 overflow-hidden touch-none">
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={100}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-24 bg-white cursor-crosshair"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-800">{t.driver.deliveryNotes}:</label>
                <textarea
                  rows={2}
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder="تم استلام المبلغ نقداً والتسليم للعميل باليد..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDeliveryModalStop(null)}
                disabled={isDelivering}
                className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-2xl text-xs transition-all min-h-[44px]"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={handleConfirmDelivery}
                disabled={isDelivering}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 min-h-[44px]"
              >
                {isDelivering ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{t.driver.confirmDeliveryFinal}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL: RECORD DELIVERY FAILURE (CANONICAL RPC) */}
      {/* ---------------------------------------------------------------------- */}
      {failureModalStop && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500 text-slate-950 flex items-center justify-center font-black">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] bg-rose-400/20 text-rose-300 font-bold px-2 py-0.5 rounded-full border border-rose-400/30">
                    توثيق تعذر التسليم
                  </span>
                  <h3 className="text-base font-black mt-0.5">
                    تسجيل محاولة غير مكتملة ({failureModalStop.sequence})
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setFailureModalStop(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {failureError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{failureError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block font-black text-slate-800">{t.driver.failureReason}:</label>
                <select
                  value={failureReason}
                  onChange={(e) => setFailureReason(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:border-rose-500 min-h-[44px]"
                >
                  {STANDARDIZED_FAILURE_REASONS.map((r) => (
                    <option key={r.code} value={r.code}>
                      {language === 'ar' ? r.labelAr : r.labelEn} ({r.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-800">{t.driver.failureNotes}:</label>
                <textarea
                  rows={3}
                  value={failureNotes}
                  onChange={(e) => setFailureNotes(e.target.value)}
                  placeholder="تم الاتصال بالعميل مرتين ولم يتم الرد، تم إرسال رسالة واتساب..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-800 text-[11px] leading-relaxed">
                ملاحظة: تسجيل التعذر يوثق محاولة تسليم رسمية في سجل الشحنة مع بقاء الطرد في حوزتك حتى إعادته للمستودع أو إعادة جدولته.
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFailureModalStop(null)}
                disabled={isFailing}
                className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-2xl text-xs transition-all min-h-[44px]"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmFailure}
                disabled={isFailing}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-2xl text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 min-h-[44px]"
              >
                {isFailing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4" />
                    <span>{t.driver.confirmFailure}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

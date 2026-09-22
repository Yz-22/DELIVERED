import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Scan,
  CheckCircle2,
  AlertCircle,
  Package,
  Truck,
  Building2,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
  UserCheck,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Banknote,
  FileText,
  Lock,
  ChevronRight,
  AlertTriangle,
  Clock,
  MapPin,
  Phone,
  User as UserIcon,
  Layers,
  History,
  Check,
  XCircle,
  ExternalLink,
  Camera,
} from 'lucide-react';
import { User, Order } from '../types/logistics';
import { getAuthHeaders } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { CameraBarcodeScanner } from './CameraBarcodeScanner';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { StatusBadge } from './ui/StatusBadge';
import { Skeleton } from './ui/Skeleton';
import { EmptyState } from './ui/EmptyState';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  drivers: User[];
  currentUser?: User | null;
  onScanSuccess?: () => void;
}

export type CanonicalOperationalAction =
  | 'CONFIRM_MERCHANT_PICKUP'
  | 'CONFIRM_FACILITY_INTAKE'
  | 'CONFIRM_FACILITY_RELEASE'
  | 'COMPLETE_CUSTOMER_DELIVERY'
  | 'RECORD_DELIVERY_FAILURE'
  | 'SEAL_MANIFEST'
  | 'INITIATE_RETURN'
  | 'CONFIRM_CUSTOMER_RETURN_PICKUP'
  | 'CONFIRM_MERCHANT_RETURN_RECEIPT';

export interface OperationalActionRequirements {
  barcodeRequired?: boolean;
  otpRequired?: boolean;
  paymentReferenceRequired?: boolean;
  reasonRequired?: boolean;
  sealNumberRequired?: boolean;
  signatureRequired?: boolean;
  photoRequired?: boolean;
  amountExpected?: number | null;
  paymentType?: string | null;
}

export interface OperationalActionDescriptor {
  action: CanonicalOperationalAction;
  label: string;
  description: string;
  destructive?: boolean;
  requirements: OperationalActionRequirements;
  payloadTemplate: Record<string, any>;
}

export interface IdentificationResponse {
  type: 'SHIPMENT' | 'MANIFEST' | 'UNKNOWN';
  id?: string;
  code: string;
  context?: Record<string, any>;
  availableActions: OperationalActionDescriptor[];
  notes?: string;
}

interface ExecutedLogItem {
  id: string;
  code: string;
  action: CanonicalOperationalAction;
  actionLabel: string;
  timestamp: string;
  status: 'SUCCESS' | 'FAILED';
  message: string;
  recipientName?: string;
  amount?: number;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  drivers,
  currentUser,
  onScanSuccess,
}) => {
  const { direction, language } = useI18n();

  // Input State
  const [barcodeInput, setBarcodeInput] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('');
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // Identification & Action State
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [identifiedEntity, setIdentifiedEntity] = useState<IdentificationResponse | null>(null);
  const [activeAction, setActiveAction] = useState<OperationalActionDescriptor | null>(null);
  const [actionIdempotencyKey, setActionIdempotencyKey] = useState<string>('');

  // Action Form State
  const [targetDriverId, setTargetDriverId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'CLIQ'>('COD');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [failureReason, setFailureReason] = useState<string>('CUSTOMER_UNREACHABLE');
  const [failureNotes, setFailureNotes] = useState<string>('');
  const [sealNumber, setSealNumber] = useState<string>('');
  const [actionOtp, setActionOtp] = useState<string>('');

  // Return Action Form State
  const [returnReason, setReturnReason] = useState<string>('CUSTOMER_REFUSED');
  const [returnNotes, setReturnNotes] = useState<string>('');
  const [merchantSignatureUrl, setMerchantSignatureUrl] = useState<string>('');

  // Feedback State
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [sessionLogs, setSessionLogs] = useState<ExecutedLogItem[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on open
  useEffect(() => {
    if (isOpen) {
      setFeedbackError(null);
      setFeedbackSuccess(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  // Audio feedback synth
  const playBeep = useCallback((isSuccess = true) => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = isSuccess ? 'sine' : 'sawtooth';
      osc.frequency.setValueAtTime(isSuccess ? 1760 : 320, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (isSuccess ? 0.15 : 0.3));

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + (isSuccess ? 0.15 : 0.3));
    } catch {
      // Audio context restricted or unavailable
    }
  }, [soundEnabled]);

  // Identify Barcode (Read-Only Resolver)
  const handleIdentify = async (codeToSearch?: string) => {
    const targetCode = (codeToSearch || barcodeInput).trim();
    if (!targetCode) return;

    setIsIdentifying(true);
    setFeedbackError(null);
    setFeedbackSuccess(null);
    setActiveAction(null);

    try {
      const res = await fetch('/api/operational/identify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(currentUser),
        },
        body: JSON.stringify({
          code: targetCode,
          facilityId: selectedFacilityId || undefined,
        }),
      });

      const data: IdentificationResponse = await res.json();

      if (!res.ok || data.type === 'UNKNOWN') {
        playBeep(false);
        setIdentifiedEntity(data.type === 'UNKNOWN' ? data : null);
        setFeedbackError(data.notes || (data as any).message || 'لم يتم العثور على أي شحنة أو منفست مطابق للرمز');
      } else {
        playBeep(true);
        setIdentifiedEntity(data);

        // Pre-fill form state if only 1 action exists or defaults
        if (data.availableActions.length === 1) {
          selectAction(data.availableActions[0], data);
        } else if (data.availableActions.length > 0) {
          // Default first action
          selectAction(data.availableActions[0], data);
        }
      }
    } catch (err: any) {
      playBeep(false);
      setFeedbackError('تعذر الاتصال بالخادم للتعرف على الرمز');
    } finally {
      setIsIdentifying(false);
    }
  };

  const selectAction = (actionDesc: OperationalActionDescriptor, entityData?: IdentificationResponse | null) => {
    setActiveAction(actionDesc);
    // Generate new idempotency key for distinct new action selection
    const newIdempotencyKey = crypto.randomUUID();
    setActionIdempotencyKey(newIdempotencyKey);

    const entity = entityData || identifiedEntity;
    const ctx = entity?.context || {};

    if (actionDesc.action === 'CONFIRM_FACILITY_RELEASE') {
      setTargetDriverId(ctx.activeLeg?.assignedDriverId || drivers[0]?.id || '');
    } else if (actionDesc.action === 'COMPLETE_CUSTOMER_DELIVERY') {
      const expected = actionDesc.requirements.amountExpected ?? ctx.totalCollection ?? 0;
      setPaymentMethod((ctx.paymentType as any) === 'CLIQ' ? 'CLIQ' : 'COD');
      setAmountPaid(String(expected));
      setPaymentReference('');
    } else if (actionDesc.action === 'RECORD_DELIVERY_FAILURE') {
      setFailureReason('CUSTOMER_UNREACHABLE');
      setFailureNotes('');
    } else if (actionDesc.action === 'SEAL_MANIFEST') {
      setSealNumber(actionDesc.payloadTemplate?.sealNumber || `SEAL-${Math.floor(100000 + Math.random() * 900000)}`);
    }
  };

  // Execute Confirmed Transactional Action
  const handleExecuteAction = async () => {
    if (!identifiedEntity || !activeAction) return;

    setIsExecuting(true);
    setFeedbackError(null);
    setFeedbackSuccess(null);

    // Reuse existing key on retry; generate only if unset
    let idempotencyKey = actionIdempotencyKey;
    if (!idempotencyKey) {
      idempotencyKey = crypto.randomUUID();
      setActionIdempotencyKey(idempotencyKey);
    }
    const ctx = identifiedEntity.context || {};

    try {
      let endpoint = '';
      let payload: Record<string, any> = { ...activeAction.payloadTemplate };

      switch (activeAction.action) {
        case 'CONFIRM_MERCHANT_PICKUP':
          endpoint = '/api/operational/pickup';
          payload = {
            shipmentId: identifiedEntity.id,
            legId: ctx.activeLeg?.id,
            merchantBranchId: ctx.activeLeg?.originMerchantBranchId,
            evidenceBarcode: identifiedEntity.code,
            evidenceOtp: actionOtp || undefined,
            idempotencyKey,
          };
          break;

        case 'CONFIRM_FACILITY_INTAKE':
          endpoint = '/api/operational/intake';
          payload = {
            shipmentId: identifiedEntity.id,
            legId: ctx.activeLeg?.id,
            facilityId: ctx.activeLeg?.destinationFacilityId || selectedFacilityId,
            driverId: ctx.currentCustody?.currentDriverId || ctx.activeLeg?.assignedDriverId,
            evidenceBarcode: identifiedEntity.code,
            idempotencyKey,
          };
          break;

        case 'CONFIRM_FACILITY_RELEASE':
          endpoint = '/api/operational/release';
          payload = {
            shipmentId: identifiedEntity.id,
            legId: ctx.activeLeg?.id,
            facilityId: ctx.activeLeg?.originFacilityId || selectedFacilityId,
            targetDriverId: targetDriverId || ctx.activeLeg?.assignedDriverId,
            evidenceBarcode: identifiedEntity.code,
            idempotencyKey,
          };
          break;

        case 'COMPLETE_CUSTOMER_DELIVERY':
          endpoint = '/api/operational/delivery';
          payload = {
            shipmentId: identifiedEntity.id,
            legId: ctx.activeLeg?.id,
            paymentMethod,
            amountExpected: Number(amountPaid) || 0,
            amountPaid: Number(amountPaid) || 0,
            currency: 'JOD',
            paymentReference: paymentMethod === 'CLIQ' ? paymentReference : undefined,
            evidenceOtp: actionOtp || undefined,
            idempotencyKey,
          };
          break;

        case 'RECORD_DELIVERY_FAILURE':
          endpoint = '/api/operational/delivery-failure';
          payload = {
            shipmentId: identifiedEntity.id,
            legId: ctx.activeLeg?.id,
            reason: failureReason,
            notes: failureNotes || undefined,
            idempotencyKey,
          };
          break;

        case 'SEAL_MANIFEST':
          endpoint = `/api/operational/manifests/${identifiedEntity.id}/seal`;
          payload = {
            sealNumber: sealNumber || `SEAL-${Math.floor(100000 + Math.random() * 900000)}`,
            idempotencyKey,
          };
          break;

        case 'INITIATE_RETURN':
          endpoint = '/api/operational/returns/initiate';
          payload = {
            shipmentId: identifiedEntity.id,
            returnReason: returnReason || activeAction.payloadTemplate?.returnReason || 'CUSTOMER_REFUSED',
            notes: returnNotes || activeAction.payloadTemplate?.notes || undefined,
            destinationMerchantBranchId: activeAction.payloadTemplate?.destinationMerchantBranchId || undefined,
            idempotencyKey,
          };
          break;

        case 'CONFIRM_CUSTOMER_RETURN_PICKUP':
          endpoint = '/api/operational/returns/customer-pickup';
          payload = {
            shipmentId: identifiedEntity.id,
            legId: ctx.activeLeg?.id,
            driverId: ctx.activeLeg?.assignedDriverId || currentUser?.id,
            evidenceBarcode: identifiedEntity.code,
            evidenceOtp: actionOtp || undefined,
            notes: returnNotes || undefined,
            idempotencyKey,
          };
          break;

        case 'CONFIRM_MERCHANT_RETURN_RECEIPT':
          endpoint = '/api/operational/returns/merchant-receipt';
          payload = {
            shipmentId: identifiedEntity.id,
            legId: ctx.activeLeg?.id,
            merchantBranchId: ctx.activeLeg?.destinationMerchantBranchId,
            evidenceBarcode: identifiedEntity.code,
            evidenceSignatureUrl: merchantSignatureUrl || undefined,
            notes: returnNotes || undefined,
            idempotencyKey,
          };
          break;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          ...getAuthHeaders(currentUser),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        playBeep(false);
        const errMsg = data.error?.message || data.message || 'فشلت العملية';
        setFeedbackError(errMsg);

        // Add failed log
        setSessionLogs((prev) => [
          {
            id: idempotencyKey,
            code: identifiedEntity.code,
            action: activeAction.action,
            actionLabel: activeAction.label,
            timestamp: new Date().toLocaleTimeString('ar-JO'),
            status: 'FAILED',
            message: errMsg,
            recipientName: ctx.recipientName,
          },
          ...prev,
        ]);

        // Auto-refresh state to resolve concurrent modifications
        handleIdentify(identifiedEntity.code);
      } else {
        playBeep(true);
        const successMsg = data.message || `تم تنفيذ الإجراء (${activeAction.label}) بنجاح`;
        setFeedbackSuccess(successMsg);

        // Add success log
        setSessionLogs((prev) => [
          {
            id: idempotencyKey,
            code: identifiedEntity.code,
            action: activeAction.action,
            actionLabel: activeAction.label,
            timestamp: new Date().toLocaleTimeString('ar-JO'),
            status: 'SUCCESS',
            message: successMsg,
            recipientName: ctx.recipientName,
            amount: ctx.totalCollection,
          },
          ...prev,
        ]);

        onScanSuccess?.();
        // Clear for next scan
        setBarcodeInput('');
        setIdentifiedEntity(null);
        setActiveAction(null);
        setActionIdempotencyKey('');
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      }
    } catch (err: any) {
      playBeep(false);
      setFeedbackError('خطأ أثناء إرسال المعاملة إلى السيرفر');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleNextScan = () => {
    setBarcodeInput('');
    setIdentifiedEntity(null);
    setActiveAction(null);
    setActionIdempotencyKey('');
    setFeedbackError(null);
    setFeedbackSuccess(null);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const sampleBarcodes = ['ORD-2026-1001', 'ORD-2026-1002', 'ORD-2026-1003', 'ORD-2026-1004'];

  if (!isOpen) return null;

  return (
    <>
      <div dir={direction} className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <div className={`bg-slate-900 text-slate-100 rounded-3xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl border border-slate-800 ${direction === 'rtl' ? 'text-right' : 'text-left'} my-auto animate-in fade-in zoom-in duration-150 max-h-[92vh] flex flex-col`}>
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Scan className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-slate-100">
                    ماسح العمليات اللوجستية الذكي (Scan Anything)
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Phase 3C
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  التعرف الفوري على الطرود والمانفستات وتطبيق حدود المعاملات الذرية
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all min-h-[44px]"
                title="فتح كاميرا الهاتف للمسح الضوئي"
              >
                <Camera className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">الكاميرا</span>
              </button>

              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-2.5 rounded-xl border text-xs flex items-center gap-1 transition-all min-h-[44px] ${
                  soundEnabled
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-slate-800 border-slate-700 text-slate-500'
                }`}
                title={soundEnabled ? 'كتم صوت الصافرة' : 'تفعيل صوت الصافرة'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-200 p-2.5 rounded-xl hover:bg-slate-800 transition-all min-h-[44px]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Body Scrollable */}
          <div className="overflow-y-auto flex-1 py-4 space-y-4 pr-1">
            {/* Scan Input Section */}
            <div className="bg-slate-950 rounded-2xl p-4 text-white shadow-inner border border-slate-800 relative overflow-hidden">
              {/* Viewfinder Laser Beam */}
              <div className="absolute inset-x-4 top-1/2 h-0.5 bg-red-500 shadow-[0_0_12px_#ef4444] opacity-75"></div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleIdentify();
                }}
                className="relative z-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
              >
                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    placeholder="امسح الباركود بجهاز المسح أو الصق الرمز (مثال: ORD-2026-1001)..."
                    className="w-full px-4 py-3 bg-slate-900 border-2 border-slate-700 text-amber-300 placeholder-slate-500 rounded-xl text-sm font-mono font-bold focus:outline-none focus:border-amber-500 focus:bg-slate-900 transition-all min-h-[44px]"
                    disabled={isIdentifying || isExecuting}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={isIdentifying || !barcodeInput.trim()}
                    className="px-5 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 shrink-0 min-h-[44px]"
                  >
                    {isIdentifying ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Scan className="w-4 h-4" />
                        <span>فحص وتعرف</span>
                      </>
                    )}
                  </button>

                  {identifiedEntity && (
                    <button
                      type="button"
                      onClick={handleNextScan}
                      className="px-3 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-1 min-h-[44px]"
                      title="مسح جديد"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </form>

              {/* Quick Testing Barcodes (DEV ONLY) */}
              {Boolean((import.meta as any).env?.DEV) && (
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-400 overflow-x-auto pb-1">
                  <span className="shrink-0 flex items-center gap-1 text-slate-400 text-[11px]">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>رموز سريعة (بيئة التطوير):</span>
                  </span>
                  {sampleBarcodes.map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => {
                        setBarcodeInput(code);
                        handleIdentify(code);
                      }}
                      className="px-2.5 py-0.5 bg-slate-900 hover:bg-slate-800 text-amber-300 font-mono text-[11px] font-bold rounded-lg border border-slate-800 shrink-0 transition-all min-h-[32px]"
                    >
                      {code}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Feedback Alerts */}
            {feedbackError && (
              <div className="p-3.5 bg-rose-950/50 border border-rose-800/80 text-rose-200 rounded-2xl text-xs flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                <span className="font-bold flex-1">{feedbackError}</span>
              </div>
            )}

            {feedbackSuccess && (
              <div className="p-3.5 bg-emerald-950/50 border border-emerald-800/80 text-emerald-200 rounded-2xl text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="font-bold flex-1">{feedbackSuccess}</span>
              </div>
            )}

            {/* Identified Item Card & Multi-Leg State */}
            {identifiedEntity && identifiedEntity.type === 'SHIPMENT' && (
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                {/* Top Details */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-slate-900 font-mono font-bold text-sm text-amber-400 rounded-lg border border-slate-800">
                      {identifiedEntity.code}
                    </span>
                    <span className="text-xs font-bold text-slate-200">
                      {identifiedEntity.context?.recipientName || 'طرد شحنة'}
                    </span>
                    <span className="text-xs text-slate-400">
                      ({identifiedEntity.context?.destinationCity || 'الأردن'})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                      {identifiedEntity.context?.paymentType === 'CLIQ' ? 'تحويل CliQ' : 'الدفع نقداً COD'}
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                      {Number(identifiedEntity.context?.totalCollection || 0).toFixed(2)} د.أ
                    </span>
                  </div>
                </div>

                {/* Custody & Active Leg Badges */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div>
                      <div className="text-[10px] text-slate-400">العهدة الفيزيائية الحالية</div>
                      <div className="font-bold text-slate-200">
                        {identifiedEntity.context?.currentCustody?.currentHolderType === 'DRIVER'
                          ? 'بعهدة الكابتن'
                          : identifiedEntity.context?.currentCustody?.currentHolderType === 'FACILITY'
                        ? 'في المستودع المركزي'
                        : identifiedEntity.context?.currentCustody?.currentHolderType === 'MERCHANT'
                        ? 'لدى المتجر'
                        : 'تم التسليم للزبون'}
                    </div>
                  </div>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    <div className="text-[10px] text-slate-400">المسار النشط (Active Leg)</div>
                    <div className="font-bold text-slate-900">
                      {identifiedEntity.context?.activeLeg
                        ? `${identifiedEntity.context.activeLeg.legType} (${identifiedEntity.context.activeLeg.status})`
                        : 'لا يوجد مسار نشط'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Multi-Leg Journey Visualizer */}
              {identifiedEntity.context?.journey && identifiedEntity.context.journey.length > 0 && (
                <div className="pt-2">
                  <div className="text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5" />
                    <span>مراحل المسار اللوجستي (Journey Legs):</span>
                  </div>
                  <div className="flex items-center gap-1 overflow-x-auto py-1">
                    {identifiedEntity.context.journey.map((leg: any, idx: number) => (
                      <React.Fragment key={leg.id || idx}>
                        <div
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold shrink-0 flex items-center gap-1.5 ${
                            leg.status === 'COMPLETED'
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                              : leg.status === 'IN_TRANSIT'
                              ? 'bg-amber-50 border-amber-300 text-amber-800'
                              : 'bg-white border-slate-200 text-slate-600'
                          }`}
                        >
                          <span>{leg.sequence}.</span>
                          <span>{leg.legType}</span>
                          <span className="text-[9px] opacity-75">({leg.status})</span>
                        </div>
                        {idx < identifiedEntity.context.journey.length - 1 && (
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0 rotate-180" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Selection Buttons */}
              <div className="pt-2">
                <div className="text-xs font-bold text-slate-900 mb-2">
                  العمليات التشغيلية المتاحة وفق العهدة والصلاحية:
                </div>

                {identifiedEntity.availableActions.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      لا توجد عمليات تنفيذية متاحة في الوقت الحالي لهذا الطرد وفق دورك الحالي وحالة العهدة.
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {identifiedEntity.availableActions.map((act) => (
                      <button
                        key={act.action}
                        type="button"
                        onClick={() => selectAction(act)}
                        className={`p-3 rounded-xl border text-right text-xs transition-all flex flex-col gap-1 ${
                          activeAction?.action === act.action
                            ? act.destructive
                              ? 'border-rose-600 bg-rose-50/80 ring-2 ring-rose-500/20 shadow-sm'
                              : 'border-amber-600 bg-amber-50/80 ring-2 ring-amber-500/20 shadow-sm'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <div className="font-bold flex items-center justify-between">
                          <span className={act.destructive ? 'text-rose-900' : 'text-slate-900'}>
                            {act.label}
                          </span>
                          {activeAction?.action === act.action && (
                            <Check className="w-4 h-4 text-amber-600" />
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500">{act.description}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Action Parameter Confirmation Form */}
              {activeAction && (
                <div className="p-4 bg-white rounded-xl border-2 border-amber-400 space-y-3 mt-3">
                  <div className="font-bold text-xs text-amber-950 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-amber-600" />
                    <span>تأكيد بيانات العملية: ({activeAction.label})</span>
                  </div>

                  {/* Facility Release: Pick Driver */}
                  {activeAction.action === 'CONFIRM_FACILITY_RELEASE' && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        تعيين / تأكيد سائق المسار التالي:
                      </label>
                      <select
                        value={targetDriverId}
                        onChange={(e) => setTargetDriverId(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                      >
                        {drivers.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.city || 'سائق معتمد'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Customer Delivery: COD / CliQ & Amount */}
                  {activeAction.action === 'COMPLETE_CUSTOMER_DELIVERY' && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            طريقة الدفع المحصلة:
                          </label>
                          <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value as any)}
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                          >
                            <option value="COD">الدفع نقداً (COD)</option>
                            <option value="CLIQ">تحويل بنكي فوري (CliQ)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            المبلغ المحصل (د.أ):
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={amountPaid}
                            onChange={(e) => setAmountPaid(e.target.value)}
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                          />
                        </div>
                      </div>

                      {paymentMethod === 'CLIQ' && (
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            الرقم المرجعي لتحويل CliQ:
                          </label>
                          <input
                            type="text"
                            value={paymentReference}
                            onChange={(e) => setPaymentReference(e.target.value)}
                            placeholder="أدخل الرقم المرجعي لحوالة كليك..."
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 font-mono"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Delivery Failure: Reason & Notes */}
                  {activeAction.action === 'RECORD_DELIVERY_FAILURE' && (
                    <div className="space-y-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          سبب تعذر التسليم:
                        </label>
                        <select
                          value={failureReason}
                          onChange={(e) => setFailureReason(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                        >
                          <option value="CUSTOMER_UNREACHABLE">الزبون لا يجيب على الهاتف</option>
                          <option value="CUSTOMER_REFUSED">الزبون رفض استلام الطرد</option>
                          <option value="INCORRECT_ADDRESS">العنوان غير صحيح أو غير واضح</option>
                          <option value="CUSTOMER_RESCHEDULED">طلب الزبون تأجيل الموعد</option>
                          <option value="DAMAGED_PARCEL">تلف في الطرد</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          ملاحظات الكابتن:
                        </label>
                        <input
                          type="text"
                          value={failureNotes}
                          onChange={(e) => setFailureNotes(e.target.value)}
                          placeholder="ملاحظات توضيحية إضافية..."
                          className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900"
                        />
                      </div>
                    </div>
                  )}

                  {/* Return Initiation Form */}
                  {activeAction.action === 'INITIATE_RETURN' && (
                    <div className="space-y-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          سبب إرجاع الشحنة:
                        </label>
                        <select
                          value={returnReason}
                          onChange={(e) => setReturnReason(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
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
                          placeholder="ملاحظات توثيقية إضافية لفرع التاجر..."
                          className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900"
                        />
                      </div>
                    </div>
                  )}

                  {/* Customer Return Pickup Form */}
                  {activeAction.action === 'CONFIRM_CUSTOMER_RETURN_PICKUP' && (
                    <div className="space-y-2">
                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>سيتم تأكيد استلام الطرد المرتجع من العميل ونقل العهدة الفيزيائية إلى الكابتن.</span>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          رمز التحقق OTP (إن وجد):
                        </label>
                        <input
                          type="text"
                          value={actionOtp}
                          onChange={(e) => setActionOtp(e.target.value)}
                          placeholder="أدخل رمز التحقق إذا تم إرساله للزبون..."
                          className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          ملاحظات الاستلام:
                        </label>
                        <input
                          type="text"
                          value={returnNotes}
                          onChange={(e) => setReturnNotes(e.target.value)}
                          placeholder="حالة الطرد عند الاستلام من العميل..."
                          className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900"
                        />
                      </div>
                    </div>
                  )}

                  {/* Merchant Return Receipt Form */}
                  {activeAction.action === 'CONFIRM_MERCHANT_RETURN_RECEIPT' && (
                    <div className="space-y-2">
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>معاملة نهائية: تأكيد استلام المتجر للمرتجع وإغلاق دورة حياة الشحنة (RETURNED).</span>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          اسم وتوقيع مستلم الفرع / الرقم المرجعي:
                        </label>
                        <input
                          type="text"
                          value={merchantSignatureUrl}
                          onChange={(e) => setMerchantSignatureUrl(e.target.value)}
                          placeholder="اسم الموظف المستلم في المتجر أو رمز التوقيع..."
                          className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          ملاحظات استلام التاجر:
                        </label>
                        <input
                          type="text"
                          value={returnNotes}
                          onChange={(e) => setReturnNotes(e.target.value)}
                          placeholder="ملاحظات فرع المتجر..."
                          className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900"
                        />
                      </div>
                    </div>
                  )}

                  {/* Execution CTA Button */}
                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleExecuteAction}
                      disabled={isExecuting}
                      className={`px-6 py-2.5 rounded-xl font-bold text-xs text-white shadow-md transition-all flex items-center gap-1.5 ${
                        activeAction.destructive
                          ? 'bg-rose-600 hover:bg-rose-700'
                          : 'bg-emerald-600 hover:bg-emerald-700'
                      }`}
                    >
                      {isExecuting ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>تأكيد وتنفيذ المعاملة الذرية (Commit Transaction)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Identified Manifest Card */}
          {identifiedEntity && identifiedEntity.type === 'MANIFEST' && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-600" />
                  <span className="font-mono font-bold text-sm text-slate-900">
                    {identifiedEntity.code}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900">
                    {identifiedEntity.context?.manifestType}
                  </span>
                </div>

                <span className="text-xs font-bold text-slate-700">
                  الحالة: ({identifiedEntity.context?.status})
                </span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs">
                <div className="font-bold text-slate-900 mb-1">
                  عدد الشحنات في المنفست: {identifiedEntity.context?.itemCount || 0} طرد
                </div>
                <div className="text-slate-500">
                  {identifiedEntity.context?.notes || 'منفست نقل رسمي معتمد'}
                </div>
              </div>

              {identifiedEntity.availableActions.length > 0 && (
                <div className="pt-2">
                  <div className="text-xs font-bold text-slate-900 mb-2">الإجراءات المتاحة للمنفست:</div>
                  {identifiedEntity.availableActions.map((act) => (
                    <div key={act.action} className="p-3 bg-white border-2 border-amber-400 rounded-xl space-y-2">
                      <div className="font-bold text-xs text-amber-950 flex items-center gap-1.5">
                        <Lock className="w-4 h-4 text-amber-600" />
                        <span>{act.label}</span>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          رقم الختم الأمني (Seal Number):
                        </label>
                        <input
                          type="text"
                          value={sealNumber}
                          onChange={(e) => setSealNumber(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900"
                        />
                      </div>
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={handleExecuteAction}
                          disabled={isExecuting}
                          className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                        >
                          {isExecuting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                          <span>تشميع وإغلاق المنفست</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Session Scan Log History */}
          <div className="border-t border-slate-200 pt-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
              <span className="flex items-center gap-1.5">
                <History className="w-4 h-4 text-slate-500" />
                <span>سجل المعاملات المنفذة في هذه الجلسة:</span>
              </span>
              <span className="text-[11px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-600 font-mono">
                {sessionLogs.length} معاملة
              </span>
            </div>

            {sessionLogs.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                لم يتم تنفيذ أي معاملة بعد. امسح الباركود للبدء.
              </div>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                {sessionLogs.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {item.code}
                      </span>
                      <span className="font-semibold text-slate-800">{item.actionLabel}</span>
                      {item.recipientName && (
                        <span className="text-slate-500">({item.recipientName})</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-mono">{item.timestamp}</span>
                      {item.status === 'SUCCESS' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-600" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

      <CameraBarcodeScanner
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onScan={(scannedCode) => {
          setIsCameraOpen(false);
          setBarcodeInput(scannedCode);
          handleIdentify(scannedCode);
        }}
        title="ماسح الكاميرا - Hub Operations"
      />
    </>
  );
};

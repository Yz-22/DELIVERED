import React, { useState, useRef, useEffect } from 'react';
import {
  Scan,
  Barcode,
  Camera,
  CameraOff,
  Plus,
  CheckCircle2,
  AlertCircle,
  Package,
  Sparkles,
  X,
  Volume2,
  VolumeX,
  Layers,
  DollarSign,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Search
} from 'lucide-react';
import { MerchantProduct } from '../types/accounting';
import { formatCurrency } from '../utils/logisticsHelpers';

interface MerchantBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: MerchantProduct[];
  onProductUpdated: () => void;
  onOpenQuickCreate: (scannedBarcode: string) => void;
  merchantId: string;
}

export const MerchantBarcodeScannerModal: React.FC<MerchantBarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  products,
  onProductUpdated,
  onOpenQuickCreate,
  merchantId,
}) => {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [matchedProduct, setMatchedProduct] = useState<MerchantProduct | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isAdjustingStock, setIsAdjustingStock] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Play scanner sound using Web Audio API
  const playBeep = (type: 'success' | 'notfound' = 'success') => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1800, audioCtx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
      }
    } catch (e) {
      // Audio context might be restricted before interaction
    }
  };

  // Handle barcode lookup
  const handleProcessBarcode = (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;

    setLastScannedCode(code);
    const found = products.find(
      (p) => p.barcode === code || p.sku.toLowerCase() === code.toLowerCase()
    );

    if (found) {
      setMatchedProduct(found);
      setIsNotFound(false);
      playBeep('success');
      showToast(`تم العثور على الصنف: ${found.name}`, 'success');
    } else {
      setMatchedProduct(null);
      setIsNotFound(true);
      playBeep('notfound');
    }
    setBarcodeInput('');
  };

  // Handle manual / USB scanner input submit
  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (barcodeInput.trim()) {
      handleProcessBarcode(barcodeInput);
    }
  };

  // Start Camera
  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError('تعذر فتح الكاميرا، يرجى السماح بالوصول أو استخدام القارئ اليدوي.');
      setIsCameraActive(false);
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Quick Stock Adjustment (+1, +5, +10, -1)
  const handleQuickAdjustStock = async (quantityChange: number) => {
    if (!matchedProduct || !merchantId) return;
    setIsAdjustingStock(true);
    try {
      const res = await fetch(`/api/merchants/${merchantId}/warehouse/stock-adjustment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: matchedProduct.id,
          quantityChange,
          type: quantityChange > 0 ? 'IN_PURCHASE' : 'OUT_SALE',
          referenceNumber: 'SCAN-QUICK-' + Date.now().toString().slice(-4),
          notes: `تعديل رصيد سريع عبر مسح الباركود (${quantityChange > 0 ? '+' : ''}${quantityChange})`,
        }),
      });

      if (res.ok) {
        const updatedStock = matchedProduct.stockQuantity + quantityChange;
        setMatchedProduct({ ...matchedProduct, stockQuantity: updatedStock });
        showToast(`تم تحديث رصيد الصنف بنجاح! الرصيد الجديد: ${updatedStock} قطعة`);
        onProductUpdated();
        playBeep('success');
      } else {
        showToast('فشل تحديث الرصيد', 'error');
      }
    } catch (err) {
      showToast('خطأ في الاتصال بالخادم', 'error');
    } finally {
      setIsAdjustingStock(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      stopCamera();
      setMatchedProduct(null);
      setIsNotFound(false);
      setLastScannedCode('');
      setBarcodeInput('');
    }
    return () => stopCamera();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Scan className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black">ماسح الباركود السريع للمخزن</h3>
              <p className="text-[11px] text-slate-400">
                جرد فوري، تعديل كميات، وإضافة سريعة للأصناف الجديدة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                soundEnabled
                  ? 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                  : 'border-slate-700 text-slate-500 hover:text-slate-300'
              }`}
              title={soundEnabled ? 'صوت المسح مفعل' : 'صوت المسح معطل'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Toast */}
          {toast && (
            <div
              className={`p-3 rounded-xl flex items-center gap-2 text-xs font-bold ${
                toast.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600" />
              )}
              <span>{toast.text}</span>
            </div>
          )}

          {/* Scanner Input & Camera Controls */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
            <form onSubmit={handleInputSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Barcode className="w-5 h-5 absolute right-3 top-2.5 text-slate-400" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="وجّه قارئ الباركود أو اكتب الباركود / SKU واضغط Enter..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  className="w-full pr-10 pl-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 shadow-xs"
                />
              </div>

              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
              >
                بحث
              </button>

              <button
                type="button"
                onClick={isCameraActive ? stopCamera : startCamera}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                  isCameraActive
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm'
                }`}
              >
                {isCameraActive ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                <span>{isCameraActive ? 'إيقاف الكاميرا' : 'مسح بالكاميرا'}</span>
              </button>
            </form>

            {/* Camera Viewfinder */}
            {isCameraActive && (
              <div className="relative rounded-2xl overflow-hidden bg-black border-2 border-amber-500 aspect-video max-h-56 flex items-center justify-center">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                {/* Laser animation overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="w-4/5 h-24 border-2 border-dashed border-amber-400/80 rounded-xl relative flex items-center justify-center">
                    <div className="w-full h-0.5 bg-red-500 shadow-[0_0_8px_#ff0000] animate-pulse" />
                    <span className="absolute -bottom-6 text-[10px] text-amber-300 font-bold bg-black/60 px-2 py-0.5 rounded">
                      وجّه الباركود داخل الإطار
                    </span>
                  </div>
                </div>
              </div>
            )}

            {cameraError && (
              <p className="text-[11px] text-rose-600 font-bold bg-rose-50 p-2 rounded-lg border border-rose-200">
                {cameraError}
              </p>
            )}
          </div>

          {/* Result View: 1. MATCHED PRODUCT */}
          {matchedProduct && (
            <div className="bg-white rounded-2xl border-2 border-emerald-500/30 p-4 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 font-bold shrink-0">
                    <Package className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{matchedProduct.name}</span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                        {matchedProduct.category}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-3">
                      <span>باركود: {matchedProduct.barcode}</span>
                      <span>رمز SKU: {matchedProduct.sku}</span>
                      {matchedProduct.locationRack && (
                        <span>الرف: {matchedProduct.locationRack}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-left">
                  <span className="text-[10px] text-slate-400 font-bold block">رصيد المخزن الحالي</span>
                  <span className="text-2xl font-black text-slate-900 font-mono">
                    {matchedProduct.stockQuantity}{' '}
                    <span className="text-xs font-normal text-slate-500">{matchedProduct.unit}</span>
                  </span>
                </div>
              </div>

              {/* Pricing breakdown */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                <div>
                  <span className="text-[10px] text-slate-500 block">سعر التكلفة</span>
                  <span className="text-xs font-black text-slate-800">
                    {formatCurrency(matchedProduct.costPrice)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">سعر البيع</span>
                  <span className="text-xs font-black text-emerald-700">
                    {formatCurrency(matchedProduct.sellingPrice)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">هامش الربح للقطعة</span>
                  <span className="text-xs font-black text-amber-600">
                    {formatCurrency(matchedProduct.sellingPrice - matchedProduct.costPrice)}
                  </span>
                </div>
              </div>

              {/* Quick Actions on Product */}
              <div>
                <span className="block text-xs font-bold text-slate-700 mb-2">
                  تعديل وتوريد سريع للرصيد:
                </span>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    disabled={isAdjustingStock}
                    onClick={() => handleQuickAdjustStock(1)}
                    className="py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200 transition-all cursor-pointer disabled:opacity-50"
                  >
                    +1 توريد
                  </button>
                  <button
                    disabled={isAdjustingStock}
                    onClick={() => handleQuickAdjustStock(5)}
                    className="py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200 transition-all cursor-pointer disabled:opacity-50"
                  >
                    +5 توريد
                  </button>
                  <button
                    disabled={isAdjustingStock}
                    onClick={() => handleQuickAdjustStock(10)}
                    className="py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200 transition-all cursor-pointer disabled:opacity-50"
                  >
                    +10 كرتونة
                  </button>
                  <button
                    disabled={isAdjustingStock}
                    onClick={() => handleQuickAdjustStock(-1)}
                    className="py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-xs rounded-xl border border-rose-200 transition-all cursor-pointer disabled:opacity-50"
                  >
                    -1 سحب / بيع
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Result View: 2. NOT FOUND -> Instant One-Click Create */}
          {isNotFound && (
            <div className="bg-amber-50 rounded-2xl border-2 border-dashed border-amber-300 p-5 text-center space-y-3 animate-in fade-in slide-in-from-top-2">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 mx-auto flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-black text-slate-900 text-sm">
                  هذا الصنف غير مسجل في مستودعك حالياً
                </h4>
                <p className="text-xs text-slate-600 mt-1">
                  الباركود الممسوح:{' '}
                  <span className="font-mono font-bold text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded">
                    {lastScannedCode}
                  </span>
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onOpenQuickCreate(lastScannedCode);
                    onClose();
                  }}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md flex items-center justify-center gap-2 mx-auto cursor-pointer transition-transform active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>إنشاء وإضافة هذا الصنف للمخزن فوراً بنقرة واحدة</span>
                </button>
              </div>
            </div>
          )}

          {/* Quick instructions / tips */}
          {!matchedProduct && !isNotFound && (
            <div className="text-center py-6 text-slate-400 space-y-2">
              <Barcode className="w-12 h-12 mx-auto text-slate-300 stroke-[1.5]" />
              <p className="text-xs font-bold text-slate-600">
                جاهز للمسح عبر قارئ الباركود اللاسلكي / السلكي أو كاميرا الهاتف
              </p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                إذا كان الصنف موجوداً سيتم عرض تفاصيله ورصيده وإمكانية توريده، وإذا لم يكن موجوداً
                ستتمكن من إضافته للمخزن فوراً بلمسة واحدة.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

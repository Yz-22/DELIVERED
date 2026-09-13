import React, { useState, useRef, useEffect } from 'react';
import {
  Scan,
  CheckCircle2,
  AlertCircle,
  Package,
  Truck,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
  UserCheck,
  RefreshCw,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { User, Order } from '../types/logistics';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  drivers: User[];
  onScanSuccess?: () => void;
}

interface ScannedRecord {
  order: Order;
  scannedAt: string;
  action: 'RECEIVE' | 'ASSIGN' | 'DELIVER' | 'RETURN';
  message: string;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  drivers,
  onScanSuccess,
}) => {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanAction, setScanAction] = useState<'RECEIVE' | 'ASSIGN' | 'DELIVER' | 'RETURN'>('RECEIVE');
  const [selectedDriverId, setSelectedDriverId] = useState<string>(drivers[0]?.id || '');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [scannedHistory, setScannedHistory] = useState<ScannedRecord[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus barcode input
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Web Audio synth for barcode scanner beep
  const playBeep = (isSuccess = true) => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = isSuccess ? 'sine' : 'sawtooth';
      osc.frequency.setValueAtTime(isSuccess ? 1800 : 350, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (isSuccess ? 0.12 : 0.25));

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + (isSuccess ? 0.12 : 0.25));
    } catch (e) {
      // Audio context might be restricted before interaction
    }
  };

  const handleScanSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;

    setIsLoading(true);
    setErrorText(null);

    try {
      const res = await fetch('/api/orders/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode: code,
          action: scanAction,
          driverId: scanAction === 'ASSIGN' ? selectedDriverId : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        playBeep(false);
        setErrorText(data.error || 'فشل مسح الباركود');
      } else {
        playBeep(true);
        setScannedHistory((prev) => [
          {
            order: data.order,
            scannedAt: new Date().toLocaleTimeString('ar-JO'),
            action: scanAction,
            message: data.message,
          },
          ...prev,
        ]);
        setBarcodeInput('');
        onScanSuccess?.();
      }
    } catch (err: any) {
      playBeep(false);
      setErrorText('خطأ في الاتصال بالسيرفر');
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  };

  const sampleBarcodes = ['ORD-2026-1001', 'ORD-2026-1002', 'ORD-2026-1003', 'ORD-2026-1004'];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-300 text-right my-8 animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                ماسح الباركود السريع لعمليات المستودع
              </h2>
              <p className="text-xs text-slate-500">
                متوافق مع أجهزة قراءة الباركود اليدوية (Handheld USB/Bluetooth) والإدخال المباشر
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl border text-xs flex items-center gap-1 transition-all ${
                soundEnabled
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-slate-100 border-slate-200 text-slate-400'
              }`}
              title={soundEnabled ? 'كتم صوت الصافرة' : 'تفعيل صوت الصافرة'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Type Selector */}
        <div className="my-4">
          <label className="block text-xs font-bold text-slate-700 mb-2">
            حدد إجراء العملية عند مسح الباركود:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => setScanAction('RECEIVE')}
              className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                scanAction === 'RECEIVE'
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Package className="w-5 h-5 text-indigo-600" />
              <span>استلام بالمستودع</span>
            </button>

            <button
              type="button"
              onClick={() => setScanAction('ASSIGN')}
              className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                scanAction === 'ASSIGN'
                  ? 'border-amber-600 bg-amber-50 text-amber-900 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Truck className="w-5 h-5 text-amber-600" />
              <span>فرز وتكليف سائق</span>
            </button>

            <button
              type="button"
              onClick={() => setScanAction('DELIVER')}
              className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                scanAction === 'DELIVER'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>تأكيد التسليم</span>
            </button>

            <button
              type="button"
              onClick={() => setScanAction('RETURN')}
              className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                scanAction === 'RETURN'
                  ? 'border-rose-600 bg-rose-50 text-rose-900 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <RotateCcw className="w-5 h-5 text-rose-600" />
              <span>استلام مرتجع</span>
            </button>
          </div>
        </div>

        {/* If ASSIGN: Select Driver */}
        {scanAction === 'ASSIGN' && (
          <div className="mb-4 p-3 bg-amber-50/60 rounded-2xl border border-amber-200 flex items-center justify-between gap-3 text-xs">
            <span className="font-bold text-amber-950 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-amber-700" />
              <span>الكابتن المراد تسليمه الطرود:</span>
            </span>
            <select
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              className="p-2 rounded-xl bg-white border border-amber-300 font-bold text-slate-900 text-xs focus:outline-none focus:border-amber-600 flex-1 max-w-xs"
            >
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.city})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Laser Scanner Camera Viewfinder Simulation */}
        <div className="relative bg-slate-950 rounded-2xl p-6 mb-4 text-center overflow-hidden border border-slate-800 shadow-inner">
          {/* Animated Laser Line */}
          <div className="absolute inset-x-4 top-1/2 h-0.5 bg-red-500 shadow-[0_0_12px_#ef4444] animate-pulse"></div>

          {/* Viewfinder corner brackets */}
          <div className="w-48 h-24 mx-auto border-2 border-dashed border-amber-400/60 rounded-xl flex flex-col items-center justify-center text-slate-300 relative">
            <Scan className="w-8 h-8 text-amber-400 opacity-80 mb-1" />
            <span className="text-[11px] font-mono text-amber-300 tracking-wider">
              مرر الباركود أمام القارئ
            </span>
          </div>

          <p className="text-[11px] text-slate-400 mt-3">
            اضغط على حقل الإدخال أدناه أو استخدم قارئ الباركود اللاسلكي مباشرة
          </p>
        </div>

        {/* Barcode Input Form */}
        <form onSubmit={handleScanSubmit} className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="امسح أو اكتب رقم الباركود (مثال: ORD-2026-1001)..."
              className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-300 rounded-2xl text-sm font-mono font-bold focus:outline-none focus:border-amber-500 focus:bg-white transition-all text-slate-900"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !barcodeInput.trim()}
            className="px-6 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-2xl shadow-sm transition-all flex items-center gap-1.5 shrink-0"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Scan className="w-4 h-4" />
                <span>تنفيذ المسح</span>
              </>
            )}
          </button>
        </form>

        {/* Error Alert */}
        {errorText && (
          <div className="mb-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-bold">{errorText}</span>
          </div>
        )}

        {/* Quick Sample Barcodes */}
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-4 overflow-x-auto pb-1">
          <span className="shrink-0 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>تجربة بنقرة واحدة:</span>
          </span>
          {sampleBarcodes.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => {
                setBarcodeInput(code);
                setTimeout(() => {
                  inputRef.current?.focus();
                }, 50);
              }}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono font-bold rounded-lg border border-slate-200 shrink-0 text-[11px] transition-all"
            >
              {code}
            </button>
          ))}
        </div>

        {/* Scanned History of Current Session */}
        <div className="border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
            <span>سجل الطرود الممسوحة في هذه الجلسة:</span>
            <span className="text-[11px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">
              {scannedHistory.length} طرد
            </span>
          </div>

          {scannedHistory.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400">
              لم يتم مسح أي طرد بعد. ابدأ بمسح الباركود أعلاه.
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {scannedHistory.map((item, idx) => (
                <div
                  key={idx}
                  className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {item.order.sequence}
                    </span>
                    <span className="font-semibold text-slate-800">{item.order.recipientName}</span>
                    <span className="text-slate-500">({item.order.governorate})</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-700">
                      {item.order.totalCollection.toFixed(2)} د.أ
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{item.scannedAt}</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

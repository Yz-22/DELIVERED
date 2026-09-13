import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Camera,
  X,
  RefreshCw,
  Flashlight,
  Volume2,
  VolumeX,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  Image as ImageIcon
} from 'lucide-react';

interface CameraBarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
}

// Audio beep synthesizer using Web Audio API
function playScanBeep() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1760, ctx.currentTime); // A6 high note
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch (err) {
    console.debug('AudioContext beep error:', err);
  }
}

export const CameraBarcodeScanner: React.FC<CameraBarcodeScannerProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'مسح باركود السلعة بكاميرا الهاتف',
}) => {
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [scannerInitialized, setScannerInitialized] = useState(false);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const readerElementId = 'html5qr-code-full-region';
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle successful scan
  const handleScanSuccess = useCallback((decodedText: string) => {
    if (!decodedText) return;
    
    // Vibrate if supported
    if (navigator.vibrate) {
      try {
        navigator.vibrate(80);
      } catch {
        // Ignore
      }
    }

    if (soundEnabled) {
      playScanBeep();
    }

    setLastScannedCode(decodedText);
    onScan(decodedText);

    // Briefly show detected code before closing
    setTimeout(() => {
      onClose();
    }, 450);
  }, [onClose, onScan, soundEnabled]);

  // Start Camera
  const startCamera = useCallback(async () => {
    setError(null);
    setIsStarting(true);
    setScannerInitialized(false);

    try {
      // Clean up previous instance if any
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            await html5QrCodeRef.current.stop();
          }
          await html5QrCodeRef.current.clear();
        } catch {
          // ignore
        }
      }

      const qrScanner = new Html5Qrcode(readerElementId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.CODABAR,
        ],
        verbose: false,
      });

      html5QrCodeRef.current = qrScanner;

      const config = {
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          // Optimized rectangular scanning zone for 1D barcodes and QR
          const minDim = Math.min(viewfinderWidth, viewfinderHeight);
          const width = Math.floor(minDim * 0.85);
          const height = Math.floor(minDim * 0.55);
          return { width, height };
        },
        aspectRatio: 1.333,
      };

      await qrScanner.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        () => {
          // frame scan failed, ignore silent frame noise
        }
      );

      setScannerInitialized(true);
      setIsStarting(false);

      // Check for torch capability
      try {
        const track = (qrScanner as unknown as { getRunningTrack?: () => MediaStreamTrack }).getRunningTrack?.();
        if (track) {
          const capabilities = (track as unknown as { getCapabilities?: () => { torch?: boolean } }).getCapabilities?.();
          if (capabilities && 'torch' in capabilities) {
            setHasTorch(true);
          }
        }
      } catch {
        // Torch not supported
      }

    } catch (err: unknown) {
      console.error('Camera initialization error:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('NotAllowedError') || errMsg.includes('Permission')) {
        setError('تم رفض إذن الوصول للكاميرا. يرجى السماح بالوصول للكاميرا من إعدادات المتصفح.');
      } else if (errMsg.includes('NotFoundError') || errMsg.includes('DevicesNotFoundError')) {
        setError('لم يتم العثور على كاميرا متصلة بالجهاز.');
      } else {
        setError('تعذر تشغيل الكاميرا مباشرة. يمكنك اختيار صورة تحتوي على الباركود من الهاتف أو إدخاله يدوياً.');
      }
      setIsStarting(false);
    }
  }, [handleScanSuccess]);

  // Toggle Torch / Flashlight
  const toggleTorch = async () => {
    if (!html5QrCodeRef.current || !hasTorch) return;
    try {
      const track = (html5QrCodeRef.current as unknown as { getRunningTrack?: () => MediaStreamTrack }).getRunningTrack?.();
      if (track) {
        const nextTorch = !torchOn;
        await track.applyConstraints({
          advanced: [{ torch: nextTorch } as MediaTrackConstraintSet],
        });
        setTorchOn(nextTorch);
      }
    } catch (e) {
      console.warn('Torch toggle error:', e);
    }
  };

  // Scan from photo file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !html5QrCodeRef.current) return;
    try {
      setIsStarting(true);
      const decodedResult = await html5QrCodeRef.current.scanFile(file, true);
      handleScanSuccess(decodedResult);
    } catch (err) {
      console.error('File scan error:', err);
      setError('لم يتم التعرف على باركود واضح في الصورة المختارة. يرجى تجربة صورة أوضح.');
      setIsStarting(false);
    }
  };

  // Lifecycle
  useEffect(() => {
    if (isOpen) {
      // Delay slightly for container element to mount in DOM
      const timer = setTimeout(() => {
        startCamera();
      }, 150);
      return () => clearTimeout(timer);
    } else {
      // Cleanup
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            html5QrCodeRef.current.stop().catch(() => {});
          }
          html5QrCodeRef.current.clear();
        } catch {
          // ignore
        }
      }
    }
  }, [isOpen, startCamera]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight text-white">{title}</h3>
              <p className="text-[11px] text-slate-400">يدعم كود باركود السلع 1D وQR Code</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Sound Toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                soundEnabled
                  ? 'bg-slate-800 border-slate-700 text-amber-400'
                  : 'bg-slate-800/50 border-slate-800 text-slate-500'
              }`}
              title={soundEnabled ? 'كتم صوت الرنين' : 'تفعيل صوت الرنين'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Torch Toggle if supported */}
            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                  torchOn
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
                title="تشغيل كشاف الهاتف"
              >
                <Flashlight className="w-4 h-4" />
              </button>
            )}

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Camera Viewport Container */}
        <div className="relative bg-black flex-1 min-h-[300px] flex items-center justify-center overflow-hidden">
          {/* HTML5 QR Container */}
          <div
            id={readerElementId}
            className="w-full h-full [&>video]:w-full [&>video]:h-full [&>video]:object-cover"
          />

          {/* Loading Overlay */}
          {isStarting && (
            <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center text-white space-y-3 p-4 text-center z-20">
              <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
              <p className="text-xs font-bold text-slate-200">جاري فتح كاميرا الهاتف للماسح...</p>
              <p className="text-[11px] text-slate-400">يرجى التأكد من الموافقة على إذن الكاميرا</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center text-white space-y-3 p-6 text-center z-30">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-rose-300 max-w-xs leading-relaxed">{error}</p>
              
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>إعادة المحاولة</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs rounded-xl flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                  <span>مسح من صورة</span>
                </button>
              </div>
            </div>
          )}

          {/* Scanning Reticle & Animated Laser Line (Active when scanning) */}
          {scannerInitialized && !error && !lastScannedCode && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6 z-10">
              {/* Central Target Box */}
              <div className="relative w-64 h-36 sm:w-72 sm:h-40 border-2 border-amber-400/70 rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.25)] flex items-center justify-center overflow-hidden">
                {/* Corner Markers */}
                <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
                <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-amber-400 rounded-br-lg" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-amber-400 rounded-bl-lg" />

                {/* Animated Laser Scan Bar */}
                <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_#ef4444] animate-bounce" />

                <span className="text-[10px] font-mono text-amber-300/80 bg-black/40 px-2 py-0.5 rounded backdrop-blur-xs">
                  ضع الباركود داخل الإطار
                </span>
              </div>
            </div>
          )}

          {/* Success Flash Overlay */}
          {lastScannedCode && (
            <div className="absolute inset-0 bg-emerald-950/80 flex flex-col items-center justify-center text-white space-y-2 p-4 text-center z-40 animate-in fade-in zoom-in-95">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce" />
              <p className="text-sm font-black text-emerald-300">تم مسح الباركود بنجاح!</p>
              <div className="px-3 py-1 bg-emerald-900/60 border border-emerald-500/40 rounded-xl font-mono text-xs text-white">
                {lastScannedCode}
              </div>
            </div>
          )}
        </div>

        {/* Footer info & alternative actions */}
        <div className="p-4 bg-slate-900/90 border-t border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>يتم التعرف وإدراج الصنف تلقائياً فور توجيه الكاميرا</span>
            </div>

            {/* Hidden file input for photo scanning */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-[11px] text-amber-400 hover:text-amber-300 underline underline-offset-2 flex items-center gap-1 cursor-pointer"
            >
              <ImageIcon className="w-3 h-3" />
              <span>اختيار صورة باركود</span>
            </button>
          </div>

          <p className="text-[10px] text-slate-500 text-center">
            ملاحظة: تدعم هذه الشاشة أيضاً أجهزة كشف الباركود اليدوية (USB / Bluetooth Barcode Scanners).
          </p>
        </div>
      </div>
    </div>
  );
};

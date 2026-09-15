import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  KeyRound,
  PenTool,
  Camera,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  DollarSign,
  Eraser,
  Upload
} from 'lucide-react';
import { Order } from '../types/logistics';

interface PodVerificationModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const PodVerificationModal: React.FC<PodVerificationModalProps> = ({
  order,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [otp, setOtp] = useState('');
  const [bypassOtp, setBypassOtp] = useState(false);
  const [bypassNote, setBypassNote] = useState('');
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [smsSentNotice, setSmsSentNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setOtp('');
      setBypassOtp(false);
      setBypassNote('');
      setSignatureData(null);
      setPhotoData(null);
      setError(null);
      setSmsSentNotice(null);
    }
  }, [isOpen]);

  // Handle Canvas Drawing for Signature
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

  // Trigger Send SMS
  const handleSendSms = async () => {
    if (!order) return;
    setIsSendingSms(true);
    setSmsSentNotice(null);
    try {
      const res = await fetch(`/api/orders/${order.id}/send-sms`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSmsSentNotice(`تم إرسال رسالة SMS تتضمن الرمز (${order.deliveryOtp}) إلى هاتف العميل`);
      }
    } catch (err) {
      setError('فشل إرسال الرسالة النصية');
    } finally {
      setIsSendingSms(false);
    }
  };

  // Submit Final POD Verification
  const handleConfirmDelivery = async () => {
    if (!order) return;
    setError(null);

    if (!bypassOtp && (!otp || otp.trim().length < 4)) {
      setError('يرجى إدخال رمز الاستلام السري (OTP) المكون من 4 أرقام أو تفعيل خيار التجاوز');
      return;
    }

    if (bypassOtp && !bypassNote.trim()) {
      setError('يرجى كتابة سبب التجاوز اليدوي للرمز');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/verify-pod`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          otp: otp.trim(),
          bypassOtp,
          driverNote: bypassNote,
          signature: signatureData || undefined,
          photo: photoData || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        setError(data.error || 'فشل توثيق التسليم');
      }
    } catch (err) {
      setError('خطأ في الاتصال بالخادم');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-md">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-emerald-400/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-400/30">
                  توثيق التسليم الذكي POD
                </span>
                <span className="text-[10px] text-slate-400">Electronic Proof of Delivery</span>
              </div>
              <h3 className="text-base sm:text-lg font-black mt-0.5">
                تأكيد تسليم الطرد رقم ({order.sequence})
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* Order Summary Pill */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500">العميل المستلم:</div>
              <div className="text-sm font-black text-slate-900">{order.recipientName}</div>
              <div className="text-[11px] text-slate-500 font-mono">{order.recipientPhone}</div>
            </div>
            <div className="text-left bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
              <div className="text-[10px] text-emerald-700 font-bold">المبلغ المطلوب استلامه:</div>
              <div className="text-lg font-black text-emerald-900">
                {order.totalCollection.toFixed(2)} د.أ
              </div>
            </div>
          </div>

          {/* Section 1: Delivery OTP */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-amber-500" />
                <span>رمز التحقق السري للاستلام (Delivery OTP):</span>
              </label>

              <button
                type="button"
                onClick={handleSendSms}
                disabled={isSendingSms}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-200 transition-colors"
              >
                <MessageSquare className="w-3 h-3" />
                <span>{isSendingSms ? 'جاري الإرسال...' : 'إرسال الرمز للعميل'}</span>
              </button>
            </div>

            {smsSentNotice && (
              <div className="text-[11px] text-emerald-700 bg-emerald-50 p-2 rounded-xl border border-emerald-200 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                <span>{smsSentNotice}</span>
              </div>
            )}

            {!bypassOtp ? (
              <div>
                <input
                  type="text"
                  maxLength={4}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="أدخل الرمز (4 أرقام)"
                  className="w-full text-center tracking-[1em] text-2xl font-black p-3 bg-slate-50 border-2 border-slate-300 focus:border-emerald-500 rounded-2xl focus:outline-none"
                />
                <div className="flex items-center justify-between mt-1.5 px-1">
                  <span className="text-[11px] text-slate-400">
                    رمز هذا الطرد للتجربة السريعة: <strong className="text-amber-600 font-mono">{order.deliveryOtp || '4821'}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setBypassOtp(true)}
                    className="text-[11px] text-slate-500 hover:text-rose-600 underline"
                  >
                    تجاوز الرمز يدوياً
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 bg-amber-50/70 p-3 rounded-xl border border-amber-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900">تجاوز الرمز يدوياً (موافقة الكابتن)</span>
                  <button
                    type="button"
                    onClick={() => setBypassOtp(false)}
                    className="text-[11px] text-slate-600 hover:text-slate-900 underline font-bold"
                  >
                    الرجوع لإدخال الرمز
                  </button>
                </div>
                <input
                  type="text"
                  value={bypassNote}
                  onChange={(e) => setBypassNote(e.target.value)}
                  placeholder="سبب التجاوز (مثال: هاتف العميل مغلق واستلم بنفسه، هاتف بديل...)"
                  className="w-full text-xs p-2 bg-white border border-amber-300 rounded-xl focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Section 2: Recipient Digital Signature */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <PenTool className="w-4 h-4 text-indigo-600" />
                <span>توقيع العميل المستلم باللمس (Touch Signature):</span>
              </label>
              {signatureData && (
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="text-[10px] text-rose-600 hover:text-rose-800 flex items-center gap-0.5 font-bold"
                >
                  <Eraser className="w-3 h-3" />
                  <span>مسح التوقيع</span>
                </button>
              )}
            </div>

            <div className="border-2 border-dashed border-slate-300 rounded-2xl overflow-hidden bg-slate-50 relative h-28 touch-none">
              <canvas
                ref={canvasRef}
                width={440}
                height={112}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-full cursor-crosshair"
              />
              {!signatureData && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-xs text-slate-400 font-bold">
                  وقّع هنا بالإصبع أو القلم...
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Photo Proof (Optional / Doorstep) */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-2">
            <label className="text-xs font-black text-slate-900 flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-slate-600" />
              <span>صورة إثبات التسليم (اختياري - عند الباب أو واجهة المنزل):</span>
            </label>

            {photoData ? (
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 p-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src={photoData} alt="POD" className="w-10 h-10 object-cover rounded-lg border border-slate-300" />
                  <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>تم إرفاق صورة إثبات التسليم الحقيقية</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPhotoData(null)}
                  className="text-xs text-rose-600 hover:underline font-bold"
                >
                  إزالة
                </button>
              </div>
            ) : (
              <label className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl text-xs text-slate-700 font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer">
                <Camera className="w-3.5 h-3.5 text-slate-500" />
                <span>التقاط صورة بكاميرا الهاتف أو اختيار صورة الطرد</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = () => {
                        if (typeof reader.result === 'string') {
                          setPhotoData(reader.result);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
            )}
          </div>

          {error && (
            <div className="bg-rose-50 text-rose-800 border border-rose-200 p-3 rounded-2xl text-xs flex items-center gap-2 font-bold">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors"
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={handleConfirmDelivery}
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSubmitting ? 'جاري الاعتماد...' : 'تأكيد التسليم واستلام النقد'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

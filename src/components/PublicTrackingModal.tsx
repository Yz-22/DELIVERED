import React, { useState } from 'react';
import {
  Search,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  User,
  AlertCircle,
  X,
  RefreshCw,
  Building2,
  Calendar,
  DollarSign
} from 'lucide-react';
import { Order, OrderStatus } from '../types/logistics';

interface PublicTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTrackingNumber?: string;
}

export const PublicTrackingModal: React.FC<PublicTrackingModalProps> = ({
  isOpen,
  onClose,
  initialTrackingNumber = '',
}) => {
  const [queryInput, setQueryInput] = useState(initialTrackingNumber || 'ORD-2026-1001');
  const [trackedOrder, setTrackedOrder] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = queryInput.trim();
    if (!q) return;

    setIsLoading(true);
    setErrorText(null);
    setTrackedOrder(null);

    try {
      const res = await fetch(`/api/orders/track/${encodeURIComponent(q)}`);
      const data = await res.json();

      if (!res.ok) {
        setErrorText(data.error || 'لم يتم العثور على أي شحنة مطابقة');
      } else {
        setTrackedOrder(data);
      }
    } catch (err) {
      setErrorText('حدث خطأ في جلب بيانات التتبع');
    } finally {
      setIsLoading(false);
    }
  };

  // Determine Stepper step (1 to 4)
  const getStepNumber = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING':
        return 1;
      case 'PICKING':
      case 'RECEIVED_AT_HUB':
        return 2;
      case 'OUT_FOR_DELIVERY':
      case 'POSTPONED':
        return 3;
      case 'DELIVERED':
        return 4;
      default:
        return 2;
    }
  };

  const steps = [
    { num: 1, title: 'تم استلام الطلب', desc: 'تم تسجيل الشحنة من المتجر' },
    { num: 2, title: 'في مستودع الفرز', desc: 'وصلت مستودع الفرز الرئيسي (عمان)' },
    { num: 3, title: 'مع كابتن التوصيل', desc: 'خرجت للتوصيل إلى عنوان العميل' },
    { num: 4, title: 'تم التسليم بنجاح', desc: 'تم استلام الطرد وتأكيد التحصيل' },
  ];

  const currentStep = trackedOrder ? getStepNumber(trackedOrder.status) : 1;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-300 text-right my-8 animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 font-bold">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                بوابة تتبع الشحنات المباشرة للزبائن
              </h2>
              <p className="text-xs text-slate-500">
                DarGo Customer Tracking Portal - تتبع مسار طردك لحظة بلحظة
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="my-5 flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="أدخل رقم البوليصة (مثل ORD-2026-1001) أو رقم هاتفك..."
              className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:border-amber-500"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !queryInput.trim()}
            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs rounded-2xl shadow-sm transition-all flex items-center gap-2 shrink-0"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Search className="w-4 h-4 text-amber-400" />
                <span>تتبع الآن</span>
              </>
            )}
          </button>
        </form>

        {/* Error Alert */}
        {errorText && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-bold">{errorText}</span>
          </div>
        )}

        {/* Tracked Order Result */}
        {trackedOrder && (
          <div className="space-y-6">
            {/* Status Summary Banner */}
            <div className="bg-gradient-to-l from-slate-900 to-slate-800 rounded-2xl p-4 sm:p-5 text-white shadow-md border border-slate-700">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>رقم الشحنة:</span>
                    <span className="font-mono font-bold text-amber-400 text-sm">
                      {trackedOrder.sequence}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white mt-1">
                    المستلم: {trackedOrder.recipientName}
                  </h3>
                  <p className="text-xs text-slate-300">
                    المتجر المصدر: <strong>{trackedOrder.merchantName}</strong>
                  </p>
                </div>

                <div className="text-left bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                  <div className="text-[11px] text-slate-400">المبلغ المطلوب عند الاستلام</div>
                  <div className="text-lg font-black text-amber-400">
                    {trackedOrder.totalCollection.toFixed(2)}{' '}
                    <span className="text-xs font-normal text-slate-300">د.أ</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Stepper */}
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
              <h4 className="text-xs font-bold text-slate-700 mb-4">مسار توصيل الشحنة:</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 relative">
                {steps.map((step) => {
                  const isDone = currentStep >= step.num;
                  const isCurrent = currentStep === step.num;

                  return (
                    <div
                      key={step.num}
                      className={`p-3 rounded-2xl border text-right transition-all ${
                        isDone
                          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                          : 'bg-white border-slate-200 text-slate-400 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            isDone
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          {isDone ? <CheckCircle2 className="w-4 h-4" /> : step.num}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] bg-amber-500 text-slate-950 font-bold px-1.5 py-0.5 rounded">
                            الحالة الحالية
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-bold text-slate-900">{step.title}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{step.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Details Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white rounded-2xl border border-slate-200 space-y-2">
                <div className="font-bold text-slate-800 flex items-center gap-1.5 border-b pb-1.5 border-slate-100">
                  <MapPin className="w-4 h-4 text-rose-500" />
                  <span>عنوان التوصيل</span>
                </div>
                <div>
                  <span className="text-slate-500">الوجهة: </span>
                  <span className="font-bold text-slate-900">
                    {trackedOrder.governorate} - {trackedOrder.area}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">تفاصيل العنوان: </span>
                  <span className="text-slate-800">{trackedOrder.fullAddress}</span>
                </div>
              </div>

              <div className="p-3 bg-white rounded-2xl border border-slate-200 space-y-2">
                <div className="font-bold text-slate-800 flex items-center gap-1.5 border-b pb-1.5 border-slate-100">
                  <Truck className="w-4 h-4 text-amber-600" />
                  <span>معلومات كابتن التوصيل</span>
                </div>
                <div>
                  <span className="text-slate-500">اسم السائق: </span>
                  <span className="font-bold text-slate-900">{trackedOrder.driverName}</span>
                </div>
                {trackedOrder.driverPhone && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-slate-500">هاتف الكابتن:</span>
                    <a
                      href={`tel:${trackedOrder.driverPhone}`}
                      className="px-2.5 py-1 bg-emerald-50 text-emerald-800 font-mono font-bold rounded-lg border border-emerald-200 flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3 text-emerald-600" />
                      <span>{trackedOrder.driverPhone}</span>
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Timeline Events / Status Logs */}
            {trackedOrder.statusLogs && trackedOrder.statusLogs.length > 0 && (
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                <h4 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>سجل حركات الشحنة الرسمية:</span>
                </h4>
                <div className="space-y-2">
                  {trackedOrder.statusLogs.map((log: any, i: number) => (
                    <div
                      key={i}
                      className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span className="font-semibold text-slate-800">{log.note}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(log.createdAt).toLocaleString('ar-JO')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

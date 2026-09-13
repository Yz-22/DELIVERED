import React, { useState, useEffect } from 'react';
import {
  X,
  Navigation,
  Compass,
  MapPin,
  TrendingDown,
  Clock,
  Car,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Sparkles,
  AlertCircle,
  Phone
} from 'lucide-react';
import { User, Order } from '../types/logistics';

interface RouteOptimizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  drivers: User[];
  defaultDriverId?: string;
  onAppliedOptimization?: () => void;
}

interface OptimizedStop {
  stopIndex: number;
  orderId: string;
  sequence: string;
  recipientName: string;
  recipientPhone: string;
  governorate: string;
  area: string;
  fullAddress: string;
  totalCollection: number;
  notes?: string;
}

export const RouteOptimizerModal: React.FC<RouteOptimizerModalProps> = ({
  isOpen,
  onClose,
  drivers,
  defaultDriverId,
  onAppliedOptimization,
}) => {
  const [selectedDriverId, setSelectedDriverId] = useState<string>(
    defaultDriverId || drivers[0]?.id || ''
  );
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<{
    message: string;
    stopCount: number;
    estimatedKm: number;
    estimatedTimeMins: number;
    savedKmPercent: number;
    googleMapsRouteUrl: string;
    stops: OptimizedStop[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appliedSuccess, setAppliedSuccess] = useState(false);

  useEffect(() => {
    if (defaultDriverId) {
      setSelectedDriverId(defaultDriverId);
    }
  }, [defaultDriverId]);

  if (!isOpen) return null;

  const currentDriver = drivers.find((d) => d.id === selectedDriverId) || drivers[0];

  const handleRunOptimization = async () => {
    setIsOptimizing(true);
    setError(null);
    setAppliedSuccess(false);

    try {
      const res = await fetch('/api/routes/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: selectedDriverId }),
      });

      const data = await res.json();
      if (res.ok) {
        setOptimizationResult(data);
        setAppliedSuccess(true);
        onAppliedOptimization?.();
      } else {
        setError(data.error || 'فشل تشغيل تحسين المسار');
      }
    } catch (err) {
      setError('خطأ في الاتصال بالخادم');
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shadow">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-amber-400/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-400/30">
                  خوارزمية الذكاء الجغرافي
                </span>
                <span className="text-[10px] text-slate-300">Smart Route Dispatcher</span>
              </div>
              <h3 className="text-base sm:text-lg font-black mt-0.5">
                توجيه وترتيب مسارات التوصيل الذكية للكباتن
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {/* Driver Selection & Trigger */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="w-full sm:w-auto">
              <label className="text-xs font-bold text-slate-600 block mb-1">
                اختر الكابتن لترتيب مسار ورديته:
              </label>
              <select
                value={selectedDriverId}
                onChange={(e) => {
                  setSelectedDriverId(e.target.value);
                  setOptimizationResult(null);
                  setError(null);
                }}
                className="bg-white text-slate-900 font-bold text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-600 w-full sm:w-64"
              >
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.city})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleRunOptimization}
              disabled={isOptimizing}
              className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>{isOptimizing ? 'جاري التحليل الجغرافي...' : 'تشغيل خوارزمية التوجيه الأمثل'}</span>
            </button>
          </div>

          {error && (
            <div className="bg-rose-50 text-rose-800 border border-rose-200 p-3 rounded-2xl text-xs flex items-center gap-2 font-bold">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Results Summary */}
          {optimizationResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3 text-center">
                  <div className="text-[11px] text-indigo-700 font-bold">محطات التوقف</div>
                  <div className="text-xl font-black text-indigo-950 mt-0.5">
                    {optimizationResult.stopCount} محطة
                  </div>
                </div>

                <div className="bg-slate-100 border border-slate-200 rounded-2xl p-3 text-center">
                  <div className="text-[11px] text-slate-600 font-bold">المسافة المقدرة</div>
                  <div className="text-xl font-black text-slate-900 mt-0.5">
                    {optimizationResult.estimatedKm} كم
                  </div>
                </div>

                <div className="bg-slate-100 border border-slate-200 rounded-2xl p-3 text-center">
                  <div className="text-[11px] text-slate-600 font-bold">الوقت المتوقع</div>
                  <div className="text-xl font-black text-slate-900 mt-0.5">
                    {Math.floor(optimizationResult.estimatedTimeMins / 60)} س و {optimizationResult.estimatedTimeMins % 60} د
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-center">
                  <div className="text-[11px] text-emerald-700 font-bold flex items-center justify-center gap-1">
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>توفير الوقود</span>
                  </div>
                  <div className="text-xl font-black text-emerald-700 mt-0.5">
                    -{optimizationResult.savedKmPercent}%
                  </div>
                </div>
              </div>

              {appliedSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-2xl text-xs flex items-center justify-between font-bold">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>تم تطبيق هذا الترتيب الذكي على تطبيق الكابتن فوراً بحسب الأقرب جغرافياً!</span>
                  </div>
                  <a
                    href={optimizationResult.googleMapsRouteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-black shadow-sm hover:bg-emerald-700"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>فتح المسار في Google Maps</span>
                  </a>
                </div>
              )}

              {/* Stop-by-stop Timeline list */}
              <div>
                <h4 className="text-xs font-black text-slate-800 mb-2.5 flex items-center gap-2">
                  <Compass className="w-4 h-4 text-indigo-600" />
                  <span>التسلسل الميداني الموصى به لمحطات التوقف (Stop Sequence):</span>
                </h4>

                <div className="space-y-2">
                  {optimizationResult.stops.map((stop) => (
                    <div
                      key={stop.orderId}
                      className="bg-white border border-slate-200 hover:border-indigo-400 rounded-2xl p-3 flex items-center justify-between gap-3 transition-colors shadow-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-xl bg-slate-900 text-amber-400 font-black text-xs flex items-center justify-center shrink-0">
                          #{stop.stopIndex}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-xs">
                              {stop.recipientName}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">
                              ({stop.sequence})
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                            <span>
                              {stop.governorate}، {stop.area} - {stop.fullAddress}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-left shrink-0">
                        <div className="font-black text-xs text-slate-900">
                          {stop.totalCollection} د.أ
                        </div>
                        <a
                          href={`tel:${stop.recipientPhone}`}
                          className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5 justify-end mt-0.5"
                        >
                          <Phone className="w-2.5 h-2.5" />
                          <span>{stop.recipientPhone}</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!optimizationResult && !error && (
            <div className="py-10 text-center text-slate-400">
              <Compass className="w-12 h-12 mx-auto text-slate-300 mb-2 animate-spin-slow" />
              <p className="text-xs font-bold text-slate-600">
                اضغط على "تشغيل خوارزمية التوجيه الأمثل" لحساب أقصر مسار وترتيب مهام الكابتن تلقائياً
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                تعتمد الخوارزمية على التجمع المكاني للمناطق والأحياء في الأردن لتقليل استهلاك المحروقات والوقت.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

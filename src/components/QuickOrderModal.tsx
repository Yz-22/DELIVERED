import React, { useState } from 'react';
import { X, Zap, ArrowLeft } from 'lucide-react';
import { User } from '../types/logistics';
import { GOVERNORATES } from '../utils/logisticsHelpers';

interface QuickOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  merchants: User[];
}

export const QuickOrderModal: React.FC<QuickOrderModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  merchants,
}) => {
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [governorate, setGovernorate] = useState('عمان');
  const [area, setArea] = useState('');
  const [totalCollection, setTotalCollection] = useState('25');
  const [deliveryFee, setDeliveryFee] = useState('3.0');
  const [merchantId, setMerchantId] = useState(merchants[0]?.id || '');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName || !recipientPhone || !area) {
      alert('يرجى ملء اسم المستلم، رقم الهاتف، والمنطقة');
      return;
    }
    onSubmit({
      recipientName,
      recipientPhone,
      governorate,
      area,
      totalCollection: parseFloat(totalCollection) || 25,
      deliveryFee: parseFloat(deliveryFee) || 3,
      merchantId: merchantId || merchants[0]?.id,
      notes,
    });
    // Reset form
    setRecipientName('');
    setRecipientPhone('');
    setArea('');
    setNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-amber-500 text-slate-950 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-950 text-amber-400 flex items-center justify-center">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">إنشاء طلبية سريعة</h3>
              <p className="text-xs text-slate-900/80">
                تسجيل فوري خلال 15 ثانية للطلبات العاجلة والمكالمات الهاتفية
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-950 hover:bg-slate-950/10 p-1.5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                اسم المستلم *
              </label>
              <input
                type="text"
                required
                placeholder="مثال: أحمد عبد الله"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:ring-2 focus:ring-amber-500"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                رقم الهاتف (للواتساب) *
              </label>
              <input
                type="tel"
                required
                placeholder="079XXXXXXX"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:ring-2 focus:ring-amber-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">المحافظة</label>
              <select
                value={governorate}
                onChange={(e) => setGovernorate(e.target.value)}
                className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:ring-2 focus:ring-amber-500"
              >
                {GOVERNORATES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                المنطقة / الحي *
              </label>
              <input
                type="text"
                required
                placeholder="مثال: الصويفية، شارع باريس"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-amber-50/60 p-3 rounded-xl border border-amber-200/80">
            <div>
              <label className="block text-xs font-extrabold text-slate-900 mb-1">
                إجمالي المبلغ للتحصيل (COD)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  required
                  value={totalCollection}
                  onChange={(e) => setTotalCollection(e.target.value)}
                  className="w-full text-sm font-bold bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-mono"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                  د.أ
                </span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">أجرة التوصيل</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(e.target.value)}
                  className="w-full text-sm font-bold bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-mono"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                  د.أ
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">المتجر التابع له</label>
            <select
              value={merchantId}
              onChange={(e) => setMerchantId(e.target.value)}
              className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900"
            >
              {merchants.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.commercialName || m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              ملاحظة سريعة (اختياري)
            </label>
            <input
              type="text"
              placeholder="مثال: يرجى الاتصال قبل الوصول بنصف ساعة"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs sm:text-sm font-bold text-slate-950 bg-amber-500 hover:bg-amber-600 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <span>حفظ فوري للطلبية</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

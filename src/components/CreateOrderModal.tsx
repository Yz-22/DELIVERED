import React, { useState } from 'react';
import { X, Plus, Package, MapPin, Phone, DollarSign, UserCheck, Shield } from 'lucide-react';
import { User } from '../types/logistics';
import { GOVERNORATES } from '../utils/logisticsHelpers';

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (orderData: any) => void;
  merchants: User[];
  drivers: User[];
}

export const CreateOrderModal: React.FC<CreateOrderModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  merchants,
  drivers,
}) => {
  const [formData, setFormData] = useState({
    merchantId: merchants[0]?.id || '',
    driverId: '',
    referenceNumber: '',
    recipientName: '',
    recipientPhone: '',
    recipientPhoneAlt: '',
    governorate: 'عمان',
    area: '',
    subArea: '',
    fullAddress: '',
    merchantCollection: '25.0',
    deliveryFee: '3.0',
    totalCollection: '28.0',
    packageType: 'طرد عادي',
    piecesCount: 1,
    notes: '',
  });

  if (!isOpen) return null;

  const handleGoodsChange = (val: string) => {
    const goods = parseFloat(val) || 0;
    const fee = parseFloat(formData.deliveryFee) || 0;
    setFormData({
      ...formData,
      merchantCollection: val,
      totalCollection: (goods + fee).toFixed(1),
    });
  };

  const handleFeeChange = (val: string) => {
    const fee = parseFloat(val) || 0;
    const goods = parseFloat(formData.merchantCollection) || 0;
    setFormData({
      ...formData,
      deliveryFee: val,
      totalCollection: (goods + fee).toFixed(1),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.recipientName || !formData.recipientPhone || !formData.area) {
      alert('يرجى ملء اسم المستلم، رقم الهاتف، والمنطقة');
      return;
    }
    onSubmit({
      ...formData,
      merchantCollection: parseFloat(formData.merchantCollection) || 0,
      deliveryFee: parseFloat(formData.deliveryFee) || 0,
      totalCollection: parseFloat(formData.totalCollection) || 0,
      piecesCount: parseInt(formData.piecesCount as any) || 1,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">إنشاء بوليصة طلبية جديدة</h3>
              <p className="text-xs text-slate-400">
                إدخال تفاصيل الشحنة، المستلم، والتحصيل المالي (Odoo TMS)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Section 1: Merchant & Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                التاجر / المتجر المرسل *
              </label>
              <select
                value={formData.merchantId}
                onChange={(e) => setFormData({ ...formData, merchantId: e.target.value })}
                required
                className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-amber-500"
              >
                {merchants.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.commercialName || m.name} ({m.city})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                رقم المرجع للمتجر (اختياري)
              </label>
              <input
                type="text"
                placeholder="مثال: REF-9901"
                value={formData.referenceNumber}
                onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-amber-500 font-mono"
              />
            </div>
          </div>

          {/* Section 2: Recipient Details */}
          <div className="border-t border-slate-100 pt-4">
            <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" />
              بيانات المستلم والتواصل
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  اسم المستلم *
                </label>
                <input
                  type="text"
                  placeholder="الاسم الكامل"
                  value={formData.recipientName}
                  onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                  required
                  className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  رقم الهاتف (واتساب) *
                </label>
                <input
                  type="tel"
                  placeholder="079XXXXXXX"
                  value={formData.recipientPhone}
                  onChange={(e) => setFormData({ ...formData, recipientPhone: e.target.value })}
                  required
                  className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  هاتف بديل (اختياري)
                </label>
                <input
                  type="tel"
                  placeholder="078XXXXXXX"
                  value={formData.recipientPhoneAlt}
                  onChange={(e) => setFormData({ ...formData, recipientPhoneAlt: e.target.value })}
                  className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Destination Address */}
          <div className="border-t border-slate-100 pt-4">
            <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              عنوان وجهة التسليم
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  المحافظة *
                </label>
                <select
                  value={formData.governorate}
                  onChange={(e) => setFormData({ ...formData, governorate: e.target.value })}
                  className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-amber-500"
                >
                  {GOVERNORATES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  المنطقة الرئيسية *
                </label>
                <input
                  type="text"
                  placeholder="مثال: ضاحية الياسمين، خلدا"
                  value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                  required
                  className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  الحي / المنطقة الفرعية
                </label>
                <input
                  type="text"
                  placeholder="مثال: قرب مسجد الكردي"
                  value={formData.subArea}
                  onChange={(e) => setFormData({ ...formData, subArea: e.target.value })}
                  className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                العنوان التفصيلي ونقاط الدلالة
              </label>
              <textarea
                rows={2}
                placeholder="اسم الشارع، رقم العمارة، الطابق، أو أي تفاصيل للوصول السريع"
                value={formData.fullAddress}
                onChange={(e) => setFormData({ ...formData, fullAddress: e.target.value })}
                className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Section 4: Financials & COD */}
          <div className="border-t border-slate-100 pt-4">
            <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" />
              التحصيل المالي والدفع عند الاستلام (COD)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-amber-50/50 p-3.5 rounded-xl border border-amber-200">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  مبلغ البضاعة (للتاجر)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    value={formData.merchantCollection}
                    onChange={(e) => handleGoodsChange(e.target.value)}
                    className="w-full text-sm font-bold bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-mono"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    د.أ
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  أجرة التوصيل
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    value={formData.deliveryFee}
                    onChange={(e) => handleFeeChange(e.target.value)}
                    className="w-full text-sm font-bold bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-mono"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    د.أ
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-emerald-800 mb-1">
                  إجمالي التحصيل من الزبون
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    value={formData.totalCollection}
                    onChange={(e) =>
                      setFormData({ ...formData, totalCollection: e.target.value })
                    }
                    className="w-full text-sm font-black bg-emerald-100/60 border border-emerald-300 rounded-lg p-2 text-emerald-900 font-mono"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-700">
                    د.أ
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: Driver Assignment & Package Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-100 pt-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                تعيين كابتن التوصيل (اختياري)
              </label>
              <select
                value={formData.driverId}
                onChange={(e) => setFormData({ ...formData, driverId: e.target.value })}
                className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800"
              >
                <option value="">بدون سائق (تعيين لاحقاً)</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.city})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">نوع الطرد</label>
              <input
                type="text"
                value={formData.packageType}
                onChange={(e) => setFormData({ ...formData, packageType: e.target.value })}
                className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">عدد القطع</label>
              <input
                type="number"
                min={1}
                value={formData.piecesCount}
                onChange={(e) => setFormData({ ...formData, piecesCount: e.target.value as any })}
                className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ملاحظات إضافية للكابتن
            </label>
            <input
              type="text"
              placeholder="مثال: يرجى التوصيل بعد العصر، عدم الرن على الجرس"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-800 rounded-lg"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs sm:text-sm font-bold text-slate-950 bg-amber-500 hover:bg-amber-600 rounded-lg shadow-sm transition-colors"
            >
              حفظ وإنشاء البوليصة
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

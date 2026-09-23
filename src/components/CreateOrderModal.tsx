import React, { useState, useEffect } from 'react';
import { X, Plus, Package, MapPin, Phone, DollarSign, UserCheck, Shield, Store, Check, AlertCircle } from 'lucide-react';
import { User } from '../types/logistics';
import { GOVERNORATES } from '../utils/logisticsHelpers';

import {
  validateAndNormalizeJordanPhone,
  validateAndNormalizeSecondaryJordanPhone,
} from '../utils/jordanPhone';

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (orderData: any) => void;
  merchants: User[];
  drivers: User[];
  currentUser?: User | null;
  onAddNewMerchant?: (merchantData: Partial<User>) => Promise<User | null>;
}

export const CreateOrderModal: React.FC<CreateOrderModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  merchants,
  drivers,
  currentUser,
  onAddNewMerchant,
}) => {
  const [localMerchants, setLocalMerchants] = useState<User[]>(merchants);
  const [isAddingMerchant, setIsAddingMerchant] = useState(false);
  const [isSavingMerchant, setIsSavingMerchant] = useState(false);
  const [merchantError, setMerchantError] = useState('');
  const [newMerchantForm, setNewMerchantForm] = useState({
    commercialName: '',
    name: '',
    phone: '',
    city: 'عمان',
    priceList: 'جميع المملكة 2',
  });

  const isMerchantUser = currentUser?.role === 'MERCHANT';
  const isCashierUser = currentUser?.role === 'CASHIER';

  const defaultMerchantId = isMerchantUser
    ? currentUser?.id || ''
    : isCashierUser
    ? currentUser?.parentUserId || ''
    : '';

  useEffect(() => {
    setLocalMerchants(merchants);
    // Never auto-select merchants[0] blindly.
    // For merchant or cashier, identity is strictly their own or parent merchant.
    if (isMerchantUser && currentUser?.id) {
      setFormData((prev) => ({ ...prev, merchantId: currentUser.id }));
    } else if (isCashierUser && currentUser?.parentUserId) {
      setFormData((prev) => ({ ...prev, merchantId: currentUser.parentUserId }));
    }
  }, [merchants, currentUser?.id, currentUser?.parentUserId, isMerchantUser, isCashierUser]);

  const [formData, setFormData] = useState({
    merchantId: defaultMerchantId,
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

  const [formError, setFormError] = useState<string | null>(null);

  const handleQuickAddMerchant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMerchantForm.commercialName.trim()) {
      setMerchantError('يرجى كتابة اسم المتجر أو الاسم التجاري');
      return;
    }
    if (!newMerchantForm.phone.trim()) {
      setMerchantError('يرجى كتابة رقم هاتف التاجر');
      return;
    }

    setIsSavingMerchant(true);
    setMerchantError('');

    try {
      const merchantPayload: Partial<User> = {
        name: newMerchantForm.name.trim() || newMerchantForm.commercialName.trim(),
        commercialName: newMerchantForm.commercialName.trim(),
        phone: newMerchantForm.phone.trim(),
        city: newMerchantForm.city,
        priceList: newMerchantForm.priceList,
        role: 'MERCHANT',
        roleName: 'تاجر معتمد',
        branch: 'فرع عمان الرئيسي',
        isActive: true,
      };

      let createdUser: User | null = null;
      if (onAddNewMerchant) {
        createdUser = await onAddNewMerchant(merchantPayload);
      } else {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(merchantPayload),
        });
        if (res.ok) {
          createdUser = await res.json();
        }
      }

      if (!createdUser) {
        // Fallback local creation
        createdUser = {
          id: `u-mer-${Date.now()}`,
          name: merchantPayload.name || '',
          commercialName: merchantPayload.commercialName,
          phone: merchantPayload.phone || '',
          email: `${merchantPayload.phone}@dargo-tms.io`,
          role: 'MERCHANT',
          city: merchantPayload.city || 'عمان',
          priceList: merchantPayload.priceList || 'جميع المملكة 2',
          branch: 'فرع عمان الرئيسي',
          isActive: true,
        };
      }

      // Add to local list and select it immediately
      setLocalMerchants((prev) => [createdUser!, ...prev.filter((m) => m.id !== createdUser!.id)]);
      setFormData((prev) => ({ ...prev, merchantId: createdUser!.id }));
      setIsAddingMerchant(false);
      setNewMerchantForm({
        commercialName: '',
        name: '',
        phone: '',
        city: 'عمان',
        priceList: 'جميع المملكة 2',
      });
    } catch (err: any) {
      console.error(err);
      setMerchantError('تعذر إضافة التاجر. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSavingMerchant(false);
    }
  };

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

  const handleTotalCollectionChange = (val: string) => {
    const total = parseFloat(val) || 0;
    const fee = parseFloat(formData.deliveryFee) || 0;
    const netMerchant = Math.max(0, total - fee);
    setFormData({
      ...formData,
      totalCollection: val,
      merchantCollection: netMerchant.toFixed(1),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.recipientName || !formData.recipientPhone || !formData.area) {
      setFormError('يرجى ملء اسم المستلم، رقم الهاتف، والمنطقة');
      return;
    }

    // Determine final merchantId
    const finalMerchantId = isMerchantUser
      ? (currentUser?.id || formData.merchantId)
      : isCashierUser
      ? (currentUser?.parentUserId || formData.merchantId)
      : formData.merchantId;

    if (!finalMerchantId && !isMerchantUser && !isCashierUser) {
      setFormError('يرجى اختيار المتجر / التاجر صاحب الشحنة');
      return;
    }

    const phoneVal = validateAndNormalizeJordanPhone(formData.recipientPhone, 'رقم هاتف المستلم');
    if (!phoneVal.isValid || !phoneVal.canonicalPhone) {
      setFormError(phoneVal.error || 'رقم الهاتف يجب أن يكون رقمًا أردنيًا صحيحًا من 10 أرقام مثل 0791234567، أو بصيغة +962 بدون الصفر الأول.');
      return;
    }

    let canonicalPhoneAlt = '';
    if (formData.recipientPhoneAlt && formData.recipientPhoneAlt.trim() !== '') {
      const altVal = validateAndNormalizeSecondaryJordanPhone(formData.recipientPhoneAlt);
      if (!altVal.isValid) {
        setFormError(altVal.error || 'رقم الهاتف الإضافي غير صالح');
        return;
      }
      canonicalPhoneAlt = altVal.canonicalPhone || '';
    }

    onSubmit({
      ...formData,
      merchantId: finalMerchantId,
      recipientPhone: phoneVal.canonicalPhone,
      recipientPhoneAlt: canonicalPhoneAlt,
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
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Section 1: Merchant & Reference */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    التاجر / المتجر المرسل *
                  </label>
                  {!isMerchantUser && !isCashierUser && (
                    <button
                      type="button"
                      id="btn-quick-add-merchant-badge"
                      onClick={() => {
                        setIsAddingMerchant(!isAddingMerchant);
                        setMerchantError('');
                      }}
                      className="text-[11px] font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                      title="إضافة تاجر جديد غير مسجل"
                    >
                      <Plus className="w-3 h-3 stroke-[2.5]" />
                      <span>إضافة تاجر غير موجود</span>
                    </button>
                  )}
                </div>

                {isMerchantUser ? (
                  <div className="p-2.5 bg-slate-100 border border-slate-300 rounded-lg text-xs sm:text-sm font-semibold text-slate-800 flex items-center justify-between">
                    <span>{currentUser?.commercialName || currentUser?.name} (متجرك المعتمد)</span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                      حساب التاجر
                    </span>
                  </div>
                ) : isCashierUser ? (
                  <div className="p-2.5 bg-slate-100 border border-slate-300 rounded-lg text-xs sm:text-sm font-semibold text-slate-800 flex items-center justify-between">
                    <span>{currentUser?.commercialName || currentUser?.name || 'المتجر الرئيسي'} (فرعك: {currentUser?.branch || 'الفرع المعين'})</span>
                    <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-bold">
                      كاشير المتجر
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <select
                      id="select-order-merchant"
                      value={formData.merchantId}
                      onChange={(e) => setFormData({ ...formData, merchantId: e.target.value })}
                      required
                      className="flex-1 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-amber-500 font-medium"
                    >
                      <option value="">-- اختر المتجر / التاجر صاحب الشحنة --</option>
                      {localMerchants.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.commercialName || m.name} ({m.city})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      id="btn-add-merchant-plus"
                      onClick={() => {
                        setIsAddingMerchant(!isAddingMerchant);
                        setMerchantError('');
                      }}
                      className="p-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 rounded-lg transition-all shadow-xs flex items-center justify-center cursor-pointer border border-amber-600/30 shrink-0"
                      title="إضافة تاجر جديد (+)"
                    >
                      <Plus className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </div>
                )}
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

            {/* Quick Add Merchant Inline Drawer */}
            {isAddingMerchant && (
              <div
                id="inline-add-merchant-card"
                className="bg-amber-50/80 border border-amber-300/80 rounded-xl p-3.5 space-y-3 shadow-xs animate-in fade-in duration-150"
              >
                <div className="flex items-center justify-between pb-2 border-b border-amber-200">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
                    <Store className="w-4 h-4 text-amber-600" />
                    <span>إضافة تاجر / متجر جديد فورياً للنظام</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddingMerchant(false)}
                    className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {merchantError && (
                  <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-1.5 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{merchantError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      اسم المتجر / الاسم التجاري *
                    </label>
                    <input
                      type="text"
                      placeholder="مثال: متجر الريحان فاشن"
                      value={newMerchantForm.commercialName}
                      onChange={(e) =>
                        setNewMerchantForm({ ...newMerchantForm, commercialName: e.target.value })
                      }
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:ring-2 focus:ring-amber-500"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      اسم الشخص المسؤول (التاجر)
                    </label>
                    <input
                      type="text"
                      placeholder="مثال: يوسف العبداللات"
                      value={newMerchantForm.name}
                      onChange={(e) =>
                        setNewMerchantForm({ ...newMerchantForm, name: e.target.value })
                      }
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      رقم الهاتف / الواتساب *
                    </label>
                    <input
                      type="tel"
                      placeholder="مثال: 0795551234"
                      value={newMerchantForm.phone}
                      onChange={(e) =>
                        setNewMerchantForm({ ...newMerchantForm, phone: e.target.value })
                      }
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:ring-2 focus:ring-amber-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      المدينة / المحافظة
                    </label>
                    <select
                      value={newMerchantForm.city}
                      onChange={(e) =>
                        setNewMerchantForm({ ...newMerchantForm, city: e.target.value })
                      }
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:ring-2 focus:ring-amber-500"
                    >
                      {GOVERNORATES.map((gov) => (
                        <option key={gov} value={gov}>
                          {gov}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingMerchant(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-lg cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    id="btn-save-quick-merchant"
                    onClick={handleQuickAddMerchant}
                    disabled={isSavingMerchant}
                    className="px-4 py-1.5 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-600 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    {isSavingMerchant ? (
                      <span>جاري الحفظ...</span>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>حفظ واختيار التاجر فورياً</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
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
                    onChange={(e) => handleTotalCollectionChange(e.target.value)}
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

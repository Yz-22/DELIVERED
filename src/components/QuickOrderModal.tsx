import React, { useState, useEffect } from 'react';
import { X, Zap, ArrowLeft, Plus, Store, Check, AlertCircle } from 'lucide-react';
import { User } from '../types/logistics';
import { GOVERNORATES } from '../utils/logisticsHelpers';

interface QuickOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  merchants: User[];
  currentUser?: User | null;
  onAddNewMerchant?: (merchantData: Partial<User>) => Promise<User | null>;
}

export const QuickOrderModal: React.FC<QuickOrderModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  merchants,
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
    if (isMerchantUser && currentUser?.id) {
      setMerchantId(currentUser.id);
    } else if (isCashierUser && currentUser?.parentUserId) {
      setMerchantId(currentUser.parentUserId);
    }
  }, [merchants, currentUser?.id, currentUser?.parentUserId, isMerchantUser, isCashierUser]);

  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [governorate, setGovernorate] = useState('عمان');
  const [area, setArea] = useState('');
  const [totalCollection, setTotalCollection] = useState('25');
  const [deliveryFee, setDeliveryFee] = useState('3.0');
  const [merchantId, setMerchantId] = useState(defaultMerchantId);
  const [notes, setNotes] = useState('');

  const handleQuickAddMerchant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMerchantForm.commercialName.trim()) {
      setMerchantError('يرجى كتابة اسم المتجر');
      return;
    }
    if (!newMerchantForm.phone.trim()) {
      setMerchantError('يرجى كتابة رقم الهاتف');
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
        createdUser = {
          id: `u-mer-${Date.now()}`,
          name: merchantPayload.name || '',
          commercialName: merchantPayload.commercialName,
          phone: merchantPayload.phone || '',
          email: `${merchantPayload.phone}@dargo-tms.io`,
          role: 'MERCHANT',
          city: merchantPayload.city || 'عمان',
          priceList: 'جميع المملكة 2',
          branch: 'فرع عمان الرئيسي',
          isActive: true,
        };
      }

      setLocalMerchants((prev) => [createdUser!, ...prev.filter((m) => m.id !== createdUser!.id)]);
      setMerchantId(createdUser!.id);
      setIsAddingMerchant(false);
      setNewMerchantForm({
        commercialName: '',
        name: '',
        phone: '',
        city: 'عمان',
      });
    } catch (err: any) {
      console.error(err);
      setMerchantError('تعذر إضافة التاجر');
    } finally {
      setIsSavingMerchant(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName || !recipientPhone || !area) {
      alert('يرجى ملء اسم المستلم، رقم الهاتف، والمنطقة');
      return;
    }

    const finalMerchantId = isMerchantUser
      ? (currentUser?.id || merchantId)
      : isCashierUser
      ? (currentUser?.parentUserId || merchantId)
      : merchantId;

    if (!finalMerchantId && !isMerchantUser && !isCashierUser) {
      alert('يرجى اختيار المتجر التابع له الشحنة أولاً');
      return;
    }

    const formSessionKey = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `quick-modal-${Date.now()}`;
    onSubmit({
      recipientName,
      recipientPhone,
      governorate,
      area,
      totalCollection: parseFloat(totalCollection) || 25,
      deliveryFee: parseFloat(deliveryFee) || 3,
      merchantId: finalMerchantId,
      notes,
      idempotencyKey: formSessionKey,
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700">المتجر التابع له *</label>
              {!isMerchantUser && !isCashierUser && (
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingMerchant(!isAddingMerchant);
                    setMerchantError('');
                  }}
                  className="text-[11px] font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md transition-all flex items-center gap-1 cursor-pointer"
                  title="إضافة تاجر جديد"
                >
                  <Plus className="w-3 h-3 stroke-[2.5]" />
                  <span>إضافة تاجر غير موجود</span>
                </button>
              )}
            </div>

            {isMerchantUser ? (
              <div className="p-2 bg-slate-100 border border-slate-300 rounded-lg text-xs sm:text-sm font-semibold text-slate-800 flex items-center justify-between">
                <span>{currentUser?.commercialName || currentUser?.name} (متجرك المعتمد)</span>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                  حساب التاجر
                </span>
              </div>
            ) : isCashierUser ? (
              <div className="p-2 bg-slate-100 border border-slate-300 rounded-lg text-xs sm:text-sm font-semibold text-slate-800 flex items-center justify-between">
                <span>{currentUser?.commercialName || currentUser?.name || 'المتجر الرئيسي'} (فرع: {currentUser?.branch || 'الفرع المعين'})</span>
                <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-bold">
                  كاشير المتجر
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <select
                  value={merchantId}
                  onChange={(e) => setMerchantId(e.target.value)}
                  className="flex-1 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900"
                >
                  <option value="">-- اختر المتجر / التاجر صاحب الشحنة --</option>
                  {localMerchants.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.commercialName || m.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingMerchant(!isAddingMerchant);
                    setMerchantError('');
                  }}
                  className="p-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold rounded-lg transition-all shadow-xs flex items-center justify-center cursor-pointer border border-amber-600/30 shrink-0"
                  title="إضافة تاجر جديد (+)"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            )}

            {/* Inline Quick Add Merchant */}
            {isAddingMerchant && (
              <div className="bg-amber-50/80 border border-amber-300/80 rounded-xl p-3 space-y-2.5 shadow-xs animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-1.5 border-b border-amber-200">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                    <Store className="w-3.5 h-3.5 text-amber-600" />
                    <span>إضافة تاجر جديد سريع</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddingMerchant(false)}
                    className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {merchantError && (
                  <div className="p-1.5 bg-rose-50 border border-rose-200 rounded text-[11px] text-rose-700 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{merchantError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                      اسم المتجر *
                    </label>
                    <input
                      type="text"
                      placeholder="مثال: متجر الزهور"
                      value={newMerchantForm.commercialName}
                      onChange={(e) =>
                        setNewMerchantForm({ ...newMerchantForm, commercialName: e.target.value })
                      }
                      className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 text-slate-900 focus:ring-1 focus:ring-amber-500"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                      رقم الهاتف *
                    </label>
                    <input
                      type="tel"
                      placeholder="079XXXXXXX"
                      value={newMerchantForm.phone}
                      onChange={(e) =>
                        setNewMerchantForm({ ...newMerchantForm, phone: e.target.value })
                      }
                      className="w-full text-xs bg-white border border-slate-300 rounded p-1.5 text-slate-900 focus:ring-1 focus:ring-amber-500 font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingMerchant(false)}
                    className="px-2.5 py-1 text-xs text-slate-600 bg-white border border-slate-300 rounded cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleQuickAddMerchant}
                    disabled={isSavingMerchant}
                    className="px-3 py-1 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-600 rounded flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingMerchant ? (
                      <span>جاري الحفظ...</span>
                    ) : (
                      <>
                        <Check className="w-3 h-3 stroke-[2.5]" />
                        <span>حفظ واختيار</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
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

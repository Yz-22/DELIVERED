import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  MapPin,
  Phone,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Power,
  Star,
  Users,
  Search,
  Filter,
  ArrowRightLeft,
  X,
} from 'lucide-react';
import { MerchantBranch } from '../types/branches';
import { User } from '../types/logistics';
import { GOVERNORATES } from '../utils/logisticsHelpers';
import { getAuthHeaders } from '../lib/auth';

interface MerchantBranchesProps {
  merchantId?: string;
  currentUser?: User | null;
  merchants?: User[];
  onBranchSelected?: (branch: MerchantBranch | null) => void;
}

export const MerchantBranches: React.FC<MerchantBranchesProps> = ({
  merchantId,
  currentUser,
  merchants,
  onBranchSelected,
}) => {
  const [activeMerchantId, setActiveMerchantId] = useState<string>(
    merchantId || (currentUser?.role === 'MERCHANT' ? currentUser.id : (merchants?.[0]?.id || ''))
  );
  const [branches, setBranches] = useState<MerchantBranch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGovernorate, setSelectedGovernorate] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<MerchantBranch | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (merchantId) {
      setActiveMerchantId(merchantId);
    } else if (currentUser?.role === 'MERCHANT') {
      setActiveMerchantId(currentUser.id);
    } else if (merchants && merchants.length > 0 && !activeMerchantId) {
      setActiveMerchantId(merchants[0].id);
    }
  }, [merchantId, currentUser, merchants]);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    phone: '',
    address: '',
    governorate: 'عمان',
    city: 'عمان',
    isMain: false,
    isActive: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchBranches = async () => {
    if (!activeMerchantId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/merchants/${activeMerchantId}/branches`, {
        headers: getAuthHeaders(currentUser),
      });
      if (res.ok) {
        const data = await res.json();
        setBranches(data.branches || []);
      } else {
        const err = await res.json();
        showToast(err.error || 'تعذر جلب قائمة الفروع', 'error');
      }
    } catch (e: any) {
      showToast('خطأ في الاتصال بالخادم', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, [activeMerchantId]);

  const openCreateModal = () => {
    setEditingBranch(null);
    setFormData({
      name: '',
      code: `BR-${branches.length + 1}`,
      phone: currentUser?.phone || '0790000000',
      address: '',
      governorate: 'عمان',
      city: 'عمان',
      isMain: branches.length === 0,
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (branch: MerchantBranch) => {
    setEditingBranch(branch);
    setFormData({
      name: branch.name,
      code: branch.code || '',
      phone: branch.phone || '',
      address: branch.address || '',
      governorate: branch.governorate || 'عمان',
      city: branch.city || 'عمان',
      isMain: branch.isMain,
      isActive: branch.isActive,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('اسم الفرع مطلوب', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const url = editingBranch
        ? `/api/merchants/${activeMerchantId}/branches/${editingBranch.id}`
        : `/api/merchants/${activeMerchantId}/branches`;
      const method = editingBranch ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(currentUser),
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشلت عملية حفظ الفرع');
      }

      showToast(editingBranch ? 'تم تحديث بيانات الفرع بنجاح' : 'تم إضافة الفرع بنجاح');
      setIsModalOpen(false);
      fetchBranches();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (branch: MerchantBranch) => {
    try {
      const res = await fetch(`/api/merchants/${activeMerchantId}/branches/${branch.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(currentUser),
        },
        body: JSON.stringify({ isActive: !branch.isActive }),
      });
      if (res.ok) {
        showToast(branch.isActive ? 'تم إيقاف تفعيل الفرع' : 'تم تفعيل الفرع بنجاح');
        fetchBranches();
      }
    } catch {
      showToast('تعذر تغيير حالة الفرع', 'error');
    }
  };

  const filteredBranches = branches.filter((b) => {
    const matchesSearch =
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.code && b.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (b.address && b.address.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesGov = selectedGovernorate === 'ALL' || b.governorate === selectedGovernorate;
    return matchesSearch && matchesGov;
  });

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-amber-600" />
            <h2 className="text-lg font-black text-slate-900">إدارة فروع المتجر (Multi-Branch)</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            إدارة شبكة الفروع، تخصيص الكاشيرات ونقاط البيع، وتتبع المخزون والطلبيات بحسب كل فرع.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all active:scale-95 text-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة فرع جديد</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {merchants && merchants.length > 1 && currentUser?.role !== 'MERCHANT' && (
          <div>
            <select
              value={activeMerchantId}
              onChange={(e) => setActiveMerchantId(e.target.value)}
              className="w-full bg-amber-50 border border-amber-300 rounded-xl px-3 py-2 text-xs font-bold text-amber-950 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            >
              {merchants.map((m) => (
                <option key={m.id} value={m.id}>
                  تاجر: {m.storeName || m.businessName || m.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className={`${merchants && merchants.length > 1 && currentUser?.role !== 'MERCHANT' ? 'sm:col-span-2' : 'sm:col-span-3'} relative`}>
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="البحث باسم الفرع، الرمز، أو العنوان..."
            className="w-full bg-white border border-slate-200 rounded-xl pr-10 pl-3 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
          />
        </div>

        <div>
          <select
            value={selectedGovernorate}
            onChange={(e) => setSelectedGovernorate(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          >
            <option value="ALL">جميع المحافظات ({branches.length})</option>
            {GOVERNORATES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Branch Cards Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 text-xs font-bold animate-pulse">
          جاري تحميل بيانات الفروع...
        </div>
      ) : filteredBranches.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">لا توجد فروع مسجلة مطابقة للبحث</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            يمكنك إضافة فروع متجرك المتعددة لتنظيم نقاط البيع وطلبيات الاستلام والمخازن.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 hover:text-amber-700 pt-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة أول فرع الآن</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBranches.map((branch) => (
            <div
              key={branch.id}
              className={`bg-white rounded-2xl border transition-all p-5 space-y-4 shadow-xs hover:shadow-md ${
                branch.isMain
                  ? 'border-amber-400/80 ring-2 ring-amber-400/20'
                  : 'border-slate-200'
              } ${!branch.isActive ? 'opacity-70 bg-slate-50' : ''}`}
            >
              {/* Card Top */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-bold text-slate-900 text-sm">{branch.name}</h3>
                    {branch.isMain && (
                      <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 font-black text-[10px] px-2 py-0.5 rounded-full border border-amber-300">
                        <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                        الفرع الرئيسي
                      </span>
                    )}
                    {branch.code && (
                      <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">
                        {branch.code}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>{branch.governorate}</span>
                    {branch.city && <span>• {branch.city}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEditModal(branch)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                    title="تعديل بيانات الفرع"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(branch)}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      branch.isActive
                        ? 'text-emerald-600 hover:bg-emerald-50'
                        : 'text-slate-400 hover:bg-slate-200'
                    }`}
                    title={branch.isActive ? 'إيقاف الفرع' : 'تفعيل الفرع'}
                  >
                    <Power className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Address and Phone */}
              <div className="space-y-1 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div className="flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span className="text-[11px] leading-relaxed">
                    {branch.address || 'العنوان التفصيلي غير محدد'}
                  </span>
                </div>
                {branch.phone && (
                  <div className="flex items-center gap-1.5 pt-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-mono text-[11px] dir-ltr text-right">{branch.phone}</span>
                  </div>
                )}
              </div>

              {/* Status and Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    branch.isActive
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${branch.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  {branch.isActive ? 'نشط ويعمل' : 'موقوف مؤقتاً'}
                </span>

                <span className="text-[10px] text-slate-400">
                  أضيف بتاريخ {new Date(branch.createdAt).toLocaleDateString('ar-JO')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  {editingBranch ? 'تعديل بيانات الفرع' : 'إضافة فرع جديد للمتجر'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">اسم الفرع *:</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: فرع الصويفية، فرع إربد سيتي مول"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">رمز الفرع (Code):</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="مثال: SWF-01"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">هاتف الفرع:</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="0790000000"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-mono dir-ltr text-right"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">المحافظة:</label>
                  <select
                    value={formData.governorate}
                    onChange={(e) => setFormData({ ...formData, governorate: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800"
                  >
                    {GOVERNORATES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">المنطقة / الحي:</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="مثال: الصويفية، شارع الوكالات"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">العنوان التفصيلي وموقع الاستلام:</label>
                <textarea
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="موقع الفرع بالتفصيل لتوجيه كباتن التوصيل لاستلام الشحنات..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2"
                />
              </div>

              <div className="pt-2 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.isMain}
                    onChange={(e) => setFormData({ ...formData, isMain: e.target.checked })}
                    className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-4 h-4"
                  />
                  <span className="font-bold text-slate-800">
                    تعيين كفرع رئيسي معتمد (Main Branch)
                  </span>
                </label>
                <p className="text-[11px] text-slate-400 pr-6">
                  الفرع الرئيسي يستخدم كعنوان افتراضي لاستلام الشحنات وتوجيه الكاشيرات الجدد.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-5 py-2 rounded-xl font-black cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'جاري الحفظ...' : editingBranch ? 'حفظ التعديلات' : 'إضافة الفرع'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 left-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg bg-slate-900 text-white text-xs font-bold border border-slate-800 animate-in fade-in">
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}
    </div>
  );
};

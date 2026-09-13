import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  Boxes,
  MapPin,
  Building2,
  CheckCircle2,
  Printer,
  FileCheck,
  AlertTriangle,
  Search,
  Filter,
  ArrowRightLeft,
  X,
  Plus,
  Tag
} from 'lucide-react';
import { Order, User, OrderStatus } from '../types/logistics';

interface ReverseLogisticsProps {
  merchants: User[];
  orders: Order[];
  onRefreshOrders: () => void;
  onOpenWaybill: (order: Order) => void;
}

export const ReverseLogistics: React.FC<ReverseLogisticsProps> = ({
  merchants,
  orders,
  onRefreshOrders,
  onOpenWaybill,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'returns' | 'shelving'>('returns');
  const [searchQuery, setSearchQuery] = useState('');
  const [merchantFilter, setMerchantFilter] = useState('ALL');
  const [selectedReturnIds, setSelectedReturnIds] = useState<string[]>([]);
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false);
  const [manifestCode, setManifestCode] = useState(`RET-MNF-${Date.now().toString().slice(-4)}`);
  const [handoverNotes, setHandoverNotes] = useState('');
  const [isSubmittingHandover, setIsSubmittingHandover] = useState(false);
  const [handoverSuccess, setHandoverSuccess] = useState<string | null>(null);

  // Shelf editing state
  const [editingShelfOrderId, setEditingShelfOrderId] = useState<string | null>(null);
  const [newShelfValue, setNewShelfValue] = useState('');

  // Filter returned or cancelled parcels
  const returnedParcels = orders.filter((o) =>
    ['CANCELLED', 'RETURNED', 'POSTPONED'].includes(o.status)
  );

  // Shelving items (all parcels currently at hub or returned)
  const warehouseParcels = orders.filter((o) =>
    ['RECEIVED_AT_HUB', 'PENDING', 'CANCELLED', 'RETURNED'].includes(o.status)
  );

  // Filtered returns
  const filteredReturns = returnedParcels.filter((o) => {
    if (merchantFilter !== 'ALL' && o.merchantId !== merchantFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        o.sequence.toLowerCase().includes(q) ||
        o.recipientName.toLowerCase().includes(q) ||
        (o.warehouseShelf && o.warehouseShelf.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleToggleSelectReturn = (id: string) => {
    setSelectedReturnIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllReturns = () => {
    if (selectedReturnIds.length === filteredReturns.length) {
      setSelectedReturnIds([]);
    } else {
      setSelectedReturnIds(filteredReturns.map((o) => o.id));
    }
  };

  // Submit Handover to Merchant
  const handleSubmitHandover = async () => {
    if (selectedReturnIds.length === 0) return;
    setIsSubmittingHandover(true);

    try {
      const res = await fetch('/api/returns/handover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selectedReturnIds,
          manifestCode,
          notes: handoverNotes,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setHandoverSuccess(`تم تسليم ${data.count} طرد بنجاح بموجب كشف الاستلام رقم ${manifestCode}`);
        setSelectedReturnIds([]);
        onRefreshOrders();
        setTimeout(() => {
          setIsHandoverModalOpen(false);
          setHandoverSuccess(null);
        }, 2500);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmittingHandover(false);
    }
  };

  // Update Shelf API
  const handleUpdateShelf = async (orderId: string, shelf: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/shelf`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shelf }),
      });
      if (res.ok) {
        onRefreshOrders();
        setEditingShelfOrderId(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-indigo-950 rounded-3xl p-6 text-white shadow-xl border border-rose-900/40 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-500 text-white flex items-center justify-center shadow-lg">
              <RotateCcw className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-rose-500/20 text-rose-300 font-bold px-2.5 py-0.5 rounded-full border border-rose-500/30">
                  اللوجستيات العكسية وإدارة الرفوف
                </span>
                <span className="text-xs text-slate-400">Reverse Logistics & Bin Shelving</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
                إدارة المرتجعات وقواطع المستودع
              </h1>
              <p className="text-xs text-slate-300">
                فرز الشحنات المرتجعة، تخصيص رفوف التخزين المؤقت، وتوليد محاضر التسليم للمتاجر
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSubTab('returns')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSubTab === 'returns'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              <span>المرتجعات ({returnedParcels.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('shelving')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSubTab === 'shelving'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Boxes className="w-4 h-4" />
              <span>رفوف وقواطع المستودع</span>
            </button>
          </div>
        </div>

        {/* Quick Return Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800">
          <div className="bg-slate-800/60 rounded-2xl p-3 border border-slate-700/50">
            <div className="text-[11px] text-slate-400">إجمالي الطرود المرتجعة</div>
            <div className="text-xl font-black text-rose-400 mt-0.5">{returnedParcels.length}</div>
          </div>
          <div className="bg-slate-800/60 rounded-2xl p-3 border border-slate-700/50">
            <div className="text-[11px] text-slate-400">بالمستودع بانتظار التاجر</div>
            <div className="text-xl font-black text-amber-400 mt-0.5">
              {returnedParcels.filter((o) => o.returnHandoverStatus !== 'RETURNED_TO_MERCHANT').length}
            </div>
          </div>
          <div className="bg-slate-800/60 rounded-2xl p-3 border border-slate-700/50">
            <div className="text-[11px] text-slate-400">تم تسليمها للمتجر</div>
            <div className="text-xl font-black text-emerald-400 mt-0.5">
              {returnedParcels.filter((o) => o.returnHandoverStatus === 'RETURNED_TO_MERCHANT').length}
            </div>
          </div>
          <div className="bg-slate-800/60 rounded-2xl p-3 border border-slate-700/50">
            <div className="text-[11px] text-slate-400">قيمة بضاعة المرتجعات</div>
            <div className="text-xl font-black text-white mt-0.5">
              {returnedParcels.reduce((sum, o) => sum + o.merchantCollection, 0).toFixed(2)} د.أ
            </div>
          </div>
        </div>
      </div>

      {/* Tab 1: Returns Management */}
      {activeSubTab === 'returns' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث برقم البوليصة أو الزبون أو الرف..."
                  className="w-full pr-9 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-rose-500"
                />
              </div>

              <select
                value={merchantFilter}
                onChange={(e) => setMerchantFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-rose-500"
              >
                <option value="ALL">جميع المتاجر</option>
                {merchants.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.commercialName || m.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedReturnIds.length > 0 && (
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <span className="text-xs font-bold text-slate-700">
                  تم تحديد {selectedReturnIds.length} طرد
                </span>
                <button
                  onClick={() => setIsHandoverModalOpen(true)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>توليد كشف تسليم المرتجعات للتاجر</span>
                </button>
              </div>
            )}
          </div>

          {/* Returns Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          filteredReturns.length > 0 &&
                          selectedReturnIds.length === filteredReturns.length
                        }
                        onChange={handleSelectAllReturns}
                        className="rounded text-rose-600 focus:ring-rose-500"
                      />
                    </th>
                    <th className="py-3 px-4">رقم البوليصة</th>
                    <th className="py-3 px-4">المتجر (المرسل)</th>
                    <th className="py-3 px-4">المستلم والمنطقة</th>
                    <th className="py-3 px-4">قيمة البضاعة</th>
                    <th className="py-3 px-4">سبب الإرجاع</th>
                    <th className="py-3 px-4">موقع الرف بالمستودع</th>
                    <th className="py-3 px-4">حالة التسليم للتاجر</th>
                    <th className="py-3 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReturns.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        لا توجد طرود مرتجعة مسجلة حالياً
                      </td>
                    </tr>
                  ) : (
                    filteredReturns.map((order) => {
                      const isHandedOver = order.returnHandoverStatus === 'RETURNED_TO_MERCHANT';
                      return (
                        <tr
                          key={order.id}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            selectedReturnIds.includes(order.id) ? 'bg-rose-50/50' : ''
                          }`}
                        >
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={selectedReturnIds.includes(order.id)}
                              onChange={() => handleToggleSelectReturn(order.id)}
                              disabled={isHandedOver}
                              className="rounded text-rose-600 focus:ring-rose-500 disabled:opacity-40"
                            />
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {order.sequence}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800">
                            {order.merchant?.commercialName || order.merchant?.name || 'متجر غير محدد'}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{order.recipientName}</div>
                            <div className="text-[10px] text-slate-500">
                              {order.governorate} - {order.area}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-black text-slate-900">
                            {order.merchantCollection.toFixed(2)} د.أ
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                              {order.cancellationReason || order.notes || 'رفض الاستلام عند الباب'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {order.warehouseShelf ? (
                              <span className="font-mono font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                                {order.warehouseShelf}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">رف المرتجعات R-01</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {isHandedOver ? (
                              <span className="text-emerald-700 font-bold flex items-center gap-1 text-[11px]">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>تم الاستلام من التاجر</span>
                              </span>
                            ) : (
                              <span className="text-amber-800 font-bold bg-amber-100/80 px-2 py-0.5 rounded-md text-[10px]">
                                بالمستودع (بانتظار التسليم)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => onOpenWaybill(order)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-bold text-[10px] inline-flex items-center gap-1"
                            >
                              <Printer className="w-3 h-3" />
                              <span>البوليصة</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Warehouse Shelving */}
      {activeSubTab === 'shelving' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Boxes className="w-5 h-5 text-amber-500" />
                <span>نظام عنونة الرفوف والقواطع بالمستودع (Warehouse Bin Shelving)</span>
              </h3>
              <p className="text-xs text-slate-500">
                حدد موقع الرف الدقيق لكل طرد (مثل: A-101، B-205، R-01) لتسريع العثور عليه وقت التسليم للكابتن
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {warehouseParcels.map((parcel) => (
              <div
                key={parcel.id}
                className="bg-slate-50 border border-slate-200 hover:border-amber-400 rounded-2xl p-4 transition-all shadow-xs"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-black text-slate-900 text-xs">
                    {parcel.sequence}
                  </span>
                  <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                    {parcel.governorate}
                  </span>
                </div>

                <div className="text-xs font-bold text-slate-800">{parcel.recipientName}</div>
                <div className="text-[11px] text-slate-500">{parcel.area} - {parcel.fullAddress}</div>

                <div className="mt-3 pt-3 border-t border-slate-200/70 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-xs text-slate-600 font-bold">الرف الحالي:</span>
                  </div>

                  {editingShelfOrderId === parcel.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        autoFocus
                        value={newShelfValue}
                        onChange={(e) => setNewShelfValue(e.target.value)}
                        placeholder="A-12"
                        className="w-16 px-2 py-0.5 text-xs font-mono font-bold uppercase bg-white border border-amber-500 rounded focus:outline-none"
                      />
                      <button
                        onClick={() => handleUpdateShelf(parcel.id, newShelfValue)}
                        className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 text-xs font-bold"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setEditingShelfOrderId(null)}
                        className="p-1 bg-slate-300 text-slate-800 rounded hover:bg-slate-400 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingShelfOrderId(parcel.id);
                        setNewShelfValue(parcel.warehouseShelf || 'A-01');
                      }}
                      className="px-2.5 py-1 bg-white hover:bg-amber-50 border border-slate-300 hover:border-amber-400 rounded-lg text-xs font-mono font-black text-amber-800 shadow-xs"
                    >
                      {parcel.warehouseShelf ? `[ ${parcel.warehouseShelf} ]` : '+ تعيين الرف'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Handover Manifest Modal */}
      {isHandoverModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-rose-400" />
                <h3 className="font-black text-sm">
                  كشف تسليم طرود مرتجعة للتاجر (Return Handover Manifest)
                </h3>
              </div>
              <button
                onClick={() => setIsHandoverModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {handoverSuccess ? (
                <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-4 rounded-2xl text-center font-bold text-xs flex flex-col items-center gap-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  <span>{handoverSuccess}</span>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs">
                    <div>
                      <span className="text-slate-500 block">رقم كشف الاستلام:</span>
                      <span className="font-mono font-black text-slate-900">{manifestCode}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">عدد الطرود المرتجعة:</span>
                      <span className="font-black text-rose-600">{selectedReturnIds.length} طرد</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ملاحظات أو توقيع مفوض المتجر:
                    </label>
                    <input
                      type="text"
                      value={handoverNotes}
                      onChange={(e) => setHandoverNotes(e.target.value)}
                      placeholder="اسم المستلم من طرف المتجر، ملاحظات سلامة الطرد..."
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  {/* Printable Manifest Preview */}
                  <div className="border border-dashed border-slate-300 rounded-2xl p-4 bg-slate-50/50 text-[11px] space-y-2">
                    <div className="font-bold text-slate-800 text-center border-b pb-2">
                      شركة دار جو للخدمات اللوجستية (DarGo Logistics) - محضر تسليم بضاعة مرتجعة
                    </div>
                    <div className="text-slate-600">
                      أقر أنا الموقع أدناه باستلام الطرود المرتجعة الموضحة في الكشف بحالتها السليمة، وإبراء ذمة شركة الشحن من قيمتها.
                    </div>
                    <div className="pt-4 flex justify-between text-slate-500 font-bold">
                      <div>توقيع مندوب DarGo: _________________</div>
                      <div>توقيع وختم المتجر: _________________</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t">
                    <button
                      onClick={() => setIsHandoverModalOpen(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={handleSubmitHandover}
                      disabled={isSubmittingHandover}
                      className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isSubmittingHandover ? 'جاري الاعتماد...' : 'تأكيد التسليم للتاجر وإغلاق الطرود'}</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

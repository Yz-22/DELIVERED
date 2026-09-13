import React, { useState } from 'react';
import {
  PackageCheck,
  Scan,
  Truck,
  Printer,
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
  Layers,
  MapPin,
  Barcode,
  Calendar,
  Filter,
} from 'lucide-react';
import { Order, User, OrderStatus } from '../types/logistics';
import { formatCurrency, formatDate } from '../utils/logisticsHelpers';

interface StaffPortalProps {
  orders: Order[];
  drivers: User[];
  onOpenScanner: () => void;
  onOpenWaybill: (order: Order) => void;
  onOpenWaybillBatch?: (orders: Order[]) => void;
  onChangeOrderStatus: (orderId: string, status: OrderStatus) => void;
  onAssignDriver: (orderId: string, driverId: string) => void;
}

export const StaffPortal: React.FC<StaffPortalProps> = ({
  orders,
  drivers,
  onOpenScanner,
  onOpenWaybill,
  onOpenWaybillBatch,
  onChangeOrderStatus,
  onAssignDriver,
}) => {
  const [activeTab, setActiveTab] = useState<'INBOUND' | 'HUB_SORT' | 'OUTBOUND_DISPATCH'>('INBOUND');
  const [selectedGovernorate, setSelectedGovernorate] = useState<string>('ALL');
  const [searchCode, setSearchCode] = useState('');

  // 1. Inbound (Pending or Picking)
  const inboundOrders = orders.filter((o) => o.status === 'PENDING' || o.status === 'PICKING');

  // 2. In Hub (Ready for sorting / labeling)
  const inHubOrders = orders.filter((o) => o.status === 'RECEIVED_AT_HUB');

  // 3. Outbound (Assigned or out for delivery)
  const outboundOrders = orders.filter((o) => o.status === 'OUT_FOR_DELIVERY');

  const currentList =
    activeTab === 'INBOUND'
      ? inboundOrders
      : activeTab === 'HUB_SORT'
      ? inHubOrders
      : outboundOrders;

  const filteredOrders = currentList.filter((o) => {
    if (selectedGovernorate !== 'ALL' && o.governorate !== selectedGovernorate) return false;
    if (searchCode.trim()) {
      const q = searchCode.toLowerCase();
      return (
        o.sequence.toLowerCase().includes(q) ||
        o.recipientName.toLowerCase().includes(q) ||
        o.recipientPhone.includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black">بوابة موظف العمليات والفرز الميداني</h1>
                <span className="text-[11px] bg-blue-500/20 text-blue-300 font-bold px-2 py-0.5 rounded border border-blue-500/30">
                  فرز المستودع والشحنات
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                استلام الطرود الواردة، قراءة الباركود، الفرز حسب المحافظات، وتسليم الكباتن
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenScanner}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Scan className="w-4 h-4" />
            <span>تشغيل ماسح الباركود</span>
          </button>

          {onOpenWaybillBatch && filteredOrders.length > 0 && (
            <button
              type="button"
              onClick={() => onOpenWaybillBatch(filteredOrders)}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-950" />
              <span>طباعة بوالص المرحلة حرارياً ({filteredOrders.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Operational Stage Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => setActiveTab('INBOUND')}
          className={`p-4 rounded-2xl border text-right transition-all flex items-center justify-between ${
            activeTab === 'INBOUND'
              ? 'bg-amber-500/10 border-amber-500 text-amber-950 ring-2 ring-amber-500/20 shadow-xs'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <div>
            <div className="text-xs font-bold text-slate-500">المرحلة 1: الطرود الواردة للفرع</div>
            <div className="text-base font-black mt-0.5">استلام وتأكيد الطرود</div>
          </div>
          <span className="text-xl font-mono font-black text-amber-600 bg-amber-100 px-3 py-1 rounded-xl">
            {inboundOrders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('HUB_SORT')}
          className={`p-4 rounded-2xl border text-right transition-all flex items-center justify-between ${
            activeTab === 'HUB_SORT'
              ? 'bg-blue-500/10 border-blue-500 text-blue-950 ring-2 ring-blue-500/20 shadow-xs'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <div>
            <div className="text-xs font-bold text-slate-500">المرحلة 2: داخل المستودع والرفوف</div>
            <div className="text-base font-black mt-0.5">الفرز والطباعة وتجهيز المنفست</div>
          </div>
          <span className="text-xl font-mono font-black text-blue-600 bg-blue-100 px-3 py-1 rounded-xl">
            {inHubOrders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('OUTBOUND_DISPATCH')}
          className={`p-4 rounded-2xl border text-right transition-all flex items-center justify-between ${
            activeTab === 'OUTBOUND_DISPATCH'
              ? 'bg-emerald-500/10 border-emerald-500 text-emerald-950 ring-2 ring-emerald-500/20 shadow-xs'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <div>
            <div className="text-xs font-bold text-slate-500">المرحلة 3: تسليم الكباتن</div>
            <div className="text-base font-black mt-0.5">جاري التوصيل الميداني</div>
          </div>
          <span className="text-xl font-mono font-black text-emerald-600 bg-emerald-100 px-3 py-1 rounded-xl">
            {outboundOrders.length}
          </span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px]">
            <input
              type="text"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              placeholder="مسح أو إدخال رقم البوليصة ORD-..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 pr-9 text-xs text-slate-900 font-mono focus:bg-white focus:ring-2 focus:ring-amber-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          </div>

          <select
            value={selectedGovernorate}
            onChange={(e) => setSelectedGovernorate(e.target.value)}
            className="text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl p-2 text-slate-800 focus:ring-2 focus:ring-amber-500"
          >
            <option value="ALL">جميع المحافظات</option>
            <option value="عمان">عمان</option>
            <option value="إربد">إربد</option>
            <option value="الزرقاء">الزرقاء</option>
            <option value="العقبة">العقبة</option>
            <option value="السلط">السلط</option>
            <option value="المفرق">المفرق</option>
          </select>
        </div>

        <span className="text-xs text-slate-500 font-bold">
          عدد الطرود المعروضة: <strong className="text-slate-900">{filteredOrders.length}</strong>
        </span>
      </div>

      {/* Orders List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="p-3.5">البوليصة</th>
                <th className="p-3.5">المرسل (التاجر)</th>
                <th className="p-3.5">الوجهة (المحافظة والمنطقة)</th>
                <th className="p-3.5">المستلم والهاتف</th>
                <th className="p-3.5">تعيين الكابتن</th>
                <th className="p-3.5">الحالة الحالية</th>
                <th className="p-3.5 text-center">إجراءات الموظف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    لا توجد طرود في هذه المرحلة حالياً
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5">
                      <div className="font-mono font-black text-slate-900 text-sm">{ord.sequence}</div>
                      <div className="text-[10px] text-slate-400">{formatDate(ord.createdAt)}</div>
                    </td>
                    <td className="p-3.5 font-bold text-slate-800">
                      {ord.merchant?.commercialName || ord.merchant?.name || '—'}
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{ord.governorate}</div>
                      <div className="text-[11px] text-slate-500">{ord.area}</div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-800">{ord.recipientName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{ord.recipientPhone}</div>
                    </td>
                    <td className="p-3.5">
                      <select
                        value={ord.driverId || ''}
                        onChange={(e) => onAssignDriver(ord.id, e.target.value)}
                        className="text-[11px] font-bold bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-slate-800"
                      >
                        <option value="">-- اختر الكابتن --</option>
                        {drivers.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.city || 'عمان'})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3.5">
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800">
                        {ord.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Quick action based on stage */}
                        {ord.status !== 'RECEIVED_AT_HUB' && (
                          <button
                            type="button"
                            onClick={() => onChangeOrderStatus(ord.id, 'RECEIVED_AT_HUB')}
                            className="px-2.5 py-1 text-[11px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md border border-blue-200 transition-colors"
                          >
                            تأكيد وصول للمستودع
                          </button>
                        )}
                        {ord.status === 'RECEIVED_AT_HUB' && (
                          <button
                            type="button"
                            onClick={() => onChangeOrderStatus(ord.id, 'OUT_FOR_DELIVERY')}
                            className="px-2.5 py-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md border border-emerald-200 transition-colors"
                          >
                            تسليم للكابتن للتوصيل
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onOpenWaybill(ord)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                          title="طباعة البوليصة الحرارية"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

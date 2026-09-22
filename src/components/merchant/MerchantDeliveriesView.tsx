import React, { useState } from 'react';
import { Truck, Search, MapPin, Phone, Clock, CheckCircle2, AlertCircle, Printer, Eye } from 'lucide-react';
import { Order } from '../../types/logistics';

interface MerchantDeliveriesViewProps {
  orders: Order[];
  onOpenWaybill: (order: Order) => void;
  onViewOrderDetails: (order: Order) => void;
}

export const MerchantDeliveriesView: React.FC<MerchantDeliveriesViewProps> = ({
  orders,
  onOpenWaybill,
  onViewOrderDetails,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState<'ALL' | 'OUT_FOR_DELIVERY' | 'PENDING'>('ALL');

  // Filter deliveries
  const deliveryOrders = orders.filter((o) =>
    ['PENDING', 'PICKING', 'RECEIVED_AT_HUB', 'OUT_FOR_DELIVERY'].includes(o.status)
  );

  const filteredDeliveries = deliveryOrders.filter((o) => {
    if (deliveryFilter === 'OUT_FOR_DELIVERY' && o.status !== 'OUT_FOR_DELIVERY') return false;
    if (deliveryFilter === 'PENDING' && o.status === 'OUT_FOR_DELIVERY') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        o.sequence.toLowerCase().includes(q) ||
        o.recipientName.toLowerCase().includes(q) ||
        o.recipientPhone.includes(q) ||
        o.area.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header Info Banner */}
      <div className="bg-slate-900 text-white p-5 rounded-3xl border border-slate-800 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-black text-base">متابعة الشحنات والتوصيل الميداني</h2>
            <p className="text-xs text-slate-400">
              عرض تفصيلي لحالة الشحنات القائمة لدى كباتن ومراكز شحن DELIVERE (مشتقة من السجل المعتمد)
            </p>
          </div>
        </div>

        <span className="text-xs font-black bg-amber-500 text-slate-950 px-3 py-1 rounded-full">
          {deliveryOrders.length} شحنة قيد التوصيل
        </span>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث برقم البوليصة، اسم المستلم، الهاتف..."
            className="w-full pr-9 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setDeliveryFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
              deliveryFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            الكل ({deliveryOrders.length})
          </button>

          <button
            onClick={() => setDeliveryFilter('OUT_FOR_DELIVERY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
              deliveryFilter === 'OUT_FOR_DELIVERY' ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 text-slate-600'
            }`}
          >
            مع الكابتن للمستلم
          </button>

          <button
            onClick={() => setDeliveryFilter('PENDING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
              deliveryFilter === 'PENDING' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            بانتظار الاستلام بالمستودع
          </button>
        </div>
      </div>

      {/* Delivery Grid Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">البوليصة</th>
                <th className="py-3 px-4">المستلم والوجهة</th>
                <th className="py-3 px-4">رقم الهاتف</th>
                <th className="py-3 px-4">المبلغ المطلوب</th>
                <th className="py-3 px-4">الحالة التشغيلية</th>
                <th className="py-3 px-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDeliveries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    لا توجد شحنات جارية مطابقة للبحث
                  </td>
                </tr>
              ) : (
                filteredDeliveries.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {order.sequence}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{order.recipientName}</div>
                      <div className="text-[11px] text-slate-500">
                        {order.governorate} - {order.area}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">{order.recipientPhone}</td>
                    <td className="py-3 px-4 font-black text-slate-900">
                      {Number(order.merchantCollection).toFixed(3)} د.أ
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          order.status === 'OUT_FOR_DELIVERY'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {order.status === 'OUT_FOR_DELIVERY' ? 'مع كابتن التوصيل' : 'بانتظار الانطلاق'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onOpenWaybill(order)}
                          className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg font-bold flex items-center gap-1"
                          title="طباعة بوليصة الشحن"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>بوليصة</span>
                        </button>

                        <button
                          onClick={() => onViewOrderDetails(order)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                          title="عرض التتبع التفصيلي"
                        >
                          <Eye className="w-4 h-4" />
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

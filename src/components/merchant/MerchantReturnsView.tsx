import React, { useState } from 'react';
import { RotateCcw, Search, Printer, Eye, CheckCircle2, AlertCircle } from 'lucide-react';
import { Order } from '../../types/logistics';

interface MerchantReturnsViewProps {
  orders: Order[];
  onOpenWaybill: (order: Order) => void;
  onViewOrderDetails: (order: Order) => void;
}

export const MerchantReturnsView: React.FC<MerchantReturnsViewProps> = ({
  orders,
  onOpenWaybill,
  onViewOrderDetails,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter returned orders
  const returnedOrders = orders.filter((o) => o.status === 'RETURNED');

  const filteredReturns = returnedOrders.filter((o) => {
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
      {/* Header Banner */}
      <div className="bg-rose-950 text-white p-5 rounded-3xl border border-rose-800 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-black text-base">سجل المرتجهات وإعادة الاستلام بالمتجر</h2>
            <p className="text-xs text-rose-200/80">
              متابعة الشحنات المرتجعة والمرفوضة وتأكيد تسلمها النهائي بالمتجر مع تحرير الفواتير
            </p>
          </div>
        </div>

        <span className="text-xs font-black bg-rose-500 text-white px-3 py-1 rounded-full">
          {returnedOrders.length} طرد مرتجع
        </span>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs flex items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث برقم البوليصة، اسم المستلم، الهاتف..."
            className="w-full pr-9 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-rose-500"
          />
        </div>
      </div>

      {/* Returns Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">رقم البوليصة</th>
                <th className="py-3 px-4">المستلم والوجهة</th>
                <th className="py-3 px-4">الهاتف</th>
                <th className="py-3 px-4">قيمة البضاعة</th>
                <th className="py-3 px-4">حالة الإرجاع</th>
                <th className="py-3 px-4 text-center">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    لا توجد شحنات مرتجعة مطابقة لخيارات البحث
                  </td>
                </tr>
              ) : (
                filteredReturns.map((order) => (
                  <tr key={order.id} className="hover:bg-rose-50/30 transition-colors">
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
                      {Number(order.merchantCollection).toFixed(2)} د.أ
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                        مرتجع / بانتظار استلام المتجر
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onOpenWaybill(order)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold flex items-center gap-1"
                          title="طباعة بوليصة المرتجع"
                        >
                          <Printer className="w-3.5 h-3.5 text-slate-600" />
                          <span>بوليصة</span>
                        </button>

                        <button
                          onClick={() => onViewOrderDetails(order)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                          title="عرض التفاصيل"
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

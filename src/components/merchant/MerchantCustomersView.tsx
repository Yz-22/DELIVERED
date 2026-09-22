import React, { useState, useMemo } from 'react';
import { Users, Search, Phone, MapPin, Package, Calendar } from 'lucide-react';
import { Order } from '../../types/logistics';

interface MerchantCustomersViewProps {
  orders: Order[];
}

export const MerchantCustomersView: React.FC<MerchantCustomersViewProps> = ({ orders }) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Derive Customer Directory from unique recipient phone numbers in orders
  const derivedCustomers = useMemo(() => {
    const map = new Map<string, {
      name: string;
      phone: string;
      governorate: string;
      area: string;
      fullAddress: string;
      ordersCount: number;
      totalSpent: number;
      lastOrderDate: string;
    }>();

    orders.forEach((o) => {
      const phone = o.recipientPhone;
      if (!phone) return;

      const existing = map.get(phone);
      const orderAmount = Number(o.merchantCollection) || 0;
      const orderDate = o.createdAt || new Date().toISOString();

      if (existing) {
        existing.ordersCount += 1;
        existing.totalSpent += orderAmount;
        if (orderDate > existing.lastOrderDate) {
          existing.lastOrderDate = orderDate;
          existing.name = o.recipientName || existing.name;
          existing.governorate = o.governorate || existing.governorate;
          existing.area = o.area || existing.area;
          existing.fullAddress = o.fullAddress || existing.fullAddress;
        }
      } else {
        map.set(phone, {
          name: o.recipientName || 'عميل بدون اسم',
          phone: o.recipientPhone,
          governorate: o.governorate || 'عمان',
          area: o.area || 'المركز',
          fullAddress: o.fullAddress || '',
          ordersCount: 1,
          totalSpent: orderAmount,
          lastOrderDate: orderDate,
        });
      }
    });

    return Array.from(map.values());
  }, [orders]);

  const filteredCustomers = derivedCustomers.filter((c) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.area.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-5 rounded-3xl border border-slate-800 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-black text-base">دليل الزبائن المعتمد للجرود والمبيعات</h2>
            <p className="text-xs text-slate-400">
              دليل مشتق تلقائياً من سجل المعاملات وطلبات التوصيل السابقة (دليل زبائن مشتق)
            </p>
          </div>
        </div>

        <span className="text-xs font-black bg-indigo-600 text-white px-3 py-1 rounded-full">
          {derivedCustomers.length} عميل مسجل
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
            placeholder="ابحث باسم الزبون، رقم الهاتف، أو المنطقة..."
            className="w-full pr-9 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">اسم الزبون</th>
                <th className="py-3 px-4">رقم الهاتف</th>
                <th className="py-3 px-4">المنطقة والعنوان</th>
                <th className="py-3 px-4 text-center">عدد الطلبيات</th>
                <th className="py-3 px-4 text-center">إجمالي المشتروات</th>
                <th className="py-3 px-4">آخر معاملة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    لا يوجد زبائن مطاردين لخيارات البحث
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.phone} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{customer.name}</td>
                    <td className="py-3 px-4 font-mono text-slate-700">{customer.phone}</td>
                    <td className="py-3 px-4">
                      <div className="text-slate-800 font-semibold">
                        {customer.governorate} - {customer.area}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate max-w-xs">
                        {customer.fullAddress}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 font-mono font-bold">
                        {customer.ordersCount} طلبات
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-black text-slate-900">
                      {customer.totalSpent.toFixed(2)} د.أ
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {new Date(customer.lastOrderDate).toLocaleDateString('ar-JO')}
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

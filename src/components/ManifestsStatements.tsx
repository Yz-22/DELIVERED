import React, { useState } from 'react';
import {
  FileText,
  Printer,
  Download,
  Calendar,
  Truck,
  Building2,
  RotateCcw,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Package,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';
import { Order, User } from '../types/logistics';
import { formatCurrency, formatDate } from '../utils/logisticsHelpers';

interface ManifestsStatementsProps {
  orders: Order[];
  drivers: User[];
  merchants: User[];
  onPrintThermalBatch?: (orders: Order[]) => void;
}

export type ManifestCategory =
  | 'COLLECTION'        // كشوفات التحصيل
  | 'RETURNS'           // كشوفات المرتجع
  | 'DRIVER_RETURNS'    // كشوفات المرتجع للسائق
  | 'DISPATCH'          // كشوفات التوزيع
  | 'DRIVER_COLLECTION' // كشوفات السائقين
  | 'COMMISSION'        // كشف تحصيل العمولة
  | 'INTER_BRANCH';     // كشف المرتجع بين الفروع

export const ManifestsStatements: React.FC<ManifestsStatementsProps> = ({
  orders,
  drivers,
  merchants,
  onPrintThermalBatch,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ManifestCategory>('DISPATCH');
  const [filterState, setFilterState] = useState<'ACTIVE' | 'ALL'>('ACTIVE');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState<string>('ALL');
  const [selectedMerchantId, setSelectedMerchantId] = useState<string>('ALL');

  // Filter orders according to manifest category
  const manifestOrders = orders.filter((o) => {
    if (selectedDriverId !== 'ALL' && o.driverId !== selectedDriverId) return false;
    if (selectedMerchantId !== 'ALL' && o.merchantId !== selectedMerchantId) return false;

    if (selectedCategory === 'DISPATCH') {
      // Out for delivery or received at hub
      if (filterState === 'ACTIVE') {
        return o.status === 'OUT_FOR_DELIVERY' || o.status === 'RECEIVED_AT_HUB';
      }
      return true;
    }

    if (selectedCategory === 'COLLECTION' || selectedCategory === 'DRIVER_COLLECTION') {
      // Delivered with COD
      if (filterState === 'ACTIVE') {
        return o.status === 'DELIVERED';
      }
      return o.status === 'DELIVERED' || o.status === 'OUT_FOR_DELIVERY';
    }

    if (selectedCategory === 'RETURNS' || selectedCategory === 'DRIVER_RETURNS' || selectedCategory === 'INTER_BRANCH') {
      // Postponed or Returned
      if (filterState === 'ACTIVE') {
        return o.status === 'RETURNED' || o.status === 'POSTPONED';
      }
      return o.status === 'RETURNED';
    }

    return true;
  });

  const totalCodSum = manifestOrders.reduce((sum, o) => sum + (o.totalCollection || 0), 0);
  const totalFeesSum = manifestOrders.reduce((sum, o) => sum + (o.deliveryFee || 2.5), 0);

  const handlePrintStandardManifest = () => {
    window.print();
  };

  const handleExportExcel = () => {
    const headers = ['رقم الشحنة', 'المرسل (التاجر)', 'المستلم', 'الهاتف', 'المحافظة والمنطقة', 'الحالة', 'التحصيل COD', 'أجور التوصيل'];
    const rows = manifestOrders.map((o) => [
      o.sequence,
      o.merchant?.commercialName || o.merchant?.name || '—',
      o.recipientName,
      o.recipientPhone,
      `${o.governorate} - ${o.area}`,
      o.status,
      o.totalCollection.toFixed(2),
      o.deliveryFee.toFixed(2),
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `كشف_${selectedCategory}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900">الكشوفات والمنفست اللوجستي</h1>
            <span className="text-xs bg-amber-500/15 text-amber-900 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
              إدارة كشوفات التوزيع والتحصيل والمرتجعات
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            إصدار منفيست الكباتن الميداني، كشوفات تحصيل مبالغ الـ COD، وتسويات المرتجعات بين الفروع
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onPrintThermalBatch && manifestOrders.length > 0 && (
            <button
              type="button"
              onClick={() => onPrintThermalBatch(manifestOrders)}
              className="px-3.5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-950" />
              <span>طباعة بوالص الكشف حرارياً ({manifestOrders.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تصدير Excel / CSV</span>
          </button>
        </div>
      </div>

      {/* Manifest Categories Selector Bar (Matching ERP screenshot 1) */}
      <div className="bg-slate-900 text-white p-2 rounded-2xl shadow-xs overflow-x-auto flex items-center gap-1.5 text-xs font-bold">
        {[
          { key: 'DISPATCH', label: 'كشوفات التوزيع (Run Sheets)' },
          { key: 'COLLECTION', label: 'كشوفات التحصيل (COD)' },
          { key: 'DRIVER_COLLECTION', label: 'كشوفات السائقين' },
          { key: 'RETURNS', label: 'كشوفات المرتجع' },
          { key: 'DRIVER_RETURNS', label: 'كشوفات المرتجع للسائق' },
          { key: 'COMMISSION', label: 'كشف تحصيل العمولة' },
          { key: 'INTER_BRANCH', label: 'كشف المرتجع بين الفروع' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setSelectedCategory(tab.key as ManifestCategory)}
            className={`px-3 py-2 rounded-xl whitespace-nowrap transition-all ${
              selectedCategory === tab.key
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter and Summary Ribbon */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Active / All Switch */}
          <div className="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-300 text-xs font-bold">
            <button
              type="button"
              onClick={() => setFilterState('ACTIVE')}
              className={`px-3 py-1 rounded-md transition-all ${
                filterState === 'ACTIVE'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الكشوفات النشطة
            </button>
            <button
              type="button"
              onClick={() => setFilterState('ALL')}
              className={`px-3 py-1 rounded-md transition-all ${
                filterState === 'ALL'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              جميع الكشوفات المكتملة
            </button>
          </div>

          {/* Filter by Driver */}
          <select
            value={selectedDriverId}
            onChange={(e) => setSelectedDriverId(e.target.value)}
            className="text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl p-2 text-slate-800 focus:ring-2 focus:ring-amber-500"
          >
            <option value="ALL">جميع الكباتن</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                كابتن: {d.name}
              </option>
            ))}
          </select>

          {/* Filter by Merchant */}
          <select
            value={selectedMerchantId}
            onChange={(e) => setSelectedMerchantId(e.target.value)}
            className="text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl p-2 text-slate-800 focus:ring-2 focus:ring-amber-500"
          >
            <option value="ALL">جميع التجار</option>
            {merchants.map((m) => (
              <option key={m.id} value={m.id}>
                {m.commercialName || m.name}
              </option>
            ))}
          </select>
        </div>

        {/* Financial Summary Badges */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-right">
            <span className="text-[10px] text-slate-500 font-bold block">إجمالي الطرود</span>
            <span className="text-sm font-black font-mono text-slate-900">{manifestOrders.length} طرد</span>
          </div>

          <div className="bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 text-right">
            <span className="text-[10px] text-emerald-700 font-bold block">مجموع التحصيل (COD)</span>
            <span className="text-sm font-black font-mono text-emerald-800">{formatCurrency(totalCodSum)}</span>
          </div>

          <div className="bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200 text-right">
            <span className="text-[10px] text-blue-700 font-bold block">أجور التوصيل الصافية</span>
            <span className="text-sm font-black font-mono text-blue-800">{formatCurrency(totalFeesSum)}</span>
          </div>
        </div>
      </div>

      {/* Manifest Data Sheet */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="p-3.5">#</th>
                <th className="p-3.5">رقم البوليصة</th>
                <th className="p-3.5">المرسل (التاجر)</th>
                <th className="p-3.5">المستلم والعنوان</th>
                <th className="p-3.5">الكابتن المسؤول</th>
                <th className="p-3.5">حالة الطرد</th>
                <th className="p-3.5">المبلغ المطلوب (COD)</th>
                <th className="p-3.5">أجور التوصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {manifestOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    لا يوجد طرود مسجلة في هذا الكشف حالياً
                  </td>
                </tr>
              ) : (
                manifestOrders.map((ord, idx) => (
                  <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-mono text-slate-400">{idx + 1}</td>
                    <td className="p-3.5">
                      <div className="font-mono font-black text-slate-900">{ord.sequence}</div>
                      <div className="text-[10px] text-slate-400">{formatDate(ord.createdAt)}</div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-800">
                        {ord.merchant?.commercialName || ord.merchant?.name || '—'}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{ord.recipientName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{ord.recipientPhone}</div>
                      <div className="text-[11px] text-slate-600 truncate max-w-[180px]">
                        {ord.governorate} - {ord.area}
                      </div>
                    </td>
                    <td className="p-3.5">
                      {ord.driver ? (
                        <span className="font-bold text-slate-800">{ord.driver.name}</span>
                      ) : (
                        <span className="text-amber-600 font-semibold text-[11px]">غير معين</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800">
                        {ord.status}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono font-black text-slate-900">
                      {formatCurrency(ord.totalCollection)}
                    </td>
                    <td className="p-3.5 font-mono text-slate-600 font-bold">
                      {formatCurrency(ord.deliveryFee)}
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

import React from 'react';
import {
  TrendingUp,
  Package,
  CheckCircle2,
  DollarSign,
  Truck,
  Users,
  AlertTriangle,
  Award,
} from 'lucide-react';
import { Order, User } from '../types/logistics';
import { formatCurrency, GOVERNORATES } from '../utils/logisticsHelpers';

interface KpiSummaryViewProps {
  orders: Order[];
  drivers: User[];
  stats: {
    total: number;
    pending: number;
    picking: number;
    out_for_delivery: number;
    delivered: number;
    cancelled: number;
    postponed: number;
    totalCOD: number;
    totalDeliveryFees: number;
  };
}

export const KpiSummaryView: React.FC<KpiSummaryViewProps> = ({ orders, drivers, stats }) => {
  const successRate = stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0;
  const netMerchantTotal = Math.max(0, stats.totalCOD - stats.totalDeliveryFees);

  // Governorate distribution
  const govCounts: { [key: string]: number } = {};
  orders.forEach((o) => {
    govCounts[o.governorate] = (govCounts[o.governorate] || 0) + 1;
  });

  return (
    <div className="space-y-6">
      {/* 4 Big High-Level KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>نسبة إنجاز التسليم</span>
            <Award className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 font-mono">{successRate}%</div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${successRate}%` }}
            ></div>
          </div>
          <div className="text-[11px] text-slate-400">من إجمالي {stats.total} طرد مسجل</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>إجمالي تحصيل الكاش (COD)</span>
            <DollarSign className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-3xl font-black text-emerald-900 font-mono">
            {formatCurrency(stats.totalCOD)}
          </div>
          <div className="text-[11px] text-emerald-700 font-medium">
            يشمل مستحقات التجار وأجور التوصيل
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>أجور وريعية التوصيل</span>
            <TrendingUp className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-3xl font-black text-indigo-900 font-mono">
            {formatCurrency(stats.totalDeliveryFees)}
          </div>
          <div className="text-[11px] text-slate-400">إيرادات شركة النقل والخدمات اللوجستية</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>صافي مستحقات المتاجر</span>
            <Users className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-3xl font-black text-slate-900 font-mono">
            {formatCurrency(netMerchantTotal)}
          </div>
          <div className="text-[11px] text-slate-400">جاهزة للتسوية والتحويل للتاجر عبر كليك/بنك</div>
        </div>
      </div>

      {/* Driver Performance & Area Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Driver Performance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
            <Truck className="w-4 h-4 text-amber-600" />
            أداء الكباتن والسائقين اليومي
          </h3>
          <div className="divide-y divide-slate-100">
            {drivers.map((driver) => {
              const driverOrders = orders.filter((o) => o.driverId === driver.id);
              const delivered = driverOrders.filter((o) => o.status === 'DELIVERED').length;
              const active = driverOrders.filter((o) => o.status === 'OUT_FOR_DELIVERY').length;
              const totalMoney = driverOrders
                .filter((o) => o.status === 'DELIVERED')
                .reduce((s, o) => s + (o.totalCollection || 0), 0);

              return (
                <div key={driver.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-900">{driver.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {driver.vehicleType || 'مركبة كابتن'} • {driver.city}
                    </div>
                  </div>
                  <div className="text-left flex items-center gap-3 font-mono">
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">
                      {delivered} سلمت
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold">
                      {active} قيد التوصيل
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      {formatCurrency(totalMoney)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Geographic Distribution */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
            <Package className="w-4 h-4 text-amber-600" />
            توزيع الشحنات جغرافياً حسب المحافظات
          </h3>
          <div className="space-y-3">
            {Object.entries(govCounts).map(([gov, count]) => {
              const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
              return (
                <div key={gov} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>{gov}</span>
                    <span className="font-mono">
                      {count} طرد ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-amber-500 h-2 rounded-full"
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

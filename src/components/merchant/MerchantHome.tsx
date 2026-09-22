import React from 'react';
import {
  AlertCircle,
  Package,
  Truck,
  RotateCcw,
  Boxes,
  DollarSign,
  PlusCircle,
  Store,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Send,
  Building2,
  CreditCard,
  ChevronLeft,
  Sparkles,
  TrendingUp,
  FileText
} from 'lucide-react';
import { Order, User } from '../../types/logistics';
import { MerchantTab } from './MerchantWorkspaceNav';

interface MerchantHomeProps {
  currentMerchant: User;
  merchantOrders: Order[];
  warehouseProducts: any[];
  isLoading: boolean;
  error?: string | null;
  onNavigateTab: (tab: MerchantTab) => void;
  onOpenWaybill: (order: Order) => void;
  onOpenNewShipmentModal: () => void;
  onOpenPos: () => void;
}

export const MerchantHome: React.FC<MerchantHomeProps> = ({
  currentMerchant,
  merchantOrders,
  warehouseProducts,
  isLoading,
  error,
  onNavigateTab,
  onOpenWaybill,
  onOpenNewShipmentModal,
  onOpenPos,
}) => {
  // Operational Metrics Computation
  const totalShipments = merchantOrders.length;
  const pendingShipments = merchantOrders.filter((o) => o.status === 'PENDING');
  const activeDeliveries = merchantOrders.filter((o) => o.status === 'OUT_FOR_DELIVERY');
  const deliveredShipments = merchantOrders.filter((o) => o.status === 'DELIVERED');
  const returnedShipments = merchantOrders.filter((o) => o.status === 'RETURNED');

  // Low Stock Computation
  const lowStockProducts = warehouseProducts.filter(
    (p) => Number(p.stockQuantity) <= Number(p.minStockAlert ?? 5)
  );

  // Financial Metrics Computation (Pending Settlement)
  const pendingDelivered = deliveredShipments.filter((o) => !o.isSettledWithMerchant);
  const pendingGoods = pendingDelivered.reduce((sum, o) => sum + (Number(o.merchantCollection) || 0), 0);
  const pendingFees = pendingDelivered.reduce((sum, o) => sum + (Number(o.deliveryFee) || 0), 0);
  const netDueToMerchant = pendingGoods - pendingFees;

  const settledHistory = deliveredShipments.filter((o) => o.isSettledWithMerchant);
  const totalSettledAmount = settledHistory.reduce(
    (sum, o) => sum + ((Number(o.merchantCollection) || 0) - (Number(o.deliveryFee) || 0)),
    0
  );

  // Success rate
  const successRate = totalShipments > 0 ? Math.round((deliveredShipments.length / totalShipments) * 100) : 0;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-32 bg-slate-200 rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-40 bg-slate-200 rounded-3xl" />
          <div className="h-40 bg-slate-200 rounded-3xl" />
          <div className="h-40 bg-slate-200 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 text-rose-900 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
        <div className="font-bold text-sm">عذراً، حدث خطأ أثناء تحميل بيانات لوحة التحكم</div>
        <p className="text-xs text-rose-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Merchant Header Context Banner */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-xl border border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 flex items-center justify-center font-black text-2xl shadow-md shrink-0">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-xs bg-amber-500/20 text-amber-300 font-bold px-2.5 py-0.5 rounded-full border border-amber-500/30">
                منصة التاجر المعتمدة DELIVERE OS
              </span>
              <span className="text-[10px] text-slate-400">حساب متجر معتمد</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
              {currentMerchant?.commercialName || currentMerchant?.name}
            </h1>
            <p className="text-xs text-slate-300">
              {currentMerchant?.commercialType || 'تجارة عامة'}{currentMerchant?.branch ? ` | الفرع: ${currentMerchant.branch}` : ''} | هاتف: {currentMerchant?.phone} | {currentMerchant?.city || 'عمان'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenPos}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-95 transition-all cursor-pointer border border-amber-300"
          >
            <Store className="w-4 h-4" />
            <span>⚡ الكاشير السريع POS</span>
          </button>

          <button
            onClick={onOpenNewShipmentModal}
            className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-2 border border-slate-700 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-amber-400" />
            <span>إضافة شحنة</span>
          </button>
        </div>
      </div>

      {/* 1. ATTENTION FIRST PANEL */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-5 text-amber-950">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-amber-500/20">
          <div className="flex items-center gap-2 font-black text-sm text-amber-900">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <span>تنفيذ المهام المتطلبة للانتباه اليوم</span>
          </div>
          <span className="text-[11px] bg-amber-500/20 text-amber-900 px-2.5 py-0.5 rounded-full font-bold">
            بيانات تشغيلية حالية
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Pending Shipments */}
          <div
            onClick={() => onNavigateTab('orders')}
            className="bg-white/90 hover:bg-white rounded-2xl p-3.5 border border-amber-200/80 shadow-xs cursor-pointer transition-all hover:scale-102"
          >
            <div className="text-[11px] font-bold text-slate-600 flex items-center justify-between">
              <span>شحنات جديدة بانتظار التجهيز</span>
              <Package className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">{pendingShipments.length}</div>
            <div className="text-[10px] text-amber-700 font-bold mt-1 flex items-center gap-1">
              <span>انقر للاستعراض والتجهيز</span>
              <ChevronLeft className="w-3 h-3" />
            </div>
          </div>

          {/* Active Deliveries */}
          <div
            onClick={() => onNavigateTab('deliveries')}
            className="bg-white/90 hover:bg-white rounded-2xl p-3.5 border border-amber-200/80 shadow-xs cursor-pointer transition-all hover:scale-102"
          >
            <div className="text-[11px] font-bold text-slate-600 flex items-center justify-between">
              <span>شحنات جاري توصيلها مع الكباتن</span>
              <Truck className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">{activeDeliveries.length}</div>
            <div className="text-[10px] text-blue-700 font-bold mt-1 flex items-center gap-1">
              <span>تتبع مسار الكباتن</span>
              <ChevronLeft className="w-3 h-3" />
            </div>
          </div>

          {/* Returned Shipments */}
          <div
            onClick={() => onNavigateTab('returns')}
            className="bg-white/90 hover:bg-white rounded-2xl p-3.5 border border-amber-200/80 shadow-xs cursor-pointer transition-all hover:scale-102"
          >
            <div className="text-[11px] font-bold text-slate-600 flex items-center justify-between">
              <span>الشحنات المرتجعة المسجلة</span>
              <RotateCcw className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-black text-rose-600 mt-1">{returnedShipments.length}</div>
            <div className="text-[10px] text-rose-700 font-bold mt-1 flex items-center gap-1">
              <span>استعراض المرتجعات</span>
              <ChevronLeft className="w-3 h-3" />
            </div>
          </div>

          {/* Low Stock Alerts */}
          <div
            onClick={() => onNavigateTab('warehouse')}
            className="bg-white/90 hover:bg-white rounded-2xl p-3.5 border border-amber-200/80 shadow-xs cursor-pointer transition-all hover:scale-102"
          >
            <div className="text-[11px] font-bold text-slate-600 flex items-center justify-between">
              <span>تنبيهات الأصناف منخفضة المخزون</span>
              <Boxes className="w-4 h-4 text-orange-600" />
            </div>
            <div className="text-2xl font-black text-orange-600 mt-1">{lowStockProducts.length}</div>
            <div className="text-[10px] text-orange-700 font-bold mt-1 flex items-center gap-1">
              <span>إعادة جرد المخزن</span>
              <ChevronLeft className="w-3 h-3" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. MAIN FINANCIAL & OPERATIONAL DASHBOARD STRIP */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Net Wallet Balance & Payout */}
        <div className="bg-gradient-to-br from-emerald-900 to-emerald-950 text-white rounded-3xl p-5 border border-emerald-800 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-emerald-300 font-bold mb-2">
              <span>صافي المستحق التقديري للشحنات المسلمة</span>
              <CreditCard className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-emerald-400">
              {netDueToMerchant.toFixed(2)} <span className="text-sm font-normal text-emerald-200">د.أ</span>
            </div>
            <p className="text-xs text-emerald-200/80 mt-2">
              تقدير صافي قيمة البضائع المسلّمة ({pendingDelivered.length} طرد) بعد خصم أجور التوصيل.
            </p>
          </div>

          <button
            onClick={() => onNavigateTab('finance')}
            className="w-full mt-4 py-2.5 rounded-2xl text-xs font-black flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md transition-all cursor-pointer"
          >
            <CreditCard className="w-4 h-4" />
            <span>مراجعة كشف الحساب والذمم</span>
          </button>
        </div>

        {/* Deliveries Success Overview */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold mb-2">
              <span>معدل نجاح التوصيل التاريخي</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-3xl font-black text-slate-900">
              {successRate}%
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-3">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${successRate}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              تم تسليم {deliveredShipments.length} شحنة بنجاح من إجمالي {totalShipments} طلبية.
            </p>
          </div>

          <button
            onClick={() => onNavigateTab('orders')}
            className="w-full mt-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
          >
            <span>استعراض سجل جميع الشحنات</span>
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Total Settled History */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold mb-2">
              <span>إجمالي المبالغ المسواة سابقاً</span>
              <DollarSign className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-3xl font-black text-slate-900">
              {totalSettledAmount.toFixed(2)} <span className="text-sm font-normal text-slate-500">د.أ</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              مجموع التحويلات المالية المستلمة بحسابك البنكي عن {settledHistory.length} شحنة.
            </p>
          </div>

          <button
            onClick={() => onNavigateTab('finance')}
            className="w-full mt-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-2xl text-xs font-bold flex items-center justify-center gap-1 border border-amber-200 transition-all cursor-pointer"
          >
            <span>عرض كشوفات الحساب والفيش</span>
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3. RECENT ORDERS QUICK LIST */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 font-black text-sm text-slate-900">
            <Package className="w-4 h-4 text-amber-500" />
            <span>آخر الطلبات والشحنات المسجلة</span>
          </div>

          <button
            onClick={() => onNavigateTab('orders')}
            className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1"
          >
            <span>عرض الكل ({merchantOrders.length})</span>
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {merchantOrders.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            لا توجد شحنات مسجلة حالياً. استخدم زر "إضافة شحنة" لإنشاء طلبية جديدة.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-3">رقم البوليصة</th>
                  <th className="py-2.5 px-3">المستلم والوجهة</th>
                  <th className="py-2.5 px-3">الهاتف</th>
                  <th className="py-2.5 px-3">ثمن البضاعة</th>
                  <th className="py-2.5 px-3">الحالة التشغيلية</th>
                  <th className="py-2.5 px-3 text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {merchantOrders.slice(0, 5).map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                      {order.sequence}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{order.recipientName}</div>
                      <div className="text-[10px] text-slate-500">
                        {order.governorate} - {order.area}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">{order.recipientPhone}</td>
                    <td className="py-2.5 px-3 font-black text-slate-900">
                      {Number(order.merchantCollection).toFixed(2)} د.أ
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          order.status === 'DELIVERED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : order.status === 'OUT_FOR_DELIVERY'
                            ? 'bg-amber-100 text-amber-800'
                            : order.status === 'RETURNED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {order.status === 'DELIVERED'
                          ? 'تم التسليم'
                          : order.status === 'OUT_FOR_DELIVERY'
                          ? 'مع الكابتن'
                          : order.status === 'RETURNED'
                          ? 'مرتجع'
                          : 'بانتظار الاستلام'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => onOpenWaybill(order)}
                        className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-[11px] font-bold transition-all"
                      >
                        طباعة البوليصة
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

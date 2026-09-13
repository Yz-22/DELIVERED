import React, { useState } from 'react';
import {
  MessageSquare,
  Printer,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  ExternalLink,
  MapPin,
  Clock,
  Truck,
  CheckCircle2,
  CalendarClock,
  XCircle,
  Package,
  User,
  Store,
  ChevronDown,
  Eye,
} from 'lucide-react';
import { Order, OrderStatus, User as UserType } from '../types/logistics';
import {
  formatCurrency,
  formatDate,
  formatWhatsAppUrl,
  buildRecipientWhatsAppMessage,
  buildMerchantWhatsAppMessage,
  STATUS_CONFIG,
} from '../utils/logisticsHelpers';

interface OrdersDataGridProps {
  orders: Order[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onViewDetails: (order: Order) => void;
  onPrintWaybill: (order: Order) => void;
  onChangeStatus: (orderId: string, newStatus: OrderStatus) => void;
  onAssignDriver: (orderId: string, driverId: string) => void;
  drivers: UserType[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  onPageChange: (newPage: number) => void;
  onLimitChange: (newLimit: number) => void;
  groupBy: 'none' | 'status' | 'governorate' | 'merchant' | 'driver';
  isLoading: boolean;
}

export const OrdersDataGrid: React.FC<OrdersDataGridProps> = ({
  orders,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onViewDetails,
  onPrintWaybill,
  onChangeStatus,
  onAssignDriver,
  drivers,
  pagination,
  onPageChange,
  onLimitChange,
  groupBy,
  isLoading,
}) => {
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);

  const allSelected = orders.length > 0 && orders.every((o) => selectedIds.includes(o.id));
  const someSelected = orders.some((o) => selectedIds.includes(o.id)) && !allSelected;

  // Grouping helper
  const renderRows = () => {
    if (groupBy === 'none') {
      return orders.map((order) => renderOrderRow(order));
    }

    // Grouping dictionary
    const groups: { [key: string]: Order[] } = {};
    orders.forEach((order) => {
      let key = 'غير محدد';
      if (groupBy === 'status') {
        key = STATUS_CONFIG[order.status]?.label || order.status;
      } else if (groupBy === 'governorate') {
        key = order.governorate || 'غير محدد';
      } else if (groupBy === 'merchant') {
        key = order.merchant?.commercialName || order.merchant?.name || 'متجر غير معروف';
      } else if (groupBy === 'driver') {
        key = order.driver?.name || 'بدون سائق (بانتظار تعيين)';
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(order);
    });

    return Object.entries(groups).map(([groupTitle, groupOrders]) => {
      const groupCOD = groupOrders.reduce((s, o) => s + (o.totalCollection || 0), 0);
      return (
        <React.Fragment key={groupTitle}>
          {/* Group Header Row */}
          <tr className="bg-slate-100/90 border-y border-slate-300 font-bold text-xs text-slate-800">
            <td colSpan={10} className="px-4 py-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  <span>{groupTitle}</span>
                  <span className="text-[11px] font-normal text-slate-500">
                    ({groupOrders.length} طلبية)
                  </span>
                </span>
                <span className="text-slate-700 font-mono text-[11px]">
                  مجموع التحصيل: {formatCurrency(groupCOD)}
                </span>
              </div>
            </td>
          </tr>
          {groupOrders.map((order) => renderOrderRow(order))}
        </React.Fragment>
      );
    });
  };

  // Render individual row
  const renderOrderRow = (order: Order) => {
    const isSelected = selectedIds.includes(order.id);
    const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;

    // Recipient WhatsApp Link
    const recipientMsg = buildRecipientWhatsAppMessage(
      order.recipientName,
      order.sequence,
      order.totalCollection,
      `${order.governorate} - ${order.area}`
    );
    const recipientWhatsAppUrl = formatWhatsAppUrl(order.recipientPhone, recipientMsg);

    // Merchant WhatsApp Link
    const merchantPhone = order.merchant?.phone || '';
    const merchantMsg = buildMerchantWhatsAppMessage(
      order.merchant?.name || 'التاجر المحترم',
      order.sequence,
      statusCfg.label
    );
    const merchantWhatsAppUrl = formatWhatsAppUrl(merchantPhone, merchantMsg);

    return (
      <tr
        key={order.id}
        className={`border-b border-slate-200 transition-colors hover:bg-slate-50/80 ${
          isSelected ? 'bg-amber-500/5' : ''
        }`}
      >
        {/* 1. Checkbox */}
        <td className="px-3 py-3 w-10 text-center">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(order.id)}
            className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
          />
        </td>

        {/* 2. Sequence & Reference */}
        <td className="px-3 py-3 whitespace-nowrap">
          <button
            onClick={() => onViewDetails(order)}
            className="group flex flex-col text-right focus:outline-none"
            title="عرض التفاصيل وتاريخ الشحنة"
          >
            <span className="font-mono font-bold text-xs text-amber-700 group-hover:text-amber-900 group-hover:underline flex items-center gap-1">
              {order.sequence}
              <Eye className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </span>
            {order.referenceNumber && (
              <span className="font-mono text-[10px] text-slate-400 tracking-wider">
                {order.referenceNumber}
              </span>
            )}
          </button>
        </td>

        {/* 3. Status Badge */}
        <td className="px-3 py-3 whitespace-nowrap">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.text.replace('text-', 'bg-')}`} />
            {statusCfg.label}
          </span>
        </td>

        {/* 4. Merchant & Merchant WhatsApp */}
        <td className="px-3 py-3 whitespace-nowrap">
          <div className="flex items-center justify-between gap-2 max-w-[170px]">
            <div className="truncate">
              <div className="text-xs font-bold text-slate-800 truncate" title={order.merchant?.name}>
                {order.merchant?.commercialName || order.merchant?.name || 'متجر غير محدد'}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                {order.merchant?.phone || 'لا يوجد هاتف'}
              </div>
            </div>
            {merchantPhone && (
              <a
                href={merchantWhatsAppUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 transition-colors shrink-0"
                title="فتح محادثة واتساب مع التاجر"
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </td>

        {/* 5. Recipient, Phone & Direct WhatsApp Action */}
        <td className="px-3 py-3 whitespace-nowrap">
          <div className="flex items-center justify-between gap-2 max-w-[190px]">
            <div className="truncate">
              <div className="text-xs font-bold text-slate-900 truncate">
                {order.recipientName}
              </div>
              <div className="text-[11px] text-slate-600 font-mono flex items-center gap-1">
                <span>{order.recipientPhone}</span>
              </div>
            </div>

            {/* Quick WhatsApp Button for Recipient (as requested) */}
            <a
              href={recipientWhatsAppUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-bold shadow-xs transition-colors shrink-0"
              title="مراسلة المستلم عبر واتساب مباشرة بتفاصيل الطلب والمبلغ"
            >
              <MessageSquare className="w-3 h-3 fill-current" />
              <span>واتساب</span>
            </a>
          </div>
        </td>

        {/* 6. Destination / Location */}
        <td className="px-3 py-3 whitespace-nowrap">
          <div className="flex items-center gap-1 text-xs font-medium text-slate-800">
            <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>{order.governorate}</span>
            <span className="text-slate-400">/</span>
            <span className="text-slate-700">{order.area}</span>
          </div>
          <div className="text-[10px] text-slate-400 truncate max-w-[150px]" title={order.fullAddress}>
            {order.subArea || order.fullAddress}
          </div>
        </td>

        {/* 7. Financials (Total Collection, Fee, COD) */}
        <td className="px-3 py-3 whitespace-nowrap text-left font-mono">
          <div className="text-xs font-black text-slate-900">
            {formatCurrency(order.totalCollection)}
          </div>
          <div className="text-[10px] text-slate-500">
            بضاعة: {order.merchantCollection.toFixed(1)} | توصيل: {order.deliveryFee.toFixed(1)}
          </div>
        </td>

        {/* 8. Driver Assignment */}
        <td className="px-3 py-3 whitespace-nowrap">
          <select
            value={order.driverId || ''}
            onChange={(e) => onAssignDriver(order.id, e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-md py-1 px-2 text-slate-800 focus:ring-1 focus:ring-amber-500 font-medium cursor-pointer"
          >
            <option value="">بدون سائق (تعيين الآن)</option>
            {drivers.map((drv) => (
              <option key={drv.id} value={drv.id}>
                {drv.name}
              </option>
            ))}
          </select>
        </td>

        {/* 9. Created Time */}
        <td className="px-3 py-3 whitespace-nowrap text-[11px] text-slate-500">
          {formatDate(order.createdAt)}
        </td>

        {/* 10. Actions Dropdown / Quick Tools */}
        <td className="px-3 py-3 whitespace-nowrap text-center relative">
          <div className="flex items-center justify-center gap-1">
            {/* Quick Print Waybill */}
            <button
              onClick={() => onPrintWaybill(order)}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
              title="طباعة ملصق البوليصة الحراري (40×60 مم)"
            >
              <Printer className="w-4 h-4 text-amber-600" />
            </button>

            {/* Quick Status Change Popover */}
            <div className="relative">
              <button
                onClick={() =>
                  setActiveActionMenuId(activeActionMenuId === order.id ? null : order.id)
                }
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                title="المزيد من الإجراءات"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {activeActionMenuId === order.id && (
                <div className="absolute left-0 top-8 w-44 bg-white border border-slate-200 rounded-lg shadow-xl z-20 p-1 text-right space-y-0.5">
                  <button
                    onClick={() => {
                      onViewDetails(order);
                      setActiveActionMenuId(null);
                    }}
                    className="w-full text-right px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded font-medium flex items-center gap-2"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                    <span>عرض التفاصيل والسجل</span>
                  </button>
                  <button
                    onClick={() => {
                      onPrintWaybill(order);
                      setActiveActionMenuId(null);
                    }}
                    className="w-full text-right px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded font-medium flex items-center gap-2"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-500" />
                    <span>طباعة البوليصة</span>
                  </button>

                  <div className="border-t border-slate-100 my-1"></div>
                  <div className="text-[10px] text-slate-400 px-2 py-0.5 font-bold">تغيير الحالة</div>

                  <button
                    onClick={() => {
                      onChangeStatus(order.id, 'OUT_FOR_DELIVERY');
                      setActiveActionMenuId(null);
                    }}
                    className="w-full text-right px-2.5 py-1 text-xs text-indigo-700 hover:bg-indigo-50 rounded"
                  >
                    جاري التوصيل
                  </button>
                  <button
                    onClick={() => {
                      onChangeStatus(order.id, 'DELIVERED');
                      setActiveActionMenuId(null);
                    }}
                    className="w-full text-right px-2.5 py-1 text-xs text-emerald-700 hover:bg-emerald-50 rounded font-bold"
                  >
                    تم التسليم بنجاح
                  </button>
                  <button
                    onClick={() => {
                      onChangeStatus(order.id, 'POSTPONED');
                      setActiveActionMenuId(null);
                    }}
                    className="w-full text-right px-2.5 py-1 text-xs text-orange-700 hover:bg-orange-50 rounded"
                  >
                    تأجيل الموعد
                  </button>
                  <button
                    onClick={() => {
                      onChangeStatus(order.id, 'CANCELLED');
                      setActiveActionMenuId(null);
                    }}
                    className="w-full text-right px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-50 rounded"
                  >
                    إلغاء الطلب
                  </button>
                </div>
              )}
            </div>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
      {/* Table Container with Horizontal Scroll */}
      <div className="overflow-x-auto min-h-[380px]">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="bg-slate-100/90 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider select-none">
              {/* Checkbox Column */}
              <th className="px-3 py-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = someSelected;
                  }}
                  onChange={onToggleSelectAll}
                  className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                />
              </th>
              <th className="px-3 py-3">رقم البوليصة / المرجع</th>
              <th className="px-3 py-3">الحالة</th>
              <th className="px-3 py-3">المتجر / التاجر</th>
              <th className="px-3 py-3">المستلم والواتساب</th>
              <th className="px-3 py-3">الوجهة والمنطقة</th>
              <th className="px-3 py-3 text-left font-mono">التحصيل (COD)</th>
              <th className="px-3 py-3">الكابتن / السائق</th>
              <th className="px-3 py-3">تاريخ الإنشاء</th>
              <th className="px-3 py-3 text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-sans">
            {isLoading ? (
              <tr>
                <td colSpan={10} className="text-center py-16 text-slate-500">
                  <div className="inline-flex items-center gap-2 font-bold text-sm">
                    <span className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></span>
                    <span>جاري تحميل بيانات الشحنات...</span>
                  </div>
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-16 text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Package className="w-10 h-10 text-slate-300" />
                    <span className="font-bold text-slate-700">لا توجد طلبيات مطابقة للبحث أو الفلتر</span>
                    <span className="text-xs text-slate-400">جرب تصفير الفلاتر أو إنشاء طلبية جديدة</span>
                  </div>
                </td>
              </tr>
            ) : (
              renderRows()
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination & Grid Footer */}
      <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-4">
          <span>
            عرض{' '}
            <strong className="text-slate-900">
              {orders.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0}
            </strong>{' '}
            إلى{' '}
            <strong className="text-slate-900">
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </strong>{' '}
            من إجمالي <strong className="text-slate-900">{pagination.total}</strong> طلبية
          </span>

          {/* Rows per page */}
          <div className="flex items-center gap-1.5">
            <span>عدد الصفوف:</span>
            <select
              value={pagination.limit}
              onChange={(e) => onLimitChange(parseInt(e.target.value))}
              className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 focus:ring-1 focus:ring-amber-500"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        {/* Page Switcher */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="p-1.5 rounded bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="الصفحة السابقة"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="px-3 py-1 font-semibold text-slate-800">
            صفحة {pagination.page} من {pagination.totalPages}
          </span>
          <button
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="p-1.5 rounded bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="الصفحة التالية"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

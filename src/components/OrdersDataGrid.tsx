/**
 * DELIVERE — ORDERS DATA GRID (PHASE 3C / STEP 4.3)
 *
 * Premium, high-density logistics order operations data grid.
 * Provides rapid scanning, filtering, selection, and safe status transitions.
 *
 * Architecture & Safety:
 * - Uses Step 2 Foundation Primitives (StatusBadge, Skeleton, EmptyState, Button, IconButton).
 * - Desktop (1440px / 1024px): High-density tabular layout with sticky header and tabular numerals.
 * - Mobile (390px): Dedicated responsive order cards with >=44px touch targets.
 * - Driver Privacy: Strictly suppresses merchant delivery fee, merchant collection, and internal margins for DRIVER role.
 * - Financial Semantics: Authoritative totalCollection with strict JOD formatting; zero client-side recalculations.
 * - Grouping: Supports grouping by status, governorate, merchant, and driver with aggregate totals.
 */

import React, { useState } from 'react';
import {
  Printer,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  MapPin,
  MessageSquare,
  Eye,
  Package,
  CheckCircle2,
  Clock,
  Ban,
  CalendarClock,
  Truck,
  ExternalLink,
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
import {
  StatusBadge,
  Skeleton,
  EmptyState,
  Button,
  IconButton,
} from './ui';

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
  userRole?: string;
  dir?: 'rtl' | 'ltr';
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
  userRole = 'ADMIN',
  dir = 'rtl',
}) => {
  const isRtl = dir === 'rtl';
  const isDriver = (userRole || '').toUpperCase() === 'DRIVER';
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);

  const allSelected = orders.length > 0 && orders.every((o) => selectedIds.includes(o.id));
  const someSelected = orders.some((o) => selectedIds.includes(o.id)) && !allSelected;

  // Grouping logic
  const renderDesktopRows = () => {
    if (groupBy === 'none') {
      return orders.map((order) => renderDesktopRow(order));
    }

    const groups: { [key: string]: Order[] } = {};
    orders.forEach((order) => {
      let key = isRtl ? 'غير محدد' : 'Unassigned';
      if (groupBy === 'status') {
        key = STATUS_CONFIG[order.status]?.label || order.status;
      } else if (groupBy === 'governorate') {
        key = order.governorate || (isRtl ? 'غير محدد' : 'Unspecified');
      } else if (groupBy === 'merchant') {
        key = order.merchant?.commercialName || order.merchant?.name || (isRtl ? 'متجر غير معروف' : 'Unknown Merchant');
      } else if (groupBy === 'driver') {
        key = order.driver?.name || (isRtl ? 'بدون كابتن مكلف (بانتظار تعيين)' : 'Unassigned Driver');
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(order);
    });

    return Object.entries(groups).map(([groupTitle, groupOrders]) => {
      const groupCOD = groupOrders.reduce((s, o) => s + (o.totalCollection || 0), 0);
      return (
        <React.Fragment key={groupTitle}>
          <tr className="bg-slate-950/80 border-y border-slate-800 font-bold text-xs text-amber-400">
            <td colSpan={10} className="px-3.5 py-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span className="text-white font-semibold">{groupTitle}</span>
                  <span className="text-[11px] font-normal text-slate-400 font-mono">
                    ({groupOrders.length} {isRtl ? 'شحنة' : 'orders'})
                  </span>
                </span>
                <span className="text-slate-300 font-mono text-xs">
                  {isRtl ? 'مجموع التحصيل:' : 'Total COD:'}{' '}
                  <strong className="text-white font-bold">{formatCurrency(groupCOD)}</strong>
                </span>
              </div>
            </td>
          </tr>
          {groupOrders.map((order) => renderDesktopRow(order))}
        </React.Fragment>
      );
    });
  };

  const renderDesktopRow = (order: Order) => {
    const isSelected = selectedIds.includes(order.id);

    const recipientMsg = buildRecipientWhatsAppMessage(
      order.recipientName,
      order.sequence,
      order.totalCollection,
      `${order.governorate} - ${order.area}`
    );
    const recipientWhatsAppUrl = formatWhatsAppUrl(order.recipientPhone, recipientMsg);

    const merchantPhone = order.merchant?.phone || '';
    const merchantMsg = buildMerchantWhatsAppMessage(
      order.merchant?.name || (isRtl ? 'التاجر المحترم' : 'Merchant'),
      order.sequence,
      STATUS_CONFIG[order.status]?.label || order.status
    );
    const merchantWhatsAppUrl = formatWhatsAppUrl(merchantPhone, merchantMsg);

    return (
      <tr
        key={order.id}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('input, select, button, a')) return;
          onViewDetails(order);
        }}
        className={`border-b border-slate-800/80 transition-colors cursor-pointer hover:bg-slate-800/50 text-xs ${
          isSelected ? 'bg-amber-500/10' : ''
        }`}
      >
        {/* 1. Checkbox */}
        <td className="px-3 py-2.5 w-9 text-center">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(order.id)}
            aria-label={`Select order ${order.sequence}`}
            className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500/40 focus:ring-offset-slate-950 cursor-pointer"
          />
        </td>

        {/* 2. Sequence & Tracking Reference */}
        <td className="px-3 py-2.5 whitespace-nowrap">
          <div className="flex flex-col">
            <span className="font-mono font-bold text-xs text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1">
              {order.sequence}
              <Eye className="w-3 h-3 text-slate-500 opacity-70" />
            </span>
            {order.referenceNumber && (
              <span className="font-mono text-[10px] text-slate-400 tracking-wider">
                {order.referenceNumber}
              </span>
            )}
          </div>
        </td>

        {/* 3. Status Badge */}
        <td className="px-3 py-2.5 whitespace-nowrap">
          <StatusBadge status={order.status} size="sm" />
        </td>

        {/* 4. Merchant */}
        <td className="px-3 py-2.5 whitespace-nowrap">
          <div className="flex items-center justify-between gap-1 max-w-[150px]">
            <div className="truncate">
              <div className="text-[11px] font-bold text-slate-200 truncate" title={order.merchant?.name}>
                {order.merchant?.commercialName || order.merchant?.name || (isRtl ? 'متجر غير محدد' : 'Unspecified')}
              </div>
              <div className="text-[10px] text-slate-400 font-mono truncate">
                {order.merchant?.phone || ''}
              </div>
            </div>
            {!isDriver && merchantPhone && (
              <a
                href={merchantWhatsAppUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors shrink-0"
                title={isRtl ? 'واتساب التاجر' : 'Merchant WhatsApp'}
                aria-label={isRtl ? 'واتساب التاجر' : 'Merchant WhatsApp'}
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </td>

        {/* 5. Recipient */}
        <td className="px-3 py-2.5 whitespace-nowrap">
          <div className="flex items-center justify-between gap-2 max-w-[190px]">
            <div className="truncate">
              <div className="text-xs font-bold text-white truncate">
                {order.recipientName}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {order.recipientPhone}
              </div>
            </div>
            <a
              href={recipientWhatsAppUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded text-[10px] font-bold shrink-0 transition-colors"
              title={isRtl ? 'واتساب المستلم' : 'Recipient WhatsApp'}
              aria-label={isRtl ? 'واتساب المستلم' : 'Recipient WhatsApp'}
            >
              <MessageSquare className="w-3 h-3 fill-current" />
              <span>{isRtl ? 'واتساب' : 'Chat'}</span>
            </a>
          </div>
        </td>

        {/* 6. Destination */}
        <td className="px-3 py-2.5 whitespace-nowrap">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-200">
            <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
            <span>{order.governorate}</span>
            <span className="text-slate-500">/</span>
            <span className="text-slate-300 font-medium">{order.area}</span>
          </div>
          <div className="text-[10px] text-slate-400 truncate max-w-[140px]" title={order.fullAddress}>
            {order.fullAddress}
          </div>
        </td>

        {/* 7. COD Collection (Strict Privacy Filter) */}
        <td className="px-3 py-2.5 whitespace-nowrap text-left font-mono">
          <div className="text-xs font-bold text-white">
            {formatCurrency(order.totalCollection)}
          </div>
          {!isDriver ? (
            <div className="text-[10px] text-slate-400">
              {isRtl ? 'بضاعة:' : 'Goods:'}{' '}
              {order.merchantCollection !== undefined ? formatCurrency(order.merchantCollection) : '—'}{' '}
              | {isRtl ? 'توصيل:' : 'Fee:'}{' '}
              {order.deliveryFee !== undefined ? formatCurrency(order.deliveryFee) : '—'}
            </div>
          ) : (
            <div className="text-[9px] text-emerald-400 font-bold">
              {isRtl ? 'شامل التوصيل' : 'Inc. Delivery'}
            </div>
          )}
        </td>

        {/* 8. Assigned Driver */}
        <td className="px-3 py-2.5 whitespace-nowrap">
          {!isDriver ? (
            <select
              value={order.driverId || ''}
              onChange={(e) => onAssignDriver(order.id, e.target.value)}
              aria-label={isRtl ? 'تعيين السائق' : 'Assign Driver'}
              className="text-xs bg-slate-950 border border-slate-700/80 rounded-md py-1 px-2 text-slate-200 font-medium cursor-pointer focus:outline-hidden focus:border-amber-500"
            >
              <option value="">{isRtl ? 'بدون سائق' : 'Unassigned'}</option>
              {drivers.map((drv) => (
                <option key={drv.id} value={drv.id}>
                  {drv.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs font-semibold text-slate-300">
              {order.driver?.name || (isRtl ? 'مكلف بي' : 'Assigned to Me')}
            </span>
          )}
        </td>

        {/* 9. Created Date */}
        <td className="px-3 py-2.5 whitespace-nowrap text-[11px] text-slate-400 font-mono">
          {formatDate(order.createdAt)}
        </td>

        {/* 10. Actions */}
        <td className="px-3 py-2.5 whitespace-nowrap text-center relative">
          <div className="flex items-center justify-center gap-1">
            <IconButton
              icon={<Printer className="w-3.5 h-3.5 text-amber-400" />}
              aria-label={isRtl ? 'طباعة البوليصة' : 'Print Waybill'}
              onClick={() => onPrintWaybill(order)}
              size="compact"
              variant="ghost"
              className="hover:bg-slate-800"
            />

            <div className="relative">
              <IconButton
                icon={<MoreVertical className="w-3.5 h-3.5 text-slate-400" />}
                aria-label={isRtl ? 'خيارات إضافية' : 'More Options'}
                onClick={() =>
                  setActiveActionMenuId(activeActionMenuId === order.id ? null : order.id)
                }
                size="compact"
                variant="ghost"
                className="hover:bg-slate-800"
              />

              {activeActionMenuId === order.id && (
                <div
                  className={`absolute ${
                    isRtl ? 'left-0' : 'right-0'
                  } top-8 w-44 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl z-30 p-1 text-right space-y-0.5 backdrop-blur-md`}
                >
                  <button
                    onClick={() => {
                      onViewDetails(order);
                      setActiveActionMenuId(null);
                    }}
                    className="w-full text-right px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800 rounded font-medium flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isRtl ? 'عرض التفاصيل' : 'View Details'}</span>
                  </button>

                  <button
                    onClick={() => {
                      onPrintWaybill(order);
                      setActiveActionMenuId(null);
                    }}
                    className="w-full text-right px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800 rounded font-medium flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isRtl ? 'طباعة بوليصة' : 'Print Waybill'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </td>
      </tr>
    );
  };

  // Dedicated Mobile Card Renderer (< md)
  const renderMobileCard = (order: Order) => {
    const isSelected = selectedIds.includes(order.id);
    const recipientMsg = buildRecipientWhatsAppMessage(
      order.recipientName,
      order.sequence,
      order.totalCollection,
      `${order.governorate} - ${order.area}`
    );
    const recipientWhatsAppUrl = formatWhatsAppUrl(order.recipientPhone, recipientMsg);

    return (
      <div
        key={order.id}
        className={`p-3.5 space-y-3 transition-colors ${
          isSelected ? 'bg-amber-500/10' : 'bg-slate-900/60'
        }`}
      >
        {/* Top Header: Checkbox + Sequence + Status */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(order.id)}
              aria-label={`Select order ${order.sequence}`}
              className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500 cursor-pointer"
            />
            <div>
              <span
                onClick={() => onViewDetails(order)}
                className="font-mono font-bold text-xs text-amber-400 cursor-pointer hover:underline"
              >
                {order.sequence}
              </span>
              {order.referenceNumber && (
                <span className="block font-mono text-[10px] text-slate-400">
                  {order.referenceNumber}
                </span>
              )}
            </div>
          </div>
          <StatusBadge status={order.status} size="sm" />
        </div>

        {/* Recipient & Location */}
        <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
          <div>
            <span className="text-[10px] text-slate-400 block">{isRtl ? 'المستلم' : 'Recipient'}</span>
            <div className="font-bold text-white text-xs truncate">{order.recipientName}</div>
            <div className="text-[10px] text-slate-400 font-mono">{order.recipientPhone}</div>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">{isRtl ? 'الوجهة' : 'Destination'}</span>
            <div className="font-semibold text-slate-200 text-xs truncate">
              {order.governorate} / {order.area}
            </div>
            <div className="text-[10px] text-slate-400 truncate">{order.fullAddress}</div>
          </div>
        </div>

        {/* Financials & Driver */}
        <div className="flex items-center justify-between text-xs px-1">
          <div>
            <span className="text-[10px] text-slate-400 block">{isRtl ? 'التحصيل (COD)' : 'COD Collection'}</span>
            <div className="font-bold text-white font-mono text-sm">
              {formatCurrency(order.totalCollection)}
            </div>
          </div>

          <div className="text-left">
            <span className="text-[10px] text-slate-400 block">{isRtl ? 'الكابتن المكلف' : 'Assigned Driver'}</span>
            <div className="text-xs text-slate-300 font-medium">
              {order.driver?.name || (isRtl ? 'غير معين' : 'Unassigned')}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <a
              href={recipientWhatsAppUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors"
            >
              <MessageSquare className="w-4 h-4 fill-current" />
              <span>{isRtl ? 'واتساب' : 'WhatsApp'}</span>
            </a>
            <Button
              variant="secondary"
              size="compact"
              onClick={() => onPrintWaybill(order)}
              iconStart={<Printer className="w-3.5 h-3.5 text-amber-400" />}
              className="min-h-[44px]"
            >
              {isRtl ? 'بوليصة' : 'Waybill'}
            </Button>
          </div>

          <Button
            variant="primary"
            size="compact"
            onClick={() => onViewDetails(order)}
            iconStart={<Eye className="w-3.5 h-3.5" />}
            className="min-h-[44px]"
          >
            {isRtl ? 'التفاصيل' : 'Details'}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-xl overflow-hidden flex flex-col font-sans" dir={dir}>
      {/* Desktop Table View (>= md) */}
      <div className="hidden md:block overflow-x-auto min-h-[380px]">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="bg-slate-950/90 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider select-none sticky top-0 z-10 backdrop-blur-md">
              <th className="px-3 py-3 w-9 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = someSelected;
                  }}
                  onChange={onToggleSelectAll}
                  aria-label={isRtl ? 'تحديد كل شحنات الصفحة' : 'Select all on page'}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500 cursor-pointer"
                />
              </th>
              <th className="px-3 py-3">{isRtl ? 'رقم البوليصة / المرجع' : 'Waybill / Ref'}</th>
              <th className="px-3 py-3">{isRtl ? 'الحالة التشغيلية' : 'Status'}</th>
              <th className="px-3 py-3">{isRtl ? 'التاجر المرسل' : 'Merchant'}</th>
              <th className="px-3 py-3">{isRtl ? 'المستلم والواتساب' : 'Recipient'}</th>
              <th className="px-3 py-3">{isRtl ? 'الوجهة والمنطقة' : 'Destination'}</th>
              <th className="px-3 py-3 text-left font-mono">{isRtl ? 'التحصيل (COD)' : 'COD Collection'}</th>
              <th className="px-3 py-3">{isRtl ? 'الكابتن المكلف' : 'Assigned Driver'}</th>
              <th className="px-3 py-3">{isRtl ? 'التاريخ' : 'Date'}</th>
              <th className="px-3 py-3 text-center">{isRtl ? 'إجراءات' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {isLoading ? (
              <tr>
                <td colSpan={10} className="p-6">
                  <div className="space-y-3">
                    <Skeleton variant="rect" height="40px" className="rounded-lg" />
                    <Skeleton variant="rect" height="40px" className="rounded-lg" />
                    <Skeleton variant="rect" height="40px" className="rounded-lg" />
                    <Skeleton variant="rect" height="40px" className="rounded-lg" />
                    <Skeleton variant="rect" height="40px" className="rounded-lg" />
                  </div>
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12">
                  <EmptyState
                    icon={<Package className="w-10 h-10 text-slate-600" />}
                    title={isRtl ? 'لا توجد طلبيات مطابقة للبحث أو الفلتر' : 'No matching orders found'}
                    description={
                      isRtl
                        ? 'جرب تعديل أو تصفير الفلاتر المطبقة للوصول إلى الشحنات المطلوبة'
                        : 'Try adjusting or clearing your search filters to find orders.'
                    }
                  />
                </td>
              </tr>
            ) : (
              renderDesktopRows()
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List (< md) */}
      <div className="md:hidden divide-y divide-slate-800">
        {isLoading ? (
          <div className="p-4 space-y-3">
            <Skeleton variant="rect" height="120px" className="rounded-xl" />
            <Skeleton variant="rect" height="120px" className="rounded-xl" />
            <Skeleton variant="rect" height="120px" className="rounded-xl" />
          </div>
        ) : orders.length === 0 ? (
          <div className="py-8">
            <EmptyState
              icon={<Package className="w-8 h-8 text-slate-600" />}
              title={isRtl ? 'لا توجد طلبيات' : 'No orders found'}
              description={isRtl ? 'جرب تعديل خيارات البحث والفلترة' : 'Try adjusting search or filters'}
            />
          </div>
        ) : (
          orders.map((order) => renderMobileCard(order))
        )}
      </div>

      {/* Pagination Footer */}
      <div className="bg-slate-950/90 border-t border-slate-800 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-4">
          <span>
            {isRtl ? 'عرض' : 'Showing'}{' '}
            <strong className="text-white font-mono">
              {orders.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0}
            </strong>{' '}
            {isRtl ? 'إلى' : 'to'}{' '}
            <strong className="text-white font-mono">
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </strong>{' '}
            {isRtl ? 'من إجمالي' : 'of'}{' '}
            <strong className="text-white font-mono">{pagination.total}</strong> {isRtl ? 'شحنة' : 'shipments'}
          </span>

          <div className="flex items-center gap-1.5">
            <span>{isRtl ? 'صفوف:' : 'Rows:'}</span>
            <select
              value={pagination.limit}
              onChange={(e) => onLimitChange(parseInt(e.target.value, 10))}
              aria-label={isRtl ? 'عدد الصفوف في الصفحة' : 'Rows per page'}
              className="bg-slate-900 border border-slate-700/80 rounded px-2 py-0.5 text-xs text-slate-200 focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            size="compact"
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
            iconStart={<ChevronRight className="w-3.5 h-3.5" />}
          >
            {isRtl ? 'السابق' : 'Previous'}
          </Button>

          <span className="px-2 font-mono text-slate-300">
            {pagination.page} / {pagination.totalPages || 1}
          </span>

          <Button
            variant="secondary"
            size="compact"
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            iconEnd={<ChevronLeft className="w-3.5 h-3.5" />}
          >
            {isRtl ? 'التالي' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
};

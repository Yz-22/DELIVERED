import React, { useState, useMemo } from 'react';
import {
  Package,
  PlusCircle,
  Search,
  Filter,
  Printer,
  Eye,
  Phone,
  MessageCircle,
  CheckCircle2,
  Clock,
  RotateCcw,
  AlertCircle,
  Truck,
  CheckSquare,
  Square,
  ArrowUpDown,
  X,
  Building2,
  Calendar,
  Layers
} from 'lucide-react';
import { Order } from '../../types/logistics';
import { GOVERNORATES } from '../../utils/logisticsHelpers';
import { MerchantOrderDetailDrawer } from './MerchantOrderDetailDrawer';

interface MerchantOrdersViewProps {
  orders: Order[];
  isLoading: boolean;
  error?: string | null;
  onOpenWaybill: (order: Order) => void;
  onOpenNewShipmentModal: () => void;
  onViewOrderDetails: (order: Order) => void;
  onRefresh?: () => void;
}

export const MerchantOrdersView: React.FC<MerchantOrdersViewProps> = ({
  orders,
  isLoading,
  error,
  onOpenWaybill,
  onOpenNewShipmentModal,
  onViewOrderDetails,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [governorateFilter, setGovernorateFilter] = useState<string>('ALL');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'createdAt' | 'sequence' | 'recipientName' | 'merchantCollection'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);
  
  // Selection state for bulk printing
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Drawer state for order inspection
  const [activeDrawerOrder, setActiveDrawerOrder] = useState<Order | null>(null);

  // Status metrics counts
  const totalCount = orders.length;
  const pendingCount = orders.filter((o) => o.status === 'PENDING' || o.status === 'RECEIVED_AT_HUB').length;
  const outForDeliveryCount = orders.filter((o) => o.status === 'OUT_FOR_DELIVERY').length;
  const deliveredCount = orders.filter((o) => o.status === 'DELIVERED').length;
  const returnedCount = orders.filter((o) => o.status === 'RETURNED').length;
  const cancelledCount = orders.filter((o) => o.status === 'CANCELLED').length;
  const postponedCount = orders.filter((o) => o.status === 'POSTPONED' || o.deliveryAttempts > 1).length;

  // Filtered & sorted orders
  const filteredOrders = useMemo(() => {
    return orders
      .filter((o) => {
        // Status filter
        if (statusFilter !== 'ALL') {
          if (statusFilter === 'POSTPONED') {
            if (o.status !== 'POSTPONED' && (o.deliveryAttempts || 0) <= 1) return false;
          } else if (o.status !== statusFilter) {
            return false;
          }
        }

        // Governorate filter
        if (governorateFilter !== 'ALL' && o.governorate !== governorateFilter) return false;

        // Payment type filter
        if (paymentTypeFilter !== 'ALL' && o.paymentType !== paymentTypeFilter) return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchSeq = (o.sequence || '').toLowerCase().includes(q);
          const matchName = (o.recipientName || '').toLowerCase().includes(q);
          const matchPhone = (o.recipientPhone || '').includes(q);
          const matchArea = (o.area || '').toLowerCase().includes(q);
          const matchGov = (o.governorate || '').toLowerCase().includes(q);
          return matchSeq || matchName || matchPhone || matchArea || matchGov;
        }

        return true;
      })
      .sort((a, b) => {
        let valA: any = a[sortBy];
        let valB: any = b[sortBy];

        if (sortBy === 'createdAt') {
          valA = new Date(a.createdAt || 0).getTime();
          valB = new Date(b.createdAt || 0).getTime();
        } else if (sortBy === 'merchantCollection') {
          valA = Number(a.merchantCollection || 0);
          valB = Number(b.merchantCollection || 0);
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [orders, statusFilter, governorateFilter, paymentTypeFilter, searchQuery, sortBy, sortOrder]);

  // Paginated slice
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredOrders.slice(start, start + itemsPerPage);
  }, [filteredOrders, currentPage, itemsPerPage]);

  // Handle select all / toggle single
  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredOrders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOrders.map((o) => o.id)));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Bulk print handler
  const handleBulkPrint = () => {
    const selectedOrders = orders.filter((o) => selectedIds.has(o.id));
    if (selectedOrders.length > 0) {
      // Print first selected order or pass array if waybill handler supports batch
      selectedOrders.forEach((o) => onOpenWaybill(o));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse p-6 text-center">
        <div className="h-20 bg-slate-200 rounded-3xl" />
        <div className="h-14 bg-slate-200 rounded-2xl" />
        <div className="text-xs font-bold text-slate-500 py-4">جاري تحميل الشحنات...</div>
        <div className="h-96 bg-slate-200 rounded-3xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 text-rose-900 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
        <div className="font-bold text-sm">فشل تحميل سجل الطلبات</div>
        <p className="text-xs text-rose-700">{error}</p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-rose-700 cursor-pointer"
          >
            إعادة المحاولة
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Top Header & Operational Stats Bar */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-slate-900 text-white p-5 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                سجل الشحنات والعمليات
              </span>
              <span className="text-[11px] text-slate-400 font-mono">إجمالي: {totalCount} شحنة</span>
            </div>
            <h2 className="font-black text-lg text-white mt-0.5">إدارة طلبات وشحنات المتجر</h2>
          </div>
        </div>

        <button
          onClick={onOpenNewShipmentModal}
          className="w-full md:w-auto px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 text-slate-950 font-black text-xs rounded-2xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer border border-amber-300"
        >
          <PlusCircle className="w-4 h-4" />
          <span>إضافة شحنة جديدة</span>
        </button>
      </div>

      {/* Operational Status Badges Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`p-3 rounded-2xl border text-right transition-all cursor-pointer ${
            statusFilter === 'ALL'
              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
              : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'
          }`}
        >
          <div className="text-[11px] font-bold opacity-80">جميع الشحنات</div>
          <div className="text-lg font-black mt-0.5 font-mono">{totalCount}</div>
        </button>

        <button
          onClick={() => setStatusFilter('PENDING')}
          className={`p-3 rounded-2xl border text-right transition-all cursor-pointer ${
            statusFilter === 'PENDING'
              ? 'bg-blue-900 text-white border-blue-900 shadow-sm'
              : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'
          }`}
        >
          <div className="text-[11px] font-bold text-blue-600">بانتظار الحركة</div>
          <div className="text-lg font-black mt-0.5 font-mono text-blue-700">{pendingCount}</div>
        </button>

        <button
          onClick={() => setStatusFilter('OUT_FOR_DELIVERY')}
          className={`p-3 rounded-2xl border text-right transition-all cursor-pointer ${
            statusFilter === 'OUT_FOR_DELIVERY'
              ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
              : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'
          }`}
        >
          <div className="text-[11px] font-bold text-amber-700">جاري التوصيل</div>
          <div className="text-lg font-black mt-0.5 font-mono text-amber-900">{outForDeliveryCount}</div>
        </button>

        <button
          onClick={() => setStatusFilter('DELIVERED')}
          className={`p-3 rounded-2xl border text-right transition-all cursor-pointer ${
            statusFilter === 'DELIVERED'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
              : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'
          }`}
        >
          <div className="text-[11px] font-bold text-emerald-600">تم التسليم بنجاح</div>
          <div className="text-lg font-black mt-0.5 font-mono text-emerald-700">{deliveredCount}</div>
        </button>

        <button
          onClick={() => setStatusFilter('RETURNED')}
          className={`p-3 rounded-2xl border text-right transition-all cursor-pointer ${
            statusFilter === 'RETURNED'
              ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
              : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'
          }`}
        >
          <div className="text-[11px] font-bold text-rose-600">الشحنات المرتجعة</div>
          <div className="text-lg font-black mt-0.5 font-mono text-rose-700">{returnedCount}</div>
        </button>

        <button
          onClick={() => setStatusFilter('CANCELLED')}
          className={`p-3 rounded-2xl border text-right transition-all cursor-pointer ${
            statusFilter === 'CANCELLED'
              ? 'bg-red-800 text-white border-red-800 shadow-sm'
              : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'
          }`}
        >
          <div className="text-[11px] font-bold text-red-600">الشحنات الملغاة</div>
          <div className="text-lg font-black mt-0.5 font-mono text-red-700">{cancelledCount}</div>
        </button>

        <button
          onClick={() => setStatusFilter('POSTPONED')}
          className={`p-3 rounded-2xl border text-right transition-all cursor-pointer ${
            statusFilter === 'POSTPONED'
              ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
              : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'
          }`}
        >
          <div className="text-[11px] font-bold text-slate-500">محاولات غير مكتملة / مؤجل</div>
          <div className="text-lg font-black mt-0.5 font-mono text-slate-700">{postponedCount}</div>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full lg:w-96">
          <Search className="w-4 h-4 absolute right-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث برقم البوليصة، اسم المستلم، الهاتف، أو المنطقة..."
            className="w-full pr-10 pl-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Dropdown Filters & Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-end">
          {/* Governorate Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 border border-slate-200 rounded-xl text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-bold text-slate-600 text-[11px]">المحافظة:</span>
            <select
              value={governorateFilter}
              onChange={(e) => setGovernorateFilter(e.target.value)}
              className="bg-transparent font-bold text-slate-800 focus:outline-none text-xs cursor-pointer"
            >
              <option value="ALL">جميع المحافظات</option>
              {GOVERNORATES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Type Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 border border-slate-200 rounded-xl text-xs">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-bold text-slate-600 text-[11px]">الدفع:</span>
            <select
              value={paymentTypeFilter}
              onChange={(e) => setPaymentTypeFilter(e.target.value)}
              className="bg-transparent font-bold text-slate-800 focus:outline-none text-xs cursor-pointer"
            >
              <option value="ALL">جميع طرق الدفع</option>
              <option value="COD">عند الاستلام (COD)</option>
              <option value="CLIQ">كليك (CliQ)</option>
              <option value="PREPAID">مدفوع مسبقاً</option>
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 border border-slate-200 rounded-xl text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-bold text-slate-600 text-[11px]">الترتيب حسب:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent font-bold text-slate-800 focus:outline-none text-xs cursor-pointer"
            >
              <option value="createdAt">تاريخ الإنشاء</option>
              <option value="sequence">رقم البوليصة</option>
              <option value="recipientName">اسم المستلم</option>
              <option value="merchantCollection">المبلغ المطلوب</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600 hover:text-slate-900 bg-slate-200 rounded-md"
            >
              {sortOrder === 'asc' ? 'تصاعدي' : 'تنازلي'}
            </button>
          </div>

          {(statusFilter !== 'ALL' || governorateFilter !== 'ALL' || paymentTypeFilter !== 'ALL' || searchQuery) && (
            <button
              onClick={() => {
                setStatusFilter('ALL');
                setGovernorateFilter('ALL');
                setPaymentTypeFilter('ALL');
                setSearchQuery('');
              }}
              className="px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-xl font-bold transition-colors cursor-pointer"
            >
              إلغاء الفلاتر
            </button>
          )}
        </div>
      </div>

      {/* Bulk Actions Floating Bar when items selected */}
      {selectedIds.size > 0 && (
        <div className="bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-lg border border-slate-800 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-bold">
            <CheckSquare className="w-4 h-4 text-amber-400" />
            <span>تم تحديد ({selectedIds.size}) شحنة</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkPrint}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة البوالص الحرارية</span>
            </button>

            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl cursor-pointer"
            >
              إلغاء التحديد
            </button>
          </div>
        </div>
      )}

      {/* High Density Desktop Table (Hidden on Mobile) */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-3 text-center w-10">
                  <button onClick={handleToggleSelectAll} className="text-slate-400 hover:text-slate-700">
                    {selectedIds.size > 0 && selectedIds.size === filteredOrders.length ? (
                      <CheckSquare className="w-4 h-4 text-amber-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-4">رقم البوليصة</th>
                <th className="py-3 px-4">المستلم والوجهة</th>
                <th className="py-3 px-4">التواصل</th>
                <th className="py-3 px-4 text-left">ثمن البضاعة</th>
                <th className="py-3 px-4 text-left">أجرة التوصيل</th>
                <th className="py-3 px-4 text-left">المبلغ الكلي (COD)</th>
                <th className="py-3 px-4">الحالة التشغيلية</th>
                <th className="py-3 px-4">حالة التسوية</th>
                <th className="py-3 px-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 space-y-2">
                    <Package className="w-8 h-8 mx-auto text-slate-300" />
                    <div className="font-bold text-slate-600">لا توجد شحنات مطابقة لخيارات البحث والفلترة</div>
                    <p className="text-xs text-slate-400">جرّب تغيير كلمات البحث أو إعادة ضبط خيارات الفلترة</p>
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order) => {
                  const isSelected = selectedIds.has(order.id);
                  const cleanPhone = (order.recipientPhone || '').replace(/\D/g, '');
                  const formattedWa = cleanPhone.startsWith('0')
                    ? '962' + cleanPhone.substring(1)
                    : cleanPhone;

                  return (
                    <tr
                      key={order.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleToggleSelectOne(order.id)}
                          className="text-slate-400 hover:text-amber-600"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-amber-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      <td className="py-3 px-4 font-mono font-black text-slate-900 tracking-wide">
                        {order.sequence}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{order.recipientName}</div>
                        <div className="text-[11px] text-slate-500">
                          {order.governorate} - {order.area}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-slate-700 text-[11px]">{order.recipientPhone}</span>
                          <a
                            href={`tel:${order.recipientPhone}`}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded-md"
                            title="اتصال مباشر"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                          <a
                            href={`https://wa.me/${formattedWa}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md"
                            title="محادثة واتساب"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-black text-slate-900 text-left font-mono">
                        {Number(order.merchantCollection || 0).toFixed(3)} <span className="text-[10px] text-slate-500 font-normal">د.أ</span>
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-600 text-left font-mono">
                        {Number(order.deliveryFee || 0).toFixed(3)} <span className="text-[10px] text-slate-400 font-normal">د.أ</span>
                      </td>

                      <td className="py-3 px-4 font-black text-emerald-700 text-left font-mono">
                        {Number(order.totalCollection || Number(order.merchantCollection || 0) + Number(order.deliveryFee || 0)).toFixed(3)}{' '}
                        <span className="text-[10px] text-emerald-600 font-normal">د.أ</span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                            order.status === 'DELIVERED'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : order.status === 'OUT_FOR_DELIVERY'
                              ? 'bg-amber-50 text-amber-900 border-amber-200'
                              : order.status === 'RETURNED'
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : order.status === 'POSTPONED'
                              ? 'bg-slate-100 text-slate-800 border-slate-300'
                              : 'bg-blue-50 text-blue-800 border-blue-200'
                          }`}
                        >
                          {order.status === 'DELIVERED' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          {order.status === 'OUT_FOR_DELIVERY' && <Truck className="w-3 h-3 text-amber-600" />}
                          {order.status === 'RETURNED' && <RotateCcw className="w-3 h-3 text-rose-600" />}
                          {order.status === 'DELIVERED'
                            ? 'تم التسليم'
                            : order.status === 'OUT_FOR_DELIVERY'
                            ? 'مع الكابتن'
                            : order.status === 'RETURNED'
                            ? 'مرتجع'
                            : order.status === 'POSTPONED'
                            ? 'مؤجل'
                            : 'بالمستودع'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {order.status === 'DELIVERED' ? (
                          order.isSettledWithMerchant ? (
                            <span className="text-emerald-700 font-bold text-[11px] flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> تم الصرف
                            </span>
                          ) : (
                            <span className="text-amber-700 font-bold text-[11px] flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-amber-500" /> قيد التسوية
                            </span>
                          )
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onOpenWaybill(order)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-amber-100 text-slate-800 hover:text-amber-950 rounded-xl font-bold flex items-center gap-1 transition-all cursor-pointer border border-slate-200/60"
                            title="طباعة البوليصة الحرارية"
                          >
                            <Printer className="w-3.5 h-3.5 text-amber-600" />
                            <span>بوليصة</span>
                          </button>

                          <button
                            onClick={() => {
                              setActiveDrawerOrder(order);
                              onViewOrderDetails(order);
                            }}
                            className="p-1.5 text-slate-600 hover:text-slate-950 hover:bg-slate-100 rounded-xl cursor-pointer"
                            title="عرض التفاصيل الكاملة"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* High-Density Pagination Footer */}
        <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-600 font-medium">
            <span>عرض {paginatedOrders.length} من أصل {filteredOrders.length} شحنة مطابقة</span>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-1">
              <span>عدد العناصر:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 font-bold text-slate-800 focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5 font-mono">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-colors cursor-pointer"
            >
              السابق
            </button>
            <span className="px-3 py-1 bg-slate-900 text-white rounded-lg font-bold">
              صفحة {currentPage} من {Math.max(1, Math.ceil(filteredOrders.length / itemsPerPage))}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(Math.ceil(filteredOrders.length / itemsPerPage), p + 1))}
              disabled={currentPage >= Math.ceil(filteredOrders.length / itemsPerPage)}
              className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold transition-colors cursor-pointer"
            >
              التالي
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Compact Cards List (Visible <= 768px) */}
      <div className="block md:hidden space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-slate-400 border border-slate-200 space-y-2">
            <Package className="w-8 h-8 mx-auto text-slate-300" />
            <div className="font-bold text-slate-600 text-xs">لا توجد شحنات مطابقة للبحث</div>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const cleanPhone = (order.recipientPhone || '').replace(/\D/g, '');
            const formattedWa = cleanPhone.startsWith('0')
              ? '962' + cleanPhone.substring(1)
              : cleanPhone;

            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-slate-900 text-sm">{order.sequence}</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold">
                      {order.governorate}
                    </span>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      order.status === 'DELIVERED'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : order.status === 'OUT_FOR_DELIVERY'
                        ? 'bg-amber-50 text-amber-900 border-amber-200'
                        : order.status === 'RETURNED'
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : 'bg-blue-50 text-blue-800 border-blue-200'
                    }`}
                  >
                    {order.status === 'DELIVERED'
                      ? 'تم التسليم'
                      : order.status === 'OUT_FOR_DELIVERY'
                      ? 'مع الكابتن'
                      : order.status === 'RETURNED'
                      ? 'مرتجع'
                      : 'بالمستودع'}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-2 text-xs">
                  <div>
                    <div className="font-black text-slate-900">{order.recipientName}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {order.governorate} - {order.area}
                    </div>
                  </div>

                  <div className="text-left font-mono">
                    <div className="font-black text-emerald-700 text-sm">
                      {Number(order.merchantCollection || 0).toFixed(3)} د.أ
                    </div>
                    <div className="text-[10px] text-slate-400">ثمن البضاعة</div>
                  </div>
                </div>

                {/* Touch Actions */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <a
                      href={`tel:${order.recipientPhone}`}
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs flex items-center gap-1 font-bold"
                    >
                      <Phone className="w-3.5 h-3.5 text-blue-600" />
                    </a>
                    <a
                      href={`https://wa.me/${formattedWa}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs flex items-center gap-1 font-bold"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                    </a>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onOpenWaybill(order)}
                      className="px-3 py-2 bg-amber-500 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1 shadow-xs"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>بوليصة</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveDrawerOrder(order);
                        onViewOrderDetails(order);
                      }}
                      className="p-2 bg-slate-100 text-slate-700 rounded-xl"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Order Details Slide-Over Drawer */}
      <MerchantOrderDetailDrawer
        order={activeDrawerOrder}
        isOpen={!!activeDrawerOrder}
        onClose={() => setActiveDrawerOrder(null)}
        onOpenWaybill={onOpenWaybill}
      />
    </div>
  );
};

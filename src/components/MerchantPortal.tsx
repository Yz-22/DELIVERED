import React, { useState, useEffect } from 'react';
import {
  Building2,
  Package,
  PlusCircle,
  Printer,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  RotateCcw,
  Search,
  Filter,
  Send,
  Eye,
  FileText,
  CreditCard,
  MapPin,
  Phone,
  AlertCircle,
  Calendar,
  Check,
  Store,
  ShoppingBag
} from 'lucide-react';
import { User, Order, OrderStatus } from '../types/logistics';
import { GOVERNORATES, JORDAN_AREAS_MAP, STANDARD_DELIVERY_FEES } from '../utils/logisticsHelpers';
import { MerchantPos } from './MerchantPos';

interface MerchantPortalProps {
  merchants: User[];
  currentUser?: User | null;
  onOpenWaybill: (order: Order) => void;
  onViewOrderDetails: (order: Order) => void;
  onOrderCreated?: () => void;
}

export const MerchantPortal: React.FC<MerchantPortalProps> = ({
  merchants,
  currentUser,
  onOpenWaybill,
  onViewOrderDetails,
  onOrderCreated,
}) => {
  // Lock to the logged-in merchant account only
  const currentMerchant =
    (currentUser?.role === 'MERCHANT' ? currentUser : null) ||
    merchants.find((m) => m.id === currentUser?.id) ||
    merchants[0];

  const selectedMerchantId = currentMerchant?.id || 'u-mer-1';
  const [merchantOrders, setMerchantOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState<'pos' | 'orders' | 'new_shipment' | 'finance'>('pos');

  // New Shipment Form State
  const [newOrder, setNewOrder] = useState({
    recipientName: '',
    recipientPhone: '',
    recipientPhoneAlt: '',
    governorate: 'عمان',
    area: 'خلدا',
    fullAddress: '',
    merchantCollection: 25,
    packageType: 'ألبسة وإكسسوارات',
    piecesCount: 1,
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch orders for current merchant
  const fetchMerchantOrders = async () => {
    if (!selectedMerchantId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/orders?merchantId=${selectedMerchantId}&limit=100`);
      if (res.ok) {
        const data = await res.json();
        setMerchantOrders(data.orders || []);
      }
    } catch (e) {
      console.error('Error loading merchant orders:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMerchantOrders();
  }, [selectedMerchantId]);

  // Delivery fee for governorate
  const currentFee = STANDARD_DELIVERY_FEES[newOrder.governorate] || 3.0;

  // KPIs
  const totalShipments = merchantOrders.length;
  const deliveredShipments = merchantOrders.filter((o) => o.status === 'DELIVERED');
  const activeShipments = merchantOrders.filter((o) =>
    ['PENDING', 'PICKING', 'RECEIVED_AT_HUB', 'OUT_FOR_DELIVERY'].includes(o.status)
  );
  const returnedShipments = merchantOrders.filter((o) => ['CANCELLED', 'RETURNED'].includes(o.status));

  // Financials
  const pendingDelivered = deliveredShipments.filter((o) => !o.isSettledWithMerchant);
  const pendingGoods = pendingDelivered.reduce((sum, o) => sum + o.merchantCollection, 0);
  const pendingFees = pendingDelivered.reduce((sum, o) => sum + o.deliveryFee, 0);
  const netDueToMerchant = pendingGoods - pendingFees;

  const settledHistory = deliveredShipments.filter((o) => o.isSettledWithMerchant);
  const totalSettledAmount = settledHistory.reduce((sum, o) => sum + (o.merchantCollection - o.deliveryFee), 0);

  // Handle New Order Creation from Merchant
  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrder.recipientName || !newOrder.recipientPhone || !newOrder.fullAddress) {
      showToast('يرجى ملء جميع الحقول الإلزامية', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        merchantId: selectedMerchantId,
        recipientName: newOrder.recipientName,
        recipientPhone: newOrder.recipientPhone,
        recipientPhoneAlt: newOrder.recipientPhoneAlt || undefined,
        governorate: newOrder.governorate,
        area: newOrder.area,
        fullAddress: newOrder.fullAddress,
        merchantCollection: Number(newOrder.merchantCollection),
        deliveryFee: currentFee,
        totalCollection: Number(newOrder.merchantCollection) + currentFee,
        paymentType: 'COD',
        packageType: newOrder.packageType,
        piecesCount: Number(newOrder.piecesCount),
        notes: newOrder.notes,
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const createdOrder = await res.json();
        showToast(`تم إنشاء بوليصة الشحن بنجاح برقم (${createdOrder.sequence})`);
        setNewOrder({
          recipientName: '',
          recipientPhone: '',
          recipientPhoneAlt: '',
          governorate: 'عمان',
          area: 'خلدا',
          fullAddress: '',
          merchantCollection: 25,
          packageType: 'ألبسة وإكسسوارات',
          piecesCount: 1,
          notes: '',
        });
        fetchMerchantOrders();
        onOrderCreated?.();
        setActiveTab('orders');
        // Open thermal waybill modal directly for merchant to print!
        onOpenWaybill(createdOrder);
      } else {
        showToast('فشل إنشاء الشحنة', 'error');
      }
    } catch (err) {
      showToast('خطأ في الاتصال بالسيرفر', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered orders
  const filteredOrders = merchantOrders.filter((o) => {
    if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold border border-slate-700">
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Merchant Header & Store Selector */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-xl border border-slate-700/60 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 flex items-center justify-center font-black text-2xl shadow-md">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-amber-500/20 text-amber-300 font-bold px-2.5 py-0.5 rounded-full border border-amber-500/30">
                  بوابة الخدمة الذاتية للتجار
                </span>
                <span className="text-xs text-slate-400">DarGo Merchant Portal</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
                {currentMerchant?.commercialName || currentMerchant?.name}
              </h1>
              <p className="text-xs text-slate-300">
                {currentMerchant?.commercialType} | هاتف: {currentMerchant?.phone} | {currentMerchant?.city}
              </p>
            </div>
          </div>

          {/* Verified Store Account Badge */}
          <div className="bg-slate-800/80 px-4 py-2.5 rounded-2xl border border-slate-700/80 text-right w-full md:w-auto flex items-center justify-between md:justify-end gap-3">
            <div>
              <div className="text-[11px] text-slate-400">حساب المتجر المعتمد</div>
              <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 justify-end">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>نشط ومعتمد</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <Store className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Merchant Financial & Operations Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-700/60">
          <div className="bg-slate-800/60 rounded-2xl p-3.5 border border-slate-700/40">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>إجمالي شحنات المتجر</span>
              <Package className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-black text-white mt-1">{totalShipments}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{activeShipments.length} شحنة جارية</div>
          </div>

          <div className="bg-slate-800/60 rounded-2xl p-3.5 border border-slate-700/40">
            <div className="text-[11px] text-emerald-400 flex items-center justify-between">
              <span>تم التسليم بنجاح</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-black text-emerald-400 mt-1">{deliveredShipments.length}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              نسبة النجاح: {totalShipments > 0 ? Math.round((deliveredShipments.length / totalShipments) * 100) : 0}%
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-2xl p-3.5 border border-slate-700/40">
            <div className="text-[11px] text-rose-400 flex items-center justify-between">
              <span>مرتجع / ملغي</span>
              <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-xl font-black text-rose-400 mt-1">{returnedShipments.length}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">بانتظار الإرجاع للمتجر</div>
          </div>

          <div className="bg-emerald-500/10 rounded-2xl p-3.5 border border-emerald-500/30">
            <div className="text-[11px] text-emerald-300 font-bold flex items-center justify-between">
              <span>رصيدك المستحق في المحفظة</span>
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400 mt-1">
              {netDueToMerchant.toFixed(2)}{' '}
              <span className="text-xs font-normal text-slate-200">د.أ</span>
            </div>
            <div className="text-[10px] text-emerald-300 mt-0.5">
              صافي جاهز للتحويل الفوري
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('pos')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'pos'
              ? 'bg-amber-500 text-slate-950 shadow-sm ring-2 ring-amber-500/30'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Store className="w-4 h-4 text-slate-950" />
          <span>نقطة البيع والكاشير POS (بيع بالمحل + أونلاين)</span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'orders'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>شحنات التوصيل ({merchantOrders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('new_shipment')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'new_shipment'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          <span>إضافة شحنة يدوية</span>
        </button>

        <button
          onClick={() => setActiveTab('finance')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'finance'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>المحفظة المالية وكشوفات الصرف</span>
        </button>
      </div>

      {/* Tab 0: Integrated Merchant Point of Sale (POS) */}
      {activeTab === 'pos' && (
        <MerchantPos
          currentMerchant={currentMerchant}
          onOpenWaybill={onOpenWaybill}
          onOrderCreated={() => {
            fetchMerchantOrders();
            onOrderCreated?.();
          }}
        />
      )}

      {/* Tab 1: Orders List */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث بالبوليصة أو اسم المستلم أو الهاتف..."
                className="w-full pr-9 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  statusFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                الكل ({merchantOrders.length})
              </button>
              <button
                onClick={() => setStatusFilter('OUT_FOR_DELIVERY')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  statusFilter === 'OUT_FOR_DELIVERY' ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 text-slate-600'
                }`}
              >
                جاري التوصيل
              </button>
              <button
                onClick={() => setStatusFilter('DELIVERED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  statusFilter === 'DELIVERED' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                تم التسليم
              </button>
              <button
                onClick={() => setStatusFilter('RETURNED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  statusFilter === 'RETURNED' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                المرتجعات
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">رقم البوليصة</th>
                    <th className="py-3 px-4">المستلم والوجهة</th>
                    <th className="py-3 px-4">رقم الهاتف</th>
                    <th className="py-3 px-4">ثمن البضاعة</th>
                    <th className="py-3 px-4">الحالة التشغيلية</th>
                    <th className="py-3 px-4">حالة التسوية</th>
                    <th className="py-3 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        لا توجد شحنات مطابقة لخيارات البحث
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
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
                          {order.merchantCollection.toFixed(2)} د.أ
                        </td>
                        <td className="py-3 px-4">
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
                              : order.status === 'POSTPONED'
                              ? 'مؤجل'
                              : 'بالمستودع'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {order.status === 'DELIVERED' ? (
                            order.isSettledWithMerchant ? (
                              <span className="text-emerald-700 font-bold flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" /> تم الصرف
                              </span>
                            ) : (
                              <span className="text-amber-700 font-bold flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" /> قيد التسوية
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => onOpenWaybill(order)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-amber-100 text-slate-800 hover:text-amber-900 rounded-lg font-bold flex items-center gap-1 transition-all"
                              title="طباعة بوليصة الشحن الحرارية"
                            >
                              <Printer className="w-3.5 h-3.5 text-amber-600" />
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
      )}

      {/* Tab 2: New Shipment Form */}
      {activeTab === 'new_shipment' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <div className="max-w-3xl mx-auto">
            <div className="border-b border-slate-100 pb-4 mb-5">
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-amber-500" />
                <span>إضافة طلبية جديدة وطباعة ملصق الباركود</span>
              </h2>
              <p className="text-xs text-slate-500">
                سيتولى كابتن DarGo استلام الطرد الجاهز من موقع متجرك
              </p>
            </div>

            <form onSubmit={handleCreateShipment} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    اسم الزبون المستلم *
                  </label>
                  <input
                    type="text"
                    required
                    value={newOrder.recipientName}
                    onChange={(e) => setNewOrder({ ...newOrder, recipientName: e.target.value })}
                    placeholder="مثال: ياسمين حداد"
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    رقم الهاتف الأساسي *
                  </label>
                  <input
                    type="tel"
                    required
                    value={newOrder.recipientPhone}
                    onChange={(e) => setNewOrder({ ...newOrder, recipientPhone: e.target.value })}
                    placeholder="079XXXXXXX"
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المحافظة *</label>
                  <select
                    value={newOrder.governorate}
                    onChange={(e) => {
                      const gov = e.target.value;
                      const defaultArea = JORDAN_AREAS_MAP[gov]?.[0] || 'المركز';
                      setNewOrder({ ...newOrder, governorate: gov, area: defaultArea });
                    }}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 font-bold"
                  >
                    {GOVERNORATES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المنطقة والحي *</label>
                  <select
                    value={newOrder.area}
                    onChange={(e) => setNewOrder({ ...newOrder, area: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 font-bold"
                  >
                    {(JORDAN_AREAS_MAP[newOrder.governorate] || ['المركز']).map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    أجرة التوصيل المحتسبة
                  </label>
                  <div className="w-full text-xs p-2.5 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl font-black">
                    {currentFee.toFixed(2)} دينار
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  العنوان التفصيلي للزبون *
                </label>
                <input
                  type="text"
                  required
                  value={newOrder.fullAddress}
                  onChange={(e) => setNewOrder({ ...newOrder, fullAddress: e.target.value })}
                  placeholder="الشارع، رقم العمارة، الطابق، بجانب معلم معروف..."
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    المبلغ المطلوب من الزبون (ثمن البضاعة) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      required
                      value={newOrder.merchantCollection}
                      onChange={(e) =>
                        setNewOrder({ ...newOrder, merchantCollection: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full text-sm font-black p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 text-slate-900"
                    />
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">د.أ</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">نوع الطرد</label>
                  <input
                    type="text"
                    value={newOrder.packageType}
                    onChange={(e) => setNewOrder({ ...newOrder, packageType: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">عدد القطع</label>
                  <input
                    type="number"
                    min="1"
                    value={newOrder.piecesCount}
                    onChange={(e) =>
                      setNewOrder({ ...newOrder, piecesCount: parseInt(e.target.value, 10) || 1 })
                    }
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ملاحظات وتوجيهات التسليم (اختياري)
                </label>
                <input
                  type="text"
                  value={newOrder.notes}
                  onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })}
                  placeholder="مثال: يرجى الاتصال قبل الوصول، العميل يفضل الاستلام بعد العصر..."
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('orders')}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  <span>{isSubmitting ? 'جاري الحفظ...' : 'حفظ وطباعة البوليصة الحرارية'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab 3: Finance & Settlements */}
      {activeTab === 'finance' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-emerald-950 text-white rounded-3xl p-5 border border-emerald-800 shadow-md">
              <div className="text-xs text-emerald-300 font-bold mb-1">صافي الرصيد المستحق لك الآن</div>
              <div className="text-3xl font-black text-emerald-400">
                {netDueToMerchant.toFixed(2)} <span className="text-sm">د.أ</span>
              </div>
              <div className="text-xs text-emerald-200 mt-2">
                عن {pendingDelivered.length} طرد مسلّم جاهز للتحويل
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
              <div className="text-xs text-slate-500 font-bold mb-1">إجمالي ما تم تحويله لك تاريخياً</div>
              <div className="text-3xl font-black text-slate-900">
                {totalSettledAmount.toFixed(2)} <span className="text-sm">د.أ</span>
              </div>
              <div className="text-xs text-slate-500 mt-2">عن {settledHistory.length} شحنة مسواة</div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="text-xs text-slate-500 font-bold mb-1">طلب تحويل مستحقات فوري</div>
                <p className="text-xs text-slate-600 mt-1">
                  يمكنك طلب إرسال رصيدك المتاح فوراً عبر نظام كليك (CliQ) أو تحويل بنكي لحسابك.
                </p>
              </div>
              <button
                onClick={() => showToast('تم إرسال طلب التحويل للمحاسبة وسيتم التنفيذ خلال ساعتين')}
                disabled={netDueToMerchant <= 0}
                className={`w-full mt-3 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                  netDueToMerchant > 0
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Send className="w-4 h-4" />
                <span>طلب سحب المستحقات عبر كليك</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

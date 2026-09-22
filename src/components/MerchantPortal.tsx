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
  Boxes,
  Calculator,
  Receipt,
  Truck,
  Users
} from 'lucide-react';
import { User, Order } from '../types/logistics';
import { GOVERNORATES, JORDAN_AREAS_MAP, STANDARD_DELIVERY_FEES } from '../utils/logisticsHelpers';
import { getAuthHeaders } from '../lib/auth';
import { MerchantPos } from './MerchantPos';
import { MerchantWarehouse } from './MerchantWarehouse';
import { MerchantInvoices } from './MerchantInvoices';
import { MerchantAccounting } from './MerchantAccounting';
import { MerchantBranches } from './MerchantBranches';
import { MerchantStatements } from './MerchantStatements';

import { MerchantWorkspaceNav, MerchantTab } from './merchant/MerchantWorkspaceNav';
import { MerchantMobileNav } from './merchant/MerchantMobileNav';
import { MerchantHome } from './merchant/MerchantHome';
import { MerchantOrdersView } from './merchant/MerchantOrdersView';
import { MerchantDeliveriesView } from './merchant/MerchantDeliveriesView';
import { MerchantReturnsView } from './merchant/MerchantReturnsView';
import { MerchantCustomersView } from './merchant/MerchantCustomersView';

import {
  validateAndNormalizeJordanPhone,
  validateAndNormalizeSecondaryJordanPhone,
} from '../utils/jordanPhone';

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
  const [warehouseProducts, setWarehouseProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  // Active Merchant OS Navigation Tab (Default to 'home')
  const [activeTab, setActiveTab] = useState<MerchantTab>('home');

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

  // Fetch orders & warehouse inventory for current merchant
  const fetchMerchantData = async () => {
    if (!selectedMerchantId) return;
    setIsLoading(true);
    setError(null);
    try {
      const authHeaders = getAuthHeaders(currentUser);

      // Fetch Orders
      const ordersRes = await fetch(`/api/orders?merchantId=${selectedMerchantId}&limit=100`, {
        headers: authHeaders,
      });
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setMerchantOrders(ordersData.orders || []);
      }

      // Fetch Warehouse
      const whRes = await fetch(`/api/merchants/${selectedMerchantId}/warehouse`, {
        headers: authHeaders,
      });
      if (whRes.ok) {
        const whData = await whRes.json();
        setWarehouseProducts(whData.products || []);
      }
    } catch (e: any) {
      console.error('Error loading merchant data:', e);
      setError('تعذر تحميل بيانات المتجر من السيرفر');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMerchantData();
  }, [selectedMerchantId]);

  // Delivery fee for governorate
  const currentFee = STANDARD_DELIVERY_FEES[newOrder.governorate] || 3.0;

  // Counts
  const totalShipments = merchantOrders.length;
  const deliveredShipments = merchantOrders.filter((o) => o.status === 'DELIVERED');
  const activeShipments = merchantOrders.filter((o) =>
    ['PENDING', 'PICKING', 'RECEIVED_AT_HUB', 'OUT_FOR_DELIVERY'].includes(o.status)
  );
  const returnedShipments = merchantOrders.filter((o) => ['CANCELLED', 'RETURNED'].includes(o.status));
  const lowStockCount = warehouseProducts.filter(
    (p) => Number(p.stockQuantity) <= Number(p.minStockAlert ?? 5)
  ).length;

  // Financials
  const pendingDelivered = deliveredShipments.filter((o) => !o.isSettledWithMerchant);
  const pendingGoods = pendingDelivered.reduce((sum, o) => sum + (Number(o.merchantCollection) || 0), 0);
  const pendingFees = pendingDelivered.reduce((sum, o) => sum + (Number(o.deliveryFee) || 0), 0);
  const netDueToMerchant = pendingGoods - pendingFees;

  const settledHistory = deliveredShipments.filter((o) => o.isSettledWithMerchant);
  const totalSettledAmount = settledHistory.reduce(
    (sum, o) => sum + ((Number(o.merchantCollection) || 0) - (Number(o.deliveryFee) || 0)),
    0
  );

  // Handle New Order Creation from Merchant
  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrder.recipientName || !newOrder.recipientPhone || !newOrder.fullAddress) {
      showToast('يرجى ملء جميع الحقول الإلزامية', 'error');
      return;
    }

    const phoneVal = validateAndNormalizeJordanPhone(newOrder.recipientPhone, 'رقم هاتف المستلم');
    if (!phoneVal.isValid || !phoneVal.canonicalPhone) {
      showToast(phoneVal.error || 'رقم الهاتف يجب أن يكون رقمًا أردنيًا صحيحًا من 10 أرقام مثل 0791234567، أو بصيغة +962 بدون الصفر الأول.', 'error');
      return;
    }

    let canonicalPhoneAlt: string | undefined = undefined;
    if (newOrder.recipientPhoneAlt && newOrder.recipientPhoneAlt.trim() !== '') {
      const altVal = validateAndNormalizeSecondaryJordanPhone(newOrder.recipientPhoneAlt);
      if (!altVal.isValid) {
        showToast(altVal.error || 'رقم الهاتف الإضافي غير صالح', 'error');
        return;
      }
      canonicalPhoneAlt = altVal.canonicalPhone || undefined;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        merchantId: selectedMerchantId,
        recipientName: newOrder.recipientName.trim(),
        recipientPhone: phoneVal.canonicalPhone,
        recipientPhoneAlt: canonicalPhoneAlt,
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
        headers: getAuthHeaders(currentUser),
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
        fetchMerchantData();
        onOrderCreated?.();
        setActiveTab('orders');
        // Open thermal waybill modal directly for merchant to print
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
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-6 pb-20 md:pb-6">
      {/* Toast Notification */}
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

      {/* Merchant OS Layout Body */}
      <div className="flex flex-col md:flex-row gap-5 items-start">
        {/* Desktop / Tablet Domain Navigation Rail */}
        <MerchantWorkspaceNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          totalOrdersCount={totalShipments}
          lowStockCount={lowStockCount}
          pendingDeliveriesCount={activeShipments.length}
          returnsCount={returnedShipments.length}
          onQuickNewShipment={() => setActiveTab('new_shipment')}
          onQuickPos={() => setActiveTab('pos')}
        />

        {/* Primary Content Workspace Area */}
        <div className="flex-1 w-full min-w-0">
          {/* TAB 1: EXECUTIVE HOME */}
          {activeTab === 'home' && (
            <MerchantHome
              currentMerchant={currentMerchant}
              merchantOrders={merchantOrders}
              warehouseProducts={warehouseProducts}
              isLoading={isLoading}
              error={error}
              onNavigateTab={setActiveTab}
              onOpenWaybill={onOpenWaybill}
              onOpenNewShipmentModal={() => setActiveTab('new_shipment')}
              onOpenPos={() => setActiveTab('pos')}
            />
          )}

          {/* TAB 2: ORDERS LIST */}
          {activeTab === 'orders' && (
            <MerchantOrdersView
              orders={merchantOrders}
              isLoading={isLoading}
              error={error}
              onOpenWaybill={onOpenWaybill}
              onOpenNewShipmentModal={() => setActiveTab('new_shipment')}
              onViewOrderDetails={onViewOrderDetails}
              onRefresh={fetchMerchantData}
            />
          )}

          {/* TAB 3: POS CASHIER */}
          {activeTab === 'pos' && (
            <MerchantPos
              currentMerchant={currentMerchant}
              onOpenWaybill={onOpenWaybill}
              onOrderCreated={() => {
                fetchMerchantData();
                onOrderCreated?.();
              }}
            />
          )}

          {/* TAB 4: DELIVERIES DERIVED VIEW */}
          {activeTab === 'deliveries' && (
            <MerchantDeliveriesView
              orders={merchantOrders}
              onOpenWaybill={onOpenWaybill}
              onViewOrderDetails={onViewOrderDetails}
            />
          )}

          {/* TAB 5: RETURNS DERIVED VIEW */}
          {activeTab === 'returns' && (
            <MerchantReturnsView
              orders={merchantOrders}
              onOpenWaybill={onOpenWaybill}
              onViewOrderDetails={onViewOrderDetails}
            />
          )}

          {/* TAB 6: WAREHOUSE & INVENTORY */}
          {activeTab === 'warehouse' && (
            <MerchantWarehouse
              currentMerchant={currentMerchant}
              onRefreshOrders={() => {
                fetchMerchantData();
                onOrderCreated?.();
              }}
            />
          )}

          {/* TAB 7: INVOICES & PURCHASES */}
          {activeTab === 'invoices' && (
            <MerchantInvoices
              currentMerchant={currentMerchant}
              onOpenWaybill={onOpenWaybill}
              onRefreshOrders={() => {
                fetchMerchantData();
                onOrderCreated?.();
              }}
            />
          )}

          {/* TAB 8: CUSTOMERS DERIVED DIRECTORY */}
          {activeTab === 'customers' && (
            <MerchantCustomersView orders={merchantOrders} />
          )}

          {/* TAB 9: FINANCIAL STATEMENTS & WALLET */}
          {activeTab === 'finance' && (
            <MerchantStatements
              currentMerchant={currentMerchant}
              currentUser={currentUser}
            />
          )}

          {/* TAB 10: P&L ACCOUNTING */}
          {activeTab === 'accounting' && (
            <MerchantAccounting currentMerchant={currentMerchant} />
          )}

          {/* TAB 11: BRANCHES & MULTI-BRANCH */}
          {activeTab === 'branches' && (
            <MerchantBranches
              merchantId={selectedMerchantId}
              currentUser={currentUser}
              merchants={merchants}
            />
          )}

          {/* TAB 12: NEW SHIPMENT FORM */}
          {activeTab === 'new_shipment' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6">
              <div className="max-w-3xl mx-auto">
                <div className="border-b border-slate-100 pb-4 mb-5">
                  <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <PlusCircle className="w-5 h-5 text-amber-500" />
                    <span>إضافة طلبية جديدة وطباعة ملصق الباركود</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    سيتولى كابتن DELIVERE استلام الطرد الجاهز من موقع متجرك
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
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <MerchantMobileNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        totalOrdersCount={totalShipments}
        pendingDeliveriesCount={activeShipments.length}
        lowStockCount={lowStockCount}
        onQuickNewShipment={() => setActiveTab('new_shipment')}
      />
    </div>
  );
};

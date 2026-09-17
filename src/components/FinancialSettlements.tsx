import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  Receipt,
  CheckCircle2,
  Clock,
  Printer,
  FileSpreadsheet,
  Building2,
  UserCheck,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Send,
  AlertCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  Wallet,
  Scale,
  BookOpen
} from 'lucide-react';
import { User, Order } from '../types/logistics';
import { getAuthHeaders } from '../lib/auth';
import { GeneralAccounting } from './GeneralAccounting';

interface MerchantSettlementData {
  merchant: User;
  totalOrders: number;
  deliveredCount: number;
  pendingCount: number;
  pendingGoods: number;
  pendingFees: number;
  netPayable: number;
  settledCount: number;
  alreadySettledAmount: number;
  pendingOrdersList: Order[];
}

interface DriverSettlementData {
  driver: User;
  assignedCount: number;
  deliveredCount: number;
  pendingCount: number;
  pendingCashInHand: number;
  totalCollectedHistorical: number;
  pendingOrdersList: Order[];
}

export const FinancialSettlements: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'merchants' | 'drivers' | 'general_accounting'>('merchants');
  const [merchantData, setMerchantData] = useState<MerchantSettlementData[]>([]);
  const [driverData, setDriverData] = useState<DriverSettlementData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMerchantId, setExpandedMerchantId] = useState<string | null>(null);

  // Settlement Modal State (for Merchant)
  const [activeMerchantToSettle, setActiveMerchantToSettle] = useState<MerchantSettlementData | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('CLIQ');
  const [referenceCode, setReferenceCode] = useState<string>('');
  const [settlementNotes, setSettlementNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cash Closing Modal State (for Driver)
  const [activeDriverToClose, setActiveDriverToClose] = useState<DriverSettlementData | null>(null);
  const [driverClosingNotes, setDriverClosingNotes] = useState<string>('');

  // Success Notification
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Printable Statement Modal
  const [printableStatement, setPrintableStatement] = useState<MerchantSettlementData | null>(null);

  // Fetch settlements data
  const fetchSettlements = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/settlements', {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setMerchantData(data.merchants || []);
        setDriverData(data.drivers || []);
      }
    } catch (e) {
      console.error('Error fetching settlements:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettlements();
  }, []);

  // Totals
  const totalPendingGoods = merchantData.reduce((s, m) => s + m.pendingGoods, 0);
  const totalPendingFees = merchantData.reduce((s, m) => s + m.pendingFees, 0);
  const totalNetPayableToMerchants = merchantData.reduce((s, m) => s + m.netPayable, 0);
  const totalPendingParcelsCount = merchantData.reduce((s, m) => s + m.pendingCount, 0);

  const totalCashInDriversHand = driverData.reduce((s, d) => s + d.pendingCashInHand, 0);
  const totalDriverPendingCount = driverData.reduce((s, d) => s + d.pendingCount, 0);

  // Handle Settle Merchant
  const handleConfirmMerchantSettle = async () => {
    if (!activeMerchantToSettle) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/settlements/merchants/${activeMerchantToSettle.merchant.id}/settle`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          paymentMethod,
          reference: referenceCode || `CLIQ-${Date.now().toString().slice(-6)}`,
          notes: settlementNotes,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSuccessToast(data.message);
        setTimeout(() => setSuccessToast(null), 4000);
        setActiveMerchantToSettle(null);
        fetchSettlements();
      }
    } catch (e) {
      console.error('Error settling merchant:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Driver Cash Closing
  const handleConfirmDriverClosing = async () => {
    if (!activeDriverToClose) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/settlements/drivers/${activeDriverToClose.driver.id}/close-cash`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          notes: driverClosingNotes,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSuccessToast(data.message);
        setTimeout(() => setSuccessToast(null), 4000);
        setActiveDriverToClose(null);
        fetchSettlements();
      }
    } catch (e) {
      console.error('Error closing driver cash:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered merchants
  const filteredMerchants = merchantData.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (m.merchant.commercialName && m.merchant.commercialName.toLowerCase().includes(q)) ||
      m.merchant.name.toLowerCase().includes(q) ||
      m.merchant.phone.includes(q)
    );
  });

  // Filtered drivers
  const filteredDrivers = driverData.filter((d) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return d.driver.name.toLowerCase().includes(q) || d.driver.phone.includes(q);
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-bold border border-emerald-400">
          <CheckCircle2 className="w-5 h-5 text-white" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-emerald-500/10 text-emerald-700 font-bold px-2 py-0.5 rounded border border-emerald-500/20">
              الوحدة المالية والمحاسبية
            </span>
            <span className="text-xs text-slate-500">Financial Ledger & Settlements</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            التسويات المالية وكشوفات الحساب
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            تصفية مستحقات المتاجر، خصم أجور التوصيل الصافية، وإغلاق عهدة الكباتن النقدية اليومية.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('merchants')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'merchants'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>كشوفات المتاجر ({merchantData.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('drivers')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'drivers'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>إغلاق عهدة الكباتن ({driverData.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('general_accounting')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'general_accounting'
                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>النظام المحاسبي العام وشجرة الحسابات</span>
          </button>
        </div>
      </div>

      {/* Render General Accounting when selected */}
      {activeTab === 'general_accounting' && <GeneralAccounting />}

      {/* KPI Cards & Search Bar (only for merchants & drivers tabs) */}
      {activeTab !== 'general_accounting' && (
        <>
          {/* KPI Cards Banner */}
          {activeTab === 'merchants' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>إجمالي ثمن البضاعة المحصل</span>
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {totalPendingGoods.toFixed(2)}{' '}
                  <span className="text-xs font-normal text-slate-500">د.أ</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  عن {totalPendingParcelsCount} طرد مسلّم بانتظار التسوية
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>خصم أجور التوصيل للشركة</span>
                  <Receipt className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-2xl font-black text-amber-600">
                  {totalPendingFees.toFixed(2)}{' '}
                  <span className="text-xs font-normal text-slate-500">د.أ</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  أجور الشحن المستحقة لـ DarGo
                </div>
              </div>

              <div className="bg-emerald-950 text-white rounded-2xl p-4 border border-emerald-800 shadow-md">
                <div className="flex items-center justify-between text-xs text-emerald-300 mb-1">
                  <span>صافي المستحق للمتاجر (Net Payable)</span>
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-emerald-400">
                  {totalNetPayableToMerchants.toFixed(2)}{' '}
                  <span className="text-xs font-normal text-emerald-200">د.أ</span>
                </div>
                <div className="text-[11px] text-emerald-300 mt-1">
                  جاهز للتحويل الفوري عبر كليك أو البنك
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>متاجر بحاجة لتسوية</span>
                  <Building2 className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {merchantData.filter((m) => m.pendingCount > 0).length} / {merchantData.length}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  متاجر لديها رصيد جاهز للصرف
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-amber-950 text-white rounded-2xl p-4 border border-amber-800 shadow-md">
                <div className="flex items-center justify-between text-xs text-amber-300 mb-1">
                  <span>إجمالي عهدة الكاش بالسيارات حالياً</span>
                  <Wallet className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-black text-amber-400">
                  {totalCashInDriversHand.toFixed(2)}{' '}
                  <span className="text-xs font-normal text-amber-200">د.أ</span>
                </div>
                <div className="text-[11px] text-amber-300 mt-1">
                  مبالغ نقدية محصلة لم يقم الكباتن بتوريدها للصندوق
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>عدد الطرود المسلّمة غير المغلقة</span>
                  <Receipt className="w-4 h-4 text-slate-600" />
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {totalDriverPendingCount} طرد
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  تحتاج لتأكيد استلام وتصفير عهدة السائق
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>كباتن معهم عهدة نقدية مفتوحة</span>
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {driverData.filter((d) => d.pendingCashInHand > 0).length} كابتن
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  من أصل {driverData.length} كابتن نشطين
                </div>
              </div>
            </div>
          )}

          {/* Search Bar */}
          <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm mb-4 flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder={
                  activeTab === 'merchants'
                    ? 'ابحث باسم المتجر، أو رقم الهاتف، أو اسم المالك...'
                    : 'ابحث باسم الكابتن أو رقم الهاتف...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-9 pl-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              onClick={fetchSettlements}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </>
      )}

      {/* Tab 1: Merchants Ledger Table */}
      {activeTab === 'merchants' && (
        <div className="space-y-4">
          {filteredMerchants.map((item) => {
            const isExpanded = expandedMerchantId === item.merchant.id;
            const hasPendingBalance = item.pendingCount > 0;

            return (
              <div
                key={item.merchant.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all"
              >
                {/* Merchant Card Row */}
                <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Merchant Info */}
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 font-bold shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-slate-900">
                          {item.merchant.commercialName || item.merchant.name}
                        </h2>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                          {item.merchant.commercialType || 'تجارة إلكترونية'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-3">
                        <span>المسؤول: {item.merchant.name}</span>
                        <span>هاتف: {item.merchant.phone}</span>
                        <span>المدينة: {item.merchant.city}</span>
                      </div>
                    </div>
                  </div>

                  {/* Financial Breakdown Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-right">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                      <div className="text-[10px] text-slate-500">ثمن البضاعة المحصل</div>
                      <div className="text-sm font-bold text-slate-900">
                        {item.pendingGoods.toFixed(2)} د.أ
                      </div>
                      <div className="text-[10px] text-slate-500">{item.pendingCount} طرد مسلّم</div>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                      <div className="text-[10px] text-amber-700">خصم أجور التوصيل</div>
                      <div className="text-sm font-bold text-amber-700">
                        - {item.pendingFees.toFixed(2)} د.أ
                      </div>
                      <div className="text-[10px] text-slate-500">عمولة الشحن</div>
                    </div>

                    <div className="col-span-2 sm:col-span-1 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                      <div className="text-[10px] text-emerald-800 font-semibold">صافي المستحق للمتجر</div>
                      <div className="text-base font-extrabold text-emerald-800">
                        {item.netPayable.toFixed(2)} د.أ
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    <button
                      onClick={() => setExpandedMerchantId(isExpanded ? null : item.merchant.id)}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                    >
                      <span>تفاصيل الطرود ({item.pendingCount})</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      onClick={() => setPrintableStatement(item)}
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs transition-all"
                      title="طباعة كشف حساب رسمي"
                    >
                      <Printer className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        setActiveMerchantToSettle(item);
                        setReferenceCode(`CLIQ-${Date.now().toString().slice(-6)}`);
                      }}
                      disabled={!hasPendingBalance}
                      className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                        hasPendingBalance
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>صرف المستحقات</span>
                    </button>
                  </div>
                </div>

                {/* Expanded Parcels Audit Table */}
                {isExpanded && (
                  <div className="bg-slate-50/70 border-t border-slate-200 p-4">
                    <h3 className="text-xs font-bold text-slate-700 mb-3 flex items-center justify-between">
                      <span>الطرود المسلّمة المشمولة في كشف الحساب الحالي:</span>
                      <span className="text-[11px] text-slate-500">
                        {item.pendingOrdersList.length} شحنة
                      </span>
                    </h3>

                    {item.pendingOrdersList.length === 0 ? (
                      <div className="text-center py-4 text-xs text-slate-500">
                        تمت تسوية جميع مستحقات هذا المتجر مسبقاً!
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs bg-white rounded-xl border border-slate-200 overflow-hidden">
                          <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3">رقم البوليصة</th>
                              <th className="py-2.5 px-3">المستلم والمدينة</th>
                              <th className="py-2.5 px-3">تاريخ التسليم</th>
                              <th className="py-2.5 px-3">ثمن البضاعة (د.أ)</th>
                              <th className="py-2.5 px-3">أجرة التوصيل (د.أ)</th>
                              <th className="py-2.5 px-3 text-emerald-800 font-extrabold">
                                الصافي للمتجر
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {item.pendingOrdersList.map((ord) => {
                              const net = (ord.merchantCollection || 0) - (ord.deliveryFee || 0);
                              return (
                                <tr key={ord.id} className="hover:bg-slate-50/80">
                                  <td className="py-2 px-3 font-mono font-bold text-slate-900">
                                    {ord.sequence}
                                  </td>
                                  <td className="py-2 px-3">
                                    <div className="font-semibold text-slate-900">{ord.recipientName}</div>
                                    <div className="text-[10px] text-slate-500">
                                      {ord.governorate} - {ord.area}
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 text-slate-600 font-mono text-[11px]">
                                    {ord.deliveredAt ? new Date(ord.deliveredAt).toLocaleDateString('ar-JO') : 'اليوم'}
                                  </td>
                                  <td className="py-2 px-3 font-bold text-slate-900">
                                    {ord.merchantCollection.toFixed(2)}
                                  </td>
                                  <td className="py-2 px-3 text-amber-700 font-bold">
                                    - {ord.deliveryFee.toFixed(2)}
                                  </td>
                                  <td className="py-2 px-3 font-black text-emerald-700">
                                    {net.toFixed(2)} د.أ
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 2: Drivers Cash Closing Table */}
      {activeTab === 'drivers' && (
        <div className="space-y-4">
          {filteredDrivers.map((item) => {
            const hasCashInHand = item.pendingCashInHand > 0;

            return (
              <div
                key={item.driver.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                {/* Driver Info */}
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-bold shrink-0">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">{item.driver.name}</h2>
                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
                      <span>هاتف: {item.driver.phone}</span>
                      <span>مركبة: {item.driver.vehicleType}</span>
                      <span>لوحة: {item.driver.vehiclePlate}</span>
                    </div>
                  </div>
                </div>

                {/* Cash Metrics */}
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-slate-500">الطرود المسلّمة اليوم:</div>
                    <div className="text-sm font-bold text-slate-900">
                      {item.deliveredCount} طرد
                    </div>
                  </div>

                  <div className="bg-amber-50 px-4 py-2 rounded-xl border border-amber-200 text-right">
                    <div className="text-[10px] text-amber-800 font-bold">العهدة النقدية بيده حالياً</div>
                    <div className="text-lg font-black text-amber-700">
                      {item.pendingCashInHand.toFixed(2)}{' '}
                      <span className="text-xs font-normal text-slate-600">د.أ</span>
                    </div>
                  </div>

                  {/* Close Cash Button */}
                  <button
                    onClick={() => setActiveDriverToClose(item)}
                    disabled={!hasCashInHand}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                      hasCashInHand
                        ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-sm'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>استلام النقد وإغلاق العهدة</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Settle Merchant Modal */}
      {activeMerchantToSettle && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 text-right animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                <span>إصدار سند صرف وتسوية مستحقات</span>
              </h3>
              <button
                onClick={() => setActiveMerchantToSettle(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="my-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-emerald-800">المتجر المستفيد:</span>
                <span className="font-bold text-emerald-950">
                  {activeMerchantToSettle.merchant.commercialName || activeMerchantToSettle.merchant.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-800">عدد الطرود المسلّمة:</span>
                <span className="font-bold text-emerald-950">{activeMerchantToSettle.pendingCount} طرد</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-800">صافي المبلغ المراد تحويله:</span>
                <span className="text-base font-black text-emerald-800">
                  {activeMerchantToSettle.netPayable.toFixed(2)} دينار أردني
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="mb-3">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                طريقة التحويل / الدفع للمتجر:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CLIQ')}
                  className={`p-2 rounded-xl border text-xs font-bold text-center transition-all ${
                    paymentMethod === 'CLIQ'
                      ? 'border-purple-600 bg-purple-50 text-purple-800'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  كليك CliQ
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('BANK')}
                  className={`p-2 rounded-xl border text-xs font-bold text-center transition-all ${
                    paymentMethod === 'BANK'
                      ? 'border-blue-600 bg-blue-50 text-blue-800'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  تحويل بنكي IBAN
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`p-2 rounded-xl border text-xs font-bold text-center transition-all ${
                    paymentMethod === 'CASH'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  نقداً باليد
                </button>
              </div>
            </div>

            {/* Reference Number */}
            <div className="mb-3">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                رقم الحوالة أو سند الصرف:
              </label>
              <input
                type="text"
                value={referenceCode}
                onChange={(e) => setReferenceCode(e.target.value)}
                placeholder="مثال: CLIQ-984321"
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            {/* Notes */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ملاحظات التسوية:
              </label>
              <input
                type="text"
                value={settlementNotes}
                onChange={(e) => setSettlementNotes(e.target.value)}
                placeholder="تم التحويل لحساب التاجر بنجاح..."
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveMerchantToSettle(null)}
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmMerchantSettle}
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تأكيد الصرف والتسوية</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Driver Cash Closing Modal */}
      {activeDriverToClose && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 text-right animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-amber-600" />
                <span>إغلاق عهدة السائق وتوريد الصندوق</span>
              </h3>
              <button
                onClick={() => setActiveDriverToClose(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="my-3 p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-amber-900">اسم الكابتن:</span>
                <span className="font-bold text-amber-950">{activeDriverToClose.driver.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-900">عدد الطرود المسلّمة:</span>
                <span className="font-bold text-amber-950">{activeDriverToClose.pendingCount} طرد</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-900">المبلغ النقدي المستلم للخزينة:</span>
                <span className="text-base font-black text-amber-900">
                  {activeDriverToClose.pendingCashInHand.toFixed(2)} دينار أردني
                </span>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ملاحظات أمين الصندوق:
              </label>
              <input
                type="text"
                value={driverClosingNotes}
                onChange={(e) => setDriverClosingNotes(e.target.value)}
                placeholder="تم استلام المبلغ نقداً ومطابقة عدد البوالص..."
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveDriverToClose(null)}
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmDriverClosing}
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تأكيد استلام النقد وتصفير العهدة</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Statement View */}
      {printableStatement && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-300 text-right my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  كشف حساب مالي رسمي - شركة DarGo اللوجستية
                </h2>
                <p className="text-xs text-slate-500">
                  تاريخ الإصدار: {new Date().toLocaleDateString('ar-JO')} | كشف تسوية مستحقات
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة</span>
                </button>
                <button
                  onClick={() => setPrintableStatement(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="my-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500 block">المتجر:</span>
                <span className="font-bold text-slate-900 text-sm">
                  {printableStatement.merchant.commercialName || printableStatement.merchant.name}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">المدينة والعنوان:</span>
                <span className="font-semibold text-slate-800">
                  {printableStatement.merchant.city} - {printableStatement.merchant.address}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto my-4">
              <table className="w-full text-right text-xs border border-slate-200">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2 border-l">البوليصة</th>
                    <th className="p-2 border-l">المستلم</th>
                    <th className="p-2 border-l">ثمن البضاعة</th>
                    <th className="p-2 border-l">أجرة التوصيل</th>
                    <th className="p-2">الصافي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {printableStatement.pendingOrdersList.map((o) => (
                    <tr key={o.id}>
                      <td className="p-2 font-mono border-l">{o.sequence}</td>
                      <td className="p-2 border-l">{o.recipientName}</td>
                      <td className="p-2 border-l font-bold">{o.merchantCollection.toFixed(2)}</td>
                      <td className="p-2 border-l text-amber-700">- {o.deliveryFee.toFixed(2)}</td>
                      <td className="p-2 font-black text-emerald-800">
                        {(o.merchantCollection - o.deliveryFee).toFixed(2)} د.أ
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100 font-black text-slate-900 border-t border-slate-200">
                  <tr>
                    <td colSpan={2} className="p-2 border-l text-center">
                      المجموع الإجمالي
                    </td>
                    <td className="p-2 border-l">{printableStatement.pendingGoods.toFixed(2)} د.أ</td>
                    <td className="p-2 border-l text-amber-700">
                      - {printableStatement.pendingFees.toFixed(2)} د.أ
                    </td>
                    <td className="p-2 text-emerald-800">
                      {printableStatement.netPayable.toFixed(2)} د.أ
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-between text-xs text-slate-600">
              <div>توقيع المحاسب المعتمد: _________________</div>
              <div>توقيع واستلام التاجر: _________________</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  Receipt,
  FileSpreadsheet,
  Download,
  Printer,
  Calendar,
  Filter,
  Building2,
  Car,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  AlertCircle,
  Search,
  ChevronDown,
  Clock,
  Layers,
  BarChart3,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { User, Order } from '../types/logistics';
import { MerchantBranch } from '../types/branches';
import { getAuthHeaders } from '../lib/auth';

interface ReportsAndStatementsProps {
  currentUser?: User | null;
  merchants: User[];
  drivers: User[];
}

export const ReportsAndStatements: React.FC<ReportsAndStatementsProps> = ({
  currentUser,
  merchants,
  drivers,
}) => {
  const [activeTab, setActiveTab] = useState<'merchant_statement' | 'driver_cash' | 'operational_summary'>('merchant_statement');

  // Merchant Statement Filters
  const [selectedMerchantId, setSelectedMerchantId] = useState<string>(merchants[0]?.id || '');
  const [branches, setBranches] = useState<MerchantBranch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState<string>(
    new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  );
  const [dateTo, setDateTo] = useState<string>(new Date().toISOString().split('T')[0]);

  // Driver Statement Filters
  const [selectedDriverId, setSelectedDriverId] = useState<string>(drivers[0]?.id || '');

  // Statement Data
  const [statementData, setStatementData] = useState<any>(null);
  const [driverStatementData, setDriverStatementData] = useState<any>(null);
  const [operationalSummary, setOperationalSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch branches when merchant changes
  useEffect(() => {
    async function loadBranches() {
      if (!selectedMerchantId) return;
      try {
        const res = await fetch(`/api/merchants/${selectedMerchantId}/branches`, {
          headers: getAuthHeaders(currentUser),
        });
        if (res.ok) {
          const data = await res.json();
          setBranches(data.branches || []);
        }
      } catch {
        setBranches([]);
      }
    }
    loadBranches();
  }, [selectedMerchantId]);

  // Fetch Merchant Statement
  const fetchMerchantStatement = async () => {
    if (!selectedMerchantId) return;
    setIsLoading(true);
    try {
      const url = `/api/reports/merchant-statement?merchantId=${selectedMerchantId}&branchId=${selectedBranchId}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
      const res = await fetch(url, { headers: getAuthHeaders(currentUser) });
      if (res.ok) {
        const data = await res.json();
        setStatementData(data);
      }
    } catch (e) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Driver Statement
  const fetchDriverStatement = async () => {
    if (!selectedDriverId) return;
    setIsLoading(true);
    try {
      const url = `/api/reports/driver-cash-statement?driverId=${selectedDriverId}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
      const res = await fetch(url, { headers: getAuthHeaders(currentUser) });
      if (res.ok) {
        const data = await res.json();
        setDriverStatementData(data);
      }
    } catch (e) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Operational Summary
  const fetchOperationalSummary = async () => {
    setIsLoading(true);
    try {
      const url = `/api/reports/operational-summary?dateFrom=${dateFrom}&dateTo=${dateTo}`;
      const res = await fetch(url, { headers: getAuthHeaders(currentUser) });
      if (res.ok) {
        const data = await res.json();
        setOperationalSummary(data);
      }
    } catch (e) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'merchant_statement') {
      fetchMerchantStatement();
    } else if (activeTab === 'driver_cash') {
      fetchDriverStatement();
    } else if (activeTab === 'operational_summary') {
      fetchOperationalSummary();
    }
  }, [activeTab, selectedMerchantId, selectedBranchId, selectedDriverId, dateFrom, dateTo]);

  const handleExportCSV = () => {
    if (activeTab === 'merchant_statement' && statementData?.transactions) {
      const headers = ['التاريخ', 'رقم المرجع', 'الفرع', 'نوع الحركة', 'البيان والتفاصيل', 'مدين (خصم)', 'دائن (إضافة)', 'الرصيد التراكمي'];
      const rows = statementData.transactions.map((t: any) => [
        t.date,
        t.reference,
        t.branchName || 'الرئيسي',
        t.type,
        `"${(t.description || '').replace(/"/g, '""')}"`,
        t.debit.toFixed(2),
        t.credit.toFixed(2),
        t.runningBalance.toFixed(2),
      ]);
      const csv = '\uFEFF' + [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `كشف_حساب_تاجر_${dateFrom}_${dateTo}.csv`;
      link.click();
    } else if (activeTab === 'driver_cash' && driverStatementData?.transactions) {
      const headers = ['التاريخ', 'رقم البوليصة / السند', 'المستلم', 'نوع الحركة', 'المبلغ (د.أ)', 'الرصيد المتبقي بالذمة'];
      const rows = driverStatementData.transactions.map((t: any) => [
        t.date,
        t.reference,
        `"${(t.recipient || '').replace(/"/g, '""')}"`,
        t.type === 'COLLECTION' ? 'تحصيل COD' : 'توريد للخزينة',
        t.amount.toFixed(2),
        t.runningResponsibility.toFixed(2),
      ]);
      const csv = '\uFEFF' + [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `كشف_عهدة_كابتن_${dateFrom}_${dateTo}.csv`;
      link.click();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-6">
      {/* Top Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Receipt className="w-6 h-6 text-amber-600" />
            <h1 className="text-lg font-black text-slate-900">منظومة التقارير وكشوفات الحسابات الموحدة</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            مصدر الحقيقة المالي المعتمد: كشوفات حساب التجار، عهدة كاش الكباتن، والملخص التشغيلي للعمليات.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3.5 py-2 rounded-xl text-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>تصدير Excel (CSV)</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة الكشف</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('merchant_statement')}
          className={`flex-1 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'merchant_statement'
              ? 'bg-white text-slate-900 shadow-sm font-black'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4 text-amber-600" />
          <span>كشف حساب التاجر الموحد</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('driver_cash')}
          className={`flex-1 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'driver_cash'
              ? 'bg-white text-slate-900 shadow-sm font-black'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Car className="w-4 h-4 text-emerald-600" />
          <span>كشف عهدة الكاش للكباتن (Driver Cash)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('operational_summary')}
          className={`flex-1 py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'operational_summary'
              ? 'bg-white text-slate-900 shadow-sm font-black'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-indigo-600" />
          <span>الملخص التشغيلي للعمليات</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
        {/* Dynamic selector based on tab */}
        {activeTab === 'merchant_statement' && (
          <>
            <div>
              <label className="font-bold text-slate-700 block mb-1">اختر التاجر:</label>
              <select
                value={selectedMerchantId}
                onChange={(e) => setSelectedMerchantId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              >
                {merchants.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.storeName || m.name} ({m.phone || 'بدون هاتف'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">الفرع (Multi-Branch):</label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              >
                <option value="ALL">جميع الفروع الموحدة ({branches.length})</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.isMain ? '★ (رئيسي)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {activeTab === 'driver_cash' && (
          <div className="sm:col-span-2">
            <label className="font-bold text-slate-700 block mb-1">اختر الكابتن الميداني:</label>
            <select
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.phone || 'بدون هاتف'})
                </option>
              ))}
            </select>
          </div>
        )}

        {activeTab === 'operational_summary' && (
          <div className="sm:col-span-2 flex items-center gap-2 pt-5">
            <Layers className="w-5 h-5 text-indigo-600" />
            <span className="font-bold text-slate-700">تغطية كافة شحنات ومحافظات المملكة</span>
          </div>
        )}

        {/* Date Range */}
        <div>
          <label className="font-bold text-slate-700 block mb-1">من تاريخ:</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div>
          <label className="font-bold text-slate-700 block mb-1">إلى تاريخ:</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: MERCHANT ACCOUNT STATEMENT */}
      {/* ========================================================= */}
      {activeTab === 'merchant_statement' && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Opening Balance */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500">الرصيد الافتتاحي</span>
              <div className="text-lg font-black text-slate-900 font-mono">
                {(statementData?.openingBalance || 0).toFixed(2)} د.أ
              </div>
              <span className="text-[10px] text-slate-400 block">قبل {dateFrom}</span>
            </div>

            {/* Total COD Collected */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-emerald-600">إجمالي التحصيل (COD)</span>
              <div className="text-lg font-black text-emerald-600 font-mono">
                +{(statementData?.totalCodCollected || 0).toFixed(2)} د.أ
              </div>
              <span className="text-[10px] text-slate-400 block">
                {statementData?.totalOrdersDelivered || 0} شحنة مسلّمة
              </span>
            </div>

            {/* Delivery Fees Deducted */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-amber-600">أجور التوصيل المخصومة</span>
              <div className="text-lg font-black text-amber-600 font-mono">
                -{(statementData?.totalDeliveryFees || 0).toFixed(2)} د.أ
              </div>
              <span className="text-[10px] text-slate-400 block">رسوم النقل والخدمات</span>
            </div>

            {/* Settlements Paid */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-blue-600">دفعات التحويل المسددة</span>
              <div className="text-lg font-black text-blue-600 font-mono">
                -{(statementData?.totalSettlementsPaid || 0).toFixed(2)} د.أ
              </div>
              <span className="text-[10px] text-slate-400 block">حوالات بنكية / كاش</span>
            </div>

            {/* Closing Balance Due */}
            <div className="col-span-2 lg:col-span-1 bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-amber-950">صافي المستحق للتاجر</span>
              <div className="text-xl font-black text-amber-950 font-mono">
                {(statementData?.closingBalance || 0).toFixed(2)} د.أ
              </div>
              <span className="text-[10px] text-amber-800 font-bold block">الرصيد الختامي الحالي</span>
            </div>
          </div>

          {/* Chronological Ledger Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  دفتر الأستاذ التفصيلي لحركات الحساب (Chronological Ledger)
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {statementData?.transactions?.length || 0} حركة مالية
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    <th className="p-3">التاريخ والوقت</th>
                    <th className="p-3">رقم المرجع / البوليصة</th>
                    <th className="p-3">الفرع</th>
                    <th className="p-3">نوع الحركة</th>
                    <th className="p-3">البيان والتفاصيل</th>
                    <th className="p-3 text-left">مدين (خصم)</th>
                    <th className="p-3 text-left">دائن (إضافة)</th>
                    <th className="p-3 text-left">الرصيد التراكمي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 font-bold">
                        جاري احتساب كشف الحساب وتحديث الأرصدة...
                      </td>
                    </tr>
                  ) : !statementData?.transactions || statementData.transactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        لا توجد حركات مالية مسجلة خلال الفترة المحددة
                      </td>
                    </tr>
                  ) : (
                    statementData.transactions.map((tx: any, idx: number) => (
                      <tr key={tx.id || idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 text-slate-500 font-mono text-[11px]">
                          {tx.date}
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-800">
                          {tx.reference}
                        </td>
                        <td className="p-3 text-slate-600">
                          {tx.branchName || 'الفرع الرئيسي'}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              tx.credit > 0
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {tx.type === 'DELIVERY_COD' && 'تحصيل COD'}
                            {tx.type === 'DELIVERY_FEE' && 'أجور توصيل'}
                            {tx.type === 'SETTLEMENT_PAYOUT' && 'سداد تسوية'}
                            {tx.type === 'RETURN_FEE' && 'رسم مرتجع'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-700 max-w-xs truncate">
                          {tx.description}
                        </td>
                        <td className="p-3 text-left font-mono font-bold text-rose-600 dir-ltr">
                          {tx.debit > 0 ? `-${tx.debit.toFixed(2)}` : '-'}
                        </td>
                        <td className="p-3 text-left font-mono font-bold text-emerald-600 dir-ltr">
                          {tx.credit > 0 ? `+${tx.credit.toFixed(2)}` : '-'}
                        </td>
                        <td className="p-3 text-left font-mono font-black text-slate-900 dir-ltr bg-slate-50/50">
                          {tx.runningBalance.toFixed(2)} د.أ
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

      {/* ========================================================= */}
      {/* TAB 2: DRIVER CASH RESPONSIBILITY STATEMENT */}
      {/* ========================================================= */}
      {activeTab === 'driver_cash' && (
        <div className="space-y-6">
          {/* Equation Banner */}
          <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl border border-slate-800 shadow-md">
            <div className="text-[11px] font-bold text-amber-400 mb-1">
              معادلة عهدة الكاش للكباتن (Driver Cash Equation):
            </div>
            <div className="text-xs sm:text-sm font-mono font-bold text-white flex items-center gap-2 flex-wrap">
              <span>الرصيد الافتتاحي للعهدة</span>
              <span className="text-emerald-400">+ كاش COD المحصّل</span>
              <span className="text-rose-400">- الكاش المورّد للخزينة</span>
              <span className="text-slate-400">± التسويات</span>
              <span className="text-amber-400">= صافي عهدة الكاش المتبقية بذمة الكابتن</span>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500">العهدة الافتتاحية</span>
              <div className="text-lg font-black text-slate-900 font-mono">
                {(driverStatementData?.openingResponsibility || 0).toFixed(2)} د.أ
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-emerald-600">إجمالي COD المحصل</span>
              <div className="text-lg font-black text-emerald-600 font-mono">
                +{(driverStatementData?.totalCollected || 0).toFixed(2)} د.أ
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-blue-600">المسلّم للخزينة (المورّد)</span>
              <div className="text-lg font-black text-blue-600 font-mono">
                -{(driverStatementData?.totalRemitted || 0).toFixed(2)} د.أ
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-rose-800">المتبقي بذمة الكابتن</span>
              <div className="text-xl font-black text-rose-950 font-mono">
                {(driverStatementData?.outstandingCashResponsibility || 0).toFixed(2)} د.أ
              </div>
              <span className="text-[10px] text-rose-600 font-bold block">مطلوب توريده فوراً</span>
            </div>
          </div>

          {/* Driver Transactions Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Car className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">سجل تحصيلات وتوريدات الكابتن</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {driverStatementData?.transactions?.length || 0} حركة
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3">رقم البوليصة / السند</th>
                    <th className="p-3">الزبون / المستلم</th>
                    <th className="p-3">نوع الحركة</th>
                    <th className="p-3">البيان</th>
                    <th className="p-3 text-left">المبلغ المحصل / المورد</th>
                    <th className="p-3 text-left">العهدة المتبقية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 font-bold">
                        جاري تحميل كشف عهدة الكاش...
                      </td>
                    </tr>
                  ) : !driverStatementData?.transactions || driverStatementData.transactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        لا توجد حركات نقدية مسجلة لهذا الكابتن خلال الفترة المحددة
                      </td>
                    </tr>
                  ) : (
                    driverStatementData.transactions.map((tx: any, idx: number) => (
                      <tr key={tx.id || idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 text-slate-500 font-mono text-[11px]">{tx.date}</td>
                        <td className="p-3 font-mono font-bold text-slate-800">{tx.reference}</td>
                        <td className="p-3 text-slate-700">{tx.recipient || '-'}</td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              tx.type === 'COLLECTION'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {tx.type === 'COLLECTION' ? 'تحصيل COD' : 'توريد للخزينة'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{tx.description}</td>
                        <td className="p-3 text-left font-mono font-bold dir-ltr">
                          {tx.type === 'COLLECTION' ? (
                            <span className="text-emerald-600">+{tx.amount.toFixed(2)}</span>
                          ) : (
                            <span className="text-blue-600">-{tx.amount.toFixed(2)}</span>
                          )}
                        </td>
                        <td className="p-3 text-left font-mono font-black text-slate-900 dir-ltr bg-slate-50/50">
                          {tx.runningResponsibility.toFixed(2)} د.أ
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

      {/* ========================================================= */}
      {/* TAB 3: OPERATIONAL SUMMARY */}
      {/* ========================================================= */}
      {activeTab === 'operational_summary' && (
        <div className="space-y-6">
          {/* Status Breakdown Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-emerald-600 block mb-1">تم التسليم بنجاح</span>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {operationalSummary?.deliveredOrders || 0}
              </div>
              <span className="text-[10px] text-slate-400">
                نسبة النجاح: {operationalSummary?.successRate || '0%'}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-blue-600 block mb-1">قيد التوصيل الميداني</span>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {operationalSummary?.outForDeliveryOrders || 0}
              </div>
              <span className="text-[10px] text-slate-400">بحوزة الكباتن</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-amber-600 block mb-1">في المستودع والفرز</span>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {operationalSummary?.inHubOrders || 0}
              </div>
              <span className="text-[10px] text-slate-400">جاهزة للتوزيع</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-rose-600 block mb-1">المرتجعات والملغاة</span>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {operationalSummary?.returnedOrders || 0}
              </div>
              <span className="text-[10px] text-slate-400">بانتظار الإرجاع للتاجر</span>
            </div>
          </div>

          {/* Governorates Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900">توزيع الشحنات بحسب المحافظات</h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
              {(operationalSummary?.byGovernorate || []).map((gov: any) => (
                <div key={gov.name} className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-slate-700">{gov.name}</span>
                  <span className="font-mono font-black text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-md">
                    {gov.count} شحنة
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

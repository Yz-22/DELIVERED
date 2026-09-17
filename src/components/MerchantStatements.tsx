import React, { useState, useEffect } from 'react';
import {
  Receipt,
  FileSpreadsheet,
  Download,
  Printer,
  Calendar,
  Filter,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Building2,
} from 'lucide-react';
import { User } from '../types/logistics';
import { MerchantBranch } from '../types/branches';
import { getAuthHeaders } from '../lib/auth';

interface MerchantStatementsProps {
  currentMerchant: User;
  currentUser?: User | null;
}

export const MerchantStatements: React.FC<MerchantStatementsProps> = ({
  currentMerchant,
  currentUser,
}) => {
  const [branches, setBranches] = useState<MerchantBranch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState<string>(
    new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  );
  const [dateTo, setDateTo] = useState<string>(new Date().toISOString().split('T')[0]);
  const [statementData, setStatementData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch branches
  useEffect(() => {
    async function loadBranches() {
      if (!currentMerchant?.id) return;
      try {
        const res = await fetch(`/api/merchants/${currentMerchant.id}/branches`, {
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
  }, [currentMerchant?.id]);

  // Fetch Statement
  const fetchStatement = async () => {
    if (!currentMerchant?.id) return;
    setIsLoading(true);
    try {
      const url = `/api/reports/merchant-statement?merchantId=${currentMerchant.id}&branchId=${selectedBranchId}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
      const res = await fetch(url, { headers: getAuthHeaders(currentUser) });
      if (res.ok) {
        const data = await res.json();
        setStatementData(data);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatement();
  }, [currentMerchant?.id, selectedBranchId, dateFrom, dateTo]);

  const handleExportCSV = () => {
    if (!statementData?.transactions) return;
    const headers = ['التاريخ', 'رقم المرجع / البوليصة', 'الفرع', 'نوع الحركة', 'البيان', 'مدين (خصم)', 'دائن (إضافة)', 'الرصيد التراكمي'];
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
    link.download = `كشف_حساب_${currentMerchant.storeName || currentMerchant.name}_${dateFrom}_${dateTo}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Receipt className="w-6 h-6 text-amber-600" />
            <h2 className="text-lg font-black text-slate-900">كشف حساب التاجر والتحصيلات المالية</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            سجل التدفق المالي المعتمد لمتجرك: تحصيلات COD، أجور التوصيل المخصومة، وحوالات التسوية الصادرة.
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
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة الكشف</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500">الرصيد الافتتاحي</span>
          <div className="text-lg font-black text-slate-900 font-mono">
            {(statementData?.openingBalance || 0).toFixed(2)} د.أ
          </div>
          <span className="text-[10px] text-slate-400 block">قبل {dateFrom}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-emerald-600">إجمالي التحصيل (COD)</span>
          <div className="text-lg font-black text-emerald-600 font-mono">
            +{(statementData?.totalCodCollected || 0).toFixed(2)} د.أ
          </div>
          <span className="text-[10px] text-slate-400 block">
            {statementData?.totalOrdersDelivered || 0} شحنة مسلّمة
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-amber-600">أجور التوصيل</span>
          <div className="text-lg font-black text-amber-600 font-mono">
            -{(statementData?.totalDeliveryFees || 0).toFixed(2)} د.أ
          </div>
          <span className="text-[10px] text-slate-400 block">رسوم الشحن المخصومة</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-blue-600">الدفعات المحولة لك</span>
          <div className="text-lg font-black text-blue-600 font-mono">
            -{(statementData?.totalSettlementsPaid || 0).toFixed(2)} د.أ
          </div>
          <span className="text-[10px] text-slate-400 block">تسويات مستلمة بحسابك</span>
        </div>

        <div className="col-span-2 lg:col-span-1 bg-emerald-50 border border-emerald-300 p-4 rounded-2xl shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-emerald-900">صافي رصيدك المستحق</span>
          <div className="text-xl font-black text-emerald-950 font-mono">
            {(statementData?.closingBalance || 0).toFixed(2)} د.أ
          </div>
          <span className="text-[10px] text-emerald-700 font-bold block">متاح للتحويل فورا</span>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-bold text-slate-900">
              جدول الحركات التفصيلي لحساب المتجر
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {statementData?.transactions?.length || 0} حركة
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="p-3">التاريخ</th>
                <th className="p-3">رقم البوليصة / السند</th>
                <th className="p-3">الفرع</th>
                <th className="p-3">نوع الحركة</th>
                <th className="p-3">البيان</th>
                <th className="p-3 text-left">مدين (خصم)</th>
                <th className="p-3 text-left">دائن (إضافة)</th>
                <th className="p-3 text-left">رصيدك التراكمي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-bold">
                    جاري تحميل وتدقيق كشف الحساب...
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
                    <td className="p-3 text-slate-500 font-mono text-[11px]">{tx.date}</td>
                    <td className="p-3 font-mono font-bold text-slate-800">{tx.reference}</td>
                    <td className="p-3 text-slate-600">{tx.branchName || 'الفرع الرئيسي'}</td>
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
                    <td className="p-3 text-slate-700">{tx.description}</td>
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
  );
};

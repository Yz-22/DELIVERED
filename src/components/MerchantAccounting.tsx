import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Receipt,
  FileSpreadsheet,
  Plus,
  Calendar,
  CreditCard,
  Building2,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  X,
  Search,
  RefreshCw,
  ShoppingBag,
  Truck,
  Boxes,
  Layers,
  ArrowLeftRight,
  ShieldCheck,
  Check,
  PackageCheck
} from 'lucide-react';
import { MerchantExpense, MerchantFinancialSummary, JournalEntry, StockMovement } from '../types/accounting';
import { User } from '../types/logistics';
import { formatCurrency } from '../utils/logisticsHelpers';

interface MerchantAccountingProps {
  currentMerchant: User;
}

export const MerchantAccounting: React.FC<MerchantAccountingProps> = ({ currentMerchant }) => {
  const [summary, setSummary] = useState<MerchantFinancialSummary | null>(null);
  const [expenses, setExpenses] = useState<MerchantExpense[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'pnl' | 'inventory_sync' | 'expenses' | 'receivables'>('pnl');

  // New Expense Modal
  const [isNewExpenseOpen, setIsNewExpenseOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    category: 'إعلانات وتسويق',
    amount: '',
    paymentMethod: 'CASH',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchAccountingData = async () => {
    if (!currentMerchant?.id) return;
    setIsLoading(true);
    try {
      const [acctRes, expRes] = await Promise.all([
        fetch(`/api/merchants/${currentMerchant.id}/accounting/summary`),
        fetch(`/api/merchants/${currentMerchant.id}/expenses`),
      ]);

      if (acctRes.ok) {
        const data = await acctRes.json();
        setSummary(data.summary || null);
        if (data.journalEntries) setJournalEntries(data.journalEntries);
        if (data.stockMovements) setStockMovements(data.stockMovements);
      }
      if (expRes.ok) {
        const expData = await expRes.json();
        setExpenses(expData.expenses || []);
      }
    } catch (err) {
      console.error('Failed to load merchant accounting:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccountingData();
  }, [currentMerchant?.id]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(expenseForm.amount);
    if (!expenseForm.title.trim() || isNaN(amt) || amt <= 0) {
      showToast('يرجى كتابة عنوان المصروف والمبلغ بشكل صحيح', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/merchants/${currentMerchant.id}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: expenseForm.title.trim(),
          category: expenseForm.category,
          amount: amt,
          paymentMethod: expenseForm.paymentMethod,
          date: expenseForm.date,
          notes: expenseForm.notes.trim(),
        }),
      });

      if (res.ok) {
        showToast('تم تسجيل المصروف بنجاح وتحديث قائمة الأرباح والخسائر');
        setIsNewExpenseOpen(false);
        setExpenseForm({
          title: '',
          category: 'إعلانات وتسويق',
          amount: '',
          paymentMethod: 'CASH',
          date: new Date().toISOString().split('T')[0],
          notes: '',
        });
        fetchAccountingData();
      } else {
        showToast('فشل في تسجيل المصروف', 'error');
      }
    } catch (err) {
      showToast('خطأ في الاتصال بالخادم', 'error');
    }
  };

  return (
    <div className="space-y-5" dir="rtl">
      {/* Toast */}
      {toastMessage && (
        <div
          className={`fixed bottom-5 left-5 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white shadow-emerald-600/30'
              : 'bg-rose-600 text-white shadow-rose-600/30'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Sync Status Banner */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/80 rounded-2xl p-3 px-4 flex flex-col sm:flex-row items-center justify-between gap-2 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
            <Layers className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <div className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
              <span>الربط التلقائي بين المحاسبة والمخزون نشط ومزامن لحظياً</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                <ShieldCheck className="w-3 h-3" />
                تلقائي 100%
              </span>
            </div>
            <div className="text-[11px] text-emerald-800/80">
              يتم خصم الأصناف من المستودع وتوليد القيود المحاسبية وإثبات تكلفة البضاعة المباعة (COGS) فور تأكيد أي فاتورة مبيعات.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="bg-white/80 px-3 py-1.5 rounded-xl border border-emerald-200 text-slate-700 font-bold flex items-center gap-1.5">
            <Boxes className="w-3.5 h-3.5 text-blue-600" />
            <span>قيمة المخزون الحالي: </span>
            <span className="font-black font-mono text-blue-800">{formatCurrency(summary?.inventoryAssetValue || 0)}</span>
          </div>
        </div>
      </div>

      {/* Top Navigation & Financial KPI Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>صافي المبيعات (Revenue)</span>
            <DollarSign className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {formatCurrency(summary?.totalRevenue || 0)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">مبيعات المحل + الفواتير + الشحن</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>تكلفة البضاعة المباعة (COGS)</span>
            <ShoppingBag className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 mt-2">
            {formatCurrency(summary?.costOfGoodsSold || 0)}
          </div>
          <div className="text-[11px] text-slate-500 font-bold mt-1">
            مجمل الربح: <span className="text-emerald-700 font-black">{formatCurrency(summary?.grossProfit || 0)}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>المصروفات وأجور دارجو</span>
            <TrendingDown className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600 mt-2">
            {formatCurrency((summary?.totalExpenses || 0) + (summary?.deliveryFeesPaid || 0))}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            شحن: {formatCurrency(summary?.deliveryFeesPaid || 0)} | تشغيلي: {formatCurrency(summary?.totalExpenses || 0)}
          </div>
        </div>

        <div
          className={`rounded-2xl p-4 border shadow-sm ${
            (summary?.netProfit || 0) >= 0
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-rose-500/10 border-rose-500/30'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-black">
            <span className={(summary?.netProfit || 0) >= 0 ? 'text-emerald-800' : 'text-rose-800'}>
              صافي الربح الحقيقي (Net Profit)
            </span>
            <TrendingUp
              className={`w-4 h-4 ${(summary?.netProfit || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
            />
          </div>
          <div
            className={`text-2xl font-black mt-2 ${
              (summary?.netProfit || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {formatCurrency(summary?.netProfit || 0)}
          </div>
          <div className="text-[11px] font-bold text-slate-600 mt-1">
            هامش الصافي: {Math.round(summary?.netMarginPercent || 0)}%
          </div>
        </div>
      </div>

      {/* Tabs Switcher & Actions */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setActiveTab('pnl')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'pnl'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            قائمة الدخل والأرباح (P&L)
          </button>
          <button
            onClick={() => setActiveTab('inventory_sync')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'inventory_sync'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-600" />
            <span>الربط المخزني والقيود الآلية ({journalEntries.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'expenses'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            سجل المصروفات ({expenses.length})
          </button>
          <button
            onClick={() => setActiveTab('receivables')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'receivables'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            الذمم ومحفظة دارجو
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={() => setIsNewExpenseOpen(true)}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>تسجيل مصروف جديد</span>
          </button>

          <button
            onClick={fetchAccountingData}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tab 1: Comprehensive P&L Statement */}
      {activeTab === 'pnl' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div>
              <h3 className="text-base font-black text-slate-900">
                قائمة الأرباح والخسائر الشاملة للمتجر (Income Statement)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                حساب ختامي دقيق للمبيعات، تكلفة البضاعة المباعة، أجور شحن دارجو، والمصاريف التشغيلية
              </p>
            </div>
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة الكشف</span>
            </button>
          </div>

          <div className="space-y-4 text-xs">
            {/* Section 1: Revenue */}
            <div>
              <div className="font-bold text-slate-900 text-xs bg-slate-50 p-2.5 rounded-xl flex justify-between items-center">
                <span>1. إيرادات المبيعات (Gross Revenue)</span>
                <span className="font-black text-emerald-700">
                  {formatCurrency(summary?.totalRevenue || 0)}
                </span>
              </div>
              <div className="px-4 py-2 space-y-1.5 text-slate-600">
                <div className="flex justify-between">
                  <span>- مبيعات المحل المباشرة (POS) والطلبيات المكتملة</span>
                  <span className="font-medium font-mono">{formatCurrency(summary?.totalRevenue || 0)}</span>
                </div>
              </div>
            </div>

            {/* Section 2: COGS */}
            <div>
              <div className="font-bold text-slate-900 text-xs bg-amber-50/50 p-2.5 rounded-xl flex justify-between items-center border border-amber-100">
                <span>2. تكلفة البضاعة المباعة (Cost of Goods Sold - COGS)</span>
                <span className="font-black text-amber-800">
                  - {formatCurrency(summary?.costOfGoodsSold || 0)}
                </span>
              </div>
              <div className="px-4 py-2 space-y-1.5 text-slate-600">
                <div className="flex justify-between">
                  <span>- تكلفة شراء الأصناف المباعة من الموردين بناءً على سعر التكلفة</span>
                  <span className="font-medium font-mono">{formatCurrency(summary?.costOfGoodsSold || 0)}</span>
                </div>
              </div>
            </div>

            {/* Subtotal: Gross Profit */}
            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 flex justify-between items-center font-black text-xs text-emerald-900">
              <span>مجمل الربح التجاري (Gross Profit)</span>
              <span className="text-sm font-black">{formatCurrency(summary?.grossProfit || 0)}</span>
            </div>

            {/* Section 3: Shipping / Delivery Fees */}
            <div>
              <div className="font-bold text-slate-900 text-xs bg-slate-50 p-2.5 rounded-xl flex justify-between items-center">
                <span>3. أجور ومصاريف الشحن المدفوعة لدارجو (Logistics Fees)</span>
                <span className="font-black text-rose-600">
                  - {formatCurrency(summary?.deliveryFeesPaid || 0)}
                </span>
              </div>
              <div className="px-4 py-2 text-slate-600">
                <div className="flex justify-between">
                  <span>- رسوم توصيل طرود المتجر المحسومة من التحصيلات</span>
                  <span className="font-medium font-mono">
                    {formatCurrency(summary?.deliveryFeesPaid || 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 4: Operating Expenses */}
            <div>
              <div className="font-bold text-slate-900 text-xs bg-slate-50 p-2.5 rounded-xl flex justify-between items-center">
                <span>4. المصروفات التشغيلية للمتجر (Operating Expenses)</span>
                <span className="font-black text-rose-600">
                  - {formatCurrency(summary?.totalExpenses || 0)}
                </span>
              </div>
              <div className="px-4 py-2 space-y-1.5 text-slate-600">
                {expenses.length === 0 ? (
                  <div className="text-slate-400">لا توجد مصروفات تشغيلية مسجلة بعد</div>
                ) : (
                  expenses.slice(0, 5).map((exp) => (
                    <div key={exp.id} className="flex justify-between text-[11px]">
                      <span>
                        • {exp.title} ({exp.category})
                      </span>
                      <span className="font-mono">{formatCurrency(exp.amount)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Final Result: Net Profit */}
            <div
              className={`p-4 rounded-2xl border-2 flex justify-between items-center font-black ${
                (summary?.netProfit || 0) >= 0
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                  : 'bg-rose-500 text-white border-rose-400'
              }`}
            >
              <div>
                <div className="text-sm">صافي الربح النهائي التشغيلي (Net Operating Profit)</div>
                <div className="text-[11px] font-normal opacity-80 mt-0.5">
                  بعد خصم تكلفة البضاعة، أجور دارجو، وجميع المصاريف
                </div>
              </div>
              <div className="text-xl font-mono">{formatCurrency(summary?.netProfit || 0)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Automated Inventory & Accounting Link Audit Trail */}
      {activeTab === 'inventory_sync' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>القيمة الدفترية للمخزون (Asset)</span>
                <Boxes className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-xl font-black text-blue-700 mt-2">
                {formatCurrency(summary?.inventoryAssetValue || 0)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                إجمالي الأصناف: <span className="font-bold text-slate-700">{summary?.totalStockItems || 0} قطعة</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>تكلفة البضاعة المباعة (COGS)</span>
                <ShoppingBag className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-xl font-black text-amber-700 mt-2">
                {formatCurrency(summary?.costOfGoodsSold || 0)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                مخصومة تلقائياً من رصيد المستودع
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>القيود المحاسبية التلقائية</span>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl font-black text-emerald-700 mt-2">
                {journalEntries.length} قيد محاسبي
              </div>
              <div className="text-[11px] text-emerald-700 mt-1 font-bold">
                مزدوج القيد ومتوازن تلقائياً
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <div className="font-bold text-xs text-slate-800 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                <span>سجل القيود المحاسبية المتولدة آلياً مع الفواتير والخصم المخزني</span>
              </div>
              <span className="text-[11px] text-emerald-700 font-bold bg-emerald-100/70 px-2.5 py-1 rounded-lg">
                مزامنة حية مع حركة المخزون
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {journalEntries.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  لا توجد قيود مسجلة بعد. عند إنشاء فاتورة بيع جديدة سيتم خصم الأصناف من المخزن وتوليد القيد المحاسبي فوراً.
                </div>
              ) : (
                journalEntries.map((je) => (
                  <div key={je.id} className="p-4 hover:bg-slate-50/80 transition-all space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                          {je.entryNumber}
                        </span>
                        <span className="text-xs font-bold text-slate-800">{je.description}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span>{je.date}</span>
                        <span className="font-black text-slate-900 font-mono">
                          {formatCurrency(je.totalDebit)}
                        </span>
                      </div>
                    </div>

                    {/* Journal lines breakdown */}
                    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 text-[11px] space-y-1">
                      {je.lines.map((l, idx) => (
                        <div key={idx} className="flex items-center justify-between font-mono">
                          <div className="flex items-center gap-2 text-slate-700">
                            <span className="text-slate-400 font-bold">[{l.accountCode}]</span>
                            <span>{l.accountName}</span>
                            {l.note && <span className="text-[10px] text-slate-400 font-sans">({l.note})</span>}
                          </div>
                          <div className="flex items-center gap-4">
                            <span className={l.debit > 0 ? 'text-emerald-700 font-black' : 'text-slate-300'}>
                              مدين: {l.debit > 0 ? formatCurrency(l.debit) : '-'}
                            </span>
                            <span className={l.credit > 0 ? 'text-blue-700 font-black' : 'text-slate-300'}>
                              دائن: {l.credit > 0 ? formatCurrency(l.credit) : '-'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Expenses Log */}
      {activeTab === 'expenses' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="font-bold text-xs text-slate-800 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-amber-500" />
              <span>سجل سندات ومصروفات المتجر التشغيلية</span>
            </div>
            <div className="text-xs font-black text-rose-600">
              إجمالي المصروفات: {formatCurrency(summary?.totalExpenses || 0)}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/75 border-b border-slate-200 text-[11px] font-black text-slate-600">
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">بند المصروف</th>
                  <th className="p-3">التصنيف</th>
                  <th className="p-3">طريقة الدفع</th>
                  <th className="p-3">الملاحظات</th>
                  <th className="p-3 text-left">المبلغ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      لم تقم بتسجيل أي مصروفات تشغيلية بعد. اضغط على "تسجيل مصروف جديد" لإضافة سند.
                    </td>
                  </tr>
                ) : (
                  expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50">
                      <td className="p-3 text-slate-500 font-mono text-[11px]">{exp.date}</td>
                      <td className="p-3 font-bold text-slate-900">{exp.title}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                          {exp.category}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 font-medium">
                        {exp.paymentMethod === 'CASH'
                          ? 'نقداً'
                          : exp.paymentMethod === 'CLIQ'
                          ? 'CliQ'
                          : 'بطاقة'}
                      </td>
                      <td className="p-3 text-slate-500">{exp.notes || '---'}</td>
                      <td className="p-3 text-left font-black text-rose-600">
                        {formatCurrency(exp.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Receivables & DarGo Wallet */}
      {activeTab === 'receivables' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
              <Wallet className="w-5 h-5 text-emerald-600" />
              <span>محفظة تحصيلات دارجو المعلقة (Pending Payout)</span>
            </div>
            <p className="text-xs text-slate-500">
              المبالغ المحصلة من زبائنك من خلال كباتن دارجو للشحنات المسلمة وبانتظار التحويل لحسابك البنكي أو CliQ:
            </p>
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex justify-between items-center">
              <div>
                <div className="text-xs text-emerald-800 font-bold">الرصيد المستحق للصرف الفوري:</div>
                <div className="text-2xl font-black text-emerald-700 mt-1">
                  {formatCurrency(summary?.pendingSettlements || 0)}
                </div>
              </div>
              <div className="text-[11px] text-emerald-700 bg-emerald-100/80 px-3 py-1.5 rounded-xl font-bold">
                جاهز للتسوية
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
              <Building2 className="w-5 h-5 text-blue-600" />
              <span>الذمم والديون التجارية (Receivables & Payables)</span>
            </div>
            <p className="text-xs text-slate-500">
              متابعة الديون المستحقة لك على الزبائن (فواتير بيع بالآجل) والديون للموردين:
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-700 font-bold">ذمم مدينة (مستحقة على العملاء):</span>
                <span className="font-mono font-black text-blue-700">
                  {formatCurrency(summary?.accountsReceivable || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-700 font-bold">ذمم دائنة (مستحقة للموردين):</span>
                <span className="font-mono font-black text-slate-700">
                  {formatCurrency(summary?.accountsPayable || 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: New Expense */}
      {isNewExpenseOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-black">تسجيل سند مصروف تشغيلي جديد</h3>
              </div>
              <button
                onClick={() => setIsNewExpenseOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">بيان المصروف *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: حملة إعلانات ممولة على إنستغرام"
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">التصنيف</label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold focus:outline-none"
                  >
                    <option value="إعلانات وتسويق">إعلانات وتسويق</option>
                    <option value="إيجار ومرافق">إيجار ومرافق</option>
                    <option value="مواد تغليف وكراتين">مواد تغليف وكراتين</option>
                    <option value="رواتب وأجور">رواتب وأجور</option>
                    <option value="برمجيات واشتراكات">برمجيات واشتراكات</option>
                    <option value="مصاريف ضيافة ونظافة">مصاريف ضيافة ونظافة</option>
                    <option value="أخرى">أخرى</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">المبلغ (د.أ) *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="25.00"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">طريقة الدفع</label>
                  <select
                    value={expenseForm.paymentMethod}
                    onChange={(e) => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold focus:outline-none"
                  >
                    <option value="CASH">نقداً من الصندوق</option>
                    <option value="CLIQ">تحويل فوري CliQ</option>
                    <option value="CARD">بطاقة بنكية</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">التاريخ</label>
                  <input
                    type="date"
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات إضافية</label>
                <input
                  type="text"
                  placeholder="أي تفاصيل اختيارية..."
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewExpenseOpen(false)}
                  className="px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-md cursor-pointer"
                >
                  حفظ المصروف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

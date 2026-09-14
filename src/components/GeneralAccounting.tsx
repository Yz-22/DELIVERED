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
  Plus,
  Scale,
  BookOpen,
  PieChart,
  ShieldCheck,
  FileText,
  X,
  ArrowDownLeft,
  ArrowUpRight,
  Landmark
} from 'lucide-react';
import {
  Account,
  JournalEntry,
  Voucher,
  AccountingOverview
} from '../types/accounting';
import { formatCurrency } from '../utils/logisticsHelpers';

export const GeneralAccounting: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<
    'overview' | 'chart_of_accounts' | 'journal_entries' | 'vouchers'
  >('overview');

  const [overview, setOverview] = useState<AccountingOverview | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // New Journal Entry Modal
  const [isNewEntryOpen, setIsNewEntryOpen] = useState(false);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryDescription, setEntryDescription] = useState('');
  const [entryReference, setEntryReference] = useState('');
  const [entryLines, setEntryLines] = useState<
    { accountId: string; description: string; debit: number; credit: number }[]
  >([
    { accountId: '1010', description: '', debit: 0, credit: 0 },
    { accountId: '4010', description: '', debit: 0, credit: 0 },
  ]);

  // New Voucher Modal
  const [isNewVoucherOpen, setIsNewVoucherOpen] = useState(false);
  const [voucherType, setVoucherType] = useState<'RECEIPT' | 'PAYMENT'>('RECEIPT');
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split('T')[0]);
  const [voucherAmount, setVoucherAmount] = useState('');
  const [voucherPartyName, setVoucherPartyName] = useState('');
  const [voucherMethod, setVoucherMethod] = useState<'CASH' | 'CLIQ' | 'BANK' | 'CHEQUE'>('CLIQ');
  const [voucherDebitAccount, setVoucherDebitAccount] = useState('1010');
  const [voucherCreditAccount, setVoucherCreditAccount] = useState('2010');
  const [voucherReference, setVoucherReference] = useState('');
  const [voucherNotes, setVoucherNotes] = useState('');

  // Printable Voucher Modal
  const [viewingVoucher, setViewingVoucher] = useState<Voucher | null>(null);

  // New Account Modal
  const [isNewAccountOpen, setIsNewAccountOpen] = useState(false);
  const [newAccForm, setNewAccForm] = useState({
    code: '',
    nameAr: '',
    nameEn: '',
    type: 'ASSET' as 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE',
    openingBalance: '0',
    description: '',
  });

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchAccountingData = async () => {
    setIsLoading(true);
    try {
      const [ovRes, accRes, jeRes, vcRes] = await Promise.all([
        fetch('/api/accounting/overview'),
        fetch('/api/accounting/accounts'),
        fetch('/api/accounting/journal-entries'),
        fetch('/api/accounting/vouchers'),
      ]);

      if (ovRes.ok) {
        const ovData = await ovRes.json();
        setOverview(ovData);
      }
      if (accRes.ok) {
        const accData = await accRes.json();
        setAccounts(accData.accounts || []);
      }
      if (jeRes.ok) {
        const jeData = await jeRes.json();
        setJournalEntries(jeData.entries || []);
      }
      if (vcRes.ok) {
        const vcData = await vcRes.json();
        setVouchers(vcData.vouchers || []);
      }
    } catch (err) {
      console.error('Failed to load accounting data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccountingData();
  }, []);

  // Total debits & credits in the new entry modal
  const entryTotalDebits = entryLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const entryTotalCredits = entryLines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const isEntryBalanced = Math.abs(entryTotalDebits - entryTotalCredits) < 0.001 && entryTotalDebits > 0;

  // Handle Save Journal Entry
  const handleSaveJournalEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEntryBalanced) {
      showToast('القيد غير متوازن! يجب أن يتساوى مجموع المدين مع مجموع الدائن', 'error');
      return;
    }

    if (!entryDescription.trim()) {
      showToast('يرجى كتابة شرح القيد والبيان', 'error');
      return;
    }

    try {
      const res = await fetch('/api/accounting/journal-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: entryDate,
          description: entryDescription.trim(),
          reference: entryReference.trim() || undefined,
          lines: entryLines.map((l) => ({
            accountId: l.accountId,
            description: l.description || entryDescription,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
          })),
        }),
      });

      if (res.ok) {
        showToast('تم ترحيل قيد اليومية بنجاح وتحديث أرصدة الحسابات وميزان المراجعة');
        setIsNewEntryOpen(false);
        setEntryDescription('');
        setEntryReference('');
        fetchAccountingData();
      } else {
        showToast('فشل في حفظ قيد اليومية', 'error');
      }
    } catch (err) {
      showToast('خطأ في الاتصال بالخادم', 'error');
    }
  };

  // Handle Save Voucher
  const handleSaveVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(voucherAmount);
    if (!voucherPartyName.trim() || isNaN(amt) || amt <= 0) {
      showToast('يرجى تعبئة اسم المستلم/الدافع والمبلغ بشكل صحيح', 'error');
      return;
    }

    try {
      const res = await fetch('/api/accounting/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: voucherType,
          date: voucherDate,
          amount: amt,
          partyName: voucherPartyName.trim(),
          paymentMethod: voucherMethod,
          debitAccountId: voucherDebitAccount,
          creditAccountId: voucherCreditAccount,
          reference: voucherReference.trim() || undefined,
          notes: voucherNotes.trim() || undefined,
        }),
      });

      if (res.ok) {
        showToast(`تم إصدار السند بنجاح وترحيل القيد المحاسبي المرتبط آلياً`);
        setIsNewVoucherOpen(false);
        setVoucherPartyName('');
        setVoucherAmount('');
        setVoucherNotes('');
        setVoucherReference('');
        fetchAccountingData();
      } else {
        showToast('فشل في إصدار السند', 'error');
      }
    } catch (err) {
      showToast('خطأ في الاتصال بالخادم', 'error');
    }
  };

  // Handle Create Account
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccForm.code.trim() || !newAccForm.nameAr.trim()) {
      showToast('يرجى إدخال رمز الحساب واسمه باللغة العربية', 'error');
      return;
    }

    try {
      const res = await fetch('/api/accounting/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newAccForm.code.trim(),
          nameAr: newAccForm.nameAr.trim(),
          nameEn: newAccForm.nameEn.trim() || newAccForm.nameAr.trim(),
          type: newAccForm.type,
          balance: parseFloat(newAccForm.openingBalance) || 0,
          description: newAccForm.description.trim(),
        }),
      });

      if (res.ok) {
        showToast('تمت إضافة الحساب إلى دليل الحسابات بنجاح');
        setIsNewAccountOpen(false);
        setNewAccForm({
          code: '',
          nameAr: '',
          nameEn: '',
          type: 'ASSET',
          openingBalance: '0',
          description: '',
        });
        fetchAccountingData();
      } else {
        showToast('فشل في إضافة الحساب (قد يكون الرمز مكرراً)', 'error');
      }
    } catch (err) {
      showToast('خطأ في الاتصال بالخادم', 'error');
    }
  };

  return (
    <div className="space-y-5" dir="rtl">
      {/* Toast Notification */}
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

      {/* Top Accounting KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>إجمالي إيرادات العمليات (دارجو)</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-2">
            {formatCurrency(overview?.totalIncome || 0)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">أجور توصيل وخدمات شحن ولوجستيات</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>المصاريف التشغيلية وعمولات الكباتن</span>
            <Receipt className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600 mt-2">
            {formatCurrency(overview?.totalExpenses || 0)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">مصاريف الوقود، أجور السائقين، والتشغيل</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>صافي الدخل التشغيلي للشركة</span>
            <Scale className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {formatCurrency(overview?.netIncome || 0)}
          </div>
          <div className="text-[11px] text-emerald-600 font-bold mt-1">
            أرباح محققة خالية من الالتزامات
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>توازن ميزان المراجعة العام</span>
            <ShieldCheck className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-600 mt-2">
            {overview?.isBalanced ? 'متوازن 100%' : 'تنبيه تدقيق'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            مدين: {formatCurrency(overview?.totalDebits || 0)} = دائن:{' '}
            {formatCurrency(overview?.totalCredits || 0)}
          </div>
        </div>
      </div>

      {/* Navigation Subtabs & Actions */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('overview')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'overview'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Scale className="w-4 h-4 inline-block ml-1" />
            <span>ميزان المراجعة وقائمة المركز المالي</span>
          </button>

          <button
            onClick={() => setActiveSubTab('chart_of_accounts')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'chart_of_accounts'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4 inline-block ml-1" />
            <span>دليل وشجرة الحسابات ({accounts.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('journal_entries')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'journal_entries'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <FileText className="w-4 h-4 inline-block ml-1" />
            <span>قيود اليومية العامة ({journalEntries.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('vouchers')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'vouchers'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Receipt className="w-4 h-4 inline-block ml-1" />
            <span>سندات القبض والصرف ({vouchers.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {activeSubTab === 'journal_entries' && (
            <button
              onClick={() => setIsNewEntryOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>إنشاء قيد يومية يدوي</span>
            </button>
          )}

          {activeSubTab === 'vouchers' && (
            <button
              onClick={() => setIsNewVoucherOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>إصدار سند قبض / صرف</span>
            </button>
          )}

          {activeSubTab === 'chart_of_accounts' && (
            <button
              onClick={() => setIsNewAccountOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة حساب بدليل الحسابات</span>
            </button>
          )}

          <button
            onClick={fetchAccountingData}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
            title="تحديث البيانات المحاسبية"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Subtab 1: Trial Balance & Overview */}
      {activeSubTab === 'overview' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                ميزان المراجعة بالأرصدة (Trial Balance)
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                كشف أرصدة الحسابات المدينة والدائنة مع التحقق من التطابق التام
              </p>
            </div>
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة ميزان المراجعة</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-black text-slate-600">
                  <th className="p-3">رمز الحساب</th>
                  <th className="p-3">اسم الحساب</th>
                  <th className="p-3">نوع الحساب</th>
                  <th className="p-3 text-left font-black text-emerald-800">الرصيد المدين (Debit)</th>
                  <th className="p-3 text-left font-black text-blue-800">الرصيد الدائن (Credit)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(!overview?.trialBalance || overview.trialBalance.length === 0) ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      لا توجد حسابات مسجلة
                    </td>
                  </tr>
                ) : (
                  overview.trialBalance.map((tb) => (
                    <tr key={tb.accountId} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-slate-600">{tb.code}</td>
                      <td className="p-3 font-bold text-slate-900">{tb.nameAr || tb.name}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                          {tb.type === 'ASSET'
                            ? 'أصول'
                            : tb.type === 'LIABILITY'
                            ? 'خصوم والتزامات'
                            : tb.type === 'EQUITY'
                            ? 'حقوق ملكية'
                            : tb.type === 'REVENUE'
                            ? 'إيرادات'
                            : 'مصروفات'}
                        </span>
                      </td>
                      <td className="p-3 text-left font-mono font-bold text-emerald-700">
                        {tb.debit > 0 ? formatCurrency(tb.debit) : '---'}
                      </td>
                      <td className="p-3 text-left font-mono font-bold text-blue-700">
                        {tb.credit > 0 ? formatCurrency(tb.credit) : '---'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white font-black text-xs">
                  <td colSpan={3} className="p-3 text-right">
                    إجمالي ميزان المراجعة (Total Balanced):
                  </td>
                  <td className="p-3 text-left font-mono text-amber-400 text-sm">
                    {formatCurrency(overview?.totalDebits || 0)}
                  </td>
                  <td className="p-3 text-left font-mono text-amber-400 text-sm">
                    {formatCurrency(overview?.totalCredits || 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Subtab 2: Chart of Accounts */}
      {activeSubTab === 'chart_of_accounts' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="بحث في دليل الحسابات برمز أو اسم الحساب..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-9 pl-4 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-black text-slate-600">
                  <th className="p-3">رمز الحساب</th>
                  <th className="p-3">اسم الحساب (عربي)</th>
                  <th className="p-3">الاسم بالإنجليزية</th>
                  <th className="p-3">التصنيف المحاسبي</th>
                  <th className="p-3">طبيعة الحساب</th>
                  <th className="p-3 text-left">الرصيد الحالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accounts
                  .filter(
                    (a) =>
                      (a.nameAr || a.name).includes(searchQuery) ||
                      a.code.includes(searchQuery) ||
                      (a.nameEn || a.name).toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((acc) => (
                    <tr key={acc.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-slate-700">{acc.code}</td>
                      <td className="p-3 font-bold text-slate-900">{acc.nameAr || acc.name}</td>
                      <td className="p-3 text-slate-500 font-mono text-[11px]">{acc.nameEn || acc.name}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            acc.type === 'ASSET'
                              ? 'bg-emerald-100 text-emerald-800'
                              : acc.type === 'LIABILITY'
                              ? 'bg-rose-100 text-rose-800'
                              : acc.type === 'EQUITY'
                              ? 'bg-blue-100 text-blue-800'
                              : acc.type === 'REVENUE'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {acc.type === 'ASSET'
                            ? 'أصول (Assets)'
                            : acc.type === 'LIABILITY'
                            ? 'خصوم (Liabilities)'
                            : acc.type === 'EQUITY'
                            ? 'حقوق ملكية (Equity)'
                            : acc.type === 'REVENUE'
                            ? 'إيرادات (Revenue)'
                            : 'مصروفات (Expenses)'}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 font-medium">
                        {(acc.normalBalance || (acc.isDebitNormal ? 'DEBIT' : 'CREDIT')) === 'DEBIT'
                          ? 'مدين بطبيعته'
                          : 'دائن بطبيعته'}
                      </td>
                      <td className="p-3 text-left font-black font-mono text-slate-900 text-sm">
                        {formatCurrency(acc.balance)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subtab 3: Journal Entries Ledger */}
      {activeSubTab === 'journal_entries' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900">دفتر قيود اليومية العامة</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                سجل كافة القيود المحاسبية التلقائية واليدوية بنظام القيد المزدوج
              </p>
            </div>
            <div className="text-xs text-slate-500 font-mono">
              إجمالي {journalEntries.length} قيد معتمد
            </div>
          </div>

          <div className="divide-y divide-slate-200">
            {journalEntries.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">لا توجد قيود يومية مسجلة</div>
            ) : (
              journalEntries.map((je) => (
                <div key={je.id} className="p-4 space-y-2 hover:bg-slate-50/50 transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-slate-900 bg-slate-100 px-2 py-1 rounded-lg">
                        {je.entryNumber}
                      </span>
                      <span className="text-slate-400 font-mono text-[11px]">{je.date}</span>
                      <span className="font-bold text-slate-800">{je.description}</span>
                    </div>
                    {(je.reference || je.referenceId) && (
                      <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        مرجع: {je.reference || je.referenceId}
                      </span>
                    )}
                  </div>

                  {/* Lines Table */}
                  <div className="bg-slate-50 rounded-xl overflow-hidden border border-slate-200">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-[10px] font-black text-slate-500 bg-slate-100/50">
                          <th className="p-2">رمز واسم الحساب</th>
                          <th className="p-2">البيان والشرح</th>
                          <th className="p-2 text-left font-black text-emerald-800">مدين (Debit)</th>
                          <th className="p-2 text-left font-black text-blue-800">دائن (Credit)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {je.lines.map((l, idx) => (
                          <tr key={idx}>
                            <td className="p-2 font-bold text-slate-800">
                              <span className="font-mono text-slate-500 ml-1">{l.accountCode}</span>
                              <span>{l.accountName}</span>
                            </td>
                            <td className="p-2 text-slate-600">{l.description || l.note || '---'}</td>
                            <td className="p-2 text-left font-mono font-bold text-emerald-700">
                              {l.debit > 0 ? formatCurrency(l.debit) : '---'}
                            </td>
                            <td className="p-2 text-left font-mono font-bold text-blue-700">
                              {l.credit > 0 ? formatCurrency(l.credit) : '---'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Subtab 4: Vouchers Ledger */}
      {activeSubTab === 'vouchers' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                سجل سندات القبض والصرف الرسمية (Vouchers)
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                سندات صرف تسويات التجار، عهد الكباتن، والمقبوضات
              </p>
            </div>
            <div className="text-xs text-slate-500 font-mono">{vouchers.length} سند مسجل</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-black text-slate-600">
                  <th className="p-3">رقم السند</th>
                  <th className="p-3">النوع</th>
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">الطرف المستلم / الدافع</th>
                  <th className="p-3">طريقة الدفع</th>
                  <th className="p-3">البيان</th>
                  <th className="p-3 text-left">المبلغ</th>
                  <th className="p-3 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vouchers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      لا توجد سندات مسجلة بعد
                    </td>
                  </tr>
                ) : (
                  vouchers.map((vc) => (
                    <tr key={vc.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-slate-900">{vc.voucherNumber}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            vc.type === 'RECEIPT'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {vc.type === 'RECEIPT' ? 'سند قبض' : 'سند صرف'}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500 font-mono text-[11px]">{vc.date}</td>
                      <td className="p-3 font-bold text-slate-900">{vc.partyName || vc.beneficiaryOrPayer}</td>
                      <td className="p-3 font-medium text-slate-600">
                        {vc.paymentMethod === 'CLIQ'
                          ? 'CliQ فوري'
                          : vc.paymentMethod === 'CASH'
                          ? 'نقداً'
                          : 'تحويل بنكي'}
                      </td>
                      <td className="p-3 text-slate-600 max-w-xs truncate">{vc.notes || '---'}</td>
                      <td className="p-3 text-left font-black text-slate-900">
                        {formatCurrency(vc.amount)}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => setViewingVoucher(vc)}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                          title="عرض وطباعة السند"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: New Journal Entry */}
      {isNewEntryOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-black">إنشاء قيد يومية محاسبي متوازن</h3>
              </div>
              <button
                onClick={() => setIsNewEntryOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveJournalEntry} className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">التاريخ *</label>
                  <input
                    type="date"
                    required
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">رقم المرجع / المستند</label>
                  <input
                    type="text"
                    placeholder="مثال: JV-1002"
                    value={entryReference}
                    onChange={(e) => setEntryReference(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">بيان وشرح القيد *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: إثبات مصاريف نقل ووقود شهرية..."
                  value={entryDescription}
                  onChange={(e) => setEntryDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              {/* Journal Entry Lines */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="font-black text-slate-800">أطراف القيد (مدين / دائن):</div>
                {entryLines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <div className="col-span-5">
                      <label className="block text-[10px] text-slate-500 font-bold mb-0.5">الحساب</label>
                      <select
                        value={line.accountId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEntryLines((prev) =>
                            prev.map((l, i) => (i === idx ? { ...l, accountId: val } : l))
                          );
                        }}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-bold"
                      >
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} - {a.nameAr || a.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-3">
                      <label className="block text-[10px] text-slate-500 font-bold mb-0.5">مدين (Debit)</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="0.00"
                        value={line.debit || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setEntryLines((prev) =>
                            prev.map((l, i) =>
                              i === idx ? { ...l, debit: val, credit: val > 0 ? 0 : l.credit } : l
                            )
                          );
                        }}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-emerald-700"
                      />
                    </div>

                    <div className="col-span-3">
                      <label className="block text-[10px] text-slate-500 font-bold mb-0.5">دائن (Credit)</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="0.00"
                        value={line.credit || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setEntryLines((prev) =>
                            prev.map((l, i) =>
                              i === idx ? { ...l, credit: val, debit: val > 0 ? 0 : l.debit } : l
                            )
                          );
                        }}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-blue-700"
                      />
                    </div>

                    <div className="col-span-1 flex items-end justify-center pt-4">
                      {entryLines.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setEntryLines((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-rose-500 hover:text-rose-700 p-1"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() =>
                    setEntryLines((prev) => [
                      ...prev,
                      { accountId: accounts[0]?.id || '1010', description: '', debit: 0, credit: 0 },
                    ])
                  }
                  className="px-3 py-1.5 rounded-lg border border-dashed border-slate-300 text-slate-600 hover:bg-slate-50 font-bold text-[11px]"
                >
                  + إضافة طرف قيد آخر
                </button>
              </div>

              {/* Balance Verification Bar */}
              <div className="bg-slate-100 p-3 rounded-2xl flex justify-between items-center text-xs">
                <div>
                  <span>مجموع المدين: </span>
                  <span className="font-mono font-black text-emerald-700">
                    {formatCurrency(entryTotalDebits)}
                  </span>
                </div>
                <div>
                  <span>مجموع الدائن: </span>
                  <span className="font-mono font-black text-blue-700">
                    {formatCurrency(entryTotalCredits)}
                  </span>
                </div>
                <div>
                  <span
                    className={`px-2.5 py-1 rounded-full font-black text-[11px] ${
                      isEntryBalanced
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {isEntryBalanced ? 'متوازن ومقبول ✓' : 'غير متوازن ✕'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewEntryOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={!isEntryBalanced}
                  className={`px-5 py-2 rounded-xl font-black shadow-md cursor-pointer ${
                    isEntryBalanced
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  ترحيل القيد المحاسبي
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Voucher */}
      {isNewVoucherOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-black">إصدار سند قبض / صرف مالي رسمي</h3>
              </div>
              <button
                onClick={() => setIsNewVoucherOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVoucher} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setVoucherType('RECEIPT')}
                  className={`py-2.5 rounded-xl font-bold border transition-all ${
                    voucherType === 'RECEIPT'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  سند قبض (Receipt)
                </button>
                <button
                  type="button"
                  onClick={() => setVoucherType('PAYMENT')}
                  className={`py-2.5 rounded-xl font-bold border transition-all ${
                    voucherType === 'PAYMENT'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  سند صرف (Payment)
                </button>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {voucherType === 'RECEIPT' ? 'اسم الدافع / العميل *' : 'اسم المستلم / التاجر *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="الاسم الكامل..."
                  value={voucherPartyName}
                  onChange={(e) => setVoucherPartyName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">المبلغ (د.أ) *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="100.00"
                    value={voucherAmount}
                    onChange={(e) => setVoucherAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">طريقة الدفع</label>
                  <select
                    value={voucherMethod}
                    onChange={(e) => setVoucherMethod(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  >
                    <option value="CLIQ">تحويل CliQ فوري</option>
                    <option value="CASH">نقداً من الصندوق</option>
                    <option value="BANK">تحويل بنكي</option>
                    <option value="CHEQUE">شيك بنكي</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الحساب المدين</label>
                  <select
                    value={voucherDebitAccount}
                    onChange={(e) => setVoucherDebitAccount(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 font-bold text-[11px]"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.nameAr || a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الحساب الدائن</label>
                  <select
                    value={voucherCreditAccount}
                    onChange={(e) => setVoucherCreditAccount(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 font-bold text-[11px]"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.nameAr || a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">البيان والشرح</label>
                <input
                  type="text"
                  placeholder="تسوية مستحقات، دفعة نقدية، سداد ذمة..."
                  value={voucherNotes}
                  onChange={(e) => setVoucherNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewVoucherOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-md cursor-pointer"
                >
                  إصدار السند وترحيل القيد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View & Print Voucher */}
      {viewingVoucher && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-black">
                  {viewingVoucher.type === 'RECEIPT' ? 'سند قبض رسمي' : 'سند صرف رسمي'}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 cursor-pointer"
                >
                  طباعة
                </button>
                <button
                  onClick={() => setViewingVoucher(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-800">
              <div className="text-center pb-3 border-b border-slate-200">
                <div className="text-base font-black text-slate-900">
                  شركة دارجو لخدمات الشحن واللوجستيات DarGo
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  قسم المحاسبة والمالية - عمان، المملكة الأردنية الهاشمية
                </div>
                <div className="text-[10px] font-mono text-slate-400 mt-1">
                  رقم السند: {viewingVoucher.voucherNumber} | التاريخ: {viewingVoucher.date}
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">
                    {viewingVoucher.type === 'RECEIPT' ? 'وصلنا من السيد/الشركة:' : 'اصرفوا للسيد/الشركة:'}
                  </span>
                  <span className="font-bold text-slate-900">
                    {viewingVoucher.partyName || viewingVoucher.beneficiaryOrPayer}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">مبلغ وقدره:</span>
                  <span className="font-black text-emerald-700 text-sm font-mono">
                    {formatCurrency(viewingVoucher.amount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">طريقة الدفع:</span>
                  <span className="font-bold">{viewingVoucher.paymentMethod}</span>
                </div>
                {viewingVoucher.notes && (
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-slate-500">وذلك عن: </span>
                    <span className="text-slate-800 font-medium">{viewingVoucher.notes}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-6 text-center border-t border-slate-200">
                <div>
                  <div className="text-[10px] text-slate-400">توقيع المستلم / الدافع</div>
                  <div className="h-10 mt-2 border-b border-dashed border-slate-300"></div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">توقيع المحاسب المعتمد</div>
                  <div className="h-10 mt-2 border-b border-dashed border-slate-300"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Account to Chart */}
      {isNewAccountOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-black">إضافة حساب جديد في شجرة الحسابات</h3>
              </div>
              <button
                onClick={() => setIsNewAccountOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">رمز الحساب (الكود) *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: 1040"
                    value={newAccForm.code}
                    onChange={(e) => setNewAccForm({ ...newAccForm, code: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">التصنيف المحاسبي</label>
                  <select
                    value={newAccForm.type}
                    onChange={(e) => setNewAccForm({ ...newAccForm, type: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  >
                    <option value="ASSET">أصول (Assets)</option>
                    <option value="LIABILITY">خصوم (Liabilities)</option>
                    <option value="EQUITY">حقوق ملكية (Equity)</option>
                    <option value="REVENUE">إيرادات (Revenue)</option>
                    <option value="EXPENSE">مصروفات (Expenses)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم الحساب باللغة العربية *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: ذمم بطاقات ائتمانية مستحقة"
                  value={newAccForm.nameAr}
                  onChange={(e) => setNewAccForm({ ...newAccForm, nameAr: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم الحساب بالإنجليزية</label>
                <input
                  type="text"
                  placeholder="e.g. Credit Card Receivables"
                  value={newAccForm.nameEn}
                  onChange={(e) => setNewAccForm({ ...newAccForm, nameEn: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الرصيد الافتتاحي (د.أ)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newAccForm.openingBalance}
                  onChange={(e) => setNewAccForm({ ...newAccForm, openingBalance: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewAccountOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-md cursor-pointer"
                >
                  حفظ الحساب
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

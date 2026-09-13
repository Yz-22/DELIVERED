import React, { useState } from 'react';
import {
  X,
  QrCode,
  CheckCircle2,
  Copy,
  Check,
  Building,
  Smartphone,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { Order } from '../types/logistics';
import { formatCurrency } from '../utils/logisticsHelpers';

interface CliqPaymentModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedOrder: Order) => void;
}

export const CliqPaymentModal: React.FC<CliqPaymentModalProps> = ({
  order,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [cliqAlias, setCliqAlias] = useState('DARGO@CLIQ');
  const [transferRef, setTransferRef] = useState(
    `CLIQ-${Math.floor(100000 + Math.random() * 900000)}`
  );
  const [senderName, setSenderName] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen || !order) return null;

  const handleCopyAlias = () => {
    navigator.clipboard.writeText(cliqAlias);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleConfirmCliqPayment = async () => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/orders/${order.id}/pay-cliq`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionRef: transferRef,
          alias: cliqAlias,
          note: senderName ? `المحول: ${senderName}` : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'تعذر تأكيد دفع CliQ');
      }

      setIsSuccess(true);
      setTimeout(() => {
        onSuccess(data.order);
        setIsSuccess(false);
        onClose();
      }, 1600);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold">الدفع الإلكتروني الفوري (CliQ الأردني)</h3>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded border border-emerald-500/30">
                  JoPACC معتمد
                </span>
              </div>
              <p className="text-xs text-slate-300">
                تسديد قيمة الطلبية فوراً عبر تطبيق البنك بواسطة رمز QR أو المستعار
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Order Summary Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <div className="text-xs font-mono font-bold text-slate-900">{order.sequence}</div>
              <div className="text-xs text-slate-600 mt-0.5">
                المستلم: <span className="font-semibold text-slate-800">{order.recipientName}</span> ({order.area})
              </div>
            </div>
            <div className="text-left">
              <div className="text-[10px] text-slate-500 font-medium">المبلغ المطلوب تحصيله</div>
              <div className="text-xl font-extrabold text-amber-600 font-mono">
                {formatCurrency(order.totalCollection)}
              </div>
            </div>
          </div>

          {isSuccess ? (
            <div className="py-8 text-center space-y-3 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h4 className="text-lg font-bold text-slate-900">تم التحقق من حوالة CliQ بنجاح!</h4>
              <p className="text-xs text-slate-600 max-w-xs mx-auto">
                تم تحويل حالة الطلبية إلى <strong>مستلمة (DELIVERED)</strong> وتوثيق مرجع الحوالة ({transferRef}) بنجاح.
              </p>
            </div>
          ) : (
            <>
              {/* QR Code & Payment Instructions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center bg-indigo-50/40 border border-indigo-100 rounded-xl p-4">
                {/* Visual QR Code Display */}
                <div className="flex flex-col items-center justify-center bg-white p-3 rounded-xl border border-indigo-200/80 shadow-xs">
                  <div className="relative w-36 h-36 bg-slate-900 p-2 rounded-lg flex items-center justify-center text-white">
                    {/* Simulated Authentic Jordan JoPACC CliQ QR Pattern */}
                    <div className="w-full h-full bg-white rounded flex items-center justify-center relative p-1">
                      <div className="w-full h-full grid grid-cols-6 grid-rows-6 gap-1 p-1 bg-slate-900 rounded">
                        <div className="bg-white col-span-2 row-span-2 rounded-xs"></div>
                        <div className="bg-amber-400 col-span-2"></div>
                        <div className="bg-white col-span-2 row-span-2 rounded-xs"></div>
                        <div className="bg-white col-span-2"></div>
                        <div className="bg-white col-span-2"></div>
                        <div className="bg-white col-span-2 row-span-2 rounded-xs"></div>
                        <div className="bg-emerald-400 col-span-2"></div>
                        <div className="bg-white col-span-2 row-span-2 rounded-xs"></div>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-amber-500 text-slate-950 font-black text-[9px] px-1.5 py-0.5 rounded shadow-sm">
                          CliQ
                        </div>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 font-semibold mt-2">امسح عبر تطبيق أي بنك أردني</span>
                </div>

                {/* CliQ Alias & Bank Info */}
                <div className="space-y-2.5 text-right">
                  <div className="text-xs text-indigo-950 font-bold flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-indigo-600" />
                    اسم المستعار الرسمي (CliQ Alias)
                  </div>
                  <div className="flex items-center gap-1 bg-white border border-indigo-200 rounded-lg p-1.5 shadow-2xs">
                    <span className="font-mono font-bold text-sm text-slate-900 px-2 flex-1 text-left select-all">
                      {cliqAlias}
                    </span>
                    <button
                      onClick={handleCopyAlias}
                      className="px-2.5 py-1 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded font-semibold flex items-center gap-1 transition-colors"
                      title="نسخ الاسم المستعار"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{isCopied ? 'تم النسخ' : 'نسخ'}</span>
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-600 space-y-1 pt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>البنك المستلم: <strong>البنك العربي / بنك الاتحاد</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>اسم الحساب: <strong>شركة دارجو للخدمات اللوجستية</strong></span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Confirmation Form */}
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      رقم مرجع الحوالة (Transfer Ref #)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={transferRef}
                        onChange={(e) => setTransferRef(e.target.value)}
                        placeholder="مثال: CLIQ-849201"
                        className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg p-2 text-slate-900 pr-2 pl-8"
                      />
                      <button
                        type="button"
                        onClick={() => setTransferRef(`CLIQ-${Math.floor(100000 + Math.random() * 900000)}`)}
                        className="absolute left-2 top-2 text-slate-400 hover:text-slate-700"
                        title="توليد رقم مرجع جديد"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      اسم المحول / العميل (اختياري)
                    </label>
                    <input
                      type="text"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder={order.recipientName}
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 text-slate-900"
                    />
                  </div>
                </div>

                {errorMsg && (
                  <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!isSuccess && (
          <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors"
            >
              إلغاء / تحصيل نقدي COD
            </button>
            <button
              type="button"
              onClick={handleConfirmCliqPayment}
              disabled={isProcessing}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {isProcessing ? (
                <span>جاري التحقق من السيرفر...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تأكيد استلام حوالة CliQ فوراً</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

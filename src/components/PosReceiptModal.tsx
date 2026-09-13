import React from 'react';
import { X, Printer, Check, QrCode, Store, Phone, Calendar, ArrowDown, ShoppingBag } from 'lucide-react';
import { User } from '../types/logistics';
import { formatCurrency, formatDate } from '../utils/logisticsHelpers';

export interface PosSaleItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
}

export interface PosSale {
  id: string;
  invoiceNumber: string;
  merchantId: string;
  merchantName: string;
  type: 'IN_STORE' | 'ONLINE_DELIVERY';
  items: PosSaleItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  cashReceived?: number;
  changeDue?: number;
  paymentMethod: 'CASH' | 'CARD' | 'CLIQ' | 'DEBT';
  customerName?: string;
  customerPhone?: string;
  governorate?: string;
  area?: string;
  deliveryFee?: number;
  linkedOrderSequence?: string;
  notes?: string;
  createdAt: string;
  cashierName: string;
}

interface PosReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: PosSale | null;
  merchant: User;
}

export const PosReceiptModal: React.FC<PosReceiptModalProps> = ({
  isOpen,
  onClose,
  sale,
  merchant,
}) => {
  if (!isOpen || !sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'CASH':
        return 'نقداً (كاش)';
      case 'CARD':
        return 'بطاقة ائتمان / مدى (POS)';
      case 'CLIQ':
        return 'تحويل كليك فوري (CliQ)';
      case 'DEBT':
        return 'حساب آجل / ذمم';
      default:
        return method;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-slate-100">
        {/* Header Actions */}
        <div className="px-5 py-3.5 bg-slate-800/80 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold text-slate-200">فاتورة نقطة البيع POS</span>
            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md font-mono font-bold">
              {sale.invoiceNumber}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة الفاتورة</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/60 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Thermal Receipt Paper Container */}
        <div className="p-4 sm:p-6 max-h-[78vh] overflow-y-auto bg-slate-950/40">
          <div
            id="thermal-pos-receipt"
            className="bg-white text-slate-950 rounded-2xl p-5 shadow-inner border border-slate-200 font-sans mx-auto max-w-[340px] text-xs select-text print:max-w-full print:border-none print:shadow-none print:m-0"
            dir="rtl"
          >
            {/* Merchant Brand Header */}
            <div className="text-center pb-3 border-b-2 border-dashed border-slate-300">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-amber-400 mx-auto flex items-center justify-center font-black mb-1.5 shadow-xs">
                <Store className="w-5 h-5" />
              </div>
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                {merchant.commercialName || merchant.name}
              </h2>
              <p className="text-[10px] text-slate-600 mt-0.5">
                {merchant.commercialType || 'تجارة ألبسة وتجزئة'} - {merchant.city || 'عمان، الأردن'}
              </p>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5" dir="ltr">
                هاتف: {merchant.phone}
              </p>
            </div>

            {/* Sale Meta */}
            <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">رقم الفاتورة:</span>
                <span className="font-mono font-bold text-slate-900">{sale.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">التاريخ والوقت:</span>
                <span className="font-mono text-slate-700">{formatDate(sale.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">نوع البيع:</span>
                <span className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                  sale.type === 'IN_STORE'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {sale.type === 'IN_STORE' ? 'بيع محلي (صالة المحل)' : 'طلب أونلاين وتوصيل'}
                </span>
              </div>
              {sale.customerName && (
                <div className="flex justify-between">
                  <span className="text-slate-500">العميل:</span>
                  <span className="font-bold text-slate-900">{sale.customerName}</span>
                </div>
              )}
              {sale.customerPhone && (
                <div className="flex justify-between">
                  <span className="text-slate-500">هاتف العميل:</span>
                  <span className="font-mono text-slate-800" dir="ltr">{sale.customerPhone}</span>
                </div>
              )}
              {sale.linkedOrderSequence && (
                <div className="flex justify-between text-amber-900 bg-amber-50 p-1 rounded font-mono">
                  <span>بوليصة التوصيل:</span>
                  <span className="font-bold">{sale.linkedOrderSequence}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">الكاشير / المسؤول:</span>
                <span className="text-slate-700">{sale.cashierName}</span>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="py-3 border-b-2 border-dashed border-slate-300">
              <div className="grid grid-cols-12 text-[10px] font-black text-slate-600 pb-1.5 border-b border-slate-200 uppercase">
                <span className="col-span-6">الصنف</span>
                <span className="col-span-2 text-center">الكمية</span>
                <span className="col-span-2 text-center">السعر</span>
                <span className="col-span-2 text-left">المجموع</span>
              </div>

              <div className="divide-y divide-slate-100 mt-1 space-y-1">
                {sale.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 py-1 text-[11px] items-center">
                    <div className="col-span-6 pr-0.5">
                      <p className="font-bold text-slate-900 leading-tight">{item.name}</p>
                      {item.category && (
                        <p className="text-[9px] text-slate-400">{item.category}</p>
                      )}
                    </div>
                    <span className="col-span-2 text-center font-mono font-bold text-slate-800">
                      {item.quantity}
                    </span>
                    <span className="col-span-2 text-center font-mono text-slate-600 text-[10px]">
                      {item.price.toFixed(2)}
                    </span>
                    <span className="col-span-2 text-left font-mono font-bold text-slate-900">
                      {(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>المجموع الفرعي:</span>
                <span className="font-mono">{sale.subtotal.toFixed(2)} د.أ</span>
              </div>

              {sale.discount > 0 && (
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>خصم ترويجي:</span>
                  <span className="font-mono">- {sale.discount.toFixed(2)} د.أ</span>
                </div>
              )}

              {sale.deliveryFee && sale.deliveryFee > 0 ? (
                <div className="flex justify-between text-blue-700 font-medium">
                  <span>رسوم التوصيل ({sale.governorate || 'المحافظات'}):</span>
                  <span className="font-mono">+ {sale.deliveryFee.toFixed(2)} د.أ</span>
                </div>
              ) : null}

              <div className="flex justify-between items-center text-sm font-black text-slate-900 pt-1.5 border-t border-slate-200">
                <span>المجموع الكلي الصافي:</span>
                <span className="font-mono text-base font-black text-amber-700">
                  {formatCurrency(sale.total)}
                </span>
              </div>

              <div className="flex justify-between text-[11px] text-slate-600 pt-1">
                <span>طريقة الدفع:</span>
                <span className="font-bold text-slate-900">{getPaymentMethodLabel(sale.paymentMethod)}</span>
              </div>

              {sale.paymentMethod === 'CASH' && sale.cashReceived !== undefined && (
                <>
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span>المبلغ المستلم نقداً:</span>
                    <span className="font-mono">{sale.cashReceived.toFixed(2)} د.أ</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-bold text-emerald-700">
                    <span>المتبقي للزبون (الفكة):</span>
                    <span className="font-mono">{(sale.changeDue || 0).toFixed(2)} د.أ</span>
                  </div>
                </>
              )}
            </div>

            {/* Barcode & QR Code Display */}
            <div className="pt-3 pb-2 text-center space-y-1.5">
              <div className="flex items-center justify-center gap-1 font-mono font-black text-xs text-slate-800 tracking-widest">
                <span>*</span>
                <span>{sale.invoiceNumber}</span>
                <span>*</span>
              </div>

              {/* Barcode Lines Simulation */}
              <div className="w-48 h-8 mx-auto flex items-stretch justify-center gap-0.5 overflow-hidden py-1">
                {[3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 4, 1, 3, 2, 4, 1, 2, 3, 1, 4, 2].map((w, i) => (
                  <div
                    key={i}
                    className="bg-slate-900 h-full"
                    style={{ width: `${w * 1.5}px` }}
                  />
                ))}
              </div>

              <p className="text-[10px] text-slate-500 leading-tight pt-1">
                شكراً لتسوقكم من {merchant.commercialName || merchant.name} !
              </p>
              <p className="text-[9px] text-slate-400">
                البضاعة المباعة تستبدل خلال 3 أيام بشرط إبراز الفاتورة وبحالتها الأصلية
              </p>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="p-4 bg-slate-800/80 border-t border-slate-700 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400">
            طابعة الفواتير الحرارية المدعومة: 80mm / 58mm / A4
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              إغلاق
            </button>
            <button
              onClick={handlePrint}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-md"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة الإيصال (Ctrl+P)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

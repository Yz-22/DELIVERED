import React, { useState, useMemo } from 'react';
import {
  X,
  Printer,
  QrCode,
  Truck,
  Check,
  Copy,
  Layers,
  Settings2,
  Code2,
  Sparkles,
  ArrowLeftRight,
  Sliders,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  Package,
} from 'lucide-react';
import { Order } from '../types/logistics';
import { formatCurrency, formatDate } from '../utils/logisticsHelpers';

interface ThermalWaybillModalProps {
  order?: Order | null;
  orders?: Order[] | null;
  isOpen: boolean;
  onClose: () => void;
}

export type SizePreset = '40x60' | '60x40' | '50x30' | '80x50' | '100x150' | 'custom';

export const ThermalWaybillModal: React.FC<ThermalWaybillModalProps> = ({
  order,
  orders,
  isOpen,
  onClose,
}) => {
  // Normalize orders list: supports single order or batch of multiple orders
  const activeOrders = useMemo(() => {
    if (orders && orders.length > 0) return orders;
    if (order) return [order];
    return [];
  }, [order, orders]);

  // Default size: 40mm width * 60mm height (as requested: 40*60)
  const [selectedPreset, setSelectedPreset] = useState<SizePreset>('40x60');
  const [widthMm, setWidthMm] = useState<number>(40);
  const [heightMm, setHeightMm] = useState<number>(60);
  const [isCustomExpanded, setIsCustomExpanded] = useState<boolean>(false);
  const [isZplCopied, setIsZplCopied] = useState<boolean>(false);
  const [showZplPreview, setShowZplPreview] = useState<boolean>(false);

  // Carousel stepper for inspecting individual labels in batch mode
  const [activePreviewIndex, setActivePreviewIndex] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'all' | 'stepper'>('all');

  if (!isOpen || activeOrders.length === 0) return null;

  const isBatchMode = activeOrders.length > 1;
  const currentOrder = activeOrders[activePreviewIndex] || activeOrders[0];
  const isPortrait = heightMm > widthMm;

  // Batch summary calculations
  const totalBatchCOD = activeOrders.reduce((sum, o) => sum + (o.totalCollection || 0), 0);

  const handleSelectPreset = (preset: SizePreset) => {
    setSelectedPreset(preset);
    if (preset === '40x60') {
      setWidthMm(40);
      setHeightMm(60);
      setIsCustomExpanded(false);
    } else if (preset === '60x40') {
      setWidthMm(60);
      setHeightMm(40);
      setIsCustomExpanded(false);
    } else if (preset === '50x30') {
      setWidthMm(50);
      setHeightMm(30);
      setIsCustomExpanded(false);
    } else if (preset === '80x50') {
      setWidthMm(80);
      setHeightMm(50);
      setIsCustomExpanded(false);
    } else if (preset === '100x150') {
      setWidthMm(100);
      setHeightMm(150);
      setIsCustomExpanded(false);
    } else if (preset === 'custom') {
      setIsCustomExpanded(true);
    }
  };

  const handleSwapDimensions = () => {
    const prevW = widthMm;
    const prevH = heightMm;
    setWidthMm(prevH);
    setHeightMm(prevW);
    setSelectedPreset('custom');
    setIsCustomExpanded(true);
  };

  const handlePrint = () => {
    window.print();
  };

  // Generate Zebra Programming Language (ZPL II) code for single or entire batch
  const generateZplCode = (): string => {
    const dotsW = Math.round(widthMm * 8);
    const dotsH = Math.round(heightMm * 8);

    return activeOrders
      .map((ord) => {
        const merchantName = ord.merchant?.commercialName || ord.merchant?.name || 'DarGo Client';
        if (widthMm <= 45) {
          // 40x60 Vertical Portrait ZPL
          return `^XA
^PW${dotsW}
^LL${dotsH}
^PON
^LH0,0
^CI28
^FO10,12^A0N,22,22^FD* DarGo EXPRESS *^FS
^FO10,36^A0N,18,18^FD${ord.sequence}^FS
^FO180,36^A0N,16,16^FD${formatDate(ord.createdAt).slice(0, 10)}^FS
^FO10,56^GB${dotsW - 20},1,1^FS
^BY2,2,40^FO20,62^BCN,40,Y,N,N^FD${ord.sequence}^FS
^FO10,135^GB${dotsW - 20},42,42,B,0^FS
^FO16,143^A0N,24,24^FR^FD${ord.governorate} - ${ord.area}^FS
^FO10,185^A0N,22,22^FDCOD: ${ord.totalCollection.toFixed(2)} JOD^FS
^FO10,212^A0N,18,18^FDTo: ${ord.recipientName}^FS
^FO10,235^A0N,18,18^FDMob: ${ord.recipientPhone}^FS
^FO10,258^A0N,16,16^FDAddr: ${ord.fullAddress.slice(0, 30)}^FS
^FO10,282^GB${dotsW - 20},1,1^FS
^FO10,290^A0N,16,16^FDStore: ${merchantName.slice(0, 20)}^FS
^FO180,290^A0N,18,18^FDOTP: [${ord.deliveryOtp || '4821'}]^FS
^XZ`;
        } else {
          // Landscape / larger format
          return `^XA
^PW${dotsW}
^LL${dotsH}
^PON
^LH0,0
^CI28
^FO15,12^A0N,24,24^FD* DarGo EXPRESS *^FS
^FO${dotsW - 140},12^A0N,20,20^FD${formatDate(ord.createdAt).slice(0, 10)}^FS
^FO15,40^GB${dotsW - 30},1,1^FS
^BY2,2,48^FO35,48^BCN,48,Y,N,N^FD${ord.sequence}^FS
^FO15,135^GB${dotsW - 30},45,45,B,0^FS
^FO25,145^A0N,26,26^FR^FD${ord.governorate} - ${ord.area}^FS
^FO${dotsW - 190},145^A0N,24,24^FR^FDCOD: ${ord.totalCollection.toFixed(2)} JOD^FS
^FO15,190^A0N,20,20^FDTo: ${ord.recipientName} | ${ord.recipientPhone}^FS
^FO15,218^A0N,18,18^FDAddr: ${ord.fullAddress.slice(0, 40)}^FS
^FO15,245^A0N,18,18^FDStore: ${merchantName.slice(0, 24)}^FS
^FO${dotsW - 150},245^A0N,20,20^FDOTP: [${ord.deliveryOtp || '4821'}]^FS
^FO15,275^GB${dotsW - 30},1,1^FS
^FO15,285^A0N,16,16^FDRef: ${ord.referenceNumber || ord.id} | Track: dargo-tms.io^FS
^XZ`;
        }
      })
      .join('\n');
  };

  const handleCopyZpl = () => {
    const zpl = generateZplCode();
    navigator.clipboard.writeText(zpl);
    setIsZplCopied(true);
    setTimeout(() => setIsZplCopied(false), 2500);
  };

  // Helper component to render an individual thermal label element
  const renderSingleLabelContent = (ord: Order, index: number) => {
    if (isPortrait) {
      // Portrait layout (e.g. 40mm x 60mm)
      return (
        <div
          key={ord.id}
          style={{
            width: `${widthMm}mm`,
            height: `${heightMm}mm`,
            maxHeight: `${heightMm}mm`,
            boxSizing: 'border-box',
            padding: '2mm',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            pageBreakAfter: 'always',
            breakAfter: 'page',
          }}
          className="bg-white text-black select-none text-right flex flex-col justify-between border-2 border-black print:border-black mx-auto mb-4 print:mb-0"
          dir="rtl"
        >
          {/* Header: Brand & Sequence */}
          <div className="border-b border-black pb-1 mb-0.5">
            <div className="flex items-center justify-between">
              <span className="font-black text-[12px] tracking-tight">
                DarGo Express
              </span>
              <span className="text-[8px] font-mono font-bold text-black">
                {formatDate(ord.createdAt).slice(5, 10)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[9px] mt-0.5">
              <span className="font-bold font-mono text-[8px]">
                طرد {index + 1}/{activeOrders.length}
              </span>
              <span className="font-black font-mono text-[10px] tracking-wider">
                {ord.sequence}
              </span>
            </div>
          </div>

          {/* High Density Barcode Graphic */}
          <div className="text-center my-0.5 border-b border-black pb-1">
            <div className="h-6 w-full flex items-center justify-center gap-[1px] overflow-hidden px-1">
              {[
                2, 1, 3, 1, 2, 1, 3, 2, 1, 3, 1, 2, 3, 1, 2, 1, 3, 2, 1, 2,
                3, 1, 2, 1, 3, 2, 1, 2, 3, 1, 2, 3, 1, 2
              ].map((w, i) => (
                <div
                  key={i}
                  className="bg-black h-full"
                  style={{ width: `${w * 1}px` }}
                />
              ))}
            </div>
            <div className="font-mono font-black text-[9px] tracking-widest mt-0.5">
              *{ord.sequence}*
            </div>
          </div>

          {/* Destination Solid Block */}
          <div className="bg-black text-white p-1 rounded-xs text-center my-0.5">
            <span className="text-[7px] font-bold block leading-none opacity-90">
              المحافظة والمنطقة:
            </span>
            <span className="font-black text-[11px] leading-tight block mt-0.5">
              {ord.governorate} - {ord.area}
            </span>
          </div>

          {/* Cash Collection Box (COD) */}
          <div className="border border-black p-1 rounded-xs text-center bg-white my-0.5">
            <span className="text-[7.5px] font-bold text-black block leading-none">
              المطلوب تحصيله (COD):
            </span>
            <span className="font-mono font-black text-[12px] leading-tight text-black block mt-0.5">
              {ord.totalCollection.toFixed(2)} د.أ
            </span>
          </div>

          {/* Recipient & Phone */}
          <div className="space-y-0.5 text-[8px] leading-tight border-t border-black pt-1">
            <div className="font-bold text-black truncate">
              إلى: <strong>{ord.recipientName}</strong>
            </div>
            <div className="font-mono font-black text-[9px]">
              هاتف: {ord.recipientPhone}
            </div>
            <div className="truncate text-black font-semibold text-[7.5px]">
              العنوان: {ord.fullAddress}
            </div>

            {/* Merchant & OTP */}
            <div className="flex justify-between items-center pt-0.5 border-t border-dashed border-black mt-0.5">
              <span className="text-black font-bold truncate max-w-[85px] text-[7.5px]">
                من: {ord.merchant?.commercialName || ord.merchant?.name}
              </span>
              <span className="bg-black text-white font-mono font-black text-[8px] px-1 py-0.2 rounded-xs">
                OTP: {ord.deliveryOtp || '4821'}
              </span>
            </div>
          </div>
        </div>
      );
    }

    // Landscape layout (e.g. 60mm x 40mm or larger)
    return (
      <div
        key={ord.id}
        style={{
          width: `${widthMm}mm`,
          height: `${heightMm}mm`,
          maxHeight: `${heightMm}mm`,
          boxSizing: 'border-box',
          padding: '2.5mm',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          pageBreakAfter: 'always',
          breakAfter: 'page',
        }}
        className="bg-white text-black select-none text-right flex flex-col justify-between border-2 border-black print:border-black mx-auto mb-4 print:mb-0"
        dir="rtl"
      >
        {/* Top Header: Brand + Date + Seq */}
        <div className="border-b-2 border-black pb-1 mb-1">
          <div className="flex items-center justify-between">
            <span className="font-black text-[13px] tracking-tight">
              DarGo Express
            </span>
            <span className="text-[9px] font-mono font-bold text-black">
              {formatDate(ord.createdAt).slice(0, 10)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] mt-0.5">
            <span className="font-bold text-black font-mono">
              طرد {index + 1}/{activeOrders.length}
            </span>
            <span className="font-black font-mono text-[11px] tracking-wider text-black">
              {ord.sequence}
            </span>
          </div>
        </div>

        {/* High Density Barcode Graphic */}
        <div className="text-center my-0.5 border-b-2 border-black pb-1">
          <div className="h-7 w-full flex items-center justify-center gap-[1.5px] overflow-hidden px-1">
            {[
              3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 2, 4, 1, 2, 3, 1, 4, 2, 3, 1, 2, 4,
              1, 3, 2, 1, 4, 2, 3, 1, 2, 4, 1, 3, 2, 1, 3, 2, 4, 1, 2
            ].map((w, i) => (
              <div
                key={i}
                className="bg-black h-full"
                style={{ width: `${w * 1.3}px` }}
              />
            ))}
          </div>
          <div className="font-mono font-black text-[10px] tracking-widest mt-0.5">
            *{ord.sequence}*
          </div>
        </div>

        {/* Destination & COD Dual Banner */}
        <div className="grid grid-cols-2 gap-1 my-1">
          {/* Destination */}
          <div className="bg-black text-white p-1 rounded-xs text-center flex flex-col justify-center">
            <span className="text-[7.5px] font-bold block leading-none opacity-90">
              الوجهة:
            </span>
            <span className="font-black text-[12px] leading-tight mt-0.5">
              {ord.governorate} - {ord.area}
            </span>
          </div>

          {/* Cash Collection (COD) */}
          <div className="border-2 border-black p-1 rounded-xs text-center bg-white flex flex-col justify-center">
            <span className="text-[7.5px] font-bold text-black block leading-none">
              التحصيل (COD):
            </span>
            <span className="font-mono font-black text-[13px] leading-tight text-black mt-0.5">
              {ord.totalCollection.toFixed(2)} د.أ
            </span>
          </div>
        </div>

        {/* Recipient & OTP & Merchant Info */}
        <div className="space-y-0.5 text-[8.5px] leading-tight border-t border-black pt-1">
          <div className="flex justify-between items-center">
            <span className="font-bold text-black truncate max-w-[140px]">
              المستلم: <strong>{ord.recipientName}</strong>
            </span>
            <span className="font-mono font-black text-[9.5px]">
              {ord.recipientPhone}
            </span>
          </div>

          <div className="truncate text-black font-semibold text-[8px]">
            العنوان: {ord.fullAddress}
          </div>

          <div className="flex justify-between items-center pt-0.5 border-t border-dashed border-black">
            <span className="text-black font-bold truncate max-w-[120px]">
              المرسل: {ord.merchant?.commercialName || ord.merchant?.name}
            </span>
            <span className="bg-black text-white font-mono font-bold text-[8.5px] px-1 py-0.2 rounded-xs">
              OTP: {ord.deliveryOtp || '4821'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      {/* Dynamic Print Sizing Stylesheet for Exact Printer Page Breaks */}
      <style>{`
        @media print {
          @page {
            size: ${widthMm}mm ${heightMm}mm;
            margin: 0 !important;
          }
          #thermal-print-wrapper {
            width: ${widthMm}mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .thermal-label-page {
            page-break-after: always !important;
            break-after: page !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 flex flex-col max-h-[95vh]">
        {/* Modal Top Bar */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between no-print border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm block">
                  {isBatchMode ? 'طباعة حزمة بوالص حرارية (طباعة جماعية)' : 'طباعة بوليصة الشحن الحرارية'}
                </span>
                <span className="text-[10px] bg-amber-500 text-slate-950 font-extrabold px-1.5 py-0.2 rounded font-mono">
                  {widthMm}×{heightMm} مم
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                {isBatchMode ? (
                  <>
                    <span>
                      إجمالي الشحنات: <strong className="text-amber-400 font-bold">{activeOrders.length} بوليصة</strong>
                    </span>
                    <span>•</span>
                    <span>
                      مجموع التحصيل: <strong className="text-emerald-400 font-mono font-bold">{formatCurrency(totalBatchCOD)}</strong>
                    </span>
                  </>
                ) : (
                  <span>
                    الشحنة: <strong className="font-mono text-amber-400">{currentOrder.sequence}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preset & Sizing Toolbar */}
        <div className="bg-slate-100/95 border-b border-slate-200 px-4 py-2.5 space-y-2 no-print">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Settings2 className="w-3.5 h-3.5 text-slate-500" />
                القياس:
              </span>
              <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 shadow-2xs">
                {/* 40x60 (Default Portrait) */}
                <button
                  type="button"
                  onClick={() => handleSelectPreset('40x60')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${
                    selectedPreset === '40x60'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>40 × 60 مم</span>
                  <span className="text-[9px] bg-slate-900 text-amber-300 px-1 py-0.1 rounded font-mono">
                    شائع
                  </span>
                </button>

                {/* 60x40 */}
                <button
                  type="button"
                  onClick={() => handleSelectPreset('60x40')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                    selectedPreset === '60x40'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  60 × 40 مم
                </button>

                {/* 100x150 */}
                <button
                  type="button"
                  onClick={() => handleSelectPreset('100x150')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all hidden sm:block ${
                    selectedPreset === '100x150'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  100 × 150 مم
                </button>

                {/* Custom Sizing */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPreset('custom');
                    setIsCustomExpanded(!isCustomExpanded);
                  }}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${
                    selectedPreset === 'custom' || isCustomExpanded
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <Sliders className="w-3 h-3" />
                  <span>تحديد يدوي</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSwapDimensions}
                className="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg flex items-center gap-1 transition-colors"
                title="تبديل العرض والارتفاع (Swap W/H)"
              >
                <ArrowLeftRight className="w-3 h-3 text-slate-500" />
                <span>قلب الأبعاد</span>
              </button>

              <button
                type="button"
                onClick={() => setShowZplPreview(!showZplPreview)}
                className="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg flex items-center gap-1 transition-colors"
                title="عرض وتصدير أوامر طابعات Zebra المباشرة"
              >
                <Code2 className="w-3 h-3 text-slate-500" />
                <span>{showZplPreview ? 'إخفاء ZPL' : 'كود ZPL'}</span>
              </button>
            </div>
          </div>

          {/* Manual / Custom Dimension Inputs Drawer */}
          {(isCustomExpanded || selectedPreset === 'custom') && (
            <div className="bg-white border border-indigo-200 rounded-xl p-3 shadow-xs space-y-2 animate-in slide-in-from-top-1 duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                  تخصيص أبعاد الورق الحراري يدوياً (بالمليمتر mm):
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {widthMm} مم × {heightMm} مم ({isPortrait ? 'عمودي Portrait' : 'أفقي Landscape'})
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-center">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    العرض (Width مم):
                  </label>
                  <input
                    type="number"
                    min="25"
                    max="220"
                    step="1"
                    value={widthMm}
                    onChange={(e) => {
                      const val = Math.max(20, Math.min(250, Number(e.target.value) || 40));
                      setWidthMm(val);
                      setSelectedPreset('custom');
                    }}
                    className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-center text-slate-900 focus:bg-white focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    الارتفاع (Height مم):
                  </label>
                  <input
                    type="number"
                    min="20"
                    max="350"
                    step="1"
                    value={heightMm}
                    onChange={(e) => {
                      const val = Math.max(20, Math.min(350, Number(e.target.value) || 60));
                      setHeightMm(val);
                      setSelectedPreset('custom');
                    }}
                    className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-center text-slate-900 focus:bg-white focus:border-indigo-500"
                  />
                </div>

                <div className="sm:col-span-2 flex flex-wrap items-center gap-1.5 pt-4">
                  <span className="text-[10px] text-slate-500 font-semibold">قياسات سريعة:</span>
                  {[
                    { label: '40×60', w: 40, h: 60 },
                    { label: '60×40', w: 60, h: 40 },
                    { label: '50×30', w: 50, h: 30 },
                    { label: '80×50', w: 80, h: 50 },
                    { label: '100×150', w: 100, h: 150 },
                  ].map((sz) => (
                    <button
                      key={sz.label}
                      type="button"
                      onClick={() => {
                        setWidthMm(sz.w);
                        setHeightMm(sz.h);
                        setSelectedPreset(sz.label === '40x60' ? '40x60' : sz.label === '60x40' ? '60x40' : 'custom');
                      }}
                      className="px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded border border-slate-300 transition-colors"
                    >
                      {sz.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Batch Mode Navigation Switcher (When multiple orders) */}
          {isBatchMode && (
            <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-bold text-slate-900">
                  معاينة الحزمة:
                </span>
                <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setViewMode('all')}
                    className={`px-2 py-0.5 rounded ${viewMode === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
                  >
                    عرض الرول المتتابع ({activeOrders.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('stepper')}
                    className={`px-2 py-0.5 rounded ${viewMode === 'stepper' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
                  >
                    تصفح فردي
                  </button>
                </div>
              </div>

              {viewMode === 'stepper' && (
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    disabled={activePreviewIndex === 0}
                    onClick={() => setActivePreviewIndex(Math.max(0, activePreviewIndex - 1))}
                    className="p-1 rounded bg-white border border-slate-300 disabled:opacity-40 hover:bg-slate-50"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono font-bold text-slate-800">
                    {activePreviewIndex + 1} / {activeOrders.length}
                  </span>
                  <button
                    type="button"
                    disabled={activePreviewIndex >= activeOrders.length - 1}
                    onClick={() => setActivePreviewIndex(Math.min(activeOrders.length - 1, activePreviewIndex + 1))}
                    className="p-1 rounded bg-white border border-slate-300 disabled:opacity-40 hover:bg-slate-50"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ZPL Raw Code Drawer (If opened) */}
        {showZplPreview && (
          <div className="bg-slate-950 text-slate-200 p-3.5 border-b border-slate-800 text-xs font-mono space-y-2 no-print animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                أوامر Zebra ZPL ({activeOrders.length} ملصق - {widthMm}×{heightMm}mm / 203 DPI):
              </span>
              <button
                type="button"
                onClick={handleCopyZpl}
                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded flex items-center gap-1 transition-colors"
              >
                {isZplCopied ? <Check className="w-3 h-3 text-slate-950" /> : <Copy className="w-3 h-3" />}
                <span>{isZplCopied ? 'تم النسخ!' : `نسخ كود ZPL (${activeOrders.length})`}</span>
              </button>
            </div>
            <pre className="bg-slate-900 p-2.5 rounded border border-slate-800 text-[10px] leading-tight overflow-x-auto max-h-32 text-emerald-400 select-all">
              {generateZplCode()}
            </pre>
            <p className="text-[10px] text-slate-500">
              يمكن إرسال حزمة ZPL المباشرة عبر منفذ الشبكة (Raw Port 9100) أو USB لطابعات Zebra و Xprinter لطباعة كل البوالص متتالية دفعة واحدة بدون أي نوافذ متصفح.
            </p>
          </div>
        )}

        {/* Scrollable Live Preview Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200/70 flex flex-col items-center justify-start min-h-[340px]">
          {/* Printable Thermal Container */}
          <div id="thermal-print-wrapper" className="w-full flex flex-col items-center">
            {viewMode === 'stepper' && !window.matchMedia('print').matches ? (
              // Single stepper view
              <div className="thermal-label-page">
                {renderSingleLabelContent(currentOrder, activePreviewIndex)}
              </div>
            ) : (
              // All labels sequence (Default & Print View)
              activeOrders.map((ord, idx) => (
                <div key={ord.id} className="thermal-label-page">
                  {renderSingleLabelContent(ord, idx)}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="text-xs text-slate-600 font-medium">
            {isBatchMode ? (
              <span>
                طباعة حزمة: <strong className="text-slate-900">{activeOrders.length} بوليصة</strong> قياس <strong className="text-slate-900">{widthMm}×{heightMm} مم</strong>
              </span>
            ) : (
              <span>
                القياس الحالي: <strong className="text-slate-900">{widthMm} × {heightMm} مم</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyZpl}
              className="px-3 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              {isZplCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{isZplCopied ? 'تم النسخ' : 'نسخ ZPL'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
            >
              إغلاق
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2 text-xs sm:text-sm font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg shadow-sm flex items-center gap-2 transition-colors"
            >
              <Printer className="w-4 h-4 text-slate-950" />
              <span>
                {isBatchMode
                  ? `طباعة البوالص دفعة واحدة (${activeOrders.length} ملصق)`
                  : `طباعة الملصق (${widthMm}×${heightMm})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

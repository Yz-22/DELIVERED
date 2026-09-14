import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Printer,
  Truck,
  CheckCircle2,
  Clock,
  RotateCcw,
  Calendar,
  DollarSign,
  User,
  Phone,
  MapPin,
  Trash2,
  ExternalLink,
  ChevronDown,
  X,
  CreditCard,
  ShoppingBag,
  Package,
  Layers,
  Check,
  Scan,
  Barcode,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { MerchantInvoice, MerchantInvoiceItem, MerchantProduct } from '../types/accounting';
import { User as UserType, Order } from '../types/logistics';
import { GOVERNORATES, JORDAN_AREAS_MAP, STANDARD_DELIVERY_FEES, formatCurrency } from '../utils/logisticsHelpers';

interface MerchantInvoicesProps {
  currentMerchant: UserType;
  onOpenWaybill?: (order: Order) => void;
  onRefreshOrders?: () => void;
}

export const MerchantInvoices: React.FC<MerchantInvoicesProps> = ({
  currentMerchant,
  onOpenWaybill,
  onRefreshOrders,
}) => {
  const [invoices, setInvoices] = useState<MerchantInvoice[]>([]);
  const [warehouseProducts, setWarehouseProducts] = useState<MerchantProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'SALES' | 'PURCHASE' | 'RETURN'>('ALL');

  // New Invoice Modal
  const [isNewInvoiceOpen, setIsNewInvoiceOpen] = useState(false);
  const [invoiceType, setInvoiceType] = useState<'SALES' | 'PURCHASE' | 'RETURN'>('SALES');
  const [partyName, setPartyName] = useState('');
  const [partyPhone, setPartyPhone] = useState('');
  const [partyAddress, setPartyAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CLIQ' | 'CARD' | 'CREDIT' | 'COD'>('CASH');
  const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'PARTIAL' | 'UNPAID'>('PAID');
  const [notes, setNotes] = useState('');

  // Items in the new invoice
  const [invoiceItems, setInvoiceItems] = useState<
    {
      productId: string;
      productName: string;
      barcode: string;
      quantity: number;
      unitPrice: number;
      costPrice: number;
      total: number;
    }[]
  >([]);

  // Item selector helpers
  const [selectedProductIdToAdd, setSelectedProductIdToAdd] = useState('');
  const [addItemQty, setAddItemQty] = useState(1);
  const [addItemPrice, setAddItemPrice] = useState('');

  // Barcode quick lookup & Missing Item Creation
  const [invoiceBarcodeScan, setInvoiceBarcodeScan] = useState('');
  const [missingBarcodeFound, setMissingBarcodeFound] = useState<string | null>(null);
  const [isQuickCreateItemOpen, setIsQuickCreateItemOpen] = useState(false);
  const [savedCategories, setSavedCategories] = useState<string[]>([
    'ألبسة نسائية',
    'عبايات وجلابيات',
    'ألبسة رجالية',
    'ألبسة أطفال',
    'حقائب وأحذية',
    'إكسسوارات',
    'شالات وإيشاربات',
    'عطور وتجميل',
    'ساعات ومجوهرات',
    'إلكترونيات وهواتف',
    'أدوات منزلية',
    'عام',
  ]);
  const [quickNewProductForm, setQuickNewProductForm] = useState({
    name: '',
    barcode: '',
    category: 'ألبسة نسائية',
    costPrice: '',
    sellingPrice: '',
    stockQuantity: '10',
  });

  // Shipping Order integration with DarGo
  const [createDeliveryOrder, setCreateDeliveryOrder] = useState(false);
  const [deliveryGovernorate, setDeliveryGovernorate] = useState('عمان');
  const [deliveryArea, setDeliveryArea] = useState('خلدا');
  const [deliveryFullAddress, setDeliveryFullAddress] = useState('');

  // Discounts & Additional fees
  const [discountAmount, setDiscountAmount] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);

  // View / Print Invoice Modal
  const [viewingInvoice, setViewingInvoice] = useState<MerchantInvoice | null>(null);

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch Invoices and Warehouse Products
  const fetchData = async () => {
    if (!currentMerchant?.id) return;
    setIsLoading(true);
    try {
      const [invRes, whRes, catRes] = await Promise.all([
        fetch(`/api/merchants/${currentMerchant.id}/invoices`),
        fetch(`/api/merchants/${currentMerchant.id}/warehouse`),
        fetch(`/api/merchants/${currentMerchant.id}/categories`),
      ]);

      if (invRes.ok) {
        const invData = await invRes.json();
        setInvoices(invData.invoices || []);
      }
      if (whRes.ok) {
        const whData = await whRes.json();
        setWarehouseProducts(whData.products || []);
      }
      if (catRes.ok) {
        const catData = await catRes.json();
        if (Array.isArray(catData.categories) && catData.categories.length > 0) {
          setSavedCategories(catData.categories);
        }
      }
    } catch (err) {
      console.error('Failed to load invoices data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentMerchant?.id]);

  // Delivery fee calculation
  const deliveryFee = createDeliveryOrder ? STANDARD_DELIVERY_FEES[deliveryGovernorate] || 2.5 : 0;

  // Invoice calculations
  const itemsSubtotal = invoiceItems.reduce((sum, it) => sum + it.total, 0);
  const grandTotal = Math.max(0, itemsSubtotal - discountAmount + taxAmount + deliveryFee);

  // Add Item to Invoice Table
  const handleAddItemToInvoice = () => {
    if (!selectedProductIdToAdd) {
      showToast('يرجى اختيار صنف من القائمة', 'error');
      return;
    }

    const prod = warehouseProducts.find((p) => p.id === selectedProductIdToAdd);
    if (!prod) return;

    const unitPrice =
      invoiceType === 'PURCHASE'
        ? parseFloat(addItemPrice) || prod.costPrice
        : parseFloat(addItemPrice) || prod.sellingPrice;

    const qty = Math.max(1, addItemQty);
    const total = qty * unitPrice;

    setInvoiceItems((prev) => [
      ...prev,
      {
        productId: prod.id,
        productName: prod.name,
        barcode: prod.barcode,
        quantity: qty,
        unitPrice,
        costPrice: prod.costPrice,
        total,
      },
    ]);

    setSelectedProductIdToAdd('');
    setAddItemQty(1);
    setAddItemPrice('');
    setInvoiceBarcodeScan('');
  };

  // Handle barcode quick scan in invoice
  const handleBarcodeScanLookup = (codeToSearch: string) => {
    const code = codeToSearch.trim();
    if (!code) return;

    const matched = warehouseProducts.find(
      (p) => p.barcode === code || p.sku.toLowerCase() === code.toLowerCase()
    );

    if (matched) {
      setSelectedProductIdToAdd(matched.id);
      setAddItemPrice((invoiceType === 'PURCHASE' ? matched.costPrice : matched.sellingPrice).toString());
      setMissingBarcodeFound(null);
      showToast(`تم التعرف على الصنف: ${matched.name}`);
    } else {
      setMissingBarcodeFound(code);
      setQuickNewProductForm({
        name: '',
        barcode: code,
        category: 'عام',
        costPrice: '10',
        sellingPrice: '18',
        stockQuantity: '10',
      });
      showToast('الصنف غير مسجل بالمخزن، يمكنك إضافته فوراً', 'error');
    }
  };

  // Quick Create product directly from invoice modal and add it to invoice
  const handleQuickCreateAndAddToInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickNewProductForm.name.trim()) return;

    try {
      const res = await fetch(`/api/merchants/${currentMerchant.id}/warehouse/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: quickNewProductForm.name.trim(),
          sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
          barcode: quickNewProductForm.barcode.trim(),
          category: quickNewProductForm.category.trim() || 'عام',
          costPrice: parseFloat(quickNewProductForm.costPrice) || 0,
          sellingPrice: parseFloat(quickNewProductForm.sellingPrice) || 0,
          stockQuantity: parseInt(quickNewProductForm.stockQuantity, 10) || 0,
          minStockAlert: 3,
          unit: 'قطعة',
          locationRack: 'الرئيسي',
          notes: 'صنف مضاف سريعاً من شاشة الفواتير',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const createdProduct: MerchantProduct = data.product;

        // Update local warehouse products list
        setWarehouseProducts((prev) => [createdProduct, ...prev]);

        // Automatically add to invoice items!
        const unitPrice =
          invoiceType === 'PURCHASE'
            ? createdProduct.costPrice
            : createdProduct.sellingPrice;
        const qty = Math.max(1, addItemQty);
        const total = qty * unitPrice;

        setInvoiceItems((prev) => [
          ...prev,
          {
            productId: createdProduct.id,
            productName: createdProduct.name,
            barcode: createdProduct.barcode,
            quantity: qty,
            unitPrice,
            costPrice: createdProduct.costPrice,
            total,
          },
        ]);

        setIsQuickCreateItemOpen(false);
        setMissingBarcodeFound(null);
        setInvoiceBarcodeScan('');
        showToast(`تم إنشاء الصنف (${createdProduct.name}) وإضافته للفاتورة والمخزن بنجاح!`);
      } else {
        showToast('فشل إنشاء الصنف الجديد', 'error');
      }
    } catch (err) {
      showToast('خطأ في الاتصال بالخادم', 'error');
    }
  };

  const handleRemoveItem = (index: number) => {
    setInvoiceItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Submit Invoice
  const handleSubmitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (invoiceItems.length === 0) {
      showToast('يرجى إدراج صنف واحد على الأقل في الفاتورة', 'error');
      return;
    }

    if (!partyName.trim()) {
      showToast('يرجى كتابة اسم العميل / المورد', 'error');
      return;
    }

    if (createDeliveryOrder && (!partyPhone.trim() || !deliveryFullAddress.trim())) {
      showToast('لإنشاء شحنة دارجو يرجى إدخال رقم الهاتف والعنوان بالتفصيل', 'error');
      return;
    }

    const payload = {
      merchantId: currentMerchant.id,
      type: invoiceType,
      partyName: partyName.trim(),
      partyPhone: partyPhone.trim(),
      partyAddress: partyAddress.trim(),
      items: invoiceItems,
      subtotal: itemsSubtotal,
      discountAmount,
      taxAmount,
      deliveryFee,
      grandTotal,
      paymentMethod,
      paymentStatus,
      notes,
      createDeliveryOrder,
      deliveryGovernorate,
      deliveryArea,
      deliveryFullAddress: deliveryFullAddress.trim() || partyAddress.trim(),
    };

    try {
      const res = await fetch(`/api/merchants/${currentMerchant.id}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        showToast(`تم حفظ الفاتورة بنجاح برقم (${data.invoice.invoiceNumber})`);
        setIsNewInvoiceOpen(false);
        // Reset form
        setInvoiceItems([]);
        setPartyName('');
        setPartyPhone('');
        setPartyAddress('');
        setNotes('');
        setCreateDeliveryOrder(false);
        fetchData();
        onRefreshOrders?.();

        if (data.order && onOpenWaybill) {
          onOpenWaybill(data.order);
        }
      } else {
        showToast('فشل في حفظ الفاتورة', 'error');
      }
    } catch (err) {
      showToast('خطأ في الاتصال بالخادم', 'error');
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.partyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.shippingTrackingNumber && inv.shippingTrackingNumber.includes(searchQuery));
    const matchesType = typeFilter === 'ALL' || inv.type === typeFilter;
    return matchesSearch && matchesType;
  });

  // Calculate high-level metrics
  const totalSalesInvoices = invoices.filter((i) => i.type === 'SALES');
  const totalSalesVolume = totalSalesInvoices.reduce((sum, i) => sum + i.grandTotal, 0);

  const totalPurchasesInvoices = invoices.filter((i) => i.type === 'PURCHASE');
  const totalPurchasesVolume = totalPurchasesInvoices.reduce((sum, i) => sum + i.grandTotal, 0);

  const totalReturnsInvoices = invoices.filter((i) => i.type === 'RETURN');
  const totalReturnsVolume = totalReturnsInvoices.reduce((sum, i) => sum + i.grandTotal, 0);

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

      {/* Invoice Overview Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>إجمالي فواتير المبيعات</span>
            <FileText className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-2">
            {formatCurrency(totalSalesVolume)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {totalSalesInvoices.length} فاتورة مبيعات مسجلة
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>إجمالي فواتير المشتريات والتوريد</span>
            <Package className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-600 mt-2">
            {formatCurrency(totalPurchasesVolume)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {totalPurchasesInvoices.length} فاتورة توريد بضاعة للمخزن
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>المرتجعات</span>
            <RotateCcw className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-purple-600 mt-2">
            {formatCurrency(totalReturnsVolume)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {totalReturnsInvoices.length} فاتورة إرجاع بضاعة
          </div>
        </div>
      </div>

      {/* Action and Filter Header */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setTypeFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              typeFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            جميع الفواتير ({invoices.length})
          </button>
          <button
            onClick={() => setTypeFilter('SALES')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              typeFilter === 'SALES'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            المبيعات ({totalSalesInvoices.length})
          </button>
          <button
            onClick={() => setTypeFilter('PURCHASE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              typeFilter === 'PURCHASE'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            المشتريات والتوريد ({totalPurchasesInvoices.length})
          </button>
          <button
            onClick={() => setTypeFilter('RETURN')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              typeFilter === 'RETURN'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            }`}
          >
            المرتجعات ({totalReturnsInvoices.length})
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={() => {
              setInvoiceType('SALES');
              setIsNewInvoiceOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إدخال فاتورة جديدة</span>
          </button>
        </div>
      </div>

      {/* Invoices List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="بحث برقم الفاتورة، اسم العميل/المورد، أو رقم الشحنة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-9 pl-4 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-100/75 border-b border-slate-200 text-[11px] font-black text-slate-600">
                <th className="p-3">رقم الفاتورة</th>
                <th className="p-3">النوع</th>
                <th className="p-3">التاريخ</th>
                <th className="p-3">العميل / المورد</th>
                <th className="p-3 text-center">عدد المواد</th>
                <th className="p-3">طريقة الدفع</th>
                <th className="p-3">حالة الدفع</th>
                <th className="p-3">شحنة دارجو</th>
                <th className="p-3 text-left">إجمالي الفاتورة</th>
                <th className="p-3 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400">
                    لا توجد فواتير مسجلة مطابقة للبحث
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-amber-50/20 transition-colors">
                    <td className="p-3 font-mono font-bold text-slate-900">
                      {inv.invoiceNumber}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          inv.type === 'SALES'
                            ? 'bg-emerald-100 text-emerald-800'
                            : inv.type === 'PURCHASE'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {inv.type === 'SALES'
                          ? 'فاتورة مبيعات'
                          : inv.type === 'PURCHASE'
                          ? 'فاتورة مشتريات'
                          : 'فاتورة مرتجع'}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500 font-mono text-[11px]">{inv.date}</td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{inv.partyName}</div>
                      {inv.partyPhone && (
                        <div className="text-[10px] text-slate-400 font-mono">{inv.partyPhone}</div>
                      )}
                    </td>
                    <td className="p-3 text-center font-bold text-slate-700">
                      {inv.items.length} صنف ({inv.items.reduce((s, it) => s + it.quantity, 0)} قطعة)
                    </td>
                    <td className="p-3 font-medium text-slate-600">
                      {inv.paymentMethod === 'CASH'
                        ? 'نقداً'
                        : inv.paymentMethod === 'CLIQ'
                        ? 'CliQ فوري'
                        : inv.paymentMethod === 'CARD'
                        ? 'بطاقة / فيزا'
                        : inv.paymentMethod === 'COD'
                        ? 'دفع عند الاستلام'
                        : 'آجل'}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          inv.paymentStatus === 'PAID'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : inv.paymentStatus === 'PARTIAL'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {inv.paymentStatus === 'PAID'
                          ? 'مدفوعة بالكامل'
                          : inv.paymentStatus === 'PARTIAL'
                          ? 'دفعة جزئية'
                          : 'غير مدفوعة (ذمة)'}
                      </span>
                    </td>
                    <td className="p-3">
                      {inv.shippingTrackingNumber ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          <Truck className="w-3 h-3 text-amber-600" />
                          <span>{inv.shippingTrackingNumber}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">استلام محل / غير مشحون</span>
                      )}
                    </td>
                    <td className="p-3 text-left font-black text-slate-900">
                      {formatCurrency(inv.grandTotal)}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => setViewingInvoice(inv)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer"
                        title="عرض وطباعة الفاتورة"
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

      {/* Modal: Create New Invoice */}
      {isNewInvoiceOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-black">إدخال فاتورة جديدة وإدارة المخزن</h3>
              </div>
              <button
                onClick={() => setIsNewInvoiceOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitInvoice} className="p-5 overflow-y-auto space-y-4">
              {/* Type Selection */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setInvoiceType('SALES')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    invoiceType === 'SALES'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  فاتورة مبيعات (Sales)
                </button>
                <button
                  type="button"
                  onClick={() => setInvoiceType('PURCHASE')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    invoiceType === 'PURCHASE'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  فاتورة مشتريات وتوريد للمخزن
                </button>
                <button
                  type="button"
                  onClick={() => setInvoiceType('RETURN')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    invoiceType === 'RETURN'
                      ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  فاتورة مرتجع (Return)
                </button>
              </div>

              {/* Customer / Supplier Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {invoiceType === 'PURCHASE' ? 'اسم المورد / الشركة *' : 'اسم العميل / الزبون *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={invoiceType === 'PURCHASE' ? 'شركة الاستيراد والتوريد' : 'أحمد العبادي'}
                    value={partyName}
                    onChange={(e) => setPartyName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف</label>
                  <input
                    type="tel"
                    placeholder="0790000000"
                    value={partyPhone}
                    onChange={(e) => setPartyPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">طريقة الدفع</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="CASH">كاش نقد</option>
                    <option value="CLIQ">تحويل CliQ</option>
                    <option value="CARD">بطاقة / فيزا</option>
                    <option value="COD">دفع عند الاستلام COD</option>
                    <option value="CREDIT">آجل (ذمة)</option>
                  </select>
                </div>
              </div>

              {/* Add Items to Invoice Table */}
              <div className="border border-slate-200 rounded-2xl p-3 bg-white space-y-3">
                <div className="font-bold text-xs text-slate-800 flex items-center justify-between">
                  <span>أصناف الفاتورة:</span>
                  <span className="text-slate-400 text-[11px]">
                    (تحديث آلي للمخزون فور حفظ الفاتورة)
                  </span>
                </div>

                {/* Item Selector Form */}
                <div className="space-y-2 bg-amber-50/40 p-2.5 rounded-xl border border-amber-200/50">
                  {/* Barcode Quick Scan / Search Row */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Barcode className="w-4 h-4 absolute right-2.5 top-2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="مسح أو كتابة الباركود / SKU للإدراج السريع..."
                        value={invoiceBarcodeScan}
                        onChange={(e) => setInvoiceBarcodeScan(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleBarcodeScanLookup(invoiceBarcodeScan);
                          }
                        }}
                        className="w-full pr-8 pl-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleBarcodeScanLookup(invoiceBarcodeScan)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Scan className="w-3.5 h-3.5" />
                      <span>مسح / بحث</span>
                    </button>
                  </div>

                  {/* Missing Barcode Notification & One-Click Create */}
                  {missingBarcodeFound && (
                    <div className="bg-amber-100/90 border border-amber-300 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs animate-in fade-in">
                      <div className="flex items-center gap-2 text-amber-950 font-bold">
                        <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                        <span>الصنف بالباركود ({missingBarcodeFound}) غير موجود في مستودعك!</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsQuickCreateItemOpen(true)}
                        className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg font-black text-xs shadow-xs flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>إضافة الصنف للمخزن والفاتورة فوراً</span>
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1 border-t border-amber-200/40">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">
                        أو اختر الصنف يدوياً من المستودع
                      </label>
                      <select
                        value={selectedProductIdToAdd}
                        onChange={(e) => {
                          setSelectedProductIdToAdd(e.target.value);
                          const p = warehouseProducts.find((item) => item.id === e.target.value);
                          if (p) {
                            setAddItemPrice(
                              (invoiceType === 'PURCHASE' ? p.costPrice : p.sellingPrice).toString()
                            );
                          }
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none"
                      >
                        <option value="">-- اختر صنفاً من المخزن --</option>
                        {warehouseProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (رصيد المخزن: {p.stockQuantity} {p.unit})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">الكمية</label>
                      <input
                        type="number"
                        min="1"
                        value={addItemQty}
                        onChange={(e) => setAddItemQty(parseInt(e.target.value, 10) || 1)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold focus:outline-none"
                      />
                    </div>

                    <div className="flex items-end gap-1">
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">
                          السعر الفردي (د.أ)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="0.00"
                          value={addItemPrice}
                          onChange={(e) => setAddItemPrice(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddItemToInvoice}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs h-8 cursor-pointer"
                      >
                        إضافة
                      </button>
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-500 font-bold text-[11px]">
                        <th className="py-2">الصنف</th>
                        <th className="py-2">الباركود</th>
                        <th className="py-2 text-center">الكمية</th>
                        <th className="py-2">السعر الفردي</th>
                        <th className="py-2">الإجمالي</th>
                        <th className="py-2 text-center">حذف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoiceItems.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-slate-400 text-xs">
                            لم تقم بإضافة أي أصناف للفاتورة بعد
                          </td>
                        </tr>
                      ) : (
                        invoiceItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 font-bold text-slate-900">{item.productName}</td>
                            <td className="py-2 font-mono text-slate-500 text-[11px]">
                              {item.barcode}
                            </td>
                            <td className="py-2 text-center font-bold text-slate-800">
                              {item.quantity}
                            </td>
                            <td className="py-2 text-slate-700">{formatCurrency(item.unitPrice)}</td>
                            <td className="py-2 font-black text-slate-900">
                              {formatCurrency(item.total)}
                            </td>
                            <td className="py-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="p-1 rounded text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Shipping Delivery Option (DarGo Integration) */}
              {invoiceType === 'SALES' && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createDeliveryOrder}
                        onChange={(e) => setCreateDeliveryOrder(e.target.checked)}
                        className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-xs font-black text-slate-900">
                        إنشاء شحنة وبوليصة شحن وتوصيل فوري عبر دارجو DarGo
                      </span>
                    </label>
                    <Truck className="w-4 h-4 text-amber-600" />
                  </div>

                  {createDeliveryOrder && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-amber-200/50 animate-in fade-in">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-1">
                          المحافظة
                        </label>
                        <select
                          value={deliveryGovernorate}
                          onChange={(e) => {
                            setDeliveryGovernorate(e.target.value);
                            const areas = JORDAN_AREAS_MAP[e.target.value] || [];
                            if (areas.length > 0) setDeliveryArea(areas[0]);
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold"
                        >
                          {GOVERNORATES.map((gov) => (
                            <option key={gov} value={gov}>
                              {gov} ({STANDARD_DELIVERY_FEES[gov] || 3} د.أ)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-1">
                          المنطقة / الحي
                        </label>
                        <select
                          value={deliveryArea}
                          onChange={(e) => setDeliveryArea(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold"
                        >
                          {(JORDAN_AREAS_MAP[deliveryGovernorate] || ['المركز']).map((ar) => (
                            <option key={ar} value={ar}>
                              {ar}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-1">
                          العنوان التفصيلي للتسليم *
                        </label>
                        <input
                          type="text"
                          required={createDeliveryOrder}
                          placeholder="الشارع، البناية، رقم الشقة..."
                          value={deliveryFullAddress}
                          onChange={(e) => setDeliveryFullAddress(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Total Summary */}
              <div className="bg-slate-100 rounded-2xl p-3.5 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>مجموع المواد:</span>
                  <span className="font-bold">{formatCurrency(itemsSubtotal)}</span>
                </div>
                {deliveryFee > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>أجور التوصيل والشحن (دارجو):</span>
                    <span className="font-bold">{formatCurrency(deliveryFee)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                  <span>صافي إجمالي الفاتورة:</span>
                  <span className="text-emerald-700 text-base">{formatCurrency(grandTotal)}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewInvoiceOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md cursor-pointer"
                >
                  اعتماد وحفظ الفاتورة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View & Print Invoice */}
      {viewingInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-black">فاتورة رقم: {viewingInvoice.invoiceNumber}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-all cursor-pointer"
                >
                  طباعة
                </button>
                <button
                  onClick={() => setViewingInvoice(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 text-slate-800 text-xs">
              <div className="text-center pb-3 border-b border-slate-200">
                <div className="font-black text-lg text-slate-900">
                  {currentMerchant.storeName || currentMerchant.name}
                </div>
                <div className="text-slate-500 text-[11px] mt-0.5">
                  هاتف: {currentMerchant.phone} | عمان - الأردن
                </div>
                <div className="font-mono text-slate-400 text-[10px] mt-1">
                  رقم الفاتورة: {viewingInvoice.invoiceNumber} | التاريخ: {viewingInvoice.date}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl">
                <div>
                  <span className="text-slate-400">العميل / الطرف الآخر: </span>
                  <span className="font-bold text-slate-800">{viewingInvoice.partyName}</span>
                </div>
                <div>
                  <span className="text-slate-400">الهاتف: </span>
                  <span className="font-mono text-slate-800">{viewingInvoice.partyPhone || '---'}</span>
                </div>
                <div>
                  <span className="text-slate-400">نوع الفاتورة: </span>
                  <span className="font-bold text-slate-800">
                    {viewingInvoice.type === 'SALES' ? 'مبيعات' : 'مشتريات وتوريد'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">طريقة الدفع: </span>
                  <span className="font-bold text-slate-800">{viewingInvoice.paymentMethod}</span>
                </div>
              </div>

              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600 font-bold">
                    <th className="py-1.5">الصنف</th>
                    <th className="py-1.5 text-center">الكمية</th>
                    <th className="py-1.5">السعر</th>
                    <th className="py-1.5 text-left">المجموع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewingInvoice.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-1.5 font-bold">{it.productName}</td>
                      <td className="py-1.5 text-center">{it.quantity}</td>
                      <td className="py-1.5">{formatCurrency(it.unitPrice)}</td>
                      <td className="py-1.5 text-left font-black">{formatCurrency(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="pt-3 border-t border-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span>المجموع الفرعي:</span>
                  <span className="font-bold">{formatCurrency(viewingInvoice.subtotal)}</span>
                </div>
                {viewingInvoice.deliveryFee > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>أجور الشحن (دارجو):</span>
                    <span>{formatCurrency(viewingInvoice.deliveryFee)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-sm text-slate-900 pt-1 border-t border-slate-200">
                  <span>صافي الفاتورة الإجمالي:</span>
                  <span className="text-emerald-700">{formatCurrency(viewingInvoice.grandTotal)}</span>
                </div>
              </div>

              {viewingInvoice.shippingTrackingNumber && (
                <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-center font-mono font-bold text-amber-800 text-[11px]">
                  رقم تتبع شحنة دارجو: {viewingInvoice.shippingTrackingNumber}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Quick Create Missing Item */}
      {isQuickCreateItemOpen && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-black">إضافة صنف جديد للمخزن والفاتورة</h3>
              </div>
              <button
                onClick={() => setIsQuickCreateItemOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickCreateAndAddToInvoice} className="p-5 space-y-4">
              <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-xs text-amber-900 font-medium">
                سيتم حفظ هذا الصنف في مستودعك الدائم وإدراجه في هذه الفاتورة فوراً.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الصنف الجديد *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="مثال: حقيبة جلد طبيعي..."
                  value={quickNewProductForm.name}
                  onChange={(e) =>
                    setQuickNewProductForm({ ...quickNewProductForm, name: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الباركود</label>
                  <input
                    type="text"
                    value={quickNewProductForm.barcode}
                    onChange={(e) =>
                      setQuickNewProductForm({ ...quickNewProductForm, barcode: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold bg-slate-50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">التصنيف</label>
                  <select
                    value={quickNewProductForm.category}
                    onChange={(e) =>
                      setQuickNewProductForm({ ...quickNewProductForm, category: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white focus:outline-none"
                  >
                    {savedCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">سعر التكلفة (د.أ)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="10.00"
                    value={quickNewProductForm.costPrice}
                    onChange={(e) =>
                      setQuickNewProductForm({ ...quickNewProductForm, costPrice: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">سعر البيع (د.أ) *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="18.00"
                    value={quickNewProductForm.sellingPrice}
                    onChange={(e) =>
                      setQuickNewProductForm({ ...quickNewProductForm, sellingPrice: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsQuickCreateItemOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md cursor-pointer"
                >
                  حفظ وإدراج بالفاتورة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

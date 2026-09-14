import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  Edit2,
  Trash2,
  Barcode,
  Boxes,
  TrendingUp,
  DollarSign,
  Layers,
  History,
  CheckCircle2,
  X,
  FileSpreadsheet,
  Printer,
  ChevronDown,
  Scan,
  Sparkles,
  Camera,
  Wand2
} from 'lucide-react';
import { MerchantProduct, StockMovement } from '../types/accounting';
import { User } from '../types/logistics';
import { formatCurrency } from '../utils/logisticsHelpers';
import { MerchantBarcodeScannerModal } from './MerchantBarcodeScannerModal';

interface MerchantWarehouseProps {
  currentMerchant: User;
  onRefreshOrders?: () => void;
}

export const MerchantWarehouse: React.FC<MerchantWarehouseProps> = ({
  currentMerchant,
  onRefreshOrders,
}) => {
  const [products, setProducts] = useState<MerchantProduct[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [activeSubTab, setActiveSubTab] = useState<'inventory' | 'movements' | 'low_stock'>('inventory');

  // Barcode Scanner Modal
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);

  // New/Edit Product Modal
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<MerchantProduct | null>(null);
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
    'أخرى',
  ]);
  const [isNewCatModalOpen, setIsNewCatModalOpen] = useState(false);
  const [newCatInput, setNewCatInput] = useState('');
  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    barcode: '',
    category: 'ألبسة نسائية',
    costPrice: '',
    sellingPrice: '',
    stockQuantity: '10',
    minStockAlert: '5',
    unit: 'قطعة',
    locationRack: '',
    notes: '',
  });

  // Helpers to generate random barcode & SKU
  const generateRandomBarcode = () => {
    const code = `628${Math.floor(100000000 + Math.random() * 900000000)}`;
    setProductForm((prev) => ({ ...prev, barcode: code }));
    showToast(`تم توليد باركود جديد: ${code}`);
  };

  const generateRandomSku = (cat?: string) => {
    const prefix = cat ? cat.slice(0, 3).toUpperCase() : 'PRD';
    const num = Math.floor(1000 + Math.random() * 9000);
    const sku = `${prefix}-${num}`;
    setProductForm((prev) => ({ ...prev, sku }));
  };

  // Helper to calculate selling price by margin
  const applyProfitMargin = (marginPercent: number) => {
    const cost = parseFloat(productForm.costPrice) || 0;
    if (cost > 0) {
      const calculated = (cost * (1 + marginPercent / 100)).toFixed(2);
      setProductForm((prev) => ({ ...prev, sellingPrice: calculated }));
      showToast(`تم احتساب سعر البيع بهامش ربح ${marginPercent}%: ${calculated} د.أ`);
    } else {
      showToast('يرجى إدخال سعر التكلفة أولاً لاحتساب هامش الربح', 'error');
    }
  };

  // Quick Open Product Modal with scanned barcode
  const handleOpenQuickCreate = (scannedBarcode: string) => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      barcode: scannedBarcode,
      category: 'ألبسة نسائية',
      costPrice: '10',
      sellingPrice: '18',
      stockQuantity: '10',
      minStockAlert: '3',
      unit: 'قطعة',
      locationRack: 'رف A-1',
      notes: '',
    });
    setIsProductModalOpen(true);
  };

  // Stock Adjustment Modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedProductToAdjust, setSelectedProductToAdjust] = useState<MerchantProduct | null>(null);
  const [adjustForm, setAdjustForm] = useState({
    type: 'ADJUSTMENT', // 'IN_PURCHASE' | 'OUT_SALE' | 'ADJUSTMENT' | 'DAMAGE'
    quantityChange: '',
    referenceNumber: '',
    notes: '',
  });

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchCategories = async () => {
    if (!currentMerchant?.id) return;
    try {
      const res = await fetch(`/api/merchants/${currentMerchant.id}/categories`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.categories) && data.categories.length > 0) {
          setSavedCategories(data.categories);
          localStorage.setItem(`dargo_categories_${currentMerchant.id}`, JSON.stringify(data.categories));
        }
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
      const cached = localStorage.getItem(`dargo_categories_${currentMerchant.id}`);
      if (cached) {
        try {
          setSavedCategories(JSON.parse(cached));
        } catch (_) {}
      }
    }
  };

  const handleSaveNewCategory = async (catName: string) => {
    const clean = catName.trim();
    if (!clean) return;
    if (!currentMerchant?.id) return;
    try {
      const res = await fetch(`/api/merchants/${currentMerchant.id}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: clean }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.categories)) {
          setSavedCategories(data.categories);
          localStorage.setItem(`dargo_categories_${currentMerchant.id}`, JSON.stringify(data.categories));
        }
      } else {
        setSavedCategories((prev) => Array.from(new Set([...prev, clean])));
      }
      setProductForm((prev) => ({ ...prev, category: clean }));
      showToast(`تم حفظ تصنيف "${clean}" بنجاح وتثبيته في النظام`);
      setNewCatInput('');
      setIsNewCatModalOpen(false);
    } catch (err) {
      setSavedCategories((prev) => Array.from(new Set([...prev, clean])));
      setProductForm((prev) => ({ ...prev, category: clean }));
      showToast(`تم حفظ تصنيف "${clean}" محلياً`);
      setNewCatInput('');
      setIsNewCatModalOpen(false);
    }
  };

  const fetchWarehouseData = async () => {
    if (!currentMerchant?.id) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/merchants/${currentMerchant.id}/warehouse`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setMovements(data.movements || []);
        setStats(data.stats || null);
      }
    } catch (err) {
      console.error('Failed to load warehouse data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouseData();
    fetchCategories();
  }, [currentMerchant?.id]);

  const categories = useMemo(() => {
    const set = new Set<string>(['ALL', ...savedCategories]);
    products.forEach((p) => {
      if (p.category && p.category.trim()) set.add(p.category.trim());
    });
    return Array.from(set);
  }, [savedCategories, products]);

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery);
    const matchesCategory = categoryFilter === 'ALL' || p.category === categoryFilter;
    const matchesTab = activeSubTab !== 'low_stock' || p.stockQuantity <= p.minStockAlert;
    return matchesSearch && matchesCategory && matchesTab;
  });

  // Save Product (Create or Update)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim()) {
      showToast('يرجى كتابة اسم الصنف', 'error');
      return;
    }

    const payload = {
      name: productForm.name.trim(),
      sku: productForm.sku.trim() || undefined,
      barcode: productForm.barcode.trim() || undefined,
      category: productForm.category,
      costPrice: parseFloat(productForm.costPrice) || 0,
      sellingPrice: parseFloat(productForm.sellingPrice) || 0,
      stockQuantity: parseInt(productForm.stockQuantity, 10) || 0,
      minStockAlert: parseInt(productForm.minStockAlert, 10) || 5,
      unit: productForm.unit,
      locationRack: productForm.locationRack.trim(),
      notes: productForm.notes.trim(),
    };

    try {
      if (editingProduct) {
        const res = await fetch(`/api/merchants/${currentMerchant.id}/products/${editingProduct.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          showToast('تم تحديث الصنف بنجاح');
          setIsProductModalOpen(false);
          fetchWarehouseData();
        } else {
          showToast('فشل تحديث الصنف', 'error');
        }
      } else {
        const res = await fetch(`/api/merchants/${currentMerchant.id}/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          showToast('تمت إضافة الصنف الجديد إلى المستودع بنجاح');
          setIsProductModalOpen(false);
          fetchWarehouseData();
        } else {
          showToast('فشل إضافة الصنف', 'error');
        }
      }
    } catch (err) {
      showToast('خطأ في الاتصال بالخادم', 'error');
    }
  };

  // Delete Product
  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الصنف من المستودع؟')) return;
    try {
      const res = await fetch(`/api/merchants/${currentMerchant.id}/products/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast('تم حذف الصنف من المستودع');
        fetchWarehouseData();
      }
    } catch (err) {
      showToast('فشل حذف الصنف', 'error');
    }
  };

  // Submit Stock Adjustment
  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductToAdjust) return;
    const qty = parseInt(adjustForm.quantityChange, 10);
    if (isNaN(qty) || qty === 0) {
      showToast('يرجى تحديد كمية التعديل (موجبة للزيادة أو سالبة للخصم)', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/merchants/${currentMerchant.id}/stock-adjustments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProductToAdjust.id,
          quantityChange: qty,
          type: adjustForm.type,
          referenceNumber: adjustForm.referenceNumber || 'MANUAL-ADJ',
          notes: adjustForm.notes || 'تعديل رصيد المخزن',
        }),
      });

      if (res.ok) {
        showToast('تم تعديل رصيد الصنف وتسجيل حركة المخزن');
        setIsAdjustModalOpen(false);
        fetchWarehouseData();
      } else {
        showToast('فشل في حفظ تعديل الرصيد', 'error');
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
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Warehouse Overview KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>عدد الأصناف (SKU)</span>
            <Boxes className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {stats?.totalSkus || products.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            إجمالي {stats?.totalQuantity || 0} قطعة مسجلة
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>قيمة المخزون بالتكلفة</span>
            <DollarSign className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-600 mt-2">
            {formatCurrency(stats?.totalCostValue || 0)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">رأس المال المستثمر في البضاعة</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>القيمة السوقية بسعر البيع</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-2">
            {formatCurrency(stats?.totalRetailValue || 0)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">إجمالي الإيراد المتوقع عند البيع</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>هامش الربح المتوقع</span>
            <DollarSign className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 mt-2">
            {formatCurrency(stats?.potentialGrossProfit || 0)}
          </div>
          <div className="text-[11px] text-emerald-600 font-bold mt-1">
            نسبة هامش الربح: {Math.round(stats?.marginPercent || 0)}%
          </div>
        </div>

        <div
          onClick={() => setActiveSubTab('low_stock')}
          className={`rounded-2xl p-4 border cursor-pointer transition-all ${
            (stats?.lowStockCount || 0) > 0
              ? 'bg-rose-50 border-rose-200 hover:bg-rose-100/80'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-rose-600 text-xs font-bold">
            <span>أصناف شارفت على النفاد</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600 mt-2">
            {stats?.lowStockCount || 0}
          </div>
          <div className="text-[11px] text-rose-500 mt-1 font-medium">بحاجة لإعادة طلب وتوريد</div>
        </div>
      </div>

      {/* Subtabs & Actions Bar */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('inventory')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'inventory'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>قائمة الجرد والمخزن ({products.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('low_stock')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'low_stock'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>نواقص المخزن ({stats?.lowStockCount || 0})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('movements')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'movements'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <History className="w-4 h-4" />
            <span>سجل الحركات والتوريدات ({movements.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => setIsBarcodeScannerOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-800 font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            title="مسح الباركود للبحث، توريد البضاعة، أو إضافة صنف غير موجود فوراً"
          >
            <Scan className="w-4 h-4 text-amber-400" />
            <span>مسح باركود (جرد / إضافة سريعة)</span>
          </button>

          <button
            onClick={() => {
              setEditingProduct(null);
              setProductForm({
                name: '',
                sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
                barcode: `${Math.floor(6280000 + Math.random() * 9999)}`,
                category: 'ألبسة نسائية',
                costPrice: '10',
                sellingPrice: '20',
                stockQuantity: '15',
                minStockAlert: '5',
                unit: 'قطعة',
                locationRack: 'رف A-1',
                notes: '',
              });
              setIsProductModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة صنف جديد</span>
          </button>

          <button
            onClick={fetchWarehouseData}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Inventory View */}
      {activeSubTab !== 'movements' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Search & Filter bar */}
          <div className="p-3 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="بحث بالاسم، الباركود، أو رمز SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-9 pl-4 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-slate-500 font-bold">التصنيف:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c === 'ALL' ? 'جميع التصنيفات' : c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-100/75 border-b border-slate-200 text-[11px] font-black text-slate-600">
                  <th className="p-3">الصنف / المنتج</th>
                  <th className="p-3">الباركود & SKU</th>
                  <th className="p-3">التصنيف</th>
                  <th className="p-3">سعر التكلفة</th>
                  <th className="p-3">سعر البيع</th>
                  <th className="p-3">الربح المتوقع</th>
                  <th className="p-3 text-center">الرصيد بالمستودع</th>
                  <th className="p-3">الموقع / الرف</th>
                  <th className="p-3 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      لا توجد أصناف مطابقة للبحث أو التصنيف في المخزن
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const isLowStock = p.stockQuantity <= p.minStockAlert;
                    const profitPerUnit = p.sellingPrice - p.costPrice;
                    const profitMargin = p.sellingPrice > 0 ? (profitPerUnit / p.sellingPrice) * 100 : 0;

                    return (
                      <tr key={p.id} className="hover:bg-amber-50/20 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{p.name}</div>
                          {p.notes && <div className="text-[10px] text-slate-400">{p.notes}</div>}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600">
                            <Barcode className="w-3.5 h-3.5 text-slate-400" />
                            <span>{p.barcode}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">{p.sku}</div>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                            {p.category}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-slate-700">
                          {formatCurrency(p.costPrice)}
                        </td>
                        <td className="p-3 font-bold text-slate-900">
                          {formatCurrency(p.sellingPrice)}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-emerald-600">+{formatCurrency(profitPerUnit)}</div>
                          <div className="text-[10px] text-slate-400">هامش: {Math.round(profitMargin)}%</div>
                        </td>
                        <td className="p-3 text-center">
                          <div
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-black text-xs ${
                              p.stockQuantity === 0
                                ? 'bg-rose-100 text-rose-700'
                                : isLowStock
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            <span>{p.stockQuantity}</span>
                            <span className="text-[10px] font-normal">{p.unit}</span>
                          </div>
                          {isLowStock && (
                            <div className="text-[10px] text-rose-500 font-bold mt-0.5">شارف على النفاد!</div>
                          )}
                        </td>
                        <td className="p-3 font-mono text-[11px] text-slate-600">
                          {p.locationRack || 'مستودع عام'}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedProductToAdjust(p);
                                setAdjustForm({
                                  type: 'ADJUSTMENT',
                                  quantityChange: '',
                                  referenceNumber: 'ADJ-' + Date.now().toString().slice(-4),
                                  notes: '',
                                });
                                setIsAdjustModalOpen(true);
                              }}
                              className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-[11px] font-bold transition-all cursor-pointer"
                              title="تعديل الرصيد والجرد السريع"
                            >
                              تعديل جرد
                            </button>

                            <button
                              onClick={() => {
                                setEditingProduct(p);
                                setProductForm({
                                  name: p.name,
                                  sku: p.sku,
                                  barcode: p.barcode,
                                  category: p.category,
                                  costPrice: p.costPrice.toString(),
                                  sellingPrice: p.sellingPrice.toString(),
                                  stockQuantity: p.stockQuantity.toString(),
                                  minStockAlert: p.minStockAlert.toString(),
                                  unit: p.unit,
                                  locationRack: p.locationRack || '',
                                  notes: p.notes || '',
                                });
                                setIsProductModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all cursor-pointer"
                              title="تعديل بيانات الصنف"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDeleteProduct(p.id)}
                              className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                              title="حذف الصنف"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stock Movements Log View */}
      {activeSubTab === 'movements' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="font-bold text-slate-800 text-xs flex items-center gap-2">
              <History className="w-4 h-4 text-amber-500" />
              <span>سجل حركات المخزن وتوريدات البضاعة</span>
            </div>
            <div className="text-[11px] text-slate-500">
              إجمالي {movements.length} حركة مسجلة آلياً
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-100/75 border-b border-slate-200 text-[11px] font-black text-slate-600">
                  <th className="p-3">التاريخ والوقت</th>
                  <th className="p-3">الصنف</th>
                  <th className="p-3">نوع الحركة</th>
                  <th className="p-3 text-center">الكمية</th>
                  <th className="p-3 text-center">الرصيد السابق</th>
                  <th className="p-3 text-center">الرصيد الجديد</th>
                  <th className="p-3">رقم المرجع / الفاتورة</th>
                  <th className="p-3">البيان والملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      لا توجد حركات مخزن مسجلة بعد
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => {
                    const isPositive = m.quantity > 0;
                    return (
                      <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 text-slate-500 font-mono text-[11px]">
                          {new Date(m.createdAt).toLocaleString('ar-JO')}
                        </td>
                        <td className="p-3 font-bold text-slate-900">{m.productName}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              m.type === 'IN_PURCHASE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : m.type === 'OUT_SALE' || m.type === 'OUT_SHIPPING'
                                ? 'bg-blue-100 text-blue-800'
                                : m.type === 'IN_RETURN'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {m.type === 'IN_PURCHASE'
                              ? 'توريد مشتريات'
                              : m.type === 'OUT_SALE'
                              ? 'بيع مباشر POS'
                              : m.type === 'OUT_SHIPPING'
                              ? 'شحن دارجو'
                              : m.type === 'IN_RETURN'
                              ? 'مرتجع بضاعة'
                              : 'تعديل جرد'}
                          </span>
                        </td>
                        <td className="p-3 text-center font-black">
                          <span className={isPositive ? 'text-emerald-600' : 'text-rose-600'}>
                            {isPositive ? `+${m.quantity}` : m.quantity}
                          </span>
                        </td>
                        <td className="p-3 text-center text-slate-500">{m.previousStock}</td>
                        <td className="p-3 text-center font-bold text-slate-900">{m.newStock}</td>
                        <td className="p-3 font-mono text-[11px] text-slate-600">
                          {m.referenceNumber || '---'}
                        </td>
                        <td className="p-3 text-slate-600">{m.notes}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Add or Edit Product */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-black">
                  {editingProduct ? 'تعديل بيانات الصنف بالمخزن' : 'إضافة صنف جديد للمستودع'}
                </h3>
              </div>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الصنف / المنتج *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: فستان مخمل تركي فاخر..."
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* Barcode & SKU Row with Fast Generator and Scanner Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">الباركود (Barcode)</label>
                    <button
                      type="button"
                      onClick={generateRandomBarcode}
                      className="text-[10px] text-amber-600 hover:text-amber-700 font-bold flex items-center gap-1 cursor-pointer"
                      title="توليد باركود تلقائي فريد"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>توليد باركود</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="628..."
                      value={productForm.barcode}
                      onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                      className="w-full pr-3 pl-8 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setIsBarcodeScannerOpen(true)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-600 transition-colors cursor-pointer p-0.5"
                      title="مسح بالكاميرا / القارئ"
                    >
                      <Scan className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">رمز الصنف (SKU)</label>
                    <button
                      type="button"
                      onClick={() => generateRandomSku(productForm.category)}
                      className="text-[10px] text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 cursor-pointer"
                      title="توليد رمز SKU مميز"
                    >
                      <Wand2 className="w-3 h-3" />
                      <span>توليد SKU</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="SKU-1001"
                    value={productForm.sku}
                    onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Category & Unit with Persistent Category Selection & Quick Adder */}
              <div className="space-y-2 bg-slate-50/80 p-3 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800">
                    التصنيف * <span className="text-[10px] text-slate-500 font-normal">(محفوظ دائماً في حسابك)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsNewCatModalOpen(!isNewCatModalOpen)}
                    className="text-[11px] font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer bg-amber-100/80 hover:bg-amber-100 px-2 py-0.5 rounded-lg border border-amber-300"
                  >
                    <span>+ تصنيف جديد</span>
                  </button>
                </div>

                {/* Inline New Category Creator */}
                {isNewCatModalOpen && (
                  <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-300 flex items-center gap-2 animate-in fade-in">
                    <input
                      type="text"
                      placeholder="اكتب اسم التصنيف الجديد (مثال: عبايات خليجية)..."
                      value={newCatInput}
                      onChange={(e) => setNewCatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveNewCategory(newCatInput);
                        }
                      }}
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-white border border-amber-300 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveNewCategory(newCatInput)}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-2xs whitespace-nowrap"
                    >
                      حفظ واستخدام
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsNewCatModalOpen(false)}
                      className="px-2 py-1.5 text-slate-500 hover:text-slate-700 text-xs cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <select
                      value={productForm.category}
                      onChange={(e) => {
                        if (e.target.value === '__NEW__') {
                          setIsNewCatModalOpen(true);
                        } else {
                          setProductForm({ ...productForm, category: e.target.value });
                          if (!productForm.sku) generateRandomSku(e.target.value);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none shadow-2xs"
                    >
                      {savedCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                      <option value="__NEW__" className="text-amber-600 font-bold">
                        + إضافة تصنيف جديد...
                      </option>
                    </select>
                  </div>
                  <div>
                    <select
                      value={productForm.unit}
                      onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none shadow-2xs"
                    >
                      <option value="قطعة">قطعة</option>
                      <option value="طقم">طقم</option>
                      <option value="كرتونة">كرتونة</option>
                      <option value="كيلو">كيلو</option>
                      <option value="علبة">علبة</option>
                      <option value="دزينة">دزينة</option>
                    </select>
                  </div>
                </div>

                {/* Fast Category Selector Chips */}
                <div className="flex flex-wrap gap-1.5 items-center pt-1">
                  <span className="text-[10px] text-slate-400 font-bold">اختيار سريع:</span>
                  {savedCategories.slice(0, 8).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setProductForm({ ...productForm, category: cat });
                        if (!productForm.sku) generateRandomSku(cat);
                      }}
                      className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition-all border cursor-pointer ${
                        productForm.category === cat
                          ? 'bg-amber-100 border-amber-400 text-amber-950 font-black shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pricing & Profit Margin Calculation Helper */}
              <div className="bg-amber-50/50 p-3 rounded-2xl border border-amber-200/60 space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">سعر التكلفة (د.أ) *</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      placeholder="10.00"
                      value={productForm.costPrice}
                      onChange={(e) => setProductForm({ ...productForm, costPrice: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">سعر البيع المقترح (د.أ) *</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      placeholder="20.00"
                      value={productForm.sellingPrice}
                      onChange={(e) => setProductForm({ ...productForm, sellingPrice: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Profit Margin Quick Buttons */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-amber-800 font-bold">احتساب هامش الربح تلقائياً:</span>
                  {[20, 30, 50, 100].map((margin) => (
                    <button
                      key={margin}
                      type="button"
                      onClick={() => applyProfitMargin(margin)}
                      className="text-[10px] px-2 py-0.5 rounded-lg bg-white hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold transition-all cursor-pointer shadow-2xs"
                    >
                      +{margin}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {editingProduct ? 'الرصيد الحالي' : 'الرصيد الافتتاحي'}
                  </label>
                  <input
                    type="number"
                    required
                    value={productForm.stockQuantity}
                    onChange={(e) => setProductForm({ ...productForm, stockQuantity: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">حد تنبيه النواقص</label>
                  <input
                    type="number"
                    value={productForm.minStockAlert}
                    onChange={(e) => setProductForm({ ...productForm, minStockAlert: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الموقع / الرف</label>
                  <input
                    type="text"
                    placeholder="رف B-2"
                    value={productForm.locationRack}
                    onChange={(e) => setProductForm({ ...productForm, locationRack: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات إضافية</label>
                <input
                  type="text"
                  placeholder="أي تفاصيل خاصة بالمقاس أو الخامة أو المورد..."
                  value={productForm.notes}
                  onChange={(e) => setProductForm({ ...productForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition-all cursor-pointer"
                >
                  {editingProduct ? 'حفظ التعديلات' : 'إضافة الصنف للمخزن'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Fast Stock Adjustment */}
      {isAdjustModalOpen && selectedProductToAdjust && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-black">تعديل جرد المخزن السريع</h3>
              </div>
              <button
                onClick={() => setIsAdjustModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStockAdjustment} className="p-5 space-y-4">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="text-xs text-slate-500">الصنف المحدد:</div>
                <div className="font-black text-sm text-slate-900 mt-0.5">
                  {selectedProductToAdjust.name}
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200 text-xs">
                  <span className="text-slate-600">الرصيد الحالي بالمستودع:</span>
                  <span className="font-black text-amber-600">
                    {selectedProductToAdjust.stockQuantity} {selectedProductToAdjust.unit}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نوع التعديل</label>
                <select
                  value={adjustForm.type}
                  onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="ADJUSTMENT">تعديل جرد دوري (زيادة أو نقص)</option>
                  <option value="IN_PURCHASE">توريد بضاعة يدوية إضافية (+)</option>
                  <option value="OUT_SALE">إخراج بضاعة مباعة (-)</option>
                  <option value="DAMAGE">تالف أو فاقد من المستودع (-)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  كمية التعديل (اكتب سالباً للنقصان، موجباً للزيادة) *
                </label>
                <input
                  type="number"
                  required
                  placeholder="مثال: 5 أو -2"
                  value={adjustForm.quantityChange}
                  onChange={(e) => setAdjustForm({ ...adjustForm, quantityChange: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم المرجع / المحضر</label>
                <input
                  type="text"
                  placeholder="ADJ-102"
                  value={adjustForm.referenceNumber}
                  onChange={(e) => setAdjustForm({ ...adjustForm, referenceNumber: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">سبب التعديل والبيان</label>
                <input
                  type="text"
                  placeholder="جرد شهري، بضاعة تالفة، هدية..."
                  value={adjustForm.notes}
                  onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition-all cursor-pointer"
                >
                  تأكيد تعديل الرصيد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Scanner & Quick Creator Modal */}
      <MerchantBarcodeScannerModal
        isOpen={isBarcodeScannerOpen}
        onClose={() => setIsBarcodeScannerOpen(false)}
        products={products}
        merchantId={currentMerchant.id}
        onProductUpdated={fetchWarehouseData}
        onOpenQuickCreate={handleOpenQuickCreate}
      />
    </div>
  );
};

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShoppingBag,
  Store,
  Truck,
  Plus,
  Minus,
  Trash2,
  Search,
  Barcode,
  Printer,
  DollarSign,
  CreditCard,
  QrCode,
  User,
  Phone,
  MapPin,
  CheckCircle2,
  Clock,
  RotateCcw,
  Sparkles,
  Layers,
  ArrowRight,
  Send,
  AlertCircle,
  TrendingUp,
  Tag,
  Package,
  Calendar,
  X,
  FileText,
  Sliders,
  Check,
  Camera,
  ScanLine,
  Volume2
} from 'lucide-react';
import { User as UserType, Order } from '../types/logistics';
import { GOVERNORATES, JORDAN_AREAS_MAP, STANDARD_DELIVERY_FEES, formatCurrency } from '../utils/logisticsHelpers';
import { PosReceiptModal, PosSale, PosSaleItem } from './PosReceiptModal';
import { CameraBarcodeScanner } from './CameraBarcodeScanner';

export interface PosProduct {
  id: string;
  name: string;
  barcode: string;
  category: string;
  price: number;
  stock: number;
  color?: string;
  size?: string;
}

const DEFAULT_MERCHANT_PRODUCTS: PosProduct[] = [
  { id: 'p-1', name: 'فستان مخمل تركي فاخر', barcode: '6281001', category: 'ألبسة نسائية', price: 35.0, stock: 14, size: 'L' },
  { id: 'p-2', name: 'بلوزة صوف شتوية كلاسيك', barcode: '6281002', category: 'ألبسة نسائية', price: 18.0, stock: 22, size: 'M' },
  { id: 'p-3', name: 'طقم إكسسوارات سهرة مطلي', barcode: '6281003', category: 'إكسسوارات', price: 15.0, stock: 30 },
  { id: 'p-4', name: 'شال كشمير أصلي منقوش', barcode: '6281004', category: 'إكسسوارات', price: 12.0, stock: 25 },
  { id: 'p-5', name: 'عطر مسك الليل الفاخر 100مل', barcode: '6281005', category: 'عطور وتجميل', price: 28.0, stock: 18 },
  { id: 'p-6', name: 'حقيبة يد جلدية إيطالية', barcode: '6281006', category: 'حقائب وأحذية', price: 32.0, stock: 9 },
  { id: 'p-7', name: 'حذاء كعب كلاسيك مريح', barcode: '6281007', category: 'حقائب وأحذية', price: 24.5, stock: 12, size: '38' },
  { id: 'p-8', name: 'ساعة نسائية ماسية مقاومة للماء', barcode: '6281008', category: 'ساعات', price: 42.0, stock: 8 },
  { id: 'p-9', name: 'جاكيت جينز عصري أوفرسايز', barcode: '6281009', category: 'ألبسة نسائية', price: 26.0, stock: 15, size: 'XL' },
  { id: 'p-10', name: 'معطر جو منزلي عود ملكي', barcode: '6281010', category: 'عطور وتجميل', price: 7.5, stock: 40 },
  { id: 'p-11', name: 'قميص قطني رسمي أنيق', barcode: '6281011', category: 'ألبسة رجالية', price: 20.0, stock: 16, size: 'L' },
  { id: 'p-12', name: 'محفظة رجالية جلد طبيعي', barcode: '6281012', category: 'إكسسوارات', price: 14.0, stock: 20 },
];

const CATEGORIES = [
  'الكل',
  'ألبسة نسائية',
  'عبايات وجلابيات',
  'ألبسة رجالية',
  'حقائب وأحذية',
  'إكسسوارات',
  'شالات وإيشاربات',
  'عطور وتجميل',
  'ساعات',
  'أخرى',
];

// Audio beep for physical/camera scanner feedback
function playPosBeep(type: 'success' | 'error' = 'success') {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, ctx.currentTime);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch {
    // Ignore audio context autoplay restrictions
  }
}

interface MerchantPosProps {
  currentMerchant: UserType;
  onOpenWaybill: (order: Order) => void;
  onOrderCreated?: () => void;
}

export const MerchantPos: React.FC<MerchantPosProps> = ({
  currentMerchant,
  onOpenWaybill,
  onOrderCreated,
}) => {
  // Navigation tabs inside POS
  const [posTab, setPosTab] = useState<'register' | 'history' | 'inventory'>('register');

  // Mode: In-Store Walk-in vs Online Delivery
  const [saleMode, setSaleMode] = useState<'IN_STORE' | 'ONLINE_DELIVERY'>('IN_STORE');

  // Products state (persisted per merchant)
  const [products, setProducts] = useState<PosProduct[]>(() => {
    try {
      const saved = localStorage.getItem(`tms_pos_products_${currentMerchant.id}`);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_MERCHANT_PRODUCTS;
  });

  // Sales History (persisted per merchant)
  const [salesHistory, setSalesHistory] = useState<PosSale[]>(() => {
    try {
      const saved = localStorage.getItem(`tms_pos_sales_${currentMerchant.id}`);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  // Save products to localStorage
  useEffect(() => {
    localStorage.setItem(`tms_pos_products_${currentMerchant.id}`, JSON.stringify(products));
  }, [products, currentMerchant.id]);

  // Save sales to localStorage
  useEffect(() => {
    localStorage.setItem(`tms_pos_sales_${currentMerchant.id}`, JSON.stringify(salesHistory));
  }, [salesHistory, currentMerchant.id]);

  // Cart State
  const [cart, setCart] = useState<{ product: PosProduct; quantity: number }[]>([]);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'CLIQ' | 'DEBT'>('CASH');
  const [cashReceived, setCashReceived] = useState<string>('');

  // Walk-in Customer info (Optional)
  const [walkinCustomerName, setWalkinCustomerName] = useState('');
  const [walkinCustomerPhone, setWalkinCustomerPhone] = useState('');

  // Online Delivery Recipient Info
  const [deliveryRecipientName, setDeliveryRecipientName] = useState('');
  const [deliveryRecipientPhone, setDeliveryRecipientPhone] = useState('');
  const [deliveryRecipientPhoneAlt, setDeliveryRecipientPhoneAlt] = useState('');
  const [deliveryGovernorate, setDeliveryGovernorate] = useState('عمان');
  const [deliveryArea, setDeliveryArea] = useState('خلدا');
  const [deliveryFullAddress, setDeliveryFullAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [isPrepaidDelivery, setIsPrepaidDelivery] = useState(false);
  const [manualDeliveryFee, setManualDeliveryFee] = useState<string>('3.00');

  // Camera Barcode Scanner State
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('الكل');
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Persistent Categories State
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
  const [isPosCatModalOpen, setIsPosCatModalOpen] = useState(false);
  const [posNewCatInput, setPosNewCatInput] = useState('');

  // Fetch Categories from server on mount
  useEffect(() => {
    if (!currentMerchant?.id) return;
    fetch(`/api/merchants/${currentMerchant.id}/categories`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.categories) && data.categories.length > 0) {
          setSavedCategories(data.categories);
        }
      })
      .catch((err) => console.error('Failed to fetch POS categories:', err));
  }, [currentMerchant.id]);

  const handleSavePosCategory = async (catName: string) => {
    const clean = catName.trim();
    if (!clean) return;
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
        }
      } else {
        setSavedCategories((prev) => Array.from(new Set([...prev, clean])));
      }
      setSelectedCategory(clean);
      setNewProductForm((prev) => ({ ...prev, category: clean }));
      showToast(`تم حفظ تصنيف "${clean}" وتثبيته`);
      setPosNewCatInput('');
      setIsPosCatModalOpen(false);
    } catch (err) {
      setSavedCategories((prev) => Array.from(new Set([...prev, clean])));
      setSelectedCategory(clean);
      setNewProductForm((prev) => ({ ...prev, category: clean }));
      showToast(`تم حفظ تصنيف "${clean}"`);
      setPosNewCatInput('');
      setIsPosCatModalOpen(false);
    }
  };

  // Custom Item Modal/Popover State
  const [isCustomItemOpen, setIsCustomItemOpen] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [customItemCategory, setCustomItemCategory] = useState('عام');

  // New Inventory Product Form
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [newProductForm, setNewProductForm] = useState({
    name: '',
    barcode: '',
    category: 'ألبسة نسائية',
    price: '',
    stock: '10',
    size: '',
  });

  // Modal for Printing Receipt
  const [activeReceiptSale, setActiveReceiptSale] = useState<PosSale | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Loading & Toasts
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Delivery fee calculation (Manual input fee, independent of governorate)
  const deliveryFee = saleMode === 'ONLINE_DELIVERY' ? Math.max(0, parseFloat(manualDeliveryFee) || 0) : 0;

  // Cart Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }, [cart]);

  const totalAmount = useMemo(() => {
    const netGoods = Math.max(0, subtotal - discountAmount);
    return netGoods + deliveryFee;
  }, [subtotal, discountAmount, deliveryFee]);

  // Cash Change calculation
  const parsedCash = parseFloat(cashReceived) || 0;
  const changeDue = Math.max(0, parsedCash - totalAmount);

  // Add product to cart
  const addToCart = (product: PosProduct) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  // Update quantity
  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as { product: PosProduct; quantity: number }[];
    });
  };

  // Remove from cart
  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Clear Cart
  const clearCart = () => {
    setCart([]);
    setDiscountAmount(0);
    setCashReceived('');
    setWalkinCustomerName('');
    setWalkinCustomerPhone('');
    setDeliveryRecipientName('');
    setDeliveryRecipientPhone('');
    setDeliveryFullAddress('');
    setDeliveryNotes('');
  };

  // Process scanned code (used by USB barcode gun and phone camera)
  const processScannedBarcode = (rawCode: string) => {
    if (!rawCode.trim()) return;

    const trimmed = rawCode.trim().toLowerCase();
    const found = products.find(
      (p) => p.barcode.toLowerCase() === trimmed || p.name.toLowerCase().includes(trimmed)
    );

    if (found) {
      playPosBeep('success');
      addToCart(found);
      setBarcodeInput('');
      showToast(`تم مسح وإدراج "${found.name}" في الفاتورة (${found.price.toFixed(2)} د.أ)`);
      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus();
      }
    } else {
      playPosBeep('error');
      showToast(`لم يتم العثور على صنف بالباركود: ${rawCode}`, 'error');
      // Prefill barcode in new product modal in case merchant wants to create it
      setNewProductForm((prev) => ({ ...prev, barcode: rawCode }));
    }
  };

  // Barcode input submit (for Physical Barcode Scanner & manual keyboard)
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    processScannedBarcode(barcodeInput);
  };

  // Add custom manual item to cart
  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(customItemPrice);
    if (!customItemName.trim() || isNaN(priceNum) || priceNum <= 0) {
      showToast('يرجى كتابة اسم الصنف والسعر بشكل صحيح', 'error');
      return;
    }

    const customProduct: PosProduct = {
      id: `custom-${Date.now()}`,
      name: customItemName.trim(),
      barcode: `MANUAL-${Date.now().toString().slice(-4)}`,
      category: customItemCategory,
      price: priceNum,
      stock: 999,
    };

    addToCart(customProduct);
    setCustomItemName('');
    setCustomItemPrice('');
    setIsCustomItemOpen(false);
    showToast(`تمت إضافة صنف يدوي: "${customProduct.name}" (${priceNum} د.أ)`);
  };

  // Add New Product to Inventory
  const handleAddNewProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(newProductForm.price);
    const stockNum = parseInt(newProductForm.stock, 10) || 0;

    if (!newProductForm.name.trim() || isNaN(priceNum) || priceNum <= 0) {
      showToast('يرجى تعبئة اسم المنتج والسعر بدقة', 'error');
      return;
    }

    const newProd: PosProduct = {
      id: `prod-${Date.now()}`,
      name: newProductForm.name.trim(),
      barcode: newProductForm.barcode.trim() || `628${Date.now().toString().slice(-4)}`,
      category: newProductForm.category,
      price: priceNum,
      stock: stockNum,
      size: newProductForm.size.trim() || undefined,
    };

    setProducts((prev) => [newProd, ...prev]);
    setIsNewProductModalOpen(false);
    setNewProductForm({
      name: '',
      barcode: '',
      category: 'ألبسة نسائية',
      price: '',
      stock: '10',
      size: '',
    });
    showToast(`تم حفظ الصنف الجديد بنجاح في مخزون المحل`);
  };

  // Process Checkout
  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      showToast('السلة فارغة، يرجى اختيار أصناف أولاً', 'error');
      return;
    }

    if (saleMode === 'ONLINE_DELIVERY') {
      if (!deliveryRecipientName.trim() || !deliveryRecipientPhone.trim() || !deliveryFullAddress.trim()) {
        showToast('يرجى إدخال اسم المستلم، رقم الهاتف، والعنوان التفصيلي للطلبية الأونلاين', 'error');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const invoiceSequence = `INV-${new Date().getFullYear()}-${(salesHistory.length + 101).toString()}`;
      let createdDeliveryOrder: Order | null = null;

      // 1. If Online Delivery: Create logistics order in backend
      if (saleMode === 'ONLINE_DELIVERY') {
        const goodsNet = Math.max(0, subtotal - discountAmount);
        const codAmount = isPrepaidDelivery ? 0 : goodsNet;

        const orderPayload = {
          merchantId: currentMerchant.id,
          recipientName: deliveryRecipientName.trim(),
          recipientPhone: deliveryRecipientPhone.trim(),
          recipientPhoneAlt: deliveryRecipientPhoneAlt.trim() || undefined,
          governorate: deliveryGovernorate,
          area: deliveryArea,
          fullAddress: deliveryFullAddress.trim(),
          merchantCollection: codAmount,
          deliveryFee: deliveryFee,
          totalCollection: isPrepaidDelivery ? deliveryFee : codAmount + deliveryFee,
          paymentType: isPrepaidDelivery ? 'PREPAID' : 'COD',
          packageType: cart.map((i) => `${i.product.name} (x${i.quantity})`).join(', ').slice(0, 100),
          piecesCount: cart.reduce((sum, i) => sum + i.quantity, 0),
          referenceNumber: invoiceSequence,
          notes: `[طلب كاشير POS] ${deliveryNotes ? deliveryNotes + ' - ' : ''}الأصناف: ${cart.map((i) => `${i.product.name}x${i.quantity}`).join(' | ')}`,
        };

        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderPayload),
        });

        if (res.ok) {
          createdDeliveryOrder = await res.json();
          onOrderCreated?.();
        } else {
          // Fallback simulation
          createdDeliveryOrder = {
            id: `ord-pos-${Date.now()}`,
            sequence: `ORD-${Date.now().toString().slice(-4)}`,
            status: 'PENDING',
            paymentType: isPrepaidDelivery ? 'PREPAID' : 'COD',
            merchantId: currentMerchant.id,
            recipientName: deliveryRecipientName.trim(),
            recipientPhone: deliveryRecipientPhone.trim(),
            governorate: deliveryGovernorate,
            area: deliveryArea,
            fullAddress: deliveryFullAddress.trim(),
            merchantCollection: codAmount,
            deliveryFee: deliveryFee,
            totalCollection: isPrepaidDelivery ? deliveryFee : codAmount + deliveryFee,
            packageType: 'طلبية كاشير أونلاين',
            piecesCount: cart.reduce((sum, i) => sum + i.quantity, 0),
            deliveryAttempts: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isSettledWithMerchant: false,
            isSettledWithDriver: false,
          };
        }
      }

      // 2. Build POS Sale record
      const saleItems: PosSaleItem[] = cart.map((item) => ({
        id: item.product.id,
        name: item.product.name,
        price: item.product.price,
        quantity: item.quantity,
        category: item.product.category,
      }));

      const newSaleRecord: PosSale = {
        id: `pos-sale-${Date.now()}`,
        invoiceNumber: invoiceSequence,
        merchantId: currentMerchant.id,
        merchantName: currentMerchant.commercialName || currentMerchant.name,
        type: saleMode,
        items: saleItems,
        subtotal: subtotal,
        discount: discountAmount,
        tax: 0,
        total: totalAmount,
        cashReceived: paymentMethod === 'CASH' && parsedCash > 0 ? parsedCash : totalAmount,
        changeDue: paymentMethod === 'CASH' ? changeDue : 0,
        paymentMethod: paymentMethod,
        customerName: saleMode === 'IN_STORE' ? (walkinCustomerName || 'زبون المحل') : deliveryRecipientName,
        customerPhone: saleMode === 'IN_STORE' ? walkinCustomerPhone : deliveryRecipientPhone,
        governorate: saleMode === 'ONLINE_DELIVERY' ? deliveryGovernorate : undefined,
        area: saleMode === 'ONLINE_DELIVERY' ? deliveryArea : undefined,
        deliveryFee: saleMode === 'ONLINE_DELIVERY' ? deliveryFee : 0,
        linkedOrderSequence: createdDeliveryOrder?.sequence,
        notes: saleMode === 'ONLINE_DELIVERY' ? deliveryNotes : undefined,
        createdAt: new Date().toISOString(),
        cashierName: currentMerchant.name || 'كاشير المحل',
      };

      // 3. Update stock levels for inventory
      setProducts((prev) =>
        prev.map((prod) => {
          const itemInCart = cart.find((c) => c.product.id === prod.id);
          if (itemInCart) {
            return { ...prod, stock: Math.max(0, prod.stock - itemInCart.quantity) };
          }
          return prod;
        })
      );

      // 4. Save sale into history
      setSalesHistory((prev) => [newSaleRecord, ...prev]);

      // 5. Open Thermal Receipt for the merchant
      setActiveReceiptSale(newSaleRecord);
      setIsReceiptModalOpen(true);

      // If it was delivery order, also show toast and trigger waybill optionally
      if (createdDeliveryOrder) {
        showToast(`تم تسجيل الفاتورة بنجاح وتوليد بوليصة التوصيل (${createdDeliveryOrder.sequence})!`);
      } else {
        showToast(`تم إتمام عملية البيع بنجاح برقم (${invoiceSequence})`);
      }

      // Reset cart
      clearCart();
    } catch (err) {
      console.error('POS Checkout Error:', err);
      showToast('حدث خطأ أثناء حفظ الفاتورة', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Available categories merged from standard, saved, and merchant items
  const availableCategories = useMemo(() => {
    const set = new Set<string>(['الكل', ...savedCategories]);
    CATEGORIES.forEach((c) => set.add(c));
    products.forEach((p) => {
      if (p.category && p.category.trim()) set.add(p.category.trim());
    });
    return Array.from(set);
  }, [savedCategories, products]);

  // Filtered product items for display
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategory !== 'الكل' && p.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.barcode.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [products, selectedCategory, searchQuery]);

  // Daily statistics for the POS
  const todaySales = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return salesHistory.filter((s) => s.createdAt.startsWith(todayStr));
  }, [salesHistory]);

  const totalTodayRevenue = useMemo(() => {
    return todaySales.reduce((sum, s) => sum + s.total, 0);
  }, [todaySales]);

  const inStoreTodayCount = todaySales.filter((s) => s.type === 'IN_STORE').length;
  const onlineDeliveryTodayCount = todaySales.filter((s) => s.type === 'ONLINE_DELIVERY').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold border border-slate-700">
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* POS Top Control Bar */}
      <div className="bg-slate-900 text-white rounded-3xl p-4 sm:p-5 border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-md">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-md border border-amber-500/30">
                نظام الكاشير ونقطة البيع المتكاملة POS
              </span>
              <span className="text-[11px] text-slate-400">
                {currentMerchant.commercialName || currentMerchant.name}
              </span>
            </div>
            <h2 className="text-lg font-black text-white mt-0.5">
              نقطة البيع والمبيعات المباشرة والشحن السريع
            </h2>
          </div>
        </div>

        {/* Daily Cashier Metrics Pill */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-800/80 p-1.5 rounded-2xl border border-slate-700 text-xs w-full md:w-auto justify-between sm:justify-start">
          <div className="px-3 py-1 bg-slate-900/90 rounded-xl border border-slate-700/60">
            <span className="text-slate-400 text-[10px] block">مبيعات الكاشير اليوم:</span>
            <span className="font-mono font-black text-amber-400 text-sm">
              {formatCurrency(totalTodayRevenue)}
            </span>
          </div>

          <div className="px-3 py-1">
            <span className="text-slate-400 text-[10px] block">بيع محلي:</span>
            <span className="font-bold text-emerald-400">{inStoreTodayCount} فاتورة</span>
          </div>

          <div className="px-3 py-1">
            <span className="text-slate-400 text-[10px] block">طلبات أونلاين:</span>
            <span className="font-bold text-blue-400">{onlineDeliveryTodayCount} شحنة</span>
          </div>

          <div className="flex items-center gap-1 border-r border-slate-700 pr-2">
            <button
              onClick={() => setPosTab('register')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all text-xs cursor-pointer ${
                posTab === 'register'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              شاشة الكاشير
            </button>

            <button
              onClick={() => setPosTab('history')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all text-xs cursor-pointer ${
                posTab === 'history'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              سجل الفواتير ({salesHistory.length})
            </button>

            <button
              onClick={() => setPosTab('inventory')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all text-xs cursor-pointer ${
                posTab === 'inventory'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              إدارة الأصناف
            </button>
          </div>
        </div>
      </div>

      {/* POS VIEW 1: Cash Register (POS Screen) */}
      {posTab === 'register' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left / Center: Catalog, Barcode Search & Categories (Cols 7 or 8) */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            {/* Barcode & Search Bar */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                {/* Barcode Scanner Instant Input & Camera Launcher */}
                <div className="sm:col-span-7 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <form
                      onSubmit={handleBarcodeSubmit}
                      className="flex-1 flex items-center relative"
                    >
                      <div className="absolute right-3 text-amber-600 pointer-events-none">
                        <Barcode className="w-5 h-5" />
                      </div>
                      <input
                        ref={barcodeInputRef}
                        type="text"
                        placeholder="امسح بجهاز الباركود أو اكتب الكود..."
                        value={barcodeInput}
                        onChange={(e) => setBarcodeInput(e.target.value)}
                        className="w-full pl-16 pr-10 py-2.5 text-xs sm:text-sm bg-slate-50 border border-amber-300 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all shadow-2xs"
                      />
                      <button
                        type="submit"
                        className="absolute left-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                      >
                        إضافة
                      </button>
                    </form>

                    {/* Camera Scanner Button (Mobile Camera & Webcam) */}
                    <button
                      type="button"
                      onClick={() => setIsCameraScannerOpen(true)}
                      className="px-3.5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 shrink-0 transition-all cursor-pointer select-none active:scale-95"
                      title="فتح كاميرا الهاتف لمسح باركود السلعة مباشرة"
                    >
                      <Camera className="w-4 h-4 text-slate-950 stroke-[2.2]" />
                      <span className="hidden sm:inline">مسح بكاميرا الهاتف</span>
                      <span className="sm:hidden">الكاميرا</span>
                    </button>
                  </div>

                  {/* Physical Scanner & Camera Status bar */}
                  <div className="flex items-center justify-between px-1 text-[10px] sm:text-[11px] text-slate-500">
                    <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>جاهز لاستقبال مسح أجهزة الباركود (USB/لاسلكي) وكاميرا الهاتف</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        barcodeInputRef.current?.focus();
                        showToast('تم وضع المؤشر في حقل المسح السريع');
                      }}
                      className="text-amber-800 hover:underline font-bold text-[10px] cursor-pointer"
                    >
                      تركيز المؤشر
                    </button>
                  </div>
                </div>

                {/* Text Search */}
                <div className="sm:col-span-5 relative flex items-center self-start">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="بحث باسم الصنف أو الفئة..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-4 pr-9 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-slate-400 focus:bg-white transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute left-2.5 text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Category Pills & Quick Custom Item Button */}
              <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 pt-1 scrollbar-none">
                <div className="flex items-center gap-1.5 shrink-0">
                  {availableCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        selectedCategory === cat
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}

                  {/* Add New Category Pill Button */}
                  <button
                    type="button"
                    onClick={() => setIsPosCatModalOpen(true)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-amber-800 bg-amber-100/70 hover:bg-amber-200/80 border border-amber-300 transition-all whitespace-nowrap cursor-pointer flex items-center gap-1"
                    title="إضافة تصنيف جديد وحفظه دائماً"
                  >
                    <Plus className="w-3 h-3 stroke-[2.5]" />
                    <span>تصنيف</span>
                  </button>
                </div>

                {/* Quick Custom Item Button */}
                <button
                  type="button"
                  onClick={() => setIsCustomItemOpen(true)}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs"
                  title="إضافة صنف غير مسجل في الكتالوج مباشرة للفاتورة"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>صنف يدوي سريع</span>
                </button>
              </div>

              {/* Add New Category Inline Drawer in POS */}
              {isPosCatModalOpen && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-center gap-2 animate-in fade-in">
                  <span className="text-xs font-bold text-amber-950 whitespace-nowrap">اسم التصنيف الجديد:</span>
                  <input
                    type="text"
                    placeholder="مثال: أطقم سهرة، عبايات كويتية..."
                    value={posNewCatInput}
                    onChange={(e) => setPosNewCatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSavePosCategory(posNewCatInput);
                      }
                    }}
                    className="flex-1 px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => handleSavePosCategory(posNewCatInput)}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-2xs whitespace-nowrap"
                  >
                    حفظ التصنيف
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPosCatModalOpen(false)}
                    className="px-2 py-1.5 text-slate-500 hover:text-slate-700 text-xs cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              )}
            </div>

            {/* Custom Manual Item Inline Modal */}
            {isCustomItemOpen && (
              <div className="bg-amber-500/10 border border-amber-400/60 rounded-2xl p-4 shadow-sm animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-amber-300/40 mb-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
                    <Tag className="w-4 h-4 text-amber-600" />
                    <span>إضافة صنف مخصص / يدوي للفاتورة مباشرة</span>
                  </div>
                  <button
                    onClick={() => setIsCustomItemOpen(false)}
                    className="text-slate-400 hover:text-slate-700 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleAddCustomItem} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-5">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم الصنف</label>
                    <input
                      type="text"
                      placeholder="مثال: فستان أحمر مقاس خاص..."
                      value={customItemName}
                      onChange={(e) => setCustomItemName(e.target.value)}
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:ring-2 focus:ring-amber-500"
                      autoFocus
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">السعر (د.أ)</label>
                    <input
                      type="number"
                      step="0.25"
                      placeholder="0.00"
                      value={customItemPrice}
                      onChange={(e) => setCustomItemPrice(e.target.value)}
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-mono font-bold focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="sm:col-span-4 flex items-end gap-2">
                    <button
                      type="submit"
                      className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>إدراج في السلة</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Products Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProducts.map((product) => {
                const inCart = cart.find((i) => i.product.id === product.id);
                return (
                  <div
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className={`group relative bg-white border rounded-2xl p-3.5 shadow-2xs hover:shadow-md transition-all cursor-pointer select-none flex flex-col justify-between ${
                      inCart
                        ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20'
                        : 'border-slate-200 hover:border-amber-400'
                    }`}
                  >
                    <div>
                      {/* Category & Barcode */}
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5">
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-medium truncate max-w-[90px]">
                          {product.category}
                        </span>
                        <span className="font-mono text-[9px] text-slate-400">
                          {product.barcode}
                        </span>
                      </div>

                      {/* Name */}
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-amber-700 transition-colors line-clamp-2 leading-tight">
                        {product.name}
                      </h4>

                      {product.size && (
                        <span className="text-[10px] text-slate-500 mt-1 inline-block">
                          المقاس: {product.size}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-xs text-slate-400 block text-[10px]">السعر:</span>
                        <span className="text-sm font-black text-slate-900 font-mono">
                          {product.price.toFixed(2)}{' '}
                          <span className="text-[10px] font-normal text-slate-500">د.أ</span>
                        </span>
                      </div>

                      {inCart ? (
                        <div className="w-7 h-7 rounded-xl bg-amber-500 text-slate-950 font-mono font-black text-xs flex items-center justify-center shadow-xs">
                          {inCart.quantity}
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-xl bg-slate-100 group-hover:bg-amber-500 group-hover:text-slate-950 text-slate-600 flex items-center justify-center transition-colors">
                          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredProducts.length === 0 && (
              <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 text-slate-500 space-y-2">
                <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="font-bold text-slate-700">لا توجد أصناف مطابقة للبحث</p>
                <p className="text-xs text-slate-400">
                  يمكنك استخدام زر "صنف يدوي سريع" أو إضافة المنتج في تبويب إدارة الأصناف.
                </p>
              </div>
            )}
          </div>

          {/* Right: Cart, Customer/Delivery Form & Checkout (Cols 5 or 4) */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-4">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden flex flex-col">
              {/* Sale Mode Toggle Header */}
              <div className="p-3 bg-slate-900 text-white border-b border-slate-800">
                <div className="text-[10px] text-slate-400 mb-1 font-semibold">نوع العملية / الفاتورة:</div>
                <div className="grid grid-cols-2 gap-2 bg-slate-950/80 p-1 rounded-2xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setSaleMode('IN_STORE')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      saleMode === 'IN_STORE'
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Store className="w-3.5 h-3.5" />
                    <span>بيع محلي (في المحل)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSaleMode('ONLINE_DELIVERY')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      saleMode === 'ONLINE_DELIVERY'
                        ? 'bg-blue-500 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>طلب أونلاين وتوصيل</span>
                  </button>
                </div>
              </div>

              {/* Online Delivery Recipient Form if active */}
              {saleMode === 'ONLINE_DELIVERY' && (
                <div className="p-3.5 bg-blue-50/70 border-b border-blue-200/80 space-y-2.5 animate-in fade-in duration-150 text-xs">
                  <div className="flex items-center justify-between font-bold text-blue-950 pb-1 border-b border-blue-200">
                    <span className="flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-blue-600" />
                      <span>بيانات المستلم وشحنة التوصيل</span>
                    </span>
                    <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-mono font-bold">
                      رسوم الشحن: {deliveryFee.toFixed(2)} د.أ
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                        اسم الزبون / المستلم *
                      </label>
                      <input
                        type="text"
                        placeholder="مثال: رانيا حداد"
                        value={deliveryRecipientName}
                        onChange={(e) => setDeliveryRecipientName(e.target.value)}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg p-1.5 text-slate-900 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                        رقم هاتف المستلم *
                      </label>
                      <input
                        type="tel"
                        placeholder="079XXXXXXX"
                        value={deliveryRecipientPhone}
                        onChange={(e) => setDeliveryRecipientPhone(e.target.value)}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg p-1.5 text-slate-900 font-mono focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Governorate, Area, and Separate Manual Delivery Fee */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 mb-0.5">المحافظة *</label>
                      <select
                        value={deliveryGovernorate}
                        onChange={(e) => {
                          const gov = e.target.value;
                          setDeliveryGovernorate(gov);
                          const areas = JORDAN_AREAS_MAP[gov] || [];
                          if (areas.length > 0) setDeliveryArea(areas[0]);
                          // Suggest standard fee for convenience while keeping it completely editable
                          setManualDeliveryFee((STANDARD_DELIVERY_FEES[gov] || 3).toFixed(2));
                        }}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg p-1.5 text-slate-900 focus:ring-1 focus:ring-blue-500"
                      >
                        {GOVERNORATES.map((gov) => (
                          <option key={gov} value={gov}>
                            {gov}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 mb-0.5">المنطقة</label>
                      <select
                        value={deliveryArea}
                        onChange={(e) => setDeliveryArea(e.target.value)}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg p-1.5 text-slate-900 focus:ring-1 focus:ring-blue-500"
                      >
                        {(JORDAN_AREAS_MAP[deliveryGovernorate] || [deliveryGovernorate]).map((area) => (
                          <option key={area} value={area}>
                            {area}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="block text-[10px] font-bold text-slate-700">سعر التوصيل (د.أ) *</label>
                        <button
                          type="button"
                          onClick={() => setManualDeliveryFee('0.00')}
                          className="text-[9px] text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                          title="تحديد التوصيل مجاني للزبون"
                        >
                          مجاني
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          value={manualDeliveryFee}
                          onChange={(e) => setManualDeliveryFee(e.target.value)}
                          placeholder="0.00"
                          className="w-full text-xs bg-white border border-blue-300 rounded-lg p-1.5 pr-2 pl-7 text-slate-900 font-mono font-bold focus:ring-2 focus:ring-blue-500 shadow-2xs"
                        />
                        <span className="absolute left-1.5 top-1.5 text-[10px] font-bold text-slate-400">د.أ</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                      العنوان التفصيلي (الشارع، المعلم، العمارة) *
                    </label>
                    <input
                      type="text"
                      placeholder="مثال: شارع وصفي التل - خلف مجمع جبر - عمارة 14 ط 2"
                      value={deliveryFullAddress}
                      onChange={(e) => setDeliveryFullAddress(e.target.value)}
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg p-1.5 text-slate-900 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isPrepaidDelivery}
                        onChange={(e) => setIsPrepaidDelivery(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-[11px] font-bold text-slate-800">
                        الطلب مدفوع مسبقاً (تحصيل أجور التوصيل فقط)
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* In-Store optional customer tag */}
              {saleMode === 'IN_STORE' && (
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-slate-500">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>بيانات الزبون (اختياري):</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="اسم الزبون..."
                      value={walkinCustomerName}
                      onChange={(e) => setWalkinCustomerName(e.target.value)}
                      className="text-xs bg-white border border-slate-300 rounded px-2 py-1 w-28 text-slate-800"
                    />
                    <input
                      type="tel"
                      placeholder="الهاتف..."
                      value={walkinCustomerPhone}
                      onChange={(e) => setWalkinCustomerPhone(e.target.value)}
                      className="text-xs bg-white border border-slate-300 rounded px-2 py-1 w-24 text-slate-800 font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Cart Items List */}
              <div className="p-4 flex-1 min-h-[220px] max-h-[340px] overflow-y-auto space-y-2">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-10 text-slate-400 space-y-2">
                    <ShoppingBag className="w-10 h-10 text-slate-300 stroke-1" />
                    <p className="text-xs font-bold text-slate-600">سلة المبيعات فارغة</p>
                    <p className="text-[11px] text-slate-400 max-w-[200px]">
                      امسح الباركود أو انقر على أي صنف من القائمة لإضافته إلى الفاتورة.
                    </p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/80 transition-all text-xs"
                    >
                      <div className="pr-1 flex-1">
                        <h5 className="font-bold text-slate-900 leading-tight">
                          {item.product.name}
                        </h5>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 font-mono">
                          <span>{item.product.price.toFixed(2)} د.أ</span>
                          {item.product.barcode && <span>• {item.product.barcode}</span>}
                        </div>
                      </div>

                      {/* Quantity Stepper */}
                      <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-0.5 mx-2">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.product.id, -1)}
                          className="w-5 h-5 flex items-center justify-center text-slate-600 hover:text-rose-600 hover:bg-slate-100 rounded cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-mono font-bold w-6 text-center text-slate-900">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.product.id, 1)}
                          className="w-5 h-5 flex items-center justify-center text-slate-600 hover:text-emerald-600 hover:bg-slate-100 rounded cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Item Total & Delete */}
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-slate-900 text-xs w-14 text-left">
                          {(item.product.price * item.quantity).toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Cart Footer & Financial Calculations */}
              <div className="p-4 bg-slate-50/80 border-t border-slate-200 space-y-3">
                {/* Subtotal & Discount row */}
                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>مجموع الأصناف ({cart.reduce((s, i) => s + i.quantity, 0)} قطعة):</span>
                    <span className="font-mono font-bold text-slate-900">{subtotal.toFixed(2)} د.أ</span>
                  </div>

                  {/* Discount Input */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-600">خصم ترويجي:</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        placeholder="0.00"
                        value={discountAmount || ''}
                        onChange={(e) => setDiscountAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-20 text-xs bg-white border border-slate-300 rounded p-1 text-center font-mono font-bold text-emerald-700"
                      />
                      <span className="text-[10px] text-slate-500">د.أ</span>
                    </div>
                  </div>

                  {saleMode === 'ONLINE_DELIVERY' && (
                    <div className="flex justify-between text-blue-700 font-medium">
                      <span>أجور التوصيل ({deliveryGovernorate}):</span>
                      <span className="font-mono font-bold">+{deliveryFee.toFixed(2)} د.أ</span>
                    </div>
                  )}

                  {/* Grand Total */}
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-sm font-black text-slate-900">المجموع المطلوب تحصيله:</span>
                    <span className="text-xl font-black text-amber-700 font-mono">
                      {formatCurrency(totalAmount)}
                    </span>
                  </div>
                </div>

                {/* Payment Methods (Only for In-Store or Prepaid) */}
                <div className="space-y-2 pt-1">
                  <span className="text-[10px] font-bold text-slate-500 block">طريقة الدفع:</span>
                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('CASH')}
                      className={`py-1.5 text-center text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        paymentMethod === 'CASH'
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      كاش
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('CARD')}
                      className={`py-1.5 text-center text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        paymentMethod === 'CARD'
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      بطاقة POS
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('CLIQ')}
                      className={`py-1.5 text-center text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        paymentMethod === 'CLIQ'
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      CliQ كليك
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('DEBT')}
                      className={`py-1.5 text-center text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        paymentMethod === 'DEBT'
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      آجل / ذمم
                    </button>
                  </div>

                  {/* Cash Change Quick Calculator */}
                  {paymentMethod === 'CASH' && (
                    <div className="p-2.5 bg-amber-50/90 border border-amber-200 rounded-xl space-y-1.5 animate-in fade-in">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-amber-950">المبلغ المستلم من الزبون:</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="1"
                            placeholder={totalAmount.toFixed(0)}
                            value={cashReceived}
                            onChange={(e) => setCashReceived(e.target.value)}
                            className="w-24 text-xs bg-white border border-amber-300 rounded p-1 text-center font-mono font-bold"
                          />
                          <span className="text-[10px] text-slate-600">د.أ</span>
                        </div>
                      </div>

                      {/* Quick Cash Presets */}
                      <div className="flex items-center justify-end gap-1 text-[10px]">
                        {[10, 20, 50, 100].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setCashReceived(amt.toString())}
                            className="px-2 py-0.5 bg-white hover:bg-amber-200 border border-amber-300 rounded text-amber-900 font-mono font-bold cursor-pointer"
                          >
                            {amt} د.أ
                          </button>
                        ))}
                      </div>

                      {parsedCash > totalAmount && (
                        <div className="flex justify-between items-center text-xs font-black text-emerald-800 pt-1 border-t border-amber-200">
                          <span>المتبقي للزبون (الفكة):</span>
                          <span className="font-mono text-sm">{changeDue.toFixed(2)} د.أ</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Big Action Submit Buttons */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={clearCart}
                    disabled={cart.length === 0}
                    className="p-3 bg-slate-200 hover:bg-slate-300 disabled:opacity-40 text-slate-700 rounded-2xl transition-colors cursor-pointer"
                    title="تفريغ السلة"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleCompleteSale}
                    disabled={cart.length === 0 || isSubmitting}
                    className={`flex-1 py-3 px-4 font-bold text-xs sm:text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                      saleMode === 'IN_STORE'
                        ? 'bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 shadow-amber-500/20'
                        : 'bg-blue-600 hover:bg-blue-700 active:scale-98 text-white shadow-blue-600/20'
                    }`}
                  >
                    {isSubmitting ? (
                      <span>جاري المعالجة...</span>
                    ) : saleMode === 'IN_STORE' ? (
                      <>
                        <Printer className="w-4 h-4 stroke-[2.5]" />
                        <span>إتمام البيع وطباعة الفاتورة</span>
                      </>
                    ) : (
                      <>
                        <Truck className="w-4 h-4 stroke-[2.5]" />
                        <span>تأكيد الطلب وإنشاء بوليصة شحن فورية</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POS VIEW 2: Sales History & Reprints */}
      {posTab === 'history' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h3 className="text-base font-black text-slate-900">
                سجل فواتير ومبيعات الكاشير
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                قائمة العمليات المنفذة في المحل وعبر خدمة التوصيل الأونلاين مع إمكانية إعادة طباعة الفاتورة
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl">
                إجمالي الفواتير: {salesHistory.length}
              </span>
            </div>
          </div>

          {salesHistory.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <Clock className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-700">لا توجد عمليات بيع مسجلة بعد</p>
              <p className="text-xs text-slate-400">
                ابدأ بإنشاء أول عملية بيع من شاشة الكاشير وستظهر هنا فورياً.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <th className="py-3 px-4">رقم الفاتورة</th>
                    <th className="py-3 px-4">التاريخ والوقت</th>
                    <th className="py-3 px-4">نوع البيع</th>
                    <th className="py-3 px-4">الزبون</th>
                    <th className="py-3 px-4">الأصناف</th>
                    <th className="py-3 px-4">طريقة الدفع</th>
                    <th className="py-3 px-4">المجموع الكلي</th>
                    <th className="py-3 px-4 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {salesHistory.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {sale.invoiceNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono">
                        {new Date(sale.createdAt).toLocaleString('ar-JO', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md font-bold text-[11px] ${
                            sale.type === 'IN_STORE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {sale.type === 'IN_STORE' ? (
                            <>
                              <Store className="w-3 h-3" />
                              <span>بيع محلي</span>
                            </>
                          ) : (
                            <>
                              <Truck className="w-3 h-3" />
                              <span>طلب أونلاين</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">
                          {sale.customerName || 'عميل نقدي'}
                        </div>
                        {sale.customerPhone && (
                          <div className="text-[10px] text-slate-400 font-mono" dir="ltr">
                            {sale.customerPhone}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                        {sale.items.map((i) => `${i.name} (x${i.quantity})`).join(', ')}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-700">
                        {sale.paymentMethod === 'CASH'
                          ? 'نقداً'
                          : sale.paymentMethod === 'CARD'
                          ? 'بطاقة POS'
                          : sale.paymentMethod === 'CLIQ'
                          ? 'CliQ'
                          : 'آجل'}
                      </td>
                      <td className="py-3 px-4 font-mono font-black text-amber-700 text-sm">
                        {formatCurrency(sale.total)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveReceiptSale(sale);
                              setIsReceiptModalOpen(true);
                            }}
                            className="p-1.5 bg-slate-100 hover:bg-amber-500 hover:text-slate-950 text-slate-700 rounded-lg transition-colors cursor-pointer"
                            title="طباعة الفاتورة الحرارية"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* POS VIEW 3: Store Inventory / Catalog Management */}
      {posTab === 'inventory' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h3 className="text-base font-black text-slate-900">
                إدارة منتجات وأصناف المتجر
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                تحديد الأسعار، أكواد الباركود، والكميات المتوفرة في صالة العرض والمستودع
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsNewProductModalOpen(true)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>إضافة صنف جديد للمتجر</span>
              </button>
            </div>
          </div>

          {/* New Product Inline Modal */}
          {isNewProductModalOpen && (
            <div className="bg-slate-50 border border-slate-300 rounded-2xl p-4 shadow-sm animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-3">
                <span className="font-bold text-xs text-slate-900">إضافة صنف جديد للكتالوج</span>
                <button
                  type="button"
                  onClick={() => setIsNewProductModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddNewProduct} className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم الصنف *</label>
                  <input
                    type="text"
                    placeholder="مثال: فستان حرير ملكي"
                    value={newProductForm.name}
                    onChange={(e) => setNewProductForm({ ...newProductForm, name: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900"
                    autoFocus
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">السعر (د.أ) *</label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="25.00"
                    value={newProductForm.price}
                    onChange={(e) => setNewProductForm({ ...newProductForm, price: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-mono font-bold"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">الباركود (SKU)</label>
                  <input
                    type="text"
                    placeholder="628XXXX"
                    value={newProductForm.barcode}
                    onChange={(e) => setNewProductForm({ ...newProductForm, barcode: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">القسم / التصنيف</label>
                  <select
                    value={newProductForm.category}
                    onChange={(e) => {
                      if (e.target.value === '__NEW__') {
                        setIsPosCatModalOpen(true);
                      } else {
                        setNewProductForm({ ...newProductForm, category: e.target.value });
                      }
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-bold"
                  >
                    {savedCategories.filter((c) => c !== 'الكل').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value="__NEW__" className="text-amber-600 font-bold">
                      + إضافة تصنيف جديد...
                    </option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">المخزون (الكمية)</label>
                  <input
                    type="number"
                    value={newProductForm.stock}
                    onChange={(e) => setNewProductForm({ ...newProductForm, stock: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-mono"
                  />
                </div>

                <div className="sm:col-span-12 flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsNewProductModalOpen(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 bg-white border border-slate-300 rounded-lg"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-1.5 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-600 rounded-lg shadow-xs cursor-pointer"
                  >
                    حفظ المنتج في الكتالوج
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Table of products */}
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="py-3 px-4">الباركود</th>
                  <th className="py-3 px-4">اسم الصنف</th>
                  <th className="py-3 px-4">التصنيف</th>
                  <th className="py-3 px-4">المقاس</th>
                  <th className="py-3 px-4">سعر البيع</th>
                  <th className="py-3 px-4">المتوفر في المخزن</th>
                  <th className="py-3 px-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-amber-700">
                      {p.barcode}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">{p.name}</td>
                    <td className="py-3 px-4">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px]">
                        {p.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{p.size || '-'}</td>
                    <td className="py-3 px-4 font-mono font-black text-slate-900 text-sm">
                      {p.price.toFixed(2)} د.أ
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                          p.stock > 10
                            ? 'bg-emerald-100 text-emerald-800'
                            : p.stock > 0
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {p.stock} قطعة
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setProducts((prev) => prev.filter((item) => item.id !== p.id));
                          showToast(`تم حذف الصنف ${p.name}`);
                        }}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                        title="حذف الصنف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Camera Barcode Scanner Modal */}
      <CameraBarcodeScanner
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onScan={(scannedCode) => {
          processScannedBarcode(scannedCode);
        }}
        title="مسح باركود السلعة بكاميرا الهاتف"
      />

      {/* POS Thermal Receipt Modal */}
      <PosReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        sale={activeReceiptSale}
        merchant={currentMerchant}
      />
    </div>
  );
};

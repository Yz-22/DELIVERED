import React, { useState, useMemo } from 'react';
import {
  Search,
  Settings,
  Plus,
  Filter,
  Layers,
  Star,
  Check,
  ChevronDown,
  Edit2,
  Trash2,
  Sliders,
  DollarSign,
  MapPin,
  Building2,
  Radio,
  Bell,
  Clock,
  Key,
  Shield,
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Info,
  Users,
  Copy,
  ExternalLink,
  Upload,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';
import { GOVERNORATES, STANDARD_DELIVERY_FEES } from '../utils/logisticsHelpers';
import { User, TenantBranding } from '../types/logistics';
import { fetchCompanyBranding, updateCompanyBranding, uploadCompanyLogo } from '../lib/branding';

export interface PriceListItem {
  id: string;
  fromRegion: string;       // من المنطقة
  fromSubRegion: string;    // من منطقة فرعية
  toRegion: string;         // إلى المنطقة
  toSubRegion: string;      // المنطقة الفرعية
  orderType: string;        // نوع الطلبية
  price: number;            // السعر
  returnDiscount: number;   // خصم المرتجع
  fixedReturn: number;      // مرتجع ثابت
  driverDiscount: number;   // خصم تكلفة المندوب
  fixedDriverCost: number;  // قيمة تكلفة المندوب الثابتة
}

export interface PriceListRecord {
  id: string;
  code: string; // الرمز
  name: string; // الاسم
  isDefault?: boolean; // تعيين كافتراضي
  services?: string[]; // الخدمات
  items?: PriceListItem[]; // عناصر قائمة الأسعار
  ammanPrice: number;
  governoratesPrice: number;
  northPrice?: number;
  southPrice?: number;
  returnFee: number;
  extraWeightFee: number;
  isFavorite?: boolean;
  isEditable?: boolean;
  notes?: string;
  assignedMerchantsCount?: number;
  updatedAt: string;
}

export const JORDAN_REGIONS = [
  'عمان',
  'الزرقاء',
  'إربد',
  'البلقاء (السلط)',
  'مادبا',
  'المفرق',
  'جرش',
  'عجلون',
  'الكرك',
  'الطفيلة',
  'معان',
  'العقبة',
  'المحافظات (الكل)',
  'الشمال (إربد / جرش / عجلون)',
  'الجنوب والعقبة',
  'جميع أنحاء المملكة',
];

export const JORDAN_SUB_REGIONS = [
  'الكل (كافة المناطق)',
  'شمال عمان',
  'غرب عمان',
  'شرق عمان',
  'جنوب عمان',
  'وسط البلد',
  'الجبيهة وصويلح',
  'تلاع العلي وخلدا',
  'دابوق وبدر الجديدة',
  'مرج الحمام',
  'طريق المطار',
  'سحاب والموقر',
  'مركز المحافظة',
  'القرى والأرياف',
  'المناطق النائية',
];

export const ORDER_TYPES = [
  'عادي',
  'فوري / إكسبرس',
  'تبديل طرد',
  'إرجاع للمتجر',
  'سحب شحنة',
];

export const AVAILABLE_SERVICES = [
  'خدمة التوصيل القياسي لجميع المحافظات (Standard Courier)',
  'خدمة الدفع والتحصيل عند الاستلام (Cash On Delivery - COD)',
  'خدمة التوصيل السريع خلال 24 ساعة (Express Delivery)',
  'خدمة التبديل والاسترجاع الفوري (Exchange & Reverse)',
  'خدمة شحن الطرود الحساسة والخاصة (Fragile / Special)',
];

export const generateInitialPriceItems = (
  ammanPrice: number,
  govPrice: number,
  northPrice = 3.0,
  southPrice = 3.0,
  returnFee = 1.0
): PriceListItem[] => [
  {
    id: 'item-1',
    fromRegion: 'عمان',
    fromSubRegion: 'الكل (كافة المناطق)',
    toRegion: 'عمان',
    toSubRegion: 'الكل (كافة المناطق)',
    orderType: 'عادي',
    price: ammanPrice,
    returnDiscount: 0,
    fixedReturn: returnFee,
    driverDiscount: 0,
    fixedDriverCost: 1.25,
  },
  {
    id: 'item-2',
    fromRegion: 'عمان',
    fromSubRegion: 'الكل (كافة المناطق)',
    toRegion: 'المحافظات (الكل)',
    toSubRegion: 'الكل (كافة المناطق)',
    orderType: 'عادي',
    price: govPrice,
    returnDiscount: 0,
    fixedReturn: returnFee,
    driverDiscount: 0,
    fixedDriverCost: 1.75,
  },
  {
    id: 'item-3',
    fromRegion: 'عمان',
    fromSubRegion: 'الكل (كافة المناطق)',
    toRegion: 'الشمال (إربد / جرش / عجلون)',
    toSubRegion: 'الكل (كافة المناطق)',
    orderType: 'عادي',
    price: northPrice,
    returnDiscount: 0,
    fixedReturn: returnFee,
    driverDiscount: 0,
    fixedDriverCost: 1.75,
  },
  {
    id: 'item-4',
    fromRegion: 'عمان',
    fromSubRegion: 'الكل (كافة المناطق)',
    toRegion: 'الجنوب والعقبة',
    toSubRegion: 'الكل (كافة المناطق)',
    orderType: 'عادي',
    price: southPrice,
    returnDiscount: 0,
    fixedReturn: returnFee,
    driverDiscount: 0,
    fixedDriverCost: 2.0,
  },
  {
    id: 'item-5',
    fromRegion: 'عمان',
    fromSubRegion: 'الكل (كافة المناطق)',
    toRegion: 'عمان',
    toSubRegion: 'الكل (كافة المناطق)',
    orderType: 'فوري / إكسبرس',
    price: ammanPrice + 1.5,
    returnDiscount: 0,
    fixedReturn: returnFee,
    driverDiscount: 0,
    fixedDriverCost: 2.25,
  },
];

// Initial price plans exactly matching Screenshot 1
export const INITIAL_PRICE_LISTS: PriceListRecord[] = [
  {
    id: 'pl-1',
    code: 'عمان 2 , محافظات 3',
    name: 'عمان 2 , محافظات 3',
    ammanPrice: 2.0,
    governoratesPrice: 3.0,
    northPrice: 3.0,
    southPrice: 3.0,
    returnFee: 1.0,
    extraWeightFee: 0.5,
    isFavorite: true,
    isEditable: true,
    assignedMerchantsCount: 24,
    notes: 'التسعيرة القياسية لمعظم المتاجر (2 د.أ عمان و 3 د.أ للمحافظات)',
    updatedAt: '2026-03-01',
  },
  {
    id: 'pl-2',
    code: '0000',
    name: 'جميع المملكه 2',
    ammanPrice: 2.0,
    governoratesPrice: 2.0,
    northPrice: 2.0,
    southPrice: 2.0,
    returnFee: 0.5,
    extraWeightFee: 0.25,
    isFavorite: true,
    isEditable: true,
    assignedMerchantsCount: 42,
    notes: 'تسعيرة موحدة لجميع محافظات المملكة بسعر 2.0 دينار',
    updatedAt: '2026-03-05',
  },
  {
    id: 'pl-3',
    code: 'عمان 2 , محافظات 2.5',
    name: 'عمان 2 , محافظات 2.5',
    ammanPrice: 2.0,
    governoratesPrice: 2.5,
    northPrice: 2.5,
    southPrice: 2.5,
    returnFee: 1.0,
    extraWeightFee: 0.5,
    isFavorite: false,
    isEditable: true,
    assignedMerchantsCount: 18,
    notes: 'تسعيرة مخفضة للمتاجر ذات الحجم المتوسط',
    updatedAt: '2026-03-07',
  },
  {
    id: 'pl-4',
    code: '0001',
    name: 'جميع المحافظات 1.75',
    ammanPrice: 1.75,
    governoratesPrice: 1.75,
    northPrice: 1.75,
    southPrice: 1.75,
    returnFee: 0.5,
    extraWeightFee: 0.25,
    isFavorite: false,
    isEditable: true,
    assignedMerchantsCount: 12,
    notes: 'تسعيرة خاصة للعقود الكبرى والشحنات البريدية الخفيفة',
    updatedAt: '2026-03-02',
  },
  {
    id: 'pl-5',
    code: '987',
    name: 'جميع المملكه 1.5',
    ammanPrice: 1.5,
    governoratesPrice: 1.5,
    northPrice: 1.5,
    southPrice: 1.5,
    returnFee: 0.5,
    extraWeightFee: 0.25,
    isFavorite: false,
    isEditable: true,
    assignedMerchantsCount: 8,
    notes: 'تسعيرة كبار التجار (VIP) بحجم شحنات يفوق 1000 طرد شهرياً',
    updatedAt: '2026-02-28',
  },
  {
    id: 'pl-6',
    code: '2222',
    name: 'مشكل',
    ammanPrice: 2.0,
    governoratesPrice: 3.5,
    northPrice: 3.0,
    southPrice: 4.0,
    returnFee: 1.5,
    extraWeightFee: 0.5,
    isFavorite: false,
    isEditable: true,
    assignedMerchantsCount: 15,
    notes: 'تسعيرة مخصصة حسب تفصيل المناطق الجغرافية والقرى النائية',
    updatedAt: '2026-03-08',
  },
  {
    id: 'pl-7',
    code: '99',
    name: 'قصي فاشن',
    ammanPrice: 1.75,
    governoratesPrice: 2.25,
    northPrice: 2.25,
    southPrice: 2.5,
    returnFee: 0.75,
    extraWeightFee: 0.3,
    isFavorite: false,
    isEditable: true,
    assignedMerchantsCount: 1,
    notes: 'عقد خاص حصري لمتجر قصي فاشن لملابس الموضة',
    updatedAt: '2026-03-06',
  },
  {
    id: 'pl-8',
    code: '333',
    name: 'مندوب الزرقاء مفرق الازرق',
    ammanPrice: 2.5,
    governoratesPrice: 2.5,
    northPrice: 2.5,
    southPrice: 3.5,
    returnFee: 1.0,
    extraWeightFee: 0.5,
    isFavorite: false,
    isEditable: true,
    assignedMerchantsCount: 3,
    notes: 'تسعيرة خط الزرقاء، المفرق، والأزرق الصحراوي',
    updatedAt: '2026-03-04',
  },
  {
    id: 'pl-9',
    code: '02',
    name: 'جوري ميكب',
    ammanPrice: 1.8,
    governoratesPrice: 2.3,
    northPrice: 2.3,
    southPrice: 2.5,
    returnFee: 0.8,
    extraWeightFee: 0.25,
    isFavorite: false,
    isEditable: true,
    assignedMerchantsCount: 1,
    notes: 'عقد خاص لمتجر جوري لمستحضرات التجميل ومستلزمات العناية',
    updatedAt: '2026-03-05',
  },
  {
    id: 'pl-10',
    code: '999',
    name: 'Anas tools',
    ammanPrice: 2.25,
    governoratesPrice: 3.25,
    northPrice: 3.0,
    southPrice: 3.5,
    returnFee: 1.25,
    extraWeightFee: 0.75,
    isFavorite: false,
    isEditable: true,
    assignedMerchantsCount: 1,
    notes: 'عقد خاص للعدد والأدوات الثقيلة (يشمل احتساب أوزان إضافية)',
    updatedAt: '2026-03-03',
  },
  {
    id: 'pl-11',
    code: '853',
    name: 'عمان 1.5 / محافظات 1.75 / شمال 2.25 / جنوب 2',
    ammanPrice: 1.5,
    governoratesPrice: 1.75,
    northPrice: 2.25,
    southPrice: 2.0,
    returnFee: 0.75,
    extraWeightFee: 0.35,
    isFavorite: true,
    isEditable: true,
    assignedMerchantsCount: 16,
    notes: 'تسعيرة تفصيلية موزعة حسب الأقاليم (عمان، محافظات، شمال، جنوب)',
    updatedAt: '2026-03-09',
  },
];

interface AdminSettingsProps {
  initialSubTab?: string;
  merchants?: User[];
  onOpenIntegrations?: () => void;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({
  initialSubTab = 'pricing',
  merchants = [],
  onOpenIntegrations,
}) => {
  // Sub-tabs exactly as in Screenshot 1
  const [activeSubTab, setActiveSubTab] = useState<string>(initialSubTab);

  // Company White-Label Branding State
  const [companyBranding, setCompanyBranding] = useState<TenantBranding>({
    tenantId: '',
    companyName: 'Delivere',
    logoUrl: '',
    phone: '0790000000',
    address: 'عمان - مجمع الأعمال / طريق المطار',
    taxId: '200192834',
  });
  const [isBrandingLoading, setIsBrandingLoading] = useState(false);
  const [isBrandingSaving, setIsBrandingSaving] = useState(false);
  const [isLogoUploading, setIsLogoUploading] = useState(false);

  // Fetch company branding on load
  React.useEffect(() => {
    let isMounted = true;
    const loadBranding = async () => {
      try {
        setIsBrandingLoading(true);
        const data = await fetchCompanyBranding();
        if (data && isMounted) {
          setCompanyBranding((prev) => ({
            ...prev,
            ...data,
            companyName: data.companyName || prev.companyName,
            logoUrl: data.logoUrl || prev.logoUrl,
            phone: data.phone || prev.phone,
            address: data.address || prev.address,
            taxId: data.taxId || prev.taxId,
          }));
        }
      } catch (err) {
        // Fallback to default
      } finally {
        if (isMounted) setIsBrandingLoading(false);
      }
    };
    loadBranding();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSaveCompanyBranding = async () => {
    if (!companyBranding.companyName.trim()) {
      showToast('خطأ: اسم الشركة مطلوب');
      return;
    }
    try {
      setIsBrandingSaving(true);
      const updated = await updateCompanyBranding(companyBranding);
      setCompanyBranding(updated);
      showToast('تم حفظ وتطبيق الهوية التجارية للشركة بنجاح!');
      window.dispatchEvent(new CustomEvent('company_branding_updated', { detail: updated }));
    } catch (err: any) {
      showToast(err.message || 'فشل حفظ إعدادات الشركة');
    } finally {
      setIsBrandingSaving(false);
    }
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('خطأ: حجم الصورة يجب ألا يتجاوز 5 ميجابايت');
      return;
    }

    try {
      setIsLogoUploading(true);
      const uploadedUrl = await uploadCompanyLogo(file);
      setCompanyBranding((prev) => ({ ...prev, logoUrl: uploadedUrl }));
      showToast('تم رفع صورة الشعار بنجاح');
    } catch (err: any) {
      showToast(err.message || 'فشل رفع صورة الشعار');
    } finally {
      setIsLogoUploading(false);
    }
  };

  // Price Lists State
  const [priceLists, setPriceLists] = useState<PriceListRecord[]>(INITIAL_PRICE_LISTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditableToggle, setIsEditableToggle] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'FAVORITES' | 'SPECIAL'>('ALL');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [isGroupByDropdownOpen, setIsGroupByDropdownOpen] = useState(false);
  const [isFavoritesDropdownOpen, setIsFavoritesDropdownOpen] = useState(false);

  // Modal State for Create/Edit Price List
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PriceListRecord | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    isDefault: false,
    isFavorite: false,
    selectedService: AVAILABLE_SERVICES[0],
    notes: '',
    items: [] as PriceListItem[],
  });

  // Handlers for dynamic multiple price list items (بند التسعيرة)
  const handleAddPriceItem = () => {
    const newItem: PriceListItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      fromRegion: 'عمان',
      fromSubRegion: 'الكل (كافة المناطق)',
      toRegion: 'عمان',
      toSubRegion: 'الكل (كافة المناطق)',
      orderType: 'عادي',
      price: 2.0,
      returnDiscount: 0,
      fixedReturn: 1.0,
      driverDiscount: 0,
      fixedDriverCost: 1.25,
    };
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));
  };

  const handleUpdatePriceItem = (
    id: string,
    field: keyof PriceListItem,
    val: string | number
  ) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === id ? { ...it, [field]: val } : it)),
    }));
  };

  const handleRemovePriceItem = (id: string) => {
    if (formData.items.length <= 1) {
      showToast('يجب إبقاء بند تسعير واحد على الأقل في القائمة');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((it) => it.id !== id),
    }));
  };

  const handleDuplicatePriceItem = (item: PriceListItem) => {
    const duplicated: PriceListItem = {
      ...item,
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    };
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, duplicated],
    }));
    showToast('تم تكرار بند التسعير');
  };

  // Success / Alert Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Filtered Price Lists
  const filteredPriceLists = useMemo(() => {
    return priceLists.filter((item) => {
      if (activeFilter === 'FAVORITES' && !item.isFavorite) return false;
      if (activeFilter === 'SPECIAL' && !item.notes?.includes('عقد خاص')) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.code.toLowerCase().includes(q) ||
          (item.notes && item.notes.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [priceLists, searchQuery, activeFilter]);

  // Master Checkbox Toggle
  const isAllSelected = filteredPriceLists.length > 0 && selectedIds.length === filteredPriceLists.length;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredPriceLists.map((p) => p.id));
    }
  };

  const handleToggleSelectItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Open Create Form
  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({
      code: '',
      name: '',
      isDefault: false,
      isFavorite: false,
      selectedService: AVAILABLE_SERVICES[0],
      notes: '',
      items: [
        {
          id: `item-1`,
          fromRegion: 'عمان',
          fromSubRegion: 'الكل (كافة المناطق)',
          toRegion: 'عمان',
          toSubRegion: 'الكل (كافة المناطق)',
          orderType: 'عادي',
          price: 2.0,
          returnDiscount: 0,
          fixedReturn: 1.0,
          driverDiscount: 0,
          fixedDriverCost: 1.25,
        },
        {
          id: `item-2`,
          fromRegion: 'عمان',
          fromSubRegion: 'الكل (كافة المناطق)',
          toRegion: 'المحافظات (الكل)',
          toSubRegion: 'الكل (كافة المناطق)',
          orderType: 'عادي',
          price: 3.0,
          returnDiscount: 0,
          fixedReturn: 1.0,
          driverDiscount: 0,
          fixedDriverCost: 1.75,
        },
      ],
    });
    setIsCreateModalOpen(true);
  };

  // Open Edit Form
  const handleOpenEdit = (item: PriceListRecord) => {
    setEditingItem(item);
    const existingItems =
      item.items && item.items.length > 0
        ? item.items
        : generateInitialPriceItems(
            item.ammanPrice,
            item.governoratesPrice,
            item.northPrice ?? item.governoratesPrice,
            item.southPrice ?? item.governoratesPrice,
            item.returnFee
          );

    setFormData({
      code: item.code,
      name: item.name,
      isDefault: !!item.isDefault,
      isFavorite: !!item.isFavorite,
      selectedService: item.services?.[0] || AVAILABLE_SERVICES[0],
      notes: item.notes || '',
      items: existingItems,
    });
    setIsCreateModalOpen(true);
  };

  // Save Price List (Create or Update)
  const handleSavePriceList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) {
      showToast('يرجى ملء اسم قائمة الأسعار والرمز');
      return;
    }

    if (formData.items.length === 0) {
      showToast('يرجى إضافة بند تسعير واحد على الأقل في القائمة');
      return;
    }

    // Determine representative summary values
    const ammanItem = formData.items.find(
      (it) => it.toRegion === 'عمان' || it.toRegion === 'جميع أنحاء المملكة'
    );
    const govItem = formData.items.find(
      (it) => it.toRegion.includes('المحافظات') || it.toRegion.includes('إربد')
    );

    const ammanPrice = ammanItem ? ammanItem.price : (formData.items[0]?.price || 2.0);
    const governoratesPrice = govItem ? govItem.price : (formData.items[1]?.price || 3.0);
    const returnFee = formData.items[0]?.fixedReturn || 1.0;

    const payload: PriceListRecord = {
      id: editingItem ? editingItem.id : `pl-${Date.now()}`,
      code: formData.code.trim(),
      name: formData.name.trim(),
      isDefault: formData.isDefault,
      services: [formData.selectedService],
      items: formData.items,
      ammanPrice,
      governoratesPrice,
      northPrice: governoratesPrice,
      southPrice: governoratesPrice,
      returnFee,
      extraWeightFee: 0.5,
      notes: formData.notes.trim(),
      isFavorite: formData.isFavorite,
      isEditable: true,
      assignedMerchantsCount: editingItem ? editingItem.assignedMerchantsCount : 0,
      updatedAt: new Date().toISOString().split('T')[0],
    };

    if (editingItem) {
      setPriceLists((prev) =>
        prev.map((p) => {
          if (p.id === editingItem.id) return payload;
          if (formData.isDefault && p.isDefault) return { ...p, isDefault: false };
          return p;
        })
      );
      showToast(`تم حفظ وتحديث قائمة الأسعار "${payload.name}" (${payload.items?.length || 0} بنود) بنجاح`);
    } else {
      setPriceLists((prev) => [
        payload,
        ...prev.map((p) => (formData.isDefault ? { ...p, isDefault: false } : p)),
      ]);
      showToast(`تمت إضافة قائمة الأسعار الجديدة "${payload.name}" بنجاح (${payload.items?.length || 0} بنود تسعير)`);
    }

    setIsCreateModalOpen(false);
    setEditingItem(null);
  };

  // Delete Selected
  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    if (confirm(`هل أنت متأكد من حذف ${selectedIds.length} من قوائم الأسعار؟`)) {
      setPriceLists((prev) => prev.filter((p) => !selectedIds.includes(p.id)));
      setSelectedIds([]);
      showToast('تم حذف قوائم الأسعار المحددة');
    }
  };

  // Toggle Favorite
  const handleToggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPriceLists((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isFavorite: !p.isFavorite } : p))
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans" dir="rtl">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 left-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 border border-slate-700 text-xs font-bold animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. ERP Top Sub-Navigation Header (Matching Screenshot 1 & 2) */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-14 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between overflow-x-auto py-2.5 gap-2 scrollbar-none">
            
            {/* Right section: Title & Version */}
            <div className="flex items-center gap-2 shrink-0 pr-1">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Settings className="w-4 h-4" />
              </div>
              <div>
                <span className="font-extrabold text-sm text-white">الإعدادات</span>
                <span className="text-[9px] text-slate-400 font-mono block -mt-0.5">v-rc-next-9.0.52</span>
              </div>
            </div>

            {/* Middle Nav Tabs (Exactly as in Screenshot 1) */}
            <div className="flex items-center gap-1 shrink-0 text-xs font-medium">
              
              <button
                type="button"
                onClick={() => {
                  setActiveSubTab('integrations');
                  onOpenIntegrations?.();
                }}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  activeSubTab === 'integrations'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                الاتصالات والتكاملات
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('company')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  activeSubTab === 'company'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                إعدادات الشركة
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('tasks')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  activeSubTab === 'tasks'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                قائمة انتظار المهام
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('zones')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  activeSubTab === 'zones'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                إعدادات المناطق
              </button>

              {/* HIGHLIGHTED TAB: التسعير (قائمة الأسعار) */}
              <button
                type="button"
                onClick={() => setActiveSubTab('pricing')}
                className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap font-bold flex items-center gap-1.5 ${
                  activeSubTab === 'pricing'
                    ? 'bg-amber-500 text-slate-950 shadow-sm ring-2 ring-amber-400/30'
                    : 'text-amber-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>التسعير (قائمة الأسعار)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('otp')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  activeSubTab === 'otp'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                إعدادات مدقق OTP
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('notifications')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  activeSubTab === 'notifications'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                الإشعارات
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('general')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  activeSubTab === 'general'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                الإعدادات العامة
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('late_orders')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  activeSubTab === 'late_orders'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                مراقبة الطلبات المتأخرة
              </button>
            </div>

            {/* Left badge */}
            <div className="shrink-0 text-slate-400 text-[11px] hidden sm:flex items-center gap-1.5 pl-2 border-l border-slate-800">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>صلاحيات المدير العام (Admin)</span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        
        {/* TAB A: التسعير (قائمة الأسعار) - EXACT MATCH FOR SCREENSHOT 1 */}
        {activeSubTab === 'pricing' && (
          <div className="space-y-4">
            
            {/* Top Row: Page Title on Right, Search Bar in Center */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              
              {/* Title: قائمة الأسعار (In Orange/Amber text as in Screenshot 1) */}
              <div className="flex items-center gap-3">
                <div className="border-r-4 border-amber-500 pr-3">
                  <h1 className="text-xl sm:text-2xl font-black text-amber-600 tracking-tight">
                    قائمة الأسعار
                  </h1>
                  <p className="text-xs text-slate-500">
                    إدارة وتخصيص تسعيرات التوصيل للشرائح المختلفة، عقود التجار الخاصة، والمحافظات
                  </p>
                </div>
              </div>

              {/* Search Bar with Gear Icon (Matching Screenshot 1) */}
              <div className="flex-1 max-w-xl">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="بحث في قوائم الأسعار أو الرمز..."
                    className="w-full bg-slate-200/70 border border-slate-300 rounded-xl px-4 py-2 pr-10 pl-10 text-xs sm:text-sm text-slate-900 placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all shadow-2xs text-right"
                  />
                  <Search className="w-4 h-4 text-slate-500 absolute right-3 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                    className="p-1 text-slate-500 hover:text-slate-800 absolute left-2.5 rounded-md hover:bg-slate-300/50 cursor-pointer"
                    title="خيارات البحث المتقدم"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Filter and Action Toolbar (Matching Screenshot 1) */}
            <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
              
              {/* Right Side Controls: Filters & Toggles */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                
                {/* 1. قابل للتعديل (Editable Toggle Switch from Screenshot 1) */}
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                  <span className="text-slate-700 font-bold text-xs">قابل للتعديل</span>
                  <button
                    type="button"
                    onClick={() => setIsEditableToggle(!isEditableToggle)}
                    className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                      isEditableToggle ? 'bg-amber-500' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        isEditableToggle ? '-translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* 2. المفضلات (Favorites Dropdown from Screenshot 1) */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setIsFavoritesDropdownOpen(!isFavoritesDropdownOpen);
                      setIsFilterDropdownOpen(false);
                      setIsGroupByDropdownOpen(false);
                    }}
                    className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 font-medium flex items-center gap-1.5 cursor-pointer"
                  >
                    <Star className="w-3.5 h-3.5 text-amber-500" />
                    <span>المفضلات</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  {isFavoritesDropdownOpen && (
                    <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 z-20 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveFilter('FAVORITES');
                          setIsFavoritesDropdownOpen(false);
                        }}
                        className="w-full text-right px-3 py-1.5 rounded-lg hover:bg-slate-50 text-slate-700 flex items-center justify-between"
                      >
                        <span>القوائم المفضلة فقط</span>
                        {activeFilter === 'FAVORITES' && <Check className="w-3.5 h-3.5 text-amber-600" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveFilter('ALL');
                          setIsFavoritesDropdownOpen(false);
                        }}
                        className="w-full text-right px-3 py-1.5 rounded-lg hover:bg-slate-50 text-slate-700 flex items-center justify-between"
                      >
                        <span>عرض جميع القوائم</span>
                        {activeFilter === 'ALL' && <Check className="w-3.5 h-3.5 text-amber-600" />}
                      </button>
                    </div>
                  )}
                </div>

                {/* 3. تجميع حسب (Group By Dropdown from Screenshot 1) */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setIsGroupByDropdownOpen(!isGroupByDropdownOpen);
                      setIsFilterDropdownOpen(false);
                      setIsFavoritesDropdownOpen(false);
                    }}
                    className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 font-medium flex items-center gap-1.5 cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5 text-slate-500" />
                    <span>تجميع حسب</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  {isGroupByDropdownOpen && (
                    <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 z-20 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveFilter('SPECIAL');
                          setIsGroupByDropdownOpen(false);
                        }}
                        className="w-full text-right px-3 py-1.5 rounded-lg hover:bg-slate-50 text-slate-700 flex items-center justify-between"
                      >
                        <span>عقود المتاجر الخاصة</span>
                        {activeFilter === 'SPECIAL' && <Check className="w-3.5 h-3.5 text-amber-600" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveFilter('ALL');
                          setIsGroupByDropdownOpen(false);
                        }}
                        className="w-full text-right px-3 py-1.5 rounded-lg hover:bg-slate-50 text-slate-700 flex items-center justify-between"
                      >
                        <span>حسب السعر الافتراضي</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* 4. الفلاتر (Filters Dropdown from Screenshot 1) */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setIsFilterDropdownOpen(!isFilterDropdownOpen);
                      setIsFavoritesDropdownOpen(false);
                      setIsGroupByDropdownOpen(false);
                    }}
                    className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 font-medium flex items-center gap-1.5 cursor-pointer"
                  >
                    <Filter className="w-3.5 h-3.5 text-slate-500" />
                    <span>الفلاتر</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  {isFilterDropdownOpen && (
                    <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 z-20 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveFilter('ALL');
                          setIsFilterDropdownOpen(false);
                        }}
                        className="w-full text-right px-3 py-1.5 rounded-lg hover:bg-slate-50 text-slate-700"
                      >
                        الكل ({priceLists.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveFilter('FAVORITES');
                          setIsFilterDropdownOpen(false);
                        }}
                        className="w-full text-right px-3 py-1.5 rounded-lg hover:bg-slate-50 text-slate-700"
                      >
                        المفضلة فقط ({priceLists.filter((p) => p.isFavorite).length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveFilter('SPECIAL');
                          setIsFilterDropdownOpen(false);
                        }}
                        className="w-full text-right px-3 py-1.5 rounded-lg hover:bg-slate-50 text-slate-700"
                      >
                        عقود المتاجر ({priceLists.filter((p) => p.notes?.includes('عقد خاص')).length})
                      </button>
                    </div>
                  )}
                </div>

                {/* Batch Delete if items are selected */}
                {selectedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>حذف المحدد ({selectedIds.length})</span>
                  </button>
                )}
              </div>

              {/* Left Side: Solid Orange/Amber "إنشاء" Button (Matching Screenshot 1) */}
              <button
                type="button"
                onClick={handleOpenCreate}
                className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-sm rounded-xl shadow-sm flex items-center gap-2 transition-all cursor-pointer select-none active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>إنشاء</span>
              </button>
            </div>

            {/* 3. The Price Lists Table (Exact reproduction of Screenshot 1) */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  {/* Table Header: # | checkbox | الرمز | الاسم */}
                  <thead className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold select-none">
                    <tr>
                      <th className="p-3.5 w-12 text-center text-slate-500 font-mono">#</th>
                      <th className="p-3.5 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          onChange={handleToggleSelectAll}
                          className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                      </th>
                      <th className="p-3.5 font-extrabold text-slate-800 min-w-[200px]">الرمز</th>
                      <th className="p-3.5 font-extrabold text-slate-800 min-w-[240px]">الاسم</th>
                      <th className="p-3.5 text-center font-bold text-slate-600">عمان</th>
                      <th className="p-3.5 text-center font-bold text-slate-600">المحافظات</th>
                      <th className="p-3.5 text-center font-bold text-slate-600">المرتجع</th>
                      <th className="p-3.5 text-center font-bold text-slate-600">المتاجر المرتبطة</th>
                      <th className="p-3.5 text-center font-bold text-slate-600 w-24">الإجراءات</th>
                    </tr>
                  </thead>

                  {/* Table Body */}
                  <tbody className="divide-y divide-slate-100">
                    {filteredPriceLists.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-12 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <Info className="w-8 h-8 text-slate-300" />
                            <p className="font-bold text-slate-600">لا توجد قوائم أسعار مطابقة للبحث</p>
                            <button
                              type="button"
                              onClick={() => {
                                setSearchQuery('');
                                setActiveFilter('ALL');
                              }}
                              className="text-amber-600 hover:underline text-xs"
                            >
                              إعادة ضبط الفلاتر
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredPriceLists.map((item, index) => {
                        const isSelected = selectedIds.includes(item.id);
                        return (
                          <tr
                            key={item.id}
                            onClick={() => isEditableToggle && handleOpenEdit(item)}
                            className={`hover:bg-amber-50/40 transition-colors cursor-pointer group ${
                              isSelected ? 'bg-amber-50/70' : ''
                            }`}
                          >
                            {/* # Index Number */}
                            <td className="p-3.5 text-center font-mono font-bold text-slate-400">
                              {index + 1}
                            </td>

                            {/* Checkbox */}
                            <td
                              className="p-3.5 text-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectItem(item.id)}
                                className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                              />
                            </td>

                            {/* رمز (Code) */}
                            <td className="p-3.5 font-bold font-mono text-slate-800">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => handleToggleFavorite(item.id, e)}
                                  className="text-slate-300 hover:text-amber-500 p-0.5"
                                  title={item.isFavorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
                                >
                                  <Star
                                    className={`w-3.5 h-3.5 ${
                                      item.isFavorite ? 'fill-amber-400 text-amber-400' : ''
                                    }`}
                                  />
                                </button>
                                <span>{item.code}</span>
                              </div>
                            </td>

                            {/* الاسم (Name) */}
                            <td className="p-3.5">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-extrabold text-slate-900 group-hover:text-amber-600 transition-colors">
                                    {item.name}
                                  </span>
                                  {item.isDefault && (
                                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full border border-emerald-300">
                                      افتراضي
                                    </span>
                                  )}
                                  {item.items && item.items.length > 0 && (
                                    <span className="text-[10px] bg-indigo-50 text-indigo-700 font-extrabold px-2 py-0.5 rounded-full border border-indigo-200">
                                      {item.items.length} بنود تسعير
                                    </span>
                                  )}
                                </div>
                                {item.notes && (
                                  <p className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                                    {item.notes}
                                  </p>
                                )}
                              </div>
                            </td>

                            {/* عمان (Amman Fee) */}
                            <td className="p-3.5 text-center">
                              <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                                {item.ammanPrice.toFixed(2)} د.أ
                              </span>
                            </td>

                            {/* المحافظات (Governorates Fee) */}
                            <td className="p-3.5 text-center">
                              <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                                {item.governoratesPrice.toFixed(2)} د.أ
                              </span>
                            </td>

                            {/* المرتجع (Return Fee) */}
                            <td className="p-3.5 text-center font-mono text-slate-600">
                              {item.returnFee.toFixed(2)} د.أ
                            </td>

                            {/* المتاجر المرتبطة (Assigned Merchants) */}
                            <td className="p-3.5 text-center">
                              <span className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                                <Users className="w-3 h-3 text-slate-400" />
                                <span>{item.assignedMerchantsCount || 0}</span>
                              </span>
                            </td>

                            {/* الإجراءات (Actions) */}
                            <td
                              className="p-3.5 text-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(item)}
                                  className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                  title="تعديل تفاصيل قائمة الأسعار"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(`هل ترغب في حذف قائمة الأسعار "${item.name}"؟`)) {
                                      setPriceLists((prev) => prev.filter((p) => p.id !== item.id));
                                      showToast(`تم حذف قائمة الأسعار "${item.name}"`);
                                    }
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="حذف القائمة"
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

              {/* Table Footer / Pagination (Matching Screenshot 1 `< 14 / 1-14 >`) */}
              <div className="bg-slate-50 p-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span>إجمالي القوائم المسجلة:</span>
                  <span className="font-bold text-slate-900 font-mono">{priceLists.length}</span>
                  {selectedIds.length > 0 && (
                    <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md font-bold text-[11px]">
                      تم تحديد {selectedIds.length}
                    </span>
                  )}
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center gap-2 font-mono">
                  <button
                    type="button"
                    disabled
                    className="p-1 rounded bg-white border border-slate-200 text-slate-300 cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <span className="px-2 font-bold text-slate-700">
                    1-{filteredPriceLists.length} / {filteredPriceLists.length}
                  </span>
                  <button
                    type="button"
                    disabled
                    className="p-1 rounded bg-white border border-slate-200 text-slate-300 cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB B: إعدادات المناطق والمحافظات */}
        {activeSubTab === 'zones' && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
            <div>
              <h2 className="text-lg font-black text-slate-900">إعدادات المحافظات والمناطق اللوجستية</h2>
              <p className="text-xs text-slate-500">
                تحديد أسعار التوصيل القياسية للمحافظات ومناطق المملكة الافتراضية
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {GOVERNORATES.map((gov) => {
                const fee = STANDARD_DELIVERY_FEES[gov] || 3.0;
                return (
                  <div
                    key={gov}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">{gov}</h4>
                        <span className="text-[11px] text-slate-500">منطقة رئيسية</span>
                      </div>
                    </div>
                    <div className="text-left font-mono">
                      <span className="text-sm font-black text-slate-900">{fee.toFixed(2)}</span>
                      <span className="text-[10px] text-slate-500 mr-1">د.أ</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB C: إعدادات وهوية الشركة White-Label Branding */}
        {activeSubTab === 'company' && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6 max-w-3xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-amber-500" />
                  <span>هوية الشركة والعلامة التجارية (Company White-Label Branding)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  تطبيق اسم الشعار واسم الشركة تلقائياً على جميع حسابات ولوحات التحكم التابعة لنفس الشركة/الـ Tenant
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-[11px] font-bold border border-amber-200/60">
                Tenant Isolation Active
              </span>
            </div>

            {/* Logo Section */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
              <label className="block text-xs font-bold text-slate-800">
                شعار الشركة (Company Logo)
              </label>
              <p className="text-[11px] text-slate-500 -mt-2">
                الصيغ المدعومة: PNG, JPG, WEBP, SVG (الحد الأقصى: 5 ميجابايت). سيظهر الشعار في الهيدر، القائمة الجانبية، وبوالص الشحن.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                {/* Logo Preview Box */}
                <div className="w-32 h-24 rounded-xl border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center p-2 relative shrink-0 shadow-inner group">
                  {companyBranding.logoUrl ? (
                    <div className="w-full h-full flex items-center justify-center relative">
                      <img
                        src={companyBranding.logoUrl}
                        alt="Company Logo"
                        className="max-h-full max-w-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => setCompanyBranding((prev) => ({ ...prev, logoUrl: '' }))}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs shadow-md hover:bg-red-600 transition-colors cursor-pointer"
                        title="إزالة الشعار"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-center text-slate-400">
                      <ImageIcon className="w-8 h-8 mx-auto mb-1 text-slate-300" />
                      <span className="text-[10px] font-medium block">بلا شعار مخصص</span>
                    </div>
                  )}

                  {isLogoUploading && (
                    <div className="absolute inset-0 bg-white/90 backdrop-blur-xs rounded-xl flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
                    </div>
                  )}
                </div>

                {/* Upload & URL Controls */}
                <div className="flex-1 space-y-3 w-full">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      رفع ملف صورة الشعار
                    </label>
                    <div className="flex items-center gap-2">
                      <label className="flex-1 px-4 py-2 bg-white border border-slate-300 hover:border-amber-500 rounded-xl text-slate-700 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-all hover:bg-amber-50/30">
                        <Upload className="w-4 h-4 text-amber-500" />
                        <span>{isLogoUploading ? 'جاري رفع الشعار...' : 'اختيار صورة من الجهاز'}</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                          onChange={handleLogoFileChange}
                          disabled={isLogoUploading}
                          className="hidden"
                        />
                      </label>
                      {companyBranding.logoUrl && (
                        <button
                          type="button"
                          onClick={() => setCompanyBranding((prev) => ({ ...prev, logoUrl: '' }))}
                          className="px-3 py-2 border border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                        >
                          إلغاء الشعار
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      أو أدخل رابط الشعار المباشر (URL)
                    </label>
                    <input
                      type="url"
                      placeholder="https://example.com/logo.png"
                      value={companyBranding.logoUrl}
                      onChange={(e) =>
                        setCompanyBranding((prev) => ({ ...prev, logoUrl: e.target.value }))
                      }
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Company Info Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-800 mb-1">
                  اسم الشركة التجاري <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={companyBranding.companyName}
                  onChange={(e) =>
                    setCompanyBranding((prev) => ({ ...prev, companyName: e.target.value }))
                  }
                  placeholder="مثال: شركة دارجو اللوجستية"
                  className="w-full bg-slate-50 border border-slate-300 focus:bg-white rounded-xl p-2.5 text-slate-900 font-extrabold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم الهاتف وخدمة العملاء</label>
                <input
                  type="text"
                  value={companyBranding.phone || ''}
                  onChange={(e) =>
                    setCompanyBranding((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  className="w-full bg-slate-50 border border-slate-300 focus:bg-white rounded-xl p-2.5 text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الرقم الضريبي والوطني للشركة</label>
                <input
                  type="text"
                  value={companyBranding.taxId || ''}
                  onChange={(e) =>
                    setCompanyBranding((prev) => ({ ...prev, taxId: e.target.value }))
                  }
                  className="w-full bg-slate-50 border border-slate-300 focus:bg-white rounded-xl p-2.5 text-slate-900 font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">عنوان المقر والمستودع الرئيسي</label>
                <input
                  type="text"
                  value={companyBranding.address || ''}
                  onChange={(e) =>
                    setCompanyBranding((prev) => ({ ...prev, address: e.target.value }))
                  }
                  className="w-full bg-slate-50 border border-slate-300 focus:bg-white rounded-xl p-2.5 text-slate-900"
                />
              </div>
            </div>

            {/* Submit Action */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <span className="text-[11px] text-slate-400">
                سيتم تطبيق الشعار والاسم فوراً على لوحة التحكم وجميع مستخدمي الشركة التابعين.
              </span>

              <button
                type="button"
                onClick={handleSaveCompanyBranding}
                disabled={isBrandingSaving || isLogoUploading}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                {isBrandingSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري حفظ الهوية...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-slate-950" />
                    <span>حفظ وتطبيق الهوية الحالية</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* TAB D: إعدادات مدقق OTP والإشعارات */}
        {(activeSubTab === 'otp' || activeSubTab === 'notifications') && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6 max-w-3xl">
            <div>
              <h2 className="text-lg font-black text-slate-900">
                {activeSubTab === 'otp' ? 'إعدادات رمز التأكيد والتحقق OTP' : 'إعدادات وقوالب الإشعارات (SMS / WhatsApp)'}
              </h2>
              <p className="text-xs text-slate-500">
                التحكم بالرسائل النصية التلقائية عند استلام الشحنة، خروج السائق للتوصيل، ورقم OTP
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">إرسال كود OTP للمستلم عند خروج الطلبية للتوصيل</span>
                  <input type="checkbox" defaultChecked className="w-4 h-4 text-amber-600 rounded" />
                </div>
                <p className="text-[11px] text-slate-500">
                  يمنع السائق من إغلاق الشحنة كـ "تم التسليم" إلا بعد إدخال كود OTP المكون من 4 أرقام
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">إشعار التاجر التلقائي عند تحصيل مبالغ COD</span>
                  <input type="checkbox" defaultChecked className="w-4 h-4 text-amber-600 rounded" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB E: قائمة انتظار المهام ومراقبة الطلبات المتأخرة */}
        {(activeSubTab === 'tasks' || activeSubTab === 'late_orders' || activeSubTab === 'general') && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-lg font-black text-slate-900">
              {activeSubTab === 'tasks'
                ? 'قائمة انتظار المهام والعمليات الخلفية'
                : activeSubTab === 'late_orders'
                ? 'مراقبة الطلبات المتأخرة (SLA Monitor)'
                : 'الإعدادات العامة للنظام'}
            </h2>
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>جميع المهام والخدمات السحابية ومراقبة الـ SLA تعمل بكفاءة عالية وبدون تأخير</span>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: Create / Edit Price List (قائمة الأسعار) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-7xl max-h-[95vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            
            {/* Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm">
                    {editingItem ? `تعديل قائمة الأسعار: ${editingItem.name}` : 'إنشاء قائمة أسعار جديدة'}
                  </h3>
                  <p className="text-[11px] text-slate-400">تكوين أكثر من تسعيرة وبند توصيل داخل قائمة الأسعار الواحدة</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleSavePriceList} className="overflow-y-auto p-5 sm:p-6 space-y-6 text-xs bg-white text-slate-800 flex-1">
              
              {/* Header Details (Matching Screenshot): الاسم / رمز / تعيين كافتراضي */}
              <div className="space-y-3.5 bg-slate-50/50 p-4 rounded-xl border border-slate-200">
                
                {/* 1. الاسم */}
                <div className="flex flex-col items-end">
                  <label className="block font-extrabold text-slate-700 text-right mb-1 text-xs">
                    الاسم *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: تسعيرة المتاجر العادية، أو عمان 2 محافظات 3..."
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 font-bold focus:ring-2 focus:ring-amber-500 text-right transition-all"
                  />
                </div>

                {/* 2. رمز */}
                <div className="flex flex-col items-end">
                  <label className="block font-extrabold text-slate-700 text-right mb-1 text-xs">
                    رمز *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: 0000 أو COD-01..."
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full max-w-sm bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-mono font-bold focus:ring-2 focus:ring-amber-500 text-right transition-all"
                  />
                </div>

                {/* 3. تعيين كافتراضي (Green bordered checkbox matching screenshot) */}
                <div className="flex items-center justify-end gap-2.5 pt-1">
                  <label htmlFor="is-default-check" className="font-extrabold text-slate-800 cursor-pointer select-none">
                    تعيين كافتراضي
                  </label>
                  <input
                    type="checkbox"
                    id="is-default-check"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                    className="w-5 h-5 rounded border-2 border-emerald-500 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                  />
                </div>
              </div>

              {/* عناصر قائمة الأسعار Table */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm text-slate-900">
                    عناصر قائمة الأسعار
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    (تحديد أكثر من تسعيرة جغرافية ونوع طلبية ضمن هذه القائمة)
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-xs bg-white">
                  <table className="w-full text-right text-xs border-collapse">
                    <thead className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold select-none">
                      <tr>
                        <th className="p-2.5 text-center font-mono w-10 text-slate-400">#</th>
                        <th className="p-2.5 min-w-[130px]">من المنطقة</th>
                        <th className="p-2.5 min-w-[130px]">من منطقة فرعية</th>
                        <th className="p-2.5 min-w-[130px]">إلى المنطقة</th>
                        <th className="p-2.5 min-w-[130px]">المنطقة الفرعية</th>
                        <th className="p-2.5 min-w-[120px]">نوع الطلبية</th>
                        <th className="p-2.5 min-w-[90px] text-center">السعر (د.أ)</th>
                        <th className="p-2.5 min-w-[90px] text-center">خصم المرتجع</th>
                        <th className="p-2.5 min-w-[90px] text-center">مرتجع ثابت</th>
                        <th className="p-2.5 min-w-[105px] text-center">خصم تكلفة المندوب</th>
                        <th className="p-2.5 min-w-[115px] text-center">قيمة تكلفة المندوب الثابتة</th>
                        <th className="p-2.5 text-center w-20">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {/* إضافة بند Row Button (Matching Screenshot link) */}
                      <tr className="bg-slate-50/60 hover:bg-slate-100/70 transition-colors">
                        <td colSpan={12} className="p-2.5 text-right">
                          <button
                            type="button"
                            onClick={handleAddPriceItem}
                            className="text-indigo-600 hover:text-indigo-800 font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer py-1 px-2.5 rounded-lg hover:bg-indigo-50 transition-colors"
                          >
                            <Plus className="w-4 h-4 stroke-[2.5]" />
                            <span>إضافة بند</span>
                          </button>
                        </td>
                      </tr>

                      {/* Items Rows */}
                      {formData.items.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-amber-50/20 transition-colors">
                          <td className="p-2 text-center font-mono font-bold text-slate-400 text-xs">
                            {idx + 1}
                          </td>
                          <td className="p-1.5">
                            <select
                              value={item.fromRegion}
                              onChange={(e) => handleUpdatePriceItem(item.id, 'fromRegion', e.target.value)}
                              className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg p-1.5 font-bold text-slate-800 text-xs focus:ring-1 focus:ring-amber-500"
                            >
                              {JORDAN_REGIONS.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-1.5">
                            <select
                              value={item.fromSubRegion}
                              onChange={(e) => handleUpdatePriceItem(item.id, 'fromSubRegion', e.target.value)}
                              className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg p-1.5 text-slate-800 text-xs focus:ring-1 focus:ring-amber-500"
                            >
                              {JORDAN_SUB_REGIONS.map((sr) => (
                                <option key={sr} value={sr}>{sr}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-1.5">
                            <select
                              value={item.toRegion}
                              onChange={(e) => handleUpdatePriceItem(item.id, 'toRegion', e.target.value)}
                              className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg p-1.5 font-bold text-slate-800 text-xs focus:ring-1 focus:ring-amber-500"
                            >
                              {JORDAN_REGIONS.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-1.5">
                            <select
                              value={item.toSubRegion}
                              onChange={(e) => handleUpdatePriceItem(item.id, 'toSubRegion', e.target.value)}
                              className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg p-1.5 text-slate-800 text-xs focus:ring-1 focus:ring-amber-500"
                            >
                              {JORDAN_SUB_REGIONS.map((sr) => (
                                <option key={sr} value={sr}>{sr}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-1.5">
                            <select
                              value={item.orderType}
                              onChange={(e) => handleUpdatePriceItem(item.id, 'orderType', e.target.value)}
                              className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg p-1.5 font-bold text-slate-800 text-xs focus:ring-1 focus:ring-amber-500"
                            >
                              {ORDER_TYPES.map((ot) => (
                                <option key={ot} value={ot}>{ot}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-1.5 text-center">
                            <input
                              type="number"
                              step="0.25"
                              min="0"
                              value={item.price}
                              onChange={(e) => handleUpdatePriceItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                              className="w-20 bg-white border border-slate-200 rounded-lg p-1.5 font-mono font-bold text-slate-900 text-center text-xs focus:ring-1 focus:ring-amber-500"
                            />
                          </td>
                          <td className="p-1.5 text-center">
                            <input
                              type="number"
                              step="0.25"
                              min="0"
                              value={item.returnDiscount}
                              onChange={(e) => handleUpdatePriceItem(item.id, 'returnDiscount', parseFloat(e.target.value) || 0)}
                              className="w-16 bg-white border border-slate-200 rounded-lg p-1.5 font-mono text-slate-700 text-center text-xs focus:ring-1 focus:ring-amber-500"
                            />
                          </td>
                          <td className="p-1.5 text-center">
                            <input
                              type="number"
                              step="0.25"
                              min="0"
                              value={item.fixedReturn}
                              onChange={(e) => handleUpdatePriceItem(item.id, 'fixedReturn', parseFloat(e.target.value) || 0)}
                              className="w-16 bg-white border border-slate-200 rounded-lg p-1.5 font-mono text-slate-700 text-center text-xs focus:ring-1 focus:ring-amber-500"
                            />
                          </td>
                          <td className="p-1.5 text-center">
                            <input
                              type="number"
                              step="0.25"
                              min="0"
                              value={item.driverDiscount}
                              onChange={(e) => handleUpdatePriceItem(item.id, 'driverDiscount', parseFloat(e.target.value) || 0)}
                              className="w-16 bg-white border border-slate-200 rounded-lg p-1.5 font-mono text-slate-700 text-center text-xs focus:ring-1 focus:ring-amber-500"
                            />
                          </td>
                          <td className="p-1.5 text-center">
                            <input
                              type="number"
                              step="0.25"
                              min="0"
                              value={item.fixedDriverCost}
                              onChange={(e) => handleUpdatePriceItem(item.id, 'fixedDriverCost', parseFloat(e.target.value) || 0)}
                              className="w-20 bg-white border border-slate-200 rounded-lg p-1.5 font-mono text-slate-700 text-center text-xs focus:ring-1 focus:ring-amber-500"
                            />
                          </td>
                          <td className="p-1.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDuplicatePriceItem(item)}
                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                                title="نسخ هذا البند"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemovePriceItem(item.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                title="حذف هذا البند"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* خدمات (Services) Section (Matching Screenshot) */}
              <div className="pt-2">
                <div className="inline-block">
                  <div className="bg-slate-800 text-white font-extrabold text-xs px-5 py-2 rounded-t-xl shadow-xs">
                    الخدمات
                  </div>
                </div>
                <div className="p-4 bg-slate-50 rounded-b-2xl rounded-tl-2xl border border-slate-200 space-y-2">
                  <div className="flex flex-col items-end">
                    <label className="block font-extrabold text-slate-700 text-right mb-1 text-xs">
                      الخدمات
                    </label>
                    <select
                      value={formData.selectedService}
                      onChange={(e) => setFormData({ ...formData, selectedService: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-amber-500 cursor-pointer text-right"
                    >
                      {AVAILABLE_SERVICES.map((srv) => (
                        <option key={srv} value={srv}>{srv}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* ملاحظات وعقود */}
              <div>
                <label className="block font-extrabold text-slate-700 mb-1 text-xs text-right">
                  ملاحظات أو اسم المتجر المخصص له العقد
                </label>
                <textarea
                  rows={2}
                  placeholder="ملاحظات توضيحية حول هذه التسعيرة أو اسم التاجر المخصص له..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:ring-2 focus:ring-amber-500 focus:bg-white resize-none text-xs text-right"
                />
              </div>

              {/* Favorite checkbox */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="fav-check"
                  checked={formData.isFavorite}
                  onChange={(e) => setFormData({ ...formData, isFavorite: e.target.checked })}
                  className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                />
                <label htmlFor="fav-check" className="font-bold text-slate-700 cursor-pointer text-xs">
                  تثبيت في القوائم المفضلة الأكثر استخداماً
                </label>
              </div>

              {/* Actions Footer */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-5 py-2.5 text-slate-600 hover:text-slate-800 font-bold cursor-pointer rounded-xl hover:bg-slate-100 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-7 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-xl shadow-md transition-all cursor-pointer select-none active:scale-95"
                >
                  {editingItem ? 'حفظ التعديلات' : 'إنشاء قائمة الأسعار'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

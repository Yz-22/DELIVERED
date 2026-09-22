import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  PackageCheck,
  Scan,
  Truck,
  Printer,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Layers,
  MapPin,
  Barcode,
  Calendar,
  Filter,
  RefreshCw,
  Plus,
  Lock,
  FileText,
  UserCheck,
  Check,
  X,
  ChevronRight,
  ChevronDown,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  Send,
  Sparkles,
} from 'lucide-react';
import { Order, User } from '../types/logistics';
import { formatCurrency, formatDate } from '../utils/logisticsHelpers';
import { useI18n } from '../lib/i18n';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { StatusBadge } from './ui/StatusBadge';
import { Skeleton } from './ui/Skeleton';
import { EmptyState } from './ui/EmptyState';
import { PriorityIndicator } from './ui/PriorityIndicator';

interface Facility {
  id: string;
  facility_code: string;
  name: string;
  facility_type: string;
  city: string;
  area?: string;
  address?: string;
  is_active: boolean;
}

interface OperationalQueueResponse {
  facilityId: string;
  tenantId: string;
  counts: {
    incoming: number;
    receivedInCustody: number;
    readyForDispatch: number;
    exceptions: number;
    activeManifests: number;
  };
  incomingQueue: any[];
  receivedQueue: any[];
  sortingQueue: Record<string, any[]>;
  outgoingQueue: any[];
  exceptionsQueue: any[];
  recentManifests: any[];
}

interface Manifest {
  id: string;
  manifest_number: string;
  manifest_type: string;
  status: 'DRAFT' | 'SEALED' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';
  source_facility_id?: string;
  destination_facility_id?: string;
  assigned_driver_id?: string;
  seal_number?: string;
  total_items?: number;
  total_weight_kg?: number;
  created_at: string;
  sealed_at?: string;
  items?: any[];
}

interface HubOperationsWorkspaceProps {
  orders?: Order[];
  drivers?: User[];
  onOpenScanner?: () => void;
  onOpenWaybill?: (order: Order) => void;
  onOpenWaybillBatch?: (orders: Order[]) => void;
}

export const HubOperationsWorkspace: React.FC<HubOperationsWorkspaceProps> = ({
  orders = [],
  drivers = [],
  onOpenScanner,
  onOpenWaybill,
  onOpenWaybillBatch,
}) => {
  const { t, direction } = useI18n();

  // Facility Selection
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('');
  const [isLoadingFacilities, setIsLoadingFacilities] = useState<boolean>(true);

  // Operational Queue State
  const [queueData, setQueueData] = useState<OperationalQueueResponse | null>(null);
  const [isLoadingQueue, setIsLoadingQueue] = useState<boolean>(false);
  const [queueError, setQueueError] = useState<string | null>(null);

  // Active Workspace Tab
  const [activeTab, setActiveTab] = useState<'INBOUND' | 'SORTING' | 'MANIFESTS' | 'DISPATCH' | 'EXCEPTIONS'>('INBOUND');

  // Fast Inbound Receiving State
  const [inboundScanInput, setInboundScanInput] = useState('');
  const [inboundIsProcessing, setInboundIsProcessing] = useState(false);
  const [inboundLastResult, setInboundLastResult] = useState<{
    success: boolean;
    barcode: string;
    message: string;
    timestamp: Date;
  } | null>(null);
  const inboundInputRef = useRef<HTMLInputElement>(null);

  // Manifest Workspace State
  const [manifests, setManifests] = useState<Manifest[]>([]);
  const [selectedManifest, setSelectedManifest] = useState<Manifest | null>(null);
  const [isLoadingManifest, setIsLoadingManifest] = useState(false);
  const [isCreateManifestOpen, setIsCreateManifestOpen] = useState(false);
  const [newManifestType, setNewManifestType] = useState<string>('DRIVER_RUNSHEET');
  const [newManifestDestFacility, setNewManifestDestFacility] = useState<string>('');
  const [newManifestDriverId, setNewManifestDriverId] = useState<string>('');
  const [newManifestNotes, setNewManifestNotes] = useState<string>('');
  const [manifestScanInput, setManifestScanInput] = useState('');
  const [isAddingManifestItem, setIsAddingManifestItem] = useState(false);
  const [manifestScanError, setManifestScanError] = useState<string | null>(null);

  // Seal Modal State
  const [isSealModalOpen, setIsSealModalOpen] = useState(false);
  const [sealNumberInput, setSealNumberInput] = useState('');
  const [isSealing, setIsSealing] = useState(false);
  const [sealError, setSealError] = useState<string | null>(null);

  // Print Manifest Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Dispatch / Driver Handoff State
  const [dispatchDriverId, setDispatchDriverId] = useState<string>('');
  const [dispatchScanInput, setDispatchScanInput] = useState('');
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchLastResult, setDispatchLastResult] = useState<{
    success: boolean;
    barcode: string;
    message: string;
    timestamp: Date;
  } | null>(null);

  // Filter & Search
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedZoneFilter, setSelectedZoneFilter] = useState('ALL');

  // Load facilities on mount
  useEffect(() => {
    loadFacilities();
  }, []);

  // Reload queue when selected facility changes
  useEffect(() => {
    if (selectedFacilityId) {
      loadFacilityQueue(selectedFacilityId);
      loadManifests(selectedFacilityId);
    }
  }, [selectedFacilityId]);

  // Keep inbound scan input auto-focused when on INBOUND tab
  useEffect(() => {
    if (activeTab === 'INBOUND' && inboundInputRef.current) {
      inboundInputRef.current.focus();
    }
  }, [activeTab]);

  const loadFacilities = async () => {
    setIsLoadingFacilities(true);
    try {
      const res = await fetch('/api/operational/facilities');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setFacilities(data);
          setSelectedFacilityId(data[0].id);
        } else {
          // Fallback demo facility if database has no facilities
          const defaultFac: Facility = {
            id: 'fac-amman-hub-01',
            facility_code: 'AMM-HUB-01',
            name: 'مستودع عمان المركزي الرئيسي (Al-Muqabalain)',
            facility_type: 'HUB',
            city: 'عمان',
            area: 'المقابلين',
            address: 'شارع الحرية - مجمع المستودعات اللوجستية',
            is_active: true,
          };
          setFacilities([defaultFac]);
          setSelectedFacilityId(defaultFac.id);
        }
      } else {
        const defaultFac: Facility = {
          id: 'fac-amman-hub-01',
          facility_code: 'AMM-HUB-01',
          name: 'مستودع عمان المركزي الرئيسي',
          facility_type: 'HUB',
          city: 'عمان',
          is_active: true,
        };
        setFacilities([defaultFac]);
        setSelectedFacilityId(defaultFac.id);
      }
    } catch (err) {
      console.warn('Failed to load facilities from API:', err);
    } finally {
      setIsLoadingFacilities(false);
    }
  };

  const loadFacilityQueue = async (facilityId: string) => {
    setIsLoadingQueue(true);
    setQueueError(null);
    try {
      const res = await fetch(`/api/operational/facilities/${facilityId}/queue`);
      if (res.ok) {
        const data = await res.json();
        setQueueData(data);
      } else {
        const errData = await res.json().catch(() => ({}));
        setQueueError(errData.message || 'فشل في قراءة طابور عمليات المستودع');
      }
    } catch (err: any) {
      setQueueError(err.message || 'خطأ في الاتصال بالخادم');
    } finally {
      setIsLoadingQueue(false);
    }
  };

  const loadManifests = async (facilityId: string) => {
    try {
      const res = await fetch(`/api/operational/manifests?facilityId=${facilityId}`);
      if (res.ok) {
        const data = await res.json();
        setManifests(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn('Failed to load manifests:', err);
    }
  };

  const loadManifestDetails = async (manifestId: string) => {
    setIsLoadingManifest(true);
    try {
      const res = await fetch(`/api/operational/manifests/${manifestId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedManifest(data);
      }
    } catch (err) {
      console.warn('Failed to load manifest details:', err);
    } finally {
      setIsLoadingManifest(false);
    }
  };

  // --------------------------------------------------------------------------
  // INBOUND RECEIVING HANDLER (Step 2 API -> RPC execute_confirm_facility_intake)
  // --------------------------------------------------------------------------
  const handleFastInboundScan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const barcode = inboundScanInput.trim().toUpperCase();
    if (!barcode || inboundIsProcessing || !selectedFacilityId) return;

    setInboundIsProcessing(true);
    const idempotencyKey = `intake-${selectedFacilityId}-${barcode}-${Date.now()}`;

    try {
      // Step 2 API: POST /api/operational/intake
      const res = await fetch('/api/operational/intake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          facilityId: selectedFacilityId,
          evidenceBarcode: barcode,
          // If the scanned string is directly an order sequence or ID, backend resolves the active leg
          shipmentId: barcode,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setInboundLastResult({
          success: true,
          barcode,
          message: `تم استلام الطرد بنجاح ونقل العهدة للمستودع (${data.shipmentSequence || barcode})`,
          timestamp: new Date(),
        });
        setInboundScanInput('');
        // Reload queues
        loadFacilityQueue(selectedFacilityId);
      } else {
        setInboundLastResult({
          success: false,
          barcode,
          message: data.message || data.error || 'فشل في استلام الطرد في المستودع',
          timestamp: new Date(),
        });
      }
    } catch (err: any) {
      setInboundLastResult({
        success: false,
        barcode,
        message: err.message || 'خطأ في الشبكة أثناء إرسال عملية الاستلام',
        timestamp: new Date(),
      });
    } finally {
      setInboundIsProcessing(false);
      setTimeout(() => {
        inboundInputRef.current?.focus();
      }, 50);
    }
  };

  // --------------------------------------------------------------------------
  // CREATE DRAFT MANIFEST
  // --------------------------------------------------------------------------
  const handleCreateManifest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFacilityId) return;

    try {
      const res = await fetch('/api/operational/manifests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manifestType: newManifestType,
          originFacilityId: selectedFacilityId,
          destinationFacilityId: newManifestDestFacility || undefined,
          assignedDriverId: newManifestDriverId || undefined,
          notes: newManifestNotes || undefined,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setIsCreateManifestOpen(false);
        setNewManifestNotes('');
        loadManifests(selectedFacilityId);
        loadManifestDetails(created.id);
      } else {
        const err = await res.json();
        alert(err.message || 'فشل إنشاء المنفست');
      }
    } catch (err: any) {
      alert(err.message || 'خطأ في إنشاء المنفست');
    }
  };

  // --------------------------------------------------------------------------
  // ADD ITEM TO DRAFT MANIFEST BY SCAN
  // --------------------------------------------------------------------------
  const handleAddManifestItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const barcode = manifestScanInput.trim().toUpperCase();
    if (!barcode || !selectedManifest || isAddingManifestItem) return;

    setIsAddingManifestItem(true);
    setManifestScanError(null);

    try {
      const res = await fetch(`/api/operational/manifests/${selectedManifest.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode }),
      });

      const data = await res.json();
      if (res.ok) {
        setManifestScanInput('');
        loadManifestDetails(selectedManifest.id);
      } else {
        setManifestScanError(data.message || 'فشل إضافة الطرد إلى المنفست');
      }
    } catch (err: any) {
      setManifestScanError(err.message || 'خطأ في الشبكة');
    } finally {
      setIsAddingManifestItem(false);
    }
  };

  // --------------------------------------------------------------------------
  // REMOVE ITEM FROM DRAFT MANIFEST
  // --------------------------------------------------------------------------
  const handleRemoveManifestItem = async (itemId: string) => {
    if (!selectedManifest) return;
    try {
      const res = await fetch(`/api/operational/manifests/${selectedManifest.id}/items/${itemId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        loadManifestDetails(selectedManifest.id);
      }
    } catch (err) {
      console.warn('Failed to remove manifest item:', err);
    }
  };

  // --------------------------------------------------------------------------
  // SEAL MANIFEST (Step 2 API -> RPC execute_seal_manifest)
  // --------------------------------------------------------------------------
  const handleSealManifest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedManifest || isSealing) return;

    setIsSealing(true);
    setSealError(null);

    try {
      const res = await fetch(`/api/operational/manifests/${selectedManifest.id}/seal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sealNumber: sealNumberInput.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsSealModalOpen(false);
        setSealNumberInput('');
        loadManifestDetails(selectedManifest.id);
        loadManifests(selectedFacilityId);
        loadFacilityQueue(selectedFacilityId);
      } else {
        setSealError(data.message || data.error || 'فشل إغلاق وتشميع المنفست');
      }
    } catch (err: any) {
      setSealError(err.message || 'خطأ في تشميع المنفست');
    } finally {
      setIsSealing(false);
    }
  };

  // --------------------------------------------------------------------------
  // DISPATCH / DRIVER RELEASE (Step 2 API -> RPC execute_confirm_facility_release)
  // --------------------------------------------------------------------------
  const handleFastDispatchRelease = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const barcode = dispatchScanInput.trim().toUpperCase();
    if (!barcode || isDispatching || !selectedFacilityId || !dispatchDriverId) {
      if (!dispatchDriverId) {
        alert('يرجى تحديد الكابتن المستلم قبل مسح الطرود للإخراج');
      }
      return;
    }

    setIsDispatching(true);
    const idempotencyKey = `release-${selectedFacilityId}-${dispatchDriverId}-${barcode}-${Date.now()}`;

    try {
      const res = await fetch('/api/operational/release', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          facilityId: selectedFacilityId,
          targetDriverId: dispatchDriverId,
          evidenceBarcode: barcode,
          shipmentId: barcode,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setDispatchLastResult({
          success: true,
          barcode,
          message: `تم إخراج الطرد وتسليم العهدة للكابتن بنجاح (${data.shipmentSequence || barcode})`,
          timestamp: new Date(),
        });
        setDispatchScanInput('');
        loadFacilityQueue(selectedFacilityId);
      } else {
        setDispatchLastResult({
          success: false,
          barcode,
          message: data.message || data.error || 'فشل في إخراج الطرد للكابتن',
          timestamp: new Date(),
        });
      }
    } catch (err: any) {
      setDispatchLastResult({
        success: false,
        barcode,
        message: err.message || 'خطأ في الشبكة أثناء إخراج الطرد',
        timestamp: new Date(),
      });
    } finally {
      setIsDispatching(false);
    }
  };

  const currentFacility = facilities.find((f) => f.id === selectedFacilityId) || facilities[0];

  return (
    <div className="space-y-6 text-slate-100 min-h-screen pb-12" dir={direction} id="hub-operations-workspace">
      {/* 1. Header & Facility Context Bar */}
      <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-slate-100">{t.hub.title}</h1>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                Phase 3C Verified
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {t.hub.subtitle}
            </p>
          </div>
        </div>

        {/* Facility Picker & Quick Tools */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl">
            <MapPin className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-slate-400 font-bold">{t.hub.currentFacility}</span>
            <select
              value={selectedFacilityId}
              onChange={(e) => setSelectedFacilityId(e.target.value)}
              disabled={isLoadingFacilities}
              className="bg-transparent text-xs font-bold text-amber-300 border-none focus:ring-0 cursor-pointer"
            >
              {facilities.map((fac) => (
                <option key={fac.id} value={fac.id} className="bg-slate-900 text-slate-100">
                  {fac.name} ({fac.facility_code || fac.city})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => loadFacilityQueue(selectedFacilityId)}
            disabled={isLoadingQueue}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer border border-slate-700 min-h-[44px] min-w-[44px] flex items-center justify-center"
            title={t.hub.refresh}
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingQueue ? 'animate-spin text-amber-400' : ''}`} />
          </button>

          {onOpenScanner && (
            <button
              type="button"
              onClick={onOpenScanner}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-colors cursor-pointer min-h-[44px]"
            >
              <Scan className="w-4 h-4" />
              <span>{t.hub.scanAnythingBtn}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Facility Operational Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => setActiveTab('INBOUND')}
          className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between cursor-pointer min-h-[80px] ${
            activeTab === 'INBOUND'
              ? 'bg-amber-500/10 border-amber-500 text-amber-300 ring-2 ring-amber-500/30 shadow-md'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">{t.hub.tabInbound}</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-mono font-bold text-amber-400">
              {queueData?.counts.incoming ?? 0}
            </span>
            <span className="text-[11px] font-bold text-slate-500">{t.hub.parcelsCount}</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('SORTING')}
          className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between cursor-pointer min-h-[80px] ${
            activeTab === 'SORTING'
              ? 'bg-blue-500/10 border-blue-500 text-blue-300 ring-2 ring-blue-500/30 shadow-md'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">{t.hub.tabSorting}</span>
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-mono font-bold text-blue-400">
              {queueData?.counts.receivedInCustody ?? 0}
            </span>
            <span className="text-[11px] font-bold text-slate-500">{t.hub.parcelsCount}</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('MANIFESTS')}
          className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between cursor-pointer min-h-[80px] ${
            activeTab === 'MANIFESTS'
              ? 'bg-purple-500/10 border-purple-500 text-purple-300 ring-2 ring-purple-500/30 shadow-md'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">{t.hub.tabManifests}</span>
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400"></span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-mono font-bold text-purple-400">
              {queueData?.counts.activeManifests ?? manifests.length}
            </span>
            <span className="text-[11px] font-bold text-slate-500">{t.hub.tabManifests}</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('DISPATCH')}
          className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between cursor-pointer min-h-[80px] ${
            activeTab === 'DISPATCH'
              ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/30 shadow-md'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">{t.hub.tabDispatch}</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-mono font-bold text-emerald-400">
              {queueData?.counts.readyForDispatch ?? 0}
            </span>
            <span className="text-[11px] font-bold text-slate-500">{t.hub.readyCount}</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('EXCEPTIONS')}
          className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between cursor-pointer min-h-[80px] ${
            activeTab === 'EXCEPTIONS'
              ? 'bg-rose-500/10 border-rose-500 text-rose-300 ring-2 ring-rose-500/30 shadow-md'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">{t.hub.tabExceptions}</span>
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400"></span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-mono font-bold text-rose-400">
              {queueData?.counts.exceptions ?? 0}
            </span>
            <span className="text-[11px] font-bold text-slate-500">{t.hub.tabExceptions}</span>
          </div>
        </button>
      </div>

      {/* 3. Tab Contents */}

      {/* TAB 1: FAST INBOUND RECEIVING */}
      {activeTab === 'INBOUND' && (
        <div className="space-y-4">
          {/* Rapid Receiving Scan Bar */}
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-sm">
            <div className="max-w-3xl">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Barcode className="w-4 h-4 text-amber-400" />
                <span>{t.hub.fastIntakeTitle}</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {t.hub.fastIntakeSub}
              </p>

              <form onSubmit={handleFastInboundScan} className="mt-3 flex gap-2">
                <div className="relative flex-1">
                  <input
                    ref={inboundInputRef}
                    type="text"
                    value={inboundScanInput}
                    onChange={(e) => setInboundScanInput(e.target.value)}
                    placeholder={t.hub.scanInputPlaceholder}
                    disabled={inboundIsProcessing}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 pr-10 text-sm font-mono text-amber-300 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-all min-h-[44px]"
                  />
                  <Scan className="w-5 h-5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                </div>

                <button
                  type="submit"
                  disabled={inboundIsProcessing || !inboundScanInput.trim()}
                  className="px-6 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-md flex items-center gap-2 transition-colors cursor-pointer min-h-[44px]"
                >
                  {inboundIsProcessing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>{t.hub.confirmIntakeBtn}</span>
                </button>
              </form>

              {/* Feedback Alert */}
              {inboundLastResult && (
                <div
                  className={`mt-3 p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
                    inboundLastResult.success
                      ? 'bg-emerald-950/50 border-emerald-800 text-emerald-200'
                      : 'bg-rose-950/50 border-rose-800 text-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {inboundLastResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                    )}
                    <span>{inboundLastResult.message}</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400">
                    {inboundLastResult.timestamp.toLocaleTimeString('ar-JO')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Incoming Legs Table */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-100">{t.hub.expectedQueueTitle}</h3>
                <p className="text-xs text-slate-400">{t.hub.expectedQueueSub}</p>
              </div>
              <span className="text-xs font-bold bg-amber-500/10 text-amber-300 px-3 py-1 rounded-full border border-amber-500/30">
                {queueData?.incomingQueue?.length || 0} {t.hub.expectedCount}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold">
                  <tr>
                    <th className="p-3.5">{t.hub.colTracking}</th>
                    <th className="p-3.5">{t.hub.colSender}</th>
                    <th className="p-3.5">{t.hub.colRecipient}</th>
                    <th className="p-3.5">{t.hub.colRouteType}</th>
                    <th className="p-3.5">{t.hub.colLegStatus}</th>
                    <th className="p-3.5 text-center">{t.hub.colAction}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {!queueData?.incomingQueue || queueData.incomingQueue.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        {t.hub.noInbound}
                      </td>
                    </tr>
                  ) : (
                    queueData.incomingQueue.map((leg) => {
                      const shp = leg.shipment || {};
                      return (
                        <tr key={leg.id} className="hover:bg-slate-800/50 transition-colors">
                          <td className="p-3.5">
                            <span className="font-mono font-bold text-amber-400 text-sm">
                              {shp.sequence || leg.shipment_id?.slice(0, 8)}
                            </span>
                            {shp.barcode && (
                              <div className="text-[10px] text-slate-500 font-mono">{shp.barcode}</div>
                            )}
                          </td>
                          <td className="p-3.5">
                            <div className="font-bold text-slate-200">{shp.recipient_name || '—'}</div>
                            <div className="text-[11px] text-slate-400">{shp.destination_city || 'عمان'}</div>
                          </td>
                          <td className="p-3.5">
                            <div className="font-bold text-slate-200">{shp.recipient_phone || '—'}</div>
                            <div className="text-[11px] text-slate-400">{shp.recipient_address || '—'}</div>
                          </td>
                          <td className="p-3.5">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/30">
                              {leg.leg_type}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <StatusBadge status={leg.status || 'IN_TRANSIT'} size="sm" />
                          </td>
                          <td className="p-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setInboundScanInput(shp.sequence || shp.barcode || leg.shipment_id);
                                handleFastInboundScan();
                              }}
                              className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-xs rounded-lg transition-colors cursor-pointer min-h-[36px]"
                            >
                              {t.hub.confirmIntakeBtn}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SORTING & STAGING */}
      {activeTab === 'SORTING' && (
        <div className="space-y-4">
          <div className="bg-blue-950/40 border border-blue-800/80 p-4 rounded-2xl flex items-start gap-3 text-xs text-blue-200">
            <Layers className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm text-slate-100">{t.hub.sortingTitle}</div>
              <p className="mt-0.5 text-blue-300 leading-relaxed">
                {t.hub.sortingSub}
              </p>
            </div>
          </div>

          {/* Grouped Sorting Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(queueData?.sortingQueue || {}).length === 0 ? (
              <div className="col-span-full bg-slate-900 p-8 rounded-2xl border border-slate-800 text-center text-slate-500 text-xs">
                {t.hub.noSorting}
              </div>
            ) : (
              Object.entries(queueData?.sortingQueue || {}).map(([city, items]) => (
                <div key={city} className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-sm">
                  <div className="bg-slate-950 p-3.5 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-400" />
                      <span className="font-bold text-slate-100 text-sm">{city}</span>
                    </div>
                    <span className="text-xs font-mono font-bold bg-blue-500/10 text-blue-300 px-2.5 py-0.5 rounded-full border border-blue-500/30">
                      {items.length} {t.hub.parcelsCount}
                    </span>
                  </div>

                  <div className="p-3 max-h-64 overflow-y-auto divide-y divide-slate-800/60">
                    {items.map((custody) => {
                      const shp = custody.shipment || {};
                      return (
                        <div key={custody.id || custody.shipment_id} className="py-2.5 flex items-center justify-between text-xs">
                          <div>
                            <div className="font-mono font-bold text-amber-400">{shp.sequence || custody.shipment_id?.slice(0, 8)}</div>
                            <div className="text-[11px] text-slate-400">{shp.recipient_name || '—'}</div>
                          </div>
                          <div className="text-left">
                            <StatusBadge status={shp.status || 'IN_FACILITY'} size="sm" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: MANIFESTS WORKSPACE */}
      {activeTab === 'MANIFESTS' && (
        <div className="space-y-4">
          {/* Header Action */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-sm">
            <div>
              <h2 className="text-sm font-bold text-slate-100">{t.hub.manifestsTitle}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{t.hub.manifestsSub}</p>
            </div>

            <button
              type="button"
              onClick={() => setIsCreateManifestOpen(true)}
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-colors cursor-pointer min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              <span>{t.hub.createNewManifestBtn}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Manifest List Sidebar */}
            <div className="lg:col-span-1 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-sm">
              <div className="p-3.5 bg-slate-950 border-b border-slate-800 font-bold text-xs text-slate-300">
                {t.hub.manifestListTitle} ({manifests.length})
              </div>

              <div className="divide-y divide-slate-800/60 max-h-[500px] overflow-y-auto">
                {manifests.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-xs">{t.hub.noManifests}</div>
                ) : (
                  manifests.map((m) => {
                    const isSelected = selectedManifest?.id === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => loadManifestDetails(m.id)}
                        className={`w-full p-3.5 text-right transition-colors block cursor-pointer ${
                          isSelected ? 'bg-purple-500/10 border-r-4 border-purple-500' : 'hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-slate-100 text-xs">{m.manifest_number}</span>
                          <StatusBadge status={m.status} size="sm" />
                        </div>

                        <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400">
                          <span>{m.manifest_type}</span>
                          <span className="font-mono font-bold text-slate-300">{m.total_items || 0} {t.hub.parcelsCount}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Selected Manifest Detail Workspace */}
            <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-sm">
              {!selectedManifest ? (
                <div className="p-12 text-center text-slate-500 text-xs">
                  {t.hub.selectManifestPrompt}
                </div>
              ) : (
                <div className="p-5 space-y-4">
                  {/* Manifest Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold font-mono text-amber-400">
                          {selectedManifest.manifest_number}
                        </span>
                        <StatusBadge status={selectedManifest.status} size="sm" />
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex gap-3">
                        <span>نوع الكشف: {selectedManifest.manifest_type}</span>
                        {selectedManifest.seal_number && (
                          <span className="font-mono font-bold text-emerald-400">
                            رقم الختم: {selectedManifest.seal_number}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsPrintModalOpen(true)}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700 min-h-[44px]"
                      >
                        <Printer className="w-4 h-4" />
                        <span>{t.hub.printManifestBtn}</span>
                      </button>

                      {selectedManifest.status === 'DRAFT' && (
                        <button
                          type="button"
                          onClick={() => setIsSealModalOpen(true)}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
                        >
                          <Lock className="w-4 h-4" />
                          <span>{t.hub.sealManifestBtn}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Add Items Scan Bar (only if DRAFT) */}
                  {selectedManifest.status === 'DRAFT' && (
                    <form onSubmit={handleAddManifestItem} className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={manifestScanInput}
                          onChange={(e) => setManifestScanInput(e.target.value)}
                          placeholder={t.hub.scanToAddPlaceholder}
                          disabled={isAddingManifestItem}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 pr-9 text-xs font-mono text-amber-300 focus:outline-none focus:border-purple-500 min-h-[44px]"
                        />
                        <Scan className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                      </div>
                      <button
                        type="submit"
                        disabled={isAddingManifestItem || !manifestScanInput.trim()}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl disabled:opacity-50 flex items-center gap-1.5 min-h-[44px]"
                      >
                        {isAddingManifestItem ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                        <span>{t.hub.addBtn}</span>
                      </button>
                    </form>
                  )}

                  {manifestScanError && (
                    <div className="p-2.5 bg-rose-950/50 border border-rose-800 rounded-xl text-xs font-bold text-rose-200 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                      <span>{manifestScanError}</span>
                    </div>
                  )}

                  {/* Manifest Items Table */}
                  <div className="border border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                        <tr>
                          <th className="p-2.5">#</th>
                          <th className="p-2.5">الشحنة / المسار</th>
                          <th className="p-2.5">الحالة</th>
                          <th className="p-2.5">وقت المسح</th>
                          {selectedManifest.status === 'DRAFT' && <th className="p-2.5 text-center">إجراء</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {!selectedManifest.items || selectedManifest.items.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-6 text-center text-slate-500 text-xs">
                              {t.hub.noManifestItems}
                            </td>
                          </tr>
                        ) : (
                          selectedManifest.items.map((item, idx) => (
                            <tr key={item.id} className="hover:bg-slate-800/50">
                              <td className="p-2.5 font-mono text-slate-500">{idx + 1}</td>
                              <td className="p-2.5 font-mono font-bold text-slate-200">
                                {item.shipment_id?.slice(0, 10)}...
                              </td>
                              <td className="p-2.5">
                                <StatusBadge status={item.item_status} size="sm" />
                              </td>
                              <td className="p-2.5 text-[10px] text-slate-400 font-mono">
                                {item.scanned_at ? new Date(item.scanned_at).toLocaleTimeString('ar-JO') : '—'}
                              </td>
                              {selectedManifest.status === 'DRAFT' && (
                                <td className="p-2.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveManifestItem(item.id)}
                                    className="p-1 hover:bg-rose-900/50 text-rose-400 rounded transition-colors"
                                    title="حذف من المنفست"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DISPATCH & DRIVER HANDOFF */}
      {activeTab === 'DISPATCH' && (
        <div className="space-y-4">
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-sm">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-400" />
              <span>{t.hub.dispatchTitle}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {t.hub.dispatchSub}
            </p>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Driver Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">{t.hub.targetDriverLabel}</label>
                <select
                  value={dispatchDriverId}
                  onChange={(e) => setDispatchDriverId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-bold text-slate-100 focus:outline-none focus:border-emerald-500 min-h-[44px]"
                >
                  <option value="">{t.hub.selectDriverOption}</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id} className="bg-slate-900 text-slate-100">
                      {d.name} ({d.phone || d.city || 'كابتن'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Barcode Scan Input */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-300 mb-1">مسح باركود الشحنة للإخراج:</label>
                <form onSubmit={handleFastDispatchRelease} className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={dispatchScanInput}
                      onChange={(e) => setDispatchScanInput(e.target.value)}
                      placeholder={t.hub.scanDispatchPlaceholder}
                      disabled={isDispatching || !dispatchDriverId}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 pr-9 text-xs font-mono text-amber-300 focus:outline-none focus:border-emerald-500 min-h-[44px]"
                    />
                    <Scan className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>
                  <button
                    type="submit"
                    disabled={isDispatching || !dispatchScanInput.trim() || !dispatchDriverId}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
                  >
                    {isDispatching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    <span>{t.hub.confirmReleaseBtn}</span>
                  </button>
                </form>
              </div>
            </div>

            {/* Dispatch Result Alert */}
            {dispatchLastResult && (
              <div
                className={`mt-3 p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
                  dispatchLastResult.success
                    ? 'bg-emerald-950/50 border-emerald-800 text-emerald-200'
                    : 'bg-rose-950/50 border-rose-800 text-rose-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {dispatchLastResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                  )}
                  <span>{dispatchLastResult.message}</span>
                </div>
                <span className="font-mono text-[10px] text-slate-400">
                  {dispatchLastResult.timestamp.toLocaleTimeString('ar-JO')}
                </span>
              </div>
            )}
          </div>

          {/* Ready for Dispatch List */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100">{t.hub.readyDispatchTitle}</h3>
              <span className="text-xs font-bold bg-emerald-500/10 text-emerald-300 px-3 py-1 rounded-full border border-emerald-500/30">
                {queueData?.outgoingQueue?.length || 0} {t.hub.readyCount}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold">
                  <tr>
                    <th className="p-3.5">{t.hub.colTracking}</th>
                    <th className="p-3.5">{t.hub.colRecipient}</th>
                    <th className="p-3.5">{t.hub.colRouteType}</th>
                    <th className="p-3.5">{t.hub.colAction}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {!queueData?.outgoingQueue || queueData.outgoingQueue.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500">
                        {t.hub.noReadyDispatch}
                      </td>
                    </tr>
                  ) : (
                    queueData.outgoingQueue.map((leg) => {
                      const shp = leg.shipment || {};
                      return (
                        <tr key={leg.id} className="hover:bg-slate-800/50 transition-colors">
                          <td className="p-3.5 font-mono font-bold text-amber-400">
                            {shp.sequence || leg.shipment_id?.slice(0, 8)}
                          </td>
                          <td className="p-3.5">
                            <div className="font-bold text-slate-200">{shp.recipient_name || '—'}</div>
                            <div className="text-[11px] text-slate-400">{shp.destination_city || 'عمان'}</div>
                          </td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-300 border border-blue-500/30 rounded text-[10px] font-bold">
                              {leg.leg_type}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setDispatchScanInput(shp.sequence || shp.barcode || leg.shipment_id);
                                handleFastDispatchRelease();
                              }}
                              className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-xs rounded-lg transition-colors cursor-pointer min-h-[36px]"
                            >
                              {t.hub.handoverBtn}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: EXCEPTIONS */}
      {activeTab === 'EXCEPTIONS' && (
        <div className="space-y-4">
          <div className="bg-rose-950/40 border border-rose-800/80 p-4 rounded-2xl flex items-start gap-3 text-xs text-rose-200">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm text-slate-100">{t.hub.exceptionsTitle}</div>
              <p className="mt-0.5 text-rose-300">
                {t.hub.exceptionsSub}
              </p>
            </div>
          </div>

          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold">
                  <tr>
                    <th className="p-3.5">{t.hub.colTracking}</th>
                    <th className="p-3.5">{t.hub.colRecipient}</th>
                    <th className="p-3.5">{t.hub.colLegStatus}</th>
                    <th className="p-3.5">{t.hub.colRecommendedAction}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {!queueData?.exceptionsQueue || queueData.exceptionsQueue.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500">
                        {t.hub.noExceptions}
                      </td>
                    </tr>
                  ) : (
                    queueData.exceptionsQueue.map((item) => {
                      const shp = item.shipment || {};
                      return (
                        <tr key={item.id} className="hover:bg-slate-800/50">
                          <td className="p-3.5 font-mono font-bold text-rose-400">
                            {shp.sequence || item.shipment_id?.slice(0, 8)}
                          </td>
                          <td className="p-3.5">
                            <div className="font-bold text-slate-200">{shp.recipient_name || '—'}</div>
                            <div className="text-[11px] text-slate-400">{shp.destination_city || 'عمان'}</div>
                          </td>
                          <td className="p-3.5">
                            <StatusBadge status={shp.status || 'FAILED_DELIVERY'} size="sm" />
                          </td>
                          <td className="p-3.5 text-xs text-slate-300">
                            إعادة توجيه / إرجاع للمتجر (Reverse Logistics)
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE MANIFEST */}
      {isCreateManifestOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl text-right">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-slate-100 text-sm">{t.hub.createManifestModalTitle}</h3>
              <button
                type="button"
                onClick={() => setIsCreateManifestOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateManifest} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">{t.hub.manifestTypeLabel}</label>
                <select
                  value={newManifestType}
                  onChange={(e) => setNewManifestType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 font-bold text-slate-100 min-h-[44px]"
                >
                  <option value="DRIVER_RUNSHEET" className="bg-slate-900">{t.hub.driverRunsheetOpt}</option>
                  <option value="HUB_TRANSFER" className="bg-slate-900">{t.hub.hubTransferOpt}</option>
                  <option value="PICKUP" className="bg-slate-900">كشف استلام تاجر (PICKUP)</option>
                  <option value="RETURN" className="bg-slate-900">كشف مرتجعات (RETURN)</option>
                </select>
              </div>

              {newManifestType === 'HUB_TRANSFER' && (
                <div>
                  <label className="block font-bold text-slate-300 mb-1">{t.hub.destFacilityLabel}</label>
                  <select
                    value={newManifestDestFacility}
                    onChange={(e) => setNewManifestDestFacility(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 font-bold text-slate-100 min-h-[44px]"
                  >
                    <option value="" className="bg-slate-900">{t.hub.selectFacilityOption}</option>
                    {facilities
                      .filter((f) => f.id !== selectedFacilityId)
                      .map((f) => (
                        <option key={f.id} value={f.id} className="bg-slate-900">
                          {f.name} ({f.city})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-300 mb-1">{t.hub.targetDriverLabel}</label>
                <select
                  value={newManifestDriverId}
                  onChange={(e) => setNewManifestDriverId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 font-bold text-slate-100 min-h-[44px]"
                >
                  <option value="" className="bg-slate-900">{t.hub.selectDriverOption}</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id} className="bg-slate-900">
                      {d.name} ({d.city || 'كابتن'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">{t.hub.notesLabel}</label>
                <input
                  type="text"
                  value={newManifestNotes}
                  onChange={(e) => setNewManifestNotes(e.target.value)}
                  placeholder="ملاحظات المسار أو الحمولة..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 min-h-[44px]"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-colors min-h-[44px]"
                >
                  {t.hub.createBtn}
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreateManifestOpen(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-colors border border-slate-700 min-h-[44px]"
                >
                  {t.hub.cancelBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SEAL MANIFEST */}
      {isSealModalOpen && selectedManifest && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl text-right">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-slate-100 text-sm">{t.hub.sealModalTitle}</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSealModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              {t.hub.sealModalSub}
            </p>

            <form onSubmit={handleSealManifest} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">{t.hub.sealNumberLabel}</label>
                <input
                  type="text"
                  value={sealNumberInput}
                  onChange={(e) => setSealNumberInput(e.target.value)}
                  placeholder="SEAL-XXXX (اختياري - يولد تلقائياً إن ترك فارغاً)"
                  disabled={isSealing}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 font-mono text-amber-300 min-h-[44px]"
                />
              </div>

              {sealError && (
                <div className="p-2.5 bg-rose-950/50 border border-rose-800 rounded-xl text-xs font-bold text-rose-200">
                  {sealError}
                </div>
              )}

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isSealing}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 min-h-[44px]"
                >
                  {isSealing && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>{t.hub.confirmSealBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsSealModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-colors border border-slate-700 min-h-[44px]"
                >
                  {t.hub.cancelBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PRINTABLE MANIFEST */}
      {isPrintModalOpen && selectedManifest && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl text-right my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-slate-100 text-base">{t.hub.printModalTitle}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-amber-500 text-slate-950 text-xs font-bold rounded-lg cursor-pointer hover:bg-amber-400 transition-colors"
                >
                  {t.hub.printNowBtn}
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-200 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Content */}
            <div className="space-y-4 text-xs font-sans border p-5 rounded-xl border-slate-800 bg-slate-950">
              <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                <div>
                  <h4 className="font-bold text-lg text-amber-400">{t.hub.delivereLogisticsERP}</h4>
                  <p className="text-[11px] text-slate-400">{t.hub.subtitle}</p>
                </div>
                <div className="text-left font-mono">
                  <div className="font-bold text-sm text-slate-100">{selectedManifest.manifest_number}</div>
                  <div className="text-[10px] text-slate-500">{formatDate(selectedManifest.created_at)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900 p-3 rounded-lg border border-slate-800 text-[11px]">
                <div>
                  <span className="text-slate-400 block">{t.hub.manifestTypeLabel}</span>
                  <strong className="text-slate-100">{selectedManifest.manifest_type}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">الحالة:</span>
                  <strong className="text-slate-100">{selectedManifest.status}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">عدد الطرود:</span>
                  <strong className="font-mono text-slate-100">{selectedManifest.total_items || 0}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">{t.hub.sealNumberLabel}</span>
                  <strong className="font-mono text-emerald-400">{selectedManifest.seal_number || '—'}</strong>
                </div>
              </div>

              {/* Items List */}
              <table className="w-full text-right text-xs bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
                <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-2">#</th>
                    <th className="p-2">معرّف الشحنة</th>
                    <th className="p-2">الحالة</th>
                    <th className="p-2">تأكيد الاستلام</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {!selectedManifest.items || selectedManifest.items.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-500">{t.hub.noManifestItems}</td>
                    </tr>
                  ) : (
                    selectedManifest.items.map((it, idx) => (
                      <tr key={it.id}>
                        <td className="p-2 font-mono text-slate-500">{idx + 1}</td>
                        <td className="p-2 font-mono font-bold text-amber-400">{it.shipment_id}</td>
                        <td className="p-2">{it.item_status}</td>
                        <td className="p-2 border-r border-slate-800 text-center">[ ]</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-800 text-xs">
                <div className="border border-slate-800 p-3 rounded-lg min-h-[70px]">
                  <span className="text-slate-400 block font-bold">{t.hub.signatureFacility}</span>
                </div>
                <div className="border border-slate-800 p-3 rounded-lg min-h-[70px]">
                  <span className="text-slate-400 block font-bold">{t.hub.signatureDriver}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

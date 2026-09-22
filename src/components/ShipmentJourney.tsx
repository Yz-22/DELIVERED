import React from 'react';
import {
  Store,
  Building2,
  Truck,
  UserCheck,
  CheckCircle2,
  Clock,
  MapPin,
  ArrowLeft,
  ArrowRight,
  Info,
  PackageCheck,
} from 'lucide-react';
import { Order, OrderStatus } from '../types/logistics';
import { useI18n } from '../lib/i18n';

interface ShipmentJourneyProps {
  order: Order;
  userRole?: string;
}

export const ShipmentJourney: React.FC<ShipmentJourneyProps> = ({ order }) => {
  const { t, direction } = useI18n();
  const ArrowIcon = direction === 'rtl' ? ArrowLeft : ArrowRight;

  // Determine current operational responsibility / stage (Derived from order status & assignment)
  // CRITICAL: This is an operational visualization, NOT verified physical custody handoff evidence
  const getOperationalStage = (): { label: string; sub: string; icon: React.ReactNode; color: string } => {
    switch (order.status as OrderStatus) {
      case 'PENDING':
      case 'PICKING':
        return {
          label: order.merchant?.commercialName || order.merchant?.name || t.orders.journey.origin,
          sub: `${t.orders.merchant} (${order.merchant?.city || order.governorate})`,
          icon: <Store className="w-4 h-4" />,
          color: 'bg-amber-500/10 text-amber-800 border-amber-300',
        };
      case 'RECEIVED_AT_HUB':
        return {
          label: order.branchName || t.orders.journey.mainHubName,
          sub: t.orders.journey.sortingHub,
          icon: <Building2 className="w-4 h-4" />,
          color: 'bg-blue-500/10 text-blue-800 border-blue-300',
        };
      case 'OUT_FOR_DELIVERY':
      case 'POSTPONED':
        return {
          label: order.driver?.name ? `${t.orders.journey.assignedDriver}: ${order.driver.name}` : t.orders.journey.unassignedDriver,
          sub: order.driver?.phone || `${t.orders.driver} - ${order.governorate}`,
          icon: <Truck className="w-4 h-4" />,
          color: 'bg-indigo-500/10 text-indigo-800 border-indigo-300',
        };
      case 'DELIVERED':
        return {
          label: order.recipientName,
          sub: `${t.orders.journey.destination} (${order.governorate} - ${order.area})`,
          icon: <UserCheck className="w-4 h-4" />,
          color: 'bg-emerald-500/10 text-emerald-800 border-emerald-300',
        };
      case 'RETURNED':
        return {
          label: `${order.merchant?.commercialName || t.orders.merchant}`,
          sub: t.orders.journey.reverseLeg,
          icon: <PackageCheck className="w-4 h-4" />,
          color: 'bg-rose-500/10 text-rose-800 border-rose-300',
        };
      default:
        return {
          label: 'قيد المعالجة التشغيلية',
          sub: 'قسم العمليات اللوجستية',
          icon: <Clock className="w-4 h-4" />,
          color: 'bg-slate-500/10 text-slate-800 border-slate-300',
        };
    }
  };

  const stage = getOperationalStage();

  // Leg Status Helpers (derived from single-driver order status)
  const isPickupDone = ['RECEIVED_AT_HUB', 'OUT_FOR_DELIVERY', 'DELIVERED', 'POSTPONED'].includes(order.status);
  const isHubDone = ['OUT_FOR_DELIVERY', 'DELIVERED', 'POSTPONED'].includes(order.status);
  const isDeliveryDone = order.status === 'DELIVERED';

  return (
    <div className="space-y-4 font-sans">
      {/* Current Operational Stage Card (Custody Truth Conforming) */}
      <div className={`p-4 rounded-xl border ${stage.color} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-white shadow-2xs border border-current">
            {stage.icon}
          </div>
          <div>
            <div className="text-[10px] uppercase font-extrabold tracking-wider opacity-80">
              {t.orders.journey.currentCustody}
            </div>
            <div className="text-sm font-extrabold text-slate-900">{stage.label}</div>
            <div className="text-xs opacity-90">{stage.sub}</div>
          </div>
        </div>
        <div className="text-xs">
          <span className="inline-flex items-center gap-1 font-bold text-[11px] text-slate-600 bg-white/90 px-2 py-1 rounded border border-slate-200">
            <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>{t.orders.journey.unverifiedCustodyNotice}</span>
          </span>
        </div>
      </div>

      {/* Multi-Leg Journey Stepper (Clearly labeled as Operational Visualization) */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-amber-600" />
            {t.orders.journey.title}
          </h4>
          <span className="text-[10px] text-slate-500 font-mono">
            {t.orders.journey.visualJourneyNotice}
          </span>
        </div>

        <div className="space-y-3 relative">
          {/* Leg 1: Pickup / First Mile */}
          <div className="flex items-start gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
            <div className={`mt-0.5 p-1.5 rounded-full ${isPickupDone ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {isPickupDone ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
            </div>
            <div className="flex-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900">{t.orders.journey.firstMile}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isPickupDone ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {isPickupDone ? t.orders.journey.completedLeg : t.orders.journey.inProgressLeg}
                </span>
              </div>
              <div className="text-slate-600 mt-1 flex items-center gap-2">
                <span><strong>{t.orders.journey.origin}:</strong> {order.merchant?.commercialName || order.merchant?.name}</span>
                <ArrowIcon className="w-3 h-3 text-slate-400 shrink-0" />
                <span><strong>{t.orders.journey.sortingHub}:</strong> {order.branchName || t.orders.journey.mainHubName}</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                {t.orders.journey.assignedDriver}: {order.driver?.name || t.orders.journey.unassignedDriver}
              </div>
            </div>
          </div>

          {/* Leg 2: Sorting Hub Operations */}
          <div className="flex items-start gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
            <div className={`mt-0.5 p-1.5 rounded-full ${isHubDone ? 'bg-emerald-100 text-emerald-700' : isPickupDone ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'}`}>
              {isHubDone ? <CheckCircle2 className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
            </div>
            <div className="flex-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900">{t.orders.journey.sortingHub}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isHubDone ? 'bg-emerald-100 text-emerald-800' : isPickupDone ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                  {isHubDone ? t.orders.journey.completedLeg : isPickupDone ? t.orders.journey.inProgressLeg : t.orders.journey.pendingLeg}
                </span>
              </div>
              <div className="text-slate-600 mt-1">
                {t.orders.branch}: {order.branchName || t.orders.journey.mainHubName} {order.warehouseShelf ? `| [${order.warehouseShelf}]` : ''}
              </div>
            </div>
          </div>

          {/* Leg 3: Last Mile Delivery */}
          <div className="flex items-start gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
            <div className={`mt-0.5 p-1.5 rounded-full ${isDeliveryDone ? 'bg-emerald-100 text-emerald-700' : order.status === 'OUT_FOR_DELIVERY' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'}`}>
              {isDeliveryDone ? <CheckCircle2 className="w-4 h-4" /> : <Truck className="w-4 h-4" />}
            </div>
            <div className="flex-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900">{t.orders.journey.lastMile}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isDeliveryDone ? 'bg-emerald-100 text-emerald-800' : order.status === 'OUT_FOR_DELIVERY' ? 'bg-indigo-100 text-indigo-800 font-bold' : 'bg-slate-100 text-slate-600'}`}>
                  {isDeliveryDone ? t.orders.journey.completedLeg : order.status === 'OUT_FOR_DELIVERY' ? t.orders.journey.outForDeliveryLeg : t.orders.journey.pendingLeg}
                </span>
              </div>
              <div className="text-slate-600 mt-1 flex items-center gap-2">
                <span><strong>{t.orders.journey.assignedDriver}:</strong> {order.driver?.name || t.orders.journey.unassignedDriver}</span>
                <ArrowIcon className="w-3 h-3 text-slate-400 shrink-0" />
                <span><strong>{t.orders.journey.destination}:</strong> {order.recipientName} ({order.governorate} - {order.area})</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import {
  History,
  Clock,
  ShieldCheck,
  Truck,
  KeyRound,
} from 'lucide-react';
import { Order } from '../types/logistics';
import { STATUS_CONFIG, formatDate } from '../utils/logisticsHelpers';
import { useI18n } from '../lib/i18n';

interface ShipmentTimelineProps {
  order: Order;
}

export const ShipmentTimeline: React.FC<ShipmentTimelineProps> = ({ order }) => {
  const { t } = useI18n();
  const logs = order.statusLogs || [];

  return (
    <div className="space-y-4 font-sans">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
          <History className="w-4 h-4 text-amber-600" />
          {t.orders.timeline.title} ({logs.length} {t.orders.timeline.recordedEvents})
        </h4>
        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
          {t.orders.timeline.verifiedEventAudit}
        </span>
      </div>

      {logs.length === 0 ? (
        <div className="text-xs text-slate-500 py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
          {t.orders.timeline.noEvents}
        </div>
      ) : (
        <div className="relative border-r-2 border-slate-200 pr-5 mr-3 space-y-4">
          {logs.map((log, index) => {
            const cfg = STATUS_CONFIG[log.toStatus] || STATUS_CONFIG.PENDING;
            const isDeliveryEvent = log.toStatus === 'DELIVERED';
            const isOutForDeliveryEvent = log.toStatus === 'OUT_FOR_DELIVERY';

            return (
              <div key={log.id || index} className="relative group">
                {/* Timeline Dot */}
                <div className={`absolute -right-[27px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-2xs ${cfg.text.replace('text-', 'bg-')}`} />

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1 hover:border-amber-300 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                      {cfg.label}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {formatDate(log.createdAt)}
                    </span>
                  </div>

                  {log.note && (
                    <div className="text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100 font-medium">
                      {log.note}
                    </div>
                  )}

                  {/* Evidence / Actor Metadata - Strictly persisted evidence only */}
                  <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500 pt-1 font-mono">
                    {/* Only show OTP if actually verified during this delivery event */}
                    {order.otpVerified && isDeliveryEvent && (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        <KeyRound className="w-3 h-3" /> {t.orders.timeline.otpVerified}
                      </span>
                    )}

                    {/* Only show Signature if actually persisted during this delivery event */}
                    {order.recipientSignature && isDeliveryEvent && (
                      <span className="inline-flex items-center gap-1 text-indigo-700 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                        <ShieldCheck className="w-3 h-3" /> {t.orders.timeline.signed}
                      </span>
                    )}

                    {/* Only attribute to driver if the event specifically involved field delivery dispatch */}
                    {order.driver && (isOutForDeliveryEvent || isDeliveryEvent) && (
                      <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                        <Truck className="w-3 h-3 text-slate-400" /> {t.orders.timeline.assignedDriverLabel}: {order.driver.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

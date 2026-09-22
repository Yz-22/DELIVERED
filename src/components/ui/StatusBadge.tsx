import React from 'react';
import { OrderStatus } from '../../types/logistics';

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'brand' | 'purple';

export interface StatusBadgeProps {
  status?: OrderStatus | string;
  tone?: StatusTone;
  label?: string;
  dot?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  tone,
  label,
  dot = true,
  size = 'md',
  className = '',
}) => {
  // If specific semantic tone is requested directly
  const getToneConfig = (t: StatusTone) => {
    switch (t) {
      case 'success':
        return {
          bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          dot: 'bg-emerald-400',
        };
      case 'warning':
        return {
          bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          dot: 'bg-amber-400',
        };
      case 'danger':
        return {
          bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
          dot: 'bg-rose-400',
        };
      case 'info':
        return {
          bg: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
          dot: 'bg-sky-400',
        };
      case 'brand':
        return {
          bg: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
          dot: 'bg-amber-400',
        };
      case 'purple':
        return {
          bg: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
          dot: 'bg-purple-400',
        };
      case 'neutral':
      default:
        return {
          bg: 'bg-slate-800/80 text-slate-300 border-slate-700/60',
          dot: 'bg-slate-400',
        };
    }
  };

  // Backward-compatible OrderStatus / domain status mapper
  const getDomainStatusConfig = (st: string) => {
    switch (st) {
      case 'DELIVERED':
        return {
          label: 'تم التسليم',
          bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          dot: 'bg-emerald-400',
        };
      case 'OUT_FOR_DELIVERY':
        return {
          label: 'مع المندوب للتسليم',
          bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          dot: 'bg-amber-400 animate-pulse',
        };
      case 'DISPATCHED':
        return {
          label: 'تم الإرسال',
          bg: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
          dot: 'bg-blue-400',
        };
      case 'ASSIGNED':
        return {
          label: 'مُسند لسائق',
          bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
          dot: 'bg-indigo-400',
        };
      case 'IN_TRANSIT':
        return {
          label: 'في الطريق',
          bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
          dot: 'bg-cyan-400',
        };
      case 'RECEIVED_AT_HUB':
        return {
          label: 'تم الاستلام بالمركز',
          bg: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
          dot: 'bg-purple-400',
        };
      case 'SORTED':
        return {
          label: 'تم الفرز',
          bg: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
          dot: 'bg-violet-400',
        };
      case 'PENDING':
        return {
          label: 'قيد الانتظار',
          bg: 'bg-slate-800 text-slate-300 border-slate-700',
          dot: 'bg-slate-400',
        };
      case 'RETURNED':
        return {
          label: 'مرتجع للمتجر',
          bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
          dot: 'bg-rose-400',
        };
      case 'CANCELLED':
        return {
          label: 'ملغي',
          bg: 'bg-red-500/10 text-red-400 border-red-500/30',
          dot: 'bg-red-400',
        };
      case 'DELAYED':
        return {
          label: 'مؤجل',
          bg: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
          dot: 'bg-orange-400',
        };
      default:
        return {
          label: st || '',
          bg: 'bg-slate-800 text-slate-300 border-slate-700',
          dot: 'bg-slate-400',
        };
    }
  };

  let displayLabel = label;
  let bgClasses = '';
  let dotClasses = '';

  if (tone) {
    const config = getToneConfig(tone);
    bgClasses = config.bg;
    dotClasses = config.dot;
    displayLabel = label || status || '';
  } else if (status) {
    const config = getDomainStatusConfig(status);
    bgClasses = config.bg;
    dotClasses = config.dot;
    displayLabel = label || config.label;
  } else {
    const config = getToneConfig('neutral');
    bgClasses = config.bg;
    dotClasses = config.dot;
    displayLabel = label || '';
  }

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1 font-semibold',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-bold',
    lg: 'text-sm px-3 py-1.5 gap-2 font-bold',
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-full border ${bgClasses} ${sizeClasses} ${className} select-none whitespace-nowrap`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClasses}`} />}
      <span>{displayLabel}</span>
    </span>
  );
};

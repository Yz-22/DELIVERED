import React from 'react';
import { OrderStatus } from '../../types/logistics';

interface StatusBadgeProps {
  status: OrderStatus | string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  className = '',
  size = 'md',
}) => {
  const getStatusConfig = (st: string) => {
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
          label: st,
          bg: 'bg-slate-800 text-slate-300 border-slate-700',
          dot: 'bg-slate-400',
        };
    }
  };

  const config = getStatusConfig(status);

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1 font-semibold',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-bold',
    lg: 'text-sm px-3 py-1.5 gap-2 font-bold',
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-full border ${config.bg} ${sizeClasses} ${className} select-none whitespace-nowrap`}
      dir="rtl"
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
      <span>{config.label}</span>
    </span>
  );
};

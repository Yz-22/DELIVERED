import React from 'react';

export type PriorityLevel = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | 'CRITICAL' | string;

export interface PriorityIndicatorProps {
  priority: PriorityLevel;
  size?: 'sm' | 'md';
  showDot?: boolean;
  className?: string;
}

export const PriorityIndicator: React.FC<PriorityIndicatorProps> = ({
  priority,
  size = 'md',
  showDot = true,
  className = '',
}) => {
  const norm = String(priority).toUpperCase();

  const getConfig = () => {
    switch (norm) {
      case 'CRITICAL':
        return {
          label: 'حرجة',
          bg: 'bg-red-500/15 text-red-400 border-red-500/40 font-bold',
          dot: 'bg-red-500 animate-pulse',
        };
      case 'URGENT':
        return {
          label: 'عاجلة',
          bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30 font-semibold',
          dot: 'bg-rose-400',
        };
      case 'HIGH':
        return {
          label: 'مرتفعة',
          bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30 font-semibold',
          dot: 'bg-amber-400',
        };
      case 'NORMAL':
        return {
          label: 'عادية',
          bg: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
          dot: 'bg-sky-400',
        };
      case 'LOW':
      default:
        return {
          label: 'منخفضة',
          bg: 'bg-slate-800 text-slate-400 border-slate-700/60',
          dot: 'bg-slate-500',
        };
    }
  };

  const config = getConfig();

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2 py-0.5 gap-1.5',
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-md border ${config.bg} ${sizeClasses} ${className} select-none whitespace-nowrap`}
    >
      {showDot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />}
      <span>{config.label}</span>
    </span>
  );
};

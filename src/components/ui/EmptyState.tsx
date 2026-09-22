import React, { ReactNode } from 'react';
import { PackageOpen, FilterX, AlertTriangle } from 'lucide-react';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: 'default' | 'filtered' | 'error';
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  variant = 'default',
  className = '',
}) => {
  const getDefaultIcon = () => {
    switch (variant) {
      case 'filtered':
        return <FilterX className="w-8 h-8 text-slate-500" aria-hidden="true" />;
      case 'error':
        return <AlertTriangle className="w-8 h-8 text-rose-400" aria-hidden="true" />;
      case 'default':
      default:
        return <PackageOpen className="w-8 h-8 text-slate-500" aria-hidden="true" />;
    }
  };

  const borderClass = {
    default: 'border-slate-800/80 bg-slate-900/40',
    filtered: 'border-slate-800/80 bg-slate-900/40',
    error: 'border-rose-500/20 bg-rose-500/5',
  }[variant];

  return (
    <div
      className={`flex flex-col items-center justify-center p-6 sm:p-8 text-center rounded-xl border border-dashed ${borderClass} ${className}`}
    >
      <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mb-3 text-slate-400">
        {icon || getDefaultIcon()}
      </div>

      <h3 className="text-sm sm:text-base font-bold text-slate-200 mb-1">{title}</h3>

      {description && (
        <p className="text-xs text-slate-400 max-w-sm mb-4 leading-relaxed">{description}</p>
      )}

      {action && <div className="mt-1">{action}</div>}
    </div>
  );
};

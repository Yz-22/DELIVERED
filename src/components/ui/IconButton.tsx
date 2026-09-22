import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { ButtonVariant, ButtonSize } from './Button';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  'aria-label': string;
  icon?: ReactNode;
  children?: ReactNode;
}

export const IconButton: React.FC<IconButtonProps> = ({
  variant = 'ghost',
  size = 'default',
  isLoading = false,
  'aria-label': ariaLabel,
  icon,
  children,
  disabled,
  type = 'button',
  className = '',
  ...rest
}) => {
  const isDisabled = disabled || isLoading;

  const baseClasses =
    'inline-flex items-center justify-center select-none transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 rounded-lg shrink-0';

  const sizeClasses: Record<ButtonSize, string> = {
    compact: 'w-8 h-8 text-xs',
    default: 'w-9 h-9 text-sm',
    large: 'w-10 h-10 text-base',
  };

  const variantClasses: Record<ButtonVariant, string> = {
    primary:
      'bg-amber-500 text-slate-950 hover:bg-amber-400 active:bg-amber-600 border border-amber-400/40 shadow-sm',
    secondary:
      'bg-slate-800 text-slate-200 hover:bg-slate-700/80 hover:text-white active:bg-slate-700 border border-slate-700/60',
    outline:
      'bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-white active:bg-slate-800 border border-slate-700',
    ghost:
      'bg-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-100 active:bg-slate-800 border border-transparent',
    danger:
      'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 active:bg-rose-500/30 border border-rose-500/30',
  };

  return (
    <button
      type={type}
      aria-label={ariaLabel}
      title={rest.title || ariaLabel}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={isLoading}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...rest}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
      ) : (
        icon || children
      )}
    </button>
  );
};

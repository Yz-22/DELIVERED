import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
export type ButtonSize = 'compact' | 'default' | 'large';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
  fullWidth?: boolean;
  children?: ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'default',
  isLoading = false,
  iconStart,
  iconEnd,
  fullWidth = false,
  disabled,
  type = 'button',
  className = '',
  children,
  ...rest
}) => {
  const isDisabled = disabled || isLoading;

  // Base styling: strict focus-visible, consistent transition, no default margin
  const baseClasses =
    'inline-flex items-center justify-center font-medium select-none transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 rounded-lg';

  // Size mapping (compact = 32px, default = 36px, large = 40px)
  const sizeClasses: Record<ButtonSize, string> = {
    compact: 'h-8 px-2.5 text-xs gap-1.5',
    default: 'h-9 px-3.5 text-xs sm:text-sm gap-2',
    large: 'h-10 px-4 text-sm gap-2.5',
  };

  // Variant mapping: restrained obsidian/slate palette with intentional amber accent
  const variantClasses: Record<ButtonVariant, string> = {
    primary:
      'bg-amber-500 text-slate-950 hover:bg-amber-400 active:bg-amber-600 font-bold border border-amber-400/40 shadow-sm',
    secondary:
      'bg-slate-800 text-slate-100 hover:bg-slate-700/80 active:bg-slate-700 border border-slate-700/60',
    outline:
      'bg-transparent text-slate-200 hover:bg-slate-800/60 active:bg-slate-800 border border-slate-700',
    ghost:
      'bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-white active:bg-slate-800 border border-transparent',
    danger:
      'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 active:bg-rose-500/30 border border-rose-500/30 font-semibold',
  };

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={isLoading}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${widthClass} ${className}`}
      {...rest}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
      ) : (
        iconStart && <span className="shrink-0 inline-flex items-center">{iconStart}</span>
      )}
      {children && <span className="truncate">{children}</span>}
      {!isLoading && iconEnd && (
        <span className="shrink-0 inline-flex items-center">{iconEnd}</span>
      )}
    </button>
  );
};

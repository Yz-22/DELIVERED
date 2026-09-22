import React, { InputHTMLAttributes, ReactNode, forwardRef, useId } from 'react';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  trailingAction?: ReactNode;
  mono?: boolean;
  sizeVariant?: 'compact' | 'default' | 'large';
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leadingIcon,
      trailingIcon,
      trailingAction,
      mono = false,
      sizeVariant = 'default',
      containerClassName = '',
      className = '',
      disabled,
      id: providedId,
      ...rest
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = providedId || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    // Size mappings
    const sizeClasses = {
      compact: 'h-8 text-xs py-1',
      default: 'h-9 text-xs sm:text-sm py-1.5',
      large: 'h-10 text-sm py-2',
    }[sizeVariant];

    // Padding mappings based on leading/trailing adornments
    const paddingClasses = `${leadingIcon ? 'ps-9' : 'ps-3'} ${
      trailingIcon || trailingAction ? 'pe-9' : 'pe-3'
    }`;

    const borderClass = error
      ? 'border-rose-500/60 focus-visible:ring-rose-500/40 focus-visible:border-rose-500'
      : 'border-slate-800 focus-visible:border-amber-500/60 focus-visible:ring-amber-500/40';

    return (
      <div className={`w-full flex flex-col gap-1.5 ${containerClassName}`}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-semibold text-slate-300 select-none flex items-center justify-between"
          >
            <span>{label}</span>
          </label>
        )}

        <div className="relative flex items-center w-full">
          {leadingIcon && (
            <div className="absolute start-3 flex items-center justify-center text-slate-400 pointer-events-none z-10 shrink-0">
              {leadingIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={`w-full bg-slate-900/90 text-slate-100 placeholder:text-slate-500 rounded-lg border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed ${mono ? 'font-mono tracking-wide' : ''} ${sizeClasses} ${paddingClasses} ${borderClass} ${className}`}
            {...rest}
          />

          {(trailingIcon || trailingAction) && (
            <div className="absolute end-2.5 flex items-center justify-center text-slate-400 z-10 shrink-0">
              {trailingAction || trailingIcon}
            </div>
          )}
        </div>

        {error ? (
          <p id={errorId} className="text-[11px] text-rose-400 font-medium leading-tight">
            {error}
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-[11px] text-slate-400 leading-tight">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';

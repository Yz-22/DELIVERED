import React, { SelectHTMLAttributes, ReactNode, forwardRef, useId } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: SelectOption[];
  sizeVariant?: 'compact' | 'default' | 'large';
  containerClassName?: string;
  children?: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      options,
      sizeVariant = 'default',
      containerClassName = '',
      className = '',
      disabled,
      id: providedId,
      children,
      ...rest
    },
    ref
  ) => {
    const generatedId = useId();
    const selectId = providedId || generatedId;
    const errorId = `${selectId}-error`;
    const helperId = `${selectId}-helper`;

    const sizeClasses = {
      compact: 'h-8 text-xs py-1',
      default: 'h-9 text-xs sm:text-sm py-1.5',
      large: 'h-10 text-sm py-2',
    }[sizeVariant];

    const borderClass = error
      ? 'border-rose-500/60 focus-visible:ring-rose-500/40 focus-visible:border-rose-500'
      : 'border-slate-800 focus-visible:border-amber-500/60 focus-visible:ring-amber-500/40';

    return (
      <div className={`w-full flex flex-col gap-1.5 ${containerClassName}`}>
        {label && (
          <label
            htmlFor={selectId}
            className="text-xs font-semibold text-slate-300 select-none flex items-center justify-between"
          >
            <span>{label}</span>
          </label>
        )}

        <div className="relative flex items-center w-full">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={`w-full appearance-none bg-slate-900/90 text-slate-100 rounded-lg border ps-3 pe-8 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${sizeClasses} ${borderClass} ${className}`}
            {...rest}
          >
            {options
              ? options.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.disabled}
                    className="bg-slate-900 text-slate-100"
                  >
                    {opt.label}
                  </option>
                ))
              : children}
          </select>

          <div className="absolute end-2.5 flex items-center justify-center text-slate-400 pointer-events-none z-10 shrink-0">
            <ChevronDown className="w-4 h-4" aria-hidden="true" />
          </div>
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

Select.displayName = 'Select';

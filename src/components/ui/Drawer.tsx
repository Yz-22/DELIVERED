import React, { useEffect, useRef, ReactNode, useId } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  side?: 'start' | 'end' | 'left' | 'right';
  closeOnEscape?: boolean;
  closeOnBackdropClick?: boolean;
  className?: string;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'md',
  side = 'end',
  closeOnEscape = true,
  closeOnBackdropClick = true,
  className = '',
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const subtitleId = useId();

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedElementRef.current = document.activeElement as HTMLElement | null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus drawer container
    drawerRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      if (previouslyFocusedElementRef.current && typeof previouslyFocusedElementRef.current.focus === 'function') {
        previouslyFocusedElementRef.current.focus();
      }
    };
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen) return null;

  const widthClasses = {
    sm: 'max-w-xs',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    full: 'max-w-full',
  }[width];

  // Map logical sides ('start' / 'end') and physical sides ('left' / 'right')
  const positionClasses = {
    end: 'end-0 inset-y-0',
    start: 'start-0 inset-y-0',
    left: 'left-0 inset-y-0',
    right: 'right-0 inset-y-0',
  }[side];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="presentation">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
        aria-hidden="true"
        onClick={closeOnBackdropClick ? onClose : undefined}
      />

      {/* Drawer Panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={subtitle ? subtitleId : undefined}
        tabIndex={-1}
        className={`fixed ${positionClasses} w-full ${widthClasses} bg-slate-900 border-x border-slate-800 shadow-2xl flex flex-col z-10 focus:outline-none ${className}`}
      >
        {/* Header */}
        {(title || subtitle) && (
          <div className="flex items-start justify-between p-4 sm:p-5 border-b border-slate-800/80 shrink-0 gap-3">
            <div className="flex flex-col gap-0.5">
              {title && (
                <h2 id={titleId} className="text-base sm:text-lg font-bold text-slate-100 leading-tight">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p id={subtitleId} className="text-xs text-slate-400 leading-relaxed">
                  {subtitle}
                </p>
              )}
            </div>
            <IconButton
              size="compact"
              variant="ghost"
              aria-label="إغلاق اللوحة"
              title="إغلاق (Esc)"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-100 shrink-0"
            >
              <X className="w-4 h-4" />
            </IconButton>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="p-3 sm:p-4 bg-slate-950/40 border-t border-slate-800/80 flex items-center justify-end gap-2 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

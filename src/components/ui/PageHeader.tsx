import React, { ReactNode } from 'react';

export interface PageHeaderBreadcrumb {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: PageHeaderBreadcrumb[];
  icon?: ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  badge,
  actions,
  breadcrumbs,
  icon,
  className = '',
}) => {
  return (
    <div
      className={`bg-slate-900/80 border-b border-slate-800/80 px-4 sm:px-6 py-3.5 sm:py-4 transition-all ${className}`}
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav
              className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-1"
              aria-label="مسار التنقل"
            >
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <span className="text-slate-600 select-none">/</span>}
                  {crumb.onClick ? (
                    <button
                      type="button"
                      onClick={crumb.onClick}
                      className="hover:text-amber-400 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 rounded px-0.5"
                    >
                      {crumb.label}
                    </button>
                  ) : (
                    <span
                      className={
                        idx === breadcrumbs.length - 1 ? 'text-slate-200 font-bold' : ''
                      }
                    >
                      {crumb.label}
                    </span>
                  )}
                </React.Fragment>
              ))}
            </nav>
          )}

          <div className="flex items-center gap-2.5 flex-wrap">
            {icon && <div className="text-amber-500 shrink-0">{icon}</div>}
            <h1 className="text-base sm:text-lg lg:text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
              <span>{title}</span>
            </h1>
            {badge && <div className="shrink-0">{badge}</div>}
          </div>

          {description && (
            <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-center pt-1 sm:pt-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

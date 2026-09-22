import React from 'react';
import { User } from '../../types/logistics';
import { AppSection } from '../TopNavbar';
import { getNavItemsForRole } from './navigationConfig';

export interface WorkspaceNavigationProps {
  activeSection: AppSection | null;
  onChangeSection: (section: AppSection) => void;
  currentUser?: User | null;
}

export const WorkspaceNavigation: React.FC<WorkspaceNavigationProps> = ({
  activeSection,
  onChangeSection,
  currentUser,
}) => {
  const navItems = getNavItemsForRole(currentUser?.role);

  if (!navItems.length) {
    return null;
  }

  return (
    <nav
      aria-label="التنقل بين مساحات العمل"
      className="bg-slate-900/80 border-b border-slate-800/80 hidden lg:block select-none"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-1.5 py-1.5 overflow-x-auto no-scrollbar scroll-smooth">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeSection(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`group px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all focus-ring cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
                title={item.description}
              >
                <Icon
                  className={`w-3.5 h-3.5 shrink-0 transition-transform group-hover:scale-105 ${
                    isActive ? 'text-slate-950' : 'text-slate-400 group-hover:text-amber-400'
                  }`}
                />
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${
                      isActive
                        ? 'bg-slate-950 text-amber-400'
                        : 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

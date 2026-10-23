import React from 'react';
import {
  LayoutDashboard,
  Layers,
  History,
  ShieldCheck,
  FileText
} from 'lucide-react';

interface BottomNavProps {
  currentTab: 'overview' | 'workspace' | 'privacy' | 'audit' | 'history';
  onSelectTab: (tab: 'overview' | 'workspace' | 'privacy' | 'audit' | 'history') => void;
  exceptionCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
  exceptionCount = 0,
}) => {
  const tabs = [
    {
      id: 'overview' as const,
      label: 'Overview',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'workspace' as const,
      label: 'Desk',
      icon: Layers,
      badge: exceptionCount > 0 ? exceptionCount : null,
    },
    {
      id: 'history' as const,
      label: 'History',
      icon: History,
      badge: null,
    },
    {
      id: 'privacy' as const,
      label: 'Privacy',
      icon: ShieldCheck,
      badge: null,
    },
    {
      id: 'audit' as const,
      label: 'Audit',
      icon: FileText,
      badge: null,
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#101A2B] border-t border-[#1C2C45] pb-safe shadow-lg select-none"
    >
      <div className="flex items-center justify-around h-14 px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center justify-center min-h-[48px] py-1 px-1 rounded-md transition-colors relative cursor-pointer ${
                isActive
                  ? 'text-[#D7FF56]'
                  : 'text-slate-400 hover:text-slate-200 active:text-white'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.2]' : 'stroke-[1.8]'}`} />
                {tab.badge !== null && (
                  <span className="absolute -top-1.5 -right-3 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold font-mono flex items-center justify-center border border-[#101A2B]">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-0.5 tracking-tight font-medium ${isActive ? 'font-bold' : ''}`}>
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute top-0 w-8 h-0.5 rounded-full bg-[#D7FF56]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};


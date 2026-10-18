import React from 'react';
import { 
  LayoutDashboard,
  Layers, 
  ShieldCheck, 
  FileText, 
  Cpu
} from 'lucide-react';

interface NavigationRailProps {
  currentTab: 'overview' | 'workspace' | 'privacy' | 'audit';
  onSelectTab: (tab: 'overview' | 'workspace' | 'privacy' | 'audit') => void;
  exceptionCount?: number;
  aiStatus: {
    configured: boolean;
    allowLiveAI: boolean;
    modelId: string;
    status: string;
  };
}

export const NavigationRail: React.FC<NavigationRailProps> = ({
  currentTab,
  onSelectTab,
  exceptionCount = 0,
  aiStatus,
}) => {
  return (
    <aside className="w-16 md:w-60 bg-[#101A2B] text-slate-200 flex flex-col justify-between border-r border-[#1C2C45] select-none shrink-0 transition-all duration-200">
      <div>
        <div className="h-16 flex items-center px-3 md:px-5 border-b border-[#1C2C45] gap-3">
          <img 
            src="/assets/proofledger-mark.svg" 
            alt="ProofLedger Mark" 
            className="w-8 h-8 shrink-0" 
          />
          <div className="hidden md:flex flex-col">
            <span className="font-bold text-white text-base tracking-tight flex items-center gap-1.5">
              ProofLedger
              <span className="bg-[#D7FF56] text-[#101A2B] text-[10px] font-mono px-1.5 py-0.5 rounded font-black tracking-wider">
                AI
              </span>
            </span>
            <span className="text-[11px] text-slate-400 font-medium">Reconciliation Desk</span>
          </div>
        </div>

        <nav className="p-2 md:p-3 space-y-1">
          <button
            type="button"
            onClick={() => onSelectTab('overview')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs md:text-sm font-medium transition-colors cursor-pointer ${
              currentTab === 'overview'
                ? 'bg-[#1C2D48] text-white font-semibold'
                : 'text-slate-300 hover:bg-[#16233B] hover:text-white'
            }`}
            title="Executive Overview"
          >
            <LayoutDashboard className="w-4 h-4 text-[#D7FF56]" />
            <span className="hidden md:inline">Overview</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('workspace')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs md:text-sm font-medium transition-colors cursor-pointer ${
              currentTab === 'workspace'
                ? 'bg-[#1C2D48] text-white font-semibold'
                : 'text-slate-300 hover:bg-[#16233B] hover:text-white'
            }`}
            title="Investigation Workspace"
          >
            <div className="flex items-center gap-3">
              <Layers className="w-4 h-4 text-sky-400" />
              <span className="hidden md:inline">Investigation Desk</span>
            </div>
            {exceptionCount > 0 && (
              <span className="hidden md:inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold font-mono bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-full">
                {exceptionCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('privacy')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs md:text-sm font-medium transition-colors cursor-pointer ${
              currentTab === 'privacy'
                ? 'bg-[#1C2D48] text-white font-semibold'
                : 'text-slate-300 hover:bg-[#16233B] hover:text-white'
            }`}
            title="Privacy & Data Boundary"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="hidden md:inline">Privacy Boundary</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('audit')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs md:text-sm font-medium transition-colors cursor-pointer ${
              currentTab === 'audit'
                ? 'bg-[#1C2D48] text-white font-semibold'
                : 'text-slate-300 hover:bg-[#16233B] hover:text-white'
            }`}
            title="Audit Log & History"
          >
            <FileText className="w-4 h-4 text-amber-400" />
            <span className="hidden md:inline">Audit Trail</span>
          </button>
        </nav>
      </div>

      <div className="p-3 border-t border-[#1C2C45] bg-[#0C1422]/60 text-[11px] text-slate-400">
        <div className="hidden md:block space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 font-medium">
              <Cpu className="w-3.5 h-3.5 text-slate-400" />
              Inference Node
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
              aiStatus.allowLiveAI && aiStatus.configured
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                : 'bg-amber-950 text-amber-300 border border-amber-800'
            }`}>
              {aiStatus.allowLiveAI && aiStatus.configured ? 'LIVE NEBIUS' : 'LOCAL ENGINE'}
            </span>
          </div>

          <div className="text-[10px] text-slate-400 font-mono truncate" title={aiStatus.modelId}>
            {aiStatus.modelId.replace('nvidia/', '')}
          </div>

          <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
            <span>Client Math</span>
            <span className="text-emerald-400 font-mono font-bold">100% Deterministic</span>
          </div>
        </div>

        <div className="md:hidden flex justify-center py-1">
          <div 
            className={`w-2.5 h-2.5 rounded-full ${
              aiStatus.allowLiveAI && aiStatus.configured ? 'bg-emerald-400' : 'bg-amber-400'
            }`} 
            title={aiStatus.status}
          />
        </div>
      </div>
    </aside>
  );
};

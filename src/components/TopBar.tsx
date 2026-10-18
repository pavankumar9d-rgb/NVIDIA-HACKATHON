import React from 'react';
import { 
  Play, 
  UploadCloud, 
  Sparkles, 
  RotateCcw, 
  Download,
  CheckCircle2
} from 'lucide-react';

interface TopBarProps {
  sessionName: string;
  isSynthetic: boolean;
  onLoadDemo: () => void;
  onOpenImport: () => void;
  onRunReconciliation: () => void;
  onOpenExport: () => void;
  onResetSession: () => void;
  hasData: boolean;
  isReconciled: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  sessionName,
  isSynthetic,
  onLoadDemo,
  onOpenImport,
  onRunReconciliation,
  onOpenExport,
  onResetSession,
  hasData,
  isReconciled,
}) => {
  return (
    <header className="h-16 bg-white border-b border-[#DDE3DA] px-4 md:px-6 flex items-center justify-between shrink-0 shadow-xs">
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base md:text-lg font-bold text-[#111827] tracking-tight">
              {sessionName}
            </h1>
            {isSynthetic && (
              <span className="bg-[#EEF1EB] text-[#4B5563] border border-[#CBD5C5] text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                Synthetic Fixture
              </span>
            )}
            {isReconciled && (
              <span className="bg-[#E8F5EE] text-[#17845B] border border-[#A7D7BC] text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-[#17845B]" />
                Reconciled
              </span>
            )}
          </div>
          <p className="text-[12px] text-[#6B7280]">
            Deterministic integer paise reconciliation with NVIDIA Nemotron investigation
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onLoadDemo}
          className="px-3 py-1.5 rounded-md border border-[#DDE3DA] bg-[#F6F7F2] hover:bg-[#EEF1EB] text-[#111827] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          title="Load 32-row synthetic scenario for Northstar Studio"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span className="hidden sm:inline">Load Demo Data</span>
        </button>

        <button
          type="button"
          onClick={onOpenImport}
          className="px-3 py-1.5 rounded-md border border-[#DDE3DA] bg-white hover:bg-[#F6F7F2] text-[#111827] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          title="Import Bank Statement CSV and Ledger CSV"
        >
          <UploadCloud className="w-3.5 h-3.5 text-[#2563EB]" />
          <span className="hidden sm:inline">Import CSVs</span>
        </button>

        {hasData && (
          <button
            type="button"
            onClick={onRunReconciliation}
            className="px-3.5 py-1.5 rounded-md bg-[#D7FF56] hover:bg-[#C9F540] text-[#111827] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs border border-[#BDDE3D]"
            title="Run deterministic 1-to-1 match algorithms"
          >
            <Play className="w-3.5 h-3.5 fill-[#111827]" />
            <span>Reconcile</span>
          </button>
        )}

        {isReconciled && (
          <button
            type="button"
            onClick={onOpenExport}
            className="px-3 py-1.5 rounded-md border border-[#DDE3DA] bg-white hover:bg-[#F6F7F2] text-[#111827] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Download audit package with formula-injection escaping"
          >
            <Download className="w-3.5 h-3.5 text-[#17845B]" />
            <span className="hidden sm:inline">Export Pack</span>
          </button>
        )}

        {hasData && (
          <button
            type="button"
            onClick={onResetSession}
            className="p-1.5 rounded-md border border-[#DDE3DA] hover:bg-rose-50 hover:text-rose-600 text-[#6B7280] transition-colors cursor-pointer"
            title="Reset active session (clears memory)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </header>
  );
};

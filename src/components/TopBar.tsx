import React from 'react';
import { 
  Play, 
  UploadCloud, 
  Sparkles, 
  RotateCcw, 
  Download,
  CheckCircle2,
  AlertCircle,
  Bookmark,
  LogOut
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import type { ReconciliationSummary } from '../lib/reconciliation';
import { getReconciliationAuditStatus } from '../lib/reconciliation/analytics';

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
  summary?: ReconciliationSummary | null;
  currentUser?: User | null;
  isSupabaseAvailable?: boolean;
  isAuthLoading?: boolean;
  authError?: string | null;
  onOpenSaveHistory?: () => void;
  onSignIn?: () => void;
  onSignOut?: () => void;
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
  summary = null,
  currentUser = null,
  isAuthLoading = false,
  onOpenSaveHistory,
  onSignIn,
  onSignOut,
}) => {
  const auditStatus = isReconciled ? getReconciliationAuditStatus(summary) : null;

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
            {auditStatus && auditStatus.status === 'REVIEW_REQUIRED' && (
              <span 
                className="bg-amber-50 text-amber-800 border border-amber-300 text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1"
                title={auditStatus.explanation}
              >
                <AlertCircle className="w-3 h-3 text-amber-600" />
                Review Required
              </span>
            )}
            {auditStatus && auditStatus.status === 'FULLY_RECONCILED' && (
              <span className="bg-[#E8F5EE] text-[#17845B] border border-[#A7D7BC] text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-[#17845B]" />
                Fully Reconciled
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

        {isReconciled && onOpenSaveHistory && (
          <button
            type="button"
            onClick={onOpenSaveHistory}
            className="px-3 py-1.5 rounded-md border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-900 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Save sanitized reconciliation snapshot to private cloud history (Requires consent)"
          >
            <Bookmark className="w-3.5 h-3.5 text-purple-600" />
            <span className="hidden sm:inline">Save to History</span>
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

        {currentUser ? (
          <div className="flex items-center gap-2 pl-2 border-l border-[#DDE3DA]">
            <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
              <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-[11px] border border-purple-300">
                {(currentUser.email?.[0] || 'U').toUpperCase()}
              </span>
              <span className="hidden lg:inline text-[11px] text-slate-600 max-w-[120px] truncate" title={currentUser.email}>
                {currentUser.email}
              </span>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              disabled={isAuthLoading}
              className="p-1.5 rounded-md border border-[#DDE3DA] hover:bg-slate-100 text-[#6B7280] transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 pl-2 border-l border-[#DDE3DA]">
            <span 
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200"
              title="Guest Mode is active. All reconciliations execute completely in-browser without remote persistence."
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Guest Mode
            </span>

            {onSignIn && (
              <button
                type="button"
                onClick={onSignIn}
                disabled={isAuthLoading}
                className="text-[11px] text-slate-500 hover:text-[#101A2B] hover:underline font-medium px-1 cursor-pointer transition-colors"
                title="Sign in with Google to enable private cloud history"
              >
                Sign In
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

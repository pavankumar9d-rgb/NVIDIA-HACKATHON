import React, { useState } from 'react';
import {
  Play,
  UploadCloud,
  Sparkles,
  RotateCcw,
  Download,
  CheckCircle2,
  AlertCircle,
  Bookmark,
  LogOut,
  UserX,
  HelpCircle,
  MoreVertical,
  X
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
  onOpenDeleteAccount?: () => void;
  onOpenGuide?: () => void;
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
  onOpenDeleteAccount,
  onOpenGuide,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const auditStatus = isReconciled ? getReconciliationAuditStatus(summary) : null;

  return (
    <>
      <header className="h-14 md:h-16 bg-white border-b border-[#DDE3DA] px-3 sm:px-4 md:px-6 flex items-center justify-between shrink-0 shadow-2xs z-20">
        {/* Left branding and title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {/* Mobile ProofLedger Mark */}
          <div className="md:hidden shrink-0">
            <img
              src="/assets/proofledger-mark.svg"
              alt="ProofLedger"
              className="w-7 h-7"
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base md:text-lg font-bold text-[#111827] tracking-tight truncate max-w-[150px] sm:max-w-[240px] md:max-w-none">
                {sessionName}
              </h1>

              {isSynthetic && (
                <span className="bg-[#EEF1EB] text-[#4B5563] border border-[#CBD5C5] text-[10px] sm:text-[11px] font-medium px-1.5 sm:px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span className="hidden xs:inline">Synthetic</span> Demo
                </span>
              )}

              {auditStatus && auditStatus.status === 'REVIEW_REQUIRED' && (
                <span
                  className="bg-amber-50 text-amber-800 border border-amber-300 text-[10px] sm:text-[11px] font-medium px-1.5 sm:px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0"
                  title={auditStatus.explanation}
                >
                  <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                  <span>Review</span>
                </span>
              )}

              {auditStatus && auditStatus.status === 'FULLY_RECONCILED' && (
                <span className="bg-[#E8F5EE] text-[#17845B] border border-[#A7D7BC] text-[10px] sm:text-[11px] font-medium px-1.5 sm:px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-[#17845B] shrink-0" />
                  <span>Reconciled</span>
                </span>
              )}
            </div>

            <p className="hidden md:block text-[12px] text-[#6B7280] truncate">
              Deterministic integer paise reconciliation with forensic exception investigation
            </p>
          </div>
        </div>

        {/* Mobile quick actions (< md) */}
        <div className="flex md:hidden items-center gap-1.5 shrink-0">
          {hasData && !isReconciled && (
            <button
              type="button"
              onClick={onRunReconciliation}
              className="px-3 py-1.5 min-h-[38px] rounded-lg bg-[#D7FF56] active:bg-[#C9F540] text-[#111827] text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs border border-[#BDDE3D]"
              aria-label="Reconcile Statements"
            >
              <Play className="w-3.5 h-3.5 fill-[#111827]" />
              <span>Reconcile</span>
            </button>
          )}

          {!hasData && (
            <button
              type="button"
              onClick={onOpenImport}
              className="px-2.5 py-1.5 min-h-[38px] rounded-lg border border-[#DDE3DA] bg-white active:bg-[#F6F7F2] text-[#111827] text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              aria-label="Import CSV Files"
            >
              <UploadCloud className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Import</span>
            </button>
          )}

          {isReconciled && (
            <button
              type="button"
              onClick={onOpenExport}
              className="px-2.5 py-1.5 min-h-[38px] rounded-lg border border-[#DDE3DA] bg-white active:bg-[#F6F7F2] text-[#111827] text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              aria-label="Export Reconciliation Pack"
            >
              <Download className="w-3.5 h-3.5 text-[#17845B]" />
              <span>Export</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 min-h-[44px] min-w-[44px] rounded-lg border border-[#DDE3DA] text-slate-700 active:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
            title="More Workspace Actions"
            aria-label="More Workspace Actions"
          >
            <MoreVertical className="w-5 h-5 text-slate-700" />
          </button>
        </div>

        {/* Desktop actions (>= md) */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onLoadDemo}
            className="px-3 py-1.5 rounded-md border border-[#DDE3DA] bg-[#F6F7F2] hover:bg-[#EEF1EB] text-[#111827] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            title="Load 32-row synthetic scenario for Northstar Studio"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Load Demo Data</span>
          </button>

          <button
            type="button"
            onClick={onOpenImport}
            className="px-3 py-1.5 rounded-md border border-[#DDE3DA] bg-white hover:bg-[#F6F7F2] text-[#111827] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Import Bank Statement CSV and Ledger CSV"
          >
            <UploadCloud className="w-3.5 h-3.5 text-[#2563EB]" />
            <span>Import CSVs</span>
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
              <span>Export Pack</span>
            </button>
          )}

          {isReconciled && currentUser && onOpenSaveHistory && (
            <button
              type="button"
              onClick={onOpenSaveHistory}
              className="px-3 py-1.5 rounded-md border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-900 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Save sanitized reconciliation snapshot to private cloud history (Requires consent)"
            >
              <Bookmark className="w-3.5 h-3.5 text-purple-600" />
              <span>Save to History</span>
            </button>
          )}

          {hasData && (
            <button
              type="button"
              onClick={onResetSession}
              className="p-1.5 rounded-md border border-[#DDE3DA] hover:bg-rose-50 hover:text-rose-600 text-[#6B7280] transition-colors cursor-pointer"
              title="Reset active session (clears memory)"
              aria-label="Reset active session"
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
              {onOpenDeleteAccount && (
                <button
                  type="button"
                  onClick={onOpenDeleteAccount}
                  className="p-1.5 rounded-md border border-rose-200 hover:bg-rose-50 text-rose-600 transition-colors cursor-pointer"
                  title="Account Settings & Permanent Deletion"
                  aria-label="Account Settings & Permanent Deletion"
                >
                  <UserX className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={onSignOut}
                disabled={isAuthLoading}
                className="p-1.5 rounded-md border border-[#DDE3DA] hover:bg-slate-100 text-[#6B7280] transition-colors cursor-pointer"
                title="Sign Out"
                aria-label="Sign Out"
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

          {onOpenGuide && (
            <button
              type="button"
              onClick={onOpenGuide}
              className="p-1.5 rounded-md border border-[#DDE3DA] hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              title="First-Use Workflow Guide"
              aria-label="First-Use Workflow Guide"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Mobile Actions Drawer / Sheet */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#101A2B]/60 backdrop-blur-xs flex flex-col justify-end md:hidden animate-in fade-in duration-150"
          role="dialog"
          aria-label="Workspace Actions Menu"
          aria-modal="true"
        >
          {/* Dismiss backdrop */}
          <div
            className="flex-1"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />

          <div className="bg-white rounded-t-2xl border-t border-[#DDE3DA] p-5 shadow-2xl max-h-[85vh] overflow-y-auto space-y-4 pb-safe animate-in slide-in-from-bottom duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#DDE3DA]">
              <div>
                <div className="text-sm font-bold text-[#111827]">{sessionName}</div>
                <div className="text-[11px] text-slate-500">Workspace Actions & Settings</div>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 min-h-[44px] min-w-[44px] rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                aria-label="Close Actions Menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Reconciliation Actions */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Reconciliation Actions
              </div>

              {hasData && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onRunReconciliation();
                  }}
                  className="w-full py-3 px-3.5 rounded-xl bg-[#D7FF56] active:bg-[#C9F540] text-[#111827] text-xs font-bold flex items-center justify-between transition-colors shadow-2xs border border-[#BDDE3D] min-h-[44px] cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Play className="w-4 h-4 fill-[#111827]" />
                    <span>Run Reconcile Algorithms</span>
                  </div>
                  <span className="text-[10px] font-mono uppercase bg-black/10 px-1.5 py-0.5 rounded">
                    Execute
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenImport();
                }}
                className="w-full py-2.5 px-3.5 rounded-xl border border-[#DDE3DA] bg-white active:bg-slate-50 text-[#111827] text-xs font-semibold flex items-center gap-2.5 transition-colors min-h-[44px] cursor-pointer"
              >
                <UploadCloud className="w-4 h-4 text-[#2563EB]" />
                <span>Import Bank & Ledger CSVs</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onLoadDemo();
                }}
                className="w-full py-2.5 px-3.5 rounded-xl border border-[#DDE3DA] bg-[#F6F7F2] active:bg-[#EEF1EB] text-[#111827] text-xs font-semibold flex items-center gap-2.5 transition-colors min-h-[44px] cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Load 32-Row Demo Scenario</span>
              </button>

              {isReconciled && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenExport();
                  }}
                  className="w-full py-2.5 px-3.5 rounded-xl border border-[#DDE3DA] bg-white active:bg-slate-50 text-[#111827] text-xs font-semibold flex items-center gap-2.5 transition-colors min-h-[44px] cursor-pointer"
                >
                  <Download className="w-4 h-4 text-[#17845B]" />
                  <span>Export Audit Package</span>
                </button>
              )}

              {isReconciled && currentUser && onOpenSaveHistory && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenSaveHistory();
                  }}
                  className="w-full py-2.5 px-3.5 rounded-xl border border-purple-200 bg-purple-50 active:bg-purple-100 text-purple-900 text-xs font-semibold flex items-center gap-2.5 transition-colors min-h-[44px] cursor-pointer"
                >
                  <Bookmark className="w-4 h-4 text-purple-600" />
                  <span>Save Snapshot to Private History</span>
                </button>
              )}

              {hasData && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onResetSession();
                  }}
                  className="w-full py-2.5 px-3.5 rounded-xl border border-rose-200 bg-rose-50/50 active:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-2.5 transition-colors min-h-[44px] cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 text-rose-600" />
                  <span>Reset Active Workspace</span>
                </button>
              )}
            </div>

            {/* Help & Account Section */}
            <div className="space-y-2 pt-2 border-t border-[#DDE3DA]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Support & Account
              </div>

              {onOpenGuide && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenGuide();
                  }}
                  className="w-full py-2.5 px-3.5 rounded-xl border border-[#DDE3DA] bg-white active:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-2.5 transition-colors min-h-[44px] cursor-pointer"
                >
                  <HelpCircle className="w-4 h-4 text-slate-500" />
                  <span>First-Use Workflow Guide</span>
                </button>
              )}

              {currentUser ? (
                <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-xs text-purple-950 font-medium">
                    <span className="w-6 h-6 rounded-full bg-purple-200 text-purple-800 flex items-center justify-center font-bold text-[11px]">
                      {(currentUser.email?.[0] || 'U').toUpperCase()}
                    </span>
                    <span className="truncate flex-1">{currentUser.email}</span>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-purple-200/60">
                    {onOpenDeleteAccount && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsMobileMenuOpen(false);
                          onOpenDeleteAccount();
                        }}
                        className="flex-1 py-2 px-2.5 rounded-lg border border-rose-200 bg-white active:bg-rose-50 text-rose-600 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors min-h-[40px] cursor-pointer"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span>Delete Account</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onSignOut?.();
                      }}
                      disabled={isAuthLoading}
                      className="flex-1 py-2 px-2.5 rounded-lg border border-[#DDE3DA] bg-white active:bg-slate-50 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors min-h-[40px] cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-xs font-semibold text-slate-700">Guest Mode</span>
                  </div>
                  {onSignIn && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onSignIn();
                      }}
                      disabled={isAuthLoading}
                      className="px-3 py-1.5 rounded-lg bg-[#101A2B] text-white text-xs font-bold cursor-pointer"
                    >
                      Sign In with Google
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

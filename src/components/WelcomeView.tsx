import { 
  UploadCloud, 
  Sparkles, 
  ShieldCheck, 
  Cpu, 
  Scale, 
  ArrowRight,
  FileSpreadsheet,
  Lock
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { GoogleIcon } from './GoogleIcon';

interface WelcomeViewProps {
  onOpenImport: () => void;
  onLoadDemo: () => void;
  currentUser?: User | null;
  onSignIn?: () => void;
  isAuthLoading?: boolean;
  isSupabaseAvailable?: boolean;
}

export const WelcomeView: React.FC<WelcomeViewProps> = ({
  onOpenImport,
  onLoadDemo,
  currentUser = null,
  onSignIn,
  isAuthLoading = false,
  isSupabaseAvailable = false,
}) => {
  return (
    <div className="flex-1 overflow-y-auto bg-[#F6F7F2] p-6 md:p-10 flex flex-col items-center justify-center min-h-[600px]">
      <div className="max-w-3xl w-full space-y-8 animate-in fade-in duration-300">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#101A2B] text-[#D7FF56] text-xs font-semibold shadow-xs">
            <span className="w-2 h-2 rounded-full bg-[#D7FF56] animate-pulse" />
            ProofLedger AI — Financial Reconciliation Desk
          </div>

          <h2 className="text-3xl md:text-4xl font-extrabold text-[#111827] tracking-tight">
            Deterministic Reconciliation with{' '}
            <span className="text-[#101A2B] bg-[#D7FF56]/40 px-2 py-0.5 rounded">
              Forensic AI
            </span>
          </h2>

          <p className="text-sm md:text-base text-slate-600 max-w-xl mx-auto leading-relaxed">
            Eliminate reconciliation headaches with integer-paise mathematical precision, zero floating-point drift, and privacy-first local client processing.
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          {/* Import Real CSVs */}
          <div className="bg-white border-2 border-[#101A2B] rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#101A2B] text-[#D7FF56] flex items-center justify-center">
                <UploadCloud className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#111827]">Import Your Own Statements</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Upload your Bank Statement CSV and General Ledger CSV. Automatically maps date, reference, debit/credit columns with preview validation.
              </p>
            </div>

            <div className="pt-6">
              <button
                type="button"
                onClick={onOpenImport}
                className="w-full py-2.5 px-4 rounded-xl bg-[#101A2B] hover:bg-[#1C2D48] text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs group-hover:gap-3"
              >
                <span>Import Bank + Ledger CSVs</span>
                <ArrowRight className="w-4 h-4 text-[#D7FF56]" />
              </button>
            </div>
          </div>

          {/* Load Synthetic Demo */}
          <div className="bg-white border border-[#DDE3DA] hover:border-amber-300 rounded-2xl p-6 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-[#111827]">Try Interactive Demo</h3>
                <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                  32 Rows
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Explore the synthetic Northstar Studio scenario with 25 confirmed 1-to-1 pairs and 5 realistic exceptions (timing differences, bank fees, and missing bills).
              </p>
            </div>

            <div className="pt-6">
              <button
                type="button"
                onClick={onLoadDemo}
                className="w-full py-2.5 px-4 rounded-xl bg-[#F6F7F2] hover:bg-[#EEF1EB] border border-[#CBD5C5] text-[#111827] font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-amber-600" />
                <span>Load Demo Scenario</span>
              </button>
            </div>
          </div>
        </div>

        {/* Authentication & Cloud Sync Card */}
        <div className="bg-white border border-[#DDE3DA] rounded-2xl p-5 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${currentUser ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'}`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-[#111827]">
                  {currentUser ? 'Private Cloud History Active' : 'Private Cloud History & Multi-Device Sync'}
                </h3>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${currentUser ? 'bg-[#E8F5EE] text-[#17845B] border border-[#A7D7BC]' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                  {currentUser ? 'Authenticated' : isSupabaseAvailable ? 'Cloud Sync Ready' : 'Guest Mode Active'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-1 leading-relaxed max-w-lg">
                {currentUser ? (
                  <>Signed in as <span className="font-semibold text-slate-800">{currentUser.email}</span>. Your audit snapshots are encrypted and protected by Supabase Row Level Security.</>
                ) : (
                  <>Save encrypted reconciliation snapshots across sessions. Account created automatically on first Google sign-in when enabled. Local guest mode is always 100% active without sign-in.</>
                )}
              </p>
            </div>
          </div>

          {!currentUser && onSignIn && (
            <div className="flex flex-col items-center sm:items-end shrink-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={onSignIn}
                disabled={isAuthLoading}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-[#111827] text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                title="Continue with Google. Account created automatically on first sign-in."
              >
                {isAuthLoading ? (
                  <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <GoogleIcon className="w-4 h-4" />
                )}
                <span>Continue with Google</span>
              </button>
              <span className="text-[9px] text-slate-400 mt-1 font-medium">
                Account created on first sign-in
              </span>
            </div>
          )}
        </div>

        {/* Value Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-[#DDE3DA]">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-white/70 border border-[#EEF1EB]">
            <Scale className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-[#111827]">100% Deterministic Math</h4>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                Integer-paise calculations prevent IEEE 754 float rounding errors. Audit-balanced bridge.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-white/70 border border-[#EEF1EB]">
            <Lock className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-[#111827]">Private & Isolated</h4>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                Guest sessions never persist to shared servers. Cloud history requires explicit user consent.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-white/70 border border-[#EEF1EB]">
            <Cpu className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-[#111827]">Nemotron Forensic AI</h4>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                NVIDIA Nemotron categorizes variances and proposes journal adjustments for human review.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

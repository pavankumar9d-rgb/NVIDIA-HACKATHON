import React from 'react';
import { Database, X, ShieldCheck, FileCode, ArrowRight } from 'lucide-react';

interface SetupRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SetupRequiredModal: React.FC<SetupRequiredModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        className="bg-white rounded-2xl max-w-lg w-full border border-[#DDE3DA] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-modal-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#DDE3DA] bg-[#F9FAF8] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 id="setup-modal-title" className="text-sm font-bold text-[#111827]">
                Supabase Setup Required
              </h2>
              <p className="text-[11px] text-slate-500">
                Google OAuth & Private Cloud History configuration
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 leading-relaxed">
            <span className="font-bold block mb-1">Authentication is not configured on this instance.</span>
            To enable Google OAuth and private cross-session history, add your free Supabase credentials to your environment.
          </div>

          <div className="space-y-2">
            <span className="font-bold text-[#111827] block">Quick Setup Steps:</span>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-600 pl-1 leading-relaxed">
              <li>Create a free project at <span className="font-mono text-purple-700 font-semibold">supabase.com</span> (zero cost, no billing required).</li>
              <li>Enable the Google provider in your Supabase Auth dashboard.</li>
              <li>Add your project keys to your local <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">.env</span> file:</li>
            </ol>

            <div className="bg-[#101A2B] text-slate-200 p-3 rounded-lg font-mono text-[11px] space-y-1 overflow-x-auto">
              <div className="text-slate-400"># Required for Google Sign-in & History</div>
              <div><span className="text-[#D7FF56]">VITE_SUPABASE_URL</span>=https://your-ref.supabase.co</div>
              <div><span className="text-[#D7FF56]">VITE_SUPABASE_ANON_KEY</span>=your-anon-public-key</div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-[#DDE3DA] bg-[#F9FAF8] space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Guest Mode is 100% Active</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              You do not need to sign in to use ProofLedger AI. All deterministic integer paise reconciliation, exception triage, and audit pack exports work completely in-browser.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#DDE3DA] bg-[#F9FAF8] flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
            <FileCode className="w-3.5 h-3.5" />
            See docs/SUPABASE_SETUP.md
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#101A2B] hover:bg-[#1C2C45] text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <span>Continue in Guest Mode</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#D7FF56]" />
          </button>
        </div>
      </div>
    </div>
  );
};

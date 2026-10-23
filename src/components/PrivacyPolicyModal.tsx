import React from 'react';
import { ShieldCheck, ArrowLeft, Lock, FileSpreadsheet, EyeOff, CheckCircle2 } from 'lucide-react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-policy-title"
    >
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-[#DDE3DA] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#DDE3DA] bg-[#F6F7F2] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 id="privacy-policy-title" className="text-base font-bold text-[#111827]">
                ProofLedger AI — Privacy Policy
              </h2>
              <span className="text-[11px] text-slate-500">Effective Date: October 2026 • Version 1.0</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-[#DDE3DA] hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            aria-label="Close Privacy Policy"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto text-xs text-slate-700 space-y-5 leading-relaxed">
          <section className="space-y-1.5">
            <h3 className="text-sm font-bold text-[#111827] flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-emerald-600" />
              1. Architecture & Data Handling Model
            </h3>
            <p>
              ProofLedger AI is an enterprise financial reconciliation assistant designed for accounting and finance professionals.
              The application is architected around <strong>data minimization and privacy-by-design</strong>.
            </p>
          </section>

          <section className="space-y-2 p-3.5 rounded-2xl bg-[#F6F7F2] border border-[#EEF1EB]">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-sky-600" />
              Guest Mode vs. Authenticated Mode
            </h4>
            <ul className="space-y-2 list-disc pl-5">
              <li>
                <strong>Guest Mode:</strong> Bank statement CSVs and general ledger CSVs are parsed and reconciled
                <strong> entirely inside client browser memory (volatile RAM)</strong> using PapaParse and deterministic integer math.
                Zero statement rows, raw transaction texts, or balances are stored in localStorage, IndexedDB, or server databases.
              </li>
              <li>
                <strong>Authenticated Mode (Google OAuth):</strong> Users may optionally sign in with Google to enable private cloud history.
                When a user explicitly chooses &quot;Save to History&quot;, a sanitized reconciliation snapshot is persisted to Supabase PostgreSQL,
                protected strictly by PostgreSQL Row Level Security (RLS) linked to the user&apos;s authenticated ID.
              </li>
            </ul>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-sm font-bold text-[#111827] flex items-center gap-1.5">
              <EyeOff className="w-4 h-4 text-amber-600" />
              2. Data Transmitted During AI Discrepancy Investigation
            </h3>
            <p>
              Core file reconciliation requires zero network calls. However, if a user opts to request an AI investigation on a flagged discrepancy:
            </p>
            <ul className="space-y-1 list-disc pl-5">
              <li>A single minimized exception payload is transmitted over HTTPS to our hosted Express gateway at <code>/api/investigate</code>.</li>
              <li>Transmitted fields include: exception ID, amount difference (INR), date variance (days), and masked transaction evidence.</li>
              <li>Automated regular expression masking is applied client-side and re-verified server-side to strip 16-digit cards, PAN cards, 12-digit Aadhaar numbers, bank account numbers, phone numbers, and emails.</li>
              <li><strong>Re-identification Notice:</strong> While explicit identifiers are masked, regex masking does not mathematically guarantee anonymity; unique transaction amounts or timing combinations could theoretically be correlated by parties with access to external financial records.</li>
            </ul>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-sm font-bold text-[#111827] flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-purple-600" />
              3. Cloud Infrastructure & Live AI Status
            </h3>
            <p>
              In the current production release, <strong>live cloud AI inference is disabled (<code>ALLOW_LIVE_AI=false</code>)</strong>.
              The gateway resolves investigations via deterministic local rules; <strong>zero financial data is transmitted to Nebius Token Factory or third-party AI models</strong>.
            </p>
            <p className="text-[11px] text-slate-500">
              Note: Network transport traverses cloud hosting infrastructure (Render, Cloudflare) which maintains standard operational connection logs (source IP, request path, timestamp) in accordance with infrastructure provider policies.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-sm font-bold text-[#111827]">
              4. Telemetry, Tracking & Third-Party Assets
            </h3>
            <p>
              ProofLedger AI employs <strong>zero analytics SDKs, zero advertising pixels, zero session replay software (Hotjar/FullStory), and zero external CDN font trackers</strong>.
              All fonts are native system typography.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-sm font-bold text-[#111827]">
              5. Account Deletion & Data Retention
            </h3>
            <p>
              Authenticated users have the right to permanently delete their account and associated cloud-saved reconciliation snapshots at any time via the Account Settings panel.
              Guest Mode sessions retain zero persistent data upon browser tab closure.
            </p>
          </section>

          <section className="space-y-1.5 pt-2 border-t border-slate-200 text-slate-500 text-[11px]">
            <p>
              For privacy inquiries regarding this open-source hackathon implementation, visit the official repository at{' '}
              <a
                href="https://github.com/pavankumar9d-rgb/ProofLedger-AI"
                target="_blank"
                rel="noreferrer noopener"
                className="text-[#101A2B] font-semibold underline"
              >
                GitHub: pavankumar9d-rgb/ProofLedger-AI
              </a>.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#DDE3DA] bg-[#F6F7F2] flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-5 rounded-xl bg-[#101A2B] hover:bg-[#1C2D48] text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};


import React from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Cpu, 
  AlertTriangle, 
  CheckCircle2, 
  Server
} from 'lucide-react';

interface PrivacyDrawerProps {
  aiStatus: {
    configured: boolean;
    allowLiveAI: boolean;
    modelId: string;
    endpoint: string;
    status: string;
  };
}

export const PrivacyDrawer: React.FC<PrivacyDrawerProps> = ({ aiStatus }) => {
  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="w-6 h-6 text-[#17845B]" />
          <h1 className="text-xl md:text-2xl font-bold text-[#111827]">
            Privacy Architecture & Data Sovereignty
          </h1>
        </div>
        <p className="text-xs md:text-sm text-[#4B5563]">
          ProofLedger AI is engineered with privacy-by-design. We separate deterministic financial math from remote AI inference.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-[#DDE3DA] p-5 space-y-3 shadow-2xs">
          <div className="flex items-center gap-2 text-sm font-bold text-[#111827]">
            <Lock className="w-4 h-4 text-[#17845B]" />
            What Remains 100% Local (In-Browser)
          </div>
          <ul className="text-xs text-[#4B5563] space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#17845B] shrink-0 mt-0.5" />
              <span>
                <strong>Raw CSV Files:</strong> Both Bank Statement and Accounting Ledger CSV files are parsed directly in your browser memory via PapaParse.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#17845B] shrink-0 mt-0.5" />
              <span>
                <strong>Integer Arithmetic:</strong> Balances, debits, credits, and net variance calculations run client-side. The AI never touches financial math.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#17845B] shrink-0 mt-0.5" />
              <span>
                <strong>Zero Remote Storage:</strong> There is no database, no Redis cache, and no telemetry storing your uploaded statement rows.
              </span>
            </li>
          </ul>
        </div>

        <div className="bg-white rounded-xl border border-[#DDE3DA] p-5 space-y-3 shadow-2xs">
          <div className="flex items-center gap-2 text-sm font-bold text-[#111827]">
            <Cpu className="w-4 h-4 text-[#2563EB]" />
            What Nebius Token Factory Receives
          </div>
          <ul className="text-xs text-[#4B5563] space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#2563EB] shrink-0 mt-0.5" />
              <span>
                <strong>Single Exception Only:</strong> The cloud model is only invoked when you explicitly choose to investigate a specific flagged discrepancy.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#2563EB] shrink-0 mt-0.5" />
              <span>
                <strong>Automated Redaction:</strong> Account numbers, phone numbers, emails, and UPI handles are automatically masked with <code>[REDACTED]</code> tokens before transmission.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#2563EB] shrink-0 mt-0.5" />
              <span>
                <strong>Explicit Human Consent:</strong> You must preview the exact outbound JSON payload and approve it before the request is dispatched.
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#DDE3DA] p-5 space-y-3">
        <h2 className="text-sm font-bold text-[#111827] flex items-center gap-2">
          <Server className="w-4 h-4 text-[#101A2B]" />
          Current Infrastructure & Inference State
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-[#FAFBF9] rounded-lg border border-[#DDE3DA]">
            <div className="text-[#6B7280]">Inference Engine</div>
            <div className="font-semibold text-[#111827] mt-0.5">{aiStatus.endpoint}</div>
          </div>
          <div className="p-3 bg-[#FAFBF9] rounded-lg border border-[#DDE3DA]">
            <div className="text-[#6B7280]">Configured Model</div>
            <div className="font-mono font-semibold text-[#111827] mt-0.5">{aiStatus.modelId}</div>
          </div>
          <div className="p-3 bg-[#FAFBF9] rounded-lg border border-[#DDE3DA]">
            <div className="text-[#6B7280]">Live Inference Status</div>
            <div className="font-bold font-mono mt-0.5">
              {aiStatus.allowLiveAI && aiStatus.configured ? (
                <span className="text-[#17845B]">ACTIVE & READY</span>
              ) : (
                <span className="text-amber-600">LOCAL MODE (Deterministic Only)</span>
              )}
            </div>
          </div>
        </div>

        <p className="text-[11px] text-[#6B7280]">
          API keys are managed via server-side environment variables (<code>NEBIUS_API_KEY</code>) and are never exposed in client bundles.
        </p>
      </div>

      <div className="bg-[#FAFBF9] rounded-xl border border-[#DDE3DA] p-5 space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-[#111827]">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          Honest Security Disclosure (No "100% Secure" Myths)
        </div>
        <p className="text-xs text-[#4B5563] leading-relaxed">
          No cloud architecture can honestly promise zero risk. While ProofLedger AI sanitizes identifiable fields and avoids raw CSV uploads, transaction amounts and approximate dates are transmitted during AI investigations. If your internal policies prohibit sharing any financial telemetry with cloud inference providers, ProofLedger AI functions completely in <strong>Local Mode</strong>, delivering 100% of its deterministic matching and audit capabilities offline without external API keys.
        </p>
      </div>
    </div>
  );
};

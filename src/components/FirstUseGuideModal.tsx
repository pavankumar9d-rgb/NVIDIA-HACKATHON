import React from 'react';
import { 
  Sparkles, 
  UploadCloud, 
  CheckCircle2, 
  Layers, 
  Cpu, 
  Bookmark, 
  ArrowRight, 
  X 
} from 'lucide-react';

interface FirstUseGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartDemo: () => void;
  onOpenImport: () => void;
}

export const FirstUseGuideModal: React.FC<FirstUseGuideModalProps> = ({
  isOpen,
  onClose,
  onStartDemo,
  onOpenImport,
}) => {
  if (!isOpen) return null;

  const steps = [
    {
      number: '1',
      icon: <UploadCloud className="w-5 h-5 text-blue-600" />,
      title: 'Import Bank & Ledger Statements',
      description: 'Upload your Bank Statement CSV and General Ledger CSV. In Guest Mode, parsing happens 100% in browser memory with zero network uploads.',
    },
    {
      number: '2',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
      title: 'Deterministic Integer-Paise Matching',
      description: 'The core engine matches 1-to-1 transactions using exact integer arithmetic (paise units), completely eliminating floating-point rounding drift.',
    },
    {
      number: '3',
      icon: <Layers className="w-5 h-5 text-amber-600" />,
      title: 'Review Exceptions & Audit Trail',
      description: 'Inspect timing differences, bank charges, and unrecorded vouchers. Confirm human review decisions with an audit-balanced bridge schedule.',
    },
    {
      number: '4',
      icon: <Cpu className="w-5 h-5 text-purple-600" />,
      title: 'AI Investigation (With Consent)',
      description: 'Optionally request NVIDIA Nemotron forensic hypotheses for complex discrepancies. Explicit consent is mandated, and personal identifiers are masked.',
    },
    {
      number: '5',
      icon: <Bookmark className="w-5 h-5 text-indigo-600" />,
      title: 'Private Cloud History (Authenticated)',
      description: 'Sign in with Google to save sanitized reconciliation snapshots protected by Supabase Row Level Security (RLS). Guest data is never saved.',
    },
  ];

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-title"
    >
      <div className="bg-white rounded-3xl max-w-xl w-full border border-[#DDE3DA] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#DDE3DA] bg-[#F6F7F2] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#101A2B] text-[#D7FF56] flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 id="guide-title" className="text-base font-bold text-[#111827]">
                Getting Started with ProofLedger AI
              </h2>
              <span className="text-[11px] text-slate-500">Quick 5-Step Workflow Overview</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-[#DDE3DA] hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            aria-label="Close Guide"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Steps List */}
        <div className="p-6 overflow-y-auto max-h-[65vh] space-y-4">
          {steps.map((step) => (
            <div 
              key={step.number}
              className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-[#F6F7F2]/70 border border-[#EEF1EB] hover:border-slate-300 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-white border border-[#DDE3DA] flex items-center justify-center shrink-0 shadow-2xs">
                {step.icon}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                    Step {step.number}
                  </span>
                  <h3 className="text-xs font-bold text-[#111827]">
                    {step.title}
                  </h3>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Action Footer */}
        <div className="px-6 py-4 border-t border-[#DDE3DA] bg-[#F6F7F2] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-800 font-medium underline cursor-pointer"
          >
            Skip for now
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                onClose();
                onStartDemo();
              }}
              className="flex-1 sm:flex-none py-2 px-3.5 rounded-xl bg-white hover:bg-slate-100 border border-[#CBD5C5] text-slate-800 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
            >
              Try 32-Row Demo
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenImport();
              }}
              className="flex-1 sm:flex-none py-2 px-4 rounded-xl bg-[#101A2B] hover:bg-[#1C2D48] text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <span>Import CSVs</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#D7FF56]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


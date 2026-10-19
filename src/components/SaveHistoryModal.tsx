import React, { useState } from 'react';
import { 
  ShieldCheck, 
  X, 
  Bookmark, 
  CheckCircle2, 
  AlertTriangle,
  Lock,
  EyeOff
} from 'lucide-react';

interface SaveHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (sessionName: string, description?: string) => Promise<void>;
  defaultName: string;
  isSaving: boolean;
  errorMessage?: string | null;
  currentUserEmail?: string | null;
}

export const SaveHistoryModal: React.FC<SaveHistoryModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  defaultName,
  isSaving,
  errorMessage,
  currentUserEmail,
}) => {
  const [name, setName] = useState(defaultName || 'Reconciliation Snapshot');
  const [description, setDescription] = useState('');
  const [consentAcknowledged, setConsentAcknowledged] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !consentAcknowledged || isSaving) return;
    void onConfirm(name.trim(), description.trim() || undefined);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        className="bg-white rounded-2xl max-w-lg w-full border border-[#DDE3DA] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-history-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#DDE3DA] bg-[#F9FAF8] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
              <Bookmark className="w-4 h-4" />
            </div>
            <div>
              <h2 id="save-history-title" className="text-sm font-bold text-[#111827]">
                Save Reconciliation to Cloud History
              </h2>
              <p className="text-[11px] text-slate-500">
                Encrypted PostgreSQL storage with strict Row Level Security
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {currentUserEmail ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-50 border border-purple-200 text-xs text-purple-900">
              <Lock className="w-4 h-4 text-purple-600 shrink-0" />
              <span>
                Saving privately to account: <strong>{currentUserEmail}</strong>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                You must be signed in with Google to save private history.
              </span>
            </div>
          )}

          <div>
            <label htmlFor="session-name" className="block text-xs font-bold text-[#111827] mb-1">
              Session Label <span className="text-rose-500">*</span>
            </label>
            <input
              id="session-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. October 2026 Monthly Close"
              required
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#DDE3DA] focus:outline-none focus:border-purple-600 font-medium"
            />
          </div>

          <div>
            <label htmlFor="session-desc" className="block text-xs font-bold text-[#111827] mb-1">
              Optional Audit Notes
            </label>
            <textarea
              id="session-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Cleared 25 pairs; 5 exceptions reviewed and approved."
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#DDE3DA] focus:outline-none focus:border-purple-600 font-medium resize-none"
            />
          </div>

          {/* Privacy & Redaction Disclosure */}
          <div className="rounded-xl border border-[#DDE3DA] bg-[#F9FAF8] p-3.5 space-y-2 text-[11px]">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Privacy & Data Sanitization Guarantee</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
              <div className="space-y-1">
                <span className="font-semibold text-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Stored Fields:
                </span>
                <ul className="text-slate-600 list-disc list-inside space-y-0.5 pl-1">
                  <li>Sanitized narrations</li>
                  <li>Confirmed match pairs</li>
                  <li>Exception variance deltas</li>
                  <li>Review decisions & notes</li>
                </ul>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-rose-800 flex items-center gap-1">
                  <EyeOff className="w-3 h-3 text-rose-600" /> Excluded from Storage:
                </span>
                <ul className="text-slate-600 list-disc list-inside space-y-0.5 pl-1">
                  <li>Raw uploaded CSV text</li>
                  <li>Unredacted PII / Phone #s</li>
                  <li>Bank account numbers</li>
                  <li>Raw unparsed rows</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Explicit User Consent Checkbox */}
          <div className="flex items-start gap-2.5 pt-1">
            <input
              id="privacy-consent"
              type="checkbox"
              checked={consentAcknowledged}
              onChange={(e) => setConsentAcknowledged(e.target.checked)}
              className="mt-0.5 rounded border-[#CBD5C5] text-purple-600 focus:ring-purple-500 cursor-pointer"
            />
            <label htmlFor="privacy-consent" className="text-xs text-slate-700 cursor-pointer select-none leading-relaxed">
              I authorize ProofLedger to store this sanitized reconciliation snapshot in my private account database under Row Level Security.
            </label>
          </div>

          {errorMessage && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#DDE3DA]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg border border-[#DDE3DA] text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || !consentAcknowledged || isSaving || !currentUserEmail}
              className="px-4 py-2 rounded-lg bg-purple-700 hover:bg-purple-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving to Cloud...</span>
                </>
              ) : (
                <>
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>Save Snapshot</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

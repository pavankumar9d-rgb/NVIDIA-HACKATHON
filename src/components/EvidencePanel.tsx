import React, { useState } from 'react';
import type {
  ReconciliationMatch,
  ReconciliationException
} from '../lib/reconciliation';
import { formatPaise } from '../lib/money';
import { calculateExceptionVarianceContributionPaise } from '../lib/reconciliation/analytics';
import { buildMinimizedExceptionPayload } from '../lib/privacy';
import {
  ShieldCheck,
  Sparkles,
  Check,
  X,
  Clock,
  Building2,
  BookOpen,
  Lock,
  AlertCircle
} from 'lucide-react';

interface EvidencePanelProps {
  selectedItem: { type: 'match' | 'exception'; id: string } | null;
  match?: ReconciliationMatch;
  exception?: ReconciliationException;
  totalVariancePaise?: number;
  onClose?: () => void;
  onReviewDecision: (
    exceptionId: string,
    decision: 'APPROVED' | 'REJECTED' | 'DEFERRED',
    note: string
  ) => void;
  aiStatus: {
    configured: boolean;
    allowLiveAI: boolean;
    modelId: string;
    status: string;
  };
  onRunAIInvestigation: (
    exception: ReconciliationException,
    consentGranted: boolean
  ) => Promise<void>;
  isAILoading: boolean;
}

export const EvidencePanel: React.FC<EvidencePanelProps> = ({
  selectedItem,
  match,
  exception,
  totalVariancePaise,
  onClose,
  onReviewDecision,
  aiStatus,
  onRunAIInvestigation,
  isAILoading,
}) => {
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [reviewNote, setReviewNote] = useState('');

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showConsentModal) {
          setShowConsentModal(false);
        } else {
          onClose?.();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, showConsentModal]);

  if (!selectedItem) {
    return null;
  }

  // Handle Confirmed Match display
  if (match) {
    return (
      <>
        <div
          className="fixed inset-0 bg-[#101A2B]/40 backdrop-blur-[2px] z-40 transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
        <aside
          className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] lg:w-[540px] bg-white shadow-2xl border-l border-[#CBD5C5] flex flex-col h-full overflow-hidden animate-in slide-in-from-right duration-200"
          role="dialog"
          aria-label="Forensic Match Evidence"
          aria-modal="true"
        >
          <div className="p-4 border-b border-[#DDE3DA] flex items-center justify-between bg-[#F9FAF8] shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-[#111827]">Evidence Inspector</span>
              <span className="text-[11px] font-mono bg-[#E8F5EE] text-[#17845B] border border-[#A7D7BC] px-2 py-0.5 rounded font-semibold">
                {match.matchId}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 min-h-[44px] min-w-[44px] rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#EEF1EB] transition-colors cursor-pointer flex items-center justify-center"
              title="Close panel (Esc)"
              aria-label="Close panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="border-b border-[#DDE3DA] pb-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[#17845B] bg-[#E8F5EE] px-2 py-0.5 rounded border border-[#A7D7BC]">
                  CONFIRMED MATCH (1-to-1)
                </span>
                <span className="text-xs font-mono text-[#6B7280]">
                  Score: {match.confidenceScore}/100
                </span>
              </div>
              <h2 className="text-base font-bold text-[#111827] mt-1.5">
                Forensic Match Provenance
              </h2>
              <p className="text-xs text-[#6B7280]">
                Deterministic engine confirmed this pair via {match.tier === 'EXACT_REF_AMOUNT' ? 'exact reference and amount' : 'date tolerance window'}.
              </p>
            </div>

            {/* Source Records Comparison */}
            <div className="space-y-3">
              <div className="bg-[#F8FAF6] border border-[#DDE3DA] rounded-lg p-3">
                <div className="flex items-center justify-between text-xs font-semibold text-[#111827] mb-1">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#2563EB]" />
                    Bank Statement Row ({match.bankTransaction.id})
                  </span>
                  <span className="font-mono text-[#17845B]">
                    {formatPaise(match.bankTransaction.amountPaise)}
                  </span>
                </div>
                <div className="text-xs text-[#4B5563] font-mono mb-1">
                  Date: {match.bankTransaction.date} | Ref: {match.bankTransaction.reference || 'None'}
                </div>
                <div className="text-xs text-[#111827]">{match.bankTransaction.sanitizedDescription}</div>
              </div>

              <div className="bg-[#F8FAF6] border border-[#DDE3DA] rounded-lg p-3">
                <div className="flex items-center justify-between text-xs font-semibold text-[#111827] mb-1">
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-[#101A2B]" />
                    Accounting Ledger Row ({match.ledgerTransaction.id})
                  </span>
                  <span className="font-mono text-[#17845B]">
                    {formatPaise(match.ledgerTransaction.amountPaise)}
                  </span>
                </div>
                <div className="text-xs text-[#4B5563] font-mono mb-1">
                  Date: {match.ledgerTransaction.date} | Ref: {match.ledgerTransaction.reference || 'None'}
                </div>
                <div className="text-xs text-[#111827]">{match.ledgerTransaction.sanitizedDescription}</div>
              </div>
            </div>

            {/* Mathematical Proof Signals */}
            <div className="bg-white border border-[#DDE3DA] rounded-lg p-3 space-y-2 text-xs">
              <div className="font-semibold text-[#111827] flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#17845B]" />
                Deterministic Proof Signals:
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-[#EEF1EB] p-2 rounded">
                  <span className="text-[#6B7280]">Date Lag:</span>{' '}
                  <span className="font-mono font-semibold text-[#111827]">
                    {match.dateDeltaDays === 0 ? 'Same Day (0d)' : `${match.dateDeltaDays} days`}
                  </span>
                </div>
                <div className="bg-[#EEF1EB] p-2 rounded">
                  <span className="text-[#6B7280]">Amount Variance:</span>{' '}
                  <span className="font-mono font-semibold text-[#17845B]">₹0.00 Exact</span>
                </div>
                <div className="bg-[#EEF1EB] p-2 rounded">
                  <span className="text-[#6B7280]">Reference Match:</span>{' '}
                  <span className="font-mono font-semibold text-[#111827]">
                    {match.signals.referenceMatch ? '100% Hash Match' : 'Unmatched Ref'}
                  </span>
                </div>
                <div className="bg-[#EEF1EB] p-2 rounded">
                  <span className="text-[#6B7280]">Description Similarity:</span>{' '}
                  <span className="font-mono font-semibold text-[#111827]">
                    {(match.signals.descriptionSimilarity * 100).toFixed(0)}% Jaccard
                  </span>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-[#6B7280] italic bg-[#FAFBF9] p-2.5 rounded border border-[#EDF1EA]">
              This record cleared automated matching with 1-to-1 consumption. No AI inference was required.
            </div>
          </div>
        </aside>
      </>
    );
  }

  // Handle Exception Display
  if (!exception) return null;

  const outboundPreview = buildMinimizedExceptionPayload({
    exceptionId: exception.exceptionId,
    type: exception.type,
    bankRow: exception.bankTransaction
      ? {
          id: exception.bankTransaction.id,
          date: exception.bankTransaction.date,
          amountPaise: exception.bankTransaction.amountPaise,
          direction: exception.bankTransaction.direction,
          description: exception.bankTransaction.sanitizedDescription,
          reference: exception.bankTransaction.reference,
        }
      : undefined,
    ledgerRow: exception.ledgerTransaction
      ? {
          id: exception.ledgerTransaction.id,
          date: exception.ledgerTransaction.date,
          amountPaise: exception.ledgerTransaction.amountPaise,
          direction: exception.ledgerTransaction.direction,
          description: exception.ledgerTransaction.sanitizedDescription,
          reference: exception.ledgerTransaction.reference,
        }
      : undefined,
    candidateRows: exception.candidateTransactions?.map((c) => ({
      id: c.id,
      date: c.date,
      amountPaise: c.amountPaise,
      direction: c.direction,
      description: c.sanitizedDescription,
    })),
    deltaPaise: exception.amountDeltaPaise,
    dateLagDays: exception.dateDeltaDays,
  });

  return (
    <>
      <div
        className="fixed inset-0 bg-[#101A2B]/40 backdrop-blur-[2px] z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] lg:w-[540px] bg-white shadow-2xl border-l border-[#CBD5C5] flex flex-col h-full overflow-hidden animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-label="Exception Investigation Drawer"
        aria-modal="true"
      >
        <div className="p-4 border-b border-[#DDE3DA] flex items-center justify-between bg-[#F9FAF8] shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-[#111827]">Evidence Inspector</span>
            <span className="text-[11px] font-mono bg-[#FDEDEA] text-[#D75E4C] border border-[#F3BDB4] px-2 py-0.5 rounded font-semibold">
              {exception.exceptionId}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 min-h-[44px] min-w-[44px] rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#EEF1EB] transition-colors cursor-pointer flex items-center justify-center"
            title="Close panel (Esc)"
            aria-label="Close panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="border-b border-[#DDE3DA] pb-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-[#D75E4C] bg-[#FDEDEA] px-2 py-0.5 rounded border border-[#F3BDB4]">
                {exception.type}
              </span>
              <span className="text-[11px] font-mono text-[#6B7280]">
                ID: {exception.exceptionId}
              </span>
            </div>
            <h2 className="text-base font-bold text-[#111827] mt-1.5">
              {exception.title}
            </h2>
            <p className="text-xs text-[#4B5563] mt-1">
              {exception.description}
            </p>
          </div>

          {/* Variance Context Comparison Banner */}
          <div className="bg-[#FAFBF9] border border-[#DDE3DA] rounded-lg p-3 text-xs flex items-center justify-between">
            <div>
              <span className="text-[#6B7280]">Variance Impact (Bank − Ledger):</span>{' '}
              <strong className="font-mono text-[#D75E4C] text-sm">
                {formatPaise(calculateExceptionVarianceContributionPaise(exception), { showSign: true })}
              </strong>
            </div>
            {totalVariancePaise !== undefined && (
              <div className="text-right">
                <span className="text-[#6B7280] text-[11px]">Total Net Variance:</span>{' '}
                <strong className="font-mono text-[#111827] text-xs">
                  {formatPaise(totalVariancePaise, { showSign: true })}
                </strong>
              </div>
            )}
          </div>

      <div className="space-y-2.5">
        <div className="text-xs font-semibold text-[#111827] flex items-center justify-between">
          <span>Forensic Evidence:</span>
          {exception.amountDeltaPaise !== 0 && (
            <span className="font-mono text-[#D75E4C] font-bold" title="Signed transaction amount delta">
              Transaction Δ: {formatPaise(exception.amountDeltaPaise, { showSign: true })}
            </span>
          )}
        </div>

        {exception.bankTransaction ? (
          <div className="bg-[#F8FAF6] border border-[#DDE3DA] rounded-lg p-3">
            <div className="flex items-center justify-between text-xs font-semibold text-[#111827] mb-1">
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-[#2563EB]" />
                Bank: {exception.bankTransaction.id}
              </span>
              <span className="font-mono font-bold text-[#111827]">
                {formatPaise(exception.bankTransaction.amountPaise)}
              </span>
            </div>
            <div className="text-xs font-mono text-[#6B7280]">
              {exception.bankTransaction.date} | Ref: {exception.bankTransaction.reference || 'None'}
            </div>
            <div className="text-xs text-[#111827] mt-1">
              {exception.bankTransaction.sanitizedDescription}
            </div>
          </div>
        ) : (
          <div className="bg-[#FDEDEA]/40 border border-dashed border-[#F3BDB4] rounded-lg p-3 text-xs text-[#D75E4C] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Missing Bank Record: No corresponding bank clearing was discovered.</span>
          </div>
        )}

        {exception.ledgerTransaction ? (
          <div className="bg-[#F8FAF6] border border-[#DDE3DA] rounded-lg p-3">
            <div className="flex items-center justify-between text-xs font-semibold text-[#111827] mb-1">
              <span className="flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-[#101A2B]" />
                Ledger: {exception.ledgerTransaction.id}
              </span>
              <span className="font-mono font-bold text-[#111827]">
                {formatPaise(exception.ledgerTransaction.amountPaise)}
              </span>
            </div>
            <div className="text-xs font-mono text-[#6B7280]">
              {exception.ledgerTransaction.date} | Ref: {exception.ledgerTransaction.reference || 'None'}
            </div>
            <div className="text-xs text-[#111827] mt-1">
              {exception.ledgerTransaction.sanitizedDescription}
            </div>
          </div>
        ) : (
          <div className="bg-[#FDEDEA]/40 border border-dashed border-[#F3BDB4] rounded-lg p-3 text-xs text-[#D75E4C] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Missing Ledger Record: Unrecorded in internal accounting journal.</span>
          </div>
        )}
      </div>

      <div className="border border-[#DDE3DA] rounded-xl p-3.5 bg-gradient-to-b from-[#FAFBF9] to-white space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#111827]">
            <Sparkles className="w-4 h-4 text-[#101A2B]" />
            Forensic Exception Investigation
          </div>
          <span className="text-[10px] font-mono bg-[#EEF1EB] px-1.5 py-0.5 rounded text-[#4B5563]">
            {aiStatus.allowLiveAI && aiStatus.configured ? 'Token Factory' : 'Local Mode'}
          </span>
        </div>

        {exception.aiHypothesis ? (
          <div className="bg-[#101A2B] text-white rounded-lg p-3 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="bg-[#D7FF56] text-[#101A2B] font-mono text-[10px] font-bold px-2 py-0.5 rounded">
                {exception.aiHypothesis.classification}
              </span>
              <span className="text-[11px] font-mono text-slate-300">
                Confidence: {exception.aiHypothesis.confidence}
              </span>
            </div>

            <p className="text-slate-100 font-medium">
              {exception.aiHypothesis.summary}
            </p>

            <div className="text-[11px] text-slate-300 bg-[#16233B] p-2 rounded border border-[#223554]">
              <span className="font-semibold text-slate-200">Evidence Citing:</span>{' '}
              {exception.aiHypothesis.evidenceRowIds.map((id) => (
                <span key={id} className="bg-[#2A3F64] text-white font-mono px-1 rounded mr-1">
                  {id}
                </span>
              ))}
              <div className="mt-1">{exception.aiHypothesis.evidenceExplanation}</div>
            </div>

            <div className="text-[11px] text-emerald-300 bg-emerald-950/40 border border-emerald-800 p-2 rounded">
              <span className="font-bold">Suggested Next Step:</span> {exception.aiHypothesis.recommendedAction}
            </div>
          </div>
        ) : (
          <div>
            <p className="text-xs text-[#6B7280] mb-3">
              Request an evidence-backed deterministic analysis and journal adjustment hypothesis for this exception.
              All account numbers and PII will be sanitized.
            </p>

            <button
              type="button"
              onClick={() => setShowConsentModal(true)}
              disabled={isAILoading}
              className="w-full py-2 px-3 rounded-lg bg-[#D7FF56] hover:bg-[#C9F540] text-[#111827] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isAILoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-[#111827] border-t-transparent rounded-full animate-spin" />
                  <span>Analyzing with Nemotron...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 fill-[#111827]" />
                  <span>Investigate Exception</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <div className="border border-[#DDE3DA] rounded-xl p-3.5 bg-white space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-[#111827]">
          <span>Human Review & Audit Decision:</span>
          {exception.reviewDecision && (
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
              exception.reviewDecision.status === 'APPROVED'
                ? 'bg-[#E8F5EE] text-[#17845B]'
                : exception.reviewDecision.status === 'REJECTED'
                ? 'bg-[#FDEDEA] text-[#D75E4C]'
                : 'bg-[#FEF3C7] text-[#D97706]'
            }`}>
              {exception.reviewDecision.status}
            </span>
          )}
        </div>

        <textarea
          placeholder="Add optional audit note for statutory compliance..."
          value={reviewNote}
          onChange={(e) => setReviewNote(e.target.value)}
          rows={2}
          className="w-full p-2 text-xs border border-[#DDE3DA] rounded-md bg-[#FAFBF9] focus:outline-none focus:border-[#101A2B]"
        />

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => onReviewDecision(exception.exceptionId, 'APPROVED', reviewNote)}
            className="py-2.5 px-2 min-h-[44px] rounded-xl bg-[#E8F5EE] active:bg-[#D5EFE0] text-[#17845B] border border-[#A7D7BC] text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
            title="Accept hypothesis for this period close"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Approve</span>
          </button>

          <button
            type="button"
            onClick={() => onReviewDecision(exception.exceptionId, 'REJECTED', reviewNote)}
            className="py-2.5 px-2 min-h-[44px] rounded-xl bg-[#FDEDEA] active:bg-[#FCD9D3] text-[#D75E4C] border border-[#F3BDB4] text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
            title="Reject hypothesis as ungrounded"
          >
            <X className="w-3.5 h-3.5" />
            <span>Reject</span>
          </button>

          <button
            type="button"
            onClick={() => onReviewDecision(exception.exceptionId, 'DEFERRED', reviewNote)}
            className="py-2.5 px-2 min-h-[44px] rounded-xl bg-[#FEF3C7] active:bg-[#FDE68A] text-[#D97706] border border-[#FDE68A] text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
            title="Defer for external voucher confirmation"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Defer</span>
          </button>
        </div>
      </div>
      </div>

      {showConsentModal && (
        <div className="fixed inset-0 bg-[#101A2B]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#DDE3DA] max-w-lg w-full p-4 sm:p-6 shadow-xl space-y-4 max-h-[92vh] overflow-y-auto pb-safe">
            <div className="flex items-center gap-2 text-base font-bold text-[#111827]">
              <Lock className="w-5 h-5 text-[#2563EB]" />
              Outbound Privacy Payload Preview
            </div>

            <p className="text-xs text-[#4B5563]">
              ProofLedger AI enforces zero-raw-upload data sovereignty. Below is the exact, minimized,
              sanitized JSON payload that will be transmitted to Nebius Token Factory:
            </p>

            <pre className="p-3 bg-[#101A2B] text-[#D7FF56] text-[11px] font-mono rounded-lg overflow-x-auto max-h-52">
              {JSON.stringify(outboundPreview, null, 2)}
            </pre>

            <div className="bg-[#FAFBF9] border border-[#DDE3DA] p-3 rounded-lg text-xs space-y-1.5 text-[#4B5563]">
              <div className="font-semibold text-[#111827] flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#17845B]" />
                Privacy Protections Applied:
              </div>
              <ul className="list-disc list-inside text-[11px] space-y-0.5">
                <li>Bank account numbers, UPI handles, and phones are masked with [REDACTED].</li>
                <li>Raw CSV statements remain strictly in your browser session.</li>
                <li>Analysis runs through deterministic rule heuristics with optional prototype model adapter (currently LOCAL_ONLY).</li>
              </ul>
            </div>

            <label className="flex items-start gap-2 text-xs text-[#111827] cursor-pointer font-medium">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I give explicit consent to transmit this single sanitized exception packet to
                the investigation gateway for exception analysis.
              </span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#DDE3DA]">
              <button
                type="button"
                onClick={() => setShowConsentModal(false)}
                className="px-4 py-2.5 min-h-[44px] rounded-xl border border-[#DDE3DA] text-xs font-semibold text-[#4B5563] active:bg-[#F6F7F2] cursor-pointer flex items-center justify-center"
              >
                Cancel / Stay Local
              </button>
              <button
                type="button"
                disabled={!consentChecked || isAILoading}
                onClick={async () => {
                  setShowConsentModal(false);
                  await onRunAIInvestigation(exception, true);
                }}
                className="px-5 py-2.5 min-h-[44px] rounded-xl bg-[#D7FF56] active:bg-[#C9F540] text-[#111827] text-xs font-bold disabled:opacity-50 cursor-pointer shadow-xs flex items-center justify-center"
              >
                Proceed with Inference
              </button>
            </div>
          </div>
        </div>
      )}
      </aside>
    </>
  );
};

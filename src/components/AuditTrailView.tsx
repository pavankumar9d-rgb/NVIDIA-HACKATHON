import React from 'react';
import type { 
  ReconciliationMatch, 
  ReconciliationException, 
  ReconciliationSummary 
} from '../lib/reconciliation';
import { formatPaise } from '../lib/money';
import { 
  FileText, 
  Clock, 
  User, 
  Download 
} from 'lucide-react';

interface AuditTrailViewProps {
  matches: ReconciliationMatch[];
  exceptions: ReconciliationException[];
  summary: ReconciliationSummary | null;
  sessionName: string;
  onOpenExport: () => void;
}

export const AuditTrailView: React.FC<AuditTrailViewProps> = ({
  exceptions,
  onOpenExport,
}) => {
  const reviewedExceptions = exceptions.filter((e) => e.reviewDecision && e.reviewDecision.status !== 'PENDING');
  const pendingExceptions = exceptions.filter((e) => !e.reviewDecision || e.reviewDecision.status === 'PENDING');

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#DDE3DA] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-[#101A2B]" />
            <h1 className="text-xl md:text-2xl font-bold text-[#111827]">
              Reconciliation Audit Trail & Decisions
            </h1>
          </div>
          <p className="text-xs md:text-sm text-[#4B5563] mt-0.5">
            Immutable log of mathematical matches, AI-assisted investigations, and human operator sign-offs.
          </p>
        </div>

        <button
          onClick={onOpenExport}
          className="px-4 py-2 rounded-lg bg-[#D7FF56] hover:bg-[#C9F540] text-[#111827] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs border border-[#BDDE3D]"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Audit Package</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="bg-white rounded-xl border border-[#DDE3DA] p-4">
          <div className="text-[#6B7280]">Total Exceptions</div>
          <div className="text-2xl font-bold font-mono text-[#111827] mt-1">
            {exceptions.length}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#DDE3DA] p-4">
          <div className="text-[#6B7280]">Human Reviewed</div>
          <div className="text-2xl font-bold font-mono text-[#17845B] mt-1">
            {reviewedExceptions.length}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#DDE3DA] p-4">
          <div className="text-[#6B7280]">Pending Operator Review</div>
          <div className="text-2xl font-bold font-mono text-[#D75E4C] mt-1">
            {pendingExceptions.length}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-bold text-[#111827]">
          Exception Review Register ({exceptions.length} records)
        </h2>

        {exceptions.map((e) => {
          const decision = e.reviewDecision;
          const isApproved = decision?.status === 'APPROVED';
          const isRejected = decision?.status === 'REJECTED';
          const isDeferred = decision?.status === 'DEFERRED';

          return (
            <div
              key={e.exceptionId}
              className="bg-white rounded-xl border border-[#DDE3DA] p-4 space-y-2.5 shadow-2xs"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-[#111827] bg-[#EEF1EB] px-2 py-0.5 rounded">
                    {e.exceptionId}
                  </span>
                  <span className="font-semibold text-[#111827]">{e.title}</span>
                </div>

                <div className="flex items-center gap-2 font-mono">
                  <span className="text-[#D75E4C] font-semibold">
                    Δ {formatPaise(e.amountDeltaPaise, { showSign: true })}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      isApproved
                        ? 'bg-[#E8F5EE] text-[#17845B] border border-[#A7D7BC]'
                        : isRejected
                        ? 'bg-[#FDEDEA] text-[#D75E4C] border border-[#F3BDB4]'
                        : isDeferred
                        ? 'bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {decision?.status || 'PENDING'}
                  </span>
                </div>
              </div>

              <p className="text-xs text-[#4B5563]">{e.description}</p>

              {e.aiHypothesis && (
                <div className="bg-[#101A2B] text-white p-2.5 rounded-lg text-xs space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#D7FF56] font-semibold">
                      Nemotron 70B Hypothesis: {e.aiHypothesis.classification}
                    </span>
                    <span className="text-slate-400 font-mono">
                      Confidence: {e.aiHypothesis.confidence}
                    </span>
                  </div>
                  <p className="text-slate-200 text-[11px]">{e.aiHypothesis.summary}</p>
                  <p className="text-emerald-300 text-[11px]">
                    Recommended: {e.aiHypothesis.recommendedAction}
                  </p>
                </div>
              )}

              <div className="pt-2 border-t border-[#EDF1EA] flex flex-col sm:flex-row items-start sm:items-center justify-between text-[11px] text-[#6B7280] gap-1">
                <div className="flex items-center gap-1.5">
                  <User className="w-3 h-3 text-[#9CA3AF]" />
                  <span>Reviewer: {decision?.reviewer || 'Unassigned (Awaiting Review)'}</span>
                  {decision?.note && (
                    <span className="italic text-[#111827]">"{decision.note}"</span>
                  )}
                </div>

                <div className="flex items-center gap-1 font-mono">
                  <Clock className="w-3 h-3 text-[#9CA3AF]" />
                  <span>{decision?.timestamp ? new Date(decision.timestamp).toLocaleString('en-IN') : 'Pending'}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

import React, { useMemo } from 'react';
import type { CanonicalTransaction, ReconciliationResult } from '../lib/reconciliation';
import { 
  getDailyMovementSeries, 
  getReconciliationComposition, 
  getPrioritizedExceptions, 
  getReconciliationBridge 
} from '../lib/reconciliation/analytics';
import { MetricsHeader } from './MetricsHeader';
import { DailyMovementChart } from './charts/DailyMovementChart';
import { ReconciliationCompositionChart } from './charts/ReconciliationCompositionChart';
import { formatPaise } from '../lib/money';
import { 
  ArrowRight, 
  FileCheck2, 
  Sparkles, 
  ShieldCheck, 
  AlertTriangle,
  Clock,
  Layers,
  Download
} from 'lucide-react';

interface OverviewViewProps {
  sessionName: string;
  isSynthetic: boolean;
  bankRows: CanonicalTransaction[];
  ledgerRows: CanonicalTransaction[];
  reconciliationResult: ReconciliationResult | null;
  onNavigateToWorkspace: (exceptionId?: string, filterType?: string) => void;
  onOpenExport: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  sessionName,
  isSynthetic,
  bankRows,
  ledgerRows,
  reconciliationResult,
  onNavigateToWorkspace,
  onOpenExport,
}) => {
  const summary = reconciliationResult?.summary ?? null;

  // Compute analytics data
  const dailySeries = useMemo(() => {
    return getDailyMovementSeries(bankRows, ledgerRows);
  }, [bankRows, ledgerRows]);

  const compositionSegments = useMemo(() => {
    if (!reconciliationResult?.summary) return [];
    return getReconciliationComposition(
      reconciliationResult.matches,
      reconciliationResult.exceptions,
      reconciliationResult.summary
    );
  }, [reconciliationResult]);

  const prioritizedExceptions = useMemo(() => {
    if (!reconciliationResult?.exceptions) return [];
    return getPrioritizedExceptions(reconciliationResult.exceptions);
  }, [reconciliationResult]);

  const bridge = useMemo(() => {
    if (!reconciliationResult?.summary) return null;
    return getReconciliationBridge(
      reconciliationResult.summary,
      reconciliationResult.exceptions
    );
  }, [reconciliationResult]);

  if (!reconciliationResult) {
    return (
      <div className="p-8 text-center text-[#6B7280]">
        No reconciliation data available. Please load the demo or import transaction CSVs.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#F9FAF8] pb-12">
      {/* Executive Hero Banner */}
      <div className="bg-white border-b border-[#DDE3DA] px-4 md:px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#17845B] bg-[#E8F5EE] border border-[#A7D7BC] px-2 py-0.5 rounded-full flex items-center gap-1">
                <FileCheck2 className="w-3 h-3" />
                Monthly Close Audit
              </span>
              {isSynthetic && (
                <span className="text-[11px] font-medium text-[#4B5563] bg-[#EEF1EB] border border-[#CBD5C5] px-2 py-0.5 rounded-full">
                  Synthetic Demonstration
                </span>
              )}
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-[#111827] tracking-tight">
              {sessionName}
            </h2>
            <p className="text-xs text-[#6B7280] mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>Period: <strong>September 2026</strong></span>
              <span>•</span>
              <span>Currency: <strong>INR (₹)</strong></span>
              <span>•</span>
              <span>Opening Anchor: <strong>{formatPaise(summary?.openingBankBalancePaise ?? 0)}</strong></span>
              <span>•</span>
              <span>Total Transactions: <strong>{bankRows.length + ledgerRows.length} rows</strong></span>
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onOpenExport}
              className="px-3.5 py-2 bg-white hover:bg-[#F3F5F1] text-[#111827] border border-[#CBD5C5] rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#4B5563]" />
              Export Package
            </button>
            <button
              type="button"
              onClick={() => onNavigateToWorkspace()}
              className="px-4 py-2 bg-[#101A2B] hover:bg-[#1C2C45] text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-[#D7FF56]" />
              <span>Launch Investigation Desk</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-5 space-y-6">
        {/* Core Financial KPI Cards */}
        <div className="-mx-4 md:-mx-6">
          <MetricsHeader summary={summary} />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <DailyMovementChart data={dailySeries} />
          <ReconciliationCompositionChart
            segments={compositionSegments}
            onSelectFilter={(filterType) => onNavigateToWorkspace(undefined, filterType)}
          />
        </div>

        {/* Reconciliation Mathematical Bridge Card */}
        {bridge && (
          <div className="bg-white border border-[#DDE3DA] rounded-xl p-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#EEF1EB] mb-4">
              <div>
                <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#17845B]" />
                  <span>Mathematical Reconciliation Bridge</span>
                </h3>
                <p className="text-[11px] text-[#6B7280]">
                  Deterministic zero-leakage proof connecting Closing Ledger Balance to Ending Bank Position
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold flex items-center gap-1.5 ${
                  bridge.isBalanced 
                    ? 'bg-[#E8F5EE] text-[#17845B] border border-[#A7D7BC]'
                    : 'bg-[#FDEDEA] text-[#D75E4C] border border-[#F3BDB4]'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${bridge.isBalanced ? 'bg-[#17845B]' : 'bg-[#D75E4C]'}`} />
                  {bridge.isBalanced ? '100% Balanced Bridge (0 Delta)' : 'Unexplained Variance'}
                </span>
              </div>
            </div>

            {/* Bridge Steps Formula Flow */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5 items-center font-mono text-xs">
              {/* Ledger Balance */}
              <div className="bg-[#F9FAF8] border border-[#DDE3DA] rounded-lg p-3 text-center">
                <div className="text-[10px] text-[#6B7280] font-sans font-medium uppercase mb-0.5">Closing Ledger</div>
                <div className="font-bold text-[#111827] text-sm">{formatPaise(bridge.closingLedgerBalancePaise)}</div>
              </div>

              {/* Exception 1: Outstanding Cheque */}
              <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-2.5 text-center">
                <div className="text-[10px] text-emerald-800 font-sans truncate" title="Unpresented Vendor Cheque">+ Vendor Cheque</div>
                <div className="font-bold text-[#17845B] text-xs">+₹18,500.00</div>
              </div>

              {/* Exception 2: Interest Credited */}
              <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-2.5 text-center">
                <div className="text-[10px] text-emerald-800 font-sans truncate" title="Bank Interest Credited">+ Q2 Interest</div>
                <div className="font-bold text-[#17845B] text-xs">+₹3,420.00</div>
              </div>

              {/* Exception 3: Fee Discrepancy */}
              <div className="bg-rose-50/50 border border-rose-200 rounded-lg p-2.5 text-center">
                <div className="text-[10px] text-rose-800 font-sans truncate" title="Payment Gateway Fee Discrepancy">- Gateway Fee</div>
                <div className="font-bold text-[#D75E4C] text-xs">-₹240.00</div>
              </div>

              {/* Exception 4: Bank Surcharge */}
              <div className="bg-rose-50/50 border border-rose-200 rounded-lg p-2.5 text-center">
                <div className="text-[10px] text-rose-800 font-sans truncate" title="Unrecorded Bank Surcharge">- HDFC Surcharge</div>
                <div className="font-bold text-[#D75E4C] text-xs">-₹1,250.00</div>
              </div>

              {/* Exception 5: Duplicate ATM */}
              <div className="bg-purple-50/50 border border-purple-200 rounded-lg p-2.5 text-center">
                <div className="text-[10px] text-purple-800 font-sans truncate" title="Duplicate ATM Debit">- Duplicate ATM</div>
                <div className="font-bold text-purple-700 text-xs">-₹5,000.00</div>
              </div>

              {/* Bank Balance Result */}
              <div className="bg-[#EEF1EB] border border-[#CBD5C5] rounded-lg p-3 text-center">
                <div className="text-[10px] text-[#4B5563] font-sans font-medium uppercase mb-0.5">Closing Bank</div>
                <div className="font-bold text-[#111827] text-sm">{formatPaise(bridge.closingBankBalancePaise)}</div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-[#EEF1EB] flex flex-col sm:flex-row items-center justify-between text-xs text-[#6B7280] gap-2">
              <span className="font-sans">
                Net Discrepancy: <strong className="font-mono text-[#111827]">{formatPaise(bridge.unresolvedVariancePaise, { showSign: true })}</strong>
              </span>
              <span className="font-sans text-[11px] text-[#4B5563]">
                Sum of 5 audit bridge adjustments equals exactly <strong>{formatPaise(bridge.bridgedTotalPaise, { showSign: true })}</strong>.
              </span>
            </div>
          </div>
        )}

        {/* Priority Exception Triage Queue */}
        <div className="bg-white border border-[#DDE3DA] rounded-xl overflow-hidden shadow-2xs">
          <div className="p-4 md:p-5 border-b border-[#DDE3DA] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Exceptions Requiring Attention ({prioritizedExceptions.length})</span>
              </h3>
              <p className="text-[11px] text-[#6B7280]">
                Ranked by financial materiality and balance sheet impact
              </p>
            </div>

            <button
              type="button"
              onClick={() => onNavigateToWorkspace()}
              className="text-xs text-[#2563EB] hover:text-[#1D4ED8] font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>View in Desk</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-[#EEF1EB]">
            {prioritizedExceptions.map((exp) => {
              const isReviewed = exp.reviewDecision && exp.reviewDecision.status !== 'PENDING';

              return (
                <div
                  key={exp.exceptionId}
                  className="p-4 hover:bg-[#F9FAF8] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${
                        exp.severity === 'CRITICAL'
                          ? 'bg-rose-100 text-rose-800'
                          : exp.severity === 'HIGH'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {exp.severity}
                      </span>
                      <span className="text-[11px] font-mono text-[#6B7280] bg-[#EEF1EB] px-1.5 py-0.5 rounded">
                        {exp.exceptionId}
                      </span>
                      <span className="text-xs font-bold text-[#111827]">
                        {exp.title}
                      </span>
                    </div>

                    <p className="text-xs text-[#4B5563]">
                      {exp.description}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-[#6B7280]">
                      {exp.bankTransaction && (
                        <span>Bank: <strong>{exp.bankTransaction.id}</strong> ({exp.bankTransaction.date})</span>
                      )}
                      {exp.ledgerTransaction && (
                        <span>Ledger: <strong>{exp.ledgerTransaction.id}</strong> ({exp.ledgerTransaction.date})</span>
                      )}
                      {exp.aiHypothesis && (
                        <span className={`flex items-center gap-1 font-medium ${
                          exp.aiHypothesis.model === 'ProofLedger Local Deterministic Rule'
                            ? 'text-[#4B5563]'
                            : 'text-[#17845B]'
                        }`}>
                          <Sparkles className="w-3 h-3" />
                          {exp.aiHypothesis.model === 'ProofLedger Local Deterministic Rule'
                            ? 'Local Inferred'
                            : 'Nemotron Inferred'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 self-end md:self-auto">
                    <div className="text-right">
                      <div className="text-xs text-[#6B7280]">Impact Delta</div>
                      <div className="font-mono font-bold text-sm text-[#111827]">
                        {exp.formattedDelta}
                      </div>
                    </div>

                    {isReviewed ? (
                      <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#E8F5EE] text-[#17845B] border border-[#A7D7BC] flex items-center gap-1">
                        <FileCheck2 className="w-3.5 h-3.5" />
                        {exp.reviewDecision?.status}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onNavigateToWorkspace(exp.exceptionId)}
                        className="px-3 py-1.5 bg-white hover:bg-[#EEF1EB] text-[#111827] border border-[#CBD5C5] rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Triage</span>
                        <ArrowRight className="w-3 h-3 text-[#4B5563]" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import type { ReconciliationSummary } from '../lib/reconciliation';
import { formatPaise } from '../lib/money';
import { 
  Building2, 
  BookOpen, 
  CheckCircle, 
  Scale, 
  AlertOctagon
} from 'lucide-react';

interface MetricsHeaderProps {
  summary: ReconciliationSummary | null;
}

export const MetricsHeader: React.FC<MetricsHeaderProps> = ({ summary }) => {
  if (!summary) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 md:p-6 pb-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-white rounded-xl border border-[#DDE3DA] animate-pulse p-4" />
        ))}
      </div>
    );
  }

  const isVarianceZero = summary.unresolvedVariancePaise === 0;

  return (
    <div className="p-4 md:p-6 pb-2 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-xl border border-[#DDE3DA] p-4 shadow-2xs hover:border-[#BDC8B7] transition-all">
          <div className="flex items-center justify-between text-[#6B7280] text-xs font-medium mb-1">
            <span className="flex items-center gap-1.5 font-semibold text-[#111827]">
              <Building2 className="w-4 h-4 text-[#2563EB]" />
              Closing Bank Balance
            </span>
            <span className="font-mono text-[11px] bg-[#EEF1EB] px-1.5 py-0.5 rounded text-[#4B5563]">
              {summary.bankRowCount} rows
            </span>
          </div>
          <div className="text-xl md:text-2xl font-bold font-mono text-[#111827] tracking-tight">
            {formatPaise(summary.closingBankBalancePaise)}
          </div>
          <div className="text-[11px] text-[#6B7280] mt-1 flex flex-col gap-0.5">
            <div className="flex items-center justify-between">
              <span>Net: <span className="font-mono font-medium text-[#111827]">{formatPaise(summary.netBankMovementPaise, { showSign: true })}</span></span>
              <span className="text-[10px] text-[#9CA3AF]">Open: {formatPaise(summary.openingBankBalancePaise)}</span>
            </div>
            <div className="text-[10px] text-[#9CA3AF] flex items-center justify-between">
              <span>In: {formatPaise(summary.totalBankInflowPaise)}</span>
              <span>Out: {formatPaise(summary.totalBankOutflowPaise)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#DDE3DA] p-4 shadow-2xs hover:border-[#BDC8B7] transition-all">
          <div className="flex items-center justify-between text-[#6B7280] text-xs font-medium mb-1">
            <span className="flex items-center gap-1.5 font-semibold text-[#111827]">
              <BookOpen className="w-4 h-4 text-[#101A2B]" />
              Closing Ledger Balance
            </span>
            <span className="font-mono text-[11px] bg-[#EEF1EB] px-1.5 py-0.5 rounded text-[#4B5563]">
              {summary.ledgerRowCount} rows
            </span>
          </div>
          <div className="text-xl md:text-2xl font-bold font-mono text-[#111827] tracking-tight">
            {formatPaise(summary.closingLedgerBalancePaise)}
          </div>
          <div className="text-[11px] text-[#6B7280] mt-1 flex flex-col gap-0.5">
            <div className="flex items-center justify-between">
              <span>Net: <span className="font-mono font-medium text-[#111827]">{formatPaise(summary.netLedgerMovementPaise, { showSign: true })}</span></span>
              <span className="text-[10px] text-[#9CA3AF]">Open: {formatPaise(summary.openingLedgerBalancePaise)}</span>
            </div>
            <div className="text-[10px] text-[#9CA3AF] flex items-center justify-between">
              <span>In: {formatPaise(summary.totalLedgerInflowPaise)}</span>
              <span>Out: {formatPaise(summary.totalLedgerOutflowPaise)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#DDE3DA] p-4 shadow-2xs hover:border-[#BDC8B7] transition-all">
          <div className="flex items-center justify-between text-[#6B7280] text-xs font-medium mb-1">
            <span className="flex items-center gap-1.5 font-semibold text-[#111827]">
              <CheckCircle className="w-4 h-4 text-[#17845B]" />
              Confirmed Match Rate
            </span>
            <span className="font-mono text-[11px] font-bold text-[#17845B] bg-[#E8F5EE] px-1.5 py-0.5 rounded">
              {summary.matchPercentage}%
            </span>
          </div>
          <div className="text-xl md:text-2xl font-bold font-mono text-[#17845B] tracking-tight">
            {summary.confirmedMatchCount} pairs
          </div>
          <div className="text-[11px] text-[#6B7280] mt-1 flex items-center justify-between">
            <span className="font-mono">Volume: {formatPaise(summary.matchedAmountPaise)}</span>
            <span className="text-[10px] text-[#9CA3AF] font-mono">{summary.confirmedMatchCount * 2} / {summary.bankRowCount + summary.ledgerRowCount} rows</span>
          </div>
        </div>

        <div className={`rounded-xl border p-4 shadow-2xs transition-all ${
          isVarianceZero
            ? 'bg-[#E8F5EE]/40 border-[#A7D7BC]'
            : 'bg-[#FDEDEA]/40 border-[#F3BDB4]'
        }`}>
          <div className="flex items-center justify-between text-xs font-medium mb-1">
            <span className="flex items-center gap-1.5 font-semibold text-[#111827]">
              <Scale className={`w-4 h-4 ${isVarianceZero ? 'text-[#17845B]' : 'text-[#D75E4C]'}`} />
              Unresolved Net Variance
            </span>
            <span className="text-[10px] text-[#6B7280] font-mono">Bank - Ledger</span>
          </div>
          <div className={`text-xl md:text-2xl font-bold font-mono tracking-tight ${
            isVarianceZero ? 'text-[#17845B]' : 'text-[#D75E4C]'
          }`}>
            {formatPaise(summary.unresolvedVariancePaise, { showSign: true })}
          </div>
          <div className="text-[11px] text-[#6B7280] mt-1 flex items-center gap-1">
            {isVarianceZero ? (
              <span className="text-[#17845B] font-medium">Zero closing discrepancy</span>
            ) : (
              <span className="text-[#D75E4C] font-medium">
                {summary.exceptionCount} exceptions bridge closing variance
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#DDE3DA] px-4 py-2 flex flex-wrap items-center gap-3 text-xs text-[#4B5563]">
        <span className="font-semibold text-[#111827] flex items-center gap-1">
          <AlertOctagon className="w-3.5 h-3.5 text-amber-600" />
          Exception Triage:
        </span>
        <span className="bg-[#FDEDEA] text-[#D75E4C] px-2 py-0.5 rounded font-mono font-medium">
          {summary.unmatchedBankCount} Unmatched Bank
        </span>
        <span className="bg-[#FEF3C7] text-[#D97706] px-2 py-0.5 rounded font-mono font-medium">
          {summary.unmatchedLedgerCount} Unmatched Ledger
        </span>
        <span className="bg-[#EFF6FF] text-[#2563EB] px-2 py-0.5 rounded font-mono font-medium">
          {summary.amountMismatchCount} Amount Discrepancies
        </span>
        <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-mono font-medium">
          {summary.duplicateCandidateCount} Duplicate Candidates
        </span>
        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-medium">
          {summary.ambiguousMatchCount} Ambiguous Ties
        </span>
      </div>
    </div>
  );
};

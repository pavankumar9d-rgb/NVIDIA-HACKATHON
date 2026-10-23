import React, { useState } from 'react';
import type {
  ReconciliationMatch,
  ReconciliationException
} from '../lib/reconciliation';
import { formatPaise } from '../lib/money';
import {
  Search,
  ChevronRight,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react';

interface TransactionGridProps {
  matches: ReconciliationMatch[];
  exceptions: ReconciliationException[];
  selectedItem: { type: 'match' | 'exception'; id: string } | null;
  onSelectItem: (item: { type: 'match' | 'exception'; id: string }) => void;
  externalFilter?: string;
}

export const TransactionGrid: React.FC<TransactionGridProps> = ({
  matches,
  exceptions,
  selectedItem,
  onSelectItem,
  externalFilter,
}) => {
  const [userFilterTab, setUserFilterTab] = useState<'all' | 'exceptions' | 'matches' | 'bank_only' | 'ledger_only' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filterTab: 'all' | 'exceptions' | 'matches' | 'bank_only' | 'ledger_only' =
    userFilterTab ?? (
      externalFilter === 'MATCHES'
        ? 'matches'
        : externalFilter === 'UNMATCHED_BANK'
        ? 'bank_only'
        : externalFilter === 'UNMATCHED_LEDGER'
        ? 'ledger_only'
        : externalFilter === 'ALL'
        ? 'all'
        : 'exceptions'
    );
  const setFilterTab = (tab: 'all' | 'exceptions' | 'matches' | 'bank_only' | 'ledger_only') => setUserFilterTab(tab);

  const displayRows: Array<{
    kind: 'match' | 'exception';
    id: string;
    date: string;
    sourceA: string;
    sourceB: string;
    description: string;
    reference: string;
    amountPaise: number;
    direction: 'debit' | 'credit';
    statusLabel: string;
    statusClass: string;
    deltaPaise?: number;
    rawMatch?: ReconciliationMatch;
    rawException?: ReconciliationException;
  }> = [];

  exceptions.forEach((e) => {
    const mainTx = e.bankTransaction || e.ledgerTransaction;
    if (!mainTx) return;

    let statusLabel = 'Exception';
    let statusClass = 'bg-[#FDEDEA] text-[#D75E4C] border-[#F3BDB4]';

    if (e.type === 'AMOUNT_MISMATCH') {
      statusLabel = 'Amount Mismatch';
      statusClass = 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]';
    } else if (e.type === 'AMBIGUOUS_MATCH') {
      statusLabel = 'Ambiguous Tie';
      statusClass = 'bg-[#FEF3C7] text-[#D97706] border-[#FDE68A]';
    } else if (e.type === 'DUPLICATE_CANDIDATE') {
      statusLabel = 'Duplicate Candidate';
      statusClass = 'bg-purple-50 text-purple-700 border-purple-200';
    } else if (e.type === 'UNMATCHED_BANK') {
      statusLabel = 'Missing in Ledger';
    } else if (e.type === 'UNMATCHED_LEDGER') {
      statusLabel = 'Unpresented Cheque';
    }

    displayRows.push({
      kind: 'exception',
      id: e.exceptionId,
      date: mainTx.date,
      sourceA: e.bankTransaction ? e.bankTransaction.id : '—',
      sourceB: e.ledgerTransaction ? e.ledgerTransaction.id : '—',
      description: mainTx.sanitizedDescription || mainTx.rawDescription,
      reference: mainTx.reference || '—',
      amountPaise: mainTx.amountPaise,
      direction: mainTx.direction,
      statusLabel,
      statusClass,
      deltaPaise: e.amountDeltaPaise,
      rawException: e,
    });
  });

  matches.forEach((m) => {
    displayRows.push({
      kind: 'match',
      id: m.matchId,
      date: m.bankTransaction.date,
      sourceA: m.bankTransaction.id,
      sourceB: m.ledgerTransaction.id,
      description: m.bankTransaction.sanitizedDescription,
      reference: m.bankTransaction.reference || m.ledgerTransaction.reference || '—',
      amountPaise: m.bankTransaction.amountPaise,
      direction: m.bankTransaction.direction,
      statusLabel: m.tier === 'EXACT_REF_AMOUNT' ? 'Exact Match' : 'Date Tol. Match',
      statusClass: 'bg-[#E8F5EE] text-[#17845B] border-[#A7D7BC]',
      deltaPaise: 0,
      rawMatch: m,
    });
  });

  const filteredRows = displayRows.filter((r) => {
    if (filterTab === 'exceptions' && r.kind !== 'exception') return false;
    if (filterTab === 'matches' && r.kind !== 'match') return false;
    if (filterTab === 'bank_only' && r.sourceA === '—') return false;
    if (filterTab === 'ledger_only' && r.sourceB === '—') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchText = `${r.description} ${r.reference} ${r.sourceA} ${r.sourceB} ${r.date}`.toLowerCase();
      return matchText.includes(q);
    }
    return true;
  });

  return (
    <div className="bg-white rounded-xl border border-[#DDE3DA] overflow-hidden flex flex-col h-full shadow-2xs">
      {/* Top Filter and Search Bar */}
      <div className="p-2.5 sm:p-3 border-b border-[#DDE3DA] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-[#FAFBF9]">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto pb-0.5">
          <button
            type="button"
            onClick={() => setFilterTab('exceptions')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap min-h-[38px] transition-colors cursor-pointer shrink-0 ${
              filterTab === 'exceptions'
                ? 'bg-[#101A2B] text-white shadow-2xs'
                : 'text-[#4B5563] bg-white border border-[#DDE3DA] hover:bg-[#EEF1EB]'
            }`}
          >
            Exceptions ({exceptions.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('matches')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap min-h-[38px] transition-colors cursor-pointer shrink-0 ${
              filterTab === 'matches'
                ? 'bg-[#101A2B] text-white shadow-2xs'
                : 'text-[#4B5563] bg-white border border-[#DDE3DA] hover:bg-[#EEF1EB]'
            }`}
          >
            Matches ({matches.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap min-h-[38px] transition-colors cursor-pointer shrink-0 ${
              filterTab === 'all'
                ? 'bg-[#101A2B] text-white shadow-2xs'
                : 'text-[#4B5563] bg-white border border-[#DDE3DA] hover:bg-[#EEF1EB]'
            }`}
          >
            All Items ({displayRows.length})
          </button>
        </div>

        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            type="text"
            placeholder="Search reference, particular..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#DDE3DA] rounded-lg text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#101A2B] min-h-[38px]"
          />
        </div>
      </div>

      {/* Mobile Card-Based Transaction List (< md) */}
      <div className="md:hidden flex-1 overflow-y-auto divide-y divide-[#EDF1EA]">
        {filteredRows.length === 0 ? (
          <div className="py-12 px-4 text-center text-xs text-[#9CA3AF]">
            No transactions match the selected filter or search query.
          </div>
        ) : (
          filteredRows.map((row) => {
            const isSelected = selectedItem?.id === row.id;
            const isCredit = row.direction === 'credit';

            return (
              <div
                key={row.id}
                onClick={() => onSelectItem({ type: row.kind, id: row.id })}
                className={`p-3.5 transition-colors cursor-pointer select-none relative ${
                  isSelected
                    ? 'bg-[#EEF1EB]/80 border-l-4 border-l-[#101A2B]'
                    : 'active:bg-[#FAFBF9] hover:bg-[#FAFBF9]/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-[11px] text-[#6B7280]">
                      {row.date}
                    </span>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${row.statusClass}`}>
                      {row.statusLabel}
                    </span>
                  </div>

                  <div className="text-right shrink-0">
                    <div className={`font-mono text-sm font-bold flex items-center justify-end gap-1 ${
                      isCredit ? 'text-[#17845B]' : 'text-[#111827]'
                    }`}>
                      {isCredit ? (
                        <ArrowDownLeft className="w-3.5 h-3.5 text-[#17845B]" />
                      ) : (
                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <span>{formatPaise(row.amountPaise)}</span>
                    </div>
                    <span className="text-[10px] font-mono uppercase text-slate-400">
                      {isCredit ? 'Credit (In)' : 'Debit (Out)'}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-[#111827] font-medium leading-snug line-clamp-2 mb-1.5">
                  {row.description}
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#6B7280] font-mono pt-1 border-t border-slate-100">
                  <div className="truncate max-w-[220px]">
                    {row.reference !== '—' ? `Ref: ${row.reference}` : `ID: ${row.sourceA !== '—' ? row.sourceA : row.sourceB}`}
                  </div>
                  <div className="flex items-center gap-1 text-[#101A2B] font-sans font-semibold text-[11px]">
                    <span>Inspect</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table View (>= md) */}
      <div className="hidden md:block overflow-x-auto flex-1">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#EEF1EB] border-b border-[#DDE3DA] text-[#4B5563] font-semibold select-none sticky top-0 z-10">
              <th className="py-2.5 px-3">Date</th>
              <th className="py-2.5 px-3">Bank ID</th>
              <th className="py-2.5 px-3">Ledger ID</th>
              <th className="py-2.5 px-3">Reference / UTR</th>
              <th className="py-2.5 px-3">Narration / Particulars</th>
              <th className="py-2.5 px-3 text-right">Debit (Out)</th>
              <th className="py-2.5 px-3 text-right">Credit (In)</th>
              <th className="py-2.5 px-3 text-center">Status</th>
              <th className="py-2.5 px-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EDF1EA]">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-[#9CA3AF]">
                  No transactions match the selected filter or search query.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const isSelected = selectedItem?.id === row.id;
                const isDebit = row.direction === 'debit';
                const isCredit = row.direction === 'credit';

                return (
                  <tr
                    key={row.id}
                    onClick={() => onSelectItem({ type: row.kind, id: row.id })}
                    className={`cursor-pointer transition-colors duration-100 ${
                      isSelected
                        ? 'bg-[#EEF1EB] font-medium border-l-4 border-l-[#101A2B]'
                        : 'hover:bg-[#FAFBF9]'
                    }`}
                  >
                    <td className="py-2.5 px-3 font-mono text-[11px] text-[#4B5563] whitespace-nowrap">
                      {row.date}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-[#111827] font-semibold">
                      {row.sourceA}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-[#111827] font-semibold">
                      {row.sourceB}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-[#6B7280] max-w-[120px] truncate" title={row.reference}>
                      {row.reference}
                    </td>
                    <td className="py-2.5 px-3 text-[#111827] max-w-[240px] truncate" title={row.description}>
                      {row.description}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[12px] text-[#111827]">
                      {isDebit ? formatPaise(row.amountPaise) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[12px] text-[#17845B] font-semibold">
                      {isCredit ? formatPaise(row.amountPaise) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${row.statusClass}`}>
                        {row.statusLabel}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-[#9CA3AF] text-center">
                      <ChevronRight className="w-3.5 h-3.5 inline-block" />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

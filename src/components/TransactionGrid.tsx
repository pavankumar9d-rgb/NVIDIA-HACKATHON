import React, { useState } from 'react';
import type { 
  ReconciliationMatch, 
  ReconciliationException 
} from '../lib/reconciliation';
import { formatPaise } from '../lib/money';
import { 
  Search, 
  ChevronRight
} from 'lucide-react';

interface TransactionGridProps {
  matches: ReconciliationMatch[];
  exceptions: ReconciliationException[];
  selectedItem: { type: 'match' | 'exception'; id: string } | null;
  onSelectItem: (item: { type: 'match' | 'exception'; id: string }) => void;
}

export const TransactionGrid: React.FC<TransactionGridProps> = ({
  matches,
  exceptions,
  selectedItem,
  onSelectItem,
}) => {
  const [filterTab, setFilterTab] = useState<'all' | 'exceptions' | 'matches' | 'bank_only' | 'ledger_only'>('exceptions');
  const [searchQuery, setSearchQuery] = useState('');

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
      <div className="p-3 border-b border-[#DDE3DA] flex flex-col sm:flex-row items-center justify-between gap-2 bg-[#FAFBF9]">
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
          <button
            onClick={() => setFilterTab('exceptions')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              filterTab === 'exceptions'
                ? 'bg-[#101A2B] text-white'
                : 'text-[#6B7280] hover:bg-[#EEF1EB] hover:text-[#111827]'
            }`}
          >
            Exceptions ({exceptions.length})
          </button>
          <button
            onClick={() => setFilterTab('matches')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              filterTab === 'matches'
                ? 'bg-[#101A2B] text-white'
                : 'text-[#6B7280] hover:bg-[#EEF1EB] hover:text-[#111827]'
            }`}
          >
            Matches ({matches.length})
          </button>
          <button
            onClick={() => setFilterTab('all')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              filterTab === 'all'
                ? 'bg-[#101A2B] text-white'
                : 'text-[#6B7280] hover:bg-[#EEF1EB] hover:text-[#111827]'
            }`}
          >
            All Items ({displayRows.length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            type="text"
            placeholder="Search reference, description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1 bg-white border border-[#DDE3DA] rounded-md text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#101A2B]"
          />
        </div>
      </div>

      <div className="overflow-x-auto flex-1">
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

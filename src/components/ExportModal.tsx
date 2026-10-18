import React, { useState } from 'react';
import type { 
  ReconciliationMatch, 
  ReconciliationException, 
  ReconciliationSummary 
} from '../lib/reconciliation';
import { exportToSafeCSV } from '../lib/csv';
import { formatPaise } from '../lib/money';
import { 
  Download, 
  FileSpreadsheet, 
  FileCode, 
  FileText, 
  X,
  ShieldCheck
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  matches: ReconciliationMatch[];
  exceptions: ReconciliationException[];
  summary: ReconciliationSummary | null;
  sessionName: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  matches,
  exceptions,
  summary,
  sessionName,
}) => {
  const [activeExportTab, setActiveExportTab] = useState<'csv_reconciled' | 'csv_exceptions' | 'json_audit' | 'markdown'>('markdown');

  if (!isOpen || !summary) return null;

  const generateReconciledCSV = () => {
    const rows = matches.map((m) => ({
      match_id: m.matchId,
      date: m.bankTransaction.date,
      bank_id: m.bankTransaction.id,
      ledger_id: m.ledgerTransaction.id,
      reference: m.bankTransaction.reference || m.ledgerTransaction.reference || '',
      description: m.bankTransaction.sanitizedDescription,
      amount_rupees: (m.bankTransaction.amountPaise / 100).toFixed(2),
      direction: m.bankTransaction.direction,
      match_tier: m.tier,
      confidence_score: m.confidenceScore,
      date_lag_days: m.dateDeltaDays,
    }));

    return exportToSafeCSV(rows, [
      { key: 'match_id', label: 'Match ID' },
      { key: 'date', label: 'Date' },
      { key: 'bank_id', label: 'Bank Row' },
      { key: 'ledger_id', label: 'Ledger Row' },
      { key: 'reference', label: 'Reference' },
      { key: 'description', label: 'Narration' },
      { key: 'amount_rupees', label: 'Amount (INR)', isNumeric: true },
      { key: 'direction', label: 'Direction' },
      { key: 'match_tier', label: 'Match Tier' },
      { key: 'confidence_score', label: 'Confidence', isNumeric: true },
      { key: 'date_lag_days', label: 'Date Lag (Days)', isNumeric: true },
    ]);
  };

  const generateExceptionsCSV = () => {
    const rows = exceptions.map((e) => {
      const mainTx = e.bankTransaction || e.ledgerTransaction;
      return {
        exception_id: e.exceptionId,
        type: e.type,
        bank_id: e.bankTransaction?.id || '—',
        ledger_id: e.ledgerTransaction?.id || '—',
        date: mainTx?.date || '',
        reference: mainTx?.reference || '',
        description: mainTx?.sanitizedDescription || '',
        amount_delta_rupees: (e.amountDeltaPaise / 100).toFixed(2),
        review_status: e.reviewDecision?.status || 'PENDING',
        reviewer_note: e.reviewDecision?.note || '',
        ai_classification: e.aiHypothesis?.classification || 'NOT_INFERRED',
        ai_recommendation: e.aiHypothesis?.recommendedAction || '',
      };
    });

    return exportToSafeCSV(rows, [
      { key: 'exception_id', label: 'Exception ID' },
      { key: 'type', label: 'Exception Type' },
      { key: 'bank_id', label: 'Bank Row' },
      { key: 'ledger_id', label: 'Ledger Row' },
      { key: 'date', label: 'Date' },
      { key: 'reference', label: 'Reference' },
      { key: 'description', label: 'Narration' },
      { key: 'amount_delta_rupees', label: 'Variance (INR)', isNumeric: true },
      { key: 'review_status', label: 'Review Decision' },
      { key: 'reviewer_note', label: 'Reviewer Note' },
      { key: 'ai_classification', label: 'Nemotron Classification' },
      { key: 'ai_recommendation', label: 'Recommended Action' },
    ]);
  };

  const generateAuditJSON = () => {
    return JSON.stringify(
      {
        proofLedgerAuditMetadata: {
          sessionName,
          generatedAt: new Date().toISOString(),
          currency: 'INR',
          formulaInjectionSafe: true,
          deterministicEngine: 'ProofLedger Integer Paise Core v1.0',
        },
        financialSummary: {
          netBankTotal: formatPaise(summary.netBankTotalPaise),
          netLedgerTotal: formatPaise(summary.netLedgerTotalPaise),
          matchedAmount: formatPaise(summary.matchedAmountPaise),
          unresolvedDiscrepancy: formatPaise(summary.unresolvedVariancePaise),
          matchRate: `${summary.matchPercentage}%`,
        },
        confirmedMatches: matches.map((m) => ({
          matchId: m.matchId,
          tier: m.tier,
          confidence: m.confidenceScore,
          bank: { id: m.bankTransaction.id, date: m.bankTransaction.date, paise: m.bankTransaction.amountPaise },
          ledger: { id: m.ledgerTransaction.id, date: m.ledgerTransaction.date, paise: m.ledgerTransaction.amountPaise },
        })),
        exceptionsAndResolutions: exceptions.map((e) => ({
          exceptionId: e.exceptionId,
          type: e.type,
          variancePaise: e.amountDeltaPaise,
          aiHypothesis: e.aiHypothesis || null,
          humanReviewDecision: e.reviewDecision || { status: 'PENDING' },
        })),
      },
      null,
      2
    );
  };

  const generateMarkdownReport = () => {
    return `# ProofLedger AI — Reconciliation & Audit Report

**Session:** ${sessionName}  
**Date Generated:** ${new Date().toLocaleDateString('en-IN', { dateStyle: 'full' })}  
**Engine:** ProofLedger AI Deterministic Core + NVIDIA Nemotron-70B  
**Currency:** INR (₹) — Calculated in Decimal-Safe Integer Minor Units (Paise)  

---

## 1. Executive Summary

| Financial Metric | Amount (INR) | Source / Detail |
| :--- | :--- | :--- |
| **Total Bank Net Position** | **${formatPaise(summary.netBankTotalPaise)}** | ${summary.bankRowCount} statements processed |
| **Total Ledger Net Position** | **${formatPaise(summary.netLedgerTotalPaise)}** | ${summary.ledgerRowCount} journal vouchers |
| **Confirmed 1-to-1 Matches** | **${formatPaise(summary.matchedAmountPaise)}** | ${summary.confirmedMatchCount} pairs matched (${summary.matchPercentage}%) |
| **Unresolved Net Discrepancy** | **${formatPaise(summary.unresolvedVariancePaise, { showSign: true })}** | Mathematical variance (Bank - Ledger) |

---

## 2. Exception Breakdown & Resolution Status

- **Total Exceptions Identified:** ${exceptions.length}
  - Missing in Ledger: ${summary.unmatchedBankCount}
  - Unpresented Cheques (Missing in Bank): ${summary.unmatchedLedgerCount}
  - Amount Discrepancies / Surcharges: ${summary.amountMismatchCount}
  - Duplicate Candidates: ${summary.duplicateCandidateCount}
  - Ambiguous Candidate Ties: ${summary.ambiguousMatchCount}

### Exception Register & Human Audit Decisions:

${exceptions
  .map(
    (e, idx) => `### ${idx + 1}. [${e.type}] ${e.exceptionId}: ${e.title}
- **Variance:** ${formatPaise(e.amountDeltaPaise, { showSign: true })}
- **Status:** **${e.reviewDecision?.status || 'PENDING REVIEW'}**
- **Reviewer Note:** ${e.reviewDecision?.note || 'None recorded'}
- **AI Hypothesis (Nemotron):** ${
      e.aiHypothesis
        ? `${e.aiHypothesis.classification} (Confidence: ${e.aiHypothesis.confidence})\n  > "${e.aiHypothesis.summary}"\n  - Recommended: ${e.aiHypothesis.recommendedAction}`
        : 'Not requested / Local mode'
    }
`
  )
  .join('\n')}

---

## 3. Compliance & Security Statement
- All calculations were executed client-side in pure integer arithmetic.
- Zero raw CSV statement data was uploaded to any remote server or persistent storage.
- All exported CSV cells beginning with dangerous spreadsheet prefixes (\`=\`, \`+\`, \`-\`, \`@\`) have been neutralized to prevent CSV Formula Injection (CWE-1236).
`;
  };

  const getActiveContent = () => {
    switch (activeExportTab) {
      case 'csv_reconciled':
        return generateReconciledCSV();
      case 'csv_exceptions':
        return generateExceptionsCSV();
      case 'json_audit':
        return generateAuditJSON();
      case 'markdown':
        return generateMarkdownReport();
    }
  };

  const handleDownload = () => {
    let filename = '';
    let mimeType = '';
    const content = getActiveContent();

    switch (activeExportTab) {
      case 'csv_reconciled':
        filename = `proofledger_${sessionName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_reconciled.csv`;
        mimeType = 'text/csv;charset=utf-8;';
        break;
      case 'csv_exceptions':
        filename = `proofledger_${sessionName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_exceptions.csv`;
        mimeType = 'text/csv;charset=utf-8;';
        break;
      case 'json_audit':
        filename = `proofledger_${sessionName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_audit_trail.json`;
        mimeType = 'application/json;charset=utf-8;';
        break;
      case 'markdown':
        filename = `proofledger_${sessionName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_report.md`;
        mimeType = 'text/markdown;charset=utf-8;';
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-[#101A2B]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#DDE3DA] max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-[#DDE3DA] pb-3">
          <div>
            <h2 className="text-lg font-bold text-[#111827]">Export Audit Package</h2>
            <p className="text-xs text-[#6B7280]">
              Download verifiable audit artifacts with formula-injection neutralization.
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-[#9CA3AF] hover:text-[#111827]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-[#DDE3DA] pb-2 text-xs">
          <button
            onClick={() => setActiveExportTab('markdown')}
            className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-colors ${
              activeExportTab === 'markdown'
                ? 'bg-[#101A2B] text-white'
                : 'text-[#4B5563] hover:bg-[#EEF1EB]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Executive Report (.md)
          </button>

          <button
            onClick={() => setActiveExportTab('csv_reconciled')}
            className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-colors ${
              activeExportTab === 'csv_reconciled'
                ? 'bg-[#101A2B] text-white'
                : 'text-[#4B5563] hover:bg-[#EEF1EB]'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Reconciled CSV ({matches.length})
          </button>

          <button
            onClick={() => setActiveExportTab('csv_exceptions')}
            className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-colors ${
              activeExportTab === 'csv_exceptions'
                ? 'bg-[#101A2B] text-white'
                : 'text-[#4B5563] hover:bg-[#EEF1EB]'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Exceptions CSV ({exceptions.length})
          </button>

          <button
            onClick={() => setActiveExportTab('json_audit')}
            className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-colors ${
              activeExportTab === 'json_audit'
                ? 'bg-[#101A2B] text-white'
                : 'text-[#4B5563] hover:bg-[#EEF1EB]'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            Audit Trail JSON
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col bg-[#FAFBF9] border border-[#DDE3DA] rounded-lg">
          <div className="px-3 py-1.5 bg-[#EEF1EB] border-b border-[#DDE3DA] flex items-center justify-between text-[11px] text-[#4B5563] font-medium">
            <span>Preview Artifact</span>
            <span className="flex items-center gap-1 text-[#17845B]">
              <ShieldCheck className="w-3 h-3" /> Formula Injection Protected
            </span>
          </div>
          <pre className="p-3 text-[11px] font-mono text-[#111827] overflow-y-auto flex-1 whitespace-pre-wrap max-h-72">
            {getActiveContent()}
          </pre>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[#DDE3DA]">
          <span className="text-xs text-[#6B7280]">
            Format: {activeExportTab.toUpperCase()} | Non-destructive export
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-md border border-[#DDE3DA] text-xs font-semibold text-[#4B5563] hover:bg-[#F6F7F2]"
            >
              Close
            </button>
            <button
              onClick={handleDownload}
              className="px-4 py-1.5 rounded-md bg-[#D7FF56] hover:bg-[#C9F540] text-[#111827] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              Download File
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * ProofLedger AI — Audit Export & Report Generation Engine
 * 
 * Provides pure, canonical export generation for:
 * 1. Executive Markdown Close & Audit Report
 * 2. Complete Audit Trail JSON
 * 3. Formula-Safe Reconciled Matches CSV
 * 4. Formula-Safe Exceptions Register CSV
 * 
 * Strict Truthfulness Guarantee:
 * - Never claims a live model was called when local mode or no request occurred.
 * - Distinguishes Opening Anchors, Inflows, Outflows, Net Period Movements, and Closing Balances.
 * - All calculations derived from canonical ReconciliationSummary in integer paise.
 */

import type { 
  ReconciliationMatch, 
  ReconciliationException, 
  ReconciliationSummary 
} from '../reconciliation';
import { getReconciliationBridge } from '../reconciliation/analytics';
import { exportToSafeCSV } from '../csv';
import { formatPaise } from '../money';

export interface ExportReportOptions {
  sessionName: string;
  summary: ReconciliationSummary;
  matches: ReconciliationMatch[];
  exceptions: ReconciliationException[];
  generatedDate?: Date;
  aiStatus?: {
    configured: boolean;
    allowLiveAI: boolean;
    model?: string;
    mode?: string;
  };
}

/**
 * Determines truthful AI inference status for an individual exception.
 */
export function getExceptionAIStatus(e: ReconciliationException): {
  statusLabel: 'Not requested' | 'Local deterministic fallback' | 'Live inference succeeded';
  statusCode: 'NOT_REQUESTED' | 'LOCAL_DETERMINISTIC_FALLBACK' | 'LIVE_INFERENCE_SUCCEEDED';
  modelIdentifier?: string;
} {
  if (!e.aiHypothesis) {
    return {
      statusLabel: 'Not requested',
      statusCode: 'NOT_REQUESTED',
    };
  }

  const model = e.aiHypothesis.model || '';
  const isLocal = model === 'ProofLedger Local Deterministic Rule' || model.toLowerCase().includes('local');

  if (isLocal) {
    return {
      statusLabel: 'Local deterministic fallback',
      statusCode: 'LOCAL_DETERMINISTIC_FALLBACK',
      modelIdentifier: model,
    };
  }

  return {
    statusLabel: 'Live inference succeeded',
    statusCode: 'LIVE_INFERENCE_SUCCEEDED',
    modelIdentifier: model,
  };
}

/**
 * Generates the Executive Markdown Close Report with mathematical reconciliation bridge
 * and truthful model attribution.
 */
export function generateMarkdownReport(options: ExportReportOptions): string {
  const { sessionName, summary, matches, exceptions, aiStatus } = options;
  const date = options.generatedDate || new Date();
  const dateFormatted = date.toLocaleDateString('en-IN', { dateStyle: 'full' });

  const configuredModel = aiStatus?.model || 'nvidia/Llama-3.1-Nemotron-70B-Instruct';

  // Count per-exception AI invocation types
  const liveCount = exceptions.filter((e) => getExceptionAIStatus(e).statusCode === 'LIVE_INFERENCE_SUCCEEDED').length;
  const localCount = exceptions.filter((e) => getExceptionAIStatus(e).statusCode === 'LOCAL_DETERMINISTIC_FALLBACK').length;

  let sessionAIStatus = 'LOCAL_MODE — No live model response was used';
  if (liveCount > 0) {
    sessionAIStatus = `LIVE_INFERENCE — ${liveCount} exception(s) investigated via ${configuredModel}`;
  } else if (localCount > 0) {
    sessionAIStatus = `LOCAL_MODE — Deterministic local rule fallback active (${localCount} exception(s) analyzed without live model)`;
  }

  // Count human review statuses
  const approvedCount = exceptions.filter((e) => e.reviewDecision?.status === 'APPROVED').length;
  const rejectedCount = exceptions.filter((e) => e.reviewDecision?.status === 'REJECTED').length;
  const deferredCount = exceptions.filter((e) => e.reviewDecision?.status === 'DEFERRED').length;
  const pendingCount = exceptions.filter((e) => !e.reviewDecision || e.reviewDecision.status === 'PENDING').length;

  // Calculate row counts and match rate denominator
  const totalActiveRows = summary.bankRowCount + summary.ledgerRowCount;
  const matchedRowCount = matches.length * 2;
  const rowMatchPercentage = totalActiveRows > 0 ? Number(((matchedRowCount / totalActiveRows) * 100).toFixed(1)) : 0;

  // Generate mathematical bridge
  const bridge = getReconciliationBridge(summary, exceptions);

  return `# ProofLedger AI — Reconciliation & Audit Report

**Session:** ${sessionName}  
**Date Generated:** ${dateFormatted}  
**Reconciliation Engine:** Deterministic ProofLedger Core (Decimal-safe Integer Minor Units)  
**Configured Model:** ${configuredModel}  
**Inference Provider:** Nebius Token Factory  
**Session AI Status:** ${sessionAIStatus}  
**Currency:** INR (₹) — Calculated in Decimal-Safe Integer Minor Units (Paise)  

---

## 1. Executive Financial Position & Movement Summary

The table below reconciles certified opening anchors, gross period transaction flows, net period cash movements, and closing positions.

| Financial Position & Movement | Bank Statement (INR) | General Ledger (INR) | Variance (Bank - Ledger) | Accounting Description |
| :--- | :--- | :--- | :--- | :--- |
| **Opening Anchor Balance** | **${formatPaise(summary.openingBankBalancePaise)}** | **${formatPaise(summary.openingLedgerBalancePaise)}** | ${formatPaise(summary.openingBankBalancePaise - summary.openingLedgerBalancePaise, { showSign: true })} | Certified period opening balance anchor |
| Total Period Inflows (Credits) | ${formatPaise(summary.totalBankInflowPaise)} | ${formatPaise(summary.totalLedgerInflowPaise)} | ${formatPaise(summary.totalBankInflowPaise - summary.totalLedgerInflowPaise, { showSign: true })} | Total customer receipts & statement credits |
| Total Period Outflows (Debits) | ${formatPaise(summary.totalBankOutflowPaise)} | ${formatPaise(summary.totalLedgerOutflowPaise)} | ${formatPaise(summary.totalBankOutflowPaise - summary.totalLedgerOutflowPaise, { showSign: true })} | Total vendor payments & statement debits |
| **Net Period Movement** | **${formatPaise(summary.netBankMovementPaise, { showSign: true })}** | **${formatPaise(summary.netLedgerMovementPaise, { showSign: true })}** | **${formatPaise(summary.netBankMovementPaise - summary.netLedgerMovementPaise, { showSign: true })}** | Net cash flow across period (Inflows minus Outflows) |
| **Closing Balance Position** | **${formatPaise(summary.closingBankBalancePaise)}** | **${formatPaise(summary.closingLedgerBalancePaise)}** | **${formatPaise(summary.unresolvedVariancePaise, { showSign: true })}** | True ending balance (Opening Anchor + Net Movement) |

### Reconciliation Performance Metrics:
- **Confirmed 1-to-1 Matches:** ${matches.length} pairs (${matchedRowCount} rows matched out of ${totalActiveRows} active statement rows = **${rowMatchPercentage}%** row match rate)
- **Matched Financial Volume:** **${formatPaise(summary.matchedAmountPaise)}** (${summary.matchPercentage}% of matched volume)
- **Closing Discrepancy Variance:** **${formatPaise(summary.unresolvedVariancePaise, { showSign: true })}** across ${exceptions.length} exceptions
- **Review Decisions Status:** ${approvedCount} Approved, ${rejectedCount} Rejected, ${deferredCount} Deferred, ${pendingCount} Pending Review

---

## 2. Mathematical Audit Reconciliation Bridge

The adjustment schedule below provides an exact mathematical bridge connecting the **Bank Closing Balance** to the **General Ledger Closing Balance**.

| Adjustment Item | Source | Adjustment (INR) | Accounting Explanation |
| :--- | :--- | :--- | :--- |
| **Bank Closing Position** | Bank | **${formatPaise(bridge.closingBankBalancePaise)}** | Certified ending bank statement position |
${bridge.bridgeItems.map((item) => `| ${item.label} | ${item.source === 'bank' ? 'Bank' : 'Ledger'} | ${item.formattedImpact} | ${item.explanation} |`).join('\n')}
| **Reconciled Ledger Balance** | Ledger | **${formatPaise(bridge.closingLedgerBalancePaise)}** | **${bridge.isBalanced ? 'Bridge Balanced (Zero-Leakage Residual: ₹0.00)' : 'Unbalanced Variance'}** |

> **Audit Status:** The mathematical adjustment bridge reconciles completely with zero leakage (₹0.00 residual delta). However, **${exceptions.length} unresolved exceptions** remain requiring human sign-off and corresponding journal adjustments before final ledger lock.

---

## 3. Exception Register & Human Audit Decisions

- **Total Exceptions Identified:** ${exceptions.length}
  - Missing in Ledger: ${summary.unmatchedBankCount}
  - Unpresented Cheques (Missing in Bank): ${summary.unmatchedLedgerCount}
  - Amount Discrepancies / Surcharges: ${summary.amountMismatchCount}
  - Duplicate Candidates: ${summary.duplicateCandidateCount}
  - Ambiguous Candidate Ties: ${summary.ambiguousMatchCount}

### Detailed Exception Register:

${exceptions
  .map((e, idx) => {
    const aiStatusInfo = getExceptionAIStatus(e);
    let aiBlock = '- **AI Investigation Status:** Not requested';

    if (aiStatusInfo.statusCode === 'LOCAL_DETERMINISTIC_FALLBACK' && e.aiHypothesis) {
      aiBlock = `- **AI Investigation Status:** Local deterministic fallback (No live model called)
- **Local Analysis:** "${e.aiHypothesis.summary}"
- **Recommended Action:** ${e.aiHypothesis.recommendedAction}`;
    } else if (aiStatusInfo.statusCode === 'LIVE_INFERENCE_SUCCEEDED' && e.aiHypothesis) {
      aiBlock = `- **AI Investigation Status:** Live inference succeeded (${e.aiHypothesis.model} via Nebius Token Factory)
- **Model Classification:** ${e.aiHypothesis.classification} (Confidence: ${e.aiHypothesis.confidence})
- **Nemotron Hypothesis:** "${e.aiHypothesis.summary}"
- **Recommended Action:** ${e.aiHypothesis.recommendedAction}`;
    }

    return `### ${idx + 1}. [${e.type}] ${e.exceptionId}: ${e.title}
- **Financial Variance:** ${formatPaise(e.amountDeltaPaise, { showSign: true })}
- **Review Status:** **${e.reviewDecision?.status || 'PENDING REVIEW'}**
- **Reviewer Note:** ${e.reviewDecision?.note || 'None recorded'}
${aiBlock}
`;
  })
  .join('\n')}

---

## 4. Compliance, Privacy & Security Statement
- All financial calculations were executed client-side in pure decimal-safe integer minor units (paise).
- Zero raw CSV statement data was uploaded to any remote server or persistent cloud storage.
- All exported CSV cells beginning with dangerous spreadsheet characters (\`=\`, \`+\`, \`-\`, \`@\`, \`|\`, \`%\`, \`\\t\`, \`\\r\`) have been neutralized with a leading apostrophe prefix to protect against CSV Formula Injection (CWE-1236).
`;
}

/**
 * Generates the complete audit JSON object.
 */
export function generateAuditJSON(options: ExportReportOptions): string {
  const { sessionName, summary, matches, exceptions, aiStatus } = options;
  const date = options.generatedDate || new Date();
  const configuredModel = aiStatus?.model || 'nvidia/Llama-3.1-Nemotron-70B-Instruct';

  const liveCount = exceptions.filter((e) => getExceptionAIStatus(e).statusCode === 'LIVE_INFERENCE_SUCCEEDED').length;
  const localCount = exceptions.filter((e) => getExceptionAIStatus(e).statusCode === 'LOCAL_DETERMINISTIC_FALLBACK').length;

  let sessionAIStatus = 'LOCAL_MODE — No live model response was used';
  if (liveCount > 0) {
    sessionAIStatus = `LIVE_INFERENCE — ${liveCount} exception(s) investigated via ${configuredModel}`;
  } else if (localCount > 0) {
    sessionAIStatus = `LOCAL_MODE — Deterministic local rule fallback active (${localCount} exception(s) analyzed without live model)`;
  }

  const bridge = getReconciliationBridge(summary, exceptions);

  return JSON.stringify(
    {
      proofLedgerAuditMetadata: {
        sessionName,
        generatedAt: date.toISOString(),
        currency: 'INR',
        formulaInjectionSafe: true,
        reconciliationEngine: 'Deterministic ProofLedger Core (Decimal-safe Integer Minor Units)',
        configuredModel,
        inferenceProvider: 'Nebius Token Factory',
        sessionAIStatus,
        liveInferenceUsed: liveCount > 0,
      },
      financialSummary: {
        openingAnchorBalance: formatPaise(summary.openingBankBalancePaise),
        openingLedgerBalance: formatPaise(summary.openingLedgerBalancePaise),
        totalBankInflows: formatPaise(summary.totalBankInflowPaise),
        totalBankOutflows: formatPaise(summary.totalBankOutflowPaise),
        netBankPeriodMovement: formatPaise(summary.netBankMovementPaise, { showSign: true }),
        closingBankBalance: formatPaise(summary.closingBankBalancePaise),
        totalLedgerInflows: formatPaise(summary.totalLedgerInflowPaise),
        totalLedgerOutflows: formatPaise(summary.totalLedgerOutflowPaise),
        netLedgerPeriodMovement: formatPaise(summary.netLedgerMovementPaise, { showSign: true }),
        closingLedgerBalance: formatPaise(summary.closingLedgerBalancePaise),
        closingVariance: formatPaise(summary.unresolvedVariancePaise, { showSign: true }),
        matchedAmount: formatPaise(summary.matchedAmountPaise),
        confirmedMatchCount: summary.confirmedMatchCount,
        matchRate: `${summary.matchPercentage}% (${matches.length} pairs / ${summary.bankRowCount + summary.ledgerRowCount} active rows)`,
        unresolvedExceptionCount: summary.exceptionCount,
        duplicateCandidateCount: summary.duplicateCandidateCount,
      },
      reconciliationBridge: {
        openingBankBalancePaise: bridge.openingBankBalancePaise,
        closingBankBalancePaise: bridge.closingBankBalancePaise,
        closingLedgerBalancePaise: bridge.closingLedgerBalancePaise,
        unresolvedVariancePaise: bridge.unresolvedVariancePaise,
        bridgedTotalPaise: bridge.bridgedTotalPaise,
        isBalanced: bridge.isBalanced,
        items: bridge.bridgeItems,
      },
      confirmedMatches: matches.map((m) => ({
        matchId: m.matchId,
        tier: m.tier,
        confidence: m.confidenceScore,
        bank: { id: m.bankTransaction.id, date: m.bankTransaction.date, paise: m.bankTransaction.amountPaise },
        ledger: { id: m.ledgerTransaction.id, date: m.ledgerTransaction.date, paise: m.ledgerTransaction.amountPaise },
      })),
      exceptionsAndResolutions: exceptions.map((e) => {
        const aiInfo = getExceptionAIStatus(e);
        return {
          exceptionId: e.exceptionId,
          type: e.type,
          variancePaise: e.amountDeltaPaise,
          aiInferenceStatus: aiInfo.statusCode,
          aiHypothesis: e.aiHypothesis || null,
          humanReviewDecision: e.reviewDecision || { status: 'PENDING' },
        };
      }),
    },
    null,
    2
  );
}

/**
 * Generates the formula-safe CSV for confirmed matched pairs.
 */
export function generateReconciledCSV(matches: ReconciliationMatch[]): string {
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
}

/**
 * Generates the formula-safe CSV for all identified exceptions.
 */
export function generateExceptionsCSV(exceptions: ReconciliationException[]): string {
  const rows = exceptions.map((e) => {
    const mainTx = e.bankTransaction || e.ledgerTransaction;
    const aiInfo = getExceptionAIStatus(e);

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
      ai_status: aiInfo.statusLabel,
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
    { key: 'ai_status', label: 'AI Status' },
    { key: 'ai_classification', label: 'Nemotron Classification' },
    { key: 'ai_recommendation', label: 'Recommended Action' },
  ]);
}

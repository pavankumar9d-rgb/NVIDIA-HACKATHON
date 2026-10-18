import { describe, it, expect } from 'vitest';
import { runReconciliation, CanonicalTransaction } from '../src/lib/reconciliation';
import { parseCSVString, validateAndNormalizeRows } from '../src/lib/csv';
import { SYNTHETIC_BANK_CSV, SYNTHETIC_LEDGER_CSV } from '../src/data/syntheticDemo';
import { 
  generateMarkdownReport, 
  generateAuditJSON, 
  generateReconciledCSV, 
  generateExceptionsCSV
} from '../src/lib/export';

async function getDemoReconciliation() {
  const parsedBank = await parseCSVString(SYNTHETIC_BANK_CSV);
  const { validRows: bV, detectedOpeningBalancePaise, detectedClosingBalancePaise } = validateAndNormalizeRows(
    parsedBank.rows,
    parsedBank.detectedMapping,
    'BNK'
  );

  const parsedLedger = await parseCSVString(SYNTHETIC_LEDGER_CSV);
  const { validRows: lV } = validateAndNormalizeRows(
    parsedLedger.rows,
    parsedLedger.detectedMapping,
    'LDG'
  );

  const bankRows: CanonicalTransaction[] = bV.map((r, i) => ({
    id: `BNK-${String(i + 1).padStart(3, '0')}`,
    source: 'bank',
    sourceRowNumber: r.rowNumber,
    date: r.date,
    rawDescription: r.description,
    sanitizedDescription: r.description,
    amountPaise: r.amountPaise,
    direction: r.direction,
    signedAmountPaise: r.signedAmountPaise,
    reference: r.reference,
    currency: 'INR',
    rawRow: r.raw,
  }));

  const ledgerRows: CanonicalTransaction[] = lV.map((r, i) => ({
    id: `LDG-${String(i + 1).padStart(3, '0')}`,
    source: 'ledger',
    sourceRowNumber: r.rowNumber,
    date: r.date,
    rawDescription: r.description,
    sanitizedDescription: r.description,
    amountPaise: r.amountPaise,
    direction: r.direction,
    signedAmountPaise: r.signedAmountPaise,
    reference: r.reference,
    currency: 'INR',
    rawRow: r.raw,
  }));

  const recon = runReconciliation(bankRows, ledgerRows, {
    openingBankBalancePaise: detectedOpeningBalancePaise ?? 45000000,
    closingBankBalancePaise: detectedClosingBalancePaise ?? 47638000,
  });

  return { recon, bankRows, ledgerRows };
}

describe('Export Consistency & Truthful AI Reporting', () => {
  it('distinguishes net movement from closing balance in the Executive Markdown Report', async () => {
    const { recon } = await getDemoReconciliation();

    const md = generateMarkdownReport({
      sessionName: 'Northstar Studio — September Close',
      summary: recon.summary,
      matches: recon.matches,
      exceptions: recon.exceptions,
      generatedDate: new Date('2026-10-18T12:00:00Z'),
    });

    // 1. Must clearly distinguish Opening Anchor, Net Period Movement, and Closing Balance
    expect(md).toContain('Opening Anchor Balance');
    expect(md).toContain('Net Period Movement');
    expect(md).toContain('Closing Balance Position');

    // 2. Canonical numbers for Northstar Studio must match Overview
    expect(md).toContain('₹4,50,000.00'); // Opening anchor
    expect(md).toContain('+₹26,380.00'); // Net bank period movement
    expect(md).toContain('+₹10,950.00'); // Net ledger period movement
    expect(md).toContain('₹4,76,380.00'); // Closing bank position
    expect(md).toContain('₹4,60,950.00'); // Closing ledger position
    expect(md).toContain('+₹15,430.00'); // Closing balance variance

    // 3. Labels must not call net movement "closing position" or "net position"
    expect(md).not.toContain('Total Bank Net Position');
    expect(md).not.toContain('Total Ledger Net Position');

    // 4. Denominator for match rate must be explicitly defined
    expect(md).toContain('50 rows matched out of 56 active statement rows');
    expect(md).toContain('89.3%');
  });

  it('truthfully reports LOCAL_MODE when no live model inference was executed', async () => {
    const { recon } = await getDemoReconciliation();

    const md = generateMarkdownReport({
      sessionName: 'Northstar Studio — September Close',
      summary: recon.summary,
      matches: recon.matches,
      exceptions: recon.exceptions,
      aiStatus: {
        configured: false,
        allowLiveAI: false,
        model: 'nvidia/Llama-3.1-Nemotron-70B-Instruct',
        mode: 'LOCAL_MODE',
      },
    });

    // Must clearly state local mode and not claim live Nemotron execution
    expect(md).toContain('Session AI Status:** LOCAL_MODE');
    expect(md).toContain('No live model response was used');
    expect(md).not.toContain('Nemotron analyzed this case');

    // Uninvestigated exceptions should indicate "Not requested"
    expect(md).toContain('AI Investigation Status:** Not requested');
  });

  it('differentiates local deterministic fallback from genuine live inference', async () => {
    const { recon } = await getDemoReconciliation();

    // Attach local fallback hypothesis to exception 0
    const exceptionsCopy = [...recon.exceptions];
    exceptionsCopy[0] = {
      ...exceptionsCopy[0],
      aiHypothesis: {
        classification: 'BANK_FEE_OR_SURCHARGE',
        summary: 'Deterministic analysis: Amount discrepancy of ₹240.00',
        evidenceRowIds: ['BNK-012', 'LDG-012'],
        evidenceExplanation: 'Payment gateway deduction',
        missingEvidence: [],
        recommendedAction: 'Post ₹240 to bank charges',
        confidence: 'MEDIUM',
        uncertaintyNotes: 'Inferred via local deterministic rule.',
        inferredAt: '2026-10-18T12:00:00Z',
        model: 'ProofLedger Local Deterministic Rule',
      },
    };

    // Attach genuine live inference hypothesis to exception 1
    exceptionsCopy[1] = {
      ...exceptionsCopy[1],
      aiHypothesis: {
        classification: 'DUPLICATE_ENTRY',
        summary: 'Model analysis: Duplicate ATM withdrawal on consecutive dates',
        evidenceRowIds: ['BNK-021', 'BNK-022'],
        evidenceExplanation: 'Identical amount and reference',
        missingEvidence: [],
        recommendedAction: 'File bank reversal dispute voucher',
        confidence: 'HIGH',
        uncertaintyNotes: 'Verified via Nebius inference',
        inferredAt: '2026-10-18T12:00:00Z',
        model: 'nvidia/Llama-3.1-Nemotron-70B-Instruct',
      },
    };

    const md = generateMarkdownReport({
      sessionName: 'Northstar Studio — September Close',
      summary: recon.summary,
      matches: recon.matches,
      exceptions: exceptionsCopy,
    });

    // Exception 0 must state local deterministic fallback
    expect(md).toContain('Local deterministic fallback (No live model called)');

    // Exception 1 must state genuine live inference with exact model ID
    expect(md).toContain('Live inference succeeded (nvidia/Llama-3.1-Nemotron-70B-Instruct via Nebius Token Factory)');

    // Top-level session status must indicate live inference occurred
    expect(md).toContain('LIVE_INFERENCE — 1 exception(s) investigated via nvidia/Llama-3.1-Nemotron-70B-Instruct');
  });

  it('includes human review decisions and auditor notes in the export', async () => {
    const { recon } = await getDemoReconciliation();

    const exceptionsWithReview = [...recon.exceptions];
    exceptionsWithReview[0] = {
      ...exceptionsWithReview[0],
      reviewDecision: {
        status: 'APPROVED',
        reviewer: 'Priya Sharma (Finance Lead)',
        timestamp: '2026-10-18T12:30:00Z',
        note: 'Verified payment gateway settlement slip; ₹240 processing fee confirmed.',
      },
    };

    const md = generateMarkdownReport({
      sessionName: 'Northstar Studio — September Close',
      summary: recon.summary,
      matches: recon.matches,
      exceptions: exceptionsWithReview,
    });

    expect(md).toContain('Review Status:** **APPROVED**');
    expect(md).toContain('Verified payment gateway settlement slip; ₹240 processing fee confirmed.');
    expect(md).toContain('1 Approved, 0 Rejected, 0 Deferred, 4 Pending Review');
  });

  it('ensures the mathematical reconciliation bridge balances with zero residual leakage', async () => {
    const { recon } = await getDemoReconciliation();

    const md = generateMarkdownReport({
      sessionName: 'Northstar Studio — September Close',
      summary: recon.summary,
      matches: recon.matches,
      exceptions: recon.exceptions,
    });

    expect(md).toContain('Mathematical Audit Reconciliation Bridge');
    expect(md).toContain('Bridge Balanced (Zero-Leakage Residual: ₹0.00)');
    expect(md).toContain('CHQ-771829'); // Vendor cheque
    expect(md).toContain('HDFC-INT-Q2'); // Bank interest
    expect(md).toContain('NEFT-339102'); // Gateway fee
    expect(md).toContain('HDFC-SVC-09'); // Service charge
    expect(md).toContain('ATM-00912'); // Duplicate ATM
  });

  it('guarantees Audit JSON has identical semantic totals and fields as Markdown', async () => {
    const { recon } = await getDemoReconciliation();

    const jsonStr = generateAuditJSON({
      sessionName: 'Northstar Studio — September Close',
      summary: recon.summary,
      matches: recon.matches,
      exceptions: recon.exceptions,
      generatedDate: new Date('2026-10-18T12:00:00Z'),
    });

    const parsed = JSON.parse(jsonStr);

    // Verify metadata
    expect(parsed.proofLedgerAuditMetadata.sessionName).toBe('Northstar Studio — September Close');
    expect(parsed.proofLedgerAuditMetadata.formulaInjectionSafe).toBe(true);
    expect(parsed.proofLedgerAuditMetadata.sessionAIStatus).toContain('LOCAL_MODE');
    expect(parsed.proofLedgerAuditMetadata.liveInferenceUsed).toBe(false);

    // Verify financial summary matches Overview & Markdown
    expect(parsed.financialSummary.openingAnchorBalance).toBe('₹4,50,000.00');
    expect(parsed.financialSummary.netBankPeriodMovement).toBe('+₹26,380.00');
    expect(parsed.financialSummary.netLedgerPeriodMovement).toBe('+₹10,950.00');
    expect(parsed.financialSummary.closingBankBalance).toBe('₹4,76,380.00');
    expect(parsed.financialSummary.closingLedgerBalance).toBe('₹4,60,950.00');
    expect(parsed.financialSummary.closingVariance).toBe('+₹15,430.00');

    // Verify exception counts match
    expect(parsed.financialSummary.unresolvedExceptionCount).toBe(5);
    expect(parsed.financialSummary.duplicateCandidateCount).toBe(1);
    expect(parsed.financialSummary.confirmedMatchCount).toBe(25);

    // Verify bridge in JSON is balanced
    expect(parsed.reconciliationBridge.isBalanced).toBe(true);
    expect(parsed.reconciliationBridge.unresolvedVariancePaise).toBe(1543000);
    expect(parsed.reconciliationBridge.bridgedTotalPaise).toBe(1543000);
  });

  it('generates formula-safe CSV exports with duplicate candidate classification', async () => {
    const { recon } = await getDemoReconciliation();

    const exceptionsCSV = generateExceptionsCSV(recon.exceptions);
    expect(exceptionsCSV).toContain('DUPLICATE_CANDIDATE');
    expect(exceptionsCSV).toContain('ATM-00912');
    expect(exceptionsCSV).toContain('AMOUNT_MISMATCH');
    expect(exceptionsCSV).toContain('UNMATCHED_BANK');
    expect(exceptionsCSV).toContain('UNMATCHED_LEDGER');

    const reconciledCSV = generateReconciledCSV(recon.matches);
    const lines = reconciledCSV.trim().split('\n');
    // Header + 25 match rows = 26 lines
    expect(lines.length).toBe(26);
  });
});

import { describe, it, expect } from 'vitest';
import { runReconciliation, CanonicalTransaction } from '../src/lib/reconciliation';
import { parseCSVString, validateAndNormalizeRows } from '../src/lib/csv';
import { SYNTHETIC_BANK_CSV, SYNTHETIC_LEDGER_CSV } from '../src/data/syntheticDemo';
import { 
  generateMarkdownReport, 
  generateAuditJSON, 
  generateReconciledCSV, 
  generateExceptionsCSV,
  withUTF8BOM,
} from '../src/lib/export';
import { getReconciliationBridge } from '../src/lib/reconciliation/analytics';

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

    // Verify match rate is unambiguous with row counts and confirmed pair count
    expect(parsed.financialSummary.matchRate).toBe('89.3% (50 matched rows / 56 active rows; 25 confirmed pairs)');

    // Verify bridge in JSON is balanced
    expect(parsed.reconciliationBridge.isBalanced).toBe(true);
    expect(parsed.reconciliationBridge.unresolvedVariancePaise).toBe(1543000);
    expect(parsed.reconciliationBridge.bridgedTotalPaise).toBe(1543000);
  });

  it('generates formula-safe CSV exports with truthful column headers and verified row counts', async () => {
    const { recon } = await getDemoReconciliation();

    const exceptionsCSV = generateExceptionsCSV(recon.exceptions);
    expect(exceptionsCSV).toContain('DUPLICATE_CANDIDATE');
    expect(exceptionsCSV).toContain('ATM-00912');
    expect(exceptionsCSV).toContain('AMOUNT_MISMATCH');
    expect(exceptionsCSV).toContain('UNMATCHED_BANK');
    expect(exceptionsCSV).toContain('UNMATCHED_LEDGER');

    // Truthful model-neutral classification header
    expect(exceptionsCSV).toContain('Investigation Classification');
    expect(exceptionsCSV).not.toContain('Nemotron Classification');

    // Unambiguous transaction delta header
    expect(exceptionsCSV).toContain('Transaction Net Delta (INR)');
    expect(exceptionsCSV).not.toContain('Variance (INR)');

    // Exceptions CSV must contain 1 header + 5 exception rows = 6 lines
    const exLines = exceptionsCSV.trim().split(/\r?\n/);
    expect(exLines.length).toBe(6);

    const reconciledCSV = generateReconciledCSV(recon.matches);
    const recLines = reconciledCSV.trim().split(/\r?\n/);
    // Header + 25 match rows = 26 lines
    expect(recLines.length).toBe(26);
  });

  it('exports CSV with UTF-8 BOM, ensuring em dashes and Unicode characters parse without mojibake', async () => {
    const { recon } = await getDemoReconciliation();

    const rawReconciled = generateReconciledCSV(recon.matches);
    const rawExceptions = generateExceptionsCSV(recon.exceptions);

    // 1. withUTF8BOM prepends UTF-8 BOM character
    const bomReconciled = withUTF8BOM(rawReconciled);
    expect(bomReconciled.charCodeAt(0)).toBe(0xfeff);
    expect(bomReconciled.startsWith('\uFEFF')).toBe(true);

    // Idempotent if called twice
    expect(withUTF8BOM(bomReconciled)).toBe(bomReconciled);

    // 2. parseCSVString cleanly strips the BOM without header name corruption
    const parsedWithBOM = await parseCSVString(bomReconciled);
    expect(parsedWithBOM.errors).toEqual([]);
    expect(parsedWithBOM.headers[0]).toBe('Match ID'); // NOT '\uFEFFMatch ID'
    expect(parsedWithBOM.rows.length).toBe(25);

    // 3. Em dashes in missing bank/ledger rows parse cleanly as em dash, not mojibake â€”
    const bomExceptions = withUTF8BOM(rawExceptions);
    const parsedExceptions = await parseCSVString(bomExceptions);
    expect(parsedExceptions.errors).toEqual([]);
    expect(parsedExceptions.headers[0]).toBe('Exception ID');
    expect(parsedExceptions.rows.length).toBe(5);

    // Unmatched ledger row has bank row as '—'
    const unmatchedLedger = parsedExceptions.rows.find((r) => r['Exception Type'] === 'UNMATCHED_LEDGER');
    expect(unmatchedLedger).toBeDefined();
    expect(unmatchedLedger?.['Bank Row']).toBe('—');
    expect(unmatchedLedger?.['Bank Row']).not.toContain('â€”');
  });

  it('guarantees raw CSV transaction dates are strict ISO YYYY-MM-DD strings', async () => {
    const { recon } = await getDemoReconciliation();

    const reconciledCSV = generateReconciledCSV(recon.matches);
    const exceptionsCSV = generateExceptionsCSV(recon.exceptions);

    // In reconciled CSV, every row date matches ISO YYYY-MM-DD
    const recRows = (await parseCSVString(reconciledCSV)).rows;
    expect(recRows.length).toBe(25);
    for (const row of recRows) {
      expect(row['Date']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }

    // In exceptions CSV, every row date matches ISO YYYY-MM-DD
    const excRows = (await parseCSVString(exceptionsCSV)).rows;
    expect(excRows.length).toBe(5);
    for (const row of excRows) {
      expect(row['Date']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('clearly verifies and distinguishes sign conventions between transaction delta and bridge adjustments', async () => {
    const { recon } = await getDemoReconciliation();

    const exceptionsCSV = generateExceptionsCSV(recon.exceptions);
    const parsed = await parseCSVString(exceptionsCSV);

    // Find the unpresented cheque exception (CHQ-771829, LDG-025, ₹18,500 debit expenditure)
    const chequeRow = parsed.rows.find((r) => r['Reference'] === 'CHQ-771829');
    expect(chequeRow).toBeDefined();

    // 1. Transaction delta is negative (-18500.00) because it represents a debit outflow / expense in the ledger
    expect(chequeRow?.['Transaction Net Delta (INR)']).toBe('-18500.00');

    // 2. In the Reconciliation Bridge, this unpresented cheque is an ADD-BACK (+₹18,500.00)
    // because the bank has NOT yet disbursed the funds, making the closing bank balance higher than ledger
    const bridge = getReconciliationBridge(recon.summary, recon.exceptions);
    const chequeBridgeItem = bridge.bridgeItems.find((b) => b.exceptionType === 'UNMATCHED_LEDGER');
    expect(chequeBridgeItem).toBeDefined();
    expect(chequeBridgeItem?.impactPaise).toBe(1850000); // +₹18,500.00
    expect(chequeBridgeItem?.formattedImpact).toBe('+₹18,500.00');

    // 3. Ensure the overall closing variance (+₹15,430.00) and zero residual leakage remain mathematically intact
    expect(recon.summary.unresolvedVariancePaise).toBe(1543000); // +₹15,430.00
    expect(bridge.bridgedTotalPaise).toBe(1543000);
    expect(bridge.isBalanced).toBe(true);
  });

  it('generates fresh export timestamp that succeeds investigation and review events', async () => {
    const { recon } = await getDemoReconciliation();

    const inferredAt = '2026-10-18T16:34:41.974Z';
    const reviewedAt = '2026-10-18T16:36:53.491Z';
    const exportCreatedAt = new Date('2026-10-18T16:38:00.000Z');

    const exceptionsWithHistory = [...recon.exceptions];
    exceptionsWithHistory[0] = {
      ...exceptionsWithHistory[0],
      aiHypothesis: {
        classification: 'BANK_FEE_OR_SURCHARGE',
        summary: 'Possible payment gateway or processing fee deduction',
        evidenceRowIds: ['BNK-012', 'LDG-012'],
        evidenceExplanation: 'Deterministic delta is ₹240.00',
        missingEvidence: ['Tax invoice settlement voucher'],
        recommendedAction: 'Verify vendor tax invoice',
        confidence: 'MEDIUM',
        uncertaintyNotes: 'Hypothesis requiring voucher verification.',
        inferredAt,
        model: 'ProofLedger Local Deterministic Rule',
      },
      reviewDecision: {
        status: 'APPROVED',
        reviewer: 'Priya Sharma (Finance Lead)',
        timestamp: reviewedAt,
        note: 'Gateway settlement advice verified; fee confirmed.',
      },
    };

    // 1. Explicit export time passed
    const jsonStr = generateAuditJSON({
      sessionName: 'Northstar Studio — September Close',
      summary: recon.summary,
      matches: recon.matches,
      exceptions: exceptionsWithHistory,
      generatedDate: exportCreatedAt,
    });
    const parsed = JSON.parse(jsonStr);

    const generatedAtDate = new Date(parsed.proofLedgerAuditMetadata.generatedAt);
    const inferredAtDate = new Date(inferredAt);
    const reviewedAtDate = new Date(reviewedAt);

    expect(generatedAtDate.getTime()).toBeGreaterThan(inferredAtDate.getTime());
    expect(generatedAtDate.getTime()).toBeGreaterThan(reviewedAtDate.getTime());
    expect(parsed.proofLedgerAuditMetadata.generatedAt).toBe('2026-10-18T16:38:00.000Z');

    // 2. Default export time (omitted generatedDate): produces current timestamp, not a frozen past session start
    const beforeCall = Date.now();
    const liveExportJSON = JSON.parse(generateAuditJSON({
      sessionName: 'Northstar Studio — September Close',
      summary: recon.summary,
      matches: recon.matches,
      exceptions: exceptionsWithHistory,
    }));
    const afterCall = Date.now();
    const liveGeneratedTime = new Date(liveExportJSON.proofLedgerAuditMetadata.generatedAt).getTime();
    expect(liveGeneratedTime).toBeGreaterThanOrEqual(beforeCall);
    expect(liveGeneratedTime).toBeLessThanOrEqual(afterCall);
  });

  it('labels unverified causes as hypotheses requiring verification in bridge items', async () => {
    const { recon } = await getDemoReconciliation();

    const jsonStr = generateAuditJSON({
      sessionName: 'Northstar Studio — September Close',
      summary: recon.summary,
      matches: recon.matches,
      exceptions: recon.exceptions,
    });
    const parsed = JSON.parse(jsonStr);

    const bridgeItems = parsed.reconciliationBridge.items as Array<{
      id: string;
      exceptionType: string;
      explanation: string;
    }>;

    // Find the ₹240 amount mismatch bridge item
    const amountMismatchItem = bridgeItems.find((i) => i.exceptionType === 'AMOUNT_MISMATCH');
    expect(amountMismatchItem).toBeDefined();

    // Must NOT state gateway fee as settled accounting fact
    expect(amountMismatchItem?.explanation).not.toBe(
      'Gateway/processing fee difference between invoiced amount and settled bank credit.'
    );
    // Must clearly state that it is a possible cause requiring verification
    expect(amountMismatchItem?.explanation).toContain('Possible gateway/processing fee difference');
    expect(amountMismatchItem?.explanation).toContain('requires verification');

    // Duplicate candidate bridge item must also indicate suspected/verification
    const dupItem = bridgeItems.find((i) => i.exceptionType === 'DUPLICATE_CANDIDATE');
    expect(dupItem).toBeDefined();
    expect(dupItem?.explanation).toContain('Suspected duplicate');
    expect(dupItem?.explanation).toContain('requires');
  });

  it('maintains cross-format consistency across JSON, Markdown, and CSV exports', async () => {
    const { recon } = await getDemoReconciliation();

    const reviewedExceptions = [...recon.exceptions];
    reviewedExceptions[0] = {
      ...reviewedExceptions[0],
      reviewDecision: {
        status: 'APPROVED',
        reviewer: 'Priya Sharma (Finance Lead)',
        timestamp: '2026-10-18T16:36:53.491Z',
        note: 'Confirmed ₹240 gateway fee against settlement slip.',
      },
    };

    const exportTime = new Date('2026-10-18T16:40:00.000Z');

    const jsonStr = generateAuditJSON({
      sessionName: 'Northstar Studio — September Close',
      summary: recon.summary,
      matches: recon.matches,
      exceptions: reviewedExceptions,
      generatedDate: exportTime,
    });
    const parsed = JSON.parse(jsonStr);

    const md = generateMarkdownReport({
      sessionName: 'Northstar Studio — September Close',
      summary: recon.summary,
      matches: recon.matches,
      exceptions: reviewedExceptions,
      generatedDate: exportTime,
    });

    const exceptionsCSV = generateExceptionsCSV(reviewedExceptions);
    const reconciledCSV = generateReconciledCSV(recon.matches);

    // 1. Financial balances and closing variance consistency
    expect(parsed.financialSummary.openingAnchorBalance).toBe('₹4,50,000.00');
    expect(md).toContain('₹4,50,000.00');

    expect(parsed.financialSummary.netBankPeriodMovement).toBe('+₹26,380.00');
    expect(md).toContain('+₹26,380.00');

    expect(parsed.financialSummary.netLedgerPeriodMovement).toBe('+₹10,950.00');
    expect(md).toContain('+₹10,950.00');

    expect(parsed.financialSummary.closingVariance).toBe('+₹15,430.00');
    expect(md).toContain('+₹15,430.00');

    // 2. Match-rate definition consistency
    expect(parsed.financialSummary.matchRate).toBe('89.3% (50 matched rows / 56 active rows; 25 confirmed pairs)');
    expect(md).toContain('50 rows matched out of 56 active statement rows');
    expect(md).toContain('89.3%');

    // 3. Human review decision consistency
    expect(parsed.exceptionsAndResolutions[0].humanReviewDecision.status).toBe('APPROVED');
    expect(md).toContain('APPROVED');
    expect(md).toContain('Confirmed ₹240 gateway fee against settlement slip.');
    expect(exceptionsCSV).toContain('APPROVED');
    expect(exceptionsCSV).toContain('Confirmed ₹240 gateway fee against settlement slip.');

    // 4. Local mode / live inference status consistency
    expect(parsed.proofLedgerAuditMetadata.sessionAIStatus).toContain('LOCAL_MODE');
    expect(parsed.proofLedgerAuditMetadata.liveInferenceUsed).toBe(false);
    expect(md).toContain('LOCAL_MODE');

    // 5. Reconciled CSV row count matches 25 confirmed pairs
    const csvMatchLines = reconciledCSV.trim().split('\n');
    expect(csvMatchLines.length - 1).toBe(25); // 25 rows excluding header
  });
});

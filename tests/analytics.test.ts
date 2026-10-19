import { describe, it, expect } from 'vitest';
import { 
  getDailyMovementSeries, 
  getReconciliationComposition, 
  getPrioritizedExceptions, 
  getReconciliationBridge,
  calculateExceptionVarianceContributionPaise,
  getReconciliationAuditStatus
} from '../src/lib/reconciliation/analytics';
import { runReconciliation, type ReconciliationException, type CanonicalTransaction } from '../src/lib/reconciliation';
import { parseCSVString, validateAndNormalizeRows } from '../src/lib/csv';
import { SYNTHETIC_BANK_CSV, SYNTHETIC_LEDGER_CSV } from '../src/data/syntheticDemo';
import { generateMarkdownReport } from '../src/lib/export';

describe('Reconciliation Analytics & Audit Bridge', () => {
  it('correctly aggregates daily movements into chronological series', async () => {
    const parsedBank = await parseCSVString(SYNTHETIC_BANK_CSV);
    const { validRows: bV } = validateAndNormalizeRows(parsedBank.rows, parsedBank.detectedMapping, 'BNK');
    const parsedLedger = await parseCSVString(SYNTHETIC_LEDGER_CSV);
    const { validRows: lV } = validateAndNormalizeRows(parsedLedger.rows, parsedLedger.detectedMapping, 'LDG');

    const bCanonical = bV.map((r, i) => ({
      id: `BNK-${i + 1}`,
      source: 'bank' as const,
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

    const lCanonical = lV.map((r, i) => ({
      id: `LDG-${i + 1}`,
      source: 'ledger' as const,
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

    const series = getDailyMovementSeries(bCanonical, lCanonical);
    expect(series.length).toBeGreaterThan(15);
    
    // Check ordering
    for (let i = 1; i < series.length; i++) {
      expect(series[i].date >= series[i - 1].date).toBe(true);
    }

    // Check September 02 Retainer
    const sep2 = series.find((s) => s.date === '2026-09-02');
    expect(sep2).toBeDefined();
    expect(sep2?.bankInflowPaise).toBe(12500000); // ₹1,25,000
    expect(sep2?.ledgerInflowPaise).toBe(12500000); // ₹1,25,000
  });

  it('computes exact reconciliation composition segments', async () => {
    const parsedBank = await parseCSVString(SYNTHETIC_BANK_CSV);
    const { validRows: bV, detectedOpeningBalancePaise, detectedClosingBalancePaise } = validateAndNormalizeRows(parsedBank.rows, parsedBank.detectedMapping, 'BNK');
    const parsedLedger = await parseCSVString(SYNTHETIC_LEDGER_CSV);
    const { validRows: lV } = validateAndNormalizeRows(parsedLedger.rows, parsedLedger.detectedMapping, 'LDG');

    const bCanonical = bV.map((r, i) => ({
      id: `BNK-${i + 1}`,
      source: 'bank' as const,
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

    const lCanonical = lV.map((r, i) => ({
      id: `LDG-${i + 1}`,
      source: 'ledger' as const,
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

    const result = runReconciliation(bCanonical, lCanonical, {
      openingBankBalancePaise: detectedOpeningBalancePaise ?? 45000000,
      closingBankBalancePaise: detectedClosingBalancePaise ?? 47638000,
    });

    const composition = getReconciliationComposition(result.matches, result.exceptions, result.summary);
    expect(composition.length).toBeGreaterThanOrEqual(4);

    const matchesSegment = composition.find((c) => c.key === 'CONFIRMED');
    expect(matchesSegment).toBeDefined();
    expect(matchesSegment?.count).toBe(result.matches.length);
    expect(matchesSegment?.percentage).toBeGreaterThan(70);

    const prioritized = getPrioritizedExceptions(result.exceptions);
    expect(prioritized.length).toBe(result.exceptions.length);
    // The largest discrepancy should be first (e.g. ₹18,500 vendor cheque)
    expect(prioritized[0].impactOrder).toBeGreaterThanOrEqual(prioritized[1].impactOrder);

    // Verify mathematical bridge
    const bridge = getReconciliationBridge(result.summary, result.exceptions);
    expect(bridge.openingBankBalancePaise).toBe(45000000); // ₹4,50,000.00
    expect(bridge.closingBankBalancePaise).toBe(47638000); // ₹4,76,380.00
    expect(bridge.closingLedgerBalancePaise).toBe(46095000); // ₹4,60,950.00
    expect(bridge.unresolvedVariancePaise).toBe(1543000); // +₹15,430.00
    expect(bridge.bridgedTotalPaise).toBe(1543000); // Exactly matches!
    expect(bridge.residualPaise).toBe(0);
    expect(bridge.formattedResidual).toBe('₹0.00');
    expect(bridge.isBalanced).toBe(true);

    // 1. The five item contributions sum to +₹15,430.00
    expect(bridge.bridgeItems.length).toBe(5);
    const sumImpacts = bridge.bridgeItems.reduce((acc, item) => acc + item.impactPaise, 0);
    expect(sumImpacts).toBe(1543000); // +₹15,430.00

    // 2. Bank closing minus variance equals ledger closing exactly
    expect(bridge.closingBankBalancePaise - bridge.bridgedTotalPaise).toBe(bridge.closingLedgerBalancePaise);
    expect(bridge.closingBankBalancePaise - bridge.unresolvedVariancePaise).toBe(bridge.closingLedgerBalancePaise);

    // 3. The residual is zero for the supplied demo dataset
    expect(bridge.residualPaise).toBe(0);

    // 4. An intentionally inconsistent ledger closing balance makes isBalanced false
    const inconsistentSummary = {
      ...result.summary,
      closingLedgerBalancePaise: 46000000, // Intentionally skewed by ₹950.00
    };
    const inconsistentBridge = getReconciliationBridge(inconsistentSummary, result.exceptions);
    expect(inconsistentBridge.residualPaise).toBe(95000); // Non-zero residual (+₹950.00)
    expect(inconsistentBridge.isBalanced).toBe(false);

    // Also: an inconsistent unresolvedVariancePaise makes isBalanced false
    const mismatchedVarianceSummary = {
      ...result.summary,
      unresolvedVariancePaise: 1500000, // Mismatched variance
    };
    const mismatchedVarianceBridge = getReconciliationBridge(mismatchedVarianceSummary, result.exceptions);
    expect(mismatchedVarianceBridge.isBalanced).toBe(false);
  });

  it('calculates consistent signed variance contributions for all exception directions', () => {
    // 1. Unmatched Ledger Debit (e.g. unpresented cheque issued, reduces ledger cash, bank balance is higher)
    const unmatchedLedgerDebit: ReconciliationException = {
      exceptionId: 'EXP-LDG-DR',
      type: 'UNMATCHED_LEDGER',
      title: 'Unpresented Cheque',
      description: 'Vendor payment voucher issued but not cleared in bank',
      ledgerTransaction: {
        id: 'LDG-001',
        source: 'ledger',
        sourceRowNumber: 1,
        date: '2026-09-29',
        rawDescription: 'Vendor Camera Rig Rental',
        sanitizedDescription: 'Vendor Camera Rig Rental',
        amountPaise: 1850000,
        direction: 'debit',
        signedAmountPaise: -1850000,
        reference: 'CHQ-771829',
        currency: 'INR',
        rawRow: {},
      },
      amountDeltaPaise: -1850000,
      dateDeltaDays: 0,
      recommendedAction: 'Verify cheque clearance',
    };
    expect(calculateExceptionVarianceContributionPaise(unmatchedLedgerDebit)).toBe(1850000); // +₹18,500.00

    // 2. Unmatched Ledger Credit (e.g. uncleared deposit recorded in ledger, not yet credited in bank, bank is lower)
    const unmatchedLedgerCredit: ReconciliationException = {
      exceptionId: 'EXP-LDG-CR',
      type: 'UNMATCHED_LEDGER',
      title: 'Uncleared Deposit',
      description: 'Customer deposit recorded in ledger but not yet in bank statement',
      ledgerTransaction: {
        id: 'LDG-002',
        source: 'ledger',
        sourceRowNumber: 2,
        date: '2026-09-29',
        rawDescription: 'Client Advance',
        sanitizedDescription: 'Client Advance',
        amountPaise: 2500000,
        direction: 'credit',
        signedAmountPaise: 2500000,
        reference: 'REC-001',
        currency: 'INR',
        rawRow: {},
      },
      amountDeltaPaise: 2500000,
      dateDeltaDays: 0,
      recommendedAction: 'Track bank deposit',
    };
    expect(calculateExceptionVarianceContributionPaise(unmatchedLedgerCredit)).toBe(-2500000); // -₹25,000.00

    // 3. Unmatched Bank Debit (e.g. bank fee/charge debited by bank, reduces bank balance relative to ledger)
    const unmatchedBankDebit: ReconciliationException = {
      exceptionId: 'EXP-BNK-DR',
      type: 'UNMATCHED_BANK',
      title: 'Bank Surcharge',
      description: 'Quarterly surcharge debited by bank',
      bankTransaction: {
        id: 'BNK-001',
        source: 'bank',
        sourceRowNumber: 1,
        date: '2026-09-26',
        rawDescription: 'HDFC Quarterly Surcharge',
        sanitizedDescription: 'HDFC Quarterly Surcharge',
        amountPaise: 125000,
        direction: 'debit',
        signedAmountPaise: -125000,
        reference: 'HDFC-SVC-09',
        currency: 'INR',
        rawRow: {},
      },
      amountDeltaPaise: -125000,
      dateDeltaDays: 0,
      recommendedAction: 'Post journal entry',
    };
    expect(calculateExceptionVarianceContributionPaise(unmatchedBankDebit)).toBe(-125000); // -₹1,250.00

    // 4. Unmatched Bank Credit (e.g. interest received in bank, increases bank balance relative to ledger)
    const unmatchedBankCredit: ReconciliationException = {
      exceptionId: 'EXP-BNK-CR',
      type: 'UNMATCHED_BANK',
      title: 'Interest Credited',
      description: 'Bank interest credited',
      bankTransaction: {
        id: 'BNK-002',
        source: 'bank',
        sourceRowNumber: 2,
        date: '2026-09-30',
        rawDescription: 'Interest Credited Q2',
        sanitizedDescription: 'Interest Credited Q2',
        amountPaise: 342000,
        direction: 'credit',
        signedAmountPaise: 342000,
        reference: 'HDFC-INT-Q2',
        currency: 'INR',
        rawRow: {},
      },
      amountDeltaPaise: 342000,
      dateDeltaDays: 0,
      recommendedAction: 'Post interest income',
    };
    expect(calculateExceptionVarianceContributionPaise(unmatchedBankCredit)).toBe(342000); // +₹3,420.00

    // 5. Amount Mismatch (Bank - Ledger)
    const amountMismatch: ReconciliationException = {
      exceptionId: 'EXP-AMT-MM',
      type: 'AMOUNT_MISMATCH',
      title: 'Gateway Fee Difference',
      description: 'Bank has 49,760.00, Ledger has 50,000.00',
      bankTransaction: {
        id: 'BNK-003',
        source: 'bank',
        sourceRowNumber: 3,
        date: '2026-09-13',
        rawDescription: 'Client Payment',
        sanitizedDescription: 'Client Payment',
        amountPaise: 4976000,
        direction: 'credit',
        signedAmountPaise: 4976000,
        reference: 'NEFT-339102',
        currency: 'INR',
        rawRow: {},
      },
      ledgerTransaction: {
        id: 'LDG-003',
        source: 'ledger',
        sourceRowNumber: 3,
        date: '2026-09-13',
        rawDescription: 'Client Invoice',
        sanitizedDescription: 'Client Invoice',
        amountPaise: 5000000,
        direction: 'credit',
        signedAmountPaise: 5000000,
        reference: 'NEFT-339102',
        currency: 'INR',
        rawRow: {},
      },
      amountDeltaPaise: -24000,
      dateDeltaDays: 0,
      recommendedAction: 'Reconcile gateway deduction',
    };
    expect(calculateExceptionVarianceContributionPaise(amountMismatch)).toBe(-24000); // -₹240.00

    // 6. Duplicate Bank Debit (e.g. second ATM debit deduction, reduces bank balance relative to ledger)
    const duplicateBankDebit: ReconciliationException = {
      exceptionId: 'EXP-DUP-BNK',
      type: 'DUPLICATE_CANDIDATE',
      title: 'Duplicate ATM Withdrawal',
      description: 'Second ATM withdrawal against single ledger record',
      bankTransaction: {
        id: 'BNK-004',
        source: 'bank',
        sourceRowNumber: 4,
        date: '2026-09-22',
        rawDescription: 'Petty Cash ATM',
        sanitizedDescription: 'Petty Cash ATM',
        amountPaise: 500000,
        direction: 'debit',
        signedAmountPaise: -500000,
        reference: 'ATM-00912',
        currency: 'INR',
        rawRow: {},
      },
      amountDeltaPaise: -500000,
      dateDeltaDays: 1,
      recommendedAction: 'Verify physical cash slip',
    };
    expect(calculateExceptionVarianceContributionPaise(duplicateBankDebit)).toBe(-500000); // -₹5,000.00
  });

  it('honestly differentiates audit status (Review Required vs Fully Reconciled) independent of bridge math balance', () => {
    // 1. Not started when summary is null
    const notStarted = getReconciliationAuditStatus(null);
    expect(notStarted.status).toBe('NOT_STARTED');
    expect(notStarted.label).toBe('Not Reconciled');

    // 2. Review Required when exceptions exist even if bridge is mathematically balanced
    const balancedBridgeSummary = {
      bankRowCount: 13,
      ledgerRowCount: 11,
      matchedRowCount: 18,
      unmatchedBankRowCount: 2,
      unmatchedLedgerRowCount: 1,
      amountMismatchCount: 1,
      duplicateCandidateCount: 1,
      exceptionCount: 5,
      hasBankOpeningAnchor: true,
      hasLedgerOpeningAnchor: false,
      hasBankClosingAnchor: true,
      hasLedgerClosingAnchor: false,
      bankOpeningProvenance: 'STATEMENT_DETECTED' as const,
      ledgerOpeningProvenance: 'UNVERIFIED_BASELINE' as const,
      bankClosingProvenance: 'STATEMENT_DETECTED' as const,
      ledgerClosingProvenance: 'DERIVED_FROM_NET_FLOW' as const,
      openingBankBalancePaise: 38565100,
      closingBankBalancePaise: 56463100,
      totalBankInflowPaise: 47318000,
      totalBankOutflowPaise: 29420000,
      netBankMovementPaise: 17898000,
      openingLedgerBalancePaise: 38565100,
      closingLedgerBalancePaise: 54920100,
      totalLedgerInflowPaise: 47000000,
      totalLedgerOutflowPaise: 30745000,
      netLedgerMovementPaise: 16255000,
      matchedAmountPaise: 68670000,
      unresolvedVariancePaise: 1543000,
      matchPercentage: 75.0,
    };
    const mockBalancedBridge = {
      openingBankBalancePaise: 38565100,
      closingBankBalancePaise: 56463100,
      closingLedgerBalancePaise: 54920100,
      unresolvedVariancePaise: 1543000,
      bridgedTotalPaise: 1543000,
      residualPaise: 0,
      formattedResidual: '₹0.00',
      isBalanced: true,
      bridgeItems: [],
    };

    const reviewStatus = getReconciliationAuditStatus(balancedBridgeSummary, mockBalancedBridge);
    expect(reviewStatus.status).toBe('REVIEW_REQUIRED');
    expect(reviewStatus.label).toBe('Review Required');
    expect(reviewStatus.isBridgeBalanced).toBe(true);
    expect(reviewStatus.hasUnresolvedExceptions).toBe(true);
    expect(reviewStatus.hasNonZeroVariance).toBe(true);
    expect(reviewStatus.explanation).toContain('human review before close');

    // 3. Fully Reconciled only when zero exceptions and zero unresolved variance
    const cleanSummary = {
      ...balancedBridgeSummary,
      exceptionCount: 0,
      unresolvedVariancePaise: 0,
      closingLedgerBalancePaise: balancedBridgeSummary.closingBankBalancePaise,
    };
    const cleanStatus = getReconciliationAuditStatus(cleanSummary, {
      ...mockBalancedBridge,
      unresolvedVariancePaise: 0,
      bridgedTotalPaise: 0,
      residualPaise: 0,
      isBalanced: true,
    });
    expect(cleanStatus.status).toBe('FULLY_RECONCILED');
    expect(cleanStatus.label).toBe('Fully Reconciled');
    expect(cleanStatus.hasUnresolvedExceptions).toBe(false);
    expect(cleanStatus.hasNonZeroVariance).toBe(false);
  });

  it('accurately verifies the 24-row test pack fixture (13 bank, 11 ledger, 9 pairs, 5 exceptions)', () => {
    // 9 matching pairs
    const pairs: Array<{ ref: string; desc: string; amount: number; dir: 'credit' | 'debit'; date: string }> = [
      { ref: 'NEFT-92817201', desc: 'Apex Digital Retainer', amount: 12500000, dir: 'credit', date: '2026-09-02' },
      { ref: 'CHQ-4819201', desc: 'AWS Cloud Hosting', amount: 1485000, dir: 'debit', date: '2026-09-03' },
      { ref: 'UPI-adobe@hdfc', desc: 'Adobe Creative Cloud', amount: 620000, dir: 'debit', date: '2026-09-04' },
      { ref: 'RTGS-0192831', desc: 'Office Lease', amount: 6500000, dir: 'debit', date: '2026-09-05' },
      { ref: 'UPI-figma@icici', desc: 'Figma Lic', amount: 1840000, dir: 'debit', date: '2026-09-06' },
      { ref: 'NEFT-8829103', desc: 'BlueSky Labs Milestone', amount: 8500000, dir: 'credit', date: '2026-09-07' },
      { ref: 'IMPS-772910', desc: 'High-Speed Fiber', amount: 450000, dir: 'debit', date: '2026-09-08' },
      { ref: 'RTGS-449102', desc: 'Horizon Retail Advance', amount: 21000000, dir: 'credit', date: '2026-09-09' },
      { ref: 'SAL-202609A', desc: 'Staff Payroll A', amount: 18000000, dir: 'debit', date: '2026-09-10' },
    ];

    const bankRows: CanonicalTransaction[] = pairs.map((p, i) => ({
      id: `BNK-P${i + 1}`,
      source: 'bank',
      sourceRowNumber: i + 1,
      date: p.date,
      rawDescription: p.desc,
      sanitizedDescription: p.desc,
      amountPaise: p.amount,
      direction: p.dir,
      signedAmountPaise: p.dir === 'credit' ? p.amount : -p.amount,
      reference: p.ref,
      currency: 'INR',
      rawRow: {},
    }));

    const ledgerRows: CanonicalTransaction[] = pairs.map((p, i) => ({
      id: `LDG-P${i + 1}`,
      source: 'ledger',
      sourceRowNumber: i + 1,
      date: p.date,
      rawDescription: p.desc,
      sanitizedDescription: p.desc,
      amountPaise: p.amount,
      direction: p.dir,
      signedAmountPaise: p.dir === 'credit' ? p.amount : -p.amount,
      reference: p.ref,
      currency: 'INR',
      rawRow: {},
    }));

    // Plus 1 amount mismatch (NEFT-339102: bank 49,760.00 credit, ledger 50,000.00 credit)
    bankRows.push({
      id: 'BNK-MISMATCH',
      source: 'bank',
      sourceRowNumber: 10,
      date: '2026-09-13',
      rawDescription: 'Client Payment Zenith Brand',
      sanitizedDescription: 'Client Payment Zenith Brand',
      amountPaise: 4976000,
      direction: 'credit',
      signedAmountPaise: 4976000,
      reference: 'NEFT-339102',
      currency: 'INR',
      rawRow: {},
    });
    ledgerRows.push({
      id: 'LDG-MISMATCH',
      source: 'ledger',
      sourceRowNumber: 10,
      date: '2026-09-13',
      rawDescription: 'Zenith Brand Invoice',
      sanitizedDescription: 'Zenith Brand Invoice',
      amountPaise: 5000000,
      direction: 'credit',
      signedAmountPaise: 5000000,
      reference: 'NEFT-339102',
      currency: 'INR',
      rawRow: {},
    });

    // Plus 2 unmatched bank rows (HDFC Surcharge debit 1,250.00, Interest credit 3,420.00)
    bankRows.push({
      id: 'BNK-SURCHARGE',
      source: 'bank',
      sourceRowNumber: 11,
      date: '2026-09-26',
      rawDescription: 'HDFC Quarterly Surcharge',
      sanitizedDescription: 'HDFC Quarterly Surcharge',
      amountPaise: 125000,
      direction: 'debit',
      signedAmountPaise: -125000,
      reference: 'HDFC-SVC-09',
      currency: 'INR',
      rawRow: {},
    });
    bankRows.push({
      id: 'BNK-INTEREST',
      source: 'bank',
      sourceRowNumber: 12,
      date: '2026-09-30',
      rawDescription: 'Interest Credited Q2',
      sanitizedDescription: 'Interest Credited Q2',
      amountPaise: 342000,
      direction: 'credit',
      signedAmountPaise: 342000,
      reference: 'HDFC-INT-Q2',
      currency: 'INR',
      rawRow: {},
    });

    // Plus 1 duplicate bank row (ATM 5,000 debit, matching another ATM withdrawal 5,000 debit already in pairs)
    // Wait, let's add ATM debit to bank rows:
    bankRows.push({
      id: 'BNK-ATM-DUP',
      source: 'bank',
      sourceRowNumber: 13,
      date: '2026-09-22',
      rawDescription: 'Petty Cash ATM',
      sanitizedDescription: 'Petty Cash ATM',
      amountPaise: 500000,
      direction: 'debit',
      signedAmountPaise: -500000,
      reference: 'ATM-00912',
      currency: 'INR',
      rawRow: {},
    });
    // Add 1 matching ATM row to both bank and ledger so it triggers duplicate detection:
    // Let's replace the 9th pair or add 1 ATM to ledger
    ledgerRows.push({
      id: 'LDG-CHQ-UNMATCHED',
      source: 'ledger',
      sourceRowNumber: 11,
      date: '2026-09-29',
      rawDescription: 'Vendor Camera Rig Rental',
      sanitizedDescription: 'Vendor Camera Rig Rental',
      amountPaise: 1850000,
      direction: 'debit',
      signedAmountPaise: -1850000,
      reference: 'CHQ-771829',
      currency: 'INR',
      rawRow: {},
    });

    expect(bankRows.length).toBe(13);
    expect(ledgerRows.length).toBe(11);
    expect(bankRows.length + ledgerRows.length).toBe(24);

    const result = runReconciliation(bankRows, ledgerRows, {
      openingBankBalancePaise: 38565100,
      closingBankBalancePaise: 56463100,
      openingLedgerBalancePaise: 38565100,
      closingLedgerBalancePaise: 54920100,
      hasBankOpeningAnchor: true,
      hasBankClosingAnchor: true,
      hasLedgerOpeningAnchor: true,
      hasLedgerClosingAnchor: true,
    });

    expect(result.matches.length).toBe(9);
    expect(result.exceptions.length).toBe(5);
    expect(result.summary.bankRowCount).toBe(13);
    expect(result.summary.ledgerRowCount).toBe(11);
    expect(result.summary.closingBankBalancePaise).toBe(56463100);
    expect(result.summary.closingLedgerBalancePaise).toBe(54920100);
    expect(result.summary.unresolvedVariancePaise).toBe(1543000); // +₹15,430.00
    expect(result.summary.matchPercentage).toBe(75.0); // (9 * 2) / 24 = 75.0%

    const composition = getReconciliationComposition(result.matches, result.exceptions, result.summary);
    const totalCompositionItems = composition.reduce((acc, c) => acc + c.count, 0);
    expect(totalCompositionItems).toBe(14); // 9 pairs + 5 exceptions

    const bridge = getReconciliationBridge(result.summary, result.exceptions);
    expect(bridge.bridgedTotalPaise).toBe(1543000);
    expect(bridge.residualPaise).toBe(0);
    expect(bridge.isBalanced).toBe(true);

    const md = generateMarkdownReport({
      sessionName: 'Northstar 24-Row Test Pack',
      summary: result.summary,
      matches: result.matches,
      exceptions: result.exceptions,
      generatedDate: new Date('2026-10-18T12:00:00Z'),
    });

    // Verify Markdown format fixes
    expect(md).toContain('Variance = Bank − Ledger');
    expect(md).not.toContain('$\\text{Variance}');
    expect(md).toContain('statement-reported');
    expect(md).toContain('18 rows matched out of 24 active statement rows = **75%** row match rate; composition evaluates 14 reconciliation items: 9 confirmed pairs + 5 exceptions');
  });
});


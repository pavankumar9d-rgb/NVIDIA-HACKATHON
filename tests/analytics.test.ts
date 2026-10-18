import { describe, it, expect } from 'vitest';
import { 
  getDailyMovementSeries, 
  getReconciliationComposition, 
  getPrioritizedExceptions, 
  getReconciliationBridge 
} from '../src/lib/reconciliation/analytics';
import { runReconciliation } from '../src/lib/reconciliation';
import { parseCSVString, validateAndNormalizeRows } from '../src/lib/csv';
import { SYNTHETIC_BANK_CSV, SYNTHETIC_LEDGER_CSV } from '../src/data/syntheticDemo';

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
    expect(bridge.isBalanced).toBe(true);
  });
});

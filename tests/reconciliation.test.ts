import { describe, it, expect } from 'vitest';
import { 
  runReconciliation, 
  calculateDescriptionSimilarity, 
  calculateDateDifferenceDays,
  normalizeReference,
  CanonicalTransaction
} from '../src/lib/reconciliation';
import { parseCSVString, validateAndNormalizeRows } from '../src/lib/csv';
import { 
  SYNTHETIC_BANK_CSV, 
  SYNTHETIC_LEDGER_CSV 
} from '../src/data/syntheticDemo';

describe('Deterministic Reconciliation Engine', () => {
  it('correctly calculates calendar date difference in days', () => {
    expect(calculateDateDifferenceDays('2026-09-01', '2026-09-01')).toBe(0);
    expect(calculateDateDifferenceDays('2026-09-01', '2026-09-04')).toBe(3);
    expect(calculateDateDifferenceDays('2026-09-05', '2026-09-01')).toBe(4);
  });

  it('normalizes alphanumeric transaction references', () => {
    expect(normalizeReference('neft-92817201')).toBe('NEFT92817201');
    expect(normalizeReference('CHQ-481-9201')).toBe('CHQ4819201');
    expect(normalizeReference('upi-adobe@hdfc')).toBe('UPIADOBEHDFC');
    expect(normalizeReference('')).toBe('');
  });

  it('computes Jaccard description token overlap', () => {
    const sim = calculateDescriptionSimilarity(
      'AWS Cloud Infrastructure Servers',
      'AWS Cloud Infrastructure'
    );
    expect(sim).toBeGreaterThan(0.6);

    const diffSim = calculateDescriptionSimilarity(
      'Office Lease Rent',
      'Vendor Studio Lighting'
    );
    expect(diffSim).toBe(0);
  });

  it('guarantees 1-to-1 consumption and prevents double matching of rows', () => {
    const bankRow: CanonicalTransaction = {
      id: 'BNK-001',
      source: 'bank',
      sourceRowNumber: 1,
      date: '2026-09-02',
      rawDescription: 'Client Retainer',
      sanitizedDescription: 'Client Retainer',
      amountPaise: 7500000,
      direction: 'credit',
      signedAmountPaise: 7500000,
      reference: 'NEFT-101',
      currency: 'INR',
      rawRow: {},
    };

    const ledgerRows: CanonicalTransaction[] = [
      {
        id: 'LDG-001',
        source: 'ledger',
        sourceRowNumber: 1,
        date: '2026-09-02',
        rawDescription: 'Client Retainer Voucher 1',
        sanitizedDescription: 'Client Retainer Voucher 1',
        amountPaise: 7500000,
        direction: 'credit',
        signedAmountPaise: 7500000,
        reference: 'NEFT-101',
        currency: 'INR',
        rawRow: {},
      },
      {
        id: 'LDG-002',
        source: 'ledger',
        sourceRowNumber: 2,
        date: '2026-09-02',
        rawDescription: 'Duplicate Voucher Claim',
        sanitizedDescription: 'Duplicate Voucher Claim',
        amountPaise: 7500000,
        direction: 'credit',
        signedAmountPaise: 7500000,
        reference: 'NEFT-101',
        currency: 'INR',
        rawRow: {},
      },
    ];

    const result = runReconciliation([bankRow], ledgerRows);
    
    // Exactly 1 bank row matched with 2 ledger candidates on same ref -> flagged Ambiguous!
    // A naive greedy engine would match one and drop the second.
    // ProofLedger protects the user by flagging ambiguity.
    expect(result.matches.length).toBe(0);
    expect(result.exceptions.length).toBe(1);
    expect(result.exceptions[0].type).toBe('AMBIGUOUS_MATCH');
  });

  it('accurately identifies amount discrepancies on matching references', () => {
    const bankRow: CanonicalTransaction = {
      id: 'BNK-010',
      source: 'bank',
      sourceRowNumber: 10,
      date: '2026-09-13',
      rawDescription: 'Client Payment Zenith Brand',
      sanitizedDescription: 'Client Payment Zenith Brand',
      amountPaise: 4976000, // ₹49,760 credited
      direction: 'credit',
      signedAmountPaise: 4976000,
      reference: 'NEFT-339102',
      currency: 'INR',
      rawRow: {},
    };

    const ledgerRow: CanonicalTransaction = {
      id: 'LDG-010',
      source: 'ledger',
      sourceRowNumber: 10,
      date: '2026-09-13',
      rawDescription: 'Zenith Brand Identity Invoice',
      sanitizedDescription: 'Zenith Brand Identity Invoice',
      amountPaise: 5000000, // ₹50,000 invoiced
      direction: 'credit',
      signedAmountPaise: 5000000,
      reference: 'NEFT-339102',
      currency: 'INR',
      rawRow: {},
    };

    const result = runReconciliation([bankRow], [ledgerRow]);
    expect(result.matches.length).toBe(0);
    expect(result.exceptions.length).toBe(1);
    expect(result.exceptions[0].type).toBe('AMOUNT_MISMATCH');
    expect(result.exceptions[0].amountDeltaPaise).toBe(-24000); // -₹240.00 discrepancy
  });

  it('runs the full Northstar Studio synthetic scenario and validates expected outcomes', async () => {
    const parsedBank = await parseCSVString(SYNTHETIC_BANK_CSV);
    const { validRows: bankValid } = validateAndNormalizeRows(parsedBank.rows, parsedBank.detectedMapping, 'BNK');

    const parsedLedger = await parseCSVString(SYNTHETIC_LEDGER_CSV);
    const { validRows: ledgerValid } = validateAndNormalizeRows(parsedLedger.rows, parsedLedger.detectedMapping, 'LDG');

    const bCanonical: CanonicalTransaction[] = bankValid.map((r, i) => ({
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

    const lCanonical: CanonicalTransaction[] = ledgerValid.map((r, i) => ({
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

    const result = runReconciliation(bCanonical, lCanonical);

    expect(result.summary.bankRowCount).toBe(29);
    expect(result.summary.ledgerRowCount).toBe(27);
    expect(result.matches.length).toBeGreaterThanOrEqual(20);
    expect(result.exceptions.length).toBeGreaterThanOrEqual(4);

    // Verify key deliberate exceptions are found
    const amountMismatch = result.exceptions.find((e) => e.type === 'AMOUNT_MISMATCH');
    expect(amountMismatch).toBeDefined();
    expect(amountMismatch?.amountDeltaPaise).toBe(-24000); // -₹240 payment gateway fee

    const unmatchedBankSurcharge = result.exceptions.find(
      (e) => e.bankTransaction?.reference === 'HDFC-SVC-09'
    );
    expect(unmatchedBankSurcharge).toBeDefined();
    expect(unmatchedBankSurcharge?.bankTransaction?.amountPaise).toBe(125000); // ₹1,250 fee
  });
});

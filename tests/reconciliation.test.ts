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
    expect(result.matches.length).toBe(25);
    expect(result.exceptions.length).toBe(5);

    // Verify all 5 deliberate synthetic exceptions match expected fixture counts
    expect(result.summary.amountMismatchCount).toBe(1);
    expect(result.summary.unmatchedBankCount).toBe(2); // HDFC-SVC-09 & HDFC-INT-Q2
    expect(result.summary.unmatchedLedgerCount).toBe(1); // CHQ-771829
    expect(result.summary.duplicateCandidateCount).toBe(1); // ATM-00912
    expect(result.summary.ambiguousMatchCount).toBe(0);

    // Verify key deliberate exceptions are found
    const amountMismatch = result.exceptions.find((e) => e.type === 'AMOUNT_MISMATCH');
    expect(amountMismatch).toBeDefined();
    expect(amountMismatch?.amountDeltaPaise).toBe(-24000); // -₹240 payment gateway fee

    const unmatchedBankSurcharge = result.exceptions.find(
      (e) => e.bankTransaction?.reference === 'HDFC-SVC-09'
    );
    expect(unmatchedBankSurcharge).toBeDefined();
    expect(unmatchedBankSurcharge?.bankTransaction?.amountPaise).toBe(125000); // ₹1,250 fee

    const unmatchedBankInterest = result.exceptions.find(
      (e) => e.bankTransaction?.reference === 'HDFC-INT-Q2'
    );
    expect(unmatchedBankInterest).toBeDefined();
    expect(unmatchedBankInterest?.bankTransaction?.amountPaise).toBe(342000); // ₹3,420 credit

    const unmatchedVendorCheque = result.exceptions.find(
      (e) => e.ledgerTransaction?.reference === 'CHQ-771829'
    );
    expect(unmatchedVendorCheque).toBeDefined();
    expect(unmatchedVendorCheque?.ledgerTransaction?.amountPaise).toBe(1850000); // ₹18,500 unpresented cheque

    const duplicateATM = result.exceptions.find((e) => e.type === 'DUPLICATE_CANDIDATE');
    expect(duplicateATM).toBeDefined();
    expect(duplicateATM?.bankTransaction?.reference).toBe('ATM-00912');
    expect(duplicateATM?.bankTransaction?.amountPaise).toBe(500000); // ₹5,000 duplicate debit
    expect(duplicateATM?.candidateTransactions).toBeDefined();
    expect(duplicateATM?.candidateTransactions?.length).toBeGreaterThan(0);
    expect(duplicateATM?.candidateTransactions?.[0].reference).toBe('ATM-00912');
  });

  describe('Duplicate Candidate Boundary & Edge Cases', () => {
    const baseTx = (id: string, date: string, amountPaise: number, ref?: string, desc = 'Payment'): CanonicalTransaction => ({
      id,
      source: 'bank',
      sourceRowNumber: 1,
      date,
      rawDescription: desc,
      sanitizedDescription: desc,
      amountPaise,
      direction: 'debit',
      signedAmountPaise: -amountPaise,
      reference: ref,
      currency: 'INR',
      rawRow: {},
    });

    it('flags consecutive date withdrawals with identical reference as duplicate candidate', () => {
      const b1 = baseTx('BNK-1', '2026-09-21', 500000, 'ATM-00912');
      const b2 = baseTx('BNK-2', '2026-09-22', 500000, 'ATM-00912');
      const l1 = { ...baseTx('LDG-1', '2026-09-21', 500000, 'ATM-00912'), source: 'ledger' as const };

      const res = runReconciliation([b1, b2], [l1]);
      expect(res.matches.length).toBe(1);
      expect(res.exceptions.length).toBe(1);
      expect(res.exceptions[0].type).toBe('DUPLICATE_CANDIDATE');
      expect(res.summary.duplicateCandidateCount).toBe(1);
      expect(res.summary.unmatchedBankCount).toBe(0);
    });

    it('does NOT flag different references as duplicate even on consecutive days', () => {
      const b1 = baseTx('BNK-1', '2026-09-21', 500000, 'ATM-00912');
      const b2 = baseTx('BNK-2', '2026-09-22', 500000, 'ATM-00913'); // Different ref!
      const l1 = { ...baseTx('LDG-1', '2026-09-21', 500000, 'ATM-00912'), source: 'ledger' as const };

      const res = runReconciliation([b1, b2], [l1]);
      expect(res.matches.length).toBe(1);
      expect(res.exceptions.length).toBe(1);
      expect(res.exceptions[0].type).toBe('UNMATCHED_BANK');
      expect(res.summary.duplicateCandidateCount).toBe(0);
      expect(res.summary.unmatchedBankCount).toBe(1);
    });

    it('does NOT flag different amounts as duplicate even with matching reference', () => {
      const b1 = baseTx('BNK-1', '2026-09-21', 500000, 'ATM-00912');
      const b2 = baseTx('BNK-2', '2026-09-22', 400000, 'ATM-00912'); // ₹4,000 vs ₹5,000!
      const l1 = { ...baseTx('LDG-1', '2026-09-21', 500000, 'ATM-00912'), source: 'ledger' as const };

      const res = runReconciliation([b1, b2], [l1]);
      expect(res.matches.length).toBe(1);
      expect(res.exceptions.length).toBe(1);
      expect(res.exceptions[0].type).toBe('UNMATCHED_BANK');
      expect(res.summary.duplicateCandidateCount).toBe(0);
    });

    it('does NOT flag transactions beyond maxDateToleranceDays as duplicate', () => {
      const b1 = baseTx('BNK-1', '2026-09-01', 500000, 'ATM-00912');
      const b2 = baseTx('BNK-2', '2026-09-28', 500000, 'ATM-00912'); // 27 days apart!
      const l1 = { ...baseTx('LDG-1', '2026-09-01', 500000, 'ATM-00912'), source: 'ledger' as const };

      const res = runReconciliation([b1, b2], [l1], { maxDateToleranceDays: 4 });
      expect(res.matches.length).toBe(1);
      expect(res.exceptions.length).toBe(1);
      expect(res.exceptions[0].type).toBe('UNMATCHED_BANK');
      expect(res.summary.duplicateCandidateCount).toBe(0);
    });

    it('does NOT flag recurring expenses without reference on different days as duplicates', () => {
      const b1 = baseTx('BNK-1', '2026-09-10', 15000, undefined, 'Coffee Pantry');
      const b2 = baseTx('BNK-2', '2026-09-11', 15000, undefined, 'Coffee Pantry');

      const res = runReconciliation([b1, b2], []);
      expect(res.exceptions.length).toBe(2);
      expect(res.exceptions[0].type).toBe('UNMATCHED_BANK');
      expect(res.exceptions[1].type).toBe('UNMATCHED_BANK');
      expect(res.summary.duplicateCandidateCount).toBe(0);
    });

    it('flags identical description without reference on the EXACT SAME date as suspected duplicate', () => {
      const b1 = baseTx('BNK-1', '2026-09-10', 15000, undefined, 'Coffee Pantry');
      const b2 = baseTx('BNK-2', '2026-09-10', 15000, undefined, 'Coffee Pantry');

      const res = runReconciliation([b1, b2], []);
      expect(res.exceptions.length).toBe(2);
      expect(res.exceptions[0].type).toBe('DUPLICATE_CANDIDATE');
      expect(res.exceptions[1].type).toBe('DUPLICATE_CANDIDATE');
      expect(res.summary.duplicateCandidateCount).toBe(2);
    });
  });
});

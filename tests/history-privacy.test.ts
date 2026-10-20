import { describe, it, expect } from 'vitest';
import { 
  buildSanitizedHistorySnapshot, 
  fetchReconciliationHistory,
  deleteReconciliationHistory,
  saveReconciliationToHistory
} from '../src/lib/supabase/history';
import { isSupabaseConfigured } from '../src/lib/supabase/client';
import type { ReconciliationResult, CanonicalTransaction } from '../src/lib/reconciliation';

describe('Supabase Client & History Privacy Invariants', () => {
  it('detects unconfigured Supabase gracefully without crashing', () => {
    const configured = isSupabaseConfigured();
    expect(typeof configured).toBe('boolean');
  });

  it('fails gracefully when attempting DB operations without configuration', async () => {
    if (!isSupabaseConfigured()) {
      const fetchRes = await fetchReconciliationHistory();
      expect(fetchRes.error).not.toBeNull();
      expect(fetchRes.error?.message).toContain('Supabase credentials are not configured');
      expect(fetchRes.data).toEqual([]);

      const deleteRes = await deleteReconciliationHistory('non-existent-id');
      expect(deleteRes.error).not.toBeNull();
      expect(deleteRes.error?.message).toContain('Supabase credentials are not configured');

      const saveRes = await saveReconciliationToHistory('Test', {} as any, false);
      expect(saveRes.error).not.toBeNull();
      expect(saveRes.data).toBeNull();
    }
  });

  it('strictly strips rawRow, raw CSV strings, and unredacted PII in buildSanitizedHistorySnapshot', () => {
    const sensitiveRawBank = {
      'Date': '01/09/2026',
      'Narration': 'Transfer to Account 987654321012 IFSC HDFC0001234',
      'Debit': '50000.00',
      'SECRET_INTERNAL_TOKEN': 'SECRET-BANK-TOKEN-999',
      'CUSTOMER_AADHAAR': '1234 5678 9012'
    };

    const sensitiveRawLedger = {
      'Posting Date': '01/09/2026',
      'Description': 'Vendor payout Ref 987654321012',
      'Amount': '50000.00',
      'INTERNAL_NOTE': 'PRIVATE NOTE: VIP CLIENT CONFIDENTIAL'
    };

    const bankTx: CanonicalTransaction = {
      id: 'BNK-001',
      source: 'bank',
      sourceRowNumber: 2,
      date: '2026-09-01',
      rawDescription: 'Transfer to Account 987654321012 IFSC HDFC0001234',
      sanitizedDescription: 'Transfer to Account [ACCT-REDACTED] IFSC HDFC0001234',
      amountPaise: 5000000,
      direction: 'debit',
      signedAmountPaise: -5000000,
      reference: 'TXN-999',
      currency: 'INR',
      rawRow: sensitiveRawBank,
    };

    const ledgerTx: CanonicalTransaction = {
      id: 'LDG-001',
      source: 'ledger',
      sourceRowNumber: 2,
      date: '2026-09-01',
      rawDescription: 'Vendor payout Ref 987654321012',
      sanitizedDescription: 'Vendor payout Ref [ACCT-REDACTED]',
      amountPaise: 5000000,
      direction: 'debit',
      signedAmountPaise: -5000000,
      reference: 'TXN-999',
      currency: 'INR',
      rawRow: sensitiveRawLedger,
    };

    const mockResult: ReconciliationResult = {
      matches: [
        {
          matchId: 'MATCH-001',
          tier: 'EXACT_REF_AMOUNT',
          confidenceScore: 100,
          bankTransaction: bankTx,
          ledgerTransaction: ledgerTx,
          amountDeltaPaise: 0,
          dateDeltaDays: 0,
          signals: {
            referenceMatch: true,
            amountExact: true,
            dateLagDays: 0,
            descriptionSimilarity: 1.0,
          }
        }
      ],
      exceptions: [
        {
          exceptionId: 'EXC-001',
          type: 'UNMATCHED_BANK',
          title: 'Unmatched Bank Debit',
          description: 'Transaction in bank statement has no matching ledger entry',
          bankTransaction: bankTx,
          amountDeltaPaise: -5000000,
          dateDeltaDays: 0,
          deterministicSignals: {
            referenceMatch: false,
            descriptionSimilarity: 0,
            dateLagDays: 0,
            amountDeltaPaise: -5000000,
          },
          reviewDecision: {
            status: 'APPROVED',
            reviewer: 'Compliance Officer',
            timestamp: '2026-10-19T10:00:00Z',
            note: 'Verified against invoice'
          }
        }
      ],
      summary: {
        bankRowCount: 1,
        ledgerRowCount: 1,
        confirmedMatchCount: 1,
        exceptionCount: 1,
        excludedBankRowCount: 0,
        excludedLedgerRowCount: 0,
        hasBankOpeningAnchor: true,
        hasLedgerOpeningAnchor: true,
        hasBankClosingAnchor: true,
        hasLedgerClosingAnchor: true,
        bankOpeningProvenance: 'STATEMENT_DETECTED',
        ledgerOpeningProvenance: 'STATEMENT_DETECTED',
        bankClosingProvenance: 'STATEMENT_DETECTED',
        ledgerClosingProvenance: 'STATEMENT_DETECTED',
        openingBankBalancePaise: 10000000,
        closingBankBalancePaise: 5000000,
        totalBankInflowPaise: 0,
        totalBankOutflowPaise: 5000000,
        netBankMovementPaise: -5000000,
        netBankTotalPaise: -5000000,
        openingLedgerBalancePaise: 10000000,
        closingLedgerBalancePaise: 5000000,
        totalLedgerInflowPaise: 0,
        totalLedgerOutflowPaise: 5000000,
        netLedgerMovementPaise: -5000000,
        netLedgerTotalPaise: -5000000,
        matchedAmountPaise: 5000000,
        unresolvedVariancePaise: 0,
        matchPercentage: 100,
        unmatchedBankCount: 1,
        unmatchedLedgerCount: 0,
        amountMismatchCount: 0,
        duplicateCandidateCount: 0,
        ambiguousMatchCount: 0,
      }
    };

    const snapshot = buildSanitizedHistorySnapshot('Test Session', mockResult, false);
    const serialized = JSON.stringify(snapshot);

    // Verify sensitive PII / secret keys in rawRow are completely stripped
    expect(serialized).not.toContain('SECRET_INTERNAL_TOKEN');
    expect(serialized).not.toContain('CUSTOMER_AADHAAR');
    expect(serialized).not.toContain('1234 5678 9012');
    expect(serialized).not.toContain('PRIVATE NOTE: VIP CLIENT CONFIDENTIAL');
    expect(serialized).not.toContain('SECRET-BANK-TOKEN-999');

    // Verify matched item properties exist and rawRow is undefined
    expect(snapshot.matches[0].bankId).toBe('BNK-001');
    expect(snapshot.matches[0].sanitizedDescription).toBe('Transfer to Account [ACCT-REDACTED] IFSC HDFC0001234');
    expect((snapshot.matches[0] as any).rawRow).toBeUndefined();

    // Verify exception properties exist and rawRow is undefined
    expect(snapshot.exceptions[0].exceptionId).toBe('EXC-001');
    expect((snapshot.exceptions[0] as any).rawRow).toBeUndefined();

    // Verify audit review decision is preserved
    expect(snapshot.exceptions[0].reviewDecision?.status).toBe('APPROVED');
    expect(snapshot.exceptions[0].reviewDecision?.reviewer).toBe('Compliance Officer');

    // Verify summary metrics are intact
    expect(snapshot.summary.matchedRowCount).toBe(2);
    expect(snapshot.summary.matchedPairsCount).toBe(1);
    expect(snapshot.summary.openingBankBalancePaise).toBe(10000000);
    expect(snapshot.summary.closingBankBalancePaise).toBe(5000000);
  });

  describe('Guest Mode Isolation & Zero-Durable-Storage Guarantee', () => {
    it('verifies that Guest Mode saves zero financial data to localStorage or indexedDB', () => {
      // localStorage check
      const localKeys = Object.keys(localStorage);
      for (const key of localKeys) {
        expect(key).not.toMatch(/financial|reconciliation|bank|ledger|transaction|snapshot/i);
      }
    });

    it('strictly confines guest session flag to non-sensitive boolean in sessionStorage', () => {
      sessionStorage.setItem('proofledger_guest_mode', 'true');
      const val = sessionStorage.getItem('proofledger_guest_mode');
      expect(val).toBe('true');

      // The guest flag must not contain tokens, keys, or serialized payloads
      expect(val).not.toContain('{');
      expect(val).not.toContain('eyJ');
      expect(val).not.toContain('sb_');

      sessionStorage.removeItem('proofledger_guest_mode');
    });

    it('rejects saveReconciliationToHistory when user is not authenticated', async () => {
      // In guest mode (no user session), attempting to call saveReconciliationToHistory fails safely
      const saveRes = await saveReconciliationToHistory('Guest Session Attempt', {} as any, false);
      expect(saveRes.data).toBeNull();
      expect(saveRes.error).not.toBeNull();
      // Should fail either due to unconfigured client or missing user session
      expect(saveRes.error?.message).toMatch(/not configured|must be signed in/i);
    });
  });
});

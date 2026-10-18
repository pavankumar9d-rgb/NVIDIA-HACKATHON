/**
 * ProofLedger AI — Deterministic Financial Reconciliation Engine
 * 
 * Strict deterministic guarantees:
 * 1. AI is never used for arithmetic, match confirmation, or balance variance.
 * 2. 1-to-1 consumption: A transaction row is never consumed twice.
 * 3. Ambiguity handling: Ties and competing candidates are flagged as Ambiguous
 *    instead of arbitrarily forcing a greedy match.
 * 4. All money values in integer paise.
 */

import { sumPaise } from '../money';

export type TransactionDirection = 'debit' | 'credit';

export interface CanonicalTransaction {
  id: string; // e.g. "BNK-001" or "LDG-001"
  source: 'bank' | 'ledger';
  sourceRowNumber: number;
  date: string; // ISO YYYY-MM-DD
  rawDescription: string;
  sanitizedDescription: string;
  amountPaise: number;
  direction: TransactionDirection;
  signedAmountPaise: number; // - for debit (outflow), + for credit (inflow)
  reference?: string;
  currency: string;
  rawRow: Record<string, string>;
}

export type MatchTier = 'EXACT_REF_AMOUNT' | 'EXACT_AMOUNT_DATE_TOLERANCE' | 'MANUAL_APPROVED';

export interface ReconciliationMatch {
  matchId: string;
  bankTransaction: CanonicalTransaction;
  ledgerTransaction: CanonicalTransaction;
  tier: MatchTier;
  confidenceScore: number; // 0 - 100
  dateDeltaDays: number;
  amountDeltaPaise: number;
  signals: {
    referenceMatch: boolean;
    amountExact: boolean;
    dateLagDays: number;
    descriptionSimilarity: number;
  };
}

export type ExceptionType =
  | 'UNMATCHED_BANK'
  | 'UNMATCHED_LEDGER'
  | 'AMOUNT_MISMATCH'
  | 'DUPLICATE_CANDIDATE'
  | 'AMBIGUOUS_MATCH';

export interface HumanReviewDecision {
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DEFERRED';
  reviewer: string;
  timestamp: string;
  note?: string;
  suggestedActionTaken?: string;
}

export interface ReconciliationException {
  exceptionId: string;
  type: ExceptionType;
  title: string;
  description: string;
  bankTransaction?: CanonicalTransaction;
  ledgerTransaction?: CanonicalTransaction;
  candidateTransactions?: CanonicalTransaction[];
  amountDeltaPaise: number;
  dateDeltaDays: number;
  deterministicSignals: {
    referenceMatch: boolean;
    descriptionSimilarity: number;
    dateLagDays: number;
    amountDeltaPaise: number;
  };
  aiHypothesis?: {
    classification: string;
    summary: string;
    evidenceRowIds: string[];
    evidenceExplanation: string;
    missingEvidence: string[];
    recommendedAction: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    uncertaintyNotes: string;
    inferredAt: string;
    model: string;
  };
  reviewDecision?: HumanReviewDecision;
}

export interface ReconciliationSummary {
  bankRowCount: number;
  ledgerRowCount: number;
  confirmedMatchCount: number;
  exceptionCount: number;
  
  // Financial metrics in paise
  openingBankBalancePaise: number;
  closingBankBalancePaise: number;
  totalBankInflowPaise: number;
  totalBankOutflowPaise: number;
  netBankMovementPaise: number;
  netBankTotalPaise: number; // backward compatibility alias for netBankMovementPaise

  openingLedgerBalancePaise: number;
  closingLedgerBalancePaise: number;
  totalLedgerInflowPaise: number;
  totalLedgerOutflowPaise: number;
  netLedgerMovementPaise: number;
  netLedgerTotalPaise: number; // backward compatibility alias for netLedgerMovementPaise

  matchedAmountPaise: number;
  unresolvedVariancePaise: number; // Math difference between bank and ledger closing balances
  matchPercentage: number; // 0 - 100%
  
  // Breakdown of exceptions
  unmatchedBankCount: number;
  unmatchedLedgerCount: number;
  amountMismatchCount: number;
  duplicateCandidateCount: number;
  ambiguousMatchCount: number;
}

export interface ReconciliationResult {
  matches: ReconciliationMatch[];
  exceptions: ReconciliationException[];
  summary: ReconciliationSummary;
}

/**
 * Calculates Jaccard token similarity between two sanitized transaction descriptions.
 * Range: 0.0 to 1.0. Used strictly as a supporting heuristic signal.
 */
export function calculateDescriptionSimilarity(descA: string, descB: string): number {
  const tokenize = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 2)
    );

  const tokensA = tokenize(descA);
  const tokensB = tokenize(descB);

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersectionCount = 0;
  tokensA.forEach((token) => {
    if (tokensB.has(token)) intersectionCount++;
  });

  const unionSize = new Set([...tokensA, ...tokensB]).size;
  return unionSize > 0 ? Number((intersectionCount / unionSize).toFixed(2)) : 0;
}

/**
 * Calculates absolute calendar date difference in days between two ISO YYYY-MM-DD strings.
 */
export function calculateDateDifferenceDays(dateStrA: string, dateStrB: string): number {
  const d1 = new Date(dateStrA).getTime();
  const d2 = new Date(dateStrB).getTime();
  const diffTime = Math.abs(d2 - d1);
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Normalizes alphanumeric references (removes spaces, hyphens, and case differences).
 */
export function normalizeReference(ref?: string): string {
  if (!ref) return '';
  return ref.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export interface ReconciliationOptions {
  maxDateToleranceDays?: number;
  descriptionSimilarityThreshold?: number;
  openingBankBalancePaise?: number;
  closingBankBalancePaise?: number;
  openingLedgerBalancePaise?: number;
  closingLedgerBalancePaise?: number;
}

/**
 * Primary Deterministic Reconciliation Engine
 */
export function runReconciliation(
  bankRows: CanonicalTransaction[],
  ledgerRows: CanonicalTransaction[],
  options: ReconciliationOptions = {}
): ReconciliationResult {
  const { maxDateToleranceDays = 4, descriptionSimilarityThreshold = 0.6 } = options;

  const matches: ReconciliationMatch[] = [];
  const exceptions: ReconciliationException[] = [];

  const consumedBankIds = new Set<string>();
  const consumedLedgerIds = new Set<string>();

  // 1. Identify intra-source duplicates first (for transparency)
  const bankDuplicateIds = new Set<string>();
  const ledgerDuplicateIds = new Set<string>();

  const findDuplicates = (rows: CanonicalTransaction[], dupSet: Set<string>) => {
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const a = rows[i];
        const b = rows[j];
        if (
          a.amountPaise === b.amountPaise &&
          a.direction === b.direction &&
          a.date === b.date &&
          (normalizeReference(a.reference) === normalizeReference(b.reference) || a.sanitizedDescription === b.sanitizedDescription)
        ) {
          dupSet.add(a.id);
          dupSet.add(b.id);
        }
      }
    }
  };

  findDuplicates(bankRows, bankDuplicateIds);
  findDuplicates(ledgerRows, ledgerDuplicateIds);

  // 2. TIER 1: Exact Reference + Exact Amount Match
  for (const b of bankRows) {
    if (consumedBankIds.has(b.id)) continue;
    const bRef = normalizeReference(b.reference);
    if (!bRef) continue;

    // Look for matching ledger row
    const eligibleLedger = ledgerRows.filter(
      (l) =>
        !consumedLedgerIds.has(l.id) &&
        normalizeReference(l.reference) === bRef &&
        b.direction === l.direction &&
        b.amountPaise === l.amountPaise &&
        calculateDateDifferenceDays(b.date, l.date) <= maxDateToleranceDays
    );

    if (eligibleLedger.length === 1) {
      const l = eligibleLedger[0];
      const dateLag = calculateDateDifferenceDays(b.date, l.date);
      const descSim = calculateDescriptionSimilarity(b.sanitizedDescription, l.sanitizedDescription);

      matches.push({
        matchId: `MTH-${b.id}-${l.id}`,
        bankTransaction: b,
        ledgerTransaction: l,
        tier: 'EXACT_REF_AMOUNT',
        confidenceScore: 100,
        dateDeltaDays: dateLag,
        amountDeltaPaise: 0,
        signals: {
          referenceMatch: true,
          amountExact: true,
          dateLagDays: dateLag,
          descriptionSimilarity: descSim,
        },
      });

      consumedBankIds.add(b.id);
      consumedLedgerIds.add(l.id);
    } else if (eligibleLedger.length > 1) {
      // Multiple matches on same reference -> Mark as Ambiguous!
      exceptions.push({
        exceptionId: `EXP-AMB-${b.id}`,
        type: 'AMBIGUOUS_MATCH',
        title: `Ambiguous Reference Candidates for ${b.id}`,
        description: `Bank transaction references "${b.reference}", which matches ${eligibleLedger.length} distinct ledger entries. Kept unresolved for human review.`,
        bankTransaction: b,
        candidateTransactions: eligibleLedger,
        amountDeltaPaise: 0,
        dateDeltaDays: 0,
        deterministicSignals: {
          referenceMatch: true,
          descriptionSimilarity: 0.5,
          dateLagDays: 0,
          amountDeltaPaise: 0,
        },
      });
      consumedBankIds.add(b.id);
      eligibleLedger.forEach((l) => consumedLedgerIds.add(l.id));
    }
  }

  // 3. TIER 2: Reference Match but Amount Mismatch (e.g. Fees, Deductions)
  for (const b of bankRows) {
    if (consumedBankIds.has(b.id)) continue;
    const bRef = normalizeReference(b.reference);
    if (!bRef) continue;

    const matchingRefLedger = ledgerRows.filter(
      (l) =>
        !consumedLedgerIds.has(l.id) &&
        normalizeReference(l.reference) === bRef &&
        b.direction === l.direction &&
        b.amountPaise !== l.amountPaise &&
        calculateDateDifferenceDays(b.date, l.date) <= maxDateToleranceDays
    );

    if (matchingRefLedger.length === 1) {
      const l = matchingRefLedger[0];
      const delta = b.amountPaise - l.amountPaise;
      const dateLag = calculateDateDifferenceDays(b.date, l.date);
      const descSim = calculateDescriptionSimilarity(b.sanitizedDescription, l.sanitizedDescription);

      exceptions.push({
        exceptionId: `EXP-AMT-${b.id}-${l.id}`,
        type: 'AMOUNT_MISMATCH',
        title: `Amount Discrepancy on Reference ${b.reference}`,
        description: `Matching reference "${b.reference}", but Bank has ₹${(b.amountPaise / 100).toFixed(2)} while Ledger has ₹${(l.amountPaise / 100).toFixed(2)} (Variance: ₹${(Math.abs(delta) / 100).toFixed(2)}).`,
        bankTransaction: b,
        ledgerTransaction: l,
        amountDeltaPaise: delta,
        dateDeltaDays: dateLag,
        deterministicSignals: {
          referenceMatch: true,
          descriptionSimilarity: descSim,
          dateLagDays: dateLag,
          amountDeltaPaise: delta,
        },
      });

      consumedBankIds.add(b.id);
      consumedLedgerIds.add(l.id);
    }
  }

  // 4. TIER 3: Amount + Date Tolerance Match (No Reference Match Required)
  for (const b of bankRows) {
    if (consumedBankIds.has(b.id)) continue;

    const candidates = ledgerRows.filter(
      (l) =>
        !consumedLedgerIds.has(l.id) &&
        b.direction === l.direction &&
        b.amountPaise === l.amountPaise &&
        calculateDateDifferenceDays(b.date, l.date) <= maxDateToleranceDays
    );

    if (candidates.length === 1) {
      const l = candidates[0];
      const dateLag = calculateDateDifferenceDays(b.date, l.date);
      const descSim = calculateDescriptionSimilarity(b.sanitizedDescription, l.sanitizedDescription);

      // Only auto-confirm if either date lag is tight (<= 2 days) or description has reasonable overlap
      if (dateLag <= 2 || descSim >= descriptionSimilarityThreshold) {
        matches.push({
          matchId: `MTH-FUZ-${b.id}-${l.id}`,
          bankTransaction: b,
          ledgerTransaction: l,
          tier: 'EXACT_AMOUNT_DATE_TOLERANCE',
          confidenceScore: dateLag === 0 ? 95 : 85,
          dateDeltaDays: dateLag,
          amountDeltaPaise: 0,
          signals: {
            referenceMatch: false,
            amountExact: true,
            dateLagDays: dateLag,
            descriptionSimilarity: descSim,
          },
        });

        consumedBankIds.add(b.id);
        consumedLedgerIds.add(l.id);
      } else {
        // High date lag and poor description overlap -> flag as Ambiguous
        exceptions.push({
          exceptionId: `EXP-AMB-${b.id}`,
          type: 'AMBIGUOUS_MATCH',
          title: `Candidate Match with High Date Lag (${dateLag} days)`,
          description: `Single amount candidate found for ₹${(b.amountPaise / 100).toFixed(2)}, but date difference is ${dateLag} days with weak description similarity (${descSim}). Requires manual inspection.`,
          bankTransaction: b,
          candidateTransactions: [l],
          amountDeltaPaise: 0,
          dateDeltaDays: dateLag,
          deterministicSignals: {
            referenceMatch: false,
            descriptionSimilarity: descSim,
            dateLagDays: dateLag,
            amountDeltaPaise: 0,
          },
        });
        consumedBankIds.add(b.id);
        consumedLedgerIds.add(l.id);
      }
    } else if (candidates.length > 1) {
      // Multiple candidates with same amount -> Ambiguous
      exceptions.push({
        exceptionId: `EXP-AMB-${b.id}`,
        type: 'AMBIGUOUS_MATCH',
        title: `Multiple Amount Candidates for ₹${(b.amountPaise / 100).toFixed(2)}`,
        description: `Found ${candidates.length} ledger transactions with identical amount ₹${(b.amountPaise / 100).toFixed(2)}. Ambiguity requires human determination.`,
        bankTransaction: b,
        candidateTransactions: candidates,
        amountDeltaPaise: 0,
        dateDeltaDays: 0,
        deterministicSignals: {
          referenceMatch: false,
          descriptionSimilarity: 0.3,
          dateLagDays: 0,
          amountDeltaPaise: 0,
        },
      });
      consumedBankIds.add(b.id);
      candidates.forEach((c) => consumedLedgerIds.add(c.id));
    }
  }

  // 5. Unmatched Bank Transactions
  for (const b of bankRows) {
    if (!consumedBankIds.has(b.id)) {
      const isDuplicate = bankDuplicateIds.has(b.id);
      exceptions.push({
        exceptionId: `EXP-BNK-${b.id}`,
        type: isDuplicate ? 'DUPLICATE_CANDIDATE' : 'UNMATCHED_BANK',
        title: isDuplicate ? `Potential Bank Duplicate: ${b.id}` : `Unmatched Bank Entry: ${b.id}`,
        description: isDuplicate
          ? `Bank transaction of ₹${(b.amountPaise / 100).toFixed(2)} appears multiple times on ${b.date}. Potential double-charge or duplicate receipt.`
          : `Bank transaction of ₹${(b.amountPaise / 100).toFixed(2)} (${b.direction}) has no counterpart in the accounting ledger.`,
        bankTransaction: b,
        amountDeltaPaise: b.signedAmountPaise,
        dateDeltaDays: 0,
        deterministicSignals: {
          referenceMatch: false,
          descriptionSimilarity: 0,
          dateLagDays: 0,
          amountDeltaPaise: b.signedAmountPaise,
        },
      });
      consumedBankIds.add(b.id);
    }
  }

  // 6. Unmatched Ledger Transactions
  for (const l of ledgerRows) {
    if (!consumedLedgerIds.has(l.id)) {
      const isDuplicate = ledgerDuplicateIds.has(l.id);
      exceptions.push({
        exceptionId: `EXP-LDG-${l.id}`,
        type: isDuplicate ? 'DUPLICATE_CANDIDATE' : 'UNMATCHED_LEDGER',
        title: isDuplicate ? `Potential Ledger Duplicate: ${l.id}` : `Unmatched Ledger Entry: ${l.id}`,
        description: isDuplicate
          ? `Ledger transaction of ₹${(l.amountPaise / 100).toFixed(2)} appears multiple times on ${l.date}. Potential double-posting.`
          : `Ledger entry of ₹${(l.amountPaise / 100).toFixed(2)} (${l.direction}) has not cleared the bank statement.`,
        ledgerTransaction: l,
        amountDeltaPaise: l.signedAmountPaise,
        dateDeltaDays: 0,
        deterministicSignals: {
          referenceMatch: false,
          descriptionSimilarity: 0,
          dateLagDays: 0,
          amountDeltaPaise: l.signedAmountPaise,
        },
      });
      consumedLedgerIds.add(l.id);
    }
  }

  // 7. Calculate Comprehensive Financial Summary
  const bankCredits = sumPaise(bankRows.filter((r) => r.direction === 'credit').map((r) => r.amountPaise));
  const bankDebits = sumPaise(bankRows.filter((r) => r.direction === 'debit').map((r) => r.amountPaise));
  const netBankMovementPaise = bankCredits - bankDebits;
  const netBankTotalPaise = netBankMovementPaise;

  const ledgerCredits = sumPaise(ledgerRows.filter((r) => r.direction === 'credit').map((r) => r.amountPaise));
  const ledgerDebits = sumPaise(ledgerRows.filter((r) => r.direction === 'debit').map((r) => r.amountPaise));
  const netLedgerMovementPaise = ledgerCredits - ledgerDebits;
  const netLedgerTotalPaise = netLedgerMovementPaise;

  const openingBankBalancePaise = options.openingBankBalancePaise ?? 0;
  const closingBankBalancePaise = options.closingBankBalancePaise ?? (openingBankBalancePaise + netBankMovementPaise);

  const openingLedgerBalancePaise = options.openingLedgerBalancePaise ?? openingBankBalancePaise;
  const closingLedgerBalancePaise = options.closingLedgerBalancePaise ?? (openingLedgerBalancePaise + netLedgerMovementPaise);

  const matchedAmountPaise = sumPaise(matches.map((m) => m.bankTransaction.amountPaise));
  const unresolvedVariancePaise = closingBankBalancePaise - closingLedgerBalancePaise;

  const totalRows = bankRows.length + ledgerRows.length;
  const matchPercentage = totalRows > 0 ? Number(((matches.length * 2 / totalRows) * 100).toFixed(1)) : 0;

  const summary: ReconciliationSummary = {
    bankRowCount: bankRows.length,
    ledgerRowCount: ledgerRows.length,
    confirmedMatchCount: matches.length,
    exceptionCount: exceptions.length,
    openingBankBalancePaise,
    closingBankBalancePaise,
    totalBankInflowPaise: bankCredits,
    totalBankOutflowPaise: bankDebits,
    netBankMovementPaise,
    netBankTotalPaise,
    openingLedgerBalancePaise,
    closingLedgerBalancePaise,
    totalLedgerInflowPaise: ledgerCredits,
    totalLedgerOutflowPaise: ledgerDebits,
    netLedgerMovementPaise,
    netLedgerTotalPaise,
    matchedAmountPaise,
    unresolvedVariancePaise,
    matchPercentage,
    unmatchedBankCount: exceptions.filter((e) => e.type === 'UNMATCHED_BANK').length,
    unmatchedLedgerCount: exceptions.filter((e) => e.type === 'UNMATCHED_LEDGER').length,
    amountMismatchCount: exceptions.filter((e) => e.type === 'AMOUNT_MISMATCH').length,
    duplicateCandidateCount: exceptions.filter((e) => e.type === 'DUPLICATE_CANDIDATE').length,
    ambiguousMatchCount: exceptions.filter((e) => e.type === 'AMBIGUOUS_MATCH').length,
  };

  return { matches, exceptions, summary };
}

/**
 * ProofLedger AI — Reconciliation Analytics & Financial Aggregation Engine
 * 
 * Provides pure, deterministic data-aggregation helpers for:
 * 1. Daily Inflow/Outflow chronological movement series.
 * 2. Reconciliation match vs exception composition distribution.
 * 3. Exception priority and materiality ranking.
 * 4. Exact mathematical reconciliation audit bridge.
 * 
 * Strict rule: Binary floating point arithmetic is never used;
 * all calculations use integer paise.
 */

import type { 
  CanonicalTransaction, 
  ReconciliationMatch, 
  ReconciliationException, 
  ReconciliationSummary 
} from './index';
import { sumPaise, formatPaise } from '../money';

export interface DailyMovementBucket {
  date: string; // ISO format: 'YYYY-MM-DD'
  displayDate: string; // e.g. 'Sep 02'
  dayNumber: number;
  bankInflowPaise: number;
  bankOutflowPaise: number;
  ledgerInflowPaise: number;
  ledgerOutflowPaise: number;
  netBankPaise: number;
  netLedgerPaise: number;
  bankCount: number;
  ledgerCount: number;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

function formatDisplayDate(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parts[2];
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${MONTH_NAMES[monthIdx]} ${day}`;
    }
  }
  return isoDate;
}

/**
 * Aggregates daily transaction volume and directional movement into chronological daily buckets.
 */
export function getDailyMovementSeries(
  bankRows: CanonicalTransaction[],
  ledgerRows: CanonicalTransaction[]
): DailyMovementBucket[] {
  const dateMap = new Map<string, {
    bankInflows: number[];
    bankOutflows: number[];
    ledgerInflows: number[];
    ledgerOutflows: number[];
    bankCount: number;
    ledgerCount: number;
  }>();

  const getOrCreate = (d: string) => {
    let entry = dateMap.get(d);
    if (!entry) {
      entry = {
        bankInflows: [],
        bankOutflows: [],
        ledgerInflows: [],
        ledgerOutflows: [],
        bankCount: 0,
        ledgerCount: 0,
      };
      dateMap.set(d, entry);
    }
    return entry;
  };

  for (const b of bankRows) {
    if (!b.date) continue;
    const entry = getOrCreate(b.date);
    entry.bankCount += 1;
    if (b.direction === 'credit') {
      entry.bankInflows.push(b.amountPaise);
    } else {
      entry.bankOutflows.push(b.amountPaise);
    }
  }

  for (const l of ledgerRows) {
    if (!l.date) continue;
    const entry = getOrCreate(l.date);
    entry.ledgerCount += 1;
    if (l.direction === 'credit') {
      entry.ledgerInflows.push(l.amountPaise);
    } else {
      entry.ledgerOutflows.push(l.amountPaise);
    }
  }

  const sortedDates = Array.from(dateMap.keys()).sort();

  return sortedDates.map((date) => {
    const entry = dateMap.get(date)!;
    const bankInflowPaise = sumPaise(entry.bankInflows);
    const bankOutflowPaise = sumPaise(entry.bankOutflows);
    const ledgerInflowPaise = sumPaise(entry.ledgerInflows);
    const ledgerOutflowPaise = sumPaise(entry.ledgerOutflows);

    const parts = date.split('-');
    const dayNumber = parts.length === 3 ? parseInt(parts[2], 10) : 0;

    return {
      date,
      displayDate: formatDisplayDate(date),
      dayNumber,
      bankInflowPaise,
      bankOutflowPaise,
      ledgerInflowPaise,
      ledgerOutflowPaise,
      netBankPaise: bankInflowPaise - bankOutflowPaise,
      netLedgerPaise: ledgerInflowPaise - ledgerOutflowPaise,
      bankCount: entry.bankCount,
      ledgerCount: entry.ledgerCount,
    };
  });
}

export interface CompositionSegment {
  key: string;
  label: string;
  count: number;
  volumePaise: number;
  percentage: number;
  color: string;
  hoverColor: string;
  filterType?: string;
}

/**
 * Calculates reconciliation breakdown composition percentages and total financial volume.
 */
export function getReconciliationComposition(
  matches: ReconciliationMatch[],
  exceptions: ReconciliationException[],
  summary: ReconciliationSummary
): CompositionSegment[] {
  const totalItems = matches.length + exceptions.length;

  const unmatchedBank = exceptions.filter((e) => e.type === 'UNMATCHED_BANK');
  const unmatchedLedger = exceptions.filter((e) => e.type === 'UNMATCHED_LEDGER');
  const amountMismatch = exceptions.filter((e) => e.type === 'AMOUNT_MISMATCH');
  const duplicateCandidate = exceptions.filter((e) => e.type === 'DUPLICATE_CANDIDATE');
  const ambiguousMatch = exceptions.filter((e) => e.type === 'AMBIGUOUS_MATCH');

  const calcVolume = (list: ReconciliationException[]) => 
    sumPaise(list.map((e) => Math.abs(e.amountDeltaPaise || e.bankTransaction?.amountPaise || e.ledgerTransaction?.amountPaise || 0)));

  const safePct = (count: number) => 
    totalItems > 0 ? Number(((count / totalItems) * 100).toFixed(1)) : 0;

  const segments: CompositionSegment[] = [
    {
      key: 'CONFIRMED',
      label: 'Confirmed Matches',
      count: matches.length,
      volumePaise: summary.matchedAmountPaise,
      percentage: safePct(matches.length),
      color: '#17845B', // Emerald Green
      hoverColor: '#126646',
      filterType: 'MATCHES',
    },
    {
      key: 'AMOUNT_MISMATCH',
      label: 'Amount Discrepancies',
      count: amountMismatch.length,
      volumePaise: calcVolume(amountMismatch),
      percentage: safePct(amountMismatch.length),
      color: '#2563EB', // Sapphire Blue
      hoverColor: '#1D4ED8',
      filterType: 'AMOUNT_MISMATCH',
    },
    {
      key: 'UNMATCHED_BANK',
      label: 'Unmatched Bank',
      count: unmatchedBank.length,
      volumePaise: calcVolume(unmatchedBank),
      percentage: safePct(unmatchedBank.length),
      color: '#D75E4C', // Coral Red
      hoverColor: '#B84535',
      filterType: 'UNMATCHED_BANK',
    },
    {
      key: 'UNMATCHED_LEDGER',
      label: 'Unmatched Ledger',
      count: unmatchedLedger.length,
      volumePaise: calcVolume(unmatchedLedger),
      percentage: safePct(unmatchedLedger.length),
      color: '#D97706', // Amber
      hoverColor: '#B45309',
      filterType: 'UNMATCHED_LEDGER',
    },
    {
      key: 'DUPLICATE_CANDIDATE',
      label: 'Duplicate Candidates',
      count: duplicateCandidate.length,
      volumePaise: calcVolume(duplicateCandidate),
      percentage: safePct(duplicateCandidate.length),
      color: '#7C3AED', // Violet
      hoverColor: '#6D28D9',
      filterType: 'DUPLICATE_CANDIDATE',
    },
  ];

  if (ambiguousMatch.length > 0) {
    segments.push({
      key: 'AMBIGUOUS_MATCH',
      label: 'Ambiguous Ties',
      count: ambiguousMatch.length,
      volumePaise: calcVolume(ambiguousMatch),
      percentage: safePct(ambiguousMatch.length),
      color: '#6B7280', // Slate Gray
      hoverColor: '#4B5563',
      filterType: 'AMBIGUOUS_MATCH',
    });
  }

  // Filter out empty zero-count segments except confirmed matches
  return segments.filter((s) => s.count > 0 || s.key === 'CONFIRMED');
}

export type ExceptionSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface PrioritizedException extends ReconciliationException {
  severity: ExceptionSeverity;
  formattedDelta: string;
  impactOrder: number;
}

/**
 * Sorts exceptions by financial materiality and potential balance sheet impact.
 */
export function getPrioritizedExceptions(
  exceptions: ReconciliationException[]
): PrioritizedException[] {
  return [...exceptions]
    .map((e) => {
      const absPaise = Math.abs(e.amountDeltaPaise || e.bankTransaction?.amountPaise || e.ledgerTransaction?.amountPaise || 0);
      
      let severity: ExceptionSeverity = 'LOW';
      if (absPaise >= 1000000) {
        severity = 'CRITICAL'; // >= ₹10,000
      } else if (absPaise >= 200000 || e.type === 'DUPLICATE_CANDIDATE' || e.type === 'AMOUNT_MISMATCH') {
        severity = 'HIGH'; // >= ₹2,000 or high audit risk
      } else if (absPaise >= 50000) {
        severity = 'MEDIUM'; // >= ₹500
      }

      return {
        ...e,
        severity,
        formattedDelta: formatPaise(e.amountDeltaPaise || e.bankTransaction?.amountPaise || e.ledgerTransaction?.amountPaise || 0, { showSign: true }),
        impactOrder: absPaise,
      };
    })
    .sort((a, b) => b.impactOrder - a.impactOrder);
}

export interface ReconciliationBridgeItem {
  id: string;
  label: string;
  source: 'bank' | 'ledger';
  impactPaise: number;
  formattedImpact: string;
  explanation: string;
  exceptionType: string;
}

export interface ReconciliationBridgeResult {
  openingBankBalancePaise: number;
  closingBankBalancePaise: number;
  closingLedgerBalancePaise: number;
  unresolvedVariancePaise: number;
  bridgeItems: ReconciliationBridgeItem[];
  bridgedTotalPaise: number;
  residualPaise: number;
  formattedResidual: string;
  isBalanced: boolean;
  formula: string;
}

/**
 * Formulates the mathematical audit bridge explaining the variance between
 * the Bank Closing Balance and the General Ledger Closing Balance.
 * 
 * Mathematical Relationship:
 * Ledger Closing Balance = Bank Closing Balance - Net Bank-minus-Ledger Variance
 */
export function getReconciliationBridge(
  summary: ReconciliationSummary,
  exceptions: ReconciliationException[]
): ReconciliationBridgeResult {
  const bridgeItems: ReconciliationBridgeItem[] = [];

  for (const e of exceptions) {
    let impactPaise = 0;
    let label = e.title;
    let explanation = e.description;

    if (e.type === 'AMOUNT_MISMATCH') {
      // Bank received less or more than ledger recorded
      impactPaise = e.amountDeltaPaise; // Bank - Ledger
      explanation = 'Possible gateway/processing fee difference between invoiced amount and settled bank credit; requires verification against settlement voucher.';
    } else if (e.type === 'UNMATCHED_BANK') {
      // In bank, not yet booked in ledger
      // If credit (+ in bank), increases bank over ledger
      // If debit (- in bank), reduces bank relative to ledger
      const isCredit = e.bankTransaction?.direction === 'credit';
      const absAmount = e.bankTransaction?.amountPaise ?? 0;
      impactPaise = isCredit ? absAmount : -absAmount;
      explanation = isCredit 
        ? 'Direct bank receipt / interest income unrecorded in ledger; requires confirmation.'
        : 'Bank fee / direct debit charges unposted in accounting ledger; requires verification.';
    } else if (e.type === 'UNMATCHED_LEDGER') {
      // In ledger, not yet cleared at bank (e.g. unpresented cheques, uncleared deposits)
      const isCredit = e.ledgerTransaction?.direction === 'credit';
      const absAmount = e.ledgerTransaction?.amountPaise ?? 0;
      // If debit (expense in ledger), bank has NOT paid yet, so Bank balance is HIGHER by absAmount (+).
      // If credit (income in ledger), bank has NOT received yet, so Bank balance is LOWER by absAmount (-).
      impactPaise = isCredit ? -absAmount : absAmount;
      explanation = isCredit
        ? 'Deposits in transit recorded in ledger, pending bank clearance; requires confirmation.'
        : 'Outstanding unpresented vendor payment cheque issued but not yet debited by bank; pending bank clearance.';
    } else if (e.type === 'DUPLICATE_CANDIDATE') {
      const isBank = Boolean(e.bankTransaction);
      const isCredit = (e.bankTransaction || e.ledgerTransaction)?.direction === 'credit';
      const absAmount = (e.bankTransaction || e.ledgerTransaction)?.amountPaise ?? 0;
      if (isBank) {
        impactPaise = isCredit ? absAmount : -absAmount;
        explanation = 'Suspected duplicate bank charge debited twice; requires confirmation before adjustment.';
      } else {
        impactPaise = isCredit ? -absAmount : absAmount;
        explanation = 'Suspected duplicate voucher entry in general ledger; requires verification.';
      }
    } else if (e.type === 'AMBIGUOUS_MATCH') {
      impactPaise = e.amountDeltaPaise;
      explanation = 'Multiple candidate tie requiring human confirmation.';
    }

    bridgeItems.push({
      id: e.exceptionId,
      label,
      source: e.bankTransaction ? 'bank' : 'ledger',
      impactPaise,
      formattedImpact: formatPaise(impactPaise, { showSign: true }),
      explanation,
      exceptionType: e.type,
    });
  }

  const bridgedTotalPaise = sumPaise(bridgeItems.map((b) => b.impactPaise));
  
  // Strengthened 2-way verification:
  // 1. Sum of item variance contributions must equal the reported summary variance
  const matchesReportedVariance = bridgedTotalPaise === summary.unresolvedVariancePaise;
  
  // 2. Ledger Closing Balance must equal Bank Closing Balance minus bridged variance
  // Residual = (Bank Closing - bridgedTotalPaise) - Ledger Closing
  const residualPaise = (summary.closingBankBalancePaise - bridgedTotalPaise) - summary.closingLedgerBalancePaise;
  const zeroResidual = residualPaise === 0;

  const isBalanced = matchesReportedVariance && zeroResidual;
  const formattedResidual = formatPaise(residualPaise, { showSign: true });
  const formula = 'Ledger Closing Balance = Bank Closing Balance - Net Bank-minus-Ledger Variance';

  return {
    openingBankBalancePaise: summary.openingBankBalancePaise,
    closingBankBalancePaise: summary.closingBankBalancePaise,
    closingLedgerBalancePaise: summary.closingLedgerBalancePaise,
    unresolvedVariancePaise: summary.unresolvedVariancePaise,
    bridgeItems,
    bridgedTotalPaise,
    residualPaise,
    formattedResidual,
    isBalanced,
    formula,
  };
}

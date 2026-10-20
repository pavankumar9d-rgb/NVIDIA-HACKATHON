import { getSupabaseClient } from './client';
import type { ReconciliationResult } from '../reconciliation';
import { 
  getReconciliationBridge, 
  calculateExceptionVarianceContributionPaise
} from '../reconciliation/analytics';

/**
 * Sanitized Reconciliation Snapshot for persistent cloud history.
 * Explicit allowlist: NO rawRow objects, NO raw CSV strings, NO unmasked PII.
 */
export interface SanitizedHistorySnapshot {
  sessionName: string;
  savedAt: string;
  isSynthetic: boolean;
  summary: {
    bankRowCount: number;
    ledgerRowCount: number;
    matchedRowCount: number;
    matchedPairsCount: number;
    exceptionCount: number;
    openingBankBalancePaise: number;
    closingBankBalancePaise: number;
    openingLedgerBalancePaise: number;
    closingLedgerBalancePaise: number;
    unresolvedVariancePaise: number;
    matchedAmountPaise: number;
    matchPercentage: number;
    bankOpeningProvenance: string;
    ledgerOpeningProvenance: string;
    bankClosingProvenance: string;
    ledgerClosingProvenance: string;
  };
  matches: Array<{
    matchId: string;
    bankId: string;
    ledgerId: string;
    date: string;
    amountPaise: number;
    direction: 'credit' | 'debit';
    reference?: string;
    sanitizedDescription: string;
  }>;
  exceptions: Array<{
    exceptionId: string;
    type: string;
    title: string;
    amountDeltaPaise: number;
    varianceContributionPaise: number;
    reviewDecision?: {
      status: string;
      reviewer: string;
      timestamp: string;
      note?: string;
    };
    aiHypothesis?: {
      classification: string;
      summary: string;
      confidence: string;
      model?: string;
    };
  }>;
  bridge: {
    isBalanced: boolean;
    bridgedTotalPaise: number;
    residualPaise: number;
    items: Array<{
      label: string;
      source: 'bank' | 'ledger';
      impactPaise: number;
      explanation: string;
    }>;
  };
}

export interface HistoryRecord {
  id: string;
  user_id: string;
  session_name: string;
  is_synthetic: boolean;
  bank_row_count: number;
  ledger_row_count: number;
  matched_pairs_count: number;
  exception_count: number;
  closing_bank_balance_paise: number;
  closing_ledger_balance_paise: number;
  unresolved_variance_paise: number;
  is_bridge_balanced: boolean;
  snapshot: SanitizedHistorySnapshot;
  created_at: string;
  updated_at: string;
}

/**
 * Builds an allowlisted, sanitized snapshot of a completed reconciliation.
 * Deliberately excludes:
 * - Original uploaded CSV text
 * - rawRow objects containing arbitrary unparsed spreadsheet cells
 * - Raw descriptions containing unredacted phone/account identifiers
 */
export function buildSanitizedHistorySnapshot(
  sessionName: string,
  result: ReconciliationResult,
  isSynthetic: boolean
): SanitizedHistorySnapshot {
  const bridge = getReconciliationBridge(result.summary, result.exceptions);

  return {
    sessionName,
    savedAt: new Date().toISOString(),
    isSynthetic,
    summary: {
      bankRowCount: result.summary.bankRowCount,
      ledgerRowCount: result.summary.ledgerRowCount,
      matchedRowCount: result.matches.length * 2,
      matchedPairsCount: result.summary.confirmedMatchCount ?? result.matches.length,
      exceptionCount: result.exceptions.length,
      openingBankBalancePaise: result.summary.openingBankBalancePaise,
      closingBankBalancePaise: result.summary.closingBankBalancePaise,
      openingLedgerBalancePaise: result.summary.openingLedgerBalancePaise,
      closingLedgerBalancePaise: result.summary.closingLedgerBalancePaise,
      unresolvedVariancePaise: result.summary.unresolvedVariancePaise,
      matchedAmountPaise: result.summary.matchedAmountPaise,
      matchPercentage: result.summary.matchPercentage,
      bankOpeningProvenance: result.summary.bankOpeningProvenance,
      ledgerOpeningProvenance: result.summary.ledgerOpeningProvenance,
      bankClosingProvenance: result.summary.bankClosingProvenance,
      ledgerClosingProvenance: result.summary.ledgerClosingProvenance,
    },
    matches: result.matches.map((m) => ({
      matchId: m.matchId,
      bankId: m.bankTransaction.id,
      ledgerId: m.ledgerTransaction.id,
      date: m.bankTransaction.date,
      amountPaise: m.bankTransaction.amountPaise,
      direction: m.bankTransaction.direction,
      reference: m.bankTransaction.reference || m.ledgerTransaction.reference,
      sanitizedDescription: m.bankTransaction.sanitizedDescription || m.ledgerTransaction.sanitizedDescription,
    })),
    exceptions: result.exceptions.map((e) => ({
      exceptionId: e.exceptionId,
      type: e.type,
      title: e.title,
      amountDeltaPaise: e.amountDeltaPaise,
      varianceContributionPaise: calculateExceptionVarianceContributionPaise(e),
      reviewDecision: e.reviewDecision ? {
        status: e.reviewDecision.status,
        reviewer: e.reviewDecision.reviewer,
        timestamp: e.reviewDecision.timestamp,
        note: e.reviewDecision.note,
      } : undefined,
      aiHypothesis: e.aiHypothesis ? {
        classification: e.aiHypothesis.classification,
        summary: e.aiHypothesis.summary,
        confidence: e.aiHypothesis.confidence,
        model: e.aiHypothesis.model,
      } : undefined,
    })),
    bridge: {
      isBalanced: bridge.isBalanced,
      bridgedTotalPaise: bridge.bridgedTotalPaise,
      residualPaise: bridge.residualPaise,
      items: bridge.bridgeItems.map((b) => ({
        label: b.label,
        source: b.source,
        impactPaise: b.impactPaise,
        explanation: b.explanation,
      })),
    },
  };
}

/**
 * Saves a sanitized reconciliation snapshot to Supabase PostgreSQL database.
 * Enforces RLS: inserted user_id must equal auth.uid().
 */
export async function saveReconciliationToHistory(
  sessionName: string,
  result: ReconciliationResult,
  isSynthetic: boolean
): Promise<{ data: HistoryRecord | null; error: Error | null }> {
  const client = getSupabaseClient();
  if (!client) {
    return { 
      data: null, 
      error: new Error('Supabase client is not configured. Cloud history requires VITE_SUPABASE_URL.') 
    };
  }

  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) {
    return { 
      data: null, 
      error: new Error('You must be signed in with Google to save reconciliation history.') 
    };
  }

  const snapshot = buildSanitizedHistorySnapshot(sessionName, result, isSynthetic);

  try {
    const { data, error } = await client
      .from('reconciliation_history')
      .insert({
        user_id: user.id,
        session_name: sessionName.trim(),
        is_synthetic: isSynthetic,
        bank_row_count: result.summary.bankRowCount,
        ledger_row_count: result.summary.ledgerRowCount,
        matched_pairs_count: result.matches.length,
        exception_count: result.exceptions.length,
        closing_bank_balance_paise: result.summary.closingBankBalancePaise,
        closing_ledger_balance_paise: result.summary.closingLedgerBalancePaise,
        unresolved_variance_paise: result.summary.unresolvedVariancePaise,
        is_bridge_balanced: snapshot.bridge.isBalanced,
        snapshot,
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as HistoryRecord, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * Fetches user's saved reconciliation history, ordered newest first.
 * Protected by database Row Level Security.
 */
export async function fetchReconciliationHistory(
  limit = 20
): Promise<{ data: HistoryRecord[]; error: Error | null }> {
  const client = getSupabaseClient();
  if (!client) {
    return { data: [], error: new Error('Supabase credentials are not configured.') };
  }

  try {
    const { data, error } = await client
      .from('reconciliation_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { data: [], error: new Error(error.message) };
    }

    return { data: (data || []) as HistoryRecord[], error: null };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * Deletes a saved history record.
 * RLS enforces that only the row owner can delete it.
 */
export async function deleteReconciliationHistory(
  id: string
): Promise<{ error: Error | null }> {
  const client = getSupabaseClient();
  if (!client) {
    return { error: new Error('Supabase credentials are not configured.') };
  }

  try {
    const { error } = await client
      .from('reconciliation_history')
      .delete()
      .eq('id', id);

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err : new Error(String(err)) };
  }
}

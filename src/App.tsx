import React, { useState, useEffect, useCallback } from 'react';
import { NavigationRail } from './components/NavigationRail';
import { TopBar } from './components/TopBar';
import { WorkflowRibbon } from './components/WorkflowRibbon';
import { OverviewView } from './components/OverviewView';
import { TransactionGrid } from './components/TransactionGrid';
import { EvidencePanel } from './components/EvidencePanel';
import { ImportModal } from './components/ImportModal';
import { ExportModal } from './components/ExportModal';
import { PrivacyDrawer } from './components/PrivacyDrawer';
import { AuditTrailView } from './components/AuditTrailView';
import { BrandedPreloader } from './components/BrandedPreloader';
import type { 
  CanonicalTransaction, 
  ReconciliationResult, 
  ReconciliationException,
  ReconciliationOptions
} from './lib/reconciliation';
import { runReconciliation } from './lib/reconciliation';
import { parseCSVString, validateAndNormalizeRows } from './lib/csv';
import { buildMinimizedExceptionPayload } from './lib/privacy';
import { 
  SYNTHETIC_BANK_CSV, 
  SYNTHETIC_LEDGER_CSV 
} from './data/syntheticDemo';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'overview' | 'workspace' | 'privacy' | 'audit'>('overview');
  const [sessionName, setSessionName] = useState('Northstar Studio — September Close');
  const [isSynthetic, setIsSynthetic] = useState(true);
  const [isAppReady, setIsAppReady] = useState(false);
  const [activeTableFilter, setActiveTableFilter] = useState<string | undefined>(undefined);

  const [bankRows, setBankRows] = useState<CanonicalTransaction[]>([]);
  const [ledgerRows, setLedgerRows] = useState<CanonicalTransaction[]>([]);
  const [sessionBalances, setSessionBalances] = useState<ReconciliationOptions>({
    openingBankBalancePaise: 45000000,
    closingBankBalancePaise: 47638000,
    openingLedgerBalancePaise: 45000000,
  });
  const [reconciliationResult, setReconciliationResult] = useState<ReconciliationResult | null>(null);
  const [selectedItem, setSelectedItem] = useState<{ type: 'match' | 'exception'; id: string } | null>(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isAILoading, setIsAILoading] = useState(false);
  const [aiInvestigationStep, setAiInvestigationStep] = useState<string | null>(null);

  const [aiStatus, setAiStatus] = useState({
    configured: false,
    allowLiveAI: false,
    modelId: 'nvidia/Llama-3.1-Nemotron-70B-Instruct',
    endpoint: 'Nebius Token Factory (OpenAI-compatible)',
    status: 'LOCAL_ONLY',
  });

  // Check server health and AI status on mount
  useEffect(() => {
    fetch('/api/ai/status')
      .then((res) => res.json())
      .then((data) => {
        setAiStatus({
          configured: Boolean(data.configured),
          allowLiveAI: Boolean(data.allowLiveAI),
          modelId: data.modelId || 'nvidia/Llama-3.1-Nemotron-70B-Instruct',
          endpoint: data.endpoint || 'Nebius Token Factory',
          status: data.status || 'LOCAL_ONLY',
        });
      })
      .catch(() => {
        setAiStatus({
          configured: false,
          allowLiveAI: false,
          modelId: 'nvidia/Llama-3.1-Nemotron-70B-Instruct',
          endpoint: 'Nebius Token Factory',
          status: 'LOCAL_ONLY',
        });
      });
  }, []);

  // Load the Northstar Studio synthetic dataset
  const loadSyntheticDemo = useCallback(async () => {
    const parsedBank = await parseCSVString(SYNTHETIC_BANK_CSV);
    const { 
      validRows: bankValid, 
      detectedOpeningBalancePaise: bOpen, 
      detectedClosingBalancePaise: bClose 
    } = validateAndNormalizeRows(parsedBank.rows, parsedBank.detectedMapping, 'BNK');

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

    const balances: ReconciliationOptions = {
      openingBankBalancePaise: bOpen ?? 45000000,
      closingBankBalancePaise: bClose ?? 47638000,
      openingLedgerBalancePaise: bOpen ?? 45000000,
      hasBankOpeningAnchor: bOpen !== undefined,
      hasBankClosingAnchor: bClose !== undefined,
      hasLedgerOpeningAnchor: false,
      hasLedgerClosingAnchor: false,
    };

    setBankRows(bCanonical);
    setLedgerRows(lCanonical);
    setSessionBalances(balances);
    setSessionName('Northstar Studio — September Close');
    setIsSynthetic(true);

    const result = runReconciliation(bCanonical, lCanonical, balances);
    setReconciliationResult(result);

    if (result.exceptions.length > 0) {
      setSelectedItem({ type: 'exception', id: result.exceptions[0].exceptionId });
    }
    setIsAppReady(true);
  }, []);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void loadSyntheticDemo();
  }, [loadSyntheticDemo]);

  const handleRunReconciliation = () => {
    if (bankRows.length === 0 || ledgerRows.length === 0) return;
    const result = runReconciliation(bankRows, ledgerRows, sessionBalances);
    setReconciliationResult(result);
  };

  const handleResetSession = () => {
    setBankRows([]);
    setLedgerRows([]);
    setReconciliationResult(null);
    setSelectedItem(null);
    setSessionName('New Reconciliation Session');
    setIsSynthetic(false);
  };

  const handleCustomImport = (
    bRows: CanonicalTransaction[],
    lRows: CanonicalTransaction[],
    name: string,
    options?: ReconciliationOptions
  ) => {
    const balances: ReconciliationOptions = {
      openingBankBalancePaise: options?.openingBankBalancePaise ?? 0,
      closingBankBalancePaise: options?.closingBankBalancePaise,
      openingLedgerBalancePaise: options?.openingLedgerBalancePaise ?? options?.openingBankBalancePaise ?? 0,
      closingLedgerBalancePaise: options?.closingLedgerBalancePaise,
      hasBankOpeningAnchor: options?.hasBankOpeningAnchor ?? false,
      hasLedgerOpeningAnchor: options?.hasLedgerOpeningAnchor ?? false,
      hasBankClosingAnchor: options?.hasBankClosingAnchor ?? false,
      hasLedgerClosingAnchor: options?.hasLedgerClosingAnchor ?? false,
      excludedBankRowCount: options?.excludedBankRowCount ?? 0,
      excludedLedgerRowCount: options?.excludedLedgerRowCount ?? 0,
    };

    setBankRows(bRows);
    setLedgerRows(lRows);
    setSessionBalances(balances);
    setSessionName(name);
    setIsSynthetic(false);

    const result = runReconciliation(bRows, lRows, balances);
    setReconciliationResult(result);
    if (result.exceptions.length > 0) {
      setSelectedItem({ type: 'exception', id: result.exceptions[0].exceptionId });
    } else if (result.matches.length > 0) {
      setSelectedItem({ type: 'match', id: result.matches[0].matchId });
    }
  };

  const handleReviewDecision = (
    exceptionId: string,
    decision: 'APPROVED' | 'REJECTED' | 'DEFERRED',
    note: string
  ) => {
    if (!reconciliationResult) return;

    const updatedExceptions = reconciliationResult.exceptions.map((e) => {
      if (e.exceptionId === exceptionId) {
        return {
          ...e,
          reviewDecision: {
            status: decision,
            reviewer: 'Priya Sharma (Finance Lead)',
            timestamp: new Date().toISOString(),
            note,
          },
        };
      }
      return e;
    });

    setReconciliationResult({
      ...reconciliationResult,
      exceptions: updatedExceptions,
    });
  };

  const handleRunAIInvestigation = async (
    exception: ReconciliationException,
    consentGranted: boolean
  ) => {
    if (!consentGranted) return;
    setIsAILoading(true);
    setAiInvestigationStep('Masking sensitive account identifiers & personal data...');

    try {
      const payload = {
        ...buildMinimizedExceptionPayload({
          exceptionId: exception.exceptionId,
          type: exception.type,
          bankRow: exception.bankTransaction
            ? {
                id: exception.bankTransaction.id,
                date: exception.bankTransaction.date,
                amountPaise: exception.bankTransaction.amountPaise,
                direction: exception.bankTransaction.direction,
                description: exception.bankTransaction.sanitizedDescription,
                reference: exception.bankTransaction.reference,
              }
            : undefined,
          ledgerRow: exception.ledgerTransaction
            ? {
                id: exception.ledgerTransaction.id,
                date: exception.ledgerTransaction.date,
                amountPaise: exception.ledgerTransaction.amountPaise,
                direction: exception.ledgerTransaction.direction,
                description: exception.ledgerTransaction.sanitizedDescription,
                reference: exception.ledgerTransaction.reference,
              }
            : undefined,
          candidateRows: exception.candidateTransactions?.map((c) => ({
            id: c.id,
            date: c.date,
            amountPaise: c.amountPaise,
            direction: c.direction,
            description: c.sanitizedDescription,
          })),
          deltaPaise: exception.amountDeltaPaise,
          dateLagDays: exception.dateDeltaDays,
        }),
        consentGranted: true,
      };

      setAiInvestigationStep('Requesting Nemotron-70B forensic hypothesis via Nebius...');

      const response = await fetch('/api/investigate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-ProofLedger-Client': 'v1',
        },
        body: JSON.stringify(payload),
      });

      setAiInvestigationStep('Validating structured response against schema contract...');

      const data = await response.json();

      if (data.status === 'AI_SUCCESS' && data.result) {
        if (reconciliationResult) {
          const updated = reconciliationResult.exceptions.map((e) => {
            if (e.exceptionId === exception.exceptionId) {
              return {
                ...e,
                aiHypothesis: {
                  ...data.result,
                  inferredAt: new Date().toISOString(),
                  model: data.model,
                },
              };
            }
            return e;
          });
          setReconciliationResult({ ...reconciliationResult, exceptions: updated });
        }
      } else {
        const localHypothesis = {
          classification: 
            exception.type === 'AMOUNT_MISMATCH'
              ? 'BANK_FEE_OR_SURCHARGE'
              : exception.type === 'DUPLICATE_CANDIDATE'
              ? 'DUPLICATE_ENTRY'
              : exception.dateDeltaDays > 0
              ? 'TIMING_DIFFERENCE'
              : 'UNRECORDED_DISBURSEMENT',
          summary: data.message || `Deterministic analysis: ${exception.title}`,
          evidenceRowIds: [
            ...(exception.bankTransaction ? [exception.bankTransaction.id] : []),
            ...(exception.ledgerTransaction ? [exception.ledgerTransaction.id] : []),
          ],
          evidenceExplanation: `Deterministic delta is ₹${(Math.abs(exception.amountDeltaPaise) / 100).toFixed(2)} with ${exception.dateDeltaDays} days timing lag.`,
          missingEvidence: [
            !exception.bankTransaction ? 'Bank Clearing Record' : '',
            !exception.ledgerTransaction ? 'Ledger Voucher' : '',
          ].filter(Boolean),
          recommendedAction: 'Verify vendor tax invoice or bank voucher to confirm variance.',
          confidence: 'MEDIUM' as const,
          uncertaintyNotes: data.error
            ? `Gateway rejected upstream output (${data.error}). Deterministic rule retained.`
            : 'Inferred via local deterministic rule. Configure Nebius API Key for live Nemotron LLM inference.',
          inferredAt: new Date().toISOString(),
          model: 'ProofLedger Local Deterministic Rule',
        };

        if (reconciliationResult) {
          const updated = reconciliationResult.exceptions.map((e) => {
            if (e.exceptionId === exception.exceptionId) {
              return { ...e, aiHypothesis: localHypothesis };
            }
            return e;
          });
          setReconciliationResult({ ...reconciliationResult, exceptions: updated });
        }
      }
    } catch (err) {
      console.error('Failed to run AI investigation:', err);
    } finally {
      setIsAILoading(false);
      setAiInvestigationStep(null);
    }
  };

  const selectedMatch =
    selectedItem?.type === 'match'
      ? reconciliationResult?.matches.find((m) => m.matchId === selectedItem.id)
      : undefined;

  const selectedException =
    selectedItem?.type === 'exception'
      ? reconciliationResult?.exceptions.find((e) => e.exceptionId === selectedItem.id)
      : undefined;

  const approvedCount =
    reconciliationResult?.exceptions.filter((e) => e.reviewDecision?.status === 'APPROVED').length || 0;
  const pendingReviewCount =
    reconciliationResult?.exceptions.filter((e) => !e.reviewDecision || e.reviewDecision.status === 'PENDING').length || 0;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F6F7F2] text-[#111827]">
      <BrandedPreloader isReady={isAppReady} />

      <NavigationRail
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          if (tab === 'overview') {
            setActiveTableFilter(undefined);
          }
        }}
        exceptionCount={reconciliationResult?.summary.exceptionCount || 0}
        aiStatus={aiStatus}
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <TopBar
          sessionName={sessionName}
          isSynthetic={isSynthetic}
          onLoadDemo={loadSyntheticDemo}
          onOpenImport={() => setIsImportModalOpen(true)}
          onRunReconciliation={handleRunReconciliation}
          onOpenExport={() => setIsExportModalOpen(true)}
          onResetSession={handleResetSession}
          hasData={bankRows.length > 0}
          isReconciled={Boolean(reconciliationResult)}
        />

        {currentTab === 'overview' && (
          <OverviewView
            sessionName={sessionName}
            isSynthetic={isSynthetic}
            bankRows={bankRows}
            ledgerRows={ledgerRows}
            reconciliationResult={reconciliationResult}
            onNavigateToWorkspace={(exceptionId, filterType) => {
              setCurrentTab('workspace');
              if (exceptionId) {
                setSelectedItem({ type: 'exception', id: exceptionId });
              }
              if (filterType) {
                setActiveTableFilter(filterType);
              }
            }}
            onOpenExport={() => setIsExportModalOpen(true)}
          />
        )}

        {currentTab === 'workspace' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <WorkflowRibbon
              currentStage={
                !reconciliationResult
                  ? 'sources'
                  : pendingReviewCount > 0
                  ? 'triage'
                  : approvedCount > 0
                  ? 'review'
                  : 'export'
              }
              hasData={bankRows.length > 0}
              isReconciled={Boolean(reconciliationResult)}
              pendingReviewCount={pendingReviewCount}
              approvedCount={approvedCount}
            />

            {/* AI Investigation Progress Banner if loading */}
            {isAILoading && (
              <div className="bg-[#101A2B] text-white px-4 md:px-6 py-2.5 flex items-center justify-between text-xs animate-in slide-in-from-top duration-150 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-3.5 h-3.5 border-2 border-[#D7FF56] border-t-transparent rounded-full animate-spin" />
                  <span className="font-semibold text-[#D7FF56]">Nemotron Investigation:</span>
                  <span className="text-slate-300">{aiInvestigationStep || 'Processing forensic evidence...'}</span>
                </div>
                <span className="text-[11px] font-mono text-slate-400">NVIDIA Llama-3.1-Nemotron-70B-Instruct</span>
              </div>
            )}

            <div className="flex-1 px-4 md:px-6 py-4 overflow-hidden flex flex-col">
              <TransactionGrid
                matches={reconciliationResult?.matches || []}
                exceptions={reconciliationResult?.exceptions || []}
                selectedItem={selectedItem}
                onSelectItem={setSelectedItem}
                externalFilter={activeTableFilter}
              />
            </div>

            <EvidencePanel
              selectedItem={selectedItem}
              match={selectedMatch}
              exception={selectedException}
              totalVariancePaise={reconciliationResult?.summary.unresolvedVariancePaise}
              onClose={() => setSelectedItem(null)}
              onReviewDecision={handleReviewDecision}
              aiStatus={aiStatus}
              onRunAIInvestigation={handleRunAIInvestigation}
              isAILoading={isAILoading}
            />
          </div>
        )}

        {currentTab === 'privacy' && (
          <div className="flex-1 overflow-y-auto">
            <PrivacyDrawer aiStatus={aiStatus} />
          </div>
        )}

        {currentTab === 'audit' && (
          <div className="flex-1 overflow-y-auto">
            <AuditTrailView
              matches={reconciliationResult?.matches || []}
              exceptions={reconciliationResult?.exceptions || []}
              summary={reconciliationResult?.summary || null}
              sessionName={sessionName}
              onOpenExport={() => setIsExportModalOpen(true)}
            />
          </div>
        )}
      </div>

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportComplete={handleCustomImport}
      />

      {isExportModalOpen && (
        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          matches={reconciliationResult?.matches || []}
          exceptions={reconciliationResult?.exceptions || []}
          summary={reconciliationResult?.summary || null}
          sessionName={sessionName}
          aiStatus={aiStatus}
        />
      )}
    </div>
  );
};

export default App;

import React, { useState, useEffect } from 'react';
import { NavigationRail } from './components/NavigationRail';
import { TopBar } from './components/TopBar';
import { WorkflowRibbon } from './components/WorkflowRibbon';
import { MetricsHeader } from './components/MetricsHeader';
import { TransactionGrid } from './components/TransactionGrid';
import { EvidencePanel } from './components/EvidencePanel';
import { ImportModal } from './components/ImportModal';
import { ExportModal } from './components/ExportModal';
import { PrivacyDrawer } from './components/PrivacyDrawer';
import { AuditTrailView } from './components/AuditTrailView';
import type { 
  CanonicalTransaction, 
  ReconciliationResult, 
  ReconciliationException 
} from './lib/reconciliation';
import { runReconciliation } from './lib/reconciliation';
import { parseCSVString, validateAndNormalizeRows } from './lib/csv';
import { buildMinimizedExceptionPayload } from './lib/privacy';
import { 
  SYNTHETIC_BANK_CSV, 
  SYNTHETIC_LEDGER_CSV 
} from './data/syntheticDemo';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'workspace' | 'privacy' | 'audit'>('workspace');
  const [sessionName, setSessionName] = useState('Northstar Studio — September Close');
  const [isSynthetic, setIsSynthetic] = useState(true);

  const [bankRows, setBankRows] = useState<CanonicalTransaction[]>([]);
  const [ledgerRows, setLedgerRows] = useState<CanonicalTransaction[]>([]);
  const [reconciliationResult, setReconciliationResult] = useState<ReconciliationResult | null>(null);
  const [selectedItem, setSelectedItem] = useState<{ type: 'match' | 'exception'; id: string } | null>(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isAILoading, setIsAILoading] = useState(false);

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
  const loadSyntheticDemo = async () => {
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

    setBankRows(bCanonical);
    setLedgerRows(lCanonical);
    setSessionName('Northstar Studio — September Close');
    setIsSynthetic(true);

    const result = runReconciliation(bCanonical, lCanonical);
    setReconciliationResult(result);

    if (result.exceptions.length > 0) {
      setSelectedItem({ type: 'exception', id: result.exceptions[0].exceptionId });
    }
  };

  useEffect(() => {
    loadSyntheticDemo();
  }, []);

  const handleRunReconciliation = () => {
    if (bankRows.length === 0 || ledgerRows.length === 0) return;
    const result = runReconciliation(bankRows, ledgerRows);
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
    name: string
  ) => {
    setBankRows(bRows);
    setLedgerRows(lRows);
    setSessionName(name);
    setIsSynthetic(false);

    const result = runReconciliation(bRows, lRows);
    setReconciliationResult(result);
    if (result.exceptions.length > 0) {
      setSelectedItem({ type: 'exception', id: result.exceptions[0].exceptionId });
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

      const response = await fetch('/api/investigate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-ProofLedger-Client': 'v1',
        },
        body: JSON.stringify(payload),
      });

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
      <NavigationRail
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
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

        {currentTab === 'workspace' && (
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            <div className="flex-1 flex flex-col overflow-y-auto">
              <MetricsHeader summary={reconciliationResult?.summary || null} />

              <div className="flex-1 px-4 md:px-6 pb-6 overflow-hidden">
                <TransactionGrid
                  matches={reconciliationResult?.matches || []}
                  exceptions={reconciliationResult?.exceptions || []}
                  selectedItem={selectedItem}
                  onSelectItem={setSelectedItem}
                />
              </div>
            </div>

            <EvidencePanel
              selectedItem={selectedItem}
              match={selectedMatch}
              exception={selectedException}
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

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        matches={reconciliationResult?.matches || []}
        exceptions={reconciliationResult?.exceptions || []}
        summary={reconciliationResult?.summary || null}
        sessionName={sessionName}
      />
    </div>
  );
};

export default App;

import React, { useState, useEffect, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { 
  History, 
  Search, 
  Trash2, 
  Eye, 
  X, 
  Calendar, 
  ShieldCheck, 
  AlertCircle,
  LogIn,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { 
  fetchReconciliationHistory, 
  deleteReconciliationHistory, 
  type HistoryRecord, 
  type SanitizedHistorySnapshot 
} from '../lib/supabase/history';
import { isSupabaseConfigured } from '../lib/supabase/client';
import { formatPaise } from '../lib/money';

interface HistoryViewProps {
  currentUser?: User | null;
  onSignIn?: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  currentUser,
  onSignIn,
}) => {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<SanitizedHistorySnapshot | null>(null);
  const [confirmDeleteRecord, setConfirmDeleteRecord] = useState<HistoryRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isConfigured = isSupabaseConfigured();

  const loadHistory = useCallback(async () => {
    if (!currentUser || !isConfigured) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await fetchReconciliationHistory(50);
      if (fetchErr) {
        setError(fetchErr.message);
      } else {
        setHistory(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch history');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, isConfigured]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void loadHistory();
  }, [loadHistory]);

  const handleDelete = async (record: HistoryRecord) => {
    setIsDeleting(true);
    try {
      const { error: delErr } = await deleteReconciliationHistory(record.id);
      if (delErr) {
        setError(delErr.message);
      } else {
        setHistory((prev) => prev.filter((item) => item.id !== record.id));
        setConfirmDeleteRecord(null);
        if (selectedSnapshot?.sessionName === record.session_name) {
          setSelectedSnapshot(null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete record');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredHistory = history.filter((item) =>
    item.session_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isConfigured) {
    return (
      <div className="flex-1 bg-[#F6F7F2] p-8 flex flex-col items-center justify-center text-center">
        <div className="max-w-md w-full bg-white border border-[#DDE3DA] rounded-2xl p-6 shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-700 mx-auto flex items-center justify-center">
            <History className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-[#111827]">Cloud History Not Configured</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            ProofLedger AI is running in local Guest Mode. Reconciliations remain in local client memory and are never persisted to cloud databases.
          </p>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-left text-[11px] font-mono text-slate-700 space-y-1">
            <div className="text-slate-500 font-sans font-bold">To enable private cloud history:</div>
            <div>VITE_SUPABASE_URL=https://...</div>
            <div>VITE_SUPABASE_ANON_KEY=...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex-1 bg-[#F6F7F2] p-8 flex flex-col items-center justify-center text-center">
        <div className="max-w-md w-full bg-white border border-[#DDE3DA] rounded-2xl p-6 shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-700 mx-auto flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-[#111827]">Sign In for Private Cloud History</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Sign in with Google to view and manage your encrypted reconciliation history. Row Level Security ensures only you can access your saved audit reports.
          </p>
          {onSignIn && (
            <button
              type="button"
              onClick={onSignIn}
              className="w-full py-2.5 px-4 rounded-xl bg-[#101A2B] hover:bg-[#1C2D48] text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <LogIn className="w-4 h-4 text-[#D7FF56]" />
              <span>Sign In with Google</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#F6F7F2] p-4 md:p-6 space-y-4">
      {/* Top Bar with Search & Refresh */}
      <div className="bg-white border border-[#DDE3DA] rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <History className="w-5 h-5 text-purple-600 shrink-0" />
          <div>
            <h2 className="text-sm font-bold text-[#111827]">Saved Reconciliation History</h2>
            <p className="text-[11px] text-slate-500">
              Private audit snapshots protected by Row Level Security ({history.length} records)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by session label..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-[#DDE3DA] focus:outline-none focus:border-purple-600"
            />
          </div>

          <button
            type="button"
            onClick={loadHistory}
            disabled={isLoading}
            className="p-2 rounded-lg border border-[#DDE3DA] hover:bg-[#F6F7F2] text-slate-600 transition-colors cursor-pointer"
            title="Refresh history"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500 text-xs">
          <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
          <span>Loading private history...</span>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredHistory.length === 0 && (
        <div className="bg-white border border-[#DDE3DA] rounded-xl p-8 text-center space-y-2">
          <History className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <h3 className="text-xs font-bold text-[#111827]">No Reconciliation Snapshots Found</h3>
          <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
            {searchQuery 
              ? 'No historical snapshots matched your search query.' 
              : 'Complete a reconciliation and click "Save to History" in the top bar to store your first private audit snapshot.'}
          </p>
        </div>
      )}

      {/* History Grid */}
      {!isLoading && filteredHistory.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredHistory.map((rec) => (
            <div 
              key={rec.id}
              className="bg-white border border-[#DDE3DA] hover:border-[#BDC8B7] rounded-xl p-4 shadow-2xs transition-all space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm text-[#111827]">{rec.session_name}</span>
                    {rec.is_synthetic && (
                      <span className="text-[10px] bg-[#EEF1EB] text-[#4B5563] px-1.5 py-0.5 rounded font-medium">
                        Synthetic
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-[#9CA3AF]">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(rec.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedSnapshot(rec.snapshot)}
                    className="p-1.5 rounded-lg border border-[#DDE3DA] hover:bg-[#F6F7F2] text-[#2563EB] text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    title="View snapshot details (read-only; preserves active session)"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">View</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfirmDeleteRecord(rec)}
                    className="p-1.5 rounded-lg border border-[#DDE3DA] hover:bg-rose-50 text-rose-600 transition-colors cursor-pointer"
                    title="Delete snapshot"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Snapshot metrics summary */}
              <div className="grid grid-cols-3 gap-2 bg-[#F9FAF8] p-2.5 rounded-lg border border-[#EEF1EB] text-xs">
                <div>
                  <span className="text-[10px] text-[#6B7280] block">Matched Pairs</span>
                  <span className="font-mono font-bold text-[#17845B]">
                    {rec.matched_pairs_count} pairs
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#6B7280] block">Exceptions</span>
                  <span className="font-mono font-bold text-amber-600">
                    {rec.exception_count} items
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#6B7280] block">Bridge Status</span>
                  <span className={`text-[11px] font-bold ${rec.is_bridge_balanced ? 'text-[#17845B]' : 'text-amber-600'}`}>
                    {rec.is_bridge_balanced ? 'Balanced' : 'Residual'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Snapshot Read-Only Modal (Does NOT overwrite active session) */}
      {selectedSnapshot && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] border border-[#DDE3DA] shadow-xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-[#DDE3DA] bg-[#F9FAF8] flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#111827]">{selectedSnapshot.sessionName}</span>
                  <span className="text-[10px] font-mono bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-bold">
                    Read-Only Snapshot
                  </span>
                </div>
                <span className="text-[11px] text-slate-500">
                  Saved on {new Date(selectedSnapshot.savedAt).toLocaleString('en-IN')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSnapshot(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto text-xs">
              {/* Balances Card */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-[#F9FAF8] border border-[#DDE3DA]">
                <div>
                  <span className="text-[10px] text-slate-500 block">Bank Closing Balance:</span>
                  <span className="font-mono font-bold text-[#111827] text-sm">
                    {formatPaise(selectedSnapshot.summary.closingBankBalancePaise)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Ledger Closing Balance:</span>
                  <span className="font-mono font-bold text-[#111827] text-sm">
                    {formatPaise(selectedSnapshot.summary.closingLedgerBalancePaise)}
                  </span>
                </div>
              </div>

              {/* Exceptions list */}
              <div className="space-y-2">
                <span className="font-bold text-[#111827] block">
                  Logged Exceptions ({selectedSnapshot.exceptions.length})
                </span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto border border-[#EEF1EB] rounded-lg p-2">
                  {selectedSnapshot.exceptions.map((e) => (
                    <div 
                      key={e.exceptionId}
                      className="p-2 rounded bg-white border border-[#DDE3DA] flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-800 block">{e.title}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{e.type}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-[#D75E4C]">
                          {formatPaise(e.varianceContributionPaise, { showSign: true })}
                        </span>
                        {e.reviewDecision && (
                          <div className="text-[10px] text-[#17845B] font-medium">
                            {e.reviewDecision.status}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mathematical Bridge Schedule */}
              <div className="space-y-2">
                <span className="font-bold text-[#111827] block">Mathematical Bridge Verification</span>
                <div className="p-3 rounded-lg border border-[#DDE3DA] bg-[#F9FAF8] space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span>Bridged Total Contribution:</span>
                    <span className="font-mono font-bold">{formatPaise(selectedSnapshot.bridge.bridgedTotalPaise, { showSign: true })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Bridge Balance Status:</span>
                    <span className="font-bold text-[#17845B]">
                      {selectedSnapshot.bridge.isBalanced ? 'Balanced (Zero-Leakage Residual: ₹0.00)' : 'Unbalanced'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-[#DDE3DA] bg-[#F9FAF8] flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedSnapshot(null)}
                className="px-4 py-1.5 rounded-lg bg-[#101A2B] text-white text-xs font-semibold hover:bg-[#1C2C45] cursor-pointer"
              >
                Close Snapshot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteRecord && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-[#DDE3DA] shadow-xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>Delete History Record</span>
            </div>
            <p className="text-xs text-slate-600">
              Are you sure you want to permanently delete <strong>{confirmDeleteRecord.session_name}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteRecord(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-lg border border-[#DDE3DA] text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmDeleteRecord)}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5"
              >
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


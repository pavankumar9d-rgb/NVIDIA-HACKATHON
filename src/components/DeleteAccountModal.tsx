import React, { useState } from 'react';
import { 
  UserX, 
  AlertTriangle, 
  ShieldAlert, 
  X, 
  Trash2
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onConfirmDelete: () => Promise<{ success: boolean; error?: string }>;
}

export const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onConfirmDelete,
}) => {
  const [confirmationInput, setConfirmationInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !currentUser) return null;

  const targetPhrase = 'DELETE MY ACCOUNT';
  const isConfirmed = confirmationInput.trim() === targetPhrase;

  const handleDelete = async () => {
    if (!isConfirmed || isDeleting) return;
    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const res = await onConfirmDelete();
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to delete account. Please try again.');
      } else {
        onClose();
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'An error occurred during account deletion.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-account-title"
    >
      <div className="bg-white rounded-3xl max-w-md w-full border border-rose-200 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-rose-100 bg-rose-50/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <h2 id="delete-account-title" className="text-base font-bold text-rose-950">
                Delete ProofLedger Account
              </h2>
              <span className="text-[11px] text-rose-700 font-mono">{currentUser.email}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
            aria-label="Close Modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 text-xs text-slate-700 space-y-4">
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 space-y-2">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Warning: This action is permanent and irreversible</span>
            </div>
            <p className="text-[11px] leading-relaxed text-rose-800">
              Deleting your account permanently purges your user identity and cascades to delete all your 
              cloud-saved <code>reconciliation_history</code> records in Supabase PostgreSQL.
            </p>
          </div>

          <div className="space-y-1.5 text-slate-600 text-[11px]">
            <p className="font-semibold text-slate-900">What will happen:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>All saved reconciliation snapshots belonging to your ID are permanently deleted.</li>
              <li>Your active session will be terminated and in-memory financial data flushed.</li>
              <li>You can sign in again in the future as a brand-new user with a clean slate.</li>
            </ul>
          </div>

          {/* Explicit Confirmation Input */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label htmlFor="confirm-phrase" className="block text-[11px] font-bold text-slate-800">
              To confirm, type <span className="font-mono text-rose-600 font-bold bg-rose-50 px-1 py-0.5 rounded">&quot;{targetPhrase}&quot;</span> below:
            </label>
            <input
              id="confirm-phrase"
              type="text"
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              disabled={isDeleting}
              placeholder={targetPhrase}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono text-xs uppercase"
            />
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-100 border border-rose-300 rounded-xl text-rose-800 text-[11px] space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <ShieldAlert className="w-4 h-4 text-rose-700 shrink-0" />
                <span>Deletion Error</span>
              </div>
              <p>{errorMessage}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-[#F6F7F2] flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="py-2 px-4 rounded-xl border border-[#DDE3DA] bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={!isConfirmed || isDeleting}
            className="py-2 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs disabled:cursor-not-allowed"
          >
            {isDeleting ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            <span>{isDeleting ? 'Deleting Account...' : 'Permanently Delete Account'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

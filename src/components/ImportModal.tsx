import React, { useState } from 'react';
import { 
  parseCSVString, 
  validateAndNormalizeRows, 
  SAMPLE_BANK_CSV_TEMPLATE, 
  SAMPLE_LEDGER_CSV_TEMPLATE
} from '../lib/csv';
import type { ValidatedCSVRow } from '../lib/csv';
import type { CanonicalTransaction } from '../lib/reconciliation';
import { 
  Upload, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  X
} from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (
    bankRows: CanonicalTransaction[],
    ledgerRows: CanonicalTransaction[],
    sessionName: string
  ) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [sessionTitle, setSessionTitle] = useState('October 2026 Monthly Close');
  const [bankFileName, setBankFileName] = useState<string>('');
  const [ledgerFileName, setLedgerFileName] = useState<string>('');

  const [bankValidatedRows, setBankValidatedRows] = useState<ValidatedCSVRow[]>([]);
  const [ledgerValidatedRows, setLedgerValidatedRows] = useState<ValidatedCSVRow[]>([]);
  const [bankErrors, setBankErrors] = useState<string[]>([]);
  const [ledgerErrors, setLedgerErrors] = useState<string[]>([]);

  if (!isOpen) return null;

  const handleBankFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv') && !file.name.toLowerCase().endsWith('.txt')) {
      setBankErrors(['Invalid file format. Please upload a standard CSV file (.csv).']);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setBankErrors(['File size exceeds 5 MB maximum limit. Please split your bank statement into smaller periods.']);
      return;
    }

    setBankFileName(file.name);
    try {
      const text = await file.text();
      const parsed = await parseCSVString(text);
      if (parsed.errors.length > 0 && parsed.rows.length === 0) {
        setBankErrors(parsed.errors);
        setBankValidatedRows([]);
        return;
      }

      const { validRows, invalidRows } = validateAndNormalizeRows(parsed.rows, parsed.detectedMapping, 'BNK');
      setBankValidatedRows(validRows);
      setBankErrors([...parsed.errors, ...invalidRows.flatMap((r) => r.validationErrors)]);
    } catch {
      setBankErrors(['Failed to read or parse bank statement file.']);
    }
  };

  const handleLedgerFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv') && !file.name.toLowerCase().endsWith('.txt')) {
      setLedgerErrors(['Invalid file format. Please upload a standard CSV file (.csv).']);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setLedgerErrors(['File size exceeds 5 MB maximum limit. Please split your accounting ledger into smaller periods.']);
      return;
    }

    setLedgerFileName(file.name);
    try {
      const text = await file.text();
      const parsed = await parseCSVString(text);
      if (parsed.errors.length > 0 && parsed.rows.length === 0) {
        setLedgerErrors(parsed.errors);
        setLedgerValidatedRows([]);
        return;
      }

      const { validRows, invalidRows } = validateAndNormalizeRows(parsed.rows, parsed.detectedMapping, 'LDG');
      setLedgerValidatedRows(validRows);
      setLedgerErrors([...parsed.errors, ...invalidRows.flatMap((r) => r.validationErrors)]);
    } catch {
      setLedgerErrors(['Failed to read or parse accounting ledger file.']);
    }
  };

  const downloadTemplate = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleConfirmImport = () => {
    const bankCanonical: CanonicalTransaction[] = bankValidatedRows.map((r, i) => ({
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

    const ledgerCanonical: CanonicalTransaction[] = ledgerValidatedRows.map((r, i) => ({
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

    onImportComplete(bankCanonical, ledgerCanonical, sessionTitle);
    onClose();
  };

  const canProceed = bankValidatedRows.length > 0 && ledgerValidatedRows.length > 0;

  return (
    <div className="fixed inset-0 bg-[#101A2B]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#DDE3DA] max-w-2xl w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-[#DDE3DA] pb-3">
          <div>
            <h2 className="text-lg font-bold text-[#111827]">Import Financial CSVs</h2>
            <p className="text-xs text-[#6B7280]">
              Files are parsed 100% in your browser. Raw statements never leave this tab.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-[#9CA3AF] hover:text-[#111827] hover:bg-[#EEF1EB]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#111827] mb-1">
            Session Label
          </label>
          <input
            type="text"
            value={sessionTitle}
            onChange={(e) => setSessionTitle(e.target.value)}
            className="w-full px-3 py-1.5 border border-[#DDE3DA] rounded-md text-xs text-[#111827] bg-[#FAFBF9]"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-[#DDE3DA] rounded-xl p-4 bg-[#FAFBF9] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#111827]">1. Bank Statement</span>
              <button
                type="button"
                onClick={() => downloadTemplate(SAMPLE_BANK_CSV_TEMPLATE, 'bank_statement_template.csv')}
                className="text-[11px] text-[#2563EB] hover:underline flex items-center gap-1"
                title="Download sample format"
              >
                <Download className="w-3 h-3" /> Template
              </button>
            </div>

            <label className="border-2 border-dashed border-[#CBD5C5] hover:border-[#101A2B] rounded-lg p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-white">
              <Upload className="w-6 h-6 text-[#6B7280] mb-1" />
              <span className="text-xs font-medium text-[#111827]">
                {bankFileName || 'Select or Drop Bank CSV'}
              </span>
              <span className="text-[10px] text-[#9CA3AF] mt-0.5">
                Headers: Date, Narration, Ref, Debit, Credit
              </span>
              <input type="file" accept=".csv" onChange={handleBankFileUpload} className="hidden" />
            </label>

            {bankValidatedRows.length > 0 && (
              <div className="text-[11px] text-[#17845B] bg-[#E8F5EE] p-2 rounded flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Parsed {bankValidatedRows.length} valid rows
              </div>
            )}

            {bankErrors.length > 0 && (
              <div className="text-[11px] text-[#D75E4C] bg-[#FDEDEA] p-2 rounded flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{bankErrors.slice(0, 2).join('; ')}</span>
              </div>
            )}
          </div>

          <div className="border border-[#DDE3DA] rounded-xl p-4 bg-[#FAFBF9] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#111827]">2. Accounting Ledger</span>
              <button
                type="button"
                onClick={() => downloadTemplate(SAMPLE_LEDGER_CSV_TEMPLATE, 'accounting_ledger_template.csv')}
                className="text-[11px] text-[#2563EB] hover:underline flex items-center gap-1"
                title="Download sample format"
              >
                <Download className="w-3 h-3" /> Template
              </button>
            </div>

            <label className="border-2 border-dashed border-[#CBD5C5] hover:border-[#101A2B] rounded-lg p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-white">
              <Upload className="w-6 h-6 text-[#6B7280] mb-1" />
              <span className="text-xs font-medium text-[#111827]">
                {ledgerFileName || 'Select or Drop Ledger CSV'}
              </span>
              <span className="text-[10px] text-[#9CA3AF] mt-0.5">
                Headers: Date, Narration, Voucher, Debit, Credit
              </span>
              <input type="file" accept=".csv" onChange={handleLedgerFileUpload} className="hidden" />
            </label>

            {ledgerValidatedRows.length > 0 && (
              <div className="text-[11px] text-[#17845B] bg-[#E8F5EE] p-2 rounded flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Parsed {ledgerValidatedRows.length} valid rows
              </div>
            )}

            {ledgerErrors.length > 0 && (
              <div className="text-[11px] text-[#D75E4C] bg-[#FDEDEA] p-2 rounded flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{ledgerErrors.slice(0, 2).join('; ')}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-[#DDE3DA]">
          <span className="text-[11px] text-[#6B7280]">
            Integer paise arithmetic active. Limits: 10,000 rows.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-md border border-[#DDE3DA] text-xs font-semibold text-[#4B5563] hover:bg-[#F6F7F2]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canProceed}
              onClick={handleConfirmImport}
              className="px-4 py-1.5 rounded-md bg-[#D7FF56] hover:bg-[#C9F540] text-[#111827] text-xs font-bold disabled:opacity-50 cursor-pointer shadow-xs"
            >
              Confirm & Reconcile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

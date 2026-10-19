import React, { useState } from 'react';
import { 
  parseCSVString, 
  validateAndNormalizeRows, 
  detectFileDateFormat,
  SAMPLE_BANK_CSV_TEMPLATE, 
  SAMPLE_LEDGER_CSV_TEMPLATE
} from '../lib/csv';
import type { 
  ValidatedCSVRow, 
  ColumnMapping, 
  DateFormat,
  MappingDetectionResult 
} from '../lib/csv';
import type { CanonicalTransaction, ReconciliationOptions, BalanceProvenance } from '../lib/reconciliation';
import { formatPaise, parseToPaise } from '../lib/money';
import { 
  Upload, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Info,
  X 
} from 'lucide-react';

interface FileState {
  fileName: string;
  rawHeaders: string[];
  rawRows: Record<string, string>[];
  mapping: ColumnMapping;
  inspection: MappingDetectionResult | null;
  dateFormat: DateFormat;
  amountMode: 'SEPARATE_DR_CR' | 'SINGLE_AMOUNT';
  openingBalanceInput: string;
  detectedOpeningPaise?: number;
  detectedClosingPaise?: number;
  hasOpeningRow: boolean;
  hasClosingRow: boolean;
  validRows: ValidatedCSVRow[];
  invalidRows: ValidatedCSVRow[];
  errors: string[];
  acknowledgeExcluded: boolean;
  showAdvanced: boolean;
}

const initialFileState: FileState = {
  fileName: '',
  rawHeaders: [],
  rawRows: [],
  mapping: { dateCol: '', descriptionCol: '' },
  inspection: null,
  dateFormat: 'AUTO',
  amountMode: 'SEPARATE_DR_CR',
  openingBalanceInput: '',
  detectedOpeningPaise: undefined,
  detectedClosingPaise: undefined,
  hasOpeningRow: false,
  hasClosingRow: false,
  validRows: [],
  invalidRows: [],
  errors: [],
  acknowledgeExcluded: false,
  showAdvanced: false,
};

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (
    bankRows: CanonicalTransaction[],
    ledgerRows: CanonicalTransaction[],
    sessionName: string,
    options?: ReconciliationOptions
  ) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [sessionTitle, setSessionTitle] = useState('October 2026 Monthly Close');
  const [bankFile, setBankFile] = useState<FileState>(initialFileState);
  const [ledgerFile, setLedgerFile] = useState<FileState>(initialFileState);

  if (!isOpen) return null;

  const processFile = async (
    file: File,
    sourcePrefix: 'BNK' | 'LDG'
  ): Promise<FileState> => {
    const isPDF = file.name.toLowerCase().endsWith('.pdf');
    if (isPDF) {
      return {
        ...initialFileState,
        fileName: file.name,
        errors: [
          'PDF statements and scanned documents are not supported directly. ProofLedger AI parses CSV and delimited text. Please export your statement to CSV from your online banking portal.',
        ],
      };
    }

    if (!file.name.toLowerCase().endsWith('.csv') && !file.name.toLowerCase().endsWith('.txt')) {
      return {
        ...initialFileState,
        fileName: file.name,
        errors: ['Invalid file format. Please upload a standard CSV or TSV file (.csv, .txt).'],
      };
    }

    if (file.size > 5 * 1024 * 1024) {
      return {
        ...initialFileState,
        fileName: file.name,
        errors: ['File size exceeds 5 MB maximum limit. Please split the statement into smaller periods.'],
      };
    }

    try {
      const text = await file.text();
      const parsed = await parseCSVString(text);
      if (parsed.errors.length > 0 && parsed.rows.length === 0) {
        return {
          ...initialFileState,
          fileName: file.name,
          errors: parsed.errors,
        };
      }

      const detectedDateFormat = detectFileDateFormat(parsed.rows, parsed.detectedMapping.dateCol);
      const normResult = validateAndNormalizeRows(
        parsed.rows,
        parsed.detectedMapping,
        sourcePrefix,
        { dateFormat: detectedDateFormat }
      );

      const inspection = parsed.inspection;
      const detectedOpeningFormatted = normResult.detectedOpeningBalancePaise !== undefined
        ? (normResult.detectedOpeningBalancePaise / 100).toFixed(2)
        : '';

      return {
        fileName: file.name,
        rawHeaders: parsed.headers,
        rawRows: parsed.rows,
        mapping: parsed.detectedMapping,
        inspection,
        dateFormat: detectedDateFormat,
        amountMode: inspection.detectedAmountMode === 'SINGLE_AMOUNT' ? 'SINGLE_AMOUNT' : 'SEPARATE_DR_CR',
        openingBalanceInput: detectedOpeningFormatted,
        detectedOpeningPaise: normResult.detectedOpeningBalancePaise,
        detectedClosingPaise: normResult.detectedClosingBalancePaise,
        hasOpeningRow: normResult.hasOpeningBalanceRow,
        hasClosingRow: normResult.hasClosingBalanceRow,
        validRows: normResult.validRows,
        invalidRows: normResult.invalidRows,
        errors: [...parsed.errors, ...normResult.invalidRows.flatMap((r) => r.validationErrors)],
        acknowledgeExcluded: false,
        showAdvanced: inspection.confidence === 'LOW' || normResult.invalidRows.length > 0,
      };
    } catch {
      return {
        ...initialFileState,
        fileName: file.name,
        errors: ['Failed to read or parse file in browser.'],
      };
    }
  };

  const renormalizeFile = (state: FileState, sourcePrefix: 'BNK' | 'LDG'): FileState => {
    if (state.rawRows.length === 0) return state;

    const normResult = validateAndNormalizeRows(
      state.rawRows,
      state.mapping,
      sourcePrefix,
      { dateFormat: state.dateFormat }
    );

    return {
      ...state,
      validRows: normResult.validRows,
      invalidRows: normResult.invalidRows,
      detectedOpeningPaise: normResult.detectedOpeningBalancePaise,
      detectedClosingPaise: normResult.detectedClosingBalancePaise,
      hasOpeningRow: normResult.hasOpeningBalanceRow,
      hasClosingRow: normResult.hasClosingBalanceRow,
      errors: normResult.invalidRows.flatMap((r) => r.validationErrors),
    };
  };

  const handleBankFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const nextState = await processFile(file, 'BNK');
    setBankFile(nextState);
  };

  const handleLedgerFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const nextState = await processFile(file, 'LDG');
    setLedgerFile(nextState);
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
    const bankCanonical: CanonicalTransaction[] = bankFile.validRows.map((r, i) => ({
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

    const ledgerCanonical: CanonicalTransaction[] = ledgerFile.validRows.map((r, i) => ({
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

    // Parse bank opening balance
    let bankOpeningPaise = 0;
    let bankOpeningProvenance: BalanceProvenance = 'UNVERIFIED_BASELINE';

    if (bankFile.openingBalanceInput.trim() !== '') {
      try {
        const parsed = parseToPaise(bankFile.openingBalanceInput);
        bankOpeningPaise = parsed;
        if (bankFile.detectedOpeningPaise !== undefined && parsed === bankFile.detectedOpeningPaise) {
          bankOpeningProvenance = 'STATEMENT_DETECTED';
        } else {
          bankOpeningProvenance = 'REVIEWER_SUPPLIED';
        }
      } catch {
        if (bankFile.detectedOpeningPaise !== undefined) {
          bankOpeningPaise = bankFile.detectedOpeningPaise;
          bankOpeningProvenance = 'STATEMENT_DETECTED';
        } else {
          bankOpeningPaise = 0;
          bankOpeningProvenance = 'UNVERIFIED_BASELINE';
        }
      }
    } else if (bankFile.detectedOpeningPaise !== undefined) {
      bankOpeningPaise = bankFile.detectedOpeningPaise;
      bankOpeningProvenance = 'STATEMENT_DETECTED';
    } else {
      bankOpeningPaise = 0;
      bankOpeningProvenance = 'UNVERIFIED_BASELINE';
    }

    // Parse ledger opening balance
    let ledgerOpeningPaise = bankOpeningPaise;
    let ledgerOpeningProvenance: BalanceProvenance = 'UNVERIFIED_BASELINE';

    if (ledgerFile.openingBalanceInput.trim() !== '') {
      try {
        const parsed = parseToPaise(ledgerFile.openingBalanceInput);
        ledgerOpeningPaise = parsed;
        if (ledgerFile.detectedOpeningPaise !== undefined && parsed === ledgerFile.detectedOpeningPaise) {
          ledgerOpeningProvenance = 'STATEMENT_DETECTED';
        } else {
          ledgerOpeningProvenance = 'REVIEWER_SUPPLIED';
        }
      } catch {
        if (ledgerFile.detectedOpeningPaise !== undefined) {
          ledgerOpeningPaise = ledgerFile.detectedOpeningPaise;
          ledgerOpeningProvenance = 'STATEMENT_DETECTED';
        } else {
          ledgerOpeningPaise = bankOpeningPaise;
          ledgerOpeningProvenance = 'UNVERIFIED_BASELINE';
        }
      }
    } else if (ledgerFile.detectedOpeningPaise !== undefined) {
      ledgerOpeningPaise = ledgerFile.detectedOpeningPaise;
      ledgerOpeningProvenance = 'STATEMENT_DETECTED';
    } else {
      // Falling back to bank opening balance merely as an unverified baseline
      ledgerOpeningPaise = bankOpeningPaise;
      ledgerOpeningProvenance = 'UNVERIFIED_BASELINE';
    }

    const bankClosingProvenance: BalanceProvenance = bankFile.detectedClosingPaise !== undefined
      ? 'STATEMENT_DETECTED'
      : 'DERIVED_FROM_NET_FLOW';
    const ledgerClosingProvenance: BalanceProvenance = ledgerFile.detectedClosingPaise !== undefined
      ? 'STATEMENT_DETECTED'
      : 'DERIVED_FROM_NET_FLOW';

    const hasBankOpening = bankOpeningProvenance !== 'UNVERIFIED_BASELINE';
    const hasLedgerOpening = ledgerOpeningProvenance !== 'UNVERIFIED_BASELINE';
    const hasBankClosing = bankClosingProvenance === 'STATEMENT_DETECTED';
    const hasLedgerClosing = ledgerClosingProvenance === 'STATEMENT_DETECTED';

    const options: ReconciliationOptions = {
      openingBankBalancePaise: bankOpeningPaise,
      closingBankBalancePaise: bankFile.detectedClosingPaise,
      openingLedgerBalancePaise: ledgerOpeningPaise,
      closingLedgerBalancePaise: ledgerFile.detectedClosingPaise,
      hasBankOpeningAnchor: hasBankOpening,
      hasLedgerOpeningAnchor: hasLedgerOpening,
      hasBankClosingAnchor: hasBankClosing,
      hasLedgerClosingAnchor: hasLedgerClosing,
      bankOpeningProvenance,
      ledgerOpeningProvenance,
      bankClosingProvenance,
      ledgerClosingProvenance,
      excludedBankRowCount: bankFile.acknowledgeExcluded ? bankFile.invalidRows.length : 0,
      excludedLedgerRowCount: ledgerFile.acknowledgeExcluded ? ledgerFile.invalidRows.length : 0,
    };

    onImportComplete(bankCanonical, ledgerCanonical, sessionTitle, options);
    onClose();
  };

  // Eligibility check: both files must have valid rows, AND any invalid rows must be explicitly acknowledged
  const bankPasses = bankFile.validRows.length > 0 && (bankFile.invalidRows.length === 0 || bankFile.acknowledgeExcluded);
  const ledgerPasses = ledgerFile.validRows.length > 0 && (ledgerFile.invalidRows.length === 0 || ledgerFile.acknowledgeExcluded);
  const canProceed = bankPasses && ledgerPasses;

  const renderFileCard = (
    title: string,
    fileState: FileState,
    setFileState: React.Dispatch<React.SetStateAction<FileState>>,
    onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void,
    templateContent: string,
    templateName: string,
    sourcePrefix: 'BNK' | 'LDG'
  ) => {
    const isLoaded = fileState.rawRows.length > 0;
    const hasInvalid = fileState.invalidRows.length > 0;

    return (
      <div className="border border-[#DDE3DA] rounded-xl p-4 bg-[#FAFBF9] space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#111827]">{title}</span>
          <button
            type="button"
            onClick={() => downloadTemplate(templateContent, templateName)}
            className="text-[11px] text-[#2563EB] hover:underline flex items-center gap-1 cursor-pointer"
            title="Download verified sample format"
          >
            <Download className="w-3 h-3" /> Template
          </button>
        </div>

        <label className="border-2 border-dashed border-[#CBD5C5] hover:border-[#101A2B] rounded-lg p-3.5 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-white">
          <Upload className="w-5 h-5 text-[#6B7280] mb-1" />
          <span className="text-xs font-medium text-[#111827] truncate max-w-xs">
            {fileState.fileName || `Select or Drop ${sourcePrefix === 'BNK' ? 'Bank' : 'Ledger'} CSV`}
          </span>
          <span className="text-[10px] text-[#9CA3AF] mt-0.5">
            CSV, TSV, or delimited text • Max 5 MB / 10,000 rows
          </span>
          <input type="file" accept=".csv,.txt" onChange={onUpload} className="hidden" />
        </label>

        {isLoaded && (
          <div className="space-y-2.5 pt-1">
            {/* Status pills */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-[#17845B] bg-[#E8F5EE] border border-[#A7D7BC] px-2 py-0.5 rounded-md flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-3 h-3" />
                {fileState.validRows.length} valid rows
              </span>
              {fileState.detectedOpeningPaise !== undefined && (
                <span className="text-[#101A2B] bg-[#EEF1EB] px-2 py-0.5 rounded-md font-mono text-[10px]">
                  Open: {formatPaise(fileState.detectedOpeningPaise)}
                </span>
              )}
              {fileState.detectedClosingPaise !== undefined && (
                <span className="text-[#101A2B] bg-[#EEF1EB] px-2 py-0.5 rounded-md font-mono text-[10px]">
                  Close: {formatPaise(fileState.detectedClosingPaise)}
                </span>
              )}
              {hasInvalid && (
                <span className="text-[#D75E4C] bg-[#FDEDEA] border border-[#F3BDB4] px-2 py-0.5 rounded-md flex items-center gap-1 font-semibold">
                  <AlertTriangle className="w-3 h-3" />
                  {fileState.invalidRows.length} invalid
                </span>
              )}
            </div>

            {/* Error detail box if invalid rows exist */}
            {hasInvalid && (
              <div className="bg-[#FDEDEA] border border-[#F3BDB4] rounded-lg p-2.5 text-[11px] text-[#9B2C1F] space-y-2">
                <div className="font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Validation Errors Detected ({fileState.invalidRows.length} rows):</span>
                </div>
                <div className="max-h-20 overflow-y-auto space-y-1 font-mono text-[10px] bg-white/70 p-1.5 rounded border border-[#F3BDB4]/50">
                  {fileState.invalidRows.slice(0, 5).map((r) => (
                    <div key={r.rowNumber} className="truncate">
                      Row {r.rowNumber}: {r.validationErrors.join('; ')}
                    </div>
                  ))}
                  {fileState.invalidRows.length > 5 && (
                    <div className="text-[#6B7280]">
                      + {fileState.invalidRows.length - 5} more invalid row(s)
                    </div>
                  )}
                </div>

                <label className="flex items-start gap-2 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fileState.acknowledgeExcluded}
                    onChange={(e) =>
                      setFileState((prev) => ({
                        ...prev,
                        acknowledgeExcluded: e.target.checked,
                      }))
                    }
                    className="mt-0.5 rounded border-[#F3BDB4] text-[#D75E4C] focus:ring-[#D75E4C]"
                  />
                  <span className="text-[10px] text-[#741F16] leading-tight font-medium">
                    Acknowledge and exclude {fileState.invalidRows.length} invalid row(s) from reconciliation. Totals and exclusion count will be disclosed in the audit report.
                  </span>
                </label>
              </div>
            )}

            {/* Column Mapping Toggle */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() =>
                  setFileState((prev) => ({ ...prev, showAdvanced: !prev.showAdvanced }))
                }
                className="text-[11px] text-[#101A2B] hover:text-[#2563EB] flex items-center justify-between w-full font-semibold py-1 border-t border-[#DDE3DA]"
              >
                <span className="flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3 h-3 text-[#6B7280]" />
                  <span>Column Mapping & Date Format</span>
                  <span className="text-[10px] font-normal text-[#6B7280]">
                    ({fileState.inspection?.confidence === 'HIGH' ? 'Auto-detected' : 'Action Required'})
                  </span>
                </span>
                {fileState.showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {fileState.showAdvanced && (
                <div className="mt-2 p-3 bg-white border border-[#DDE3DA] rounded-lg space-y-2.5 text-[11px]">
                  {/* Date format & date col */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-[#6B7280] mb-0.5">
                        Date Column
                      </label>
                      <select
                        value={fileState.mapping.dateCol}
                        onChange={(e) => {
                          const next = { ...fileState, mapping: { ...fileState.mapping, dateCol: e.target.value } };
                          setFileState(renormalizeFile(next, sourcePrefix));
                        }}
                        className="w-full px-2 py-1 border border-[#DDE3DA] rounded text-xs bg-white text-[#111827]"
                      >
                        {fileState.rawHeaders.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-[#6B7280] mb-0.5">
                        Date Format Convention
                      </label>
                      <select
                        value={fileState.dateFormat}
                        onChange={(e) => {
                          const next = { ...fileState, dateFormat: e.target.value as DateFormat };
                          setFileState(renormalizeFile(next, sourcePrefix));
                        }}
                        className="w-full px-2 py-1 border border-[#DDE3DA] rounded text-xs bg-white text-[#111827]"
                      >
                        <option value="AUTO">Auto-detect (Safe)</option>
                        <option value="DMY">DD/MM/YYYY (Indian/UK)</option>
                        <option value="MDY">MM/DD/YYYY (US)</option>
                        <option value="YMD">YYYY-MM-DD (ISO)</option>
                      </select>
                    </div>
                  </div>

                  {/* Description & Reference */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-[#6B7280] mb-0.5">
                        Narration / Description
                      </label>
                      <select
                        value={fileState.mapping.descriptionCol}
                        onChange={(e) => {
                          const next = { ...fileState, mapping: { ...fileState.mapping, descriptionCol: e.target.value } };
                          setFileState(renormalizeFile(next, sourcePrefix));
                        }}
                        className="w-full px-2 py-1 border border-[#DDE3DA] rounded text-xs bg-white text-[#111827]"
                      >
                        {fileState.rawHeaders.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-[#6B7280] mb-0.5">
                        Reference / ID (Optional)
                      </label>
                      <select
                        value={fileState.mapping.referenceCol || ''}
                        onChange={(e) => {
                          const val = e.target.value || undefined;
                          const next = { ...fileState, mapping: { ...fileState.mapping, referenceCol: val } };
                          setFileState(renormalizeFile(next, sourcePrefix));
                        }}
                        className="w-full px-2 py-1 border border-[#DDE3DA] rounded text-xs bg-white text-[#111827]"
                      >
                        <option value="">[None / Auto-generate]</option>
                        {fileState.rawHeaders.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Amount mode */}
                  <div>
                    <label className="block text-[10px] font-semibold text-[#6B7280] mb-1">
                      Amount Structure
                    </label>
                    <div className="flex items-center gap-3 mb-2">
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                        <input
                          type="radio"
                          name={`amountMode_${sourcePrefix}`}
                          checked={fileState.amountMode === 'SEPARATE_DR_CR'}
                          onChange={() => {
                            const next: FileState = { ...fileState, amountMode: 'SEPARATE_DR_CR' };
                            setFileState(renormalizeFile(next, sourcePrefix));
                          }}
                          className="text-[#101A2B]"
                        />
                        <span>Separate Debit & Credit</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                        <input
                          type="radio"
                          name={`amountMode_${sourcePrefix}`}
                          checked={fileState.amountMode === 'SINGLE_AMOUNT'}
                          onChange={() => {
                            const next: FileState = { ...fileState, amountMode: 'SINGLE_AMOUNT' };
                            setFileState(renormalizeFile(next, sourcePrefix));
                          }}
                          className="text-[#101A2B]"
                        />
                        <span>Single Signed Amount</span>
                      </label>
                    </div>

                    {fileState.amountMode === 'SEPARATE_DR_CR' ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-[#6B7280] mb-0.5">
                            Debit Column (Outflow)
                          </label>
                          <select
                            value={fileState.mapping.debitCol || ''}
                            onChange={(e) => {
                              const val = e.target.value || undefined;
                              const next = { ...fileState, mapping: { ...fileState.mapping, debitCol: val } };
                              setFileState(renormalizeFile(next, sourcePrefix));
                            }}
                            className="w-full px-2 py-1 border border-[#DDE3DA] rounded text-xs bg-white text-[#111827]"
                          >
                            <option value="">[None]</option>
                            {fileState.rawHeaders.map((h) => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-[#6B7280] mb-0.5">
                            Credit Column (Inflow)
                          </label>
                          <select
                            value={fileState.mapping.creditCol || ''}
                            onChange={(e) => {
                              const val = e.target.value || undefined;
                              const next = { ...fileState, mapping: { ...fileState.mapping, creditCol: val } };
                              setFileState(renormalizeFile(next, sourcePrefix));
                            }}
                            className="w-full px-2 py-1 border border-[#DDE3DA] rounded text-xs bg-white text-[#111827]"
                          >
                            <option value="">[None]</option>
                            {fileState.rawHeaders.map((h) => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[10px] font-semibold text-[#6B7280] mb-0.5">
                          Amount Column
                        </label>
                        <select
                          value={fileState.mapping.amountCol || ''}
                          onChange={(e) => {
                            const val = e.target.value || undefined;
                            const next = { ...fileState, mapping: { ...fileState.mapping, amountCol: val } };
                            setFileState(renormalizeFile(next, sourcePrefix));
                          }}
                          className="w-full px-2 py-1 border border-[#DDE3DA] rounded text-xs bg-white text-[#111827]"
                        >
                          <option value="">[Select Column]</option>
                          {fileState.rawHeaders.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Balance Anchor & Running Balance */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#EEF1EB]">
                    <div>
                      <label className="block text-[10px] font-semibold text-[#6B7280] mb-0.5">
                        Balance Column (Optional)
                      </label>
                      <select
                        value={fileState.mapping.balanceCol || ''}
                        onChange={(e) => {
                          const val = e.target.value || undefined;
                          const next = { ...fileState, mapping: { ...fileState.mapping, balanceCol: val } };
                          setFileState(renormalizeFile(next, sourcePrefix));
                        }}
                        className="w-full px-2 py-1 border border-[#DDE3DA] rounded text-xs bg-white text-[#111827]"
                      >
                        <option value="">[None]</option>
                        {fileState.rawHeaders.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-[#6B7280] mb-0.5">
                        {sourcePrefix === 'BNK' ? 'Bank' : 'Ledger'} Opening Balance (INR)
                      </label>
                      <input
                        type="text"
                        placeholder={sourcePrefix === 'BNK' ? 'e.g. 250000.00' : 'Optional (defaults to bank baseline)'}
                        value={fileState.openingBalanceInput}
                        onChange={(e) => {
                          setFileState((prev) => ({ ...prev, openingBalanceInput: e.target.value }));
                        }}
                        className="w-full px-2 py-1 border border-[#DDE3DA] rounded text-xs bg-white text-[#111827]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Global errors (e.g. PDF reject) */}
        {fileState.errors.length > 0 && !isLoaded && (
          <div className="text-[11px] text-[#D75E4C] bg-[#FDEDEA] p-2 rounded flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{fileState.errors[0]}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-[#101A2B]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#DDE3DA] max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#DDE3DA] pb-3">
          <div>
            <h2 className="text-lg font-bold text-[#111827]">Import Financial Statements (CSV)</h2>
            <p className="text-xs text-[#6B7280]">
              Files are parsed 100% in your browser. Raw bank statements never leave this machine.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-[#9CA3AF] hover:text-[#111827] hover:bg-[#EEF1EB] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Supported format notice */}
        <div className="bg-[#FAFBF9] border border-[#DDE3DA] rounded-lg p-2.5 text-xs text-[#4B5563] flex items-start gap-2">
          <Info className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
          <div className="leading-relaxed text-[11px]">
            <strong>Format Support:</strong> ProofLedger AI parses CSV and delimited text files directly in your browser. PDF statements and scanned paper images are not currently supported; please export CSV/Excel format from your online banking portal before importing.
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#111827] mb-1">
            Session Close Name
          </label>
          <input
            type="text"
            value={sessionTitle}
            onChange={(e) => setSessionTitle(e.target.value)}
            className="w-full px-3 py-1.5 border border-[#DDE3DA] rounded-md text-xs text-[#111827] bg-[#FAFBF9]"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderFileCard(
            '1. Bank Statement (CSV)',
            bankFile,
            setBankFile,
            handleBankFileUpload,
            SAMPLE_BANK_CSV_TEMPLATE,
            'bank_statement_template.csv',
            'BNK'
          )}
          {renderFileCard(
            '2. Accounting Ledger (CSV)',
            ledgerFile,
            setLedgerFile,
            handleLedgerFileUpload,
            SAMPLE_LEDGER_CSV_TEMPLATE,
            'accounting_ledger_template.csv',
            'LDG'
          )}
        </div>

        {/* Financial Anchor Summary Footer */}
        <div className="bg-[#FAFBF9] border border-[#DDE3DA] rounded-xl p-3 text-xs space-y-1">
          <div className="font-semibold text-[#111827] flex items-center justify-between">
            <span>Financial Balance Anchors:</span>
            <span className="text-[10px] text-[#6B7280]">Integer Paise Arithmetic (Zero Floating Drift)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-[#4B5563] pt-1">
            <div>
              Bank Opening Balance:{' '}
              <strong className="text-[#111827]">
                {bankFile.openingBalanceInput.trim() !== ''
                  ? (bankFile.detectedOpeningPaise !== undefined &&
                     (() => { try { return parseToPaise(bankFile.openingBalanceInput) === bankFile.detectedOpeningPaise; } catch { return false; } })()
                      ? `${formatPaise(bankFile.detectedOpeningPaise)} (Statement-detected)`
                      : `₹${bankFile.openingBalanceInput} (Reviewer-supplied)`)
                  : bankFile.detectedOpeningPaise !== undefined
                  ? `${formatPaise(bankFile.detectedOpeningPaise)} (Statement-detected)`
                  : '₹0.00 (Unverified baseline)'}
              </strong>
            </div>
            <div>
              Ledger Opening Balance:{' '}
              <strong className="text-[#111827]">
                {ledgerFile.openingBalanceInput.trim() !== ''
                  ? (ledgerFile.detectedOpeningPaise !== undefined &&
                     (() => { try { return parseToPaise(ledgerFile.openingBalanceInput) === ledgerFile.detectedOpeningPaise; } catch { return false; } })()
                      ? `${formatPaise(ledgerFile.detectedOpeningPaise)} (Statement-detected)`
                      : `₹${ledgerFile.openingBalanceInput} (Reviewer-supplied)`)
                  : ledgerFile.detectedOpeningPaise !== undefined
                  ? `${formatPaise(ledgerFile.detectedOpeningPaise)} (Statement-detected)`
                  : (bankFile.openingBalanceInput.trim() !== '' || bankFile.detectedOpeningPaise !== undefined)
                  ? `${bankFile.openingBalanceInput.trim() !== '' ? `₹${bankFile.openingBalanceInput}` : formatPaise(bankFile.detectedOpeningPaise!)} (Unverified baseline from bank)`
                  : '₹0.00 (Unverified baseline)'}
              </strong>
            </div>
            <div>
              Bank Closing Balance:{' '}
              <strong className="text-[#111827]">
                {bankFile.detectedClosingPaise !== undefined
                  ? `${formatPaise(bankFile.detectedClosingPaise)} (Statement-detected)`
                  : 'Derived from net flow'}
              </strong>
            </div>
            <div>
              Ledger Closing Balance:{' '}
              <strong className="text-[#111827]">
                {ledgerFile.detectedClosingPaise !== undefined
                  ? `${formatPaise(ledgerFile.detectedClosingPaise)} (Statement-detected)`
                  : 'Derived from net flow'}
              </strong>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[#DDE3DA]">
          <span className="text-[11px] text-[#6B7280]">
            Deterministic matching active • 5 MB / 10,000 row bounds
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-md border border-[#DDE3DA] text-xs font-semibold text-[#4B5563] hover:bg-[#F6F7F2] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canProceed}
              onClick={handleConfirmImport}
              className="px-4 py-1.5 rounded-md bg-[#D7FF56] hover:bg-[#C9F540] text-[#111827] text-xs font-bold disabled:opacity-50 cursor-pointer shadow-xs disabled:cursor-not-allowed"
            >
              Confirm & Reconcile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

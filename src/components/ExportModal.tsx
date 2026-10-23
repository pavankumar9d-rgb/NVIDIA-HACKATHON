import React, { useState } from 'react';
import type {
  ReconciliationMatch,
  ReconciliationException,
  ReconciliationSummary
} from '../lib/reconciliation';
import {
  generateMarkdownReport,
  generateAuditJSON,
  generateReconciledCSV,
  generateExceptionsCSV,
  withUTF8BOM,
} from '../lib/export';
import {
  Download,
  FileSpreadsheet,
  FileCode,
  FileText,
  X,
  ShieldCheck
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  matches: ReconciliationMatch[];
  exceptions: ReconciliationException[];
  summary: ReconciliationSummary | null;
  sessionName: string;
  aiStatus?: {
    configured: boolean;
    allowLiveAI: boolean;
    model?: string;
    mode?: string;
  };
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  matches,
  exceptions,
  summary,
  sessionName,
  aiStatus,
}) => {
  const [activeExportTab, setActiveExportTab] = useState<'csv_reconciled' | 'csv_exceptions' | 'json_audit' | 'markdown'>('markdown');
  const [exportTimestamp, setExportTimestamp] = useState(() => new Date());

  if (!isOpen || !summary) return null;

  const getActiveContent = (date: Date = exportTimestamp) => {
    switch (activeExportTab) {
      case 'csv_reconciled':
        return generateReconciledCSV(matches);
      case 'csv_exceptions':
        return generateExceptionsCSV(exceptions);
      case 'json_audit':
        return generateAuditJSON({
          sessionName,
          summary,
          matches,
          exceptions,
          generatedDate: date,
          aiStatus,
        });
      case 'markdown':
        return generateMarkdownReport({
          sessionName,
          summary,
          matches,
          exceptions,
          generatedDate: date,
          aiStatus,
        });
    }
  };

  const handleDownload = () => {
    const ts = new Date();
    setExportTimestamp(ts);
    const content = getActiveContent(ts);
    let filename = 'export.txt';
    let mimeType = 'text/plain;charset=utf-8;';

    switch (activeExportTab) {
      case 'csv_reconciled':
        filename = `proofledger_${sessionName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_reconciled.csv`;
        mimeType = 'text/csv;charset=utf-8;';
        break;
      case 'csv_exceptions':
        filename = `proofledger_${sessionName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_exceptions.csv`;
        mimeType = 'text/csv;charset=utf-8;';
        break;
      case 'json_audit':
        filename = `proofledger_${sessionName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_audit_trail.json`;
        mimeType = 'application/json;charset=utf-8;';
        break;
      case 'markdown':
        filename = `proofledger_${sessionName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_report.md`;
        mimeType = 'text/markdown;charset=utf-8;';
        break;
    }

    const blobContent = activeExportTab.startsWith('csv') ? withUTF8BOM(content) : content;
    const blob = new Blob([blobContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-[#101A2B]/60 backdrop-blur-xs z-50 flex items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-none sm:rounded-2xl border-0 sm:border border-[#DDE3DA] w-full max-w-3xl h-full sm:h-auto sm:max-h-[90vh] p-4 sm:p-6 shadow-2xl flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#DDE3DA] pb-3 shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#111827]">Export Audit Package</h2>
            <p className="text-xs text-[#6B7280]">
              Download verifiable audit artifacts with formula-injection neutralization.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 min-h-[44px] min-w-[44px] rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#EEF1EB] transition-colors flex items-center justify-center cursor-pointer"
            aria-label="Close export dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Tabs */}
        <div className="flex items-center gap-2 border-b border-[#DDE3DA] pb-2 text-xs overflow-x-auto no-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => setActiveExportTab('markdown')}
            className={`px-3 py-2 min-h-[40px] rounded-lg font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer shrink-0 ${
              activeExportTab === 'markdown'
                ? 'bg-[#101A2B] text-white'
                : 'text-[#4B5563] hover:bg-[#EEF1EB]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Executive Report (.md)
          </button>

          <button
            type="button"
            onClick={() => setActiveExportTab('csv_reconciled')}
            className={`px-3 py-2 min-h-[40px] rounded-lg font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer shrink-0 ${
              activeExportTab === 'csv_reconciled'
                ? 'bg-[#101A2B] text-white'
                : 'text-[#4B5563] hover:bg-[#EEF1EB]'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Reconciled CSV ({matches.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveExportTab('csv_exceptions')}
            className={`px-3 py-2 min-h-[40px] rounded-lg font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer shrink-0 ${
              activeExportTab === 'csv_exceptions'
                ? 'bg-[#101A2B] text-white'
                : 'text-[#4B5563] hover:bg-[#EEF1EB]'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Exceptions CSV ({exceptions.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveExportTab('json_audit')}
            className={`px-3 py-2 min-h-[40px] rounded-lg font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer shrink-0 ${
              activeExportTab === 'json_audit'
                ? 'bg-[#101A2B] text-white'
                : 'text-[#4B5563] hover:bg-[#EEF1EB]'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            Audit Trail JSON
          </button>
        </div>

        {/* Content Preview */}
        <div className="flex-1 overflow-hidden flex flex-col bg-[#FAFBF9] border border-[#DDE3DA] rounded-xl min-h-0">
          <div className="px-3 py-2 bg-[#EEF1EB] border-b border-[#DDE3DA] flex items-center justify-between text-[11px] text-[#4B5563] font-medium shrink-0">
            <span>Preview Artifact</span>
            <span className="flex items-center gap-1 text-[#17845B]">
              <ShieldCheck className="w-3.5 h-3.5" /> Formula Injection Protected
            </span>
          </div>
          <pre className="p-3 text-[11px] font-mono text-[#111827] overflow-y-auto flex-1 whitespace-pre-wrap">
            {getActiveContent()}
          </pre>
        </div>

        {/* Action Footer with Safe-Area */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-[#DDE3DA] pb-safe shrink-0">
          <span className="text-[11px] text-[#6B7280] hidden sm:inline">
            Format: {activeExportTab.toUpperCase()} | Non-destructive export
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 min-h-[44px] rounded-xl border border-[#DDE3DA] text-xs font-semibold text-[#4B5563] active:bg-[#F6F7F2] cursor-pointer flex items-center justify-center"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex-1 sm:flex-none px-5 py-2.5 min-h-[44px] rounded-xl bg-[#D7FF56] active:bg-[#C9F540] text-[#111827] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Download className="w-4 h-4" />
              Download File
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

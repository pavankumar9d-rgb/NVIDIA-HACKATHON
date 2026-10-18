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
  generateExceptionsCSV 
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
  const [generatedDate] = useState(() => new Date());

  if (!isOpen || !summary) return null;

  const getActiveContent = () => {
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
          generatedDate,
          aiStatus,
        });
      case 'markdown':
        return generateMarkdownReport({
          sessionName,
          summary,
          matches,
          exceptions,
          generatedDate,
          aiStatus,
        });
    }
  };

  const handleDownload = () => {
    let filename = '';
    let mimeType = '';
    const content = getActiveContent();

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

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-[#101A2B]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#DDE3DA] max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-[#DDE3DA] pb-3">
          <div>
            <h2 className="text-lg font-bold text-[#111827]">Export Audit Package</h2>
            <p className="text-xs text-[#6B7280]">
              Download verifiable audit artifacts with formula-injection neutralization.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-md text-[#9CA3AF] hover:text-[#111827]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-[#DDE3DA] pb-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveExportTab('markdown')}
            className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-colors ${
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
            className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-colors ${
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
            className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-colors ${
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
            className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-colors ${
              activeExportTab === 'json_audit'
                ? 'bg-[#101A2B] text-white'
                : 'text-[#4B5563] hover:bg-[#EEF1EB]'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            Audit Trail JSON
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col bg-[#FAFBF9] border border-[#DDE3DA] rounded-lg">
          <div className="px-3 py-1.5 bg-[#EEF1EB] border-b border-[#DDE3DA] flex items-center justify-between text-[11px] text-[#4B5563] font-medium">
            <span>Preview Artifact</span>
            <span className="flex items-center gap-1 text-[#17845B]">
              <ShieldCheck className="w-3 h-3" /> Formula Injection Protected
            </span>
          </div>
          <pre className="p-3 text-[11px] font-mono text-[#111827] overflow-y-auto flex-1 whitespace-pre-wrap max-h-72">
            {getActiveContent()}
          </pre>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[#DDE3DA]">
          <span className="text-xs text-[#6B7280]">
            Format: {activeExportTab.toUpperCase()} | Non-destructive export
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-md border border-[#DDE3DA] text-xs font-semibold text-[#4B5563] hover:bg-[#F6F7F2]"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="px-4 py-1.5 rounded-md bg-[#D7FF56] hover:bg-[#C9F540] text-[#111827] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              Download File
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

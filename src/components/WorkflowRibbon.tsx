import React from 'react';
import { Database, GitCompare, AlertCircle, CheckSquare, FileSpreadsheet } from 'lucide-react';

interface WorkflowRibbonProps {
  currentStage: 'sources' | 'matching' | 'triage' | 'review' | 'export';
  hasData: boolean;
  isReconciled: boolean;
  pendingReviewCount: number;
  approvedCount: number;
}

export const WorkflowRibbon: React.FC<WorkflowRibbonProps> = ({
  currentStage,
  hasData,
  isReconciled,
  pendingReviewCount,
  approvedCount,
}) => {
  const steps = [
    {
      id: 'sources',
      label: '1. Ingest Sources',
      sub: hasData ? 'Bank & Ledger Loaded' : 'Awaiting CSVs',
      icon: Database,
      active: hasData,
      current: currentStage === 'sources',
    },
    {
      id: 'matching',
      label: '2. Deterministic Match',
      sub: isReconciled ? '1-to-1 Solved' : 'Pending Calculation',
      icon: GitCompare,
      active: isReconciled,
      current: currentStage === 'matching',
    },
    {
      id: 'triage',
      label: '3. Exception Triage',
      sub: isReconciled ? `${pendingReviewCount} Unresolved` : 'Pending Match',
      icon: AlertCircle,
      active: isReconciled,
      current: currentStage === 'triage',
    },
    {
      id: 'review',
      label: '4. Human Review',
      sub: `${approvedCount} Resolved`,
      icon: CheckSquare,
      active: approvedCount > 0,
      current: currentStage === 'review',
    },
    {
      id: 'export',
      label: '5. Audit Pack',
      sub: 'CSV / JSON / MD',
      icon: FileSpreadsheet,
      active: isReconciled,
      current: currentStage === 'export',
    },
  ];

  return (
    <div className="bg-white border-b border-[#DDE3DA] px-4 md:px-6 py-2.5 flex items-center overflow-x-auto gap-2 md:gap-6 text-xs">
      {steps.map((step, idx) => {
        const Icon = step.icon;
        return (
          <div key={step.id} className="flex items-center gap-2 shrink-0">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center font-bold transition-colors ${
                step.active
                  ? 'bg-[#101A2B] text-[#D7FF56]'
                  : 'bg-[#EEF1EB] text-[#9CA3AF]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className={`font-semibold ${step.active ? 'text-[#111827]' : 'text-[#6B7280]'}`}>
                {step.label}
              </div>
              <div className="text-[11px] text-[#9CA3AF]">{step.sub}</div>
            </div>
            {idx < steps.length - 1 && (
              <div className="hidden lg:block w-6 h-px bg-[#DDE3DA] ml-2" />
            )}
          </div>
        );
      })}
    </div>
  );
};

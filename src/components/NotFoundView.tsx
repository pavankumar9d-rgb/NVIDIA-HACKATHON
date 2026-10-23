import React from 'react';
import { FileQuestion, Home } from 'lucide-react';

interface NotFoundViewProps {
  onReturnHome: () => void;
}

export const NotFoundView: React.FC<NotFoundViewProps> = ({ onReturnHome }) => {
  return (
    <div className="flex-1 bg-[#F6F7F2] text-[#111827] flex flex-col items-center justify-center p-6 text-center select-none min-h-[500px]">
      <div className="max-w-md w-full bg-white border border-[#DDE3DA] shadow-lg rounded-3xl p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-2xl bg-[#101A2B] text-[#D7FF56] flex items-center justify-center mx-auto shadow-md">
          <FileQuestion className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-mono font-bold">
            HTTP 404 — Page Not Found
          </div>
          <h1 className="text-2xl font-extrabold text-[#111827] tracking-tight">
            Workspace Route Not Found
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            The destination you requested does not exist or may have been moved. 
            All reconciliation data is processed securely inside your active workspace.
          </p>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={onReturnHome}
            className="w-full py-3 px-5 rounded-2xl bg-[#101A2B] hover:bg-[#1C2D48] text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            <Home className="w-4 h-4 text-[#D7FF56]" />
            <span>Return to Reconciliation Workspace</span>
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';

interface BrandedPreloaderProps {
  isReady: boolean;
  onFinish?: () => void;
}

export const BrandedPreloader: React.FC<BrandedPreloaderProps> = ({ isReady, onFinish }) => {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (isReady) {
      // Allow user to see the crisp mark, then smoothly fade out
      const timer = setTimeout(() => {
        setFading(true);
        const removeTimer = setTimeout(() => {
          setVisible(false);
          onFinish?.();
        }, 300);
        return () => clearTimeout(removeTimer);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isReady, onFinish]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#101A2B] text-white transition-opacity duration-300 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      aria-label="Application Loading"
      role="status"
    >
      <div className="flex flex-col items-center gap-4 text-center max-w-sm px-6">
        <div className="relative">
          <img
            src="/assets/proofledger-mark.svg"
            alt="ProofLedger Mark"
            className="w-16 h-16 animate-pulse"
          />
          <div className="absolute -inset-2 rounded-full border border-[#D7FF56]/30 animate-ping opacity-75" />
        </div>

        <div>
          <div className="text-xl font-bold tracking-tight flex items-center justify-center gap-1.5">
            <span>ProofLedger</span>
            <span className="bg-[#D7FF56] text-[#101A2B] text-xs font-mono font-black px-1.5 py-0.5 rounded tracking-wider">
              AI
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic Reconciliation & Forensic Intelligence
          </p>
        </div>

        {/* Loading progress bar */}
        <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden mt-2">
          <div className="h-full bg-gradient-to-r from-[#17845B] via-[#D7FF56] to-[#2563EB] w-full animate-[shimmer_1.5s_infinite]" />
        </div>

        <p className="text-[11px] font-mono text-slate-500">
          Initializing decimal-safe ledger engine...
        </p>
      </div>
    </div>
  );
};

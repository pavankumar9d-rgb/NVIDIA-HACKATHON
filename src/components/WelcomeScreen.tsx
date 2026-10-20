import React from 'react';
import { 
  ShieldCheck, 
  Scale, 
  Lock, 
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { GoogleIcon } from './GoogleIcon';

interface WelcomeScreenProps {
  onContinueWithGoogle: () => void;
  onContinueAsGuest: () => void;
  isAuthLoading?: boolean;
  authError?: string | null;
  isSupabaseAvailable?: boolean;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onContinueWithGoogle,
  onContinueAsGuest,
  isAuthLoading = false,
  authError = null,
  isSupabaseAvailable = true,
}) => {
  return (
    <main 
      className="fixed inset-0 z-40 bg-[#F6F7F2] text-[#111827] flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 overflow-y-auto select-none"
      role="main"
      aria-label="Welcome to ProofLedger AI"
    >
      {/* Background Accent Gradients */}
      <div 
        aria-hidden="true" 
        className="pointer-events-none absolute inset-0 overflow-hidden opacity-40"
      >
        <div className="absolute -top-[20%] -left-[10%] w-[500px] h-[500px] rounded-full bg-[#D7FF56]/20 blur-3xl" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[500px] h-[500px] rounded-full bg-[#101A2B]/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg bg-white border border-[#DDE3DA] shadow-xl rounded-3xl p-6 sm:p-8 md:p-10 flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
        {/* Brand Mark & Identity */}
        <div className="flex items-center justify-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-[#101A2B] text-white flex items-center justify-center shadow-md p-2.5 relative">
            <img 
              src="/assets/proofledger-mark.svg" 
              alt="ProofLedger Mark" 
              className="w-full h-full object-contain"
            />
            <span 
              className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#D7FF56] border-2 border-white" 
              title="Deterministic Core Active"
            />
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-2 mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#101A2B] text-[#D7FF56] text-[11px] font-semibold tracking-wide uppercase">
            ProofLedger AI
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#111827] tracking-tight">
            Welcome to ProofLedger AI
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
            Financial reconciliation with integer-paise mathematical precision, zero floating-point drift, and client-side privacy.
          </p>
        </div>

        {/* Action Choice Group */}
        <div className="w-full space-y-3 mb-6">
          {/* Prominent Continue with Google Button */}
          <button
            type="button"
            onClick={onContinueWithGoogle}
            disabled={isAuthLoading}
            className="w-full py-3.5 px-5 rounded-2xl bg-[#101A2B] hover:bg-[#1C2D48] text-white text-sm font-bold flex items-center justify-center gap-3 transition-all duration-150 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#101A2B] focus:ring-offset-2 disabled:opacity-60 cursor-pointer"
            aria-label="Continue with Google"
          >
            {isAuthLoading ? (
              <div className="w-4 h-4 border-2 border-[#D7FF56] border-t-transparent rounded-full animate-spin" />
            ) : (
              <GoogleIcon className="w-4 h-4 shrink-0 bg-white rounded-full p-0.5" />
            )}
            <span>{isAuthLoading ? 'Connecting to Google...' : 'Continue with Google'}</span>
          </button>

          {/* Clearly Visible Continue as Guest Option */}
          <button
            type="button"
            onClick={onContinueAsGuest}
            disabled={isAuthLoading}
            className="w-full py-3 px-5 rounded-2xl bg-[#F6F7F2] hover:bg-[#EEF1EB] border border-[#CBD5C5] text-[#111827] text-xs font-semibold flex items-center justify-center gap-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 cursor-pointer"
            aria-label="Continue as Guest"
          >
            <span>Continue as Guest</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>

        {/* Honest Explanatory Guidance */}
        <div className="w-full bg-[#F6F7F2]/80 border border-[#EEF1EB] rounded-2xl p-4 text-left space-y-2.5 mb-2">
          <div className="flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed text-slate-600">
              <strong className="text-slate-800">Signing in</strong> enables private cloud history and multi-device snapshot restore protected by Row Level Security. An account is created automatically on first Google sign-in.
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed text-slate-600">
              <strong className="text-slate-800">Guest mode</strong> provides full access to local CSV imports, deterministic reconciliation, and reporting without creating an account or storing data on any remote server.
            </div>
          </div>
        </div>

        {/* Auth Error Display */}
        {authError && (
          <div 
            className="w-full mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 text-left"
            role="alert"
          >
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span className="flex-1 leading-tight">{authError}</span>
          </div>
        )}

        {/* Configuration Notice if Supabase not ready */}
        {!isSupabaseAvailable && (
          <div className="w-full mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-center gap-2 text-left">
            <Scale className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Cloud persistence is unconfigured. Guest mode is 100% active and functional.</span>
          </div>
        )}
      </div>

      {/* Trust & Math Footer */}
      <footer className="mt-6 text-[11px] text-slate-400 flex items-center gap-4">
        <span>Integer-Paise Precision</span>
        <span>•</span>
        <span>Client-Side Privacy</span>
        <span>•</span>
        <span>Zero Float Drift</span>
      </footer>
    </main>
  );
};

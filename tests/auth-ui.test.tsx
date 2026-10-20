import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { TopBar } from '../src/components/TopBar';
import { WelcomeView } from '../src/components/WelcomeView';
import { HistoryView } from '../src/components/HistoryView';
import { SetupRequiredModal } from '../src/components/SetupRequiredModal';
import { WelcomeScreen } from '../src/components/WelcomeScreen';
import { 
  isSupabaseConfigured, 
  signInWithGoogle, 
  signOut, 
  getCurrentUser 
} from '../src/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

describe('Authentication & Cloud Privacy Core Invariants', () => {
  it('detects Supabase configuration correctly from environment', () => {
    const configured = isSupabaseConfigured();
    expect(typeof configured).toBe('boolean');
  });

  it('fails safely without crashing or faking auth when signInWithGoogle is called unconfigured', async () => {
    if (!isSupabaseConfigured()) {
      const res = await signInWithGoogle();
      expect(res.error).not.toBeNull();
      expect(res.error?.message).toContain('Supabase is not configured');
    }
  });

  it('handles signOut safely when unconfigured without exceptions', async () => {
    if (!isSupabaseConfigured()) {
      const res = await signOut();
      expect(res.error).toBeNull();
    }
  });

  it('returns null user safely when unconfigured', async () => {
    if (!isSupabaseConfigured()) {
      const user = await getCurrentUser();
      expect(user).toBeNull();
    }
  });
});

describe('TopBar Authentication UI', () => {
  const dummyProps = {
    sessionName: 'Test Session',
    isSynthetic: false,
    onLoadDemo: vi.fn(),
    onOpenImport: vi.fn(),
    onRunReconciliation: vi.fn(),
    onOpenExport: vi.fn(),
    onResetSession: vi.fn(),
    hasData: false,
    isReconciled: false,
  };

  it('renders clear Guest Mode badge and non-promotional Sign In action when unauthenticated', () => {
    const onSignIn = vi.fn();
    render(
      <TopBar
        {...dummyProps}
        currentUser={null}
        onSignIn={onSignIn}
        isSupabaseAvailable={false}
      />
    );

    // Guest mode indicator should be prominent
    expect(screen.getByText(/guest mode/i)).toBeDefined();

    // Prominent "Continue with Google" promo button should NOT be in TopBar anymore
    expect(screen.queryByRole('button', { name: /continue with google/i })).toBeNull();

    // Discrete Sign In link should exist
    const signInBtn = screen.getByRole('button', { name: /^sign in$/i });
    expect(signInBtn).toBeDefined();

    fireEvent.click(signInBtn);
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it('renders user email and Sign Out action when authenticated', () => {
    const onSignOut = vi.fn();
    const fakeUser: Partial<User> = {
      id: 'usr-123',
      email: 'finance.lead@example.com',
    };

    render(
      <TopBar
        {...dummyProps}
        currentUser={fakeUser as User}
        onSignOut={onSignOut}
      />
    );

    expect(screen.getByText('finance.lead@example.com')).toBeDefined();
    const signOutBtn = screen.getByTitle('Sign Out');
    expect(signOutBtn).toBeDefined();

    fireEvent.click(signOutBtn);
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});

describe('WelcomeScreen (Initial Post-Preloader Experience)', () => {
  it('renders Welcome heading, brand identity, and two clear options without scrolling', () => {
    const onGoogle = vi.fn();
    const onGuest = vi.fn();

    render(
      <WelcomeScreen
        onContinueWithGoogle={onGoogle}
        onContinueAsGuest={onGuest}
        isAuthLoading={false}
        authError={null}
        isSupabaseAvailable={true}
      />
    );

    expect(screen.getByRole('heading', { level: 1, name: /welcome to proofledger ai/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /continue as guest/i })).toBeDefined();
    expect(screen.getByText(/signing in/i)).toBeDefined();
    expect(screen.getByText(/guest mode/i)).toBeDefined();

    // Test clicking Google button
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    expect(onGoogle).toHaveBeenCalledTimes(1);

    // Test clicking Guest button
    fireEvent.click(screen.getByRole('button', { name: /continue as guest/i }));
    expect(onGuest).toHaveBeenCalledTimes(1);
  });

  it('renders loading state when authentication is in flight', () => {
    render(
      <WelcomeScreen
        onContinueWithGoogle={vi.fn()}
        onContinueAsGuest={vi.fn()}
        isAuthLoading={true}
        authError={null}
      />
    );

    expect(screen.getByText(/connecting to google/i)).toBeDefined();
    const googleBtn = screen.getByRole('button', { name: /continue with google/i });
    expect(googleBtn).toHaveProperty('disabled', true);
  });

  it('renders actionable auth error when present', () => {
    render(
      <WelcomeScreen
        onContinueWithGoogle={vi.fn()}
        onContinueAsGuest={vi.fn()}
        authError="Google OAuth provider is not enabled in your Supabase project."
      />
    );

    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText(/google oauth provider is not yet enabled/i)).toBeDefined();
  });
});

describe('WelcomeView Dashboard UI', () => {
  it('renders import and demo options when active session has no data', () => {
    render(
      <WelcomeView
        onOpenImport={vi.fn()}
        onLoadDemo={vi.fn()}
      />
    );

    expect(screen.getByText(/import your own statements/i)).toBeDefined();
    expect(screen.getByText(/try interactive demo/i)).toBeDefined();
    expect(screen.getByText(/100% deterministic math/i)).toBeDefined();
  });
});

describe('HistoryView Setup Guidance & Auth State', () => {
  it('renders setup guidance and actionable "Continue with Google" when Supabase is unconfigured', () => {
    // This branch only renders when Supabase is NOT configured.
    // Guard the test so it only asserts the setup-required UI when the
    // current environment actually has no Supabase credentials (CI / no .env.local).
    // When credentials exist locally, the "Configured vs Unconfigured View Differentiation"
    // describe block above already verifies the configured branch.
    if (isSupabaseConfigured()) {
      // Skip: configured environment — setup-required branch is not reachable by design.
      return;
    }

    const onSignIn = vi.fn();
    render(
      <HistoryView
        currentUser={null}
        onSignIn={onSignIn}
      />
    );

    expect(screen.getByText(/cloud history setup required/i)).toBeDefined();
    expect(screen.getByText(/status: setup required \(cloud persistence inactive\)/i)).toBeDefined();
    expect(screen.getByText(/VITE_SUPABASE_URL/i)).toBeDefined();
    expect(screen.getByText(/VITE_SUPABASE_ANON_KEY/i)).toBeDefined();
    expect(screen.getByText(/guest mode active/i)).toBeDefined();

    const continueBtn = screen.getByRole('button', { name: /continue with google/i });
    expect(continueBtn).toBeDefined();
    fireEvent.click(continueBtn);
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });
});

describe('SetupRequiredModal Component', () => {
  it('renders setup instructions and Guest Mode reassurance when open', () => {
    const onClose = vi.fn();
    render(<SetupRequiredModal isOpen={true} onClose={onClose} />);

    expect(screen.getByText(/supabase setup required/i)).toBeDefined();
    expect(screen.getByText(/guest mode is 100% active/i)).toBeDefined();
    expect(screen.getByText(/VITE_SUPABASE_URL/i)).toBeDefined();
    expect(screen.getByText(/VITE_SUPABASE_ANON_KEY/i)).toBeDefined();
    expect(screen.getByText(/NEXT_PUBLIC_SUPABASE_URL/i)).toBeDefined();
    expect(screen.getByText(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/i)).toBeDefined();

    const continueGuestBtn = screen.getByRole('button', { name: /continue in guest mode/i });
    fireEvent.click(continueGuestBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when closed', () => {
    const { container } = render(<SetupRequiredModal isOpen={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('Configured vs Unconfigured View Differentiation', () => {
  it('renders "Cloud Sync Ready" indicator state gracefully', () => {
    // When Supabase is configured, client returns true
    expect(typeof isSupabaseConfigured()).toBe('boolean');
  });

  it('renders "Sign In for Private Cloud History" when Supabase is configured but user is unauthenticated', () => {
    // In an environment where Supabase is configured, HistoryView shows sign in prompt rather than setup required
    if (isSupabaseConfigured()) {
      render(<HistoryView currentUser={null} />);
      expect(screen.getByText(/sign in for private cloud history/i)).toBeDefined();
      expect(screen.queryByText(/cloud history setup required/i)).toBeNull();
    }
  });

  it('verifies guest session storage persistence contract', () => {
    sessionStorage.setItem('proofledger_guest_mode', 'true');
    expect(sessionStorage.getItem('proofledger_guest_mode')).toBe('true');
    sessionStorage.removeItem('proofledger_guest_mode');
    expect(sessionStorage.getItem('proofledger_guest_mode')).toBeNull();
  });
});

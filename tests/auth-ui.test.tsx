import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { TopBar } from '../src/components/TopBar';
import { WelcomeView } from '../src/components/WelcomeView';
import { HistoryView } from '../src/components/HistoryView';
import { SetupRequiredModal } from '../src/components/SetupRequiredModal';
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

  it('renders "Continue with Google" and "Account created on first sign-in" when unauthenticated', () => {
    const onSignIn = vi.fn();
    render(
      <TopBar
        {...dummyProps}
        currentUser={null}
        onSignIn={onSignIn}
        isSupabaseAvailable={false}
      />
    );

    const button = screen.getByRole('button', { name: /continue with google/i });
    expect(button).toBeDefined();
    expect(screen.getByText(/account created on first sign-in/i)).toBeDefined();
    expect(screen.getByText(/guest mode/i)).toBeDefined();

    fireEvent.click(button);
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it('renders loading spinner and disables button during auth loading', () => {
    render(
      <TopBar
        {...dummyProps}
        currentUser={null}
        isAuthLoading={true}
      />
    );

    const button = screen.getByRole('button', { name: /continue with google/i });
    expect(button).toHaveProperty('disabled', true);
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

describe('WelcomeView Authentication UI', () => {
  it('renders "Continue with Google" with account creation note when unauthenticated', () => {
    const onSignIn = vi.fn();
    render(
      <WelcomeView
        onOpenImport={vi.fn()}
        onLoadDemo={vi.fn()}
        currentUser={null}
        onSignIn={onSignIn}
        isSupabaseAvailable={false}
      />
    );

    const signInBtn = screen.getByRole('button', { name: /continue with google/i });
    expect(signInBtn).toBeDefined();
    expect(screen.getByText(/account created on first sign-in/i)).toBeDefined();
    expect(screen.getByText(/private cloud history/i)).toBeDefined();

    fireEvent.click(signInBtn);
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it('renders authenticated status when currentUser is logged in', () => {
    const fakeUser: Partial<User> = {
      id: 'usr-456',
      email: 'auditor@company.com',
    };

    render(
      <WelcomeView
        onOpenImport={vi.fn()}
        onLoadDemo={vi.fn()}
        currentUser={fakeUser as User}
      />
    );

    expect(screen.getByText('auditor@company.com')).toBeDefined();
    expect(screen.getByText(/private cloud history active/i)).toBeDefined();
  });
});

describe('HistoryView Setup Guidance & Auth State', () => {
  it('renders setup guidance and actionable "Continue with Google" when Supabase is unconfigured', () => {
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

    const continueGuestBtn = screen.getByRole('button', { name: /continue in guest mode/i });
    fireEvent.click(continueGuestBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when closed', () => {
    const { container } = render(<SetupRequiredModal isOpen={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});

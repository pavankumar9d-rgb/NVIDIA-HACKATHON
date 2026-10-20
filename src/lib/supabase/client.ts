import { createClient, type SupabaseClient, type User, type AuthChangeEvent, type Session } from '@supabase/supabase-js';

const rawUrl = (
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  ''
).trim();

const rawKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  ''
).trim();

export function isSupabaseConfigured(): boolean {
  if (!rawUrl || !rawKey) {
    return false;
  }

  // Reject generic placeholders
  if (
    rawUrl.includes('your-project.supabase.co') ||
    rawKey.includes('your-anon-key') ||
    rawKey.includes('your-publishable-key')
  ) {
    return false;
  }

  // Validate URL protocol and format
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
      return false;
    }
  } catch {
    return false;
  }

  // Security guard: Refuse initialization if a private secret/service_role key is accidentally supplied
  if (rawKey.includes('service_role') || rawKey.startsWith('sb_secret_')) {
    console.error('Security alert: A Supabase service_role or secret key was provided to client-side code. Refusing to initialize Supabase client.');
    return false;
  }

  // Ensure public key format matches either standard JWT anon key (eyJ...) or modern Supabase publishable key (sb_publishable_...)
  const isJwt = rawKey.startsWith('eyJ');
  const isModernPublishable = rawKey.startsWith('sb_publishable_');
  if (!isJwt && !isModernPublishable) {
    return false;
  }

  return true;
}

let clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!clientInstance) {
    clientInstance = createClient(rawUrl, rawKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return clientInstance;
}

export async function signInWithGoogle(): Promise<{ error: Error | null }> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      error: new Error(
        'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or Render NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) to your environment.'
      ),
    };
  }

  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
    },
  });

  return { error: error ? new Error(error.message) : null };
}

export async function signOut(): Promise<{ error: Error | null }> {
  const client = getSupabaseClient();
  if (!client) {
    return { error: null };
  }

  const { error } = await client.auth.signOut();
  return { error: error ? new Error(error.message) : null };
}

export async function getCurrentUser(): Promise<User | null> {
  const client = getSupabaseClient();
  if (!client) {
    return null;
  }

  try {
    const { data: { user } } = await client.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
): { data: { subscription: { unsubscribe: () => void } } } {
  const client = getSupabaseClient();
  if (!client) {
    return {
      data: {
        subscription: {
          unsubscribe: () => {},
        },
      },
    };
  }

  return client.auth.onAuthStateChange(callback);
}

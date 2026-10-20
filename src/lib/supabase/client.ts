import { createClient, type SupabaseClient, type User, type AuthChangeEvent, type Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = 
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export function isSupabaseConfigured(): boolean {
  if (!supabaseUrl || !supabaseAnonKey) {
    return false;
  }
  if (
    supabaseUrl.includes('your-project.supabase.co') ||
    supabaseAnonKey.includes('your-anon-key') ||
    supabaseAnonKey.includes('your-publishable-key')
  ) {
    return false;
  }
  return true;
}

let clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured() || !supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  if (!clientInstance) {
    clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
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
        'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment.'
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


import { createClient } from '@supabase/supabase-js';

// Environment variables for Supabase with robust URL sanitization
const metaEnv = (import.meta as any).env || {};
const rawSupabaseUrl = (metaEnv.VITE_SUPABASE_URL as string) || 'https://rekflpovydwnqehnqwev.supabase.co';

function sanitizeSupabaseUrl(url: string): string {
  if (!url) return '';
  let clean = url.trim();
  clean = clean.replace(/\/+$/, '');
  // Strip /rest/v1 or /rest/v1/ if user accidentally pasted the REST API endpoint URL
  clean = clean.replace(/\/rest\/v1\/?$/i, '');
  // Strip /auth/v1 if accidentally pasted
  clean = clean.replace(/\/auth\/v1\/?$/i, '');
  clean = clean.replace(/\/+$/, '');
  return clean;
}

const supabaseUrl = sanitizeSupabaseUrl(rawSupabaseUrl);
const supabaseAnonKey = ((metaEnv.VITE_SUPABASE_ANON_KEY as string) || '').trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-project') &&
  !supabaseAnonKey.includes('your-anon')
);

// Create single Supabase client instance
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      db: {
        schema: 'public',
      },
    })
  : null;

export interface SupabaseConfigStatus {
  configured: boolean;
  url: string;
  hasKey: boolean;
}

export function getSupabaseConfig(): SupabaseConfigStatus {
  return {
    configured: isSupabaseConfigured,
    url: supabaseUrl || 'قاعدة بيانات مدمجة (Standalone DB)',
    hasKey: Boolean(supabaseAnonKey),
  };
}

/**
 * Robustly resolves Supabase OAuth session handling both PKCE code exchange and implicit hash tokens.
 * Handles race conditions where getSession() is called before PKCE exchange completes.
 */
export async function resolveSupabaseOAuthSession(timeoutMs: number = 7000): Promise<string | null> {
  if (!supabase) return null;

  try {
    // 1. Check if session already available
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return session.access_token;
    }

    const hasOAuthParams =
      typeof window !== 'undefined' &&
      (window.location.hash.includes('access_token') ||
        window.location.search.includes('code=') ||
        window.location.hash.includes('code='));

    if (!hasOAuthParams) {
      return null;
    }

    // 2. If code in search params, attempt explicit exchangeCodeForSession if available
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get('code');
      if (code && typeof (supabase.auth as any).exchangeCodeForSession === 'function') {
        try {
          const { data, error } = await (supabase.auth as any).exchangeCodeForSession(code);
          if (!error && data?.session?.access_token) {
            return data.session.access_token;
          }
        } catch (exchangeErr) {
          console.warn('Direct exchangeCodeForSession fallback notice:', exchangeErr);
        }
      }
    }

    // 3. Listen to auth state change until SIGNED_IN or timeout
    return await new Promise<string | null>((resolve) => {
      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          try {
            subData?.subscription?.unsubscribe();
          } catch {}
          resolve(null);
        }
      }, timeoutMs);

      const { data: subData } = supabase!.auth.onAuthStateChange((event, session) => {
        if (!resolved && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || Boolean(session?.access_token))) {
          if (session?.access_token) {
            resolved = true;
            clearTimeout(timer);
            try {
              subData?.subscription?.unsubscribe();
            } catch {}
            resolve(session.access_token);
          }
        }
      });
    });
  } catch (err) {
    console.error('Failed in resolveSupabaseOAuthSession:', err);
    return null;
  }
}

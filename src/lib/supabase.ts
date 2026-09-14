import { createClient } from '@supabase/supabase-js';

// Environment variables for Supabase
const metaEnv = (import.meta as any).env || {};
const supabaseUrl = (metaEnv.VITE_SUPABASE_URL as string) || '';
const supabaseAnonKey = (metaEnv.VITE_SUPABASE_ANON_KEY as string) || '';

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
    url: supabaseUrl || 'غير مهيأ (وضع محلي تجريبي)',
    hasKey: Boolean(supabaseAnonKey),
  };
}

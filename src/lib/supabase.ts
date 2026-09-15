import { createClient } from '@supabase/supabase-js';

// Environment variables for Supabase with robust URL sanitization
const metaEnv = (import.meta as any).env || {};
const rawSupabaseUrl = (metaEnv.VITE_SUPABASE_URL as string) || '';

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
    url: supabaseUrl || 'غير مهيأ (وضع محلي تجريبي)',
    hasKey: Boolean(supabaseAnonKey),
  };
}

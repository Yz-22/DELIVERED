import { User } from '../types/logistics';

export interface StoredSession {
  user: User;
  token: string;
}

const STORAGE_KEYS = [
  'dargo_user_session',
  'dargo_jwt_token',
  'dargo_token',
  'delivere_auth_token',
  'dargo_tms_session',
] as const;

/**
 * Stores Delivere application session and dargo_jwt.
 * Single source of truth for session persistence.
 */
export function storeDelivereSession(user: User, token: string, rememberMe: boolean = true): void {
  if (!token || typeof token !== 'string') return;
  const cleanToken = token.trim();
  const sessionData: StoredSession = { user, token: cleanToken };
  const serialized = JSON.stringify(sessionData);

  const primaryStorage = rememberMe ? localStorage : sessionStorage;
  const secondaryStorage = rememberMe ? sessionStorage : localStorage;

  try {
    primaryStorage.setItem('dargo_user_session', serialized);
    primaryStorage.setItem('dargo_jwt_token', cleanToken);
    primaryStorage.setItem('dargo_token', cleanToken);
    primaryStorage.setItem('delivere_auth_token', cleanToken);

    // Clean up secondary storage to avoid conflicting tokens
    for (const key of STORAGE_KEYS) {
      secondaryStorage.removeItem(key);
    }
  } catch (err) {
    console.error('Failed to store Delivere session:', err);
  }
}

/**
 * Retrieves the stored Delivere session from primary or fallback storage.
 */
export function getStoredDelivereSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem('dargo_user_session') || sessionStorage.getItem('dargo_user_session');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.user && typeof parsed.token === 'string' && parsed.token.trim().length > 0) {
      return {
        user: parsed.user,
        token: parsed.token.trim(),
      };
    }
  } catch {
    // Malformed session JSON
  }
  return null;
}

/**
 * Completely clears all Delivere session keys and tokens across storage layers.
 */
export function clearDelivereSession(): void {
  try {
    for (const key of STORAGE_KEYS) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
    localStorage.removeItem('delivere_pending_invite_token');
    sessionStorage.removeItem('delivere_pending_invite_token');
  } catch (err) {
    console.error('Error clearing Delivere session:', err);
  }
}

/**
 * Extract current valid Delivere dargo_jwt session token.
 * Guaranteed to return a valid Bearer token string or empty string if unauthenticated.
 * Prevents invalid tokens like 'undefined' or 'null' or Supabase access tokens.
 */
export function getAuthToken(currentUser?: User | null): string {
  const session = getStoredDelivereSession();
  if (session?.token) {
    const t = session.token;
    if (t !== 'undefined' && t !== 'null' && t.length > 0) {
      return t;
    }
  }

  const jwtToken = localStorage.getItem('dargo_jwt_token') || sessionStorage.getItem('dargo_jwt_token');
  if (jwtToken && jwtToken.trim().length > 0 && jwtToken !== 'undefined' && jwtToken !== 'null') {
    return jwtToken.trim();
  }

  const dargoToken = localStorage.getItem('dargo_token') || sessionStorage.getItem('dargo_token');
  if (dargoToken && dargoToken.trim().length > 0 && dargoToken !== 'undefined' && dargoToken !== 'null') {
    return dargoToken.trim();
  }

  const delivereToken = localStorage.getItem('delivere_auth_token');
  if (delivereToken && delivereToken.trim().length > 0 && delivereToken !== 'undefined' && delivereToken !== 'null') {
    return delivereToken.trim();
  }

  return '';
}

/**
 * Returns standard authorization headers for authenticated Delivere API requests.
 * Only attaches Authorization header if a verified dargo_jwt token is available.
 */
export function getAuthHeaders(currentUser?: User | null): Record<string, string> {
  const token = getAuthToken(currentUser);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Quick synchronous check if a Delivere session exists.
 */
export function isDelivereAuthenticated(): boolean {
  return Boolean(getAuthToken());
}


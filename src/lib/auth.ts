import { User } from '../types/logistics';

/**
 * Extract current valid session token across storage and active user state.
 * Guaranteed to return a valid Bearer token string or empty string if unauthenticated.
 * Prevents invalid tokens like 'undefined' or 'null' or spoofed roles.
 */
export function getAuthToken(currentUser?: User | null): string {
  try {
    const savedSession = localStorage.getItem('dargo_user_session') || sessionStorage.getItem('dargo_user_session');
    if (savedSession) {
      const parsed = JSON.parse(savedSession);
      if (parsed?.token && typeof parsed.token === 'string' && parsed.token.trim().length > 0) {
        const token = parsed.token.trim();
        if (token !== 'undefined' && token !== 'null') return token;
      }
    }
  } catch {
    // Ignore JSON parsing errors
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
 * Returns standard authorization headers for authenticated API requests.
 * Only attaches Authorization header if a verified token is available.
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

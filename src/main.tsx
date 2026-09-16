import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Global Fetch Interceptor for Authenticated API requests
if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
  const originalFetch = window.fetch.bind(window);
  const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let url = '';
    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else if (input && typeof (input as any).url === 'string') {
      url = (input as any).url;
    }

    if (url.startsWith('/api/') || url.includes('/api/')) {
      try {
        const sessionStr = localStorage.getItem('dargo_user_session');
        if (sessionStr) {
          const session = JSON.parse(sessionStr);
          const token = (session?.token && typeof session.token === 'string') ? session.token.trim() : null;
          if (token) {
            const currentHeaders = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
            if (!currentHeaders.has('Authorization')) {
              currentHeaders.set('Authorization', `Bearer ${token}`);
            }
            init = { ...init, headers: currentHeaders };
          }
        }
      } catch {
        // Fallback gracefully
      }
    }
    return originalFetch(input, init);
  };

  try {
    Object.defineProperty(window, 'fetch', {
      value: customFetch,
      configurable: true,
      writable: true,
    });
  } catch {
    try {
      (window as any).fetch = customFetch;
    } catch {
      // Fallback gracefully if window.fetch cannot be modified
    }
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);


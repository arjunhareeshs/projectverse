import { getApiBaseUrl } from '../services/api';
import { getAuthToken } from './token';

function report(message: string, stack?: string) {
  try {
    const token = getAuthToken();
    let userId: string | undefined;
    if (token) {
      try {
        userId = JSON.parse(atob(token.split('.')[1]))?.sub;
      } catch {
        // ignore malformed token
      }
    }

    // Uses fetch with keepalive (not the shared axios instance) so a report
    // can still fire during page unload/navigation without being cancelled.
    fetch(`${getApiBaseUrl()}/observability/client-errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ message: message.slice(0, 2000), stack, url: window.location.href, userId }),
    }).catch(() => {});
  } catch {
    // Error reporting must never itself throw
  }
}

let installed = false;

export function installGlobalErrorReporting() {
  if (installed) return;
  installed = true;

  window.addEventListener('error', (event) => {
    report(event.message || 'Unknown window error', event.error?.stack);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    report(
      typeof reason === 'string' ? reason : reason?.message || 'Unhandled promise rejection',
      reason?.stack,
    );
  });
}

export function reportCaughtError(message: string, stack?: string) {
  report(message, stack);
}

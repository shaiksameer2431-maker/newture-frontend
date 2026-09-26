/**
 * Central API URL helper.
 * - Local dev: VITE_API_URL is empty; Vite proxies /api and /uploads to the backend.
 * - Production: set VITE_API_URL to the deployed backend origin.
 */
function getInitialBase(): string {
  if (import.meta.env.VITE_API_URL) {
    return String(import.meta.env.VITE_API_URL).trim().replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    if (hostname.includes('onrender.com')) {
      return 'https://newture-backend.onrender.com';
    }
  }
  return '';
}

const RAW_BASE = getInitialBase();

export const API_BASE = RAW_BASE;

export function apiUrl(path: string): string {
  if (!path) return API_BASE || '/';
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalized}`;
}

export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('necn_admin_token') : null;
  const headers = {
    ...init?.headers,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
  return fetch(apiUrl(input), {
    ...init,
    headers
  }).then(response => {
    // If we get a 401 on a non-login request and we had a token, the token is stale — clear it.
    // Do NOT reload the page here; that causes infinite reload loops.
    if (response.status === 401 && token && !input.includes('/api/auth/login')) {
      localStorage.removeItem('necn_admin_token');
      localStorage.removeItem('necn_admin_user');
    }
    return response;
  });
}

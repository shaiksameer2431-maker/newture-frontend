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
  return fetch(apiUrl(input), init);
}

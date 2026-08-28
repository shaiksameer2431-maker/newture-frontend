/**
 * Central API URL helper.
 * - Local dev: VITE_API_URL is empty; Vite proxies /api and /uploads to the backend.
 * - Production: set VITE_API_URL to the deployed backend origin.
 */
const RAW_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

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

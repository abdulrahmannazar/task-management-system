/**
 * Unified API Configuration & Fast Fetch Helper with Instant Client Caching & Warmup
 *
 * Automatically detects environment:
 * - When running in browser on localhost / 127.0.0.1, routes directly to local backend (http://localhost:3000)
 *   for instantaneous local response times.
 * - Seamlessly falls back to the deployed Render API (https://task-management-system-6ifq.onrender.com)
 *   in production or if the local backend is unreachable.
 */

const REMOTE_API = 'https://task-management-system-6ifq.onrender.com';
const LOCAL_API = 'http://localhost:3000';

export const isLocal = () => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.');
};

export const API_BASE = isLocal() ? LOCAL_API : REMOTE_API;

export const getApiUrl = (endpoint = '') => {
  if (!endpoint.startsWith('/')) endpoint = '/' + endpoint;
  return `${API_BASE}${endpoint}`;
};

// =========================================================================
// Instant Client-Side Reference Cache (0 ms navigation between pages)
// =========================================================================
const clientCache = new Map();
const CLIENT_CACHE_TTL = 30 * 1000; // 30 seconds fresh window

export const clearClientCache = () => {
  clientCache.clear();
};

/**
 * Enhanced fetch that routes to local backend on localhost and gracefully falls back to Render if needed
 */
export async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : getApiUrl(endpoint);
  
  // Clear client cache on mutating operations (POST, PUT, DELETE, PATCH)
  const method = (options.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    clearClientCache();
  }

  try {
    const res = await fetch(url, options);
    if (res.status === 404 && isLocal() && url.includes(LOCAL_API)) {
      const fallbackUrl = url.replace(LOCAL_API, REMOTE_API);
      return await fetch(fallbackUrl, options);
    }
    return res;
  } catch (err) {
    if (isLocal() && url.includes(LOCAL_API)) {
      const fallbackUrl = url.replace(LOCAL_API, REMOTE_API);
      return await fetch(fallbackUrl, options);
    }
    throw err;
  }
}

/**
 * Fast cached JSON fetcher for static reference data (departments, services, companies, employees)
 * Returns instantly (0 ms) from memory if requested within the TTL window.
 */
export async function fetchCachedJson(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const cacheKey = `${endpoint}_${token || 'anon'}`;

  const cached = clientCache.get(cacheKey);
  const now = Date.now();
  if (cached && (now - cached.timestamp < CLIENT_CACHE_TTL) && !options.noCache) {
    return cached.data;
  }

  const headers = { ...(options.headers || {}) };
  if (token && !headers['Authorization'] && !headers['authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await apiFetch(endpoint, { ...options, headers });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Request failed with status ${res.status}`);
  }

  const data = await res.json();
  clientCache.set(cacheKey, { data, timestamp: now });
  return data;
}

// Background Pre-Warm Ping (wakes up remote server while user is viewing the page)
if (typeof window !== 'undefined') {
  try {
    const warmTarget = `${API_BASE}/api/health`;
    fetch(warmTarget, { method: 'GET', keepalive: true }).catch(() => {});
  } catch (_) {}
}

export default apiFetch;

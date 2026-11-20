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
// Instant Client-Side Reference Cache & PDF Blob Pre-Warm Cache
// =========================================================================
const clientCache = new Map();
const CLIENT_CACHE_TTL = 30 * 1000; // 30 seconds fresh window

const pdfBlobCache = new Map();
const inFlightPdfRequests = new Map();
const PDF_BLOB_CACHE_TTL = 60 * 1000; // 60 seconds fresh window
const MAX_PDF_BLOB_ENTRIES = 25;

export const clearClientCache = () => {
  clientCache.clear();
  pdfBlobCache.clear();
};

export const clearPdfBlobCache = () => {
  pdfBlobCache.clear();
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
    if (res.status === 401 && !url.includes('/api/auth/login') && !url.includes('/api/health') && !url.includes('/client-approval')) {
      if (typeof window !== 'undefined' && window.location && window.location.pathname !== '/login') {
        try {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        } catch (_) {}
        window.location.replace('/login');
      }
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

/**
 * High-speed PDF Blob fetcher with in-flight deduplication and content-versioned memory cache.
 * Eliminates duplicate downloads and delivers instant (0 ms) saves when pre-warmed.
 */
export async function fetchPdfBlob(endpoint, { token, versionKey = '' } = {}) {
  const activeToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : '');
  const cacheKey = `${endpoint}::${versionKey}`;
  const now = Date.now();

  const cached = pdfBlobCache.get(cacheKey);
  if (cached && (now - cached.timestamp < PDF_BLOB_CACHE_TTL)) {
    return cached.blob;
  }

  if (inFlightPdfRequests.has(cacheKey)) {
    return inFlightPdfRequests.get(cacheKey);
  }

  const fetchPromise = (async () => {
    const headers = activeToken ? { Authorization: `Bearer ${activeToken}` } : {};
    const res = await apiFetch(endpoint, { headers });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to generate PDF document');
    }

    const blob = await res.blob();
    if (pdfBlobCache.size >= MAX_PDF_BLOB_ENTRIES) {
      const oldest = pdfBlobCache.keys().next().value;
      if (oldest) pdfBlobCache.delete(oldest);
    }
    pdfBlobCache.set(cacheKey, { blob, timestamp: Date.now() });
    return blob;
  })();

  inFlightPdfRequests.set(cacheKey, fetchPromise);
  try {
    return await fetchPromise;
  } finally {
    inFlightPdfRequests.delete(cacheKey);
  }
}

/**
 * Silently pre-warms a PDF Blob in the background (e.g., when viewing details or hovering over a PDF button)
 */
export function prewarmPdfBlob(endpoint, options = {}) {
  fetchPdfBlob(endpoint, options).catch(() => {});
}

// Background Pre-Warm Ping (wakes up remote server while user is viewing the page)
if (typeof window !== 'undefined') {
  try {
    const warmTarget = `${API_BASE}/api/health`;
    fetch(warmTarget, { method: 'GET', keepalive: true }).catch(() => {});
  } catch (_) {}
}

export default apiFetch;

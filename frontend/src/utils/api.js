/**
 * Unified API Configuration & Fast Fetch Helper
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

/**
 * Enhanced fetch that routes to local backend on localhost and gracefully falls back to Render if needed
 */
export async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : getApiUrl(endpoint);
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

export default apiFetch;

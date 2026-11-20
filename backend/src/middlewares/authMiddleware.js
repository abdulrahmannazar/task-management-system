const jwt = require('jsonwebtoken');
const {
  validateAndSlideSession,
  getFallbackSessionId
} = require('../services/sessionService');

const JWT_SECRET = () => process.env.JWT_SECRET || 'your_jwt_secret';

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (token && token !== 'null' && token !== 'undefined') {
      return token;
    }
  }
  // Fallback if an HttpOnly cookie is present in raw Cookie header
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
  }
  return null;
}

function clearAuthCookies(res) {
  try {
    res.clearCookie('token', { httpOnly: true, sameSite: 'lax', path: '/' });
  } catch (_) {}
}

exports.extractToken = extractToken;
exports.clearAuthCookies = clearAuthCookies;

/**
 * Strict JWT + 30-minute server-side sliding idle timeout middleware.
 */
exports.authenticate = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({
      code: 'AUTH_REQUIRED',
      message: 'Access denied. No token provided.',
      error: 'Access denied. No token provided.'
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET());
  } catch (err) {
    clearAuthCookies(res);
    return res.status(401).json({
      code: 'TOKEN_INVALID',
      message: 'Invalid or expired token.',
      error: 'Invalid or expired token.'
    });
  }

  const isLegacy = !decoded.sid;
  const sessionId = decoded.sid || getFallbackSessionId(token);
  const isBackgroundPoll = String(req.headers['x-background-poll'] || '').toLowerCase() === 'true';

  const result = await validateAndSlideSession(sessionId, decoded.emp_id, {
    isBackgroundPoll,
    isLegacy
  });

  if (!result.valid) {
    clearAuthCookies(res);
    return res.status(401).json({
      code: 'SESSION_IDLE_EXPIRED',
      message: 'Session expired due to 30 minutes of inactivity',
      error: 'Session expired due to 30 minutes of inactivity'
    });
  }

  req.user = decoded; // Contains { emp_id, role, department_id, sid }
  req.sessionId = sessionId;
  req.session = result.session;
  next();
};

/**
 * Checks whether a request targets a public Client LOE Approval Portal endpoint
 * accessed by external clients without an employee login.
 */
function isPublicClientApprovalRequest(req) {
  const path = req.path || '';
  const method = (req.method || 'GET').toUpperCase();

  // GET /api/loes/:id or GET /api/loes/:id/pdf
  if (method === 'GET' && /^\/api\/loes\/\d+(\/pdf)?\/?$/.test(path)) {
    return true;
  }
  // POST or PUT /api/loes/:id/client-acceptance
  if ((method === 'POST' || method === 'PUT') && /^\/api\/loes\/\d+\/client-acceptance\/?$/.test(path)) {
    return true;
  }
  return false;
}

/**
 * Global API guard that enforces strict 30-minute idle session timeout on all protected API routes
 * while preserving public auth endpoints, health probes, and unauthenticated external Client Approval links.
 */
exports.enforceProtectedApiSession = async (req, res, next) => {
  const path = req.path || '';

  // Allow CORS preflight requests
  if (req.method === 'OPTIONS') {
    return next();
  }

  // Allow public endpoints
  if (
    path === '/api/health' ||
    path === '/api/auth/login' ||
    path === '/api/auth/register' ||
    path === '/api/auth/departments' ||
    path === '/api/auth/logout'
  ) {
    return next();
  }

  // Allow external unauthenticated Client Approval Portal requests if no token was supplied
  const token = extractToken(req);
  if (!token && isPublicClientApprovalRequest(req)) {
    return next();
  }

  // All other /api/* requests require a valid, non-idle session
  return exports.authenticate(req, res, next);
};

exports.requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access forbidden. Insufficient permissions.' });
    }
    next();
  };
};

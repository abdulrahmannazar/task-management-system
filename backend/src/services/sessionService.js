const crypto = require('crypto');
const prisma = require('../config/db');

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const DB_WRITE_THROTTLE_MS = 2 * 60 * 1000; // 2 minutes

// In-memory write-through cache: sessionId -> { sessionId, empId, lastActiveAt, lastDbWriteAt, revoked }
const sessionCache = new Map();
let tableReadyPromise = null;

/**
 * Ensures the additive `user_sessions` table exists in PostgreSQL without modifying existing Prisma models.
 */
function ensureSessionTable() {
  if (!tableReadyPromise) {
    tableReadyPromise = (async () => {
      try {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS user_sessions (
            session_id VARCHAR(64) PRIMARY KEY,
            emp_id INT NOT NULL,
            last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            revoked BOOLEAN NOT NULL DEFAULT FALSE,
            revoked_at TIMESTAMPTZ
          )
        `);
        await prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS idx_user_sessions_emp_id ON user_sessions (emp_id)
        `);
      } catch (err) {
        console.error('[SessionService] Failed to initialize user_sessions table:', err.message);
        tableReadyPromise = null;
      }
    })();
  }
  return tableReadyPromise;
}

/**
 * Derives a deterministic fallback session ID for legacy tokens minted without a `sid` claim.
 */
function getFallbackSessionId(rawToken) {
  return 'legacy_' + crypto.createHash('sha256').update(String(rawToken || '')).digest('hex').slice(0, 48);
}

/**
 * Creates a new tracked session for an employee upon login or registration.
 */
async function createSession(empId) {
  await ensureSessionTable();
  const sessionId = crypto.randomUUID();
  const now = Date.now();

  const record = {
    sessionId,
    empId: Number(empId),
    lastActiveAt: now,
    lastDbWriteAt: now,
    revoked: false
  };
  sessionCache.set(sessionId, record);

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO user_sessions (session_id, emp_id, last_active_at, created_at, revoked)
       VALUES ($1, $2, $3, $3, FALSE)
       ON CONFLICT (session_id) DO UPDATE SET last_active_at = $3, revoked = FALSE, revoked_at = NULL`,
      sessionId,
      Number(empId),
      new Date(now)
    );
  } catch (err) {
    console.error('[SessionService] Failed to persist new session:', err.message);
  }

  return sessionId;
}

/**
 * Loads a session from memory cache or falls back to PostgreSQL.
 */
async function loadSession(sessionId, empId, isLegacy = false) {
  const cached = sessionCache.get(sessionId);
  if (cached) return cached;

  await ensureSessionTable();
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT session_id, emp_id, last_active_at, revoked
       FROM user_sessions
       WHERE session_id = $1
       LIMIT 1`,
      sessionId
    );

    if (Array.isArray(rows) && rows.length > 0) {
      const row = rows[0];
      const lastActiveMs = row.last_active_at ? new Date(row.last_active_at).getTime() : Date.now();
      const record = {
        sessionId: row.session_id,
        empId: Number(row.emp_id),
        lastActiveAt: lastActiveMs,
        lastDbWriteAt: lastActiveMs,
        revoked: Boolean(row.revoked)
      };
      sessionCache.set(sessionId, record);
      return record;
    }

    // Backward compatibility: if a legacy token (minted before session tracking) is seen for the first time
    if (isLegacy && empId) {
      const now = Date.now();
      const record = {
        sessionId,
        empId: Number(empId),
        lastActiveAt: now,
        lastDbWriteAt: now,
        revoked: false
      };
      sessionCache.set(sessionId, record);
      await prisma.$executeRawUnsafe(
        `INSERT INTO user_sessions (session_id, emp_id, last_active_at, created_at, revoked)
         VALUES ($1, $2, $3, $3, FALSE)
         ON CONFLICT (session_id) DO NOTHING`,
        sessionId,
        Number(empId),
        new Date(now)
      ).catch(() => {});
      return record;
    }
  } catch (err) {
    console.error('[SessionService] Failed to load session from DB:', err.message);
  }

  return null;
}

/**
 * Revokes an active session in both memory and PostgreSQL.
 */
async function revokeSession(sessionId) {
  if (!sessionId) return;
  const existing = sessionCache.get(sessionId);
  if (existing) {
    existing.revoked = true;
  } else {
    sessionCache.set(sessionId, {
      sessionId,
      empId: null,
      lastActiveAt: 0,
      lastDbWriteAt: Date.now(),
      revoked: true
    });
  }

  await ensureSessionTable();
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE user_sessions SET revoked = TRUE, revoked_at = NOW() WHERE session_id = $1`,
      sessionId
    );
  } catch (err) {
    console.error('[SessionService] Failed to revoke session in DB:', err.message);
  }
}

/**
 * Validates whether a session is active (not revoked and within the 30-minute idle window).
 * Slides `lastActiveAt` forward for real user-initiated requests, throttling DB writes to every 2 minutes.
 * Background polling requests (`isBackgroundPoll: true`) do NOT reset `lastActiveAt`.
 */
async function validateAndSlideSession(sessionId, empId, { isBackgroundPoll = false, isLegacy = false, forceSlideDb = false } = {}) {
  const session = await loadSession(sessionId, empId, isLegacy);
  if (!session || session.revoked) {
    return { valid: false, code: 'SESSION_IDLE_EXPIRED' };
  }

  const now = Date.now();
  const idleDuration = now - session.lastActiveAt;

  if (idleDuration > IDLE_TIMEOUT_MS) {
    await revokeSession(sessionId);
    return { valid: false, code: 'SESSION_IDLE_EXPIRED' };
  }

  // Only slide lastActiveAt on real user-initiated requests (exclude background polling)
  if (!isBackgroundPoll) {
    session.lastActiveAt = now;

    if (forceSlideDb || (now - session.lastDbWriteAt >= DB_WRITE_THROTTLE_MS)) {
      session.lastDbWriteAt = now;
      // Non-blocking throttled persistence to PostgreSQL
      ensureSessionTable()
        .then(() =>
          prisma.$executeRawUnsafe(
            `UPDATE user_sessions SET last_active_at = $1 WHERE session_id = $2 AND revoked = FALSE`,
            new Date(now),
            sessionId
          )
        )
        .catch((err) => {
          console.error('[SessionService] Throttled DB update failed:', err.message);
        });
    }
  }

  return {
    valid: true,
    session
  };
}

// Periodically prune expired/revoked entries from in-memory cache to keep RAM bounded
setInterval(() => {
  const cutoff = Date.now() - (IDLE_TIMEOUT_MS + 10 * 60 * 1000);
  for (const [sid, rec] of sessionCache.entries()) {
    if (rec.revoked && rec.lastDbWriteAt < cutoff) {
      sessionCache.delete(sid);
    } else if (!rec.revoked && rec.lastActiveAt < cutoff) {
      sessionCache.delete(sid);
    }
  }
}, 15 * 60 * 1000).unref();

// Initialize table on startup
ensureSessionTable();

module.exports = {
  IDLE_TIMEOUT_MS,
  DB_WRITE_THROTTLE_MS,
  createSession,
  revokeSession,
  validateAndSlideSession,
  getFallbackSessionId,
  ensureSessionTable
};

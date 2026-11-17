const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Eagerly connect to the database on server startup so the first request does not pay cold-start latency
prisma.$connect()
  .then(() => console.log('[DB] PostgreSQL pool connection warm and ready.'))
  .catch((err) => console.warn('[DB] Non-blocking initial connection notice:', err.message));

// Periodic heartbeat to prevent Supabase transaction pooler from dropping idle connection
setInterval(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    // Non-fatal silent catch
  }
}, 2 * 60 * 1000);

module.exports = prisma;

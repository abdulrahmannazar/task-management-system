const prisma = require('../config/db');
const asyncHandler = require('../middlewares/asyncHandler');

const DEFAULT_PERMISSIONS = {
  ADMIN: {
    VIEW_DISPATCH: true,
    VIEW_LOES: true,
    VIEW_APPROVALS: true,
    VIEW_TASKS: true,
    VIEW_INVOICES: true,
    VIEW_EMPLOYEES: true,
    VIEW_SERVICES: true,
    VIEW_COMPANIES: true,
    VIEW_PETTY_CASH: true,
    CREATE_LOE: true,
    APPROVE_LOE: true,
    DELETE_LOE: true,
    CREATE_EMPLOYEE: true,
    DELETE_EMPLOYEE: true,
    MANAGE_TASKS: true,
    MANAGE_INVOICES: true,
    MANAGE_SERVICES: true,
    MANAGE_COMPANIES: true,
    MANAGE_PETTY_CASH: true
  },
  MANAGER: {
    VIEW_DISPATCH: true,
    VIEW_LOES: true,
    VIEW_APPROVALS: true,
    VIEW_TASKS: true,
    VIEW_INVOICES: true,
    VIEW_EMPLOYEES: true,
    VIEW_SERVICES: true,
    VIEW_COMPANIES: true,
    VIEW_PETTY_CASH: true,
    CREATE_LOE: true,
    APPROVE_LOE: true,
    DELETE_LOE: true,
    CREATE_EMPLOYEE: true,
    DELETE_EMPLOYEE: false,
    MANAGE_TASKS: true,
    MANAGE_INVOICES: true,
    MANAGE_SERVICES: true,
    MANAGE_COMPANIES: true,
    MANAGE_PETTY_CASH: true
  },
  EMPLOYEE: {
    VIEW_DISPATCH: true,
    VIEW_LOES: true,
    VIEW_APPROVALS: false,
    VIEW_TASKS: true,
    VIEW_INVOICES: false,
    VIEW_EMPLOYEES: false,
    VIEW_SERVICES: false,
    VIEW_COMPANIES: false,
    VIEW_PETTY_CASH: true,
    CREATE_LOE: false,
    APPROVE_LOE: false,
    DELETE_LOE: false,
    CREATE_EMPLOYEE: false,
    DELETE_EMPLOYEE: false,
    MANAGE_TASKS: false,
    MANAGE_INVOICES: false,
    MANAGE_SERVICES: false,
    MANAGE_COMPANIES: false,
    MANAGE_PETTY_CASH: false
  },
  USERS: {}
};

// In-memory cache for ultra-fast, 0ms permission checks
let cachedPermissions = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

let tableChecked = false;
async function ensureTableExists() {
  if (tableChecked) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role VARCHAR(30) PRIMARY KEY,
      permissions JSONB NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
  tableChecked = true;
}

// GET /api/permissions
exports.getPermissions = asyncHandler(async (req, res) => {
  const now = Date.now();
  if (cachedPermissions && (now - lastCacheTime < CACHE_TTL_MS)) {
    return res.json(cachedPermissions);
  }

  try {
    await ensureTableExists();
    const rows = await prisma.$queryRawUnsafe(`SELECT role, permissions FROM role_permissions`);
    const result = {
      ADMIN: { ...DEFAULT_PERMISSIONS.ADMIN },
      MANAGER: { ...DEFAULT_PERMISSIONS.MANAGER },
      EMPLOYEE: { ...DEFAULT_PERMISSIONS.EMPLOYEE },
      USERS: {}
    };

    if (Array.isArray(rows)) {
      rows.forEach((row) => {
        const key = String(row.role).toUpperCase();
        const parsed = typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions;
        if (key === 'USERS' && parsed) {
          result.USERS = parsed;
        } else if (result[key] && parsed) {
          result[key] = { ...result[key], ...parsed };
        }
      });
    }

    cachedPermissions = result;
    lastCacheTime = now;
    res.json(result);
  } catch (err) {
    console.error('Error loading permissions, returning defaults:', err.message);
    res.json(DEFAULT_PERMISSIONS);
  }
});

// PUT /api/permissions
exports.updatePermissions = asyncHandler(async (req, res) => {
  await ensureTableExists();
  const payload = req.body || {};

  const roles = ['ADMIN', 'MANAGER', 'EMPLOYEE'];
  const updatedMatrix = {
    USERS: payload.USERS && typeof payload.USERS === 'object' ? payload.USERS : {}
  };

  for (const role of roles) {
    const mergedRolePerms = {
      ...DEFAULT_PERMISSIONS[role],
      ...(payload[role] || {})
    };
    updatedMatrix[role] = mergedRolePerms;
    const jsonStr = JSON.stringify(mergedRolePerms);

    await prisma.$executeRawUnsafe(
      `INSERT INTO role_permissions (role, permissions, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (role) DO UPDATE
       SET permissions = EXCLUDED.permissions, updated_at = NOW()`,
      role,
      jsonStr
    );
  }

  // Save per-employee overrides under 'USERS'
  await prisma.$executeRawUnsafe(
    `INSERT INTO role_permissions (role, permissions, updated_at)
     VALUES ('USERS', $1::jsonb, NOW())
     ON CONFLICT (role) DO UPDATE
     SET permissions = EXCLUDED.permissions, updated_at = NOW()`,
    JSON.stringify(updatedMatrix.USERS)
  );

  // Invalidate and update in-memory cache
  cachedPermissions = updatedMatrix;
  lastCacheTime = Date.now();

  res.json(updatedMatrix);
});

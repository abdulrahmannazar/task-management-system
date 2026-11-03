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
    CREATE_LOE: true,
    APPROVE_LOE: true,
    DELETE_LOE: true,
    CREATE_EMPLOYEE: true,
    DELETE_EMPLOYEE: true,
    MANAGE_TASKS: true,
    MANAGE_INVOICES: true,
    MANAGE_SERVICES: true,
    MANAGE_COMPANIES: true
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
    CREATE_LOE: true,
    APPROVE_LOE: true,
    DELETE_LOE: true,
    CREATE_EMPLOYEE: true,
    DELETE_EMPLOYEE: false,
    MANAGE_TASKS: true,
    MANAGE_INVOICES: true,
    MANAGE_SERVICES: true,
    MANAGE_COMPANIES: true
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
    CREATE_LOE: false,
    APPROVE_LOE: false,
    DELETE_LOE: false,
    CREATE_EMPLOYEE: false,
    DELETE_EMPLOYEE: false,
    MANAGE_TASKS: false,
    MANAGE_INVOICES: false,
    MANAGE_SERVICES: false,
    MANAGE_COMPANIES: false
  }
};

async function ensureTableExists() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role VARCHAR(30) PRIMARY KEY,
      permissions JSONB NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

// GET /api/permissions
exports.getPermissions = asyncHandler(async (req, res) => {
  try {
    await ensureTableExists();
    const rows = await prisma.$queryRawUnsafe(`SELECT role, permissions FROM role_permissions`);
    const result = {
      ADMIN: { ...DEFAULT_PERMISSIONS.ADMIN },
      MANAGER: { ...DEFAULT_PERMISSIONS.MANAGER },
      EMPLOYEE: { ...DEFAULT_PERMISSIONS.EMPLOYEE }
    };

    if (Array.isArray(rows)) {
      rows.forEach((row) => {
        const r = String(row.role).toUpperCase();
        if (result[r] && row.permissions) {
          const parsed = typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions;
          result[r] = { ...result[r], ...parsed };
        }
      });
    }

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
  const updatedMatrix = {};

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

  res.json(updatedMatrix);
});
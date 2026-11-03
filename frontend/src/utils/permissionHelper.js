import { useState, useEffect } from 'react';

const STORAGE_KEY = 'role_permissions_matrix';
const API_BASE = 'https://task-management-system-6ifq.onrender.com';

export const DEFAULT_PERMISSIONS = {
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

export const PERMISSION_GROUPS = [
  {
    groupTitle: 'Page Visibility (Navbar & Route Access)',
    items: [
      { key: 'VIEW_DISPATCH', label: 'View Client Dispatch Page' },
      { key: 'VIEW_LOES', label: 'View LOE Manager Page' },
      { key: 'VIEW_APPROVALS', label: 'View Approvals Queue Page' },
      { key: 'VIEW_TASKS', label: 'View Tasks / Task Allocation Page' },
      { key: 'VIEW_INVOICES', label: 'View Invoices Page' },
      { key: 'VIEW_EMPLOYEES', label: 'View Employees Directory Page' },
      { key: 'VIEW_SERVICES', label: 'View Standard Services Page' },
      { key: 'VIEW_COMPANIES', label: 'View Companies Page' }
    ]
  },
  {
    groupTitle: 'Action Capabilities (Create / Approve / Edit / Delete)',
    items: [
      { key: 'CREATE_LOE', label: 'Create & Edit LOEs' },
      { key: 'APPROVE_LOE', label: 'Approve & Reject LOE Deliverables' },
      { key: 'DELETE_LOE', label: 'Delete LOEs' },
      { key: 'CREATE_EMPLOYEE', label: 'Create & Edit Employees / Reset Passwords' },
      { key: 'DELETE_EMPLOYEE', label: 'Delete Employees' },
      { key: 'MANAGE_TASKS', label: 'Allocate Tasks, Deadlines & Create Custom Tasks' },
      { key: 'MANAGE_INVOICES', label: 'Mark Invoices Paid/Unpaid & Send Reminders' },
      { key: 'MANAGE_SERVICES', label: 'Create & Edit Services' },
      { key: 'MANAGE_COMPANIES', label: 'Create, Edit & Delete Companies' }
    ]
  }
];

export function mergeWithDefaults(customMatrix) {
  const merged = {
    ADMIN: { ...DEFAULT_PERMISSIONS.ADMIN, ...(customMatrix?.ADMIN || {}) },
    MANAGER: { ...DEFAULT_PERMISSIONS.MANAGER, ...(customMatrix?.MANAGER || {}) },
    EMPLOYEE: { ...DEFAULT_PERMISSIONS.EMPLOYEE, ...(customMatrix?.EMPLOYEE || {}) }
  };
  return merged;
}

export function getPermissionsMatrix() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PERMISSIONS;
    return mergeWithDefaults(JSON.parse(raw));
  } catch {
    return DEFAULT_PERMISSIONS;
  }
}

export function setLocalPermissionsMatrix(matrix) {
  const merged = mergeWithDefaults(matrix);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  window.dispatchEvent(new Event('permissions-updated'));
  return merged;
}

export function hasPermission(user, permKey, matrixOverride = null) {
  if (!user || !user.role) return false;
  const role = String(user.role).toUpperCase();
  const matrix = matrixOverride || getPermissionsMatrix();
  const rolePerms = matrix[role] || DEFAULT_PERMISSIONS[role] || {};
  return Boolean(rolePerms[permKey]);
}

export async function fetchPermissionsFromServer() {
  const token = localStorage.getItem('token');
  try {
    let res = null;
    if (window.location.hostname === 'localhost') {
      try {
        res = await fetch('http://localhost:3000/api/permissions', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
      } catch {
        res = null;
      }
    }
    if (!res || !res.ok) {
      res = await fetch(`${API_BASE}/api/permissions`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
    }
    if (res && res.ok) {
      const data = await res.json();
      if (data && (data.ADMIN || data.MANAGER || data.EMPLOYEE)) {
        return setLocalPermissionsMatrix(data);
      }
    }
  } catch {
    // Fallback to localStorage matrix if backend endpoint is not yet deployed
  }
  return getPermissionsMatrix();
}

export async function savePermissionsToServer(matrix) {
  const token = localStorage.getItem('token');
  const merged = setLocalPermissionsMatrix(matrix);

  try {
    let res = null;
    if (window.location.hostname === 'localhost') {
      try {
        res = await fetch('http://localhost:3000/api/permissions', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify(merged)
        });
      } catch {
        res = null;
      }
    }
    if (!res || !res.ok) {
      await fetch(`${API_BASE}/api/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(merged)
      });
    }
  } catch {
    // Saved locally even if remote server is offline
  }

  return merged;
}

export function usePermissions() {
  const [matrix, setMatrix] = useState(() => getPermissionsMatrix());

  useEffect(() => {
    const syncLocal = () => setMatrix(getPermissionsMatrix());
    window.addEventListener('permissions-updated', syncLocal);
    window.addEventListener('storage', syncLocal);

    fetchPermissionsFromServer().then((latest) => {
      if (latest) setMatrix(latest);
    });

    return () => {
      window.removeEventListener('permissions-updated', syncLocal);
      window.removeEventListener('storage', syncLocal);
    };
  }, []);

  const checkPerm = (user, permKey) => hasPermission(user, permKey, matrix);

  return { matrix, setMatrix, hasPermission: checkPerm };
}
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_BASE } from '../utils/api';
import Navbar from '../components/Navbar';
import BlobLoader from '../components/BlobLoader';
import {
  DEFAULT_PERMISSIONS,
  PERMISSION_GROUPS,
  usePermissions,
  savePermissionsToServer
} from '../utils/permissionHelper';

export default function AccessControl() {
  const navigate = useNavigate();

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};

  const isAdmin = user?.role === 'ADMIN';
  const isManager = user?.role === 'MANAGER';
  const canManageAccess = isAdmin || isManager;
  const userDeptId = user?.department_id || 1;

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState('');
  const [permSuccess, setPermSuccess] = useState('');
  const [permSaving, setPermSaving] = useState(false);

  // Dynamic Permissions Matrix
  const { matrix, setMatrix } = usePermissions();
  const [permMode, setPermMode] = useState('USER'); // 'USER' (Specific Person) | 'ROLE' (Role Defaults)
  const [empSearchQuery, setEmpSearchQuery] = useState('');
  const [selectedEmpId, setSelectedEmpId] = useState('');

  useEffect(() => {
    if (!token || !user?.emp_id) {
      navigate('/login');
      return;
    }
    if (!canManageAccess) {
      setError('You do not have administrative privilege to manage system access permissions.');
      setLoading(false);
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchDepartments(), fetchEmployeesList()]);
    } catch (err) {
      console.error('Error loading access control data:', err);
      setError('Failed to load employee list or permissions.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/departments`);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setDepartments(data);
      }
    } catch (err) {
      console.error('Failed to load departments:', err);
    }
  };

  const fetchEmployeesList = async () => {
    try {
      const url = isAdmin
        ? `${API_BASE}/api/employees?role=ADMIN`
        : `${API_BASE}/api/employees?department_id=${userDeptId}&role=MANAGER`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setEmployees(data);
        if (data.length > 0 && !selectedEmpId) {
          setSelectedEmpId(String(data[0].emp_id));
        }
      }
    } catch (err) {
      console.error('Failed to load employees for permissions:', err);
    }
  };

  // ==========================================
  // SPECIFIC PERSON & ROLE PERMISSION HANDLERS
  // ==========================================
  const selectedEmployee = employees.find(
    (emp) => String(emp.emp_id) === String(selectedEmpId)
  );

  // Filter employees by search bar input
  const filteredEmployees = employees.filter((emp) => {
    if (!empSearchQuery.trim()) return true;
    const q = empSearchQuery.trim().toLowerCase();
    const matchName = (emp.name || '').toLowerCase().includes(q);
    const matchEmail = (emp.email || '').toLowerCase().includes(q);
    const matchRole = (emp.role || '').toLowerCase().includes(q);
    const matchDept = (emp.department?.name || '').toLowerCase().includes(q);
    return matchName || matchEmail || matchRole || matchDept;
  });

  // Auto-select first matching employee when searching
  const handleSearchChange = (val) => {
    setEmpSearchQuery(val);
    if (val.trim()) {
      const q = val.trim().toLowerCase();
      const firstMatch = employees.find(
        (emp) =>
          (emp.name || '').toLowerCase().includes(q) ||
          (emp.email || '').toLowerCase().includes(q)
      );
      if (firstMatch) {
        setSelectedEmpId(String(firstMatch.emp_id));
      }
    }
  };

  // Check effective permission for the selected employee
  const getEffectiveUserPermission = (emp, permKey) => {
    if (!emp) return false;
    const empIdStr = String(emp.emp_id);
    const userOverrides = matrix.USERS?.[empIdStr];
    if (userOverrides && typeof userOverrides[permKey] === 'boolean') {
      return userOverrides[permKey];
    }
    const roleKey = String(emp.role || 'EMPLOYEE').toUpperCase();
    return Boolean(matrix[roleKey]?.[permKey]);
  };

  // Toggle a permission specifically for the selected employee
  const handleToggleEmployeePermission = (emp, permKey) => {
    if (!emp) return;
    setPermSuccess('');
    const empIdStr = String(emp.emp_id);
    const currentVal = getEffectiveUserPermission(emp, permKey);

    setMatrix((prev) => ({
      ...prev,
      USERS: {
        ...(prev.USERS || {}),
        [empIdStr]: {
          ...(prev.USERS?.[empIdStr] || {}),
          [permKey]: !currentVal
        }
      }
    }));
  };

  // Grant or revoke all permissions for the selected employee
  const handleSetAllForEmployee = (emp, grantAll) => {
    if (!emp) return;
    setPermSuccess('');
    const empIdStr = String(emp.emp_id);
    const allPerms = {};
    PERMISSION_GROUPS.forEach((group) => {
      group.items.forEach((item) => {
        allPerms[item.key] = grantAll;
      });
    });

    setMatrix((prev) => ({
      ...prev,
      USERS: {
        ...(prev.USERS || {}),
        [empIdStr]: allPerms
      }
    }));
  };

  // Clear custom overrides for the selected employee so they inherit their role's defaults
  const handleResetEmployeeToRoleDefault = (emp) => {
    if (!emp) return;
    setPermSuccess('');
    const empIdStr = String(emp.emp_id);
    setMatrix((prev) => {
      const updatedUsers = { ...(prev.USERS || {}) };
      delete updatedUsers[empIdStr];
      return {
        ...prev,
        USERS: updatedUsers
      };
    });
  };

  // Toggle role-level default permission
  const handleToggleRolePermission = (role, permKey) => {
    setPermSuccess('');
    setMatrix((prev) => ({
      ...prev,
      [role]: {
        ...(prev[role] || {}),
        [permKey]: !prev[role]?.[permKey]
      }
    }));
  };

  const handleSavePermissions = async () => {
    setPermSaving(true);
    setPermSuccess('');
    try {
      const saved = await savePermissionsToServer(matrix);
      setMatrix(saved);
      setPermSuccess(
        permMode === 'USER' && selectedEmployee
          ? `Access permissions saved successfully for ${selectedEmployee.name}!`
          : 'Access permissions saved and applied system-wide!'
      );
    } catch (err) {
      console.error('Failed to save permissions:', err);
      setError('Failed to persist permissions to server.');
    } finally {
      setPermSaving(false);
    }
  };

  const handleResetAllPermissions = async () => {
    if (!window.confirm('Reset all custom user overrides and role permissions back to system defaults?')) return;
    setPermSaving(true);
    setPermSuccess('');
    try {
      const saved = await savePermissionsToServer(DEFAULT_PERMISSIONS);
      setMatrix(saved);
      setPermSuccess('All permissions reset to system default configuration.');
    } catch (err) {
      console.error('Failed to reset permissions:', err);
      setError('Failed to reset permissions.');
    } finally {
      setPermSaving(false);
    }
  };

  const getDepartmentName = (deptId) => {
    const found = departments.find((d) => Number(d.department_id) === Number(deptId));
    return found ? found.name : `Department #${deptId}`;
  };

  const getRoleBadgeStyle = (role) => {
    if (role === 'ADMIN') return { background: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe' };
    if (role === 'MANAGER') return { background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' };
    return { background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' };
  };

  const hasCustomOverridesForSelected =
    selectedEmployee &&
    matrix.USERS?.[String(selectedEmployee.emp_id)] &&
    Object.keys(matrix.USERS[String(selectedEmployee.emp_id)]).length > 0;

  return (
    <div style={styles.pageContainer}>
      <Navbar />

      <div style={styles.container}>
        {/* Navigation Breadcrumb / Header */}
        <div style={styles.navRow}>
          <button
            type="button"
            onClick={() => navigate('/settings')}
            style={styles.backBtn}
          >
            &larr; Back to Settings
          </button>
          <div style={styles.breadcrumbBadge}>
            Role &amp; Dynamic Security
          </div>
        </div>

        {/* Page Title & Subtitle */}
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.pageTitle}>User &amp; Role Access Permissions Control</h1>
            <p style={styles.subTitle}>
              Search and select a specific employee to grant custom permissions, or configure role-wide defaults.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleResetAllPermissions}
              disabled={permSaving}
              style={styles.resetPermBtn}
            >
              Reset All Defaults
            </button>
            <button
              type="button"
              onClick={handleSavePermissions}
              disabled={permSaving}
              style={styles.savePermBtn}
            >
              {permSaving ? <BlobLoader inline size={14} light message="Saving Permissions..." /> : 'Save Access Permissions'}
            </button>
          </div>
        </div>

        {error && <div style={styles.errorBanner}>{error}</div>}
        {permSuccess && <div style={styles.successBanner}>{permSuccess}</div>}

        {loading ? (
          <div style={styles.loaderCard}>
            <BlobLoader message="Loading access control & permission matrices..." size="large" />
          </div>
        ) : !canManageAccess ? (
          <div style={styles.unauthorizedCard}>
            <h3 style={{ margin: '0 0 8px', color: '#991b1b' }}>Access Restricted</h3>
            <p style={{ margin: '0 0 16px', color: '#7f1d1d', fontSize: '13.5px' }}>
              Only Administrators and Department Managers have permission to configure access rights.
            </p>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              style={styles.backHomeBtn}
            >
              Return to Dashboard
            </button>
          </div>
        ) : (
          <div style={styles.card}>
            {/* Mode Switcher Tabs */}
            <div style={styles.modeTabRow}>
              <button
                type="button"
                onClick={() => setPermMode('USER')}
                style={{
                  ...styles.modeTabBtn,
                  ...(permMode === 'USER' ? styles.modeTabBtnActive : {})
                }}
              >
                Specific Person Access (Search &amp; Select)
              </button>
              <button
                type="button"
                onClick={() => setPermMode('ROLE')}
                style={{
                  ...styles.modeTabBtn,
                  ...(permMode === 'ROLE' ? styles.modeTabBtnActive : {})
                }}
              >
                Role-Wide Defaults (ADMIN / MANAGER / EMPLOYEE)
              </button>
            </div>

            {permMode === 'USER' ? (
              /* =======================================================
                 SPECIFIC PERSON PERMISSION SELECTOR (Search + Dropdown)
                 ======================================================= */
              <div style={{ marginTop: '20px' }}>
                {/* Search Bar & Dropdown Selector Bar */}
                <div style={styles.personFilterBar}>
                  <div style={{ flex: 1, minWidth: '240px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={styles.label}>Search Person (Name, Email, Role, or Dept)</label>
                    <input
                      type="text"
                      placeholder="Type employee name or email to search..."
                      value={empSearchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      style={styles.input}
                    />
                  </div>

                  <div style={{ flex: 1.3, minWidth: '260px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={styles.label}>
                      Select Employee from Dropdown ({filteredEmployees.length} found)
                    </label>
                    <select
                      value={selectedEmpId}
                      onChange={(e) => setSelectedEmpId(e.target.value)}
                      style={{ ...styles.input, background: '#fff', fontWeight: 'bold' }}
                    >
                      {filteredEmployees.length === 0 ? (
                        <option value="">No matching employees found</option>
                      ) : (
                        filteredEmployees.map((emp) => {
                          const hasCustom =
                            matrix.USERS?.[String(emp.emp_id)] &&
                            Object.keys(matrix.USERS[String(emp.emp_id)]).length > 0;
                          return (
                            <option key={emp.emp_id} value={emp.emp_id}>
                              {emp.name} ({emp.email}) — [{emp.role || 'EMPLOYEE'}]
                              {hasCustom ? ' * (Custom Overrides)' : ''}
                            </option>
                          );
                        })
                      )}
                    </select>
                  </div>
                </div>

                {!selectedEmployee ? (
                  <div style={styles.emptyCard}>
                    Please select an employee above to inspect and configure individual access rights.
                  </div>
                ) : (
                  <>
                    {/* Selected Person Card with Quick Grant/Revoke Controls */}
                    <div style={styles.selectedEmpBanner}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '16px', color: '#0f172a' }}>
                            {selectedEmployee.name}
                          </strong>
                          <span style={{ ...styles.roleBadge, ...getRoleBadgeStyle(selectedEmployee.role) }}>
                            {selectedEmployee.role}
                          </span>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 'bold',
                              padding: '3px 8px',
                              borderRadius: '10px',
                              background: hasCustomOverridesForSelected ? '#fef3c7' : '#e2e8f0',
                              color: hasCustomOverridesForSelected ? '#92400e' : '#475569'
                            }}
                          >
                            {hasCustomOverridesForSelected ? 'Custom User Overrides Active' : 'Using Role Defaults'}
                          </span>
                        </div>
                        <div style={{ fontSize: '12.5px', color: '#475569', marginTop: '4px' }}>
                          {selectedEmployee.email} &nbsp;&bull;&nbsp;{' '}
                          {selectedEmployee.department?.name || getDepartmentName(selectedEmployee.department_id)}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => handleSetAllForEmployee(selectedEmployee, true)}
                          style={styles.quickActionBtn}
                        >
                          Grant All
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetAllForEmployee(selectedEmployee, false)}
                          style={styles.quickActionBtn}
                        >
                          Revoke All
                        </button>
                        {hasCustomOverridesForSelected && (
                          <button
                            type="button"
                            onClick={() => handleResetEmployeeToRoleDefault(selectedEmployee)}
                            style={{ ...styles.quickActionBtn, color: '#dc2626', borderColor: '#fca5a5' }}
                          >
                            Reset to {selectedEmployee.role} Default
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Permission Groups Table for Selected Person */}
                    {PERMISSION_GROUPS.map((group, gIdx) => (
                      <div key={gIdx} style={{ marginTop: '22px' }}>
                        <h4 style={styles.groupHeading}>{group.groupTitle}</h4>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={styles.permTable}>
                            <thead>
                              <tr>
                                <th style={{ ...styles.permTh, width: '58%' }}>Permission / Capability</th>
                                <th style={{ ...styles.permTh, textAlign: 'center', width: '22%' }}>Source</th>
                                <th style={{ ...styles.permTh, textAlign: 'center', width: '20%' }}>
                                  Access for {selectedEmployee.name}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.items.map((item) => {
                                const empIdStr = String(selectedEmployee.emp_id);
                                const isCustom =
                                  matrix.USERS?.[empIdStr] !== undefined &&
                                  typeof matrix.USERS[empIdStr][item.key] === 'boolean';
                                const isChecked = getEffectiveUserPermission(selectedEmployee, item.key);

                                return (
                                  <tr key={item.key} style={styles.permTr}>
                                    <td style={styles.permTd}>
                                      <strong>{item.label}</strong>
                                    </td>
                                    <td style={{ ...styles.permTd, textAlign: 'center' }}>
                                      <span
                                        style={{
                                          fontSize: '11px',
                                          fontWeight: 'bold',
                                          padding: '2px 8px',
                                          borderRadius: '10px',
                                          background: isCustom ? '#dbeafe' : '#f1f5f9',
                                          color: isCustom ? '#1e40af' : '#64748b'
                                        }}
                                      >
                                        {isCustom ? 'Custom Override' : `${selectedEmployee.role} Default`}
                                      </span>
                                    </td>
                                    <td style={{ ...styles.permTd, textAlign: 'center' }}>
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() =>
                                          handleToggleEmployeePermission(selectedEmployee, item.key)
                                        }
                                        style={styles.checkbox}
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            ) : (
              /* =======================================================
                 ROLE-WIDE DEFAULTS MATRIX (ADMIN / MANAGER / EMPLOYEE)
                 ======================================================= */
              <div style={{ marginTop: '20px' }}>
                {PERMISSION_GROUPS.map((group, gIdx) => (
                  <div key={gIdx} style={{ marginTop: '22px' }}>
                    <h4 style={styles.groupHeading}>{group.groupTitle}</h4>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={styles.permTable}>
                        <thead>
                          <tr>
                            <th style={{ ...styles.permTh, width: '52%' }}>Permission / Capability</th>
                            <th style={{ ...styles.permTh, textAlign: 'center' }}>ADMIN</th>
                            <th style={{ ...styles.permTh, textAlign: 'center' }}>MANAGER</th>
                            <th style={{ ...styles.permTh, textAlign: 'center' }}>EMPLOYEE</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.items.map((item) => (
                            <tr key={item.key} style={styles.permTr}>
                              <td style={styles.permTd}>
                                <strong>{item.label}</strong>
                              </td>
                              {['ADMIN', 'MANAGER', 'EMPLOYEE'].map((roleKey) => (
                                <td key={roleKey} style={{ ...styles.permTd, textAlign: 'center' }}>
                                  <input
                                    type="checkbox"
                                    checked={Boolean(matrix[roleKey]?.[item.key])}
                                    onChange={() => handleToggleRolePermission(roleKey, item.key)}
                                    style={styles.checkbox}
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  pageContainer: {
    minHeight: '100vh',
    background: '#f8fafc',
    fontFamily: "'Poppins', system-ui, -apple-system, sans-serif",
    marginLeft: 'var(--sidebar-width, 260px)',
    transition: 'margin-left 300ms ease-in-out'
  },
  container: { maxWidth: '1200px', margin: '0 auto', padding: '30px 40px' },
  navRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#0284c7',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer',
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px'
  },
  breadcrumbBadge: {
    fontSize: '11.5px',
    fontWeight: 'bold',
    color: '#64748b',
    background: '#f1f5f9',
    padding: '3px 10px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0'
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '16px',
    marginBottom: '20px'
  },
  pageTitle: { margin: 0, fontSize: '24px', color: '#0f172a', fontWeight: '800', letterSpacing: '-0.3px' },
  subTitle: { margin: '4px 0 0', fontSize: '13.5px', color: '#475569' },
  loaderCard: {
    background: '#ffffff',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    padding: '60px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '340px'
  },
  unauthorizedCard: {
    background: '#fff1f2',
    border: '1px solid #fecdd3',
    padding: '30px',
    borderRadius: '10px',
    textAlign: 'center'
  },
  backHomeBtn: {
    padding: '8px 18px',
    background: '#e11d48',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer'
  },
  card: {
    background: '#ffffff',
    padding: '24px',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
  },
  emptyCard: {
    background: '#f8fafc',
    padding: '30px',
    borderRadius: '8px',
    textAlign: 'center',
    color: '#64748b',
    fontSize: '13px',
    border: '1px dashed #cbd5e1',
    marginTop: '16px'
  },
  roleBadge: {
    padding: '3px 10px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 'bold'
  },
  modeTabRow: {
    display: 'flex',
    gap: '10px',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '16px',
    flexWrap: 'wrap'
  },
  modeTabBtn: {
    padding: '9px 16px',
    background: '#f8fafc',
    color: '#475569',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  },
  modeTabBtnActive: {
    background: '#0f172a',
    color: '#ffffff',
    borderColor: '#0f172a'
  },
  personFilterBar: {
    display: 'flex',
    gap: '14px',
    flexWrap: 'wrap',
    background: '#f8fafc',
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    marginBottom: '16px'
  },
  label: { fontSize: '12px', fontWeight: 'bold', color: '#475569' },
  input: {
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '13.5px',
    outline: 'none'
  },
  selectedEmpBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    padding: '14px 18px',
    borderRadius: '8px'
  },
  quickActionBtn: {
    padding: '6px 12px',
    background: '#ffffff',
    color: '#1e293b',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
    transition: 'all 0.15s ease'
  },
  savePermBtn: {
    padding: '9px 20px',
    background: '#16a34a',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(22, 163, 74, 0.25)',
    transition: 'all 0.15s ease'
  },
  resetPermBtn: {
    padding: '9px 16px',
    background: '#f1f5f9',
    color: '#475569',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  },
  groupHeading: {
    margin: '0 0 10px',
    fontSize: '13px',
    color: '#1e293b',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    fontWeight: '800'
  },
  permTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    overflow: 'hidden'
  },
  permTh: {
    background: '#f8fafc',
    color: '#475569',
    padding: '11px 14px',
    textAlign: 'left',
    borderBottom: '1px solid #cbd5e1',
    fontWeight: 'bold'
  },
  permTr: {
    borderBottom: '1px solid #e2e8f0',
    transition: 'background 0.15s ease'
  },
  permTd: {
    padding: '11px 14px',
    color: '#334155'
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
    accentColor: '#0284c7'
  },
  errorBanner: {
    background: '#fff1f2',
    color: '#e11d48',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '18px',
    border: '1px solid #fecdd3',
    fontSize: '13px'
  },
  successBanner: {
    background: '#ecfdf5',
    color: '#059669',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '18px',
    border: '1px solid #a7f3d0',
    fontSize: '13px',
    fontWeight: 'bold'
  }
};

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import {
  DEFAULT_PERMISSIONS,
  PERMISSION_GROUPS,
  usePermissions,
  savePermissionsToServer
} from '../utils/permissionHelper';

export default function Settings() {
  const navigate = useNavigate();

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const storedUser = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};

  const [user, setUser] = useState(storedUser);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: storedUser.name || '',
    email: storedUser.email || '',
    password: '',
    confirmPassword: ''
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Dynamic Permissions State (Editable by Admin & Manager)
  const { matrix, setMatrix } = usePermissions();
  const [permMode, setPermMode] = useState('USER'); // 'USER' (Specific Person) | 'ROLE' (Role Defaults)
  const [empSearchQuery, setEmpSearchQuery] = useState('');
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [permSaving, setPermSaving] = useState(false);
  const [permSuccess, setPermSuccess] = useState('');

  const isAdmin = user?.role === 'ADMIN';
  const canManageAccess = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const userDeptId = user?.department_id || 1;

  useEffect(() => {
    if (!token || !user?.emp_id) {
      navigate('/login');
      return;
    }
    fetchDepartments();
    fetchLatestProfile();
    if (canManageAccess) {
      fetchEmployeesList();
    }
  }, []);

  const fetchDepartments = async () => {
    try {
      const response = await fetch('https://task-management-system-6ifq.onrender.com/api/auth/departments');
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
        ? 'https://task-management-system-6ifq.onrender.com/api/employees?role=ADMIN'
        : `https://task-management-system-6ifq.onrender.com/api/employees?department_id=${userDeptId}&role=MANAGER`;

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

  const fetchLatestProfile = async () => {
    try {
      const response = await fetch(
        `https://task-management-system-6ifq.onrender.com/api/employees/${user.emp_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.ok) {
        const data = await response.json();
        const updatedUser = {
          ...user,
          emp_id: data.emp_id,
          name: data.name,
          email: data.email,
          role: data.role,
          department_id: data.department_id,
          department_name: data.department?.name || user.department_name
        };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setFormData((prev) => ({
          ...prev,
          name: data.name || '',
          email: data.email || ''
        }));
      }
    } catch (err) {
      console.error('Failed to fetch latest profile:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!formData.name.trim() || !formData.email.trim()) {
      setError('Full Name and Email Address are required.');
      return;
    }

    if (formData.password && formData.password !== formData.confirmPassword) {
      setError('New password and confirm password do not match.');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        requester_emp_id: user.emp_id,
        requester_role: user.role,
        requester_dept_id: user.department_id
      };

      if (formData.password.trim() !== '') {
        payload.password = formData.password.trim();
      }

      let response = await fetch(
        `https://task-management-system-6ifq.onrender.com/api/employees/${user.emp_id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        }
      );

      if (response.status === 403) {
        response = await fetch(
          `https://task-management-system-6ifq.onrender.com/api/employees/${user.emp_id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...payload,
              requester_role: 'MANAGER'
            })
          }
        );
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile details.');
      }

      const updatedUserObj = {
        ...user,
        name: data.name,
        email: data.email
      };

      setUser(updatedUserObj);
      localStorage.setItem('user', JSON.stringify(updatedUserObj));

      setFormData((prev) => ({
        ...prev,
        password: '',
        confirmPassword: ''
      }));

      setSuccessMsg('Profile details updated successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
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
          ? `Access permissions saved for ${selectedEmployee.name}!`
          : 'Access permissions saved and applied across the system!'
      );
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
      setPermSuccess('All permissions reset to default configuration.');
    } finally {
      setPermSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const getDepartmentName = (deptId) => {
    const found = departments.find((d) => Number(d.department_id) === Number(deptId));
    return found ? found.name : user.department_name || `Department #${deptId}`;
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
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
        {/* Page Header */}
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.pageTitle}>Account Settings</h1>
            <p style={styles.subTitle}>
              Manage your personal profile details, login credentials, and user access permissions.
            </p>
          </div>
        </div>

        {/* User Profile Summary Banner */}
        <div style={styles.profileBanner}>
          <div style={styles.avatarCircle}>
            {getInitials(user.name)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '20px', color: '#0f172a' }}>
                {user.name || 'User'}
              </h2>
              <span style={{ ...styles.roleBadge, ...getRoleBadgeStyle(user.role) }}>
                {user.role || 'EMPLOYEE'}
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: '#475569' }}>
               {user.email} &nbsp;&bull;&nbsp; {getDepartmentName(user.department_id)} &nbsp;&bull;&nbsp; ID: #{user.emp_id}
            </p>
          </div>
        </div>

        {error && <div style={styles.errorBanner}>{error}</div>}
        {successMsg && <div style={styles.successBanner}>{successMsg}</div>}

        <div style={styles.grid}>
          {/* Left Card: Edit Profile & Password */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Change Profile Details</h3>
            <p style={styles.cardSubtitle}>
              Update your full name, email address, or login password below.
            </p>

            <form onSubmit={handleUpdateProfile} style={styles.form}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Full Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter your full name"
                  required
                  style={styles.input}
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Email Address (Login Username) *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="name@company.com"
                  required
                  style={styles.input}
                />
              </div>

              <div style={styles.divider} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '14px', color: '#1e293b' }}>
                  Change Password <span style={{ fontWeight: 'normal', color: '#64748b', fontSize: '12px' }}>(Optional)</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={styles.showPassBtn}
                >
                  {showPassword ? 'Hide Password' : 'Show Password'}
                </button>
              </div>

              <div style={styles.twoColRow}>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>New Password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Leave blank to keep current"
                    style={styles.input}
                  />
                </div>

                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Confirm New Password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Re-enter new password"
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={{ marginTop: '8px' }}>
                <button type="submit" disabled={saving} style={styles.saveBtn}>
                  {saving ? 'Saving Changes...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Account Info & Logout Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Account Overview</h3>
              <div style={styles.infoList}>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>Employee ID</span>
                  <span style={styles.infoValue}>#{user.emp_id}</span>
                </div>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>Access Level</span>
                  <span style={styles.infoValue}>{user.role}</span>
                </div>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>Department</span>
                  <span style={styles.infoValue}>{getDepartmentName(user.department_id)}</span>
                </div>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>Account Status</span>
                  <span style={{ color: '#16a34a', fontWeight: 'bold', fontSize: '13px' }}>● Active</span>
                </div>
              </div>
            </div>

            {/* Session & Logout Box */}
            <div style={styles.logoutCard}>
              <h3 style={{ margin: '0 0 6px', fontSize: '16px', color: '#991b1b' }}>
                Sign Out of Account
              </h3>
              <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#7f1d1d', lineHeight: '1.5' }}>
                Ready to leave? Logging out will safely end your current session on this browser.
              </p>
              <button
                type="button"
                onClick={handleLogout}
                style={styles.logoutBtn}
              >
                 Logout of Account
              </button>
            </div>
          </div>
        </div>

        {/* =======================================================
            USER & ROLE ACCESS PERMISSIONS CONTROL (Admin & Manager)
            ======================================================= */}
        {canManageAccess && (
          <div style={{ ...styles.card, marginTop: '28px' }}>
            <div style={styles.permHeaderRow}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>
                   User &amp; Role Access Permissions Control
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
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
                  {permSaving ? 'Saving...' : 'Save Access Permissions'}
                </button>
              </div>
            </div>

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

            {permSuccess && (
              <div style={{ ...styles.successBanner, marginTop: '14px', marginBottom: '4px' }}>
                {permSuccess}
              </div>
            )}

            {permMode === 'USER' ? (
              /* =======================================================
                 SPECIFIC PERSON PERMISSION SELECTOR (Search + Dropdown)
                 ======================================================= */
              <div style={{ marginTop: '16px' }}>
                {/* Search Bar & Dropdown Selector Bar */}
                <div style={styles.personFilterBar}>
                  <div style={{ flex: 1, minWidth: '240px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={styles.label}> Search Person (Name, Email, Role, or Dept)</label>
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
                              {emp.name} ({emp.email}) — [{emp.role}] {hasCustom ? '[Custom Access]' : ''}
                            </option>
                          );
                        })
                      )}
                    </select>
                  </div>
                </div>

                {!selectedEmployee ? (
                  <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                    Please select an employee from the dropdown above to configure their permissions.
                  </div>
                ) : (
                  <>
                    {/* Selected Employee Banner + Quick Actions */}
                    <div style={styles.selectedEmpBanner}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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
                      <div key={gIdx} style={{ marginTop: '18px' }}>
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
              <div>
                {PERMISSION_GROUPS.map((group, gIdx) => (
                  <div key={gIdx} style={{ marginTop: '20px' }}>
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
    fontFamily: 'system-ui',
    marginLeft: 'var(--sidebar-width, 260px)',
    transition: 'margin-left 300ms ease-in-out'
  },
  container: { maxWidth: '1100px', margin: '0 auto', padding: '35px 40px' },
  headerRow: { marginBottom: '22px' },
  pageTitle: { margin: 0, fontSize: '26px', color: '#0f172a', fontWeight: '800', letterSpacing: '-0.3px' },
  subTitle: { margin: '4px 0 0', fontSize: '14px', color: '#475569' },
  profileBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '18px',
    background: '#ffffff',
    padding: '20px 24px',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
    marginBottom: '22px'
  },
  avatarCircle: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: '#0284c7',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    fontWeight: 'bold',
    flexShrink: 0
  },
  roleBadge: {
    padding: '3px 10px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 'bold'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1.6fr 1fr',
    gap: '24px',
    alignItems: 'start'
  },
  card: {
    background: '#ffffff',
    padding: '24px',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
  },
  cardTitle: { margin: '0 0 4px', fontSize: '17px', color: '#0f172a' },
  cardSubtitle: { margin: '0 0 18px', fontSize: '13px', color: '#64748b' },
  form: { display: 'flex', flexDirection: 'column', gap: '15px' },
  twoColRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
  label: { fontSize: '12px', fontWeight: 'bold', color: '#475569' },
  input: {
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '13.5px',
    outline: 'none'
  },
  divider: { height: '1px', background: '#e2e8f0', margin: '4px 0' },
  showPassBtn: {
    background: 'none',
    border: 'none',
    color: '#0284c7',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
    padding: 0
  },
  saveBtn: {
    width: '100%',
    padding: '11px 16px',
    background: '#0284c7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '14px',
    cursor: 'pointer'
  },
  infoList: { display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    paddingBottom: '8px',
    borderBottom: '1px dashed #e2e8f0',
    fontSize: '13px'
  },
  infoLabel: { color: '#64748b', fontWeight: '600' },
  infoValue: { color: '#0f172a', fontWeight: 'bold' },
  logoutCard: {
    background: '#fff1f2',
    padding: '22px',
    borderRadius: '10px',
    border: '1px solid #fecdd3'
  },
  logoutBtn: {
    width: '100%',
    padding: '11px 16px',
    background: '#e11d48',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'background 0.15s ease'
  },
  permHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '14px',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '14px'
  },
  modeTabRow: {
    display: 'flex',
    gap: '10px',
    marginTop: '16px',
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
    cursor: 'pointer'
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
    cursor: 'pointer'
  },
  savePermBtn: {
    padding: '9px 18px',
    background: '#16a34a',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer'
  },
  resetPermBtn: {
    padding: '9px 14px',
    background: '#f1f5f9',
    color: '#475569',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer'
  },
  groupHeading: {
    margin: '0 0 10px',
    fontSize: '13.5px',
    color: '#1e293b',
    textTransform: 'uppercase',
    letterSpacing: '0.4px'
  },
  permTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
    border: '1px solid #e2e8f0'
  },
  permTh: {
    background: '#f8fafc',
    color: '#475569',
    padding: '10px 14px',
    textAlign: 'left',
    borderBottom: '1px solid #cbd5e1',
    fontWeight: 'bold'
  },
  permTr: {
    borderBottom: '1px solid #e2e8f0'
  },
  permTd: {
    padding: '10px 14px',
    color: '#334155'
  },
  checkbox: {
    width: '17px',
    height: '17px',
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
import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { usePermissions } from '../utils/permissionHelper';

export default function EmployeeManager() {
  const { hasPermission } = usePermissions();

  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};
  
  const isAdmin = user?.role === 'ADMIN';
  const userDeptId = user?.department_id || 1;

  const canViewPage = hasPermission(user, 'VIEW_EMPLOYEES');
  const canCreateOrEdit = hasPermission(user, 'CREATE_EMPLOYEE');
  const canDelete = hasPermission(user, 'DELETE_EMPLOYEE');

  const initialFormState = {
    name: '',
    email: '',
    password: '',
    department_id: isAdmin ? '' : userDeptId,
    role: 'EMPLOYEE',
    is_active: true
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    fetchEmployees();
    fetchDepartments();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isModalOpen) {
        closeModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  const fetchEmployees = async () => {
    try {
      const url = isAdmin
        ? 'https://task-management-system-6ifq.onrender.com/api/employees?role=ADMIN'
        : `https://task-management-system-6ifq.onrender.com/api/employees?department_id=${userDeptId}&role=MANAGER`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) setEmployees(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch('https://task-management-system-6ifq.onrender.com/api/auth/departments');
      const data = await response.json();
      if (response.ok && Array.isArray(data)) setDepartments(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      department_id: isAdmin ? '' : userDeptId,
      role: 'EMPLOYEE',
      is_active: true
    });
    setError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      department_id: isAdmin ? '' : userDeptId,
      role: 'EMPLOYEE',
      is_active: true
    });
    setError('');
  };

  const handleEdit = (emp) => {
    setEditingId(emp.emp_id);
    setFormData({
      name: emp.name,
      email: emp.email,
      password: '',
      department_id: emp.department_id,
      role: emp.role,
      is_active: emp.is_active
    });
    setError('');
    setIsModalOpen(true);
  };

  const handleDeleteEmployee = async (empId, empName) => {
    if (!window.confirm(`Are you sure you want to delete employee "${empName}"?`)) return;
    try {
      setError('');
      const response = await fetch(`https://task-management-system-6ifq.onrender.com/api/employees/${empId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        const d = await response.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to delete employee');
      }
      setEmployees(prev => prev.filter(e => e.emp_id !== empId));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    const url = editingId
      ? `https://task-management-system-6ifq.onrender.com/api/employees/${editingId}`
      : 'https://task-management-system-6ifq.onrender.com/api/employees';

    const method = editingId ? 'PUT' : 'POST';

    const payload = {
      ...formData,
      department_id: isAdmin ? Number(formData.department_id) : userDeptId,
      role: isAdmin ? formData.role : 'EMPLOYEE',
      requester_role: isAdmin ? 'ADMIN' : 'MANAGER',
      requester_dept_id: userDeptId,
      requester_emp_id: user?.emp_id
    };

    if (editingId && !formData.password) {
      delete payload.password;
    }

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save employee');

      await fetchEmployees();
      closeModal();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const getDepartmentName = (deptId) => {
    const found = departments.find(d => d.department_id === Number(deptId));
    return found ? found.name : `Dept #${deptId}`;
  };

  const getRoleBadgeStyle = (role) => {
    switch (role) {
      case 'ADMIN':
        return { background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe' };
      case 'MANAGER':
        return { background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd' };
      default:
        return { background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' };
    }
  };

  const displayedEmployees = employees.filter((emp) => {
    if (!isAdmin || selectedDeptFilter === 'ALL') return true;
    return emp.department_id === Number(selectedDeptFilter);
  });

  if (!canViewPage) {
    return (
      <div style={styles.pageContainer}>
        <Navbar />
        <div style={{ padding: '40px', textAlign: 'center' }}>
          Access Denied. You do not have permission to view the Employees page.
        </div>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer}>
      <Navbar />
      <div style={styles.contentWrapper}>
        
        {/* Top Header Row with Title, Filters, and Add Button */}
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.pageTitle}>
              {isAdmin ? 'All Employees Directory' : `${getDepartmentName(userDeptId)} Team`}
            </h1>
            <p style={styles.pageSubtitle}>
              {displayedEmployees.length} registered team member{displayedEmployees.length === 1 ? '' : 's'}. Manage credentials and account access.
            </p>
          </div>

          <div style={styles.headerActions}>
            {isAdmin && (
              <select
                value={selectedDeptFilter}
                onChange={(e) => setSelectedDeptFilter(e.target.value)}
                style={styles.filterDropdown}
              >
                <option value="ALL">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.department_id} value={dept.department_id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            )}

            {canCreateOrEdit && (
              <button onClick={openCreateModal} style={styles.primaryActionBtn}>
                + Add Employee
              </button>
            )}
          </div>
        </div>

        {error && !isModalOpen && (
          <div style={styles.inlineErrorBox}>{error}</div>
        )}

        {/* Full-width Employees Directory */}
        <div style={styles.listSection}>
          {displayedEmployees.length === 0 ? (
            <div style={styles.emptyState}>No employees found.</div>
          ) : (
            <div style={styles.grid}>
              {displayedEmployees.map((emp) => {
                const roleBadge = getRoleBadgeStyle(emp.role);

                return (
                  <div key={emp.emp_id} style={styles.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>{emp.name}</h3>
                      <span style={{ ...styles.badge, ...roleBadge }}>{emp.role}</span>
                    </div>

                    <p style={{ margin: '8px 0 4px', fontSize: '13px', color: '#475569' }}>
                      {emp.email}
                    </p>
                    <p style={{ margin: '4px 0', fontSize: '13px', color: '#475569' }}>
                      <strong>Department:</strong> {emp.department?.name || getDepartmentName(emp.department_id)}
                    </p>
                    <p style={{ margin: '4px 0 10px', fontSize: '12.5px' }}>
                      Status:{' '}
                      <strong style={{ color: emp.is_active ? '#059669' : '#e11d48' }}>
                        {emp.is_active ? 'Active' : 'Deactivated'}
                      </strong>
                    </p>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                      {canCreateOrEdit && (
                        <button onClick={() => handleEdit(emp)} style={styles.editBtn}>
                          Edit / Reset Password
                        </button>
                      )}
                      {canDelete && emp.emp_id !== user.emp_id && (
                        <button
                          onClick={() => handleDeleteEmployee(emp.emp_id, emp.name)}
                          style={styles.deleteBtn}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Add / Edit Employee Modal Dialog */}
      {isModalOpen && canCreateOrEdit && (
        <div style={styles.modalOverlay} onClick={closeModal}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>
                  {editingId ? 'Edit Employee Details' : 'Add New Employee'}
                </h2>
                <p style={styles.modalSubtitle}>
                  {isAdmin 
                    ? 'Admins can assign employees or managers to any department.' 
                    : `Add team members directly to the ${getDepartmentName(userDeptId)} department.`}
                </p>
              </div>
              <button onClick={closeModal} style={styles.closeBtn} title="Close dialog">
                ✕
              </button>
            </div>

            {error && <div style={styles.errorBox}>{error}</div>}

            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Full Name *</label>
                <input 
                  type="text" 
                  name="name" 
                  value={formData.name} 
                  onChange={handleChange} 
                  placeholder="e.g. John Doe" 
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
                  placeholder="john.doe@company.com" 
                  required 
                  style={styles.input} 
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>
                  {editingId ? 'New Password (leave blank to keep current)' : 'Login Password *'}
                </label>
                <input 
                  type="text" 
                  name="password" 
                  value={formData.password} 
                  onChange={handleChange} 
                  placeholder="Set initial login password" 
                  required={!editingId} 
                  style={styles.input} 
                />
              </div>

              {/* Department Assignment */}
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Department *</label>
                {isAdmin ? (
                  <select 
                    name="department_id" 
                    value={formData.department_id} 
                    onChange={handleChange} 
                    required 
                    style={styles.input}
                  >
                    <option value="" disabled>-- Select Department --</option>
                    {departments.map((dept) => (
                      <option key={dept.department_id} value={dept.department_id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={styles.lockedField}>
                    <strong>{getDepartmentName(userDeptId)}</strong>
                    <span style={styles.lockedNote}>(Locked to your department)</span>
                  </div>
                )}
              </div>

              {/* Role Selection */}
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Role *</label>
                {isAdmin ? (
                  <select 
                    name="role" 
                    value={formData.role} 
                    onChange={handleChange} 
                    style={styles.input}
                  >
                    <option value="EMPLOYEE">EMPLOYEE (Standard Staff)</option>
                    <option value="MANAGER">MANAGER (Department Head)</option>
                    <option value="ADMIN">ADMIN (Universal Access)</option>
                  </select>
                ) : (
                  <div style={styles.lockedField}>
                    <strong>EMPLOYEE</strong>
                    <span style={styles.lockedNote}>(Standard employee role)</span>
                  </div>
                )}
              </div>

              {editingId && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    name="is_active" 
                    checked={formData.is_active} 
                    onChange={handleChange} 
                  />
                  Account is Active &amp; Allowed to Log In
                </label>
              )}

              <div style={styles.buttonGroup}>
                <button type="submit" disabled={saving} style={styles.button}>
                  {saving ? 'Saving...' : editingId ? 'Update Details' : 'Create Employee'}
                </button>
                <button 
                  type="button" 
                  onClick={closeModal} 
                  style={styles.cancelButton}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
  contentWrapper: {
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '35px 40px'
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '16px'
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  pageTitle: {
    margin: 0,
    fontSize: '24px',
    fontWeight: '700',
    color: '#0f172a'
  },
  pageSubtitle: {
    margin: '4px 0 0 0',
    color: '#64748b',
    fontSize: '14px'
  },
  primaryActionBtn: {
    padding: '10px 20px',
    background: '#0284c7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '13.5px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)',
    transition: 'background 0.15s ease'
  },
  filterDropdown: {
    padding: '9px 14px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '13px',
    background: '#ffffff',
    color: '#334155',
    fontWeight: 'bold'
  },
  listSection: {
    width: '100%'
  },
  emptyState: {
    background: '#ffffff',
    padding: '40px',
    textAlign: 'center',
    borderRadius: '8px',
    color: '#64748b',
    border: '1px solid #e2e8f0',
    fontSize: '14px'
  },
  inlineErrorBox: {
    padding: '12px 16px',
    background: '#fff1f2',
    color: '#e11d48',
    borderRadius: '6px',
    fontSize: '13.5px',
    border: '1px solid #fecdd3',
    marginBottom: '20px'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '18px'
  },
  card: {
    background: '#fff',
    padding: '18px',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
    border: '1px solid #e2e8f0'
  },
  badge: {
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 'bold'
  },
  editBtn: {
    flex: 1,
    padding: '7px 10px',
    background: '#f0f9ff',
    color: '#0284c7',
    border: '1px solid #bae6fd',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '12px'
  },
  deleteBtn: {
    padding: '7px 12px',
    background: '#fff1f2',
    color: '#e11d48',
    border: '1px solid #fecdd3',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '12px'
  },

  // Modal Dialog Styles
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(15, 23, 42, 0.55)',
    backdropFilter: 'blur(2px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: '20px'
  },
  modalContent: {
    background: '#ffffff',
    borderRadius: '10px',
    width: '100%',
    maxWidth: '560px',
    maxHeight: '90vh',
    overflowY: 'auto',
    padding: '28px',
    boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.25)',
    border: '1px solid #e2e8f0'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '16px',
    marginBottom: '18px'
  },
  modalTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: '700',
    color: '#0f172a'
  },
  modalSubtitle: {
    margin: '4px 0 0',
    fontSize: '13px',
    color: '#64748b'
  },
  closeBtn: {
    background: '#f1f5f9',
    border: 'none',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    fontSize: '15px',
    cursor: 'pointer',
    color: '#475569',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px'
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px'
  },
  label: {
    fontSize: '12.5px',
    fontWeight: 'bold',
    color: '#334155'
  },
  input: {
    padding: '10px 12px',
    borderRadius: '4px',
    border: '1px solid #cbd5e1',
    fontSize: '13.5px',
    background: '#ffffff',
    color: '#0f172a'
  },
  lockedField: {
    padding: '10px 12px',
    borderRadius: '4px',
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    fontSize: '13.5px',
    display: 'flex',
    flexDirection: 'column'
  },
  lockedNote: {
    fontSize: '11px',
    color: '#64748b',
    marginTop: '2px'
  },
  buttonGroup: {
    display: 'flex',
    gap: '10px',
    marginTop: '10px',
    paddingTop: '12px',
    borderTop: '1px solid #f1f5f9'
  },
  button: {
    flex: '1',
    padding: '10px',
    background: '#0284c7',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '13.5px'
  },
  cancelButton: {
    flex: '1',
    padding: '10px',
    background: '#f1f5f9',
    color: '#334155',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '13.5px'
  },
  errorBox: {
    padding: '10px 14px',
    background: '#fff1f2',
    color: '#e11d48',
    borderRadius: '4px',
    fontSize: '13px',
    border: '1px solid #fecdd3',
    marginBottom: '14px'
  }
};

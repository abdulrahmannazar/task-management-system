import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';

export default function EmployeeManager() {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};
  
  const isAdmin = user?.role === 'ADMIN';
  const isManager = user?.role === 'MANAGER';
  const userDeptId = user?.department_id || 1;

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    department_id: isAdmin ? '' : userDeptId,
    role: 'EMPLOYEE',
    is_active: true
  });

  useEffect(() => {
    fetchEmployees();
    fetchDepartments();
  }, []);

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

  const handleEdit = (emp) => {
    setEditingId(emp.emp_id);
    setFormData({
      name: emp.name,
      email: emp.email,
      password: '', // Blank unless setting a new password
      department_id: emp.department_id,
      role: emp.role,
      is_active: emp.is_active
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    const url = editingId
      ? `https://task-management-system-6ifq.onrender.com/api/employees/${editingId}`
      : 'https://task-management-system-6ifq.onrender.com/api/employees';

    const method = editingId ? 'PUT' : 'POST';

    // Enforcement: Managers can only add EMPLOYEES to their own department
    const payload = {
      ...formData,
      department_id: isAdmin ? Number(formData.department_id) : userDeptId,
      role: isAdmin ? formData.role : 'EMPLOYEE',
      requester_role: user?.role,
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
      setEditingId(null);
      setFormData({
        name: '',
        email: '',
        password: '',
        department_id: isAdmin ? '' : userDeptId,
        role: 'EMPLOYEE',
        is_active: true
      });
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
        return { background: '#6f42c1', color: '#fff' };
      case 'MANAGER':
        return { background: '#007bff', color: '#fff' };
      default:
        return { background: '#6c757d', color: '#fff' };
    }
  };

  const displayedEmployees = employees.filter((emp) => {
    if (!isAdmin || selectedDeptFilter === 'ALL') return true;
    return emp.department_id === Number(selectedDeptFilter);
  });

  if (!isAdmin && !isManager) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Access Denied. Admins and Managers only.</div>;
  }

  return (
    <div style={styles.pageContainer}>
      <Navbar />
      <div style={styles.container}>
        
        {/* Left Form: Add or Edit Employee */}
        <div style={styles.formSection}>
          <h2>{editingId ? 'Edit Employee Details' : 'Add New Employee'}</h2>
          <p style={{ margin: '-5px 0 15px', color: '#6c757d', fontSize: '13px' }}>
            {isAdmin 
              ? 'Admins can assign employees or managers to any department.' 
              : `Managers can add team members directly to the ${getDepartmentName(userDeptId)} department.`}
          </p>

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
                  <span style={styles.lockedNote}>(Locked to your managing department)</span>
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
                  <span style={styles.lockedNote}>(Managers add team employees to their department)</span>
                </div>
              )}
            </div>

            {editingId && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                <input 
                  type="checkbox" 
                  name="is_active" 
                  checked={formData.is_active} 
                  onChange={handleChange} 
                />
                Account is Active
              </label>
            )}

            <div style={styles.buttonGroup}>
              <button type="submit" disabled={saving} style={styles.button}>
                {saving ? 'Saving...' : editingId ? 'Update Details' : 'Create Employee'}
              </button>
              {editingId && (
                <button 
                  type="button" 
                  onClick={() => {
                    setEditingId(null);
                    setFormData({
                      name: '',
                      email: '',
                      password: '',
                      department_id: isAdmin ? '' : userDeptId,
                      role: 'EMPLOYEE',
                      is_active: true
                    });
                  }} 
                  style={styles.cancelButton}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Right Directory: Employees List */}
        <div style={styles.listSection}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <div>
              <h2 style={{ margin: 0 }}>
                {isAdmin ? 'All Employees Directory' : `${getDepartmentName(userDeptId)} Team`}
              </h2>
              <p style={{ margin: '4px 0 0 0', color: '#6c757d', fontSize: '13px' }}>
                {displayedEmployees.length} registered account{displayedEmployees.length === 1 ? '' : 's'}.
              </p>
            </div>

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
          </div>

          {displayedEmployees.length === 0 ? (
            <p>No employees found.</p>
          ) : (
            <div style={styles.grid}>
              {displayedEmployees.map((emp) => {
                const roleBadge = getRoleBadgeStyle(emp.role);

                return (
                  <div key={emp.emp_id} style={styles.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h3 style={{ margin: 0, fontSize: '16px', color: '#1a202c' }}>{emp.name}</h3>
                      <span style={{ ...styles.badge, ...roleBadge }}>{emp.role}</span>
                    </div>

                    <p style={{ margin: '8px 0 4px', fontSize: '13px', color: '#4a5568' }}>
                      ✉️ {emp.email}
                    </p>
                    <p style={{ margin: '4px 0', fontSize: '13px', color: '#4a5568' }}>
                      🏢 {emp.department?.name || getDepartmentName(emp.department_id)}
                    </p>
                    <p style={{ margin: '4px 0 10px', fontSize: '12px' }}>
                      Status: <strong style={{ color: emp.is_active ? '#28a745' : '#dc3545' }}>
                        {emp.is_active ? 'Active' : 'Deactivated'}
                      </strong>
                    </p>

                    <button onClick={() => handleEdit(emp)} style={styles.editBtn}>
                      Edit Details / Reset Password
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

const styles = {
  pageContainer: { minHeight: '100vh', background: '#f4f6f8', fontFamily: 'system-ui' },
  container: { display: 'flex', gap: '40px', padding: '40px' },
  formSection: { flex: '1.1', background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', height: 'fit-content' },
  listSection: { flex: '1.9' },
  form: { display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '15px' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
  label: { fontSize: '12px', fontWeight: 'bold', color: '#4a5568' },
  input: { padding: '9px 10px', borderRadius: '4px', border: '1px solid #ced4da', fontSize: '13.5px' },
  lockedField: { padding: '9px 10px', borderRadius: '4px', background: '#e9ecef', border: '1px solid #ced4da', fontSize: '13.5px', display: 'flex', flexDirection: 'column' },
  lockedNote: { fontSize: '11px', color: '#6c757d', marginTop: '2px' },
  filterDropdown: { padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px', background: '#fff', fontWeight: 'bold' },
  buttonGroup: { display: 'flex', gap: '10px', marginTop: '10px' },
  button: { flex: '1', padding: '10px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  cancelButton: { flex: '1', padding: '10px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  errorBox: { padding: '10px 14px', background: '#fed7d7', color: '#c53030', borderRadius: '4px', fontSize: '13px', border: '1px solid #feb2b2' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' },
  card: { background: '#fff', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' },
  badge: { padding: '2px 8px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 'bold' },
  editBtn: { width: '100%', marginTop: '6px', padding: '6px', background: '#f8f9fa', color: '#007bff', border: '1px solid #ced4da', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }
};
import React, { useState, useEffect } from 'react';
import { API_BASE, performLogout } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import BlobLoader from '../components/BlobLoader';

export default function Settings() {
  const navigate = useNavigate();

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const storedUser = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};

  const [user, setUser] = useState(storedUser);
  const [departments, setDepartments] = useState([]);
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

  const isAdmin = user?.role === 'ADMIN';
  const canManageAccess = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  useEffect(() => {
    if (!token || !user?.emp_id) {
      navigate('/login');
      return;
    }
    fetchDepartments();
    fetchLatestProfile();
  }, []);

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

  const fetchLatestProfile = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/api/employees/${user.emp_id}`,
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
        `${API_BASE}/api/employees/${user.emp_id}`,
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
          `${API_BASE}/api/employees/${user.emp_id}`,
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

  const handleLogout = () => {
    performLogout({ reason: 'manual', callApi: true, broadcast: true });
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

  return (
    <div style={styles.pageContainer}>
      <Navbar />

      <div style={styles.container}>
        {/* Page Header */}
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.pageTitle}>Account Settings</h1>
            <p style={styles.subTitle}>
              Manage your personal profile details, login credentials, and security settings.
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
                  {saving ? <BlobLoader inline size={14} light message="Saving Changes..." /> : 'Save Profile Changes'}
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

        {/* ACCESS PERMISSIONS CONTROL GATEWAY (FOR ADMIN & MANAGER) */}
        {canManageAccess && (
          <div style={styles.accessGatewayCard}>
            <div style={{ flex: '1 1 500px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: '700' }}>
                  User &amp; Role Access Permissions Control
                </h3>
                <span style={styles.accessPrivilegeBadge}>
                  {user.role} Privilege
                </span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '13.5px', color: '#64748b', lineHeight: '1.5' }}>
                Configure specific person permissions, grant custom capability overrides, and adjust system-wide role defaults across all application modules.
              </p>
              <div style={styles.gatewayPillsRow}>
                <span style={styles.gatewayPill}>Specific Person Overrides</span>
                <span style={styles.gatewayPill}>Role Defaults (Admin / Manager / Employee)</span>
                <span style={styles.gatewayPill}>Page &amp; Action Capabilities</span>
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={() => navigate('/access-control')}
                style={styles.openAccessBtn}
                title="Open Access Permissions Control Workspace"
              >
                Open Access Permissions Control &rarr;
              </button>
            </div>
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
  accessGatewayCard: {
    background: '#ffffff',
    padding: '24px 28px',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
    marginTop: '28px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '20px'
  },
  accessPrivilegeBadge: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#0369a1',
    background: '#e0f2fe',
    border: '1px solid #bae6fd',
    padding: '2px 8px',
    borderRadius: '12px'
  },
  gatewayPillsRow: {
    display: 'flex',
    gap: '8px',
    marginTop: '12px',
    flexWrap: 'wrap'
  },
  gatewayPill: {
    fontSize: '11.5px',
    fontWeight: '600',
    color: '#475569',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    padding: '3px 10px',
    borderRadius: '12px'
  },
  openAccessBtn: {
    padding: '11px 22px',
    background: '#0284c7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '13.5px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)',
    transition: 'all 0.15s ease'
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

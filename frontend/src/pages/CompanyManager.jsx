import React, { useState, useEffect } from 'react';
import { API_BASE } from '../utils/api';
import Navbar from '../components/Navbar';
import { usePermissions } from '../utils/permissionHelper';

export default function CompanyManager() {
  const { hasPermission } = usePermissions();

  const [companies, setCompanies] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};

  const canView = hasPermission(user, 'VIEW_COMPANIES');
  const canEdit = hasPermission(user, 'MANAGE_COMPANIES');

  const initialFormState = {
    name: '',
    client_type: 'Corporate',
    reg_number: '',
    tin_number: '',
    email: '',
    phone_number: ''
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    fetchCompanies();
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

  const fetchCompanies = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/companies`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setCompanies(Array.isArray(data) ? data : data.companies || []);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch companies.');
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const openCreateModal = () => {
    setEditingId(null);
    setFormData(initialFormState);
    setError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData(initialFormState);
    setError('');
  };

  const handleEdit = (company) => {
    setEditingId(company.company_id);
    setFormData({
      name: company.name || '',
      client_type: company.client_type || 'Corporate',
      reg_number: company.reg_number || '',
      tin_number: company.tin_number || '',
      email: company.email || '',
      phone_number: company.phone_number || ''
    });
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const url = editingId
      ? `${API_BASE}/api/companies/${editingId}`
      : `${API_BASE}/api/companies`;

    const method = editingId ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save company');

      await fetchCompanies();
      closeModal();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (companyId) => {
    if (!window.confirm('Are you sure you want to delete this company?')) return;

    try {
      const response = await fetch(`${API_BASE}/api/companies/${companyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete company');
      }

      setCompanies((prev) => prev.filter((c) => c.company_id !== companyId));
    } catch (err) {
      setError(err.message);
    }
  };

  if (!canView) {
    return (
      <div style={styles.pageContainer}>
        <Navbar />
        <div style={{ padding: '40px', textAlign: 'center' }}>
          Access Denied. You do not have permission to view the Companies page.
        </div>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer}>
      <Navbar />
      <div style={styles.contentWrapper}>
        
        {/* Top Header Row with Title and Action Button */}
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.pageTitle}>Companies Directory</h1>
            <p style={styles.pageSubtitle}>
              Manage registered clients, corporate details, and company entities.
            </p>
          </div>
          {canEdit && (
            <button onClick={openCreateModal} style={styles.primaryActionBtn}>
              + Add Company
            </button>
          )}
        </div>

        {error && !isModalOpen && (
          <div style={styles.inlineErrorBox}>{error}</div>
        )}

        {/* Full-width Registered Companies Grid */}
        <div style={styles.listSection}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>
              Registered Companies ({companies.length})
            </h2>
          </div>

          {companies.length === 0 ? (
            <div style={styles.emptyState}>No companies registered yet.</div>
          ) : (
            <div style={styles.grid}>
              {companies.map((comp) => (
                <div key={comp.company_id} style={styles.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>{comp.name}</h3>
                    <span style={styles.badge}>{comp.client_type}</span>
                  </div>
                  <p style={{ margin: '8px 0 4px', fontSize: '13px', color: '#64748b' }}>
                    <strong>ID:</strong> #{comp.company_id}
                  </p>
                  {comp.reg_number && (
                    <p style={styles.infoLine}><strong>Reg No:</strong> {comp.reg_number}</p>
                  )}
                  {comp.tin_number && (
                    <p style={styles.infoLine}><strong>TIN:</strong> {comp.tin_number}</p>
                  )}
                  {comp.email && (
                    <p style={styles.infoLine}><strong>Email:</strong> {comp.email}</p>
                  )}
                  {comp.phone_number && (
                    <p style={styles.infoLine}><strong>Phone:</strong> {comp.phone_number}</p>
                  )}

                  {canEdit && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                      <button onClick={() => handleEdit(comp)} style={styles.editButton}>
                        Edit
                      </button>
                      <button onClick={() => handleDelete(comp.company_id)} style={styles.deleteButton}>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Creation & Editing Modal Dialog */}
      {isModalOpen && canEdit && (
        <div style={styles.modalOverlay} onClick={closeModal}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>
                  {editingId ? 'Edit Company' : 'Register New Company'}
                </h2>
                <p style={styles.modalSubtitle}>
                  {editingId ? 'Update company registration and contact details.' : 'Add a new client company entity to the directory.'}
                </p>
              </div>
              <button onClick={closeModal} style={styles.closeBtn} title="Close dialog">
                ✕
              </button>
            </div>

            {error && <div style={styles.errorBox}>{error}</div>}

            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Company Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Nexus Corp Ltd"
                  required
                  style={styles.input}
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Client Type *</label>
                <select
                  name="client_type"
                  value={formData.client_type}
                  onChange={handleChange}
                  required
                  style={styles.input}
                >
                  <option value="Corporate">Corporate</option>
                  <option value="Individual">Individual</option>
                  <option value="SME">SME</option>
                  <option value="Partnership">Partnership</option>
                  <option value="Non-Profit">Non-Profit</option>
                </select>
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Registration Number</label>
                <input
                  type="text"
                  name="reg_number"
                  value={formData.reg_number}
                  onChange={handleChange}
                  placeholder="e.g. PV-123456"
                  style={styles.input}
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>TIN Number</label>
                <input
                  type="text"
                  name="tin_number"
                  value={formData.tin_number}
                  onChange={handleChange}
                  placeholder="e.g. TIN-987654321"
                  style={styles.input}
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="e.g. contact@nexuscorp.com"
                  style={styles.input}
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Phone Number</label>
                <input
                  type="text"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleChange}
                  placeholder="e.g. +1 555-0199"
                  style={styles.input}
                />
              </div>

              <div style={styles.buttonGroup}>
                <button type="submit" style={styles.button}>
                  {editingId ? 'Update Company' : 'Create Company'}
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
    gap: '20px'
  },
  card: {
    background: '#fff',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
    border: '1px solid #e2e8f0',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease'
  },
  badge: {
    background: '#f0f9ff',
    color: '#0284c7',
    border: '1px solid #bae6fd',
    padding: '3px 10px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 'bold'
  },
  infoLine: {
    margin: '4px 0',
    fontSize: '13.5px',
    color: '#475569'
  },
  editButton: {
    flex: '1',
    padding: '7px 12px',
    background: '#f0f9ff',
    color: '#0284c7',
    border: '1px solid #bae6fd',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '12.5px'
  },
  deleteButton: {
    flex: '1',
    padding: '7px 12px',
    background: '#fff1f2',
    color: '#e11d48',
    border: '1px solid #fecdd3',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '12.5px'
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
    maxWidth: '540px',
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
  errorBox: {
    padding: '10px 14px',
    background: '#fff1f2',
    color: '#e11d48',
    borderRadius: '4px',
    fontSize: '13px',
    border: '1px solid #fecdd3',
    marginBottom: '14px'
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
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '13.5px',
    color: '#0f172a',
    outline: 'none',
    background: '#ffffff'
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
    borderRadius: '6px',
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
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '13.5px'
  }
};

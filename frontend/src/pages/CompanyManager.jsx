import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';

export default function CompanyManager() {
  const [companies, setCompanies] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const canEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER';

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

  const fetchCompanies = async () => {
    try {
      const response = await fetch('https://task-management-system-6ifq.onrender.com/api/companies', {
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
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const url = editingId
      ? `https://task-management-system-6ifq.onrender.com/api/companies/${editingId}`
      : 'https://task-management-system-6ifq.onrender.com/api/companies';

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
      setEditingId(null);
      setFormData(initialFormState);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (companyId) => {
    if (!window.confirm('Are you sure you want to delete this company?')) return;

    try {
      const response = await fetch(`https://task-management-system-6ifq.onrender.com/api/companies/${companyId}`, {
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

  if (!user || (user.role !== 'MANAGER' && user.role !== 'ADMIN')) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Access Denied. Managers and Admins only.</div>;
  }

  return (
    <div style={styles.pageContainer}>
      <Navbar />
      <div style={styles.container}>
        {canEdit && (
          <div style={styles.formSection}>
            <h2>{editingId ? 'Edit Company' : 'Register New Company'}</h2>
            {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}

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
                {editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setFormData(initialFormState);
                    }}
                    style={styles.cancelButton}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        <div style={styles.listSection}>
          <h2>Registered Companies</h2>
          {companies.length === 0 ? (
            <p>No companies registered yet.</p>
          ) : (
            <div style={styles.grid}>
              {companies.map((comp) => (
                <div key={comp.company_id} style={styles.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '18px' }}>{comp.name}</h3>
                    <span style={styles.badge}>{comp.client_type}</span>
                  </div>
                  <p style={{ margin: '8px 0 4px', fontSize: '13px', color: '#666' }}>
                    <strong>ID:</strong> {comp.company_id}
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
                    <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
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
    </div>
  );
}

const styles = {
  pageContainer: { minHeight: '100vh', background: '#f4f6f8', fontFamily: 'system-ui' },
  container: { display: 'flex', gap: '40px', padding: '40px' },
  formSection: { flex: '1', background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', height: 'fit-content' },
  listSection: { flex: '2' },
  form: { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '15px' },
  fieldGroup: { display: 'flex', flexDirection: 'column' },
  label: { fontSize: '13px', fontWeight: 'bold', marginBottom: '4px', color: '#444' },
  input: { padding: '10px', borderRadius: '4px', border: '1px solid #ccc' },
  badge: { background: '#007bff', color: '#fff', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' },
  infoLine: { margin: '4px 0', fontSize: '14px' },
  buttonGroup: { display: 'flex', gap: '10px', marginTop: '10px' },
  button: { flex: '1', padding: '10px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  cancelButton: { flex: '1', padding: '10px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px', marginTop: '15px' },
  card: { background: '#fff', padding: '18px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
  editButton: { flex: '1', padding: '6px 12px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  deleteButton: { flex: '1', padding: '6px 12px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }
};
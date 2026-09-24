import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';

export default function CompanyManager() {
  const [companies, setCompanies] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const canEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });

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
      name: company.name || company.company_name || '',
      email: company.email || '',
      phone: company.phone || '',
      address: company.address || ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const url = editingId
      ? `https://task-management-system-6ifq.onrender.com/api/companies/${editingId}`
      : 'https://task-management-system-6ifq.onrender.com/api/companies';

    const method = editingId ? 'PUT' : 'POST';

    // Only include optional fields if they have values
    const payload = { name: formData.name };
    if (formData.email) payload.email = formData.email;
    if (formData.phone) payload.phone = formData.phone;
    if (formData.address) payload.address = formData.address;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save company');

      await fetchCompanies();
      setEditingId(null);
      setFormData({ name: '', email: '', phone: '', address: '' });
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
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Company Name (e.g. Acme Corp)"
                required
                style={styles.input}
              />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Email Address (optional)"
                style={styles.input}
              />
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Phone Number (optional)"
                style={styles.input}
              />
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Address / Location (optional)"
                style={styles.input}
              />

              <div style={styles.buttonGroup}>
                <button type="submit" style={styles.button}>
                  {editingId ? 'Update Company' : 'Create Company'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setFormData({ name: '', email: '', phone: '', address: '' });
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
                  <p><strong>ID:</strong> {comp.company_id}</p>
                  <p><strong>Name:</strong> {comp.name || comp.company_name}</p>
                  {comp.email && <p><strong>Email:</strong> {comp.email}</p>}
                  {comp.phone && <p><strong>Phone:</strong> {comp.phone}</p>}
                  {comp.address && <p><strong>Address:</strong> {comp.address}</p>}

                  {canEdit && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
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
  formSection: { flex: '1', background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', height: 'fit-content' },
  listSection: { flex: '2' },
  form: { display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' },
  input: { padding: '10px', borderRadius: '4px', border: '1px solid #ccc' },
  buttonGroup: { display: 'flex', gap: '10px', marginTop: '10px' },
  button: { flex: '1', padding: '10px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  cancelButton: { flex: '1', padding: '10px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px', marginTop: '15px' },
  card: { background: '#fff', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
  editButton: { flex: '1', padding: '6px 12px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  deleteButton: { flex: '1', padding: '6px 12px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }
};
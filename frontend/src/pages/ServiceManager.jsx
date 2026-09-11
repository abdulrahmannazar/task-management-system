import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';

export default function ServiceManager() {
  const [services, setServices] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user?.role === 'ADMIN';
  const userDeptId = user?.department_id || 1;

  const [formData, setFormData] = useState({
    department_id: isAdmin ? '' : userDeptId,
    name: '',
    sub_category: '',
    billing_type: 'Fixed',
    is_active: true
  });

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const url = `http://localhost:3000/api/services?department_id=${userDeptId}&role=${user?.role || 'MANAGER'}`;
      const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await response.json();
      if (response.ok) setServices(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleEdit = (service) => {
    setEditingId(service.service_id);
    setFormData({
      department_id: service.department_id,
      name: service.name,
      sub_category: service.sub_category,
      billing_type: service.billing_type,
      is_active: service.is_active
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const url = editingId 
      ? `http://localhost:3000/api/services/${editingId}` 
      : 'http://localhost:3000/api/services';
    const method = editingId ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Failed to save service');

      await fetchServices();
      setEditingId(null);
      setFormData({ department_id: isAdmin ? '' : userDeptId, name: '', sub_category: '', billing_type: 'Fixed', is_active: true });
    } catch (err) {
      setError(err.message);
    }
  };

  if (!user || (user.role !== 'MANAGER' && user.role !== 'ADMIN')) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Access Denied.</div>;
  }

  return (
    <div style={styles.pageContainer}>
      <Navbar />
      <div style={styles.container}>
        <div style={styles.formSection}>
          <h2>{editingId ? 'Edit Service' : 'Create New Service'}</h2>
          {error && <p style={{ color: 'red' }}>{error}</p>}
          
          <form onSubmit={handleSubmit} style={styles.form}>
            {isAdmin ? (
              <input type="number" name="department_id" value={formData.department_id} onChange={handleChange} placeholder="Department ID" required style={styles.input} />
            ) : (
              <p style={{ color: '#666', fontSize: '14px' }}><strong>Target Department:</strong> {userDeptId} (Locked to your department)</p>
            )}
            
            <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Service Name (e.g. Annual Tax Filing)" required style={styles.input} />
            <input type="text" name="sub_category" value={formData.sub_category} onChange={handleChange} placeholder="Sub Category" required style={styles.input} />
            
            <select name="billing_type" value={formData.billing_type} onChange={handleChange} style={styles.input}>
              <option value="Fixed">Fixed</option>
              <option value="Hourly">Hourly</option>
            </select>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
              <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} />
              Service is Active
            </label>

            <div style={styles.buttonGroup}>
              <button type="submit" style={styles.button}>{editingId ? 'Update' : 'Create'}</button>
              {editingId && (
                <button type="button" onClick={() => { setEditingId(null); setFormData({ department_id: isAdmin ? '' : userDeptId, name: '', sub_category: '', billing_type: 'Fixed', is_active: true }); }} style={styles.cancelButton}>Cancel</button>
              )}
            </div>
          </form>
        </div>

        <div style={styles.listSection}>
          <h2>Available Services</h2>
          <div style={styles.grid}>
            {services.map((srv) => (
              <div key={srv.service_id} style={styles.card}>
                <p><strong>ID:</strong> {srv.service_id} | <strong>Dept:</strong> {srv.department_id}</p>
                <p><strong>Name:</strong> {srv.name}</p>
                <p><strong>Category:</strong> {srv.sub_category}</p>
                <p><strong>Billing:</strong> {srv.billing_type}</p>
                <p><strong>Status:</strong> {srv.is_active ? 'Active' : 'Inactive'}</p>
                <button onClick={() => handleEdit(srv)} style={styles.editButton}>Edit</button>
              </div>
            ))}
          </div>
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
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px', marginTop: '15px' },
  card: { background: '#fff', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
  editButton: { marginTop: '10px', padding: '5px 15px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }
};
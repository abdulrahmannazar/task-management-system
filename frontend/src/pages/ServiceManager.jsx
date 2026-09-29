import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';

export default function ServiceManager() {
  const [services, setServices] = useState([]);
  const [departments, setDepartments] = useState([]);
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
    scopes: [''], // Array of individual addable scopes
    billing_type: 'Fixed',
    is_active: true
  });

  useEffect(() => {
    fetchServices();
    fetchDepartments();
  }, []);

  const parseScopes = (scopeData) => {
    if (!scopeData) return [];
    if (Array.isArray(scopeData)) return scopeData;
    try {
      const parsed = JSON.parse(scopeData);
      if (Array.isArray(parsed)) return parsed;
      return [parsed.toString()];
    } catch {
      return scopeData.split('\n').map((s) => s.trim()).filter(Boolean);
    }
  };

  const fetchServices = async () => {
    try {
      const url = `https://task-management-system-6ifq.onrender.com/api/services?department_id=${userDeptId}&role=${user?.role || 'MANAGER'}`;
      const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await response.json();
      if (response.ok) setServices(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch('https://task-management-system-6ifq.onrender.com/api/auth/departments');
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setDepartments(data);
      }
    } catch (err) {
      console.error('Failed to load departments', err);
    }
  };

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleScopeChange = (index, value) => {
    setFormData((prev) => {
      const newScopes = [...prev.scopes];
      newScopes[index] = value;
      return { ...prev, scopes: newScopes };
    });
  };

  const addScopeField = () => {
    setFormData((prev) => ({
      ...prev,
      scopes: [...prev.scopes, '']
    }));
  };

  const removeScopeField = (index) => {
    setFormData((prev) => {
      const newScopes = [...prev.scopes];
      newScopes.splice(index, 1);
      return { ...prev, scopes: newScopes.length === 0 ? [''] : newScopes };
    });
  };

  const handleEdit = (service) => {
    setEditingId(service.service_id);
    const existingScopes = parseScopes(service.scope);
    setFormData({
      department_id: service.department_id,
      name: service.name,
      sub_category: service.sub_category || '',
      scopes: existingScopes.length > 0 ? existingScopes : [''],
      billing_type: service.billing_type,
      is_active: service.is_active
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const url = editingId 
      ? `https://task-management-system-6ifq.onrender.com/api/services/${editingId}`
      : 'https://task-management-system-6ifq.onrender.com/api/services';
      
    const method = editingId ? 'PUT' : 'POST';

    const cleanedScopes = formData.scopes.map((s) => s.trim()).filter(Boolean);

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          department_id: Number(formData.department_id),
          name: formData.name,
          sub_category: formData.sub_category,
          scope: JSON.stringify(cleanedScopes),
          billing_type: formData.billing_type,
          is_active: formData.is_active
        })
      });

      if (!response.ok) throw new Error(data.error || 'Failed to save service');
      
      await fetchServices();
      setEditingId(null);
      setFormData({ 
        department_id: isAdmin ? '' : userDeptId, 
        name: '', 
        sub_category: '', 
        scopes: [''], 
        billing_type: 'Fixed', 
        is_active: true 
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const getDepartmentName = (deptId) => {
    const found = departments.find((d) => d.department_id === Number(deptId));
    return found ? found.name : `Dept #${deptId}`;
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
              <select
                name="department_id"
                value={formData.department_id}
                onChange={handleChange}
                required
                style={styles.input}
              >
                <option value="" disabled>Select Department</option>
                {departments.map((dept) => (
                  <option key={dept.department_id} value={dept.department_id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            ) : (
              <p style={{ color: '#666', fontSize: '14px' }}>
                <strong>Target Department:</strong> {getDepartmentName(userDeptId)} (Locked to your department)
              </p>
            )}
            
            <input 
              type="text" 
              name="name" 
              value={formData.name} 
              onChange={handleChange} 
              placeholder="Service Name (e.g. Annual Tax Filing)" 
              required 
              style={styles.input} 
            />
            
            <input 
              type="text" 
              name="sub_category" 
              value={formData.sub_category} 
              onChange={handleChange} 
              placeholder="Sub Category (e.g. Taxation, Audit)" 
              required 
              style={styles.input} 
            />

            <div style={styles.scopesBox}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#444' }}>
                Service Scopes / Deliverables
              </label>
              {formData.scopes.map((scopeText, idx) => (
                <div key={idx} style={styles.scopeRow}>
                  <input
                    type="text"
                    placeholder={`Scope ${idx + 1} (e.g. Preparation of annual accounts)`}
                    value={scopeText}
                    onChange={(e) => handleScopeChange(idx, e.target.value)}
                    required={idx === 0}
                    style={styles.input}
                  />
                  {formData.scopes.length > 1 && (
                    <button 
                      type="button" 
                      onClick={() => removeScopeField(idx)} 
                      style={styles.removeBtn}
                    >
                      X
                    </button>
                  )}
                </div>
              ))}
              <button 
                type="button" 
                onClick={addScopeField} 
                style={styles.addScopeBtn}
              >
                + Add Scope Item
              </button>
            </div>
            
            <select name="billing_type" value={formData.billing_type} onChange={handleChange} style={styles.input}>
              <option value="Fixed">Fixed</option>
              <option value="Hourly">Hourly</option>
            </select>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
              <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} />
              Service is Active
            </label>

            <div style={styles.buttonGroup}>
              <button type="submit" style={styles.button}>{editingId ? 'Update Service' : 'Create Service'}</button>
              {editingId && (
                <button 
                  type="button" 
                  onClick={() => { 
                    setEditingId(null); 
                    setFormData({ 
                      department_id: isAdmin ? '' : userDeptId, 
                      name: '', 
                      sub_category: '', 
                      scopes: [''], 
                      billing_type: 'Fixed', 
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

        <div style={styles.listSection}>
          <h2>Available Services</h2>
          <div style={styles.grid}>
            {services.map((srv) => {
              const scopeItems = parseScopes(srv.scope);

              return (
                <div key={srv.service_id} style={styles.card}>
                  <p><strong>ID:</strong> {srv.service_id} | <strong>Dept:</strong> {getDepartmentName(srv.department_id)}</p>
                  <p><strong>Name:</strong> {srv.name}</p>
                  <p><strong>Category:</strong> {srv.sub_category}</p>
                  
                  <div style={styles.scopePreviewList}>
                    <strong>Scopes:</strong>
                    {scopeItems.length === 0 ? (
                      <p style={{ margin: '2px 0', color: '#888', fontStyle: 'italic' }}>None defined</p>
                    ) : (
                      <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                        {scopeItems.map((sc, i) => (
                          <li key={i} style={{ fontSize: '12px', color: '#555' }}>{sc}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <p><strong>Billing:</strong> {srv.billing_type}</p>
                  <p><strong>Status:</strong> {srv.is_active ? 'Active' : 'Inactive'}</p>
                  <button onClick={() => handleEdit(srv)} style={styles.editButton}>Edit</button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  pageContainer: { minHeight: '100vh', background: '#f4f6f8', fontFamily: 'system-ui' },
  container: { display: 'flex', gap: '40px', padding: '40px' },
  formSection: { flex: '1.2', background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', height: 'fit-content' },
  listSection: { flex: '1.8' },
  form: { display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' },
  input: { flex: '1', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' },
  scopesBox: { background: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '4px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' },
  scopeRow: { display: 'flex', gap: '8px', alignItems: 'center' },
  removeBtn: { padding: '8px 12px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  addScopeBtn: { padding: '8px', background: '#e2e6ea', color: '#333', border: '1px dashed #6c757d', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' },
  buttonGroup: { display: 'flex', gap: '10px', marginTop: '10px' },
  button: { flex: '1', padding: '10px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  cancelButton: { flex: '1', padding: '10px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px', marginTop: '15px' },
  card: { background: '#fff', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
  scopePreviewList: { margin: '8px 0', padding: '6px 8px', background: '#f8f9fa', borderRadius: '4px', fontSize: '13px' },
  editButton: { marginTop: '10px', padding: '5px 15px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }
};
import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';

export default function LoeManager() {
  const [loes, setLoes] = useState([]);
  const [services, setServices] = useState([]);
  const [formData, setFormData] = useState({
    company_id: '',
    status: 'Draft',
    type: 'Standard',
    start_date: '',
    loe_items: [] 
  });
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};
  
  const canEdit = user.role === 'ADMIN' || user.role === 'MANAGER';

  useEffect(() => {
    fetchLoes();
    fetchServices();
  }, []);

  const fetchLoes = async () => {
    try {
      if (!token) return setError("Invalid token.");
      const response = await fetch('https://task-management-system-6ifq.onrender.com/api/loes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) setLoes(Array.isArray(data) ? data : data.loes || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchServices = async () => {
    try {
      if (!token) return;
      const response = await fetch('https://task-management-system-6ifq.onrender.com/api/services', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && Array.isArray(data)) setServices(data);
    } catch (err) {
      console.error('Failed to load services', err);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const addServiceRow = () => {
    setFormData(prev => ({
      ...prev,
      loe_items: [...prev.loe_items, { service_id: services[0]?.service_id || '', custom_scope: '', amount: '' }]
    }));
  };

  const removeServiceRow = (index) => {
    setFormData(prev => {
      const newItems = [...prev.loe_items];
      newItems.splice(index, 1);
      return { ...prev, loe_items: newItems };
    });
  };

  const handleItemChange = (index, field, value) => {
    setFormData(prev => {
      const newItems = [...prev.loe_items];
      newItems[index][field] = value;
      return { ...prev, loe_items: newItems };
    });
  };

  const handleEdit = (loe) => {
    setEditingId(loe.loe_id);
    setFormData({
      company_id: loe.company_id,
      status: loe.status,
      type: loe.type,
      start_date: loe.start_date ? loe.start_date.split('T')[0] : '',
      loe_items: loe.loe_items || [] 
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const url = editingId 
      ? `https://task-management-system-6ifq.onrender.com/api/loes/${editingId}`
      : 'https://task-management-system-6ifq.onrender.com/api/loes';
      
    const method = editingId ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          company_id: Number(formData.company_id),
          created_by: user.emp_id || 2, 
          loe_items: formData.loe_items.map(item => ({
            service_id: Number(item.service_id),
            custom_scope: item.custom_scope,
            amount: Number(item.amount)
          }))
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save LOE');

      await fetchLoes();
      
      setEditingId(null);
      setFormData({ company_id: '', status: 'Draft', type: 'Standard', start_date: '', loe_items: [] });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={styles.pageContainer}>
      <Navbar />
      <div style={styles.container}>
        
        {canEdit && (
          <div style={styles.formSection}>
            <h2>{editingId ? 'Edit LOE' : 'Create New LOE'}</h2>
            {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
            
            <form onSubmit={handleSubmit} style={styles.form}>
              <input type="number" name="company_id" value={formData.company_id} onChange={handleChange} placeholder="Company ID" required style={styles.input} />
              
              <select name="status" value={formData.status} onChange={handleChange} style={styles.input}>
                <option value="Draft">Draft</option>
                <option value="Approval Pending">Approval Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>

              <input type="text" name="type" value={formData.type} onChange={handleChange} placeholder="LOE Type" required style={styles.input} />
              <input type="date" name="start_date" value={formData.start_date} onChange={handleChange} required style={styles.input} />

              <div style={styles.itemsWrapper}>
                <h3 style={{ fontSize: '16px', margin: '10px 0' }}>Services & Scope</h3>
                {formData.loe_items.map((item, index) => (
                  <div key={index} style={styles.itemRow}>
                    <select 
                      value={item.service_id} 
                      onChange={(e) => handleItemChange(index, 'service_id', e.target.value)}
                      style={styles.itemSelect} required
                    >
                      <option value="" disabled>Select Service</option>
                      {services.map(srv => (
                        <option key={srv.service_id} value={srv.service_id}>{srv.name || `Service ID: ${srv.service_id}`}</option>
                      ))}
                    </select>
                    
                    <input type="text" placeholder="Typed Scope" value={item.custom_scope || ''} onChange={(e) => handleItemChange(index, 'custom_scope', e.target.value)} style={styles.itemInput} required />
                    <input type="number" placeholder="Amount ($)" value={item.amount || ''} onChange={(e) => handleItemChange(index, 'amount', e.target.value)} style={styles.itemInput} required />
                    <button type="button" onClick={() => removeServiceRow(index)} style={styles.removeBtn}>X</button>
                  </div>
                ))}
                <button type="button" onClick={addServiceRow} style={styles.addBtn}>+ Add Service</button>
              </div>

              <div style={styles.buttonGroup}>
                <button type="submit" style={styles.button}>{editingId ? 'Update LOE' : 'Create LOE'}</button>
                {editingId && (
                  <button type="button" onClick={() => { setEditingId(null); setFormData({ company_id: '', status: 'Draft', type: 'Standard', start_date: '', loe_items: [] }); }} style={styles.cancelButton}>Cancel</button>
                )}
              </div>
            </form>
          </div>
        )}

        <div style={styles.listSection}>
          <h2>Available Letters of Engagement</h2>
          {loes.length === 0 ? <p>No LOEs found.</p> : (
            <div style={styles.grid}>
              {loes.map((loe) => (
                <div key={loe.loe_id} style={styles.card}>
                  <p><strong>LOE ID:</strong> {loe.loe_id}</p>
                  <p><strong>Company ID:</strong> {loe.company_id}</p>
                  <p><strong>Status:</strong> {loe.status}</p>
                  <p><strong>Services Included:</strong> {loe.loe_items?.length || 0}</p>
                  
                  {canEdit && (
                    <button onClick={() => handleEdit(loe)} style={styles.editButton}>Edit</button>
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
  itemsWrapper: { padding: '15px', background: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '4px' },
  itemRow: { display: 'flex', gap: '10px', marginBottom: '10px' },
  itemSelect: { flex: '1', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' },
  itemInput: { flex: '1', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' },
  removeBtn: { padding: '8px 12px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  addBtn: { width: '100%', padding: '8px', background: '#e9ecef', color: '#333', border: '1px dashed #ccc', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  buttonGroup: { display: 'flex', gap: '10px', marginTop: '10px' },
  button: { flex: '1', padding: '10px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  cancelButton: { flex: '1', padding: '10px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px', marginTop: '15px' },
  card: { background: '#fff', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
  editButton: { marginTop: '10px', padding: '5px 15px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }
};
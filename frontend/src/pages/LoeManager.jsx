import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';

export default function LoeManager() {
  const [loes, setLoes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [services, setServices] = useState([]);
  const [companies, setCompanies] = useState([]);
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
    fetchDepartments();
    fetchServices();
    fetchCompanies();
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

  const fetchDepartments = async () => {
    try {
      const response = await fetch('https://task-management-system-6ifq.onrender.com/api/auth/departments');
      const data = await response.json();
      if (response.ok && Array.isArray(data)) setDepartments(data);
    } catch (err) {
      console.error('Failed to load departments', err);
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

  const fetchCompanies = async () => {
    try {
      if (!token) return;
      const response = await fetch('https://task-management-system-6ifq.onrender.com/api/companies', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setCompanies(Array.isArray(data) ? data : data.companies || []);
      }
    } catch (err) {
      console.error('Failed to load companies', err);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const addServiceRow = () => {
    setFormData(prev => ({
      ...prev,
      loe_items: [
        ...prev.loe_items, 
        { department_id: '', service_id: '', custom_scope: '', amount: '' }
      ]
    }));
  };

  const removeServiceRow = (index) => {
    setFormData(prev => {
      const newItems = [...prev.loe_items];
      newItems.splice(index, 1);
      return { ...prev, loe_items: newItems };
    });
  };

  const handleDepartmentChange = (index, deptId) => {
    setFormData(prev => {
      const newItems = [...prev.loe_items];
      newItems[index] = {
        ...newItems[index],
        department_id: deptId,
        service_id: '' // Reset the service when the department switches
      };
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
    
    // Map items to include their department_id for proper dropdown selection
    const mappedItems = (loe.loe_items || []).map(item => {
      const matchedSrv = services.find(s => s.service_id === item.service_id);
      return {
        ...item,
        department_id: item.department_id || (matchedSrv ? matchedSrv.department_id : '')
      };
    });

    setFormData({
      company_id: loe.company_id,
      status: loe.status,
      type: loe.type,
      start_date: loe.start_date ? loe.start_date.split('T')[0] : '',
      loe_items: mappedItems 
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

  const getCompanyName = (companyId) => {
    const found = companies.find(c => c.company_id === companyId);
    return found ? (found.name || found.company_name) : `Company ID: ${companyId}`;
  };

  return (
    <div style={styles.pageContainer}>
      <Navbar />
      <div style={styles.container}>
        
        {/* Only render the form section if the user is an Admin or Manager */}
        {canEdit && (
          <div style={styles.formSection}>
            <h2>{editingId ? 'Edit LOE' : 'Create New LOE'}</h2>
            {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
            
            <form onSubmit={handleSubmit} style={styles.form}>
              <select 
                name="company_id" 
                value={formData.company_id} 
                onChange={handleChange} 
                required 
                style={styles.input}
              >
                <option value="" disabled>Select Company</option>
                {companies.map((comp) => (
                  <option key={comp.company_id} value={comp.company_id}>
                    {comp.name || comp.company_name || `Company #${comp.company_id}`}
                  </option>
                ))}
              </select>

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
                {formData.loe_items.map((item, index) => {
                  const departmentServices = services.filter(
                    srv => srv.department_id === Number(item.department_id)
                  );

                  return (
                    <div key={index} style={styles.itemRow}>
                      {/* Step 1: Department Selection */}
                      <select 
                        value={item.department_id || ''} 
                        onChange={(e) => handleDepartmentChange(index, e.target.value)}
                        style={styles.itemSelect} 
                        required
                      >
                        <option value="" disabled>Select Department</option>
                        {departments.map(dept => (
                          <option key={dept.department_id} value={dept.department_id}>
                            {dept.name}
                          </option>
                        ))}
                      </select>

                      {/* Step 2: Department-specific Services */}
                      <select 
                        value={item.service_id || ''} 
                        onChange={(e) => handleItemChange(index, 'service_id', e.target.value)}
                        style={styles.itemSelect} 
                        disabled={!item.department_id}
                        required
                      >
                        <option value="" disabled>
                          {!item.department_id 
                            ? 'Select Department First' 
                            : departmentServices.length === 0 
                              ? 'No services available' 
                              : 'Select Service'}
                        </option>
                        {departmentServices.map(srv => (
                          <option key={srv.service_id} value={srv.service_id}>
                            {srv.name}
                          </option>
                        ))}
                      </select>
                      
                      <input 
                        type="text" 
                        placeholder="Typed Scope" 
                        value={item.custom_scope || ''} 
                        onChange={(e) => handleItemChange(index, 'custom_scope', e.target.value)} 
                        style={styles.itemInput} 
                        required 
                      />
                      
                      <input 
                        type="number" 
                        placeholder="Amount ($)" 
                        value={item.amount || ''} 
                        onChange={(e) => handleItemChange(index, 'amount', e.target.value)} 
                        style={styles.itemAmountInput} 
                        required 
                      />
                      
                      <button type="button" onClick={() => removeServiceRow(index)} style={styles.removeBtn}>X</button>
                    </div>
                  );
                })}
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
                  <p><strong>Company:</strong> {getCompanyName(loe.company_id)}</p>
                  <p><strong>Status:</strong> {loe.status}</p>
                  <p><strong>Services Included:</strong> {loe.loe_items?.length || 0}</p>
                  
                  {/* Only render the edit button if the user is an Admin or Manager */}
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
  formSection: { flex: '1.2', background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', height: 'fit-content' },
  listSection: { flex: '1.8' },
  form: { display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' },
  input: { padding: '10px', borderRadius: '4px', border: '1px solid #ccc' },
  itemsWrapper: { padding: '15px', background: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '4px' },
  itemRow: { display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'center' },
  itemSelect: { flex: '1', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' },
  itemInput: { flex: '1.2', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' },
  itemAmountInput: { width: '90px', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' },
  removeBtn: { padding: '8px 12px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  addBtn: { width: '100%', padding: '8px', background: '#e9ecef', color: '#333', border: '1px dashed #ccc', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  buttonGroup: { display: 'flex', gap: '10px', marginTop: '10px' },
  button: { flex: '1', padding: '10px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  cancelButton: { flex: '1', padding: '10px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px', marginTop: '15px' },
  card: { background: '#fff', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
  editButton: { marginTop: '10px', padding: '5px 15px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }
};
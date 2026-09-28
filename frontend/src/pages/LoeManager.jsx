import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';

export default function LoeManager() {
  const [loes, setLoes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [services, setServices] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [downloadingId, setDownloadingId] = useState(null);
  const [formData, setFormData] = useState({
    company_id: '',
    type: 'Standard',
    start_date: '',
    loe_items: [] 
  });
  const [editingId, setEditingId] = useState(null);
  const [editingPreviousStatus, setEditingPreviousStatus] = useState(null);
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
        { department_id: '', service_id: '', amount: '' }
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
        service_id: ''
      };
      return { ...prev, loe_items: newItems };
    });
  };

  const handleServiceChange = (index, serviceId) => {
    setFormData(prev => {
      const newItems = [...prev.loe_items];
      newItems[index] = {
        ...newItems[index],
        service_id: serviceId
      };
      return { ...prev, loe_items: newItems };
    });
  };

  const handleAmountChange = (index, amount) => {
    setFormData(prev => {
      const newItems = [...prev.loe_items];
      newItems[index] = {
        ...newItems[index],
        amount: amount
      };
      return { ...prev, loe_items: newItems };
    });
  };

  const handleEdit = (loe) => {
    setEditingId(loe.loe_id);
    setEditingPreviousStatus(loe.status);

    const mappedItems = (loe.loe_items || []).map(item => {
      const matchedSrv = services.find(s => s.service_id === item.service_id);
      return {
        department_id: matchedSrv ? matchedSrv.department_id : '',
        service_id: item.service_id,
        amount: item.amount
      };
    });

    setFormData({
      company_id: loe.company_id,
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

    // Map each service item and extract its scope directly from the predefined service
    const preparedItems = formData.loe_items.map(item => {
      const matchedSrv = services.find(s => s.service_id === Number(item.service_id));
      return {
        service_id: Number(item.service_id),
        custom_scope: matchedSrv?.scope || matchedSrv?.name || 'Standard Service Scope',
        amount: Number(item.amount)
      };
    });

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          company_id: Number(formData.company_id),
          created_by: user.emp_id || 2, 
          type: formData.type,
          start_date: formData.start_date,
          status: 'Approval Pending', // Automatically send new and edited LOEs for approval
          loe_items: preparedItems
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save LOE');

      await fetchLoes();
      
      setEditingId(null);
      setEditingPreviousStatus(null);
      setFormData({ company_id: '', type: 'Standard', start_date: '', loe_items: [] });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDownloadPdf = async (loeId) => {
    try {
      setDownloadingId(loeId);
      setError('');

      const response = await fetch(`https://task-management-system-6ifq.onrender.com/api/loes/${loeId}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate PDF document');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `LOE-${loeId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setError(err.message || 'Error generating PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  const getCompanyName = (companyId) => {
    const found = companies.find(c => c.company_id === companyId);
    return found ? (found.name || found.company_name) : `Company ID: ${companyId}`;
  };

  const getStatusBadgeStyle = (status) => {
    if (status === 'Approved') return { background: '#28a745', color: '#fff' };
    if (status === 'Rejected') return { background: '#dc3545', color: '#fff' };
    if (status === 'Approval Pending') return { background: '#ffc107', color: '#000' };
    return { background: '#6c757d', color: '#fff' };
  };

  return (
    <div style={styles.pageContainer}>
      <Navbar />
      <div style={styles.container}>
        
        {/* Create / Edit LOE Form */}
        {canEdit && (
          <div style={styles.formSection}>
            <h2>{editingId ? `Edit LOE #${editingId}` : 'Create New LOE'}</h2>
            
            {editingId && editingPreviousStatus === 'Rejected' && (
              <div style={styles.resubmitNotice}>
                ⚠️ This LOE was previously <strong>Rejected</strong>. Saving revisions will resubmit it for approval.
              </div>
            )}

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

              <input 
                type="text" 
                name="type" 
                value={formData.type} 
                onChange={handleChange} 
                placeholder="LOE Type (e.g. Standard, Retainer)" 
                required 
                style={styles.input} 
              />

              <input 
                type="date" 
                name="start_date" 
                value={formData.start_date} 
                onChange={handleChange} 
                required 
                style={styles.input} 
              />

              <div style={styles.itemsWrapper}>
                <h3 style={{ fontSize: '15px', margin: '0 0 10px 0' }}>Services &amp; Pricing</h3>
                
                {formData.loe_items.map((item, index) => {
                  const departmentServices = services.filter(
                    srv => srv.department_id === Number(item.department_id)
                  );
                  const selectedSrv = services.find(s => s.service_id === Number(item.service_id));

                  return (
                    <div key={index} style={styles.itemContainer}>
                      <div style={styles.itemRow}>
                        {/* Step 1: Department */}
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

                        {/* Step 2: Service */}
                        <select 
                          value={item.service_id || ''} 
                          onChange={(e) => handleServiceChange(index, e.target.value)}
                          style={styles.itemSelect} 
                          disabled={!item.department_id}
                          required
                        >
                          <option value="" disabled>
                            {!item.department_id 
                              ? 'Select Dept First' 
                              : departmentServices.length === 0 
                                ? 'No services found' 
                                : 'Select Service'}
                          </option>
                          {departmentServices.map(srv => (
                            <option key={srv.service_id} value={srv.service_id}>
                              {srv.name}
                            </option>
                          ))}
                        </select>
                        
                        {/* Step 3: Fee */}
                        <input 
                          type="number" 
                          placeholder="Amount ($)" 
                          value={item.amount || ''} 
                          onChange={(e) => handleAmountChange(index, e.target.value)} 
                          style={styles.itemAmountInput} 
                          required 
                        />
                        
                        <button type="button" onClick={() => removeServiceRow(index)} style={styles.removeBtn}>X</button>
                      </div>

                      {/* Display the service's predefined scope automatically */}
                      {selectedSrv && (
                        <div style={styles.scopePreview}>
                          <strong>Includes:</strong> {selectedSrv.scope || 'Standard service deliverables.'}
                        </div>
                      )}
                    </div>
                  );
                })}

                <button type="button" onClick={addServiceRow} style={styles.addBtn}>+ Add Service</button>
              </div>

              <div style={styles.buttonGroup}>
                <button type="submit" style={styles.button}>
                  {editingId ? 'Resubmit for Approval' : 'Submit for Approval'}
                </button>
                {editingId && (
                  <button 
                    type="button" 
                    onClick={() => { 
                      setEditingId(null); 
                      setEditingPreviousStatus(null);
                      setFormData({ company_id: '', type: 'Standard', start_date: '', loe_items: [] }); 
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

        {/* Existing LOEs List */}
        <div style={styles.listSection}>
          <h2>Available Letters of Engagement</h2>
          {loes.length === 0 ? <p>No LOEs found.</p> : (
            <div style={styles.grid}>
              {loes.map((loe) => {
                const badgeStyle = getStatusBadgeStyle(loe.status);

                return (
                  <div key={loe.loe_id} style={styles.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: '17px' }}>LOE ID: {loe.loe_id}</h3>
                      <span style={{ ...styles.badge, ...badgeStyle }}>{loe.status}</span>
                    </div>

                    <p style={{ marginTop: '8px', marginBottom: '4px' }}><strong>Company:</strong> {getCompanyName(loe.company_id)}</p>
                    <p style={{ margin: '4px 0' }}><strong>Services Included:</strong> {loe.loe_items?.length || 0}</p>
                    
                    {/* Rejection message box */}
                    {loe.status === 'Rejected' && (
                      <div style={styles.rejectedBanner}>
                        This LOE was rejected by management. Click <strong>Edit</strong> to revise and resubmit.
                      </div>
                    )}

                    <div style={styles.cardActions}>
                      {canEdit && (
                        <button onClick={() => handleEdit(loe)} style={styles.editButton}>
                          {loe.status === 'Rejected' ? 'Edit & Resubmit' : 'Edit'}
                        </button>
                      )}
                      <button 
                        onClick={() => handleDownloadPdf(loe.loe_id)} 
                        disabled={downloadingId === loe.loe_id}
                        style={styles.downloadButton}
                      >
                        {downloadingId === loe.loe_id ? 'Generating...' : 'Download PDF'}
                      </button>
                    </div>
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
  formSection: { flex: '1.2', background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', height: 'fit-content' },
  listSection: { flex: '1.8' },
  form: { display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' },
  input: { padding: '10px', borderRadius: '4px', border: '1px solid #ccc' },
  itemsWrapper: { padding: '15px', background: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '4px' },
  itemContainer: { marginBottom: '12px', background: '#fff', padding: '8px', borderRadius: '4px', border: '1px solid #eee' },
  itemRow: { display: 'flex', gap: '8px', alignItems: 'center' },
  itemSelect: { flex: '1', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' },
  itemAmountInput: { width: '100px', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' },
  removeBtn: { padding: '8px 12px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  scopePreview: { fontSize: '12px', color: '#495057', marginTop: '6px', padding: '4px 6px', background: '#eef2f6', borderRadius: '3px' },
  addBtn: { width: '100%', padding: '8px', background: '#e9ecef', color: '#333', border: '1px dashed #ccc', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginTop: '6px' },
  buttonGroup: { display: 'flex', gap: '10px', marginTop: '10px' },
  button: { flex: '1', padding: '10px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  cancelButton: { flex: '1', padding: '10px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  resubmitNotice: { padding: '10px', background: '#fff3cd', border: '1px solid #ffeeba', color: '#856404', borderRadius: '4px', marginTop: '10px', fontSize: '13px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px', marginTop: '15px' },
  card: { background: '#fff', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
  badge: { padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' },
  rejectedBanner: { marginTop: '10px', padding: '8px', background: '#ffeef0', color: '#dc3545', borderRadius: '4px', fontSize: '12px', border: '1px solid #f5c6cb' },
  cardActions: { display: 'flex', gap: '8px', marginTop: '14px' },
  editButton: { flex: '1', padding: '6px 12px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  downloadButton: { flex: '1.3', padding: '6px 12px', background: '#17a2b8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }
};
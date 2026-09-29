import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';

export default function LoeManager() {
  const [loes, setLoes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [services, setServices] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [downloadingId, setDownloadingId] = useState(null);
  
  // loe_services holds each chosen service and its list of selected/custom scopes
  const [formData, setFormData] = useState({
    company_id: '',
    type: 'Standard',
    start_date: '',
    loe_services: [] 
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

  // Add a new Service Card
  const addServiceCard = () => {
    setFormData(prev => ({
      ...prev,
      loe_services: [
        ...prev.loe_services, 
        { 
          department_id: '', 
          service_id: '', 
          selectedScopeChoice: '', 
          scopes: [] 
        }
      ]
    }));
  };

  const removeServiceCard = (serviceIndex) => {
    setFormData(prev => {
      const updated = [...prev.loe_services];
      updated.splice(serviceIndex, 1);
      return { ...prev, loe_services: updated };
    });
  };

  const handleDepartmentChange = (serviceIndex, deptId) => {
    setFormData(prev => {
      const updated = [...prev.loe_services];
      updated[serviceIndex] = {
        ...updated[serviceIndex],
        department_id: deptId,
        service_id: '',
        selectedScopeChoice: '',
        scopes: []
      };
      return { ...prev, loe_services: updated };
    });
  };

  const handleServiceChange = (serviceIndex, serviceId) => {
    setFormData(prev => {
      const updated = [...prev.loe_services];
      updated[serviceIndex] = {
        ...updated[serviceIndex],
        service_id: serviceId,
        selectedScopeChoice: '',
        scopes: []
      };
      return { ...prev, loe_services: updated };
    });
  };

  // Add selected scope from the dropdown into this service's scope list
  const addSelectedScope = (serviceIndex) => {
    const serviceBlock = formData.loe_services[serviceIndex];
    if (!serviceBlock.selectedScopeChoice) return;

    setFormData(prev => {
      const updated = [...prev.loe_services];
      updated[serviceIndex] = {
        ...serviceBlock,
        scopes: [...serviceBlock.scopes, serviceBlock.selectedScopeChoice],
        selectedScopeChoice: ''
      };
      return { ...prev, loe_services: updated };
    });
  };

  // Add a blank custom scope for editing
  const addCustomScope = (serviceIndex) => {
    setFormData(prev => {
      const updated = [...prev.loe_services];
      const serviceBlock = updated[serviceIndex];
      updated[serviceIndex] = {
        ...serviceBlock,
        scopes: [...serviceBlock.scopes, '']
      };
      return { ...prev, loe_services: updated };
    });
  };

  // Edit an existing scope's text/remarks
  const handleScopeTextChange = (serviceIndex, scopeIndex, text) => {
    setFormData(prev => {
      const updated = [...prev.loe_services];
      const serviceBlock = updated[serviceIndex];
      const updatedScopes = [...serviceBlock.scopes];
      updatedScopes[scopeIndex] = text;
      updated[serviceIndex] = { ...serviceBlock, scopes: updatedScopes };
      return { ...prev, loe_services: updated };
    });
  };

  // Remove a scope item
  const removeScopeItem = (serviceIndex, scopeIndex) => {
    setFormData(prev => {
      const updated = [...prev.loe_services];
      const serviceBlock = updated[serviceIndex];
      const updatedScopes = [...serviceBlock.scopes];
      updatedScopes.splice(scopeIndex, 1);
      updated[serviceIndex] = { ...serviceBlock, scopes: updatedScopes };
      return { ...prev, loe_services: updated };
    });
  };

  const handleEdit = (loe) => {
    setEditingId(loe.loe_id);
    setEditingPreviousStatus(loe.status);

    // Group flat loe_items by service_id
    const grouped = [];
    const map = new Map();

    (loe.loe_items || []).forEach(item => {
      const sId = item.service_id;
      if (!map.has(sId)) {
        const matched = services.find(s => s.service_id === sId);
        const newBlock = {
          department_id: matched ? matched.department_id : '',
          service_id: sId,
          selectedScopeChoice: '',
          scopes: []
        };
        map.set(sId, newBlock);
        grouped.push(newBlock);
      }
      if (item.custom_scope) {
        map.get(sId).scopes.push(item.custom_scope);
      }
    });

    setFormData({
      company_id: loe.company_id,
      type: loe.type,
      start_date: loe.start_date ? loe.start_date.split('T')[0] : '',
      loe_services: grouped
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const url = editingId 
      ? `https://task-management-system-6ifq.onrender.com/api/loes/${editingId}`
      : 'https://task-management-system-6ifq.onrender.com/api/loes';
      
    const method = editingId ? 'PUT' : 'POST';

    // Flatten services and their unlimited scopes into individual loe_items
    const flattenedItems = [];
    formData.loe_services.forEach(srvBlock => {
      if (!srvBlock.service_id) return;

      const validScopes = srvBlock.scopes.filter(s => s.trim().length > 0);

      if (validScopes.length === 0) {
        flattenedItems.push({
          service_id: Number(srvBlock.service_id),
          custom_scope: 'Standard Service Scope',
          amount: 0
        });
      } else {
        validScopes.forEach(sc => {
          flattenedItems.push({
            service_id: Number(srvBlock.service_id),
            custom_scope: sc,
            amount: 0
          });
        });
      }
    });

    if (flattenedItems.length === 0) {
      setError('Please add at least one service with a scope.');
      return;
    }

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
          status: 'Approval Pending',
          loe_items: flattenedItems
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save LOE');

      await fetchLoes();
      
      setEditingId(null);
      setEditingPreviousStatus(null);
      setFormData({ company_id: '', type: 'Standard', start_date: '', loe_services: [] });
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
        
        {/* LOE Builder Form */}
        {canEdit && (
          <div style={styles.formSection}>
            <h2>{editingId ? `Edit LOE #${editingId}` : 'Create New LOE'}</h2>
            
            {editingId && editingPreviousStatus === 'Rejected' && (
              <div style={styles.resubmitNotice}>
                ⚠️ This LOE was <strong>Rejected</strong>. Saving changes will resubmit it for Approval Pending.
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

              {/* Service & Scopes Section */}
              <div style={styles.itemsWrapper}>
                <h3 style={{ fontSize: '15px', margin: '0 0 10px 0' }}>Services &amp; Scope Requirements</h3>
                
                {formData.loe_services.map((srvBlock, srvIdx) => {
                  const departmentServices = services.filter(
                    srv => srv.department_id === Number(srvBlock.department_id)
                  );
                  const selectedService = services.find(
                    srv => srv.service_id === Number(srvBlock.service_id)
                  );
                  const templateScopes = selectedService ? parseScopes(selectedService.scope) : [];

                  return (
                    <div key={srvIdx} style={styles.serviceCard}>
                      
                      {/* Top Row: Department and Service Selection */}
                      <div style={styles.topSelectRow}>
                        <select 
                          value={srvBlock.department_id || ''} 
                          onChange={(e) => handleDepartmentChange(srvIdx, e.target.value)}
                          style={styles.dropdownInput} 
                          required
                        >
                          <option value="" disabled>Select Department</option>
                          {departments.map(dept => (
                            <option key={dept.department_id} value={dept.department_id}>
                              {dept.name}
                            </option>
                          ))}
                        </select>

                        <select 
                          value={srvBlock.service_id || ''} 
                          onChange={(e) => handleServiceChange(srvIdx, e.target.value)}
                          style={styles.dropdownInput} 
                          disabled={!srvBlock.department_id}
                          required
                        >
                          <option value="" disabled>
                            {!srvBlock.department_id 
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

                        <button 
                          type="button" 
                          onClick={() => removeServiceCard(srvIdx)} 
                          style={styles.removeServiceBtn}
                          title="Remove Service"
                        >
                          X
                        </button>
                      </div>

                      {/* Middle: Scope Selector + Dropdown matching sketch */}
                      {selectedService && (
                        <div style={styles.scopeSelectionSection}>
                          <div style={styles.scopeToolbar}>
                            <select
                              value={srvBlock.selectedScopeChoice || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFormData(prev => {
                                  const updated = [...prev.loe_services];
                                  updated[srvIdx].selectedScopeChoice = val;
                                  return { ...prev, loe_services: updated };
                                });
                              }}
                              style={styles.dropdownInput}
                            >
                              <option value="" disabled>Select Scope Template...</option>
                              {templateScopes.map((sc, i) => (
                                <option key={i} value={sc}>
                                  {sc}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => addSelectedScope(srvIdx)}
                              disabled={!srvBlock.selectedScopeChoice}
                              style={styles.addScopeBtn}
                            >
                              + Add Selected Scope
                            </button>

                            <button
                              type="button"
                              onClick={() => addCustomScope(srvIdx)}
                              style={styles.addCustomBtn}
                            >
                              + Custom Scope
                            </button>
                          </div>

                          {/* Bottom: Unlimited Editable Scope Items */}
                          <div style={styles.scopeListContainer}>
                            {srvBlock.scopes.length === 0 ? (
                              <p style={styles.emptyNotice}>
                                No scopes added yet. Select a scope from the dropdown above or click "+ Custom Scope".
                              </p>
                            ) : (
                              srvBlock.scopes.map((scopeText, scIdx) => (
                                <div key={scIdx} style={styles.scopeItemRow}>
                                  <span style={styles.scopeIndexBadge}>{scIdx + 1}</span>
                                  <textarea
                                    rows="2"
                                    placeholder="Enter or customize scope details / remarks for this engagement..."
                                    value={scopeText}
                                    onChange={(e) => handleScopeTextChange(srvIdx, scIdx, e.target.value)}
                                    style={styles.scopeTextarea}
                                    required
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeScopeItem(srvIdx, scIdx)}
                                    style={styles.removeScopeBtn}
                                    title="Delete scope"
                                  >
                                    X
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                <button type="button" onClick={addServiceCard} style={styles.addCardBtn}>
                  + Add Service
                </button>
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
                      setFormData({ company_id: '', type: 'Standard', start_date: '', loe_services: [] }); 
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
                    
                    {loe.status === 'Rejected' && (
                      <div style={styles.rejectedBanner}>
                        This LOE was rejected by management. Click <strong>Edit &amp; Resubmit</strong> to make changes.
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
  formSection: { flex: '1.3', background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', height: 'fit-content' },
  listSection: { flex: '1.7' },
  form: { display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' },
  input: { padding: '10px', borderRadius: '4px', border: '1px solid #ccc' },
  itemsWrapper: { padding: '15px', background: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '4px' },
  serviceCard: { background: '#fff', border: '1px solid #ddd', borderRadius: '6px', padding: '14px', marginBottom: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  topSelectRow: { display: 'flex', gap: '8px', alignItems: 'center' },
  dropdownInput: { flex: '1', padding: '8px 10px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' },
  removeServiceBtn: { padding: '8px 12px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  scopeSelectionSection: { marginTop: '12px', borderTop: '1px dashed #e2e8f0', paddingTop: '10px' },
  scopeToolbar: { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' },
  addScopeBtn: { padding: '8px 12px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
  addCustomBtn: { padding: '8px 12px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
  scopeListContainer: { display: 'flex', flexDirection: 'column', gap: '8px' },
  scopeItemRow: { display: 'flex', gap: '8px', alignItems: 'flex-start', background: '#f8fafc', padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0' },
  scopeIndexBadge: { background: '#cbd5e1', color: '#334155', fontWeight: 'bold', fontSize: '11px', padding: '4px 8px', borderRadius: '3px', marginTop: '4px' },
  scopeTextarea: { flex: '1', padding: '6px 8px', borderRadius: '4px', border: '1px solid #ccc', fontFamily: 'inherit', fontSize: '13px', resize: 'vertical' },
  removeScopeBtn: { padding: '4px 8px', background: '#e2e8f0', color: '#dc3545', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginTop: '4px' },
  emptyNotice: { margin: 0, fontSize: '12px', color: '#64748b', fontStyle: 'italic', padding: '6px' },
  addCardBtn: { width: '100%', padding: '10px', background: '#e9ecef', color: '#333', border: '1px dashed #adb5bd', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
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
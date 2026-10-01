import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';

export default function TaskAllocation() {
  const [tasks, setTasks] = useState([]);
  const [loes, setLoes] = useState([]);
  const [employees, setEmployees] = useState([]);
  
  const [groupedServices, setGroupedServices] = useState([]);
  const [selectedServiceGroup, setSelectedServiceGroup] = useState(null);
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [error, setError] = useState('');
  const [validationWarning, setValidationWarning] = useState('');
  const [saving, setSaving] = useState(false);

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : null;
  const userDeptId = user?.department_id || 1;
  
  // Role Access Flags
  const isAdmin = user?.role === 'ADMIN';
  const isManager = user?.role === 'MANAGER';
  const isEmployee = !isAdmin && !isManager; 

  const [serviceDeadline, setServiceDeadline] = useState('');
  const [formScopes, setFormScopes] = useState([]);

  const [newTaskForm, setNewTaskForm] = useState({
    loe_id: '',
    department_id: isAdmin ? '' : userDeptId,
    service_id: '',
    scope: '',
    assignee_ids: [],
    status: 'Pending'
  });

  useEffect(() => {
    fetchTasks();
    if (!isEmployee) fetchLoes();
    fetchEmployees();
  }, []);

  useEffect(() => {
    const groupsMap = new Map();
    tasks.forEach(t => {
      const key = `${t.job_id}-${t.service_id}`;
      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          key,
          job_id: t.job_id,
          service_id: t.service_id,
          service: t.service,
          job: t.job,
          scopes: []
        });
      }
      groupsMap.get(key).scopes.push(t);
    });
    setGroupedServices(Array.from(groupsMap.values()));
  }, [tasks]);

  const fetchTasks = async () => {
    try {
      let url = `https://task-management-system-6ifq.onrender.com/api/tasks?emp_id=${user?.emp_id}&role=EMPLOYEE`;
      if (isAdmin) {
        url = `https://task-management-system-6ifq.onrender.com/api/tasks?role=ADMIN`;
      } else if (isManager) {
        url = `https://task-management-system-6ifq.onrender.com/api/tasks?department_id=${userDeptId}&role=MANAGER`;
      }

      const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await response.json();
      if (response.ok) setTasks(Array.isArray(data) ? data : []);
    } catch (err) { setError('Failed to load tasks'); }
  };

  const fetchLoes = async () => {
    try {
      const response = await fetch('https://task-management-system-6ifq.onrender.com/api/loes', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await response.json();
      if (response.ok) setLoes(Array.isArray(data) ? data : []);
    } catch (err) {}
  };

  const fetchEmployees = async () => {
    try {
      const url = isAdmin ? 'https://task-management-system-6ifq.onrender.com/api/employees' : `https://task-management-system-6ifq.onrender.com/api/employees?department_id=${userDeptId}`;
      const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await response.json();
      if (response.ok) setEmployees(Array.isArray(data) ? data : []);
    } catch (err) {}
  };

  const handleRowClick = (group) => {
    setSelectedServiceGroup(group);
    
    const existingDeadline = group.scopes.find(s => s.service_deadline)?.service_deadline;
    setServiceDeadline(existingDeadline ? existingDeadline.split('T')[0] : '');

    setFormScopes(group.scopes.map(s => ({
      task_id: s.task_id,
      scope: s.scope,
      status: s.status,
      duration_days: s.duration_days || '',
      calculated_deadline: s.deadline || null,
      assignee_ids: s.assignees ? s.assignees.map(a => a.emp_id) : []
    })));
    setValidationWarning('');
  };

  useEffect(() => {
    if (!selectedServiceGroup || !serviceDeadline) return;

    const today = new Date();
    today.setHours(0,0,0,0);
    
    let currentStart = new Date(today);
    let totalExceeds = false;
    const finalDeadline = new Date(serviceDeadline);
    finalDeadline.setHours(0,0,0,0);

    const validated = formScopes.map(sc => {
      if (sc.duration_days && Number(sc.duration_days) > 0) {
        let endDate = new Date(currentStart);
        endDate.setDate(endDate.getDate() + Number(sc.duration_days));
        currentStart = new Date(endDate); 

        if (endDate > finalDeadline) totalExceeds = true;
        return { ...sc, calculated_deadline: endDate.toISOString() };
      }
      return { ...sc, calculated_deadline: null };
    });

    if (JSON.stringify(validated) !== JSON.stringify(formScopes)) {
      setFormScopes(validated);
    }
    
    if (totalExceeds) {
      setValidationWarning('⚠️ Cumulative scope days exceed the main Service Deadline! Please adjust the durations or the final deadline.');
    } else {
      setValidationWarning('');
    }
  }, [formScopes.map(s => s.duration_days).join(','), serviceDeadline]);

  const toggleAssignee = (index, empId) => {
    if (isEmployee) return; 
    setFormScopes(prev => {
      const updated = [...prev];
      const currentIds = updated[index].assignee_ids;
      if (currentIds.includes(empId)) {
        updated[index].assignee_ids = currentIds.filter(id => id !== empId);
      } else {
        updated[index].assignee_ids = [...currentIds, empId];
      }
      return updated;
    });
  };

  const handleSaveAllocation = async (e) => {
    e.preventDefault();
    if (validationWarning && !isEmployee) return alert('Please fix validation warnings before saving.');
    setSaving(true);
    setError('');

    try {
      await Promise.all(formScopes.map(sc => 
        fetch(`https://task-management-system-6ifq.onrender.com/api/tasks/${sc.task_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            assignee_ids: sc.assignee_ids,
            duration_days: sc.duration_days ? Number(sc.duration_days) : null,
            deadline: sc.calculated_deadline,
            service_deadline: serviceDeadline || null,
            status: sc.status
          })
        }).then(res => {
          if (!res.ok) throw new Error('Failed to update scope');
        })
      ));

      await fetchTasks();
      setSelectedServiceGroup(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await fetch('https://task-management-system-6ifq.onrender.com/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          loe_id: Number(newTaskForm.loe_id),
          service_id: Number(newTaskForm.service_id),
          scope: newTaskForm.scope,
          assignee_ids: newTaskForm.assignee_ids,
          status: newTaskForm.status
        })
      });
      if (!response.ok) throw new Error('Failed to create task');
      await fetchTasks();
      setIsCreateOpen(false);
      setNewTaskForm({ loe_id: '', department_id: isAdmin ? '' : userDeptId, service_id: '', scope: '', assignee_ids: [], status: 'Pending' });
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const selectedLoeObj = loes.find(l => l.loe_id === Number(newTaskForm.loe_id));
  const availableServicesInLoe = selectedLoeObj ? selectedLoeObj.loe_items.map(i => i.service).filter(Boolean) : [];
  const availableDepartmentsInLoe = [];
  const deptIds = new Set();
  availableServicesInLoe.forEach(srv => {
    if (srv.department && !deptIds.has(srv.department.department_id)) {
      deptIds.add(srv.department.department_id);
      availableDepartmentsInLoe.push(srv.department);
    }
  });

  const createModalServices = availableServicesInLoe.filter(srv => !newTaskForm.department_id || srv.department_id === Number(newTaskForm.department_id));
  const editModalEmployees = employees.filter(emp => isAdmin || emp.department_id === selectedServiceGroup?.service?.department_id);

  const getStatusBadgeStyle = (status) => {
    if (status === 'Completed') return { background: '#28a745', color: '#fff' };
    if (status === 'In-Progress') return { background: '#007bff', color: '#fff' };
    return { background: '#ffc107', color: '#000' };
  };

  return (
    <div style={styles.pageContainer}>
      <Navbar />
      <div style={styles.container}>
        
        <div style={styles.headerRow}>
          <div>
            <h2 style={{ margin: 0 }}>{isEmployee ? 'My Tasks & Scopes' : 'Task Allocation & Scope Deadlines'}</h2>
            <p style={{ margin: '4px 0 0 0', color: '#6c757d', fontSize: '14px' }}>
              {isEmployee 
                ? 'Click any row to view details and update your progress status.' 
                : 'Click any Service row to assign team members and sequence scope deadlines.'}
            </p>
          </div>
          
          {!isEmployee && (
            <button onClick={() => setIsCreateOpen(true)} style={styles.createTaskBtn}>+ Create Custom Scope</button>
          )}
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        <div style={styles.tableCard}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thRow}>
                <th style={styles.th}>LOE ID</th>
                <th style={styles.th}>Department</th>
                <th style={styles.th}>Service Category</th>
                <th style={styles.th}># of Scopes</th>
                <th style={styles.th}>Assigned Staff</th>
                <th style={styles.th}>Service Deadline</th>
              </tr>
            </thead>
            <tbody>
              {groupedServices.length === 0 ? (
                <tr><td colSpan="6" style={styles.emptyCell}>No assigned tasks available.</td></tr>
              ) : (
                groupedServices.map((group) => {
                  const uniqueStaff = new Set();
                  let overallDeadline = null;
                  
                  group.scopes.forEach(sc => {
                    if (sc.service_deadline) overallDeadline = sc.service_deadline;
                    sc.assignees?.forEach(a => uniqueStaff.add(a.name.split(' ')[0]));
                  });

                  return (
                    <tr key={group.key} onClick={() => handleRowClick(group)} style={styles.tr}>
                      <td style={styles.td}><strong>#{group.job?.loe?.loe_id || 'N/A'}</strong></td>
                      <td style={styles.td}><span style={styles.deptBadge}>{group.service?.department?.name}</span></td>
                      <td style={styles.td}><strong>{group.service?.name}</strong></td>
                      <td style={styles.td}>{group.scopes.length} Scopes</td>
                      <td style={styles.td}>
                        {uniqueStaff.size > 0 ? (
                          <span style={{ fontSize: '13px' }}>👤 {Array.from(uniqueStaff).join(', ')}</span>
                        ) : (
                          <span style={{ color: '#dc3545', fontWeight: 'bold', fontSize:'12px' }}>⚠️ Unassigned</span>
                        )}
                      </td>
                      <td style={styles.td}>
                        {overallDeadline ? new Date(overallDeadline).toLocaleDateString() : <span style={{ color: '#6c757d' }}>Pending</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Modal: View & Update Grouped Service Scopes */}
        {selectedServiceGroup && (
          <div style={styles.modalOverlay} onClick={() => setSelectedServiceGroup(null)}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <h3 style={{ margin: 0 }}>Service Details: {selectedServiceGroup.service?.name}</h3>
                <button style={styles.closeBtn} onClick={() => setSelectedServiceGroup(null)}>✕</button>
              </div>

              <div style={styles.modalBody}>
                <div style={styles.loeDetailsBox}>
                  <p style={{ margin: '0 0 5px' }}><strong>Company:</strong> {selectedServiceGroup.job?.loe?.company?.name}</p>
                  <p style={{ margin: 0 }}><strong>Department:</strong> {selectedServiceGroup.service?.department?.name}</p>
                </div>

                <form onSubmit={handleSaveAllocation}>
                  {/* Master Service Deadline */}
                  <div style={{ background: '#eef2f7', padding: '14px', borderRadius: '6px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{...styles.label, fontSize: '14px', color: '#0056b3'}}>Target Deadline for Entire Service</label>
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6c757d' }}>
                        {isEmployee ? 'The final due date set by your manager.' : 'Scope completion dates cannot exceed this date.'}
                      </p>
                    </div>
                    <input
                      type="date"
                      required
                      disabled={isEmployee}
                      value={serviceDeadline}
                      onChange={(e) => setServiceDeadline(e.target.value)}
                      style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ced4da', fontSize: '14px', fontWeight: 'bold', background: isEmployee ? '#e9ecef' : '#fff' }}
                    />
                  </div>

                  {validationWarning && !isEmployee && <div style={styles.warningBanner}>{validationWarning}</div>}

                  {/* Individual Scopes Breakdown */}
                  <h4 style={{ margin: '0 0 10px 0', borderBottom: '2px solid #dee2e6', paddingBottom: '6px' }}>Breakdown &amp; Scope Assignments</h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {formScopes.map((scope, idx) => (
                      <div key={scope.task_id} style={styles.scopeAssignmentCard}>
                        <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#333', marginBottom: '10px' }}>
                          <span style={styles.numberBadge}>{idx + 1}</span> {scope.scope || 'General Delivery'}
                        </div>

                        <div style={styles.formRow}>
                          
                          {/* Hide Assigned Employees box entirely for standard Employees */}
                          {!isEmployee && (
                            <div style={{ flex: '1.5' }}>
                              <label style={styles.label}>Assigned Employees</label>
                              <div style={styles.multiSelectBox}>
                                {editModalEmployees.map(emp => (
                                  <label key={emp.emp_id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '2px 0', cursor: 'pointer' }}>
                                    <input 
                                      type="checkbox" 
                                      checked={scope.assignee_ids.includes(emp.emp_id)} 
                                      onChange={() => toggleAssignee(idx, emp.emp_id)}
                                    />
                                    {emp.name} <span style={{ color: '#888', fontSize: '11px' }}>({emp.role})</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}

                          <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div>
                              <label style={styles.label}>Duration (Days)</label>
                              <input
                                type="number"
                                min="0"
                                disabled={isEmployee}
                                value={scope.duration_days}
                                onChange={(e) => {
                                  const updated = [...formScopes];
                                  updated[idx].duration_days = e.target.value;
                                  setFormScopes(updated);
                                }}
                                placeholder={isEmployee ? "—" : "e.g., 7"}
                                style={{ ...styles.selectInput, background: isEmployee ? '#e9ecef' : '#fff' }}
                              />
                            </div>
                            <div>
                              <label style={styles.label}>End Date</label>
                              <div style={{ fontSize: '13px', padding: '8px 10px', background: '#e9ecef', borderRadius: '4px', fontWeight: 'bold', color: scope.calculated_deadline && new Date(scope.calculated_deadline) > new Date(serviceDeadline) ? '#dc3545' : '#28a745' }}>
                                {scope.calculated_deadline ? new Date(scope.calculated_deadline).toLocaleDateString() : '—'}
                              </div>
                            </div>
                          </div>

                          <div style={{ flex: '1' }}>
                            <label style={styles.label}>Update Progress</label>
                            <select
                              value={scope.status}
                              onChange={(e) => {
                                const updated = [...formScopes];
                                updated[idx].status = e.target.value;
                                setFormScopes(updated);
                              }}
                              style={styles.selectInput}
                            >
                              <option value="Pending">Pending</option>
                              <option value="In-Progress">In-Progress</option>
                              <option value="Completed">Completed</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={styles.modalActions}>
                    <button type="button" onClick={() => setSelectedServiceGroup(null)} style={styles.cancelBtn}>Cancel</button>
                    <button type="submit" disabled={saving || (validationWarning && !isEmployee)} style={styles.saveBtn}>
                      {saving ? 'Saving...' : 'Update Status'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Create Manual Scope Modal (Hidden for Employees) */}
        {isCreateOpen && !isEmployee && (
          <div style={styles.modalOverlay} onClick={() => setIsCreateOpen(false)}>
             <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
               <div style={styles.modalHeader}>
                 <h3 style={{ margin: 0 }}>Create New Custom Scope</h3>
                 <button style={styles.closeBtn} onClick={() => setIsCreateOpen(false)}>✕</button>
               </div>
               <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
                 <div style={styles.formCol}>
                   <label style={styles.label}>Select LOE *</label>
                   <select value={newTaskForm.loe_id} onChange={(e) => setNewTaskForm({ ...newTaskForm, loe_id: e.target.value, department_id: isAdmin ? '' : userDeptId, service_id: ''})} required style={styles.selectInput}>
                     <option value="" disabled>-- Choose LOE --</option>
                     {loes.map(loe => <option key={loe.loe_id} value={loe.loe_id}>LOE #{loe.loe_id} - {loe.company?.name}</option>)}
                   </select>
                 </div>
                 <div style={styles.formCol}>
                   <label style={styles.label}>Department *</label>
                   <select value={newTaskForm.department_id} onChange={(e) => setNewTaskForm({ ...newTaskForm, department_id: e.target.value, service_id: ''})} required disabled={!newTaskForm.loe_id} style={styles.selectInput}>
                     <option value="" disabled>{!newTaskForm.loe_id ? 'Select LOE first' : '-- Choose Department --'}</option>
                     {availableDepartmentsInLoe.map(dept => <option key={dept.department_id} value={dept.department_id}>{dept.name}</option>)}
                   </select>
                 </div>
                 <div style={styles.formCol}>
                   <label style={styles.label}>Service Category *</label>
                   <select value={newTaskForm.service_id} onChange={(e) => setNewTaskForm({ ...newTaskForm, service_id: e.target.value })} required disabled={!newTaskForm.loe_id} style={styles.selectInput}>
                     <option value="" disabled>-- Choose Service --</option>
                     {createModalServices.map(srv => <option key={srv.service_id} value={srv.service_id}>{srv.name}</option>)}
                   </select>
                 </div>
                 <div style={styles.formCol}>
                   <label style={styles.label}>Custom Scope Description</label>
                   <textarea rows="3" value={newTaskForm.scope} onChange={(e) => setNewTaskForm({ ...newTaskForm, scope: e.target.value })} placeholder="Enter new scope..." style={{...styles.selectInput, resize: 'vertical'}} />
                 </div>
                 <div style={styles.modalActions}>
                   <button type="button" onClick={() => setIsCreateOpen(false)} style={styles.cancelBtn}>Cancel</button>
                   <button type="submit" disabled={saving} style={styles.saveBtn}>Create Scope</button>
                 </div>
               </form>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  pageContainer: { minHeight: '100vh', background: '#f4f6f8', fontFamily: 'system-ui' },
  container: { padding: '40px' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  createTaskBtn: { padding: '10px 18px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' },
  tableCard: { background: '#fff', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' },
  thRow: { background: '#f8f9fa', borderBottom: '2px solid #dee2e6' },
  th: { padding: '14px 16px', color: '#495057', fontWeight: 'bold' },
  tr: { borderBottom: '1px solid #dee2e6', cursor: 'pointer' },
  td: { padding: '14px 16px', verticalAlign: 'middle' },
  deptBadge: { background: '#e9ecef', color: '#495057', padding: '3px 8px', borderRadius: '4px', fontSize: '12px' },
  emptyCell: { textAlign: 'center', padding: '30px', color: '#6c757d' },
  errorBox: { background: '#f8d7da', color: '#721c24', padding: '10px 15px', borderRadius: '4px', marginBottom: '15px' },
  warningBanner: { background: '#fff3cd', color: '#856404', padding: '10px', borderRadius: '4px', border: '1px solid #ffeeba', fontSize: '13px', fontWeight: 'bold', marginBottom: '15px' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { background: '#fff', borderRadius: '8px', width: '95%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #dee2e6', paddingBottom: '12px' },
  closeBtn: { background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#6c757d' },
  modalBody: { marginTop: '16px', display: 'flex', flexDirection: 'column' },
  loeDetailsBox: { background: '#f1f5f9', padding: '12px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13.5px', marginBottom: '15px' },
  scopeAssignmentCard: { border: '1px solid #dee2e6', padding: '14px', borderRadius: '6px', background: '#fafbfc' },
  numberBadge: { background: '#6c757d', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', marginRight: '6px' },
  formRow: { display: 'flex', gap: '15px' },
  formCol: { flex: 1, display: 'flex', flexDirection: 'column' },
  label: { fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#495057' },
  selectInput: { padding: '8px 10px', borderRadius: '4px', border: '1px solid #ced4da', fontSize: '13px', width: '100%', boxSizing: 'border-box' },
  multiSelectBox: { background: '#fff', border: '1px solid #ced4da', borderRadius: '4px', padding: '8px 10px', maxHeight: '110px', overflowY: 'auto' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', borderTop: '1px solid #dee2e6', paddingTop: '15px' },
  cancelBtn: { padding: '8px 16px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  saveBtn: { padding: '8px 20px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }
};
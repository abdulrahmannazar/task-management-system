import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';

export default function TaskAllocation() {
  const [tasks, setTasks] = useState([]);
  const [loes, setLoes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [services, setServices] = useState([]);
  
  const [groupedServices, setGroupedServices] = useState([]);
  const [selectedServiceGroup, setSelectedServiceGroup] = useState(null);
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [error, setError] = useState('');
  const [validationWarning, setValidationWarning] = useState('');
  const [saving, setSaving] = useState(false);

  // Filter States
  const [filterCompany, setFilterCompany] = useState('');
  const [filterService, setFilterService] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterAssignee, setFilterAssignee] = useState('ALL');
  const [filterDepartment, setFilterDepartment] = useState('ALL');

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : null;
  const userDeptId = user?.department_id || 1;
  
  const isAdmin = user?.role === 'ADMIN';
  const isManager = user?.role === 'MANAGER';
  const isEmployee = !isAdmin && !isManager; 
  const canManage = isAdmin || isManager;

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
    fetchCompanies();
    fetchServices();
    if (isAdmin) fetchDepartments();
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

  const fetchCompanies = async () => {
    try {
      const response = await fetch('https://task-management-system-6ifq.onrender.com/api/companies', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await response.json();
      if (response.ok) setCompanies(Array.isArray(data) ? data : data.companies || []);
    } catch (err) {}
  };

  const fetchServices = async () => {
    try {
      const response = await fetch('https://task-management-system-6ifq.onrender.com/api/services', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await response.json();
      if (response.ok) setServices(Array.isArray(data) ? data : []);
    } catch (err) {}
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch('https://task-management-system-6ifq.onrender.com/api/auth/departments');
      const data = await response.json();
      if (response.ok && Array.isArray(data)) setDepartments(data);
    } catch (err) {}
  };

  const handleRowClick = (group) => {
    setSelectedServiceGroup(group);
    
    const existingDeadline = group.scopes.find(s => s.service_deadline)?.service_deadline;
    setServiceDeadline(existingDeadline ? existingDeadline.split('T')[0] : '');

    setFormScopes(group.scopes.map(s => ({
      task_id: s.task_id,
      task_code: s.task_code,
      scope: s.scope,
      status: s.status,
      duration_days: s.duration_days || '',
      calculated_deadline: s.deadline || null,
      assignee_ids: s.assignees ? s.assignees.map(a => a.emp_id) : []
    })));
    setValidationWarning('');
  };

  useEffect(() => {
    if (!serviceDeadline) return;
    const baseDate = new Date(serviceDeadline);
    if (isNaN(baseDate.getTime())) return;

    setFormScopes(prev => prev.map(item => {
      const days = parseInt(item.duration_days);
      if (!isNaN(days) && days > 0) {
        const newDeadline = new Date(baseDate);
        newDeadline.setDate(newDeadline.getDate() + days);
        return { ...item, calculated_deadline: newDeadline.toISOString().split('T')[0] };
      }
      return item;
    }));
  }, [serviceDeadline]);

  const handleDurationChange = (index, daysVal) => {
    const updated = [...formScopes];
    updated[index].duration_days = daysVal;

    const days = parseInt(daysVal);
    if (serviceDeadline && !isNaN(days) && days > 0) {
      const baseDate = new Date(serviceDeadline);
      if (!isNaN(baseDate.getTime())) {
        const newDeadline = new Date(baseDate);
        newDeadline.setDate(newDeadline.getDate() + days);
        updated[index].calculated_deadline = newDeadline.toISOString().split('T')[0];
      }
    } else {
      updated[index].calculated_deadline = null;
    }

    setFormScopes(updated);
  };

  const handleScopeAssigneeToggle = (scopeIdx, empId) => {
    const updated = [...formScopes];
    const current = updated[scopeIdx].assignee_ids;
    if (current.includes(empId)) {
      updated[scopeIdx].assignee_ids = current.filter(id => id !== empId);
    } else {
      updated[scopeIdx].assignee_ids = [...current, empId];
    }
    setFormScopes(updated);
  };

  const handleSaveAllocation = async () => {
    setSaving(true);
    setError('');
    setValidationWarning('');

    try {
      for (const scopeItem of formScopes) {
        if (!scopeItem.calculated_deadline && serviceDeadline) {
          scopeItem.calculated_deadline = serviceDeadline;
        }

        const response = await fetch(`https://task-management-system-6ifq.onrender.com/api/tasks/${scopeItem.task_id}/allocate`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            assignee_ids: scopeItem.assignee_ids,
            service_deadline: serviceDeadline || null,
            deadline: scopeItem.calculated_deadline || null,
            duration_days: scopeItem.duration_days ? parseInt(scopeItem.duration_days) : null,
            status: scopeItem.status
          })
        });

        if (!response.ok) {
          const d = await response.json();
          throw new Error(d.error || 'Failed to save task allocation');
        }
      }

      await fetchTasks();
      setSelectedServiceGroup(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const resetFilters = () => {
    setFilterCompany('');
    setFilterService('ALL');
    setFilterStatus('ALL');
    setFilterAssignee('ALL');
    setFilterDepartment('ALL');
  };

  // Filter Logic
  const filteredGroups = groupedServices.filter(group => {
    const companyName = (group.job?.loe?.company?.name || '').toLowerCase();
    const serviceId = Number(group.service_id);
    const deptId = Number(group.service?.department_id);

    if (filterCompany && !companyName.includes(filterCompany.toLowerCase())) return false;
    if (filterService !== 'ALL' && serviceId !== Number(filterService)) return false;
    if (isAdmin && filterDepartment !== 'ALL' && deptId !== Number(filterDepartment)) return false;

    const matchesSubItems = group.scopes.some(t => {
      const stat = t.status === 'Ongoing' ? 'In-Progress' : t.status;
      if (filterStatus !== 'ALL') {
        const targetStat = filterStatus === 'Ongoing' ? 'In-Progress' : filterStatus;
        if (stat !== targetStat && t.status !== filterStatus) return false;
      }
      if (filterAssignee !== 'ALL') {
        const hasAssignee = (t.assignees || []).some(a => Number(a.emp_id) === Number(filterAssignee));
        if (!hasAssignee) return false;
      }
      return true;
    });

    return matchesSubItems;
  });

  const hasActiveFilters = 
    filterCompany !== '' || 
    filterService !== 'ALL' || 
    filterStatus !== 'ALL' || 
    filterAssignee !== 'ALL' || 
    (isAdmin && filterDepartment !== 'ALL');

  return (
    <div style={styles.pageContainer}>
      <Navbar />
      <div style={styles.container}>
        
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.pageTitle}>Task Allocation &amp; Management</h1>
            <p style={styles.subTitle}>
              Click any service row to configure deadlines, durations, and employee assignees.
            </p>
          </div>
          {canManage && (
            <button onClick={() => setIsCreateOpen(true)} style={styles.createTaskBtn}>
              + Create Custom Task
            </button>
          )}
        </div>

        {/* Filter Bar with Service Name Dropdown */}
        <div style={styles.filterBar}>
          <div style={styles.filterField}>
            <label style={styles.filterLabel}>Company Name</label>
            <input
              type="text"
              list="company-options"
              placeholder="Search company..."
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
              style={styles.filterInput}
            />
            <datalist id="company-options">
              {companies.map(c => (
                <option key={c.company_id} value={c.name || c.company_name} />
              ))}
            </datalist>
          </div>

          <div style={styles.filterField}>
            <label style={styles.filterLabel}>Service Name</label>
            <select
              value={filterService}
              onChange={(e) => setFilterService(e.target.value)}
              style={styles.filterSelect}
            >
              <option value="ALL">All Services</option>
              {services.map(srv => (
                <option key={srv.service_id} value={srv.service_id}>
                  {srv.name}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.filterField}>
            <label style={styles.filterLabel}>Task Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={styles.filterSelect}
            >
              <option value="ALL">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="In-Progress">Ongoing / In-Progress</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          <div style={styles.filterField}>
            <label style={styles.filterLabel}>Assignee</label>
            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              style={styles.filterSelect}
            >
              <option value="ALL">All Assignees</option>
              {employees.map(emp => (
                <option key={emp.emp_id} value={emp.emp_id}>{emp.name}</option>
              ))}
            </select>
          </div>

          {isAdmin && (
            <div style={styles.filterField}>
              <label style={styles.filterLabel}>Department (Admin)</label>
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                style={styles.filterSelect}
              >
                <option value="ALL">All Departments</option>
                {departments.map(dept => (
                  <option key={dept.department_id} value={dept.department_id}>{dept.name}</option>
                ))}
              </select>
            </div>
          )}

          {hasActiveFilters && (
            <button type="button" onClick={resetFilters} style={styles.clearFilterBtn}>
              Reset Filters
            </button>
          )}
        </div>

        {error && <div style={styles.errorBanner}>{error}</div>}

        {/* Tasks Table */}
        <div style={styles.card}>
          {filteredGroups.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#6c757d', padding: '30px' }}>
              No tasks match your filter criteria.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Company</th>
                    <th style={styles.th}>Service &amp; Department</th>
                    <th style={styles.th}>Scopes / Deliverables</th>
                    <th style={styles.th}>Service Deadline</th>
                    <th style={styles.th}>Assignees</th>
                    <th style={styles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGroups.map(group => {
                    const companyName = group.job?.loe?.company?.name || 'N/A';
                    const serviceName = group.service?.name || 'Service';
                    const deptName = group.service?.department?.name || 'General';
                    const deadline = group.scopes.find(s => s.service_deadline)?.service_deadline;

                    const allAssignees = [];
                    group.scopes.forEach(s => {
                      (s.assignees || []).forEach(a => {
                        if (!allAssignees.some(item => item.emp_id === a.emp_id)) {
                          allAssignees.push(a);
                        }
                      });
                    });

                    return (
                      <tr 
                        key={group.key} 
                        onClick={() => handleRowClick(group)}
                        style={styles.tr}
                      >
                        <td style={{ ...styles.td, fontWeight: 'bold', color: '#2563eb' }}>
                          {companyName}
                        </td>
                        <td style={styles.td}>
                          <strong>{serviceName}</strong>
                          <div style={{ fontSize: '11.5px', color: '#64748b' }}>{deptName}</div>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.scopeCountBadge}>
                            {group.scopes.length} {group.scopes.length === 1 ? 'Scope' : 'Scopes'}
                          </span>
                        </td>
                        <td style={styles.td}>
                          {deadline ? new Date(deadline).toLocaleDateString() : <span style={{ color: '#94a3b8' }}>Not set</span>}
                        </td>
                        <td style={styles.td}>
                          {allAssignees.length > 0 ? (
                            allAssignees.map(a => a.name).join(', ')
                          ) : (
                            <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Unassigned</span>
                          )}
                        </td>
                        <td style={styles.td}>
                          {group.scopes.every(s => s.status === 'Completed') ? (
                            <span style={{ ...styles.badge, background: '#d4edda', color: '#155724' }}>Completed</span>
                          ) : group.scopes.some(s => s.status === 'In-Progress' || s.status === 'Ongoing') ? (
                            <span style={{ ...styles.badge, background: '#cce5ff', color: '#004085' }}>Ongoing</span>
                          ) : (
                            <span style={{ ...styles.badge, background: '#fff3cd', color: '#856404' }}>Pending</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Allocation Modal */}
        {selectedServiceGroup && (
          <div style={styles.modalOverlay}>
            <div style={styles.modalContent}>
              <div style={styles.modalHeader}>
                <h3 style={{ margin: 0 }}>
                  Allocate Service: {selectedServiceGroup.service?.name}
                </h3>
                <button onClick={() => setSelectedServiceGroup(null)} style={styles.closeBtn}>✕</button>
              </div>

              <div style={styles.modalBody}>
                <div style={styles.loeDetailsBox}>
                  <strong>Company:</strong> {selectedServiceGroup.job?.loe?.company?.name || 'N/A'} |{' '}
                  <strong>Department:</strong> {selectedServiceGroup.service?.department?.name || 'N/A'}
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={styles.label}>Master Service Deadline:</label>
                  <input
                    type="date"
                    value={serviceDeadline}
                    onChange={(e) => setServiceDeadline(e.target.value)}
                    style={styles.selectInput}
                  />
                </div>

                {validationWarning && (
                  <div style={{ background: '#fff3cd', color: '#856404', padding: '8px 12px', borderRadius: '4px', marginBottom: '12px', fontSize: '12.5px' }}>
                    {validationWarning}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {formScopes.map((scopeItem, idx) => (
                    <div key={scopeItem.task_id} style={styles.scopeAssignmentCard}>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#1e293b' }}>
                        Scope #{idx + 1}: {scopeItem.scope}
                      </div>

                      <div style={styles.formRow}>
                        <div style={styles.formCol}>
                          <label style={styles.label}>Duration (Days):</label>
                          <input
                            type="number"
                            min="1"
                            placeholder="e.g. 5"
                            value={scopeItem.duration_days}
                            onChange={(e) => handleDurationChange(idx, e.target.value)}
                            style={styles.selectInput}
                          />
                        </div>

                        <div style={styles.formCol}>
                          <label style={styles.label}>Calculated Deadline:</label>
                          <input
                            type="date"
                            value={scopeItem.calculated_deadline ? scopeItem.calculated_deadline.split('T')[0] : ''}
                            onChange={(e) => {
                              const updated = [...formScopes];
                              updated[idx].calculated_deadline = e.target.value;
                              setFormScopes(updated);
                            }}
                            style={styles.selectInput}
                          />
                        </div>

                        <div style={styles.formCol}>
                          <label style={styles.label}>Status:</label>
                          <select
                            value={scopeItem.status}
                            onChange={(e) => {
                              const updated = [...formScopes];
                              updated[idx].status = e.target.value;
                              setFormScopes(updated);
                            }}
                            style={styles.selectInput}
                          >
                            <option value="Pending">Pending</option>
                            <option value="In-Progress">Ongoing</option>
                            <option value="Completed">Completed</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ marginTop: '10px' }}>
                        <label style={styles.label}>Assign Employees:</label>
                        <div style={styles.multiSelectBox}>
                          {employees.length === 0 ? (
                            <span style={{ fontSize: '12px', color: '#6c757d' }}>No employees available</span>
                          ) : (
                            employees.map(emp => {
                              const checked = scopeItem.assignee_ids.includes(emp.emp_id);
                              return (
                                <label key={emp.emp_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', marginBottom: '4px', cursor: 'pointer' }}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => handleScopeAssigneeToggle(idx, emp.emp_id)}
                                  />
                                  {emp.name} ({emp.email})
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={styles.modalActions}>
                  <button type="button" onClick={() => setSelectedServiceGroup(null)} style={styles.cancelBtn}>
                    Cancel
                  </button>
                  <button type="button" onClick={handleSaveAllocation} disabled={saving} style={styles.saveBtn}>
                    {saving ? 'Saving...' : 'Save Allocation'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

const styles = {
  pageContainer: { minHeight: '100vh', background: '#f4f6f8', fontFamily: 'system-ui' },
  container: { maxWidth: '1240px', margin: '0 auto', padding: '35px 40px' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' },
  pageTitle: { margin: 0, fontSize: '26px', color: '#1e293b' },
  subTitle: { margin: '4px 0 0', fontSize: '14px', color: '#64748b' },
  createTaskBtn: { padding: '10px 18px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '13.5px', cursor: 'pointer' },
  filterBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '14px',
    alignItems: 'flex-end',
    background: '#ffffff',
    padding: '18px 20px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    marginBottom: '24px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
  },
  filterField: { display: 'flex', flexDirection: 'column', gap: '5px', flex: '1', minWidth: '170px' },
  filterLabel: { fontSize: '12px', fontWeight: 'bold', color: '#475569' },
  filterInput: { padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' },
  filterSelect: { padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' },
  clearFilterBtn: {
    padding: '8px 14px',
    background: '#f1f5f9',
    color: '#dc2626',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '12px',
    cursor: 'pointer',
    height: '35px'
  },
  errorBanner: { background: '#fee2e2', color: '#b91c1c', padding: '12px 16px', borderRadius: '6px', marginBottom: '20px', fontSize: '13px' },
  card: { background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.04)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: { textAlign: 'left', padding: '13px 16px', background: '#f1f5f9', color: '#475569', fontWeight: 'bold', borderBottom: '1px solid #cbd5e1' },
  tr: { borderBottom: '1px solid #e2e8f0', cursor: 'pointer', transition: 'background 0.15s ease' },
  td: { padding: '14px 16px', color: '#334155', verticalAlign: 'middle' },
  badge: { padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', display: 'inline-block' },
  scopeCountBadge: { background: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { background: '#fff', borderRadius: '8px', width: '95%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #dee2e6', paddingBottom: '12px' },
  closeBtn: { background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#6c757d' },
  modalBody: { marginTop: '16px', display: 'flex', flexDirection: 'column' },
  loeDetailsBox: { background: '#f1f5f9', padding: '12px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13.5px', marginBottom: '15px' },
  scopeAssignmentCard: { border: '1px solid #dee2e6', padding: '14px', borderRadius: '6px', background: '#fafbfc' },
  formRow: { display: 'flex', gap: '15px' },
  formCol: { flex: 1, display: 'flex', flexDirection: 'column' },
  label: { fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#495057' },
  selectInput: { padding: '8px 10px', borderRadius: '4px', border: '1px solid #ced4da', fontSize: '13px', width: '100%', boxSizing: 'border-box' },
  multiSelectBox: { background: '#fff', border: '1px solid #ced4da', borderRadius: '4px', padding: '8px 10px', maxHeight: '110px', overflowY: 'auto' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', borderTop: '1px solid #dee2e6', paddingTop: '15px' },
  cancelBtn: { padding: '8px 16px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  saveBtn: { padding: '8px 20px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }
};
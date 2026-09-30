import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';

export default function TaskAllocation() {
  const [tasks, setTasks] = useState([]);
  const [loes, setLoes] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [selectedTask, setSelectedTask] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : null;
  
  const userDeptId = user?.department_id || 1;
  const isAdmin = user?.role === 'ADMIN';

  // State for updating an existing task inside detail modal
  const [allocationForm, setAllocationForm] = useState({
    assigned_to: '',
    deadline: '',
    status: 'Pending'
  });

  // State for creating a new task manually
  const [newTaskForm, setNewTaskForm] = useState({
    loe_id: '',
    department_id: isAdmin ? '' : userDeptId,
    service_id: '',
    scope: '',
    assigned_to: '',
    deadline: '',
    status: 'Pending'
  });

  useEffect(() => {
    fetchTasks();
    fetchLoes();
    fetchEmployees();
  }, []);

  const fetchTasks = async () => {
    try {
      const url = isAdmin
        ? `https://task-management-system-6ifq.onrender.com/api/tasks?role=ADMIN`
        : `https://task-management-system-6ifq.onrender.com/api/tasks?department_id=${userDeptId}&role=MANAGER`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError('Failed to load tasks');
    }
  };

  const fetchLoes = async () => {
    try {
      const response = await fetch('https://task-management-system-6ifq.onrender.com/api/loes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) setLoes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load LOEs', err);
    }
  };

  const fetchEmployees = async () => {
    try {
      const url = isAdmin
        ? 'https://task-management-system-6ifq.onrender.com/api/employees'
        : `https://task-management-system-6ifq.onrender.com/api/employees?department_id=${userDeptId}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) setEmployees(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  // Row selection handler
  const handleRowClick = (task) => {
    setSelectedTask(task);
    setAllocationForm({
      assigned_to: task.assigned_to || '',
      deadline: task.deadline ? task.deadline.split('T')[0] : '',
      status: task.status || 'Pending'
    });
  };

  // Update existing task
  const handleSaveAllocation = async (e) => {
    e.preventDefault();
    if (!selectedTask) return;

    setSaving(true);
    setError('');

    try {
      const response = await fetch(`https://task-management-system-6ifq.onrender.com/api/tasks/${selectedTask.task_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          assigned_to: allocationForm.assigned_to ? Number(allocationForm.assigned_to) : null,
          deadline: allocationForm.deadline || null,
          status: allocationForm.status
        })
      });

      const updated = await response.json();
      if (!response.ok) throw new Error(updated.error || 'Failed to update task');

      setTasks(prev => prev.map(t => t.task_id === selectedTask.task_id ? updated : t));
      setSelectedTask(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Create manual task
  const handleCreateTask = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const response = await fetch('https://task-management-system-6ifq.onrender.com/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          loe_id: Number(newTaskForm.loe_id),
          service_id: Number(newTaskForm.service_id),
          scope: newTaskForm.scope,
          assigned_to: newTaskForm.assigned_to ? Number(newTaskForm.assigned_to) : null,
          deadline: newTaskForm.deadline || null,
          status: newTaskForm.status
        })
      });

      const created = await response.json();
      if (!response.ok) throw new Error(created.error || 'Failed to create task');

      setTasks(prev => [created, ...prev]);
      setIsCreateOpen(false);
      setNewTaskForm({
        loe_id: '',
        department_id: isAdmin ? '' : userDeptId,
        service_id: '',
        scope: '',
        assigned_to: '',
        deadline: '',
        status: 'Pending'
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'Completed':
        return { background: '#28a745', color: '#fff' };
      case 'In-Progress':
        return { background: '#007bff', color: '#fff' };
      default:
        return { background: '#ffc107', color: '#000' };
    }
  };

  // ----------------------------------------------------------------------
  // DYNAMIC FILTERING LOGIC FOR CREATE TASK MODAL
  // ----------------------------------------------------------------------
  
  // 1. Find the currently selected LOE object
  const selectedLoeObj = loes.find(l => l.loe_id === Number(newTaskForm.loe_id));

  // 2. Extract all services mapped inside this specific LOE
  const availableServicesInLoe = selectedLoeObj 
    ? selectedLoeObj.loe_items.map(item => item.service).filter(Boolean)
    : [];

  // 3. Extract unique departments from those available services
  const availableDepartmentsInLoe = [];
  const deptIds = new Set();
  availableServicesInLoe.forEach(srv => {
    if (srv.department && !deptIds.has(srv.department.department_id)) {
      deptIds.add(srv.department.department_id);
      availableDepartmentsInLoe.push(srv.department);
    }
  });

  // 4. Filter Services based on the selected Department
  const createModalServices = availableServicesInLoe.filter(srv => {
    const targetDept = isAdmin ? newTaskForm.department_id : userDeptId;
    return !targetDept || srv.department_id === Number(targetDept);
  });

  // 5. Filter Employees based on the selected Department
  const createModalEmployees = employees.filter(emp => {
    const targetDept = isAdmin ? newTaskForm.department_id : userDeptId;
    return !targetDept || emp.department_id === Number(targetDept);
  });

  const editModalEmployees = employees.filter(
    emp => isAdmin || emp.department_id === selectedTask?.service?.department_id
  );

  return (
    <div style={styles.pageContainer}>
      <Navbar />
      <div style={styles.container}>
        
        {/* Header Row */}
        <div style={styles.headerRow}>
          <div>
            <h2 style={{ margin: 0 }}>Task Allocation &amp; Service Pipeline</h2>
            <p style={{ margin: '4px 0 0 0', color: '#6c757d', fontSize: '14px' }}>
              Click any row to open full LOE details and allocate team members.
            </p>
          </div>

          <button 
            onClick={() => setIsCreateOpen(true)}
            style={styles.createTaskBtn}
          >
            + Create New Task
          </button>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        {/* Compact Table */}
        <div style={styles.tableCard}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thRow}>
                <th style={styles.th}>LOE ID</th>
                <th style={styles.th}>Department</th>
                <th style={styles.th}>Service / Task</th>
                <th style={styles.th}>Task Doer</th>
                <th style={styles.th}>Deadline</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan="6" style={styles.emptyCell}>
                    No tasks found. Use "+ Create New Task" or approve an LOE to generate tasks.
                  </td>
                </tr>
              ) : (
                tasks.map((task) => {
                  const badge = getStatusBadgeStyle(task.status);
                  const isSelected = selectedTask?.task_id === task.task_id;

                  return (
                    <tr 
                      key={task.task_id} 
                      onClick={() => handleRowClick(task)}
                      style={{
                        ...styles.tr,
                        backgroundColor: isSelected ? '#e8f0fe' : '#fff'
                      }}
                    >
                      <td style={styles.td}>
                        <strong>#{task.job?.loe_id || task.job?.loe?.loe_id || 'N/A'}</strong>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.deptBadge}>
                          {task.service?.department?.name || `Dept #${task.service?.department_id}`}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <strong>{task.service?.name}</strong>
                      </td>
                      <td style={styles.td}>
                        {task.assignee ? (
                          <span>👤 {task.assignee.name}</span>
                        ) : (
                          <span style={{ color: '#dc3545', fontWeight: 'bold' }}>⚠️ Unassigned</span>
                        )}
                      </td>
                      <td style={styles.td}>
                        {task.deadline 
                          ? new Date(task.deadline).toLocaleDateString()
                          : <span style={{ color: '#6c757d' }}>None</span>}
                      </td>
                      <td style={styles.td}>
                        <span style={{ ...styles.statusBadge, ...badge }}>
                          {task.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Modal: Create New Task Manually */}
        {isCreateOpen && (
          <div style={styles.modalOverlay} onClick={() => setIsCreateOpen(false)}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <h3 style={{ margin: 0 }}>Create New Task Manually</h3>
                <button style={styles.closeBtn} onClick={() => setIsCreateOpen(false)}>✕</button>
              </div>

              <form onSubmit={handleCreateTask} style={styles.createForm}>
                {/* 1. Select LOE */}
                <div style={styles.formCol}>
                  <label style={styles.label}>Select LOE / Engagement *</label>
                  <select
                    value={newTaskForm.loe_id}
                    onChange={(e) => setNewTaskForm({ 
                      ...newTaskForm, 
                      loe_id: e.target.value,
                      department_id: isAdmin ? '' : userDeptId, // Reset dept to trigger fresh filter
                      service_id: '', // Reset service
                      scope: '' // Reset scope
                    })}
                    required
                    style={styles.selectInput}
                  >
                    <option value="" disabled>-- Choose LOE --</option>
                    {loes.map(loe => (
                      <option key={loe.loe_id} value={loe.loe_id}>
                        LOE #{loe.loe_id} - {loe.company?.name || `Company ID: ${loe.company_id}`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Select Department (Filtered by LOE) */}
                <div style={styles.formCol}>
                  <label style={styles.label}>Department *</label>
                  {isAdmin ? (
                    <select
                      value={newTaskForm.department_id}
                      onChange={(e) => setNewTaskForm({ 
                        ...newTaskForm, 
                        department_id: e.target.value,
                        service_id: '',
                        assigned_to: ''
                      })}
                      required
                      disabled={!newTaskForm.loe_id}
                      style={styles.selectInput}
                    >
                      <option value="" disabled>
                        {!newTaskForm.loe_id ? 'Select LOE first' : '-- Choose Department --'}
                      </option>
                      {availableDepartmentsInLoe.map(dept => (
                        <option key={dept.department_id} value={dept.department_id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input 
                      type="text" 
                      value={`Department #${userDeptId}`} 
                      disabled 
                      style={{ ...styles.selectInput, background: '#f8f9fa' }} 
                    />
                  )}
                </div>

                {/* 3. Select Service (Filtered by LOE & Department) */}
                <div style={styles.formCol}>
                  <label style={styles.label}>Service / Deliverable *</label>
                  <select
                    value={newTaskForm.service_id}
                    onChange={(e) => {
                      const sId = e.target.value;
                      const srv = createModalServices.find(s => s.service_id === Number(sId));
                      // Pre-fill scope with the service's default scope if available
                      setNewTaskForm({ 
                        ...newTaskForm, 
                        service_id: sId,
                        scope: srv?.scope || newTaskForm.scope 
                      });
                    }}
                    required
                    disabled={!newTaskForm.loe_id || (isAdmin && !newTaskForm.department_id)}
                    style={styles.selectInput}
                  >
                    <option value="" disabled>
                      {!newTaskForm.loe_id || (isAdmin && !newTaskForm.department_id) 
                        ? 'Select Department first' 
                        : '-- Choose Service --'}
                    </option>
                    {createModalServices.map(srv => (
                      <option key={srv.service_id} value={srv.service_id}>
                        {srv.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Task Scope / Instructions */}
                <div style={styles.formCol}>
                  <label style={styles.label}>Task Scope / Instructions</label>
                  <textarea
                    rows="3"
                    value={newTaskForm.scope}
                    onChange={(e) => setNewTaskForm({ ...newTaskForm, scope: e.target.value })}
                    placeholder="Enter specific tasks, deliverables, or execution notes..."
                    style={styles.textareaInput}
                  />
                </div>

                {/* 5. Assignee, Deadline & Status in a Row */}
                <div style={styles.formRow}>
                  <div style={styles.formCol}>
                    <label style={styles.label}>Task Doer (Assignee)</label>
                    <select
                      value={newTaskForm.assigned_to}
                      onChange={(e) => setNewTaskForm({ ...newTaskForm, assigned_to: e.target.value })}
                      style={styles.selectInput}
                    >
                      <option value="">-- Unassigned --</option>
                      {createModalEmployees.map(emp => (
                        <option key={emp.emp_id} value={emp.emp_id}>
                          {emp.name} ({emp.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={styles.formCol}>
                    <label style={styles.label}>Deadline</label>
                    <input
                      type="date"
                      value={newTaskForm.deadline}
                      onChange={(e) => setNewTaskForm({ ...newTaskForm, deadline: e.target.value })}
                      style={styles.dateInput}
                    />
                  </div>

                  <div style={styles.formCol}>
                    <label style={styles.label}>Status</label>
                    <select
                      value={newTaskForm.status}
                      onChange={(e) => setNewTaskForm({ ...newTaskForm, status: e.target.value })}
                      style={styles.selectInput}
                    >
                      <option value="Pending">Pending</option>
                      <option value="In-Progress">In-Progress</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                </div>

                <div style={styles.modalActions}>
                  <button 
                    type="button" 
                    onClick={() => setIsCreateOpen(false)} 
                    style={styles.cancelBtn}
                  >
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} style={styles.saveBtn}>
                    {saving ? 'Creating...' : 'Create Task'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: View Existing LOE Details & Update Allocation */}
        {selectedTask && (
          <div style={styles.modalOverlay} onClick={() => setSelectedTask(null)}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <h3 style={{ margin: 0 }}>LOE &amp; Task Assignment Details</h3>
                <button style={styles.closeBtn} onClick={() => setSelectedTask(null)}>✕</button>
              </div>

              <div style={styles.modalBody}>
                {/* Full LOE Summary Box */}
                <div style={styles.loeDetailsBox}>
                  <h4 style={{ margin: '0 0 10px', color: '#0056b3' }}>
                    Engagement: LOE #{selectedTask.job?.loe?.loe_id || selectedTask.job?.loe_id}
                  </h4>
                  <div style={styles.infoGrid}>
                    <p><strong>Company:</strong> {selectedTask.job?.loe?.company?.name || 'N/A'}</p>
                    <p><strong>Client Type:</strong> {selectedTask.job?.loe?.company?.client_type || 'Corporate'}</p>
                    <p><strong>LOE Status:</strong> <span style={{ color: '#28a745', fontWeight: 'bold' }}>{selectedTask.job?.loe?.status || 'Active'}</span></p>
                    <p><strong>Engagement Type:</strong> {selectedTask.job?.loe?.type || 'Standard'}</p>
                    <p><strong>Commencement:</strong> {selectedTask.job?.loe?.start_date ? new Date(selectedTask.job.loe.start_date).toLocaleDateString() : 'N/A'}</p>
                    <p><strong>Created By:</strong> {selectedTask.job?.loe?.creator?.name || 'Staff'}</p>
                  </div>
                </div>

                {/* Scope & Service Information */}
                <div style={styles.scopeSection}>
                  <p style={{ margin: '0 0 6px' }}>
                    <strong>Service:</strong> {selectedTask.service?.name} ({selectedTask.service?.department?.name || `Dept #${selectedTask.service?.department_id}`})
                  </p>
                  <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 'bold', color: '#495057' }}>
                    Contracted Deliverables / Scope:
                  </p>
                  <div style={styles.scopeTextareaPreview}>
                    {selectedTask.scope || selectedTask.service?.scope || 'Standard engagement deliverable scope.'}
                  </div>
                </div>

                {/* Assignment Controls */}
                <form onSubmit={handleSaveAllocation} style={styles.assignmentForm}>
                  <h4 style={{ margin: '10px 0 6px', color: '#333' }}>Allocate Task Doer &amp; Schedule</h4>
                  
                  <div style={styles.formRow}>
                    <div style={styles.formCol}>
                      <label style={styles.label}>Assign Employee (Task Doer)</label>
                      <select
                        value={allocationForm.assigned_to}
                        onChange={(e) => setAllocationForm({ ...allocationForm, assigned_to: e.target.value })}
                        style={styles.selectInput}
                      >
                        <option value="">-- Unassigned --</option>
                        {editModalEmployees.map(emp => (
                          <option key={emp.emp_id} value={emp.emp_id}>
                            {emp.name} ({emp.role})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={styles.formCol}>
                      <label style={styles.label}>Completion Deadline</label>
                      <input
                        type="date"
                        value={allocationForm.deadline}
                        onChange={(e) => setAllocationForm({ ...allocationForm, deadline: e.target.value })}
                        style={styles.dateInput}
                      />
                    </div>

                    <div style={styles.formCol}>
                      <label style={styles.label}>Task Progress Status</label>
                      <select
                        value={allocationForm.status}
                        onChange={(e) => setAllocationForm({ ...allocationForm, status: e.target.value })}
                        style={styles.selectInput}
                      >
                        <option value="Pending">Pending</option>
                        <option value="In-Progress">In-Progress</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>
                  </div>

                  <div style={styles.modalActions}>
                    <button type="button" onClick={() => setSelectedTask(null)} style={styles.cancelBtn}>
                      Cancel
                    </button>
                    <button type="submit" disabled={saving} style={styles.saveBtn}>
                      {saving ? 'Saving...' : 'Confirm Allocation'}
                    </button>
                  </div>
                </form>
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
  container: { padding: '40px' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  createTaskBtn: { padding: '10px 18px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' },
  tableCard: { background: '#fff', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' },
  thRow: { background: '#f8f9fa', borderBottom: '2px solid #dee2e6' },
  th: { padding: '14px 16px', color: '#495057', fontWeight: 'bold' },
  tr: { borderBottom: '1px solid #dee2e6', cursor: 'pointer', transition: 'background-color 0.15s ease' },
  td: { padding: '14px 16px', verticalAlign: 'middle' },
  deptBadge: { background: '#e9ecef', color: '#495057', padding: '3px 8px', borderRadius: '4px', fontSize: '12px' },
  statusBadge: { padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' },
  emptyCell: { textAlign: 'center', padding: '30px', color: '#6c757d' },
  errorBox: { background: '#f8d7da', color: '#721c24', padding: '10px 15px', borderRadius: '4px', marginBottom: '15px' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { background: '#fff', borderRadius: '8px', width: '90%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #dee2e6', paddingBottom: '12px' },
  closeBtn: { background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#6c757d' },
  modalBody: { marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' },
  loeDetailsBox: { background: '#f1f5f9', padding: '14px', borderRadius: '6px', border: '1px solid #cbd5e1' },
  infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' },
  scopeSection: { background: '#f8f9fa', padding: '14px', borderRadius: '6px', border: '1px solid #dee2e6' },
  scopeTextareaPreview: { background: '#fff', border: '1px solid #ced4da', borderRadius: '4px', padding: '8px 10px', fontSize: '13px', color: '#333', maxHeight: '100px', overflowY: 'auto', whiteSpace: 'pre-wrap' },
  createForm: { display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' },
  assignmentForm: { borderTop: '1px solid #dee2e6', paddingTop: '14px' },
  formRow: { display: 'flex', gap: '12px' },
  formCol: { flex: 1, display: 'flex', flexDirection: 'column' },
  label: { fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#495057' },
  selectInput: { padding: '9px 10px', borderRadius: '4px', border: '1px solid #ced4da', fontSize: '13px' },
  dateInput: { padding: '8px 10px', borderRadius: '4px', border: '1px solid #ced4da', fontSize: '13px' },
  textareaInput: { padding: '8px 10px', borderRadius: '4px', border: '1px solid #ced4da', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '15px' },
  cancelBtn: { padding: '8px 16px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  saveBtn: { padding: '8px 20px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }
};
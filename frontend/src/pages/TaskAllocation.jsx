import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';

export default function TaskAllocation() {
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : null;
  
  const userDeptId = user?.department_id || 1;
  const isAdmin = user?.role === 'ADMIN';

  // Form state for assignment inside the modal
  const [allocationForm, setAllocationForm] = useState({
    assigned_to: '',
    deadline: '',
    status: 'Pending'
  });

  useEffect(() => {
    fetchTasks();
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

  const handleRowClick = (task) => {
    setSelectedTask(task);
    setAllocationForm({
      assigned_to: task.assigned_to || '',
      deadline: task.deadline ? task.deadline.split('T')[0] : '',
      status: task.status || 'Pending'
    });
  };

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

      // Update local state
      setTasks(prev => prev.map(t => t.task_id === selectedTask.task_id ? updated : t));
      setSelectedTask(null);
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

  const deptEmployees = employees.filter(emp => 
    isAdmin || emp.department_id === selectedTask?.service?.department_id
  );

  return (
    <div style={styles.pageContainer}>
      <Navbar />
      <div style={styles.container}>
        <div style={styles.headerRow}>
          <div>
            <h2 style={{ margin: 0 }}>Task Allocation &amp; Service Pipeline</h2>
            <p style={{ margin: '4px 0 0 0', color: '#6c757d', fontSize: '14px' }}>
              Click any row to open full LOE details and allocate team members.
            </p>
          </div>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        {/* Compact Preview Table */}
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
                    No approved LOE tasks awaiting allocation.
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
                        <strong>#{task.job?.loe_id || 'N/A'}</strong>
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

        {/* Detail & Assignment Modal */}
        {selectedTask && (
          <div style={styles.modalOverlay} onClick={() => setSelectedTask(null)}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <h3>LOE &amp; Task Assignment Details</h3>
                <button style={styles.closeBtn} onClick={() => setSelectedTask(null)}>✕</button>
              </div>

              <div style={styles.modalBody}>
                {/* Full LOE Summary Box */}
                <div style={styles.loeDetailsBox}>
                  <h4 style={{ margin: '0 0 10px', color: '#0056b3' }}>
                    Engagement: LOE #{selectedTask.job?.loe?.loe_id}
                  </h4>
                  <div style={styles.infoGrid}>
                    <p><strong>Company:</strong> {selectedTask.job?.loe?.company?.name || 'N/A'}</p>
                    <p><strong>Client Type:</strong> {selectedTask.job?.loe?.company?.client_type || 'Corporate'}</p>
                    <p><strong>LOE Status:</strong> <span style={{ color: '#28a745', fontWeight: 'bold' }}>{selectedTask.job?.loe?.status}</span></p>
                    <p><strong>Engagement Type:</strong> {selectedTask.job?.loe?.type || 'Standard'}</p>
                    <p><strong>Commencement:</strong> {selectedTask.job?.loe?.start_date ? new Date(selectedTask.job.loe.start_date).toLocaleDateString() : 'N/A'}</p>
                    <p><strong>Created By:</strong> {selectedTask.job?.loe?.creator?.name || 'Staff'}</p>
                  </div>
                </div>

                {/* Scope & Service Information */}
                <div style={styles.scopeSection}>
                  <p style={{ margin: '0 0 6px' }}>
                    <strong>Service:</strong> {selectedTask.service?.name} ({selectedTask.service?.department?.name})
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
                        {deptEmployees.map(emp => (
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
  headerRow: { marginBottom: '20px' },
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
  assignmentForm: { borderTop: '1px solid #dee2e6', paddingTop: '14px' },
  formRow: { display: 'flex', gap: '12px', marginTop: '10px' },
  formCol: { flex: 1, display: 'flex', flexDirection: 'column' },
  label: { fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#495057' },
  selectInput: { padding: '8px 10px', borderRadius: '4px', border: '1px solid #ced4da', fontSize: '13px' },
  dateInput: { padding: '8px 10px', borderRadius: '4px', border: '1px solid #ced4da', fontSize: '13px' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' },
  cancelBtn: { padding: '8px 16px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  saveBtn: { padding: '8px 20px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }
};
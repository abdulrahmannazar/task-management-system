import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../utils/api';
import Navbar from '../components/Navbar';
import { usePermissions } from '../utils/permissionHelper';
import { fetchCachedJson } from '../utils/api';
import BlobLoader from '../components/BlobLoader';

export default function EmployeeManager() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();

  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // In-Detail View State (matching CompanyManager.jsx viewingCompany pattern)
  const [viewingEmployee, setViewingEmployee] = useState(null);
  const [taskStatusFilter, setTaskStatusFilter] = useState('ALL'); // 'ALL' | 'Pending' | 'Ongoing' | 'Completed' | 'Overdue'
  const [selectedTaskDetail, setSelectedTaskDetail] = useState(null);

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};
  
  const isAdmin = user?.role === 'ADMIN';
  const userDeptId = user?.department_id || 1;

  const canViewPage = hasPermission(user, 'VIEW_EMPLOYEES');
  const canCreateOrEdit = hasPermission(user, 'CREATE_EMPLOYEE');
  const canDelete = hasPermission(user, 'DELETE_EMPLOYEE');

  const initialFormState = {
    name: '',
    email: '',
    password: '',
    department_id: isAdmin ? '' : userDeptId,
    role: 'EMPLOYEE',
    is_active: true
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchEmployees(), fetchDepartments(), fetchTasks()]);
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (selectedTaskDetail) setSelectedTaskDetail(null);
        else if (isModalOpen) closeModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, selectedTaskDetail]);

  const fetchEmployees = async () => {
    try {
      const url = isAdmin
        ? `${API_BASE}/api/employees?role=ADMIN`
        : `${API_BASE}/api/employees?department_id=${userDeptId}&role=MANAGER`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) setEmployees(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDepartments = async () => {
    try {
      const data = await fetchCachedJson('/api/auth/departments');
      if (Array.isArray(data)) setDepartments(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTasks = async () => {
    try {
      const url = isAdmin
        ? `${API_BASE}/api/tasks?role=ADMIN`
        : `${API_BASE}/api/tasks?department_id=${userDeptId}&role=MANAGER`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) setTasks(Array.isArray(data) ? data : data.tasks || []);
    } catch (err) {
      console.error(err);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not set';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const isOverdue = (deadline, status) => {
    if (!deadline || status === 'Completed') return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const d = new Date(deadline);
    d.setHours(0, 0, 0, 0);
    return d < now;
  };

  const handleStartTask = async (taskId) => {
    try {
      const response = await fetch(`${API_BASE}/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'In-Progress' })
      });
      if (response.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.task_id === taskId ? { ...t, status: 'In-Progress' } : t))
        );
        if (selectedTaskDetail && selectedTaskDetail.task_id === taskId) {
          setSelectedTaskDetail((prev) => ({ ...prev, status: 'In-Progress' }));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      department_id: isAdmin ? '' : userDeptId,
      role: 'EMPLOYEE',
      is_active: true
    });
    setError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      department_id: isAdmin ? '' : userDeptId,
      role: 'EMPLOYEE',
      is_active: true
    });
    setError('');
  };

  const handleEdit = (emp, e) => {
    if (e) e.stopPropagation();
    setEditingId(emp.emp_id);
    setFormData({
      name: emp.name,
      email: emp.email,
      password: '',
      department_id: emp.department_id,
      role: emp.role,
      is_active: emp.is_active
    });
    setError('');
    setIsModalOpen(true);
  };

  const handleDeleteEmployee = async (empId, empName, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete employee "${empName}"?`)) return;
    try {
      setError('');
      const response = await fetch(`${API_BASE}/api/employees/${empId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        const d = await response.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to delete employee');
      }
      setEmployees((prev) => prev.filter((e) => e.emp_id !== empId));
      if (viewingEmployee && viewingEmployee.emp_id === empId) {
        setViewingEmployee(null);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    const url = editingId
      ? `${API_BASE}/api/employees/${editingId}`
      : `${API_BASE}/api/employees`;

    const method = editingId ? 'PUT' : 'POST';

    const payload = {
      ...formData,
      department_id: isAdmin ? Number(formData.department_id) : userDeptId,
      role: isAdmin ? formData.role : 'EMPLOYEE',
      requester_role: isAdmin ? 'ADMIN' : 'MANAGER',
      requester_dept_id: userDeptId,
      requester_emp_id: user?.emp_id
    };

    if (editingId && !formData.password) {
      delete payload.password;
    }

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save employee');

      await fetchEmployees();
      closeModal();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const getDepartmentName = (deptId) => {
    const found = departments.find((d) => d.department_id === Number(deptId));
    return found ? found.name : `Dept #${deptId}`;
  };

  const getRoleBadgeStyle = (role) => {
    switch (role) {
      case 'ADMIN':
        return { background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe' };
      case 'MANAGER':
        return { background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd' };
      default:
        return { background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' };
    }
  };

  const displayedEmployees = employees.filter((emp) => {
    if (!isAdmin || selectedDeptFilter === 'ALL') return true;
    return emp.department_id === Number(selectedDeptFilter);
  });

  const currentViewingEmployee = viewingEmployee
    ? employees.find((e) => e.emp_id === viewingEmployee.emp_id) || viewingEmployee
    : null;

  const viewingEmployeeTasks = currentViewingEmployee
    ? tasks.filter((t) => (t.assignees || []).some((a) => a.emp_id === currentViewingEmployee.emp_id))
    : [];

  const totalAssigned = viewingEmployeeTasks.length;
  const pendingAssigned = viewingEmployeeTasks.filter((t) => t.status === 'Pending').length;
  const ongoingAssigned = viewingEmployeeTasks.filter(
    (t) => t.status === 'In-Progress' || t.status === 'Ongoing'
  ).length;
  const completedAssigned = viewingEmployeeTasks.filter((t) => t.status === 'Completed').length;
  const overdueAssigned = viewingEmployeeTasks.filter((t) => isOverdue(t.deadline, t.status)).length;
  const completionRate =
    totalAssigned > 0 ? Math.round((completedAssigned / totalAssigned) * 100) : 0;

  const displayedEmployeeTasks = viewingEmployeeTasks.filter((t) => {
    if (taskStatusFilter === 'Pending') return t.status === 'Pending';
    if (taskStatusFilter === 'Ongoing') return t.status === 'In-Progress' || t.status === 'Ongoing';
    if (taskStatusFilter === 'Completed') return t.status === 'Completed';
    if (taskStatusFilter === 'Overdue') return isOverdue(t.deadline, t.status);
    return true;
  });

  if (!canViewPage) {
    return (
      <div style={styles.pageContainer}>
        <Navbar />
        <div style={{ padding: '40px', textAlign: 'center' }}>
          Access Denied. You do not have permission to view the Employees page.
        </div>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer}>
      <Navbar />
      <div style={styles.contentWrapper}>
        {/* ============================================================
            MODE A: VIEW EMPLOYEE DETAILS & ASSIGNED TASKS (IN-DETAIL VIEW)
            Matching CompanyManager.jsx & LoeManager.jsx template exactly
           ============================================================ */}
        {currentViewingEmployee ? (
          <div>
            {/* Navigation & Action Top Bar */}
            <div style={styles.detailsTopBar}>
              <button
                type="button"
                onClick={() => setViewingEmployee(null)}
                style={styles.backBtn}
              >
                ← Back to Employees Directory
              </button>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {canCreateOrEdit && (
                  <button
                    type="button"
                    onClick={(e) => handleEdit(currentViewingEmployee, e)}
                    style={styles.editTopBtn}
                  >
                    Edit Employee Details
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => navigate('/tasks')}
                  style={styles.actionAllocationBtn}
                >
                  Open Task Allocation Board →
                </button>
              </div>
            </div>

            {/* Employee Hero Overview Card */}
            <div style={styles.heroCard}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={styles.heroAvatar}>
                    {currentViewingEmployee.name
                      ? currentViewingEmployee.name.charAt(0).toUpperCase()
                      : 'E'}
                  </div>
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        flexWrap: 'wrap'
                      }}
                    >
                      <h1 style={styles.heroName}>{currentViewingEmployee.name}</h1>
                      <span
                        style={{
                          ...styles.badge,
                          ...getRoleBadgeStyle(currentViewingEmployee.role)
                        }}
                      >
                        {currentViewingEmployee.role}
                      </span>
                      <span
                        style={{
                          ...styles.badge,
                          background: currentViewingEmployee.is_active ? '#ecfdf5' : '#fff1f2',
                          color: currentViewingEmployee.is_active ? '#059669' : '#e11d48',
                          border: currentViewingEmployee.is_active
                            ? '1px solid #a7f3d0'
                            : '1px solid #fecdd3'
                        }}
                      >
                        {currentViewingEmployee.is_active ? 'Active' : 'Deactivated'}
                      </span>
                    </div>
                    <p style={styles.heroSubtitle}>
                      Employee ID: #{currentViewingEmployee.emp_id} &bull; Email:{' '}
                      {currentViewingEmployee.email} &bull; Department:{' '}
                      {currentViewingEmployee.department?.name ||
                        getDepartmentName(currentViewingEmployee.department_id)}
                    </p>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      fontSize: '11.5px',
                      color: '#64748b',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px'
                    }}
                  >
                    Task Completion Rate
                  </span>
                  <div
                    style={{
                      fontSize: '24px',
                      fontWeight: '800',
                      color: completionRate >= 50 ? '#059669' : '#0284c7'
                    }}
                  >
                    {completionRate}%
                  </div>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                    {completedAssigned} of {totalAssigned} deliverables finished
                  </span>
                </div>
              </div>
            </div>

            {/* Two-Column Profile & Access Cards */}
            <div style={styles.detailsTwoCol}>
              <div style={styles.detailCard}>
                <h3 style={styles.detailCardHeading}>Team Member Profile &amp; Department</h3>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Full Name</span>
                  <span style={styles.detailVal}>{currentViewingEmployee.name}</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Email Address (Login ID)</span>
                  <span style={styles.detailVal}>{currentViewingEmployee.email}</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Department</span>
                  <span style={styles.detailVal}>
                    {currentViewingEmployee.department?.name ||
                      getDepartmentName(currentViewingEmployee.department_id)}
                  </span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>System Role</span>
                  <span style={styles.detailVal}>{currentViewingEmployee.role}</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Account Access</span>
                  <span
                    style={{
                      ...styles.detailVal,
                      color: currentViewingEmployee.is_active ? '#059669' : '#e11d48'
                    }}
                  >
                    {currentViewingEmployee.is_active
                      ? 'Active & Allowed to Log In'
                      : 'Account Deactivated'}
                  </span>
                </div>
              </div>

              <div style={styles.detailCard}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid #e2e8f0',
                    paddingBottom: '10px',
                    marginBottom: '10px'
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '15px',
                      color: '#0f172a',
                      fontWeight: '700'
                    }}
                  >
                    Workload &amp; Delivery Progress
                  </h3>
                  <span style={styles.workloadBadge}>
                    {totalAssigned} Total Allocations
                  </span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Pending Tasks</span>
                  <span style={{ ...styles.detailVal, color: '#d97706' }}>
                    {pendingAssigned} Awaiting Start
                  </span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Ongoing Tasks</span>
                  <span style={{ ...styles.detailVal, color: '#0284c7' }}>
                    {ongoingAssigned} In Progress
                  </span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Completed Deliverables</span>
                  <span style={{ ...styles.detailVal, color: '#059669' }}>
                    {completedAssigned} Finished
                  </span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Overdue Tasks</span>
                  <span
                    style={{
                      ...styles.detailVal,
                      color: overdueAssigned > 0 ? '#e11d48' : '#64748b'
                    }}
                  >
                    {overdueAssigned} Past Target Deadline
                  </span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Delivery Efficiency</span>
                  <span style={styles.detailVal}>{completionRate}% Complete</span>
                </div>
              </div>
            </div>

            {/* KPI Metrics Bar */}
            <div style={styles.metricsGrid}>
              <div style={styles.metricCard}>
                <span style={styles.metricLabel}>Total Tasks</span>
                <div style={styles.metricValue}>{totalAssigned}</div>
                <span style={styles.metricSub}>Allocated across LOEs</span>
              </div>
              <div style={styles.metricCard}>
                <span style={styles.metricLabel}>Pending</span>
                <div style={{ ...styles.metricValue, color: '#d97706' }}>
                  {pendingAssigned}
                </div>
                <span style={styles.metricSub}>Awaiting initiation</span>
              </div>
              <div style={styles.metricCard}>
                <span style={styles.metricLabel}>Ongoing</span>
                <div style={{ ...styles.metricValue, color: '#0284c7' }}>
                  {ongoingAssigned}
                </div>
                <span style={styles.metricSub}>Currently in execution</span>
              </div>
              <div style={styles.metricCard}>
                <span style={styles.metricLabel}>Completed</span>
                <div style={{ ...styles.metricValue, color: '#059669' }}>
                  {completedAssigned}
                </div>
                <span style={styles.metricSub}>{completionRate}% completion rate</span>
              </div>
              <div style={styles.metricCard}>
                <span style={styles.metricLabel}>Overdue</span>
                <div style={{ ...styles.metricValue, color: '#e11d48' }}>
                  {overdueAssigned}
                </div>
                <span style={styles.metricSub}>Past target deadline</span>
              </div>
            </div>

            {/* Assigned Tasks Table Card */}
            <div style={styles.tableCard}>
              <div style={styles.tableCardHeader}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '16px', color: '#0f172a', fontWeight: '700' }}>
                    Assigned Tasks &amp; Deliverables ({displayedEmployeeTasks.length})
                  </h2>
                  <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#64748b' }}>
                    Review task deliverables, monitor deadlines, and advance completion states.
                  </p>
                </div>

                {/* Filter Tabs */}
                <div style={styles.taskTabGroup}>
                  <button
                    type="button"
                    onClick={() => setTaskStatusFilter('ALL')}
                    style={taskStatusFilter === 'ALL' ? styles.taskTabActive : styles.taskTab}
                  >
                    All ({totalAssigned})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskStatusFilter('Pending')}
                    style={taskStatusFilter === 'Pending' ? styles.taskTabActivePending : styles.taskTab}
                  >
                    Pending ({pendingAssigned})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskStatusFilter('Ongoing')}
                    style={taskStatusFilter === 'Ongoing' ? styles.taskTabActiveOngoing : styles.taskTab}
                  >
                    Ongoing ({ongoingAssigned})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskStatusFilter('Completed')}
                    style={taskStatusFilter === 'Completed' ? styles.taskTabActiveCompleted : styles.taskTab}
                  >
                    Completed ({completedAssigned})
                  </button>
                  {overdueAssigned > 0 && (
                    <button
                      type="button"
                      onClick={() => setTaskStatusFilter('Overdue')}
                      style={taskStatusFilter === 'Overdue' ? styles.taskTabActiveOverdue : styles.taskTab}
                    >
                      Overdue ({overdueAssigned})
                    </button>
                  )}
                </div>
              </div>

              {displayedEmployeeTasks.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '13.5px' }}>
                  No tasks found matching the selected filter.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Task Code</th>
                        <th style={styles.th}>Company &amp; LOE</th>
                        <th style={styles.th}>Service &amp; Scope</th>
                        <th style={styles.th}>Deadline</th>
                        <th style={styles.th}>Duration</th>
                        <th style={styles.th}>Status</th>
                        <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedEmployeeTasks.map((t) => {
                        const overdue = isOverdue(t.deadline, t.status);
                        return (
                          <tr
                            key={t.task_id}
                            style={styles.clickableTr}
                            onClick={() => setSelectedTaskDetail(t)}
                          >
                            <td style={styles.td}>
                              <span style={styles.taskCodeBadge}>
                                {t.task_code || `TASK #${t.task_id}`}
                              </span>
                            </td>
                            <td style={styles.td}>
                              <div style={{ fontWeight: '700', color: '#0f172a' }}>
                                {t.job?.loe?.company?.name || 'Company'}
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>
                                {t.job?.loe?.loe_code || `LOE #${t.job?.loe_id}`}
                              </div>
                            </td>
                            <td style={styles.td}>
                              <div style={{ fontWeight: '600', color: '#0284c7' }}>
                                {t.service?.name}
                              </div>
                              <div style={{ fontSize: '12px', color: '#475569', maxWidth: '320px' }}>
                                {t.scope || 'Standard deliverable'}
                              </div>
                              {t.comments && (
                                <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', marginTop: '2px' }}>
                                  Note: {t.comments}
                                </div>
                              )}
                            </td>
                            <td style={styles.td}>
                              <div
                                style={{
                                  fontWeight: overdue ? '700' : 'normal',
                                  color: overdue ? '#e11d48' : '#334155'
                                }}
                              >
                                {formatDate(t.deadline)}
                              </div>
                              {overdue && (
                                <span style={styles.overdueBadge}>Overdue</span>
                              )}
                            </td>
                            <td style={styles.td}>
                              {t.duration_days ? `${t.duration_days}d` : '-'}
                            </td>
                            <td style={styles.td}>
                              <span
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11.5px',
                                  fontWeight: '700',
                                  background:
                                    t.status === 'Completed'
                                      ? '#ecfdf5'
                                      : t.status === 'In-Progress' || t.status === 'Ongoing'
                                      ? '#f0f9ff'
                                      : '#fffbeb',
                                  color:
                                    t.status === 'Completed'
                                      ? '#059669'
                                      : t.status === 'In-Progress' || t.status === 'Ongoing'
                                      ? '#0284c7'
                                      : '#d97706',
                                  border:
                                    t.status === 'Completed'
                                      ? '1px solid #a7f3d0'
                                      : t.status === 'In-Progress' || t.status === 'Ongoing'
                                      ? '1px solid #bae6fd'
                                      : '1px solid #fde68a'
                                }}
                              >
                                {t.status === 'In-Progress' ? 'Ongoing' : t.status}
                              </span>
                            </td>
                            <td style={{ ...styles.td, textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                              <div style={{ display: 'inline-flex', gap: '6px' }}>
                                {t.status === 'Pending' && (
                                  <button
                                    type="button"
                                    onClick={() => handleStartTask(t.task_id)}
                                    style={styles.startTaskBtn}
                                    title="Start this task now"
                                  >
                                    Start Task
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setSelectedTaskDetail(t)}
                                  style={styles.detailsBtn}
                                >
                                  Details
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ============================================================
              MODE B: ALL EMPLOYEES DIRECTORY GRID
             ============================================================ */
          <div>
            {/* Top Header Row with Title, Filters, and Add Button */}
            <div style={styles.headerRow}>
              <div>
                <h1 style={styles.pageTitle}>
                  {isAdmin ? 'All Employees Directory' : `${getDepartmentName(userDeptId)} Team`}
                </h1>
                <p style={styles.pageSubtitle}>
                  {displayedEmployees.length} registered team member{displayedEmployees.length === 1 ? '' : 's'}. Click any team member to view full workload &amp; task details.
                </p>
              </div>

              <div style={styles.headerActions}>
                {isAdmin && (
                  <select
                    value={selectedDeptFilter}
                    onChange={(e) => setSelectedDeptFilter(e.target.value)}
                    style={styles.filterDropdown}
                  >
                    <option value="ALL">All Departments</option>
                    {departments.map((dept) => (
                      <option key={dept.department_id} value={dept.department_id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                )}

                {canCreateOrEdit && (
                  <button onClick={openCreateModal} style={styles.primaryActionBtn}>
                    + Add Employee
                  </button>
                )}
              </div>
            </div>

            {error && !isModalOpen && (
              <div style={styles.inlineErrorBox}>{error}</div>
            )}

            {/* Employees Cards Grid */}
            <div style={styles.listSection}>
              {loading ? (
                <div style={{ ...styles.emptyState, background: '#ffffff', padding: '10px' }}>
                  <BlobLoader message="Loading employees directory &amp; task loads..." />
                </div>
              ) : displayedEmployees.length === 0 ? (
                <div style={styles.emptyState}>No employees found.</div>
              ) : (
                <div style={styles.grid}>
                  {displayedEmployees.map((emp) => {
                    const roleBadge = getRoleBadgeStyle(emp.role);
                    const empAssignedTasks = tasks.filter((t) =>
                      (t.assignees || []).some((a) => a.emp_id === emp.emp_id)
                    );
                    const empPendingCount = empAssignedTasks.filter((t) => t.status === 'Pending').length;

                    return (
                      <div
                        key={emp.emp_id}
                        style={styles.card}
                        onClick={() => setViewingEmployee(emp)}
                      >
                        {/* Card Header */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: '6px'
                          }}
                        >
                          <div>
                            <h3 style={styles.cardName}>{emp.name}</h3>
                            <span style={styles.cardEmail}>{emp.email}</span>
                          </div>
                          <span style={{ ...styles.badge, ...roleBadge }}>{emp.role}</span>
                        </div>

                        {/* Department & Status */}
                        <p style={styles.cardInfoLine}>
                          <strong>Department:</strong>{' '}
                          {emp.department?.name || getDepartmentName(emp.department_id)}
                        </p>
                        <p style={styles.cardInfoLine}>
                          Status:{' '}
                          <strong style={{ color: emp.is_active ? '#059669' : '#e11d48' }}>
                            {emp.is_active ? 'Active' : 'Deactivated'}
                          </strong>
                        </p>

                        {/* Assigned Task Pill Indicator (matching other pages) */}
                        <div
                          style={styles.cardTaskPill}
                          title={`Click to view ${empAssignedTasks.length} tasks assigned to ${emp.name}`}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: empAssignedTasks.length > 0 ? '#0284c7' : '#94a3b8'
                              }}
                            />
                            <span style={{ fontSize: '12.5px', color: '#334155', fontWeight: '600' }}>
                              Assigned Tasks
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span
                              style={{
                                fontSize: '12px',
                                fontWeight: '700',
                                color: empAssignedTasks.length > 0 ? '#0284c7' : '#64748b',
                                background: empAssignedTasks.length > 0 ? '#f0f9ff' : '#f1f5f9',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                border:
                                  empAssignedTasks.length > 0
                                    ? '1px solid #bae6fd'
                                    : '1px solid #cbd5e1'
                              }}
                            >
                              {empAssignedTasks.length}{' '}
                              {empAssignedTasks.length === 1 ? 'Task' : 'Tasks'}
                            </span>
                            {empPendingCount > 0 && (
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  color: '#b45309',
                                  background: '#fffbeb',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  border: '1px solid #fde68a'
                                }}
                              >
                                {empPendingCount} Pending
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Card Action Controls */}
                        <div
                          style={styles.cardActionsRow}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => setViewingEmployee(emp)}
                            style={styles.viewTasksActionBtn}
                            title={`View details & tasks for ${emp.name}`}
                          >
                            View Details &amp; Tasks →
                          </button>
                          {canCreateOrEdit && (
                            <button
                              onClick={(e) => handleEdit(emp, e)}
                              style={styles.editBtn}
                            >
                              Edit
                            </button>
                          )}
                          {canDelete && emp.emp_id !== user.emp_id && (
                            <button
                              onClick={(e) => handleDeleteEmployee(emp.emp_id, emp.name, e)}
                              style={styles.deleteBtn}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Task Full Details & Deadline Modal (Solid White Overlay) */}
      {selectedTaskDetail && (
        <div style={styles.modalOverlay} onClick={() => setSelectedTaskDetail(null)}>
          <div style={styles.taskDetailModalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={styles.taskCodeBadgeLarge}>
                    {selectedTaskDetail.task_code || `TASK #${selectedTaskDetail.task_id}`}
                  </span>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      background:
                        selectedTaskDetail.status === 'Completed'
                          ? '#ecfdf5'
                          : selectedTaskDetail.status === 'In-Progress' ||
                            selectedTaskDetail.status === 'Ongoing'
                          ? '#f0f9ff'
                          : '#fffbeb',
                      color:
                        selectedTaskDetail.status === 'Completed'
                          ? '#059669'
                          : selectedTaskDetail.status === 'In-Progress' ||
                            selectedTaskDetail.status === 'Ongoing'
                          ? '#0284c7'
                          : '#d97706',
                      border:
                        selectedTaskDetail.status === 'Completed'
                          ? '1px solid #a7f3d0'
                          : selectedTaskDetail.status === 'In-Progress' ||
                            selectedTaskDetail.status === 'Ongoing'
                          ? '1px solid #bae6fd'
                          : '1px solid #fde68a'
                    }}
                  >
                    {selectedTaskDetail.status}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>
                  {selectedTaskDetail.job?.loe?.company?.name || 'Company'} &bull;{' '}
                  {selectedTaskDetail.service?.name}
                </div>
              </div>
              <button onClick={() => setSelectedTaskDetail(null)} style={styles.closeBtn}>
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '14px' }}>
              <div style={styles.detailSectionBox}>
                <div style={styles.detailSectionHeading}>Timeline &amp; Deadlines</div>
                <div style={styles.detailGrid}>
                  <div>
                    <strong>Task Deadline:</strong> {formatDate(selectedTaskDetail.deadline)}
                    {isOverdue(selectedTaskDetail.deadline, selectedTaskDetail.status) && (
                      <span
                        style={{
                          marginLeft: '6px',
                          color: '#e11d48',
                          fontWeight: 'bold',
                          fontSize: '11px'
                        }}
                      >
                        OVERDUE
                      </span>
                    )}
                  </div>
                  <div>
                    <strong>Service Deadline:</strong>{' '}
                    {formatDate(selectedTaskDetail.service_deadline)}
                  </div>
                  <div>
                    <strong>Duration:</strong>{' '}
                    {selectedTaskDetail.duration_days
                      ? `${selectedTaskDetail.duration_days} Days`
                      : 'Not set'}
                  </div>
                  <div>
                    <strong>Status:</strong> {selectedTaskDetail.status}
                  </div>
                </div>
              </div>

              <div style={styles.detailSectionBox}>
                <div style={styles.detailSectionHeading}>Scope &amp; Deliverables</div>
                <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
                  {selectedTaskDetail.scope || 'Standard service scope applied.'}
                </div>
                {selectedTaskDetail.comments && (
                  <div
                    style={{
                      marginTop: '8px',
                      fontSize: '12px',
                      color: '#64748b',
                      fontStyle: 'italic'
                    }}
                  >
                    Instructions: {selectedTaskDetail.comments}
                  </div>
                )}
              </div>

              <div style={styles.detailSectionBox}>
                <div style={styles.detailSectionHeading}>Assigned Team Members</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {(selectedTaskDetail.assignees || []).map((a) => (
                    <span key={a.emp_id} style={styles.assigneePillMini}>
                      {a.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: '16px',
                paddingTop: '12px',
                borderTop: '1px solid #f1f5f9'
              }}
            >
              {selectedTaskDetail.status === 'Pending' && (
                <button
                  type="button"
                  onClick={() => handleStartTask(selectedTaskDetail.task_id)}
                  style={styles.primaryActionBtn}
                >
                  Start Task (Move to Ongoing)
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedTaskDetail(null)}
                style={styles.cancelButton}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Employee Modal Dialog */}
      {isModalOpen && canCreateOrEdit && (
        <div style={styles.modalOverlay} onClick={closeModal}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>
                  {editingId ? 'Edit Employee Details' : 'Add New Employee'}
                </h2>
                <p style={styles.modalSubtitle}>
                  {isAdmin
                    ? 'Admins can assign employees or managers to any department.'
                    : `Add team members directly to the ${getDepartmentName(userDeptId)} department.`}
                </p>
              </div>
              <button onClick={closeModal} style={styles.closeBtn} title="Close dialog">
                ✕
              </button>
            </div>

            {error && <div style={styles.errorBox}>{error}</div>}

            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Full Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. John Doe"
                  required
                  style={styles.input}
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Email Address (Login Username) *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="john.doe@company.com"
                  required
                  style={styles.input}
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>
                  {editingId ? 'New Password (leave blank to keep current)' : 'Login Password *'}
                </label>
                <input
                  type="text"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Set initial login password"
                  required={!editingId}
                  style={styles.input}
                />
              </div>

              {/* Department Assignment */}
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Department *</label>
                {isAdmin ? (
                  <select
                    name="department_id"
                    value={formData.department_id}
                    onChange={handleChange}
                    required
                    style={styles.input}
                  >
                    <option value="" disabled>
                      -- Select Department --
                    </option>
                    {departments.map((dept) => (
                      <option key={dept.department_id} value={dept.department_id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={styles.lockedField}>
                    <strong>{getDepartmentName(userDeptId)}</strong>
                    <span style={styles.lockedNote}>(Locked to your department)</span>
                  </div>
                )}
              </div>

              {/* Role Selection */}
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Role *</label>
                {isAdmin ? (
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    style={styles.input}
                  >
                    <option value="EMPLOYEE">EMPLOYEE (Standard Staff)</option>
                    <option value="MANAGER">MANAGER (Department Head)</option>
                    <option value="ADMIN">ADMIN (Universal Access)</option>
                  </select>
                ) : (
                  <div style={styles.lockedField}>
                    <strong>EMPLOYEE</strong>
                    <span style={styles.lockedNote}>(Standard employee role)</span>
                  </div>
                )}
              </div>

              {editingId && (
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    color: '#334155',
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleChange}
                  />
                  Account is Active &amp; Allowed to Log In
                </label>
              )}

              <div style={styles.buttonGroup}>
                <button type="submit" disabled={saving} style={styles.button}>
                  {saving ? <BlobLoader inline size={14} light message={editingId ? 'Updating Details...' : 'Creating Employee...'} /> : editingId ? 'Update Details' : 'Create Employee'}
                </button>
                <button type="button" onClick={closeModal} style={styles.cancelButton}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  pageContainer: {
    minHeight: '100vh',
    background: '#f8fafc',
    fontFamily: "'Poppins', system-ui, -apple-system, sans-serif",
    marginLeft: 'var(--sidebar-width, 260px)',
    transition: 'margin-left 300ms ease-in-out'
  },
  contentWrapper: {
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '35px 40px'
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '16px'
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  pageTitle: {
    margin: 0,
    fontSize: '24px',
    fontWeight: '700',
    color: '#0f172a'
  },
  pageSubtitle: {
    margin: '4px 0 0 0',
    color: '#64748b',
    fontSize: '14px'
  },
  primaryActionBtn: {
    padding: '10px 20px',
    background: '#0284c7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '13.5px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)',
    transition: 'background 0.15s ease'
  },
  filterDropdown: {
    padding: '9px 14px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '13px',
    background: '#ffffff',
    color: '#334155',
    fontWeight: 'bold'
  },
  listSection: {
    width: '100%'
  },
  emptyState: {
    background: '#ffffff',
    padding: '40px',
    textAlign: 'center',
    borderRadius: '8px',
    color: '#64748b',
    border: '1px solid #e2e8f0',
    fontSize: '14px'
  },
  inlineErrorBox: {
    padding: '12px 16px',
    background: '#fff1f2',
    color: '#e11d48',
    borderRadius: '6px',
    fontSize: '13.5px',
    border: '1px solid #fecdd3',
    marginBottom: '20px'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '18px'
  },
  card: {
    background: '#ffffff',
    padding: '20px',
    borderRadius: '10px',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
    border: '1px solid #e2e8f0',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    display: 'flex',
    flexDirection: 'column'
  },
  cardName: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '700',
    color: '#0f172a'
  },
  cardEmail: {
    fontSize: '12.5px',
    color: '#64748b',
    display: 'block',
    marginTop: '2px'
  },
  cardInfoLine: {
    margin: '3px 0',
    fontSize: '13px',
    color: '#475569'
  },
  cardTaskPill: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: '12px 0 10px',
    padding: '9px 12px',
    background: '#f8fafc',
    borderRadius: '6px',
    border: '1px solid #e2e8f0'
  },
  cardActionsRow: {
    display: 'flex',
    gap: '8px',
    marginTop: 'auto',
    paddingTop: '12px',
    borderTop: '1px solid #f1f5f9'
  },
  viewTasksActionBtn: {
    flex: '1.4',
    padding: '7px 10px',
    background: '#0284c7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '12px',
    textAlign: 'center'
  },
  badge: {
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 'bold'
  },
  editBtn: {
    padding: '7px 10px',
    background: '#f0f9ff',
    color: '#0284c7',
    border: '1px solid #bae6fd',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '12px'
  },
  deleteBtn: {
    padding: '7px 10px',
    background: '#fff1f2',
    color: '#e11d48',
    border: '1px solid #fecdd3',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '12px'
  },

  // ============================================================
  // IN-DETAIL VIEW STYLES (Matching CompanyManager.jsx & LoeDetails.jsx)
  // ============================================================
  detailsTopBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '12px'
  },
  backBtn: {
    padding: '8px 16px',
    background: '#ffffff',
    color: '#334155',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer'
  },
  editTopBtn: {
    padding: '8px 16px',
    background: '#0284c7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: '700',
    fontSize: '13px',
    cursor: 'pointer'
  },
  actionAllocationBtn: {
    padding: '8px 16px',
    background: '#ffffff',
    color: '#0284c7',
    border: '1px solid #bae6fd',
    borderRadius: '6px',
    fontWeight: '700',
    fontSize: '13px',
    cursor: 'pointer'
  },
  heroCard: {
    background: '#ffffff',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    padding: '24px 28px',
    marginBottom: '20px',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
  },
  heroAvatar: {
    width: '54px',
    height: '54px',
    borderRadius: '50%',
    background: '#0284c7',
    color: '#ffffff',
    fontSize: '22px',
    fontWeight: '800',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)'
  },
  heroName: {
    margin: 0,
    fontSize: '22px',
    fontWeight: '700',
    color: '#0f172a'
  },
  heroSubtitle: {
    margin: '4px 0 0',
    fontSize: '13.5px',
    color: '#64748b'
  },
  detailsTwoCol: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
    gap: '20px',
    marginBottom: '20px'
  },
  detailCard: {
    background: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    padding: '20px 24px',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)'
  },
  detailCardHeading: {
    margin: '0 0 12px 0',
    fontSize: '15px',
    color: '#0f172a',
    fontWeight: '700',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '10px'
  },
  workloadBadge: {
    fontSize: '11.5px',
    fontWeight: '700',
    background: '#eff6ff',
    color: '#2563eb',
    border: '1px solid #bfdbfe',
    padding: '2px 8px',
    borderRadius: '4px'
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #f1f5f9',
    fontSize: '13px',
    gap: '12px'
  },
  detailLabel: {
    color: '#64748b',
    fontWeight: '500'
  },
  detailVal: {
    color: '#0f172a',
    fontWeight: '600',
    textAlign: 'right'
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '24px'
  },
  metricCard: {
    background: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    padding: '16px 20px',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)'
  },
  metricLabel: {
    fontSize: '11.5px',
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.4px'
  },
  metricValue: {
    fontSize: '24px',
    fontWeight: '800',
    color: '#0f172a',
    marginTop: '6px'
  },
  metricSub: {
    fontSize: '12px',
    color: '#94a3b8',
    marginTop: '4px',
    display: 'block'
  },
  tableCard: {
    background: '#ffffff',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
    overflow: 'hidden'
  },
  tableCardHeader: {
    padding: '18px 24px',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
    background: '#ffffff'
  },
  taskTabGroup: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap'
  },
  taskTab: {
    padding: '6px 12px',
    background: '#f8fafc',
    color: '#475569',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  taskTabActive: {
    padding: '6px 12px',
    background: '#f0f9ff',
    color: '#0284c7',
    border: '1px solid #0284c7',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer'
  },
  taskTabActivePending: {
    padding: '6px 12px',
    background: '#fffbeb',
    color: '#b45309',
    border: '1px solid #f59e0b',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer'
  },
  taskTabActiveOngoing: {
    padding: '6px 12px',
    background: '#f0f9ff',
    color: '#0284c7',
    border: '1px solid #0284c7',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer'
  },
  taskTabActiveCompleted: {
    padding: '6px 12px',
    background: '#ecfdf5',
    color: '#059669',
    border: '1px solid #10b981',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer'
  },
  taskTabActiveOverdue: {
    padding: '6px 12px',
    background: '#fff1f2',
    color: '#e11d48',
    border: '1px solid #f43f5e',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '13px'
  },
  th: {
    background: '#f8fafc',
    color: '#475569',
    padding: '12px 18px',
    fontWeight: '700',
    fontSize: '12px',
    borderBottom: '1px solid #e2e8f0',
    whiteSpace: 'nowrap'
  },
  td: {
    padding: '14px 18px',
    borderBottom: '1px solid #f1f5f9',
    verticalAlign: 'top',
    color: '#334155'
  },
  clickableTr: {
    cursor: 'pointer',
    transition: 'background 0.15s ease'
  },
  taskCodeBadge: {
    fontFamily: 'monospace',
    fontWeight: '700',
    fontSize: '11.5px',
    background: '#f1f5f9',
    color: '#0f172a',
    padding: '3px 7px',
    borderRadius: '4px',
    border: '1px solid #cbd5e1',
    display: 'inline-block'
  },
  taskCodeBadgeLarge: {
    fontFamily: 'monospace',
    fontWeight: '700',
    fontSize: '14px',
    background: '#f1f5f9',
    color: '#0f172a',
    padding: '3px 8px',
    borderRadius: '4px',
    border: '1px solid #cbd5e1'
  },
  overdueBadge: {
    fontSize: '10.5px',
    background: '#fee2e2',
    color: '#e11d48',
    padding: '1px 6px',
    borderRadius: '3px',
    fontWeight: 'bold',
    display: 'inline-block',
    marginTop: '3px'
  },
  startTaskBtn: {
    padding: '5px 10px',
    background: '#0284c7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '11.5px',
    fontWeight: 'bold',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  detailsBtn: {
    padding: '5px 10px',
    background: '#f8fafc',
    color: '#334155',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    fontSize: '11.5px',
    fontWeight: 'bold',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },

  // ============================================================
  // SOLID OVERLAY MODAL STYLES (NO TRANSPARENT BLEED-THROUGH)
  // ============================================================
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(15, 23, 42, 0.65)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: '20px'
  },
  modalContent: {
    background: '#ffffff',
    borderRadius: '10px',
    width: '100%',
    maxWidth: '560px',
    maxHeight: '90vh',
    overflowY: 'auto',
    padding: '28px',
    boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.35)',
    border: '1px solid #e2e8f0'
  },
  taskDetailModalContent: {
    background: '#ffffff',
    borderRadius: '10px',
    width: '100%',
    maxWidth: '680px',
    maxHeight: '90vh',
    overflowY: 'auto',
    padding: '26px',
    boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.35)',
    border: '1px solid #e2e8f0'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '16px',
    marginBottom: '18px'
  },
  modalTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: '700',
    color: '#0f172a'
  },
  modalSubtitle: {
    margin: '4px 0 0',
    fontSize: '13px',
    color: '#64748b'
  },
  closeBtn: {
    background: '#f1f5f9',
    border: 'none',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    fontSize: '15px',
    cursor: 'pointer',
    color: '#475569',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px'
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px'
  },
  label: {
    fontSize: '12.5px',
    fontWeight: 'bold',
    color: '#334155'
  },
  input: {
    padding: '10px 12px',
    borderRadius: '4px',
    border: '1px solid #cbd5e1',
    fontSize: '13.5px',
    background: '#ffffff',
    color: '#0f172a'
  },
  lockedField: {
    padding: '10px 12px',
    borderRadius: '4px',
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    fontSize: '13.5px',
    display: 'flex',
    flexDirection: 'column'
  },
  lockedNote: {
    fontSize: '11px',
    color: '#64748b',
    marginTop: '2px'
  },
  buttonGroup: {
    display: 'flex',
    gap: '10px',
    marginTop: '10px',
    paddingTop: '12px',
    borderTop: '1px solid #f1f5f9'
  },
  button: {
    flex: '1',
    padding: '10px',
    background: '#0284c7',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '13.5px'
  },
  cancelButton: {
    padding: '10px 18px',
    background: '#f1f5f9',
    color: '#334155',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '13.5px'
  },
  errorBox: {
    padding: '10px 14px',
    background: '#fff1f2',
    color: '#e11d48',
    borderRadius: '4px',
    fontSize: '13px',
    border: '1px solid #fecdd3',
    marginBottom: '14px'
  },
  detailSectionBox: {
    background: '#f8fafc',
    padding: '14px 16px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0'
  },
  detailSectionHeading: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#475569',
    textTransform: 'uppercase',
    marginBottom: '8px'
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '10px',
    fontSize: '13px'
  },
  assigneePillMini: {
    padding: '2px 8px',
    background: '#e2e8f0',
    color: '#334155',
    borderRadius: '4px',
    fontSize: '11.5px',
    fontWeight: '600'
  }
};

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_BASE, fetchCachedJson } from '../utils/api';
import BlobLoader from '../components/BlobLoader';
import Navbar from '../components/Navbar';
import { usePermissions } from '../utils/permissionHelper';

export default function TaskAllocation() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();

  // Primary Data States
  const [tasks, setTasks] = useState([]);
  const [loes, setLoes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [services, setServices] = useState([]);
  
  const [groupedServices, setGroupedServices] = useState([]);
  const [selectedServiceGroup, setSelectedServiceGroup] = useState(null);
  
  // Authentication & Permissions
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : null;
  const userDeptId = user?.department_id || 1;
  
  const isAdmin = user?.role === 'ADMIN';
  const isManager = user?.role === 'MANAGER';
  const isEmployee = !isAdmin && !isManager; 

  const canViewTasks = hasPermission(user, 'VIEW_TASKS');
  const canManage = hasPermission(user, 'MANAGE_TASKS');

  // Navigation View & Tab Modes (Employees default to tracker list)
  const [activeView, setActiveView] = useState(isEmployee ? 'tracker' : 'allocation'); // 'allocation' | 'tracker'
  const [assignmentTab, setAssignmentTab] = useState('ALL'); // 'ALL' | 'UNASSIGNED' | 'ASSIGNED'
  const [trackerDisplayMode, setTrackerDisplayMode] = useState('list'); // 'list' | 'board'

  // Modals & Details
  const [selectedTaskDetail, setSelectedTaskDetail] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [empSearch, setEmpSearch] = useState('');
  const [customEmpSearch, setCustomEmpSearch] = useState('');
  const [remindingTaskId, setRemindingTaskId] = useState(null);

  // Multi-Task Selection for Starting Tasks
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);

  // Status & Feedback
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [validationWarning, setValidationWarning] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(true);

  // Filter States
  const [filterCompany, setFilterCompany] = useState(() => location.state?.filterCompany || '');
  const [filterService, setFilterService] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterAssignee, setFilterAssignee] = useState('ALL');
  const [filterDepartment, setFilterDepartment] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Allocation Form State
  const [serviceDeadline, setServiceDeadline] = useState('');
  const [formScopes, setFormScopes] = useState([]);

  // Custom Task Creation Form State
  const [newTaskForm, setNewTaskForm] = useState({
    loe_id: '',
    department_id: isAdmin ? '' : userDeptId,
    service_id: '',
    scope: '',
    duration_days: '',
    deadline: '',
    comments: '',
    assignee_ids: [],
    status: 'Pending'
  });

  useEffect(() => {
    const init = async () => {
      setLoadingTasks(true);
      await Promise.all([
        fetchTasks(),
        (!isEmployee || canManage) ? fetchLoes() : Promise.resolve(),
        fetchEmployees(),
        fetchCompanies(),
        fetchServices(),
        isAdmin ? fetchDepartments() : Promise.resolve()
      ]);
      setLoadingTasks(false);
    };
    init();
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
      let url = `${API_BASE}/api/tasks?emp_id=${user?.emp_id}&role=EMPLOYEE`;
      if (isAdmin) {
        url = `${API_BASE}/api/tasks?role=ADMIN`;
      } else if (isManager) {
        url = `${API_BASE}/api/tasks?department_id=${userDeptId}&role=MANAGER`;
      }

      const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await response.json();
      if (response.ok) setTasks(Array.isArray(data) ? data : []);
    } catch (err) { setError('Failed to load tasks'); }
  };

  const fetchLoes = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/loes`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await response.json();
      if (response.ok) setLoes(Array.isArray(data) ? data : []);
    } catch (err) {}
  };

  const fetchEmployees = async () => {
    try {
      const url = isAdmin ? `${API_BASE}/api/employees` : `${API_BASE}/api/employees?department_id=${userDeptId}`;
      const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await response.json();
      if (response.ok) setEmployees(Array.isArray(data) ? data : []);
    } catch (err) {}
  };

  const fetchCompanies = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/companies`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await response.json();
      if (response.ok) setCompanies(Array.isArray(data) ? data : data.companies || []);
    } catch (err) {}
  };

  const fetchServices = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/services`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await response.json();
      if (response.ok) setServices(Array.isArray(data) ? data : []);
    } catch (err) {}
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/departments`);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) setDepartments(data);
    } catch (err) {}
  };

  // Helper date utilities
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not set';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'Not set';
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return 'Not set';
    }
  };

  const isOverdue = (deadlineStr, status) => {
    if (!deadlineStr || status === 'Completed' || status === 'Discontinued') return false;
    const deadlineDate = new Date(deadlineStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return deadlineDate < today;
  };

  const handleRowClick = (group) => {
    setSelectedServiceGroup(group);
    setEmpSearch('');
    
    const existingDeadline = group.scopes.find(s => s.service_deadline)?.service_deadline;
    setServiceDeadline(existingDeadline ? existingDeadline.split('T')[0] : '');

    setFormScopes(group.scopes.map(s => ({
      task_id: s.task_id,
      task_code: s.task_code,
      scope: s.scope,
      duration_days: s.duration_days || '',
      calculated_deadline: s.deadline ? s.deadline.split('T')[0] : null,
      comments: s.comments || '',
      assignee_ids: s.assignees ? s.assignees.map(a => a.emp_id) : []
    })));
    setValidationWarning('');
    setError('');
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

    const loe = selectedServiceGroup?.job?.loe;
    const isClientConfirmed = loe?.is_client_accepted || loe?.status === 'Approved';
    const hasAnyAssignee = formScopes.some(s => s.assignee_ids && s.assignee_ids.length > 0);

    if (hasAnyAssignee && !isClientConfirmed) {
      setError('Tasks cannot be allocated to team members until the client has officially accepted/approved the Letter of Engagement.');
      setSaving(false);
      return;
    }

    try {
      for (const scopeItem of formScopes) {
        if (!scopeItem.calculated_deadline && serviceDeadline) {
          scopeItem.calculated_deadline = serviceDeadline;
        }

        const payload = {
          assignee_ids: scopeItem.assignee_ids,
          service_deadline: serviceDeadline || null,
          deadline: scopeItem.calculated_deadline || null,
          duration_days: scopeItem.duration_days ? parseInt(scopeItem.duration_days) : null,
          comments: scopeItem.comments || null
          // NOTE: Status is intentionally not included here, preserving task lifecycle status.
        };

        const response = await fetch(`${API_BASE}/api/tasks/${scopeItem.task_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const d = await response.json().catch(() => ({}));
          throw new Error(d.error || 'Failed to save task allocation');
        }
      }

      await fetchTasks();
      setSelectedServiceGroup(null);
      setSuccessMsg('Task allocation successfully saved.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusUpdate = async (taskId, newStatus) => {
    try {
      setSaving(true);
      setError('');
      const response = await fetch(`${API_BASE}/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update task status');

      setTasks(prev => prev.map(t => t.task_id === taskId ? { ...t, status: newStatus } : t));
      if (selectedTaskDetail && selectedTaskDetail.task_id === taskId) {
        setSelectedTaskDetail(prev => ({ ...prev, status: newStatus }));
      }
      setSuccessMsg(`Task marked as ${newStatus}`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStartTask = async (taskId) => {
    await handleStatusUpdate(taskId, 'In-Progress');
  };

  const handleStartSelectedTasks = async () => {
    const pendingSelected = tasks.filter(t => selectedTaskIds.includes(t.task_id) && t.status === 'Pending');
    if (pendingSelected.length === 0) {
      setSuccessMsg('Selected tasks are already in progress or completed.');
      setTimeout(() => setSuccessMsg(''), 3000);
      return;
    }
    try {
      setSaving(true);
      setError('');
      for (const t of pendingSelected) {
        await fetch(`${API_BASE}/api/tasks/${t.task_id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ status: 'In-Progress' })
        });
      }
      setTasks(prev => prev.map(t => selectedTaskIds.includes(t.task_id) && t.status === 'Pending' ? { ...t, status: 'In-Progress' } : t));
      setSuccessMsg(`Successfully started ${pendingSelected.length} task(s)!`);
      setSelectedTaskIds([]);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to start selected tasks');
    } finally {
      setSaving(false);
    }
  };

  const toggleSelectTask = (taskId) => {
    setSelectedTaskIds(prev => prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]);
  };

  const toggleSelectAll = (filteredList) => {
    const allIds = filteredList.map(t => t.task_id);
    const allSelected = allIds.length > 0 && allIds.every(id => selectedTaskIds.includes(id));
    if (allSelected) {
      setSelectedTaskIds(prev => prev.filter(id => !allIds.includes(id)));
    } else {
      setSelectedTaskIds(prev => Array.from(new Set([...prev, ...allIds])));
    }
  };

  const handleFilterByStaff = (empId, empName) => {
    setFilterAssignee(String(empId));
    setActiveView('tracker');
    setSuccessMsg(`Showing tasks assigned to: ${empName}`);
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  const handleClearStaffFilter = () => {
    setFilterAssignee('ALL');
  };

  const handleSendReminder = async (taskId) => {
    try {
      setRemindingTaskId(taskId);
      const response = await fetch(`${API_BASE}/api/tasks/${taskId}/remind`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send reminders');

      alert('Deadline reminder dispatched successfully to assigned team members.');
      await fetchTasks();
    } catch (err) {
      alert(err.message || 'Failed to send reminder');
    } finally {
      setRemindingTaskId(null);
    }
  };

  const handleCreateCustomTask = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const selectedLoe = loes.find(l => String(l.loe_id) === String(newTaskForm.loe_id));
      const isClientConfirmed = selectedLoe?.is_client_accepted || selectedLoe?.status === 'Approved';
      if (newTaskForm.assignee_ids.length > 0 && !isClientConfirmed) {
        throw new Error('Tasks cannot be assigned to team members until the client has accepted the Letter of Engagement.');
      }

      const payload = {
        ...newTaskForm,
        deadline: newTaskForm.deadline || null,
        duration_days: newTaskForm.duration_days ? parseInt(newTaskForm.duration_days) : null
      };

      const response = await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create custom task');

      await fetchTasks();
      setIsCreateOpen(false);
      setNewTaskForm({
        loe_id: '',
        department_id: isAdmin ? '' : userDeptId,
        service_id: '',
        scope: '',
        duration_days: '',
        deadline: '',
        comments: '',
        assignee_ids: [],
        status: 'Pending'
      });
      setSuccessMsg('Custom task created successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
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
    setSearchQuery('');
  };

  // Metrics Calculation
  const totalTasksCount = tasks.length;
  const unassignedTasksCount = tasks.filter(t => !t.assignees || t.assignees.length === 0).length;
  const assignedTasksCount = tasks.filter(t => t.assignees && t.assignees.length > 0).length;
  const pendingTasksCount = tasks.filter(t => t.status === 'Pending').length;
  const ongoingTasksCount = tasks.filter(t => t.status === 'In-Progress' || t.status === 'Ongoing').length;
  const completedTasksCount = tasks.filter(t => t.status === 'Completed').length;
  const overdueTasksCount = tasks.filter(t => isOverdue(t.deadline, t.status)).length;

  // Filter Logic for Allocation Groups
  const filteredGroups = groupedServices.filter(group => {
    const companyName = (group.job?.loe?.company?.name || '').toLowerCase();
    const serviceId = Number(group.service_id);
    const deptId = Number(group.service?.department_id);

    if (filterCompany && !companyName.includes(filterCompany.toLowerCase())) return false;
    if (filterService !== 'ALL' && serviceId !== Number(filterService)) return false;
    if (isAdmin && filterDepartment !== 'ALL' && deptId !== Number(filterDepartment)) return false;

    // Assignment Tab Filter
    if (assignmentTab === 'UNASSIGNED') {
      const hasUnassigned = group.scopes.some(s => !s.assignees || s.assignees.length === 0);
      if (!hasUnassigned) return false;
    } else if (assignmentTab === 'ASSIGNED') {
      const hasAssigned = group.scopes.some(s => s.assignees && s.assignees.length > 0);
      if (!hasAssigned) return false;
    }

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
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const codeMatch = (t.task_code || '').toLowerCase().includes(q);
        const scopeMatch = (t.scope || '').toLowerCase().includes(q);
        if (!codeMatch && !scopeMatch) return false;
      }
      return true;
    });

    return matchesSubItems;
  });

  // Filter Logic for Status Tracker Tasks
  const filteredTasks = tasks.filter(t => {
    const companyName = (t.job?.loe?.company?.name || '').toLowerCase();
    const serviceId = Number(t.service_id);
    const deptId = Number(t.service?.department_id);

    if (filterCompany && !companyName.includes(filterCompany.toLowerCase())) return false;
    if (filterService !== 'ALL' && serviceId !== Number(filterService)) return false;
    if (isAdmin && filterDepartment !== 'ALL' && deptId !== Number(filterDepartment)) return false;

    // Assignment Tab Filter
    const isUnassigned = !t.assignees || t.assignees.length === 0;
    if (assignmentTab === 'UNASSIGNED' && !isUnassigned) return false;
    if (assignmentTab === 'ASSIGNED' && isUnassigned) return false;

    if (filterStatus !== 'ALL') {
      const stat = t.status === 'Ongoing' ? 'In-Progress' : t.status;
      const targetStat = filterStatus === 'Ongoing' ? 'In-Progress' : filterStatus;
      if (stat !== targetStat && t.status !== filterStatus) return false;
    }
    if (filterAssignee !== 'ALL') {
      const hasAssignee = (t.assignees || []).some(a => Number(a.emp_id) === Number(filterAssignee));
      if (!hasAssignee) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const codeMatch = (t.task_code || '').toLowerCase().includes(q);
      const scopeMatch = (t.scope || '').toLowerCase().includes(q);
      const compMatch = companyName.includes(q);
      if (!codeMatch && !scopeMatch && !compMatch) return false;
    }
    return true;
  });

  const hasActiveFilters = 
    filterCompany !== '' || 
    filterService !== 'ALL' || 
    filterStatus !== 'ALL' || 
    filterAssignee !== 'ALL' || 
    searchQuery !== '' ||
    (isAdmin && filterDepartment !== 'ALL');

  // Compute available services for custom task creation based on selected LOE
  const selectedCustomLoe = loes.find(l => String(l.loe_id) === String(newTaskForm.loe_id));
  const availableServicesForSelectedLoe = selectedCustomLoe?.loe_items
    ? Array.from(new Map(selectedCustomLoe.loe_items.map(item => [item.service_id, item.service])).values()).filter(Boolean)
    : [];

  const renderStatusBadge = (status) => {
    const norm = status === 'Ongoing' ? 'In-Progress' : status;
    if (norm === 'Completed') {
      return <span style={{ ...styles.badge, background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>Completed</span>;
    }
    if (norm === 'In-Progress') {
      return <span style={{ ...styles.badge, background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd' }}>Ongoing</span>;
    }
    if (norm === 'Discontinued') {
      return <span style={{ ...styles.badge, background: '#f8fafc', color: '#64748b', border: '1px solid #cbd5e1' }}>Discontinued</span>;
    }
    return <span style={{ ...styles.badge, background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }}>Pending</span>;
  };

  if (!canViewTasks) {
    return (
      <div style={styles.pageContainer}>
        <Navbar />
        <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
          <h2>Access Denied</h2>
          <p>You do not have permission to access the Task Allocation module.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer}>
      <Navbar />
      <div style={styles.container}>
        
        {/* Header Row */}
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.pageTitle}>Task Allocation &amp; Management</h1>
            <p style={styles.subTitle}>
              Assign deliverables to team members, track milestones, and manage task lifecycles.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* View Mode Toggle */}
            <div style={styles.viewToggleContainer}>
              <button
                type="button"
                onClick={() => setActiveView('allocation')}
                style={activeView === 'allocation' ? styles.viewToggleBtnActive : styles.viewToggleBtn}
              >
                Allocation Board
              </button>
              <button
                type="button"
                onClick={() => setActiveView('tracker')}
                style={activeView === 'tracker' ? styles.viewToggleBtnActive : styles.viewToggleBtn}
              >
                Task Status Tracker
              </button>
            </div>

            {canManage && (
              <button onClick={() => setIsCreateOpen(true)} style={styles.createTaskBtn}>
                + Create Custom Task
              </button>
            )}
          </div>
        </div>

        {/* Global KPI Metrics Bar */}
        <div style={styles.kpiGrid}>
          <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>Total Tasks</div>
            <div style={{ ...styles.kpiValue, color: '#0f172a' }}>{totalTasksCount}</div>
            <div style={styles.kpiSub}>Across all active LOEs</div>
          </div>
          <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>Unassigned</div>
            <div style={{ ...styles.kpiValue, color: '#d97706' }}>{unassignedTasksCount}</div>
            <div style={styles.kpiSub}>Awaiting staff allocation</div>
          </div>
          <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>Assigned</div>
            <div style={{ ...styles.kpiValue, color: '#059669' }}>{assignedTasksCount}</div>
            <div style={styles.kpiSub}>In execution pipeline</div>
          </div>
          <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>Ongoing</div>
            <div style={{ ...styles.kpiValue, color: '#0284c7' }}>{ongoingTasksCount}</div>
            <div style={styles.kpiSub}>Active deliverables</div>
          </div>
          <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>Overdue</div>
            <div style={{ ...styles.kpiValue, color: '#e11d48' }}>{overdueTasksCount}</div>
            <div style={styles.kpiSub}>Passed deadline</div>
          </div>
        </div>

        {/* Filter Bar */}
        <div style={styles.filterBar}>
          <div style={styles.filterField}>
            <label style={styles.filterLabel}>Quick Search (Code / Scope)</label>
            <input
              type="text"
              placeholder="Search code or deliverable..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.filterInput}
            />
          </div>

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

        {/* Assigned vs Unassigned Navigation Toggle */}
        <div style={styles.toggleRowContainer}>
          <div style={styles.tabContainer}>
            <button
              type="button"
              onClick={() => setAssignmentTab('ALL')}
              style={assignmentTab === 'ALL' ? styles.activeTab : styles.tab}
            >
              All Tasks ({totalTasksCount})
            </button>
            <button
              type="button"
              onClick={() => setAssignmentTab('UNASSIGNED')}
              style={assignmentTab === 'UNASSIGNED' ? { ...styles.activeTab, borderBottomColor: '#f59e0b', color: '#b45309' } : styles.tab}
            >
              Unassigned Tasks ({unassignedTasksCount})
            </button>
            <button
              type="button"
              onClick={() => setAssignmentTab('ASSIGNED')}
              style={assignmentTab === 'ASSIGNED' ? { ...styles.activeTab, borderBottomColor: '#059669', color: '#059669' } : styles.tab}
            >
              Assigned Tasks ({assignedTasksCount})
            </button>
          </div>

          {/* Quick Segmented Toggle Pill Feature */}
          <div style={styles.segmentToggleBox}>
            <span style={styles.segmentLabel}>Toggle Filter:</span>
            <button
              type="button"
              onClick={() => setAssignmentTab('ALL')}
              style={assignmentTab === 'ALL' ? styles.segmentPillActiveAll : styles.segmentPill}
            >
              All ({totalTasksCount})
            </button>
            <button
              type="button"
              onClick={() => setAssignmentTab('UNASSIGNED')}
              style={assignmentTab === 'UNASSIGNED' ? styles.segmentPillActiveUnassigned : styles.segmentPill}
            >
              Unassigned ({unassignedTasksCount})
            </button>
            <button
              type="button"
              onClick={() => setAssignmentTab('ASSIGNED')}
              style={assignmentTab === 'ASSIGNED' ? styles.segmentPillActiveAssigned : styles.segmentPill}
            >
              Assigned ({assignedTasksCount})
            </button>
          </div>
        </div>

        {error && <div style={styles.errorBanner}>{error}</div>}
        {successMsg && <div style={styles.successBanner}>{successMsg}</div>}

                {loadingTasks ? (
          <div style={{ ...styles.card, padding: '50px 20px', minHeight: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BlobLoader message="Loading task allocations & tracker workspace..." size="large" />
          </div>
        ) : (
          <>
{/* VIEW 1: ALLOCATION BOARD TABLE */}
        {activeView === 'allocation' && (
          <div style={styles.card}>
            {filteredGroups.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#64748b', padding: '40px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '15px' }}>No service allocations found</div>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>Try switching assignment tabs or clearing active search filters.</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Company</th>
                      <th style={styles.th}>Service &amp; Department</th>
                      <th style={{ ...styles.th, minWidth: '220px' }}>Scopes / Deliverables</th>
                      <th style={styles.th}>Service Deadline</th>
                      <th style={styles.th}>Assignees</th>
                      <th style={styles.th}>Status</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGroups.map(group => {
                      const companyName = group.job?.loe?.company?.name || 'N/A';
                      const serviceName = group.service?.name || 'Service';
                      const deptName = group.service?.department?.name || 'General';
                      const deadline = group.scopes.find(s => s.service_deadline)?.service_deadline;

                      const allAssignees = [];
                      let hasUnassignedScope = false;
                      group.scopes.forEach(s => {
                        if (!s.assignees || s.assignees.length === 0) {
                          hasUnassignedScope = true;
                        } else {
                          s.assignees.forEach(a => {
                            if (!allAssignees.some(item => item.emp_id === a.emp_id)) {
                              allAssignees.push(a);
                            }
                          });
                        }
                      });

                      const firstScope = group.scopes[0] || {};

                      return (
                        <tr key={group.key} style={styles.tr}>
                          <td style={{ ...styles.td, fontWeight: 'bold', color: '#0284c7' }}>
                            {companyName}
                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>
                              {group.job?.loe?.loe_code || `LOE #${group.job?.loe_id}`}
                            </div>
                          </td>
                          <td style={styles.td}>
                            <strong>{serviceName}</strong>
                            <div style={{ fontSize: '11.5px', color: '#64748b' }}>{deptName}</div>
                          </td>
                          {/* Scopes & Needs Assignee Badge - Fixed placement and no clipping */}
                          <td style={{ ...styles.td, minWidth: '220px' }}>
                            <div style={styles.scopeCell}>
                              <span style={styles.scopeCountBadge}>
                                {group.scopes.length} {group.scopes.length === 1 ? 'Scope' : 'Scopes'}
                              </span>
                              {hasUnassignedScope && (
                                <span style={styles.needsAssigneeBadge}>
                                  Needs Assignee
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={styles.td}>
                            {deadline ? formatDate(deadline) : <span style={{ color: '#94a3b8' }}>Not set</span>}
                          </td>
                          <td style={styles.td}>
                            {allAssignees.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {allAssignees.map(a => (
                                  <span 
                                    key={a.emp_id} 
                                    onClick={() => handleFilterByStaff(a.emp_id, a.name)}
                                    style={styles.assigneePillClickable}
                                    title={`Click to filter tasks assigned to ${a.name}`}
                                  >
                                    {a.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: '#d97706', fontWeight: '600', fontSize: '12px' }}>Unassigned</span>
                            )}
                          </td>
                          <td style={styles.td}>
                            {group.scopes.every(s => s.status === 'Completed') ? (
                              <span style={{ ...styles.badge, background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>Completed</span>
                            ) : group.scopes.some(s => s.status === 'In-Progress' || s.status === 'Ongoing') ? (
                              <span style={{ ...styles.badge, background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd' }}>Ongoing</span>
                            ) : (
                              <span style={{ ...styles.badge, background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }}>Pending</span>
                            )}
                          </td>
                          <td style={{ ...styles.td, textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => setSelectedTaskDetail(firstScope)}
                                style={styles.actionIconBtn}
                                title="View Task Details"
                              >
                                Details
                              </button>
                              {canManage && (
                                <button
                                  type="button"
                                  onClick={() => handleRowClick(group)}
                                  style={styles.actionPrimaryBtn}
                                  title="Configure Duration, Deadlines & Assignees"
                                >
                                  Allocate
                                </button>
                              )}
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
        )}

        {/* VIEW 2: TASK STATUS TRACKER (Default List View with View Toggle & Assigned/Unassigned Filter) */}
        {activeView === 'tracker' && (
          <div>
            

            {/* Batch Action Toolbar when tasks are selected */}
            {selectedTaskIds.length > 0 && (
              <div style={styles.batchToolbar}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '13.5px', color: '#ffffff' }}>
                    {selectedTaskIds.length} Task{selectedTaskIds.length === 1 ? '' : 's'} Selected
                  </span>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                    ({tasks.filter(t => selectedTaskIds.includes(t.task_id) && t.status === 'Pending').length} Pending to Start)
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={handleStartSelectedTasks}
                    disabled={saving}
                    style={styles.batchStartBtn}
                  >
                    Start Selected Tasks ({tasks.filter(t => selectedTaskIds.includes(t.task_id) && t.status === 'Pending').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTaskIds([])}
                    style={styles.batchClearBtn}
                  >
                    Cancel Selection
                  </button>
                </div>
              </div>
            )}

            <div style={styles.trackerNotice}>
              <div>
                <strong>Task Status Tracking &amp; Progression</strong>
                <div style={{ fontSize: '12.5px', color: '#475569', marginTop: '2px' }}>
                  Click any task or staff member to view full details and deadlines. Select tasks to start them immediately.
                </div>
              </div>

              {/* Display Mode Switcher (List View vs Board View) */}
              <div style={styles.displayModeGroup}>
                <button
                  type="button"
                  onClick={() => setTrackerDisplayMode('list')}
                  style={trackerDisplayMode === 'list' ? styles.modeBtnActive : styles.modeBtn}
                >
                  List View
                </button>
                <button
                  type="button"
                  onClick={() => setTrackerDisplayMode('board')}
                  style={trackerDisplayMode === 'board' ? styles.modeBtnActive : styles.modeBtn}
                >
                  Board View
                </button>
              </div>
            </div>

            {filteredTasks.length === 0 ? (
              <div style={{ ...styles.card, padding: '40px', textAlign: 'center', color: '#64748b' }}>
                <div style={{ fontWeight: 'bold', fontSize: '15px' }}>No tasks found for the selected criteria.</div>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>Try switching between All, Assigned, and Unassigned tabs.</div>
              </div>
            ) : trackerDisplayMode === 'list' ? (
              /* PRIMARY LIST VIEW TABLE FOR TASK STATUS TRACKER */
              <div style={styles.card}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={{ ...styles.th, width: '40px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={filteredTasks.length > 0 && filteredTasks.every(t => selectedTaskIds.includes(t.task_id))}
                            onChange={() => toggleSelectAll(filteredTasks)}
                            title="Select / Deselect all visible tasks"
                            style={{ cursor: 'pointer' }}
                          />
                        </th>
                        <th style={styles.th}>Task Code</th>
                        <th style={styles.th}>Company &amp; LOE</th>
                        <th style={styles.th}>Service &amp; Scope</th>
                        <th style={styles.th}>Deadline</th>
                        <th style={styles.th}>Duration</th>
                        <th style={styles.th}>Assignees</th>
                        <th style={styles.th}>Status</th>
                        <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTasks.map(t => {
                        const overdue = isOverdue(t.deadline, t.status);
                        const isUnassigned = !t.assignees || t.assignees.length === 0;

                        const isSelected = selectedTaskIds.includes(t.task_id);

                        return (
                          <tr 
                            key={t.task_id} 
                            style={{ 
                              ...styles.tr, 
                              cursor: 'pointer',
                              background: isSelected ? '#f0f9ff' : 'transparent' 
                            }}
                            onClick={() => setSelectedTaskDetail(t)}
                          >
                            <td style={{ ...styles.td, width: '40px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectTask(t.task_id)}
                                style={{ cursor: 'pointer' }}
                              />
                            </td>
                            <td style={styles.td}>
                              <span style={styles.taskCodeBadge}>
                                {t.task_code || `TASK #${t.task_id}`}
                              </span>
                            </td>
                            <td style={styles.td}>
                              <div style={{ fontWeight: 'bold', color: '#0f172a' }}>
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
                              <div style={{ fontSize: '12px', color: '#475569', maxWidth: '300px' }}>
                                {t.scope || 'Standard deliverable'}
                              </div>
                              {t.comments && (
                                <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', marginTop: '2px' }}>
                                  Note: {t.comments}
                                </div>
                              )}
                            </td>
                            <td style={styles.td}>
                              <div style={{ fontWeight: overdue ? 'bold' : 'normal', color: overdue ? '#e11d48' : '#334155' }}>
                                {formatDate(t.deadline)}
                              </div>
                              {overdue && (
                                <span style={{ ...styles.badge, background: '#fee2e2', color: '#e11d48', border: '1px solid #fecdd3', marginTop: '3px' }}>
                                  Overdue
                                </span>
                              )}
                            </td>
                            <td style={styles.td}>
                              {t.duration_days ? `${t.duration_days}d` : '-'}
                            </td>
                            <td style={styles.td}>
                              {isUnassigned ? (
                                <span style={styles.unassignedBadge}>Unassigned</span>
                              ) : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                  {t.assignees.map(a => (
                                    <span 
                                      key={a.emp_id} 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleFilterByStaff(a.emp_id, a.name);
                                      }}
                                      style={styles.assigneePillClickable}
                                      title={`Click to filter tasks assigned to ${a.name}`}
                                    >
                                      {a.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td style={styles.td} onClick={e => e.stopPropagation()}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <select
                                  value={t.status === 'Ongoing' ? 'In-Progress' : t.status}
                                  onChange={(e) => handleStatusUpdate(t.task_id, e.target.value)}
                                  disabled={saving}
                                  style={getStatusSelectStyle(t.status)}
                                >
                                  <option value="Pending">Pending</option>
                                  <option value="In-Progress">Ongoing</option>
                                  <option value="Completed">Completed</option>
                                </select>
                                {t.status === 'Pending' && (
                                  <button
                                    type="button"
                                    onClick={() => handleStartTask(t.task_id)}
                                    disabled={saving}
                                    style={styles.startTaskBtn}
                                    title="Start this task now (Move to Ongoing)"
                                  >
                                    Start Task
                                  </button>
                                )}
                              </div>
                            </td>
                            <td style={{ ...styles.td, textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                              <div style={{ display: 'inline-flex', gap: '6px' }}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedTaskDetail(t)}
                                  style={styles.actionIconBtn}
                                >
                                  Details
                                </button>
                                {t.status !== 'Completed' && t.assignees?.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleSendReminder(t.task_id)}
                                    disabled={remindingTaskId === t.task_id}
                                    style={styles.remindTableBtn}
                                    title="Dispatch reminder to assignees"
                                  >
                                    Remind
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* KANBAN BOARD VIEW FOR TASK STATUS TRACKER */
              <div style={styles.statusColumnsContainer}>
                {/* Column 1: Pending */}
                <div style={styles.statusColumn}>
                  <div style={{ ...styles.statusColumnHeader, borderTopColor: '#f59e0b' }}>
                    <div style={{ fontWeight: 'bold', color: '#b45309', display: 'flex', justifyContent: 'space-between' }}>
                      <span>PENDING</span>
                      <span style={styles.columnCountBadge}>
                        {filteredTasks.filter(t => t.status === 'Pending').length}
                      </span>
                    </div>
                  </div>
                  <div style={styles.statusCardsFeed}>
                    {filteredTasks
                      .filter(t => t.status === 'Pending')
                      .map(t => renderTaskCard(t))}
                  </div>
                </div>

                {/* Column 2: In-Progress / Ongoing */}
                <div style={styles.statusColumn}>
                  <div style={{ ...styles.statusColumnHeader, borderTopColor: '#0284c7' }}>
                    <div style={{ fontWeight: 'bold', color: '#0369a1', display: 'flex', justifyContent: 'space-between' }}>
                      <span>ONGOING / IN-PROGRESS</span>
                      <span style={styles.columnCountBadge}>
                        {filteredTasks.filter(t => t.status === 'In-Progress' || t.status === 'Ongoing').length}
                      </span>
                    </div>
                  </div>
                  <div style={styles.statusCardsFeed}>
                    {filteredTasks
                      .filter(t => t.status === 'In-Progress' || t.status === 'Ongoing')
                      .map(t => renderTaskCard(t))}
                  </div>
                </div>

                {/* Column 3: Completed */}
                <div style={styles.statusColumn}>
                  <div style={{ ...styles.statusColumnHeader, borderTopColor: '#10b981' }}>
                    <div style={{ fontWeight: 'bold', color: '#047857', display: 'flex', justifyContent: 'space-between' }}>
                      <span>COMPLETED</span>
                      <span style={styles.columnCountBadge}>
                        {filteredTasks.filter(t => t.status === 'Completed').length}
                      </span>
                    </div>
                  </div>
                  <div style={styles.statusCardsFeed}>
                    {filteredTasks
                      .filter(t => t.status === 'Completed')
                      .map(t => renderTaskCard(t))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
          </>
        )}

        {/* ALLOCATION MODAL (Pop-up with Comments, Search, Past Date support, NO Status dropdown, NO Emojis) */}
        {selectedServiceGroup && (
          <div style={styles.modalOverlay}>
            <div style={styles.modalContent}>
              <div style={styles.modalHeader}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>
                    Allocate Service: {selectedServiceGroup.service?.name}
                  </h3>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    Set scope deadlines, durations, comments, and assign team members.
                  </div>
                </div>
                <button onClick={() => setSelectedServiceGroup(null)} style={styles.closeBtn}>✕</button>
              </div>

              <div style={styles.modalBody}>
                {/* Company & Client Confirmation Alert */}
                <div style={styles.loeDetailsBox}>
                  <strong>Company:</strong> {selectedServiceGroup.job?.loe?.company?.name || 'N/A'} &nbsp;|&nbsp;
                  <strong>LOE:</strong> {selectedServiceGroup.job?.loe?.loe_code || `LOE #${selectedServiceGroup.job?.loe_id}`} &nbsp;|&nbsp;
                  <strong>Department:</strong> {selectedServiceGroup.service?.department?.name || 'General'}
                </div>

                {/* Client Confirmation Gate Warning */}
                {!(selectedServiceGroup.job?.loe?.is_client_accepted || selectedServiceGroup.job?.loe?.status === 'Approved') && (
                  <div style={styles.clientGateWarning}>
                    <div>
                      <strong>Client Confirmation Required:</strong> Tasks cannot be allocated to team members until the client has officially accepted/approved the Letter of Engagement.
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: '18px' }}>
                  <label style={styles.label}>Master Service Deadline (Historical &amp; Future Dates Supported):</label>
                  <input
                    type="date"
                    value={serviceDeadline}
                    disabled={!canManage}
                    onChange={(e) => setServiceDeadline(e.target.value)}
                    style={styles.selectInput}
                  />
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                    Master deadline serves as the base date for deliverable duration calculations.
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {formScopes.map((scopeItem, idx) => {
                    const isClientApproved = selectedServiceGroup.job?.loe?.is_client_accepted || selectedServiceGroup.job?.loe?.status === 'Approved';
                    const filteredEmps = employees.filter(emp =>
                      emp.name.toLowerCase().includes(empSearch.toLowerCase()) ||
                      (emp.email && emp.email.toLowerCase().includes(empSearch.toLowerCase()))
                    );

                    return (
                      <div key={scopeItem.task_id} style={styles.scopeAssignmentCard}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <div style={{ fontSize: '13.5px', fontWeight: 'bold', color: '#1e293b' }}>
                            Scope #{idx + 1}: {scopeItem.scope || 'Standard Deliverable'}
                          </div>
                          <span style={styles.taskCodeBadge}>
                            {scopeItem.task_code || `TASK #${scopeItem.task_id}`}
                          </span>
                        </div>

                        <div style={styles.formRow}>
                          <div style={styles.formCol}>
                            <label style={styles.label}>Duration (Days):</label>
                            <input
                              type="number"
                              min="1"
                              placeholder="e.g. 5"
                              disabled={!canManage}
                              value={scopeItem.duration_days}
                              onChange={(e) => handleDurationChange(idx, e.target.value)}
                              style={styles.selectInput}
                            />
                          </div>

                          <div style={styles.formCol}>
                            <label style={styles.label}>Calculated / Task Deadline:</label>
                            <input
                              type="date"
                              disabled={!canManage}
                              value={scopeItem.calculated_deadline ? scopeItem.calculated_deadline.split('T')[0] : ''}
                              onChange={(e) => {
                                const updated = [...formScopes];
                                updated[idx].calculated_deadline = e.target.value;
                                setFormScopes(updated);
                              }}
                              style={styles.selectInput}
                            />
                          </div>
                        </div>

                        {/* Comments / Allocation Instructions */}
                        <div style={{ marginTop: '12px' }}>
                          <label style={styles.label}>Allocation Comments / Deliverable Instructions:</label>
                          <textarea
                            rows="2"
                            placeholder="Add specific instructions, client notes, or filing requirements for assignees..."
                            disabled={!canManage}
                            value={scopeItem.comments || ''}
                            onChange={(e) => {
                              const updated = [...formScopes];
                              updated[idx].comments = e.target.value;
                              setFormScopes(updated);
                            }}
                            style={styles.textareaInput}
                          />
                        </div>

                        {/* Assign Employees with Search Filter */}
                        {canManage && (
                          <div style={{ marginTop: '14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <label style={styles.label}>
                                Assign Team Members ({scopeItem.assignee_ids.length} selected):
                              </label>
                              {scopeItem.assignee_ids.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [...formScopes];
                                    updated[idx].assignee_ids = [];
                                    setFormScopes(updated);
                                  }}
                                  style={styles.clearAssigneesBtn}
                                >
                                  Clear Selected
                                </button>
                              )}
                            </div>

                            {/* Search employees input */}
                            <input
                              type="text"
                              placeholder="Search employees by name or email..."
                              value={empSearch}
                              onChange={(e) => setEmpSearch(e.target.value)}
                              disabled={!isClientApproved}
                              style={styles.empSearchInput}
                            />

                            <div style={styles.multiSelectBox}>
                              {!isClientApproved ? (
                                <div style={{ fontSize: '12.5px', color: '#b45309', padding: '6px' }}>
                                  Team member assignment is locked until client confirms the LOE.
                                </div>
                              ) : filteredEmps.length === 0 ? (
                                <div style={{ fontSize: '12.5px', color: '#64748b', padding: '6px' }}>
                                  No employees match your search filter.
                                </div>
                              ) : (
                                filteredEmps.map(emp => {
                                  const checked = scopeItem.assignee_ids.includes(emp.emp_id);
                                  return (
                                    <label key={emp.emp_id} style={styles.empCheckLabel}>
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => handleScopeAssigneeToggle(idx, emp.emp_id)}
                                      />
                                      <span style={{ fontWeight: checked ? 'bold' : 'normal', color: checked ? '#0284c7' : '#334155' }}>
                                        {emp.name}
                                      </span>
                                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                                        ({emp.email})
                                      </span>
                                    </label>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div style={styles.modalActions}>
                  <button type="button" onClick={() => setSelectedServiceGroup(null)} style={styles.cancelBtn}>
                    Cancel
                  </button>
                  <button type="button" onClick={handleSaveAllocation} disabled={saving} style={styles.saveBtn}>
                    {saving ? 'Saving Changes...' : 'Save Allocation'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CUSTOM TASK CREATION MODAL (Strictly displays only services in that selected LOE) */}
        {isCreateOpen && canManage && (
          <div style={styles.modalOverlay}>
            <div style={styles.modalContent}>
              <div style={styles.modalHeader}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>Create Custom Task</h3>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    Generate a specific task deliverable tied directly to an approved client LOE.
                  </div>
                </div>
                <button onClick={() => setIsCreateOpen(false)} style={styles.closeBtn}>✕</button>
              </div>

              <form onSubmit={handleCreateCustomTask} style={styles.modalBody}>
                {/* 1. Select Approved LOE */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={styles.label}>Select Approved Engagement (LOE) *</label>
                  <select
                    value={newTaskForm.loe_id}
                    onChange={(e) => {
                      const selId = e.target.value;
                      setNewTaskForm(prev => ({
                        ...prev,
                        loe_id: selId,
                        service_id: '',
                        scope: ''
                      }));
                    }}
                    required
                    style={styles.selectInput}
                  >
                    <option value="" disabled>-- Select Approved LOE --</option>
                    {loes.filter(l => l.status === 'Approved').map(l => (
                      <option key={l.loe_id} value={l.loe_id}>
                        {l.loe_code || `LOE #${l.loe_id}`} &bull; {l.company?.name || 'Client'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Select Service (STRICTLY filtered to services belonging to this LOE) */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={styles.label}>
                    Select Service (Filtered strictly to services in this LOE) *
                  </label>
                  <select
                    value={newTaskForm.service_id}
                    disabled={!newTaskForm.loe_id}
                    onChange={(e) => {
                      const sId = e.target.value;
                      const item = selectedCustomLoe?.loe_items?.find(it => String(it.service_id) === String(sId));
                      setNewTaskForm(prev => ({
                        ...prev,
                        service_id: sId,
                        scope: item?.custom_scope || item?.service?.scope || prev.scope
                      }));
                    }}
                    required
                    style={styles.selectInput}
                  >
                    <option value="" disabled>
                      {newTaskForm.loe_id ? '-- Select Service available in this LOE --' : '-- Please select an LOE first --'}
                    </option>
                    {availableServicesForSelectedLoe.map(srv => (
                      <option key={srv.service_id} value={srv.service_id}>
                        {srv.name} ({srv.department?.name || 'General'})
                      </option>
                    ))}
                  </select>
                  {newTaskForm.loe_id && availableServicesForSelectedLoe.length === 0 && (
                    <div style={{ fontSize: '12px', color: '#e11d48', marginTop: '4px' }}>
                      No services found for the selected LOE.
                    </div>
                  )}
                </div>

                {/* 3. Scope / Deliverable */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={styles.label}>Custom Task Scope / Deliverable Description *</label>
                  <textarea
                    rows="3"
                    value={newTaskForm.scope}
                    onChange={(e) => setNewTaskForm({ ...newTaskForm, scope: e.target.value })}
                    placeholder="Specify the deliverable details..."
                    required
                    style={styles.textareaInput}
                  />
                </div>

                {/* 4. Schedule (Days & Past/Future Deadline) */}
                <div style={styles.formRow}>
                  <div style={styles.formCol}>
                    <label style={styles.label}>Duration (Days):</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 5"
                      value={newTaskForm.duration_days}
                      onChange={(e) => setNewTaskForm({ ...newTaskForm, duration_days: e.target.value })}
                      style={styles.selectInput}
                    />
                  </div>
                  <div style={styles.formCol}>
                    <label style={styles.label}>Deadline (Historical &amp; Future Allowed):</label>
                    <input
                      type="date"
                      value={newTaskForm.deadline}
                      onChange={(e) => setNewTaskForm({ ...newTaskForm, deadline: e.target.value })}
                      style={styles.selectInput}
                    />
                  </div>
                </div>

                {/* 5. Allocation Comments */}
                <div style={{ marginTop: '14px', marginBottom: '14px' }}>
                  <label style={styles.label}>Allocation Comments / Notes:</label>
                  <textarea
                    rows="2"
                    value={newTaskForm.comments}
                    onChange={(e) => setNewTaskForm({ ...newTaskForm, comments: e.target.value })}
                    placeholder="Notes or preliminary filing instructions..."
                    style={styles.textareaInput}
                  />
                </div>

                {/* 6. Assign Employees with Search */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={styles.label}>
                    Assign Employees ({newTaskForm.assignee_ids.length} selected):
                  </label>
                  <input
                    type="text"
                    placeholder="Search employees by name or email..."
                    value={customEmpSearch}
                    onChange={(e) => setCustomEmpSearch(e.target.value)}
                    style={styles.empSearchInput}
                  />
                  <div style={styles.multiSelectBox}>
                    {employees
                      .filter(emp => emp.name.toLowerCase().includes(customEmpSearch.toLowerCase()) || (emp.email && emp.email.toLowerCase().includes(customEmpSearch.toLowerCase())))
                      .map(emp => {
                        const checked = newTaskForm.assignee_ids.includes(emp.emp_id);
                        return (
                          <label key={emp.emp_id} style={styles.empCheckLabel}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                const curr = newTaskForm.assignee_ids;
                                const updated = curr.includes(emp.emp_id) ? curr.filter(id => id !== emp.emp_id) : [...curr, emp.emp_id];
                                setNewTaskForm({ ...newTaskForm, assignee_ids: updated });
                              }}
                            />
                            <span>{emp.name} ({emp.email})</span>
                          </label>
                        );
                      })}
                  </div>
                </div>

                <div style={styles.modalActions}>
                  <button type="button" onClick={() => setIsCreateOpen(false)} style={styles.cancelBtn}>
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} style={styles.saveBtn}>
                    {saving ? 'Creating Task...' : 'Create Custom Task'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TASK DETAILS MODAL (Comprehensive metadata view, NO Emojis) */}
        {selectedTaskDetail && (
          <div style={styles.modalOverlay} onClick={() => setSelectedTaskDetail(null)}>
            <div style={styles.detailsModalContent} onClick={e => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={styles.taskCodeBadgeLarge}>
                      {selectedTaskDetail.task_code || `TASK #${selectedTaskDetail.task_id}`}
                    </span>
                    {renderStatusBadge(selectedTaskDetail.status)}
                  </div>
                  <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>
                    {selectedTaskDetail.job?.loe?.company?.name || 'Company'} &bull; {selectedTaskDetail.service?.name || 'Service'}
                  </div>
                </div>
                <button onClick={() => setSelectedTaskDetail(null)} style={styles.closeBtn}>✕</button>
              </div>

              <div style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* 1. Engagement & Client Information */}
                <div style={styles.detailsSection}>
                  <div style={styles.detailsSectionHeader}>Client &amp; Engagement Details</div>
                  <div style={styles.detailsGrid}>
                    <div><strong>Company Name:</strong> {selectedTaskDetail.job?.loe?.company?.name || 'N/A'}</div>
                    <div><strong>Client Type:</strong> {selectedTaskDetail.job?.loe?.company?.client_type || 'N/A'}</div>
                    <div><strong>Registration No:</strong> {selectedTaskDetail.job?.loe?.company?.reg_number || 'N/A'}</div>
                    <div><strong>TIN Number:</strong> {selectedTaskDetail.job?.loe?.company?.tin_number || 'N/A'}</div>
                    <div><strong>LOE Reference:</strong> {selectedTaskDetail.job?.loe?.loe_code || `LOE #${selectedTaskDetail.job?.loe_id}`}</div>
                    <div>
                      <strong>Client Acceptance:</strong>{' '}
                      {selectedTaskDetail.job?.loe?.is_client_accepted ? (
                        <span style={{ color: '#059669', fontWeight: 'bold' }}>Accepted by Client</span>
                      ) : selectedTaskDetail.job?.loe?.status === 'Approved' ? (
                        <span style={{ color: '#0284c7', fontWeight: 'bold' }}>Approved by Management</span>
                      ) : (
                        <span style={{ color: '#d97706', fontWeight: 'bold' }}>Pending Client Confirmation</span>
                      )}
                    </div>
                    <div>
                      <strong>Engagement Manager:</strong>{' '}
                      {selectedTaskDetail.job?.manager?.name || 'N/A'} ({selectedTaskDetail.job?.manager?.email || 'N/A'})
                    </div>
                  </div>
                </div>

                {/* 2. Service & Deliverable Specifications */}
                <div style={styles.detailsSection}>
                  <div style={styles.detailsSectionHeader}>Service &amp; Deliverable Specifications</div>
                  <div style={styles.detailsGrid}>
                    <div><strong>Service Name:</strong> {selectedTaskDetail.service?.name}</div>
                    <div><strong>Department:</strong> {selectedTaskDetail.service?.department?.name || 'General'}</div>
                    <div><strong>Billing Type:</strong> {selectedTaskDetail.service?.billing_type || 'Standard'}</div>
                    <div><strong>Base Price:</strong> Rs. {Number(selectedTaskDetail.service?.price || 0).toLocaleString()}</div>
                  </div>
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>
                      Scope / Deliverable Description:
                    </div>
                    <div style={styles.detailsScopeBox}>
                      {selectedTaskDetail.scope || selectedTaskDetail.service?.scope || 'Standard service scope applied.'}
                    </div>
                  </div>
                </div>

                {/* 3. Schedule, Timeline & Deadlines */}
                <div style={styles.detailsSection}>
                  <div style={styles.detailsSectionHeader}>Timeline &amp; Deadlines</div>
                  <div style={styles.detailsGrid}>
                    <div><strong>Service Master Deadline:</strong> {formatDate(selectedTaskDetail.service_deadline)}</div>
                    <div>
                      <strong>Task Deadline:</strong> {formatDate(selectedTaskDetail.deadline)}
                      {isOverdue(selectedTaskDetail.deadline, selectedTaskDetail.status) && (
                        <span style={{ marginLeft: '8px', color: '#e11d48', fontWeight: 'bold', fontSize: '11px' }}>
                          OVERDUE
                        </span>
                      )}
                    </div>
                    <div><strong>Duration:</strong> {selectedTaskDetail.duration_days ? `${selectedTaskDetail.duration_days} Days` : 'Not specified'}</div>
                    <div><strong>Lifecycle Status:</strong> {selectedTaskDetail.status}</div>
                  </div>
                </div>

                {/* 4. Assigned Team Members */}
                <div style={styles.detailsSection}>
                  <div style={styles.detailsSectionHeader}>Assigned Team Members</div>
                  {(!selectedTaskDetail.assignees || selectedTaskDetail.assignees.length === 0) ? (
                    <div style={{ color: '#b45309', background: '#fffbeb', padding: '10px 14px', borderRadius: '6px', fontSize: '13px' }}>
                      No employees currently assigned to this task.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                      {selectedTaskDetail.assignees.map(emp => (
                        <div key={emp.emp_id} style={styles.assigneeBadgeCard}>
                          <div style={styles.avatarCircle}>{emp.name ? emp.name.charAt(0).toUpperCase() : 'E'}</div>
                          <div>
                            <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#0f172a' }}>{emp.name}</div>
                            <div style={{ fontSize: '11.5px', color: '#64748b' }}>{emp.email}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 5. Allocation Comments & Instructions */}
                <div style={styles.detailsSection}>
                  <div style={styles.detailsSectionHeader}>Allocation Instructions &amp; Comments</div>
                  <div style={styles.commentsContentBox}>
                    {selectedTaskDetail.comments || (
                      <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                        No specific allocation instructions or comments recorded for this task.
                      </span>
                    )}
                  </div>
                </div>

                {/* Modal Action Controls */}
                <div style={styles.modalActions}>
                  {selectedTaskDetail.status === 'Pending' && (
                    <button
                      type="button"
                      onClick={() => handleStatusUpdate(selectedTaskDetail.task_id, 'In-Progress')}
                      disabled={saving}
                      style={styles.startTaskModalBtn}
                    >
                      Start Task (Move to Ongoing)
                    </button>
                  )}
                  {selectedTaskDetail.status === 'In-Progress' && (
                    <button
                      type="button"
                      onClick={() => handleStatusUpdate(selectedTaskDetail.task_id, 'Completed')}
                      disabled={saving}
                      style={styles.completeTaskModalBtn}
                    >
                      Mark as Completed
                    </button>
                  )}

                  {selectedTaskDetail.status !== 'Completed' && selectedTaskDetail.assignees?.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleSendReminder(selectedTaskDetail.task_id)}
                      disabled={remindingTaskId === selectedTaskDetail.task_id}
                      style={styles.remindBtn}
                    >
                      {remindingTaskId === selectedTaskDetail.task_id ? 'Sending Reminder...' : 'Dispatch Reminder Email'}
                    </button>
                  )}

                  {canManage && (
                    <button
                      type="button"
                      onClick={() => {
                        const group = groupedServices.find(g => g.job_id === selectedTaskDetail.job_id && g.service_id === selectedTaskDetail.service_id);
                        setSelectedTaskDetail(null);
                        if (group) handleRowClick(group);
                      }}
                      style={styles.editAllocationBtn}
                    >
                      Edit Allocation
                    </button>
                  )}

                  <button type="button" onClick={() => setSelectedTaskDetail(null)} style={styles.cancelBtn}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );

  // Helper rendering function for task cards in Board View (if toggled)
  function renderTaskCard(t) {
    const overdue = isOverdue(t.deadline, t.status);
    const isUnassigned = !t.assignees || t.assignees.length === 0;

    return (
      <div key={t.task_id} style={styles.statusTaskCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <span style={styles.taskCodeBadge}>
            {t.task_code || `TASK #${t.task_id}`}
          </span>
          {overdue && (
            <span style={{ ...styles.badge, background: '#fee2e2', color: '#e11d48', border: '1px solid #fecdd3' }}>
              Overdue
            </span>
          )}
        </div>

        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a', marginBottom: '2px' }}>
          {t.job?.loe?.company?.name || 'Company'}
        </div>
        <div style={{ fontSize: '12px', color: '#0284c7', fontWeight: '600', marginBottom: '4px' }}>
          {t.service?.name}
        </div>
        <div style={{ fontSize: '12px', color: '#475569', marginBottom: '10px', lineHeight: '1.4' }}>
          {t.scope || 'Standard deliverable'}
        </div>

        <div style={styles.cardInfoRow}>
          <div>
            <span style={{ color: '#64748b' }}>Deadline: </span>
            <span style={{ fontWeight: overdue ? 'bold' : 'normal', color: overdue ? '#e11d48' : '#334155' }}>
              {formatDate(t.deadline)}
            </span>
          </div>
          {t.duration_days && (
            <div>
              <span style={{ color: '#64748b' }}>Duration: </span>
              <span>{t.duration_days}d</span>
            </div>
          )}
        </div>

        <div style={{ marginTop: '8px', marginBottom: '10px' }}>
          {isUnassigned ? (
            <span style={styles.unassignedBadge}>Unassigned</span>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {t.assignees.map(a => (
                <span 
                  key={a.emp_id} 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFilterByStaff(a.emp_id, a.name);
                  }}
                  style={styles.assigneePillClickable}
                  title={`Click to filter tasks assigned to ${a.name}`}
                >
                  {a.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {t.comments && (
          <div style={styles.cardCommentsSnippet}>
            Note: {t.comments}
          </div>
        )}

        <div style={styles.cardFooterActions}>
          {/* Quick Status Dropdown */}
          <select
            value={t.status === 'Ongoing' ? 'In-Progress' : t.status}
            onChange={(e) => handleStatusUpdate(t.task_id, e.target.value)}
            disabled={saving}
            style={getStatusSelectStyle(t.status)}
          >
            <option value="Pending">Pending</option>
            <option value="In-Progress">Ongoing</option>
            <option value="Completed">Completed</option>
          </select>

          {t.status === 'Pending' && (
            <button
              type="button"
              onClick={() => handleStartTask(t.task_id)}
              disabled={saving}
              style={styles.startTaskBtn}
              title="Start Task immediately"
            >
              Start
            </button>
          )}

          <button
            type="button"
            onClick={() => setSelectedTaskDetail(t)}
            style={styles.cardDetailBtn}
          >
            Details
          </button>
        </div>
      </div>
    );
  }

  function getStatusSelectStyle(status) {
    const norm = status === 'Ongoing' ? 'In-Progress' : status;
    if (norm === 'Completed') {
      return { ...styles.cardStatusSelect, borderColor: '#a7f3d0', background: '#ecfdf5', color: '#047857' };
    }
    if (norm === 'In-Progress') {
      return { ...styles.cardStatusSelect, borderColor: '#bae6fd', background: '#f0f9ff', color: '#0369a1' };
    }
    return { ...styles.cardStatusSelect, borderColor: '#fde68a', background: '#fffbeb', color: '#b45309' };
  }
}

const styles = {
  pageContainer: {
    minHeight: '100vh',
    background: '#f8fafc',
    fontFamily: "'Poppins', system-ui, -apple-system, sans-serif",
    marginLeft: 'var(--sidebar-width, 260px)',
    transition: 'margin-left 300ms ease-in-out'
  },
  container: { maxWidth: '1320px', margin: '0 auto', padding: '30px 40px' },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '15px',
    paddingRight: '60px'
  },
  pageTitle: { margin: 0, fontSize: '26px', color: '#0f172a', fontWeight: '800', letterSpacing: '-0.3px' },
  subTitle: { margin: '4px 0 0', fontSize: '13.5px', color: '#475569' },
  viewToggleContainer: {
    display: 'flex',
    background: '#e2e8f0',
    padding: '3px',
    borderRadius: '8px',
    gap: '3px'
  },
  viewToggleBtn: {
    padding: '8px 14px',
    background: 'transparent',
    color: '#475569',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '12.5px',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  },
  viewToggleBtnActive: {
    padding: '8px 14px',
    background: '#ffffff',
    color: '#0284c7',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '12.5px',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.1)',
    cursor: 'pointer'
  },
  createTaskBtn: {
    padding: '9px 18px',
    background: '#0284c7',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '13.5px',
    cursor: 'pointer',
    transition: 'background 0.15s ease'
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
    gap: '14px',
    marginBottom: '22px'
  },
  kpiCard: {
    background: '#ffffff',
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)'
  },
  kpiLabel: { fontSize: '12px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' },
  kpiValue: { fontSize: '24px', fontWeight: '800', margin: '4px 0 2px' },
  kpiSub: { fontSize: '11px', color: '#94a3b8' },
  filterBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    alignItems: 'flex-end',
    background: '#ffffff',
    padding: '16px 20px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    marginBottom: '18px',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)'
  },
  filterField: { display: 'flex', flexDirection: 'column', gap: '4px', flex: '1', minWidth: '160px' },
  filterLabel: { fontSize: '11.5px', fontWeight: 'bold', color: '#475569' },
  filterInput: { padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px', background: '#fff' },
  filterSelect: { padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px', background: '#fff' },
  clearFilterBtn: {
    padding: '8px 14px',
    background: '#f8fafc',
    color: '#e11d48',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '12px',
    cursor: 'pointer',
    height: '35px'
  },
  toggleRowContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
    borderBottom: '2px solid #e2e8f0',
    marginBottom: '20px',
    paddingBottom: '2px'
  },
  tabContainer: {
    display: 'flex',
    gap: '8px'
  },
  tab: {
    padding: '10px 16px',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#64748b',
    fontWeight: '600',
    fontSize: '13.5px',
    cursor: 'pointer',
    marginBottom: '-4px'
  },
  activeTab: {
    padding: '10px 16px',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid #0284c7',
    color: '#0284c7',
    fontWeight: '700',
    fontSize: '13.5px',
    cursor: 'pointer',
    marginBottom: '-4px'
  },
  segmentToggleBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: '#f1f5f9',
    padding: '3px 6px',
    borderRadius: '8px',
    marginBottom: '6px'
  },
  segmentLabel: { fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginRight: '4px' },
  segmentPill: {
    padding: '5px 10px',
    background: 'transparent',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#475569',
    cursor: 'pointer'
  },
  segmentPillActiveAll: {
    padding: '5px 10px',
    background: '#0284c7',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#ffffff',
    cursor: 'pointer'
  },
  segmentPillActiveUnassigned: {
    padding: '5px 10px',
    background: '#d97706',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#ffffff',
    cursor: 'pointer'
  },
  segmentPillActiveAssigned: {
    padding: '5px 10px',
    background: '#059669',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#ffffff',
    cursor: 'pointer'
  },
  errorBanner: { background: '#fff1f2', color: '#e11d48', padding: '12px 16px', borderRadius: '6px', marginBottom: '18px', fontSize: '13px', border: '1px solid #fecdd3' },
  successBanner: { background: '#ecfdf5', color: '#059669', padding: '12px 16px', borderRadius: '6px', marginBottom: '18px', fontSize: '13px', border: '1px solid #a7f3d0' },
  card: { background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: { textAlign: 'left', padding: '12px 16px', background: '#f8fafc', color: '#475569', fontWeight: 'bold', borderBottom: '1px solid #e2e8f0' },
  tr: { borderBottom: '1px solid #e2e8f0', transition: 'background 0.15s ease' },
  td: { padding: '13px 16px', color: '#334155', verticalAlign: 'middle' },
  badge: { padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', display: 'inline-block' },
  taskCodeBadge: { background: '#f1f5f9', color: '#334155', padding: '3px 8px', borderRadius: '4px', fontSize: '11.5px', fontFamily: 'monospace', fontWeight: 'bold', border: '1px solid #cbd5e1' },
  taskCodeBadgeLarge: { background: '#f1f5f9', color: '#0f172a', padding: '5px 12px', borderRadius: '6px', fontSize: '15px', fontFamily: 'monospace', fontWeight: '800', border: '1px solid #cbd5e1' },
  scopeCell: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' },
  scopeCountBadge: { background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', lineHeight: '1.2' },
  needsAssigneeBadge: { background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', lineHeight: '1.2' },
  unassignedBadge: { background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', padding: '3px 8px', borderRadius: '10px', fontSize: '11.5px', fontWeight: 'bold', display: 'inline-block' },
  assigneePill: { background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '2px 8px', fontSize: '11.5px', color: '#334155' },
  assigneePillMini: { background: '#f1f5f9', borderRadius: '10px', padding: '2px 7px', fontSize: '11px', color: '#334155', border: '1px solid #e2e8f0' },
  actionIconBtn: { padding: '6px 12px', background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)', transition: 'all 0.15s ease' },
  startTaskBtn: { padding: '6px 14px', background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 1px 2px rgba(2, 132, 199, 0.25)', transition: 'all 0.15s ease' },
  startTaskModalBtn: { padding: '8px 18px', background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 1px 2px rgba(2, 132, 199, 0.25)', transition: 'all 0.15s ease' },
  completeTaskModalBtn: { padding: '8px 18px', background: '#059669', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 1px 2px rgba(5, 150, 105, 0.25)', transition: 'all 0.15s ease' },
  batchToolbar: { background: '#0f172a', padding: '12px 18px', borderRadius: '8px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.15)' },
  batchStartBtn: { padding: '8px 16px', background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s ease' },
  batchClearBtn: { padding: '8px 14px', background: 'transparent', color: '#94a3b8', border: '1px solid #475569', borderRadius: '6px', fontSize: '12.5px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.15s ease' },
  assigneePillClickable: { background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '3px 8px', fontSize: '11.5px', color: '#334155', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', transition: 'all 0.15s ease' },
  actionPrimaryBtn: { padding: '6px 14px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' },
  remindTableBtn: { padding: '6px 12px', background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s ease' },
  trackerNotice: { background: '#f0f9ff', border: '1px solid #bae6fd', padding: '12px 18px', borderRadius: '8px', marginBottom: '20px', color: '#0369a1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' },
  displayModeGroup: { display: 'flex', background: '#ffffff', padding: '3px', borderRadius: '6px', border: '1px solid #bae6fd', gap: '3px' },
  modeBtn: { padding: '5px 12px', background: 'transparent', color: '#475569', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' },
  modeBtnActive: { padding: '5px 12px', background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' },
  statusColumnsContainer: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '18px' },
  statusColumn: { background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' },
  statusColumnHeader: { padding: '14px 16px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', borderTop: '4px solid #cbd5e1', borderTopLeftRadius: '8px', borderTopRightRadius: '8px' },
  columnCountBadge: { background: '#f1f5f9', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', color: '#475569', fontWeight: 'bold' },
  statusCardsFeed: { padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '72vh', overflowY: 'auto' },
  statusTaskCard: { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)' },
  cardInfoRow: { display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginTop: '6px', paddingBottom: '6px', borderBottom: '1px dashed #f1f5f9' },
  cardCommentsSnippet: { background: '#f8fafc', padding: '6px 8px', borderRadius: '4px', fontSize: '11px', color: '#475569', fontStyle: 'italic', marginBottom: '10px' },
  cardFooterActions: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginTop: '6px' },
  cardStatusSelect: { padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: '600', cursor: 'pointer', outline: 'none' },
  cardDetailBtn: { padding: '6px 12px', background: '#ffffff', color: '#0284c7', border: '1px solid #bae6fd', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s ease' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' },
  modalContent: { background: '#fff', borderRadius: '8px', width: '100%', maxWidth: '820px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.2)', border: '1px solid #e2e8f0' },
  detailsModalContent: { background: '#fff', borderRadius: '8px', width: '100%', maxWidth: '840px', maxHeight: '90vh', overflowY: 'auto', padding: '26px', boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.25)', border: '1px solid #e2e8f0' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px' },
  closeBtn: { background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' },
  modalBody: { marginTop: '16px', display: 'flex', flexDirection: 'column' },
  loeDetailsBox: { background: '#f8fafc', padding: '12px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', marginBottom: '14px' },
  clientGateWarning: { background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' },
  scopeAssignmentCard: { border: '1px solid #e2e8f0', padding: '16px', borderRadius: '6px', background: '#f8fafc' },
  formRow: { display: 'flex', gap: '14px' },
  formCol: { flex: 1, display: 'flex', flexDirection: 'column' },
  label: { fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', color: '#334155' },
  selectInput: { padding: '8px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', width: '100%', boxSizing: 'border-box', background: '#fff' },
  textareaInput: { padding: '8px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', width: '100%', boxSizing: 'border-box', background: '#fff', fontFamily: 'inherit' },
  empSearchInput: { padding: '7px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px', width: '100%', boxSizing: 'border-box', marginBottom: '6px', background: '#fff' },
  multiSelectBox: { background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '8px 10px', maxHeight: '125px', overflowY: 'auto' },
  empCheckLabel: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', marginBottom: '5px', cursor: 'pointer' },
  clearAssigneesBtn: { background: 'none', border: 'none', color: '#e11d48', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px', borderTop: '1px solid #e2e8f0', paddingTop: '16px', flexWrap: 'wrap' },
  cancelBtn: { padding: '8px 16px', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' },
  saveBtn: { padding: '8px 22px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' },
  remindBtn: { padding: '8px 16px', background: '#fff7ed', color: '#c2410c', border: '1px solid #fdba74', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' },
  editAllocationBtn: { padding: '8px 16px', background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' },
  detailsSection: { border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', background: '#ffffff' },
  detailsSectionHeader: { fontSize: '13px', fontWeight: 'bold', color: '#0f172a', marginBottom: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' },
  detailsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', fontSize: '13px', color: '#334155' },
  detailsScopeBox: { background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#334155', lineHeight: '1.5' },
  assigneeBadgeCard: { display: 'flex', alignItems: 'center', gap: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: '6px' },
  avatarCircle: { width: '30px', height: '30px', borderRadius: '50%', background: '#0284c7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '13px' },
  commentsContentBox: { background: '#f8fafc', padding: '12px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#334155', lineHeight: '1.5' }
};

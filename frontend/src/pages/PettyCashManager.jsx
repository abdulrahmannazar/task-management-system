import React, { useState, useEffect } from 'react';
import { API_BASE } from '../utils/api';
import Navbar from '../components/Navbar';
import { usePermissions } from '../utils/permissionHelper';

const EXPENSE_CATEGORIES = [
  'Travel & Transport',
  'Meals & Refreshment',
  'Courier & Postage',
  'Printing & Stationery',
  'Government/Court/Tax Filing Fees',
  'Other'
];

export default function PettyCashManager() {
  const { hasPermission } = usePermissions();

  const [requests, setRequests] = useState([]);
  const [allocatedTasks, setAllocatedTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal state for creating Petty Cash requisition
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Requisition Form state
  const initialFormState = {
    task_id: '',
    amount: '',
    category: 'Travel & Transport',
    purpose: '',
    date_required: new Date().toISOString().split('T')[0]
  };
  const [formData, setFormData] = useState(initialFormState);

  // Rejection Modal state
  const [rejectModalItem, setRejectModalItem] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState('');

  // Details Modal state
  const [selectedRequest, setSelectedRequest] = useState(null);

  // View Toggle & Filter States
  const [viewMode, setViewMode] = useState('ALL'); // 'ALL' | 'APPROVALS'
  const [filterSearch, setFilterSearch] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterDate, setFilterDate] = useState('');

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};

  const isAdmin = user.role === 'ADMIN';
  const isManager = user.role === 'MANAGER';
  const deptName = String(user.department_name || '').toLowerCase();
  const isFinance = user.role === 'FINANCE' || deptName.includes('finance') || deptName.includes('accounting');
  const canManagePettyCash = hasPermission(user, 'MANAGE_PETTY_CASH');

  const canManagerApprove = isAdmin || isManager || canManagePettyCash;
  const canFinanceDisburse = isAdmin || isFinance;
  const canReviewApprovals = canManagerApprove || canFinanceDisburse;

  const getApiUrl = (path) => {
    if (window.location.hostname === 'localhost') {
      return `http://localhost:3000${path}`;
    }
    return `${API_BASE}${path}`;
  };

  const authenticatedFetch = async (endpoint, options = {}) => {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    let url = getApiUrl(endpoint);
    try {
      let res = await fetch(url, {
        ...options,
        headers: { ...defaultHeaders, ...(options.headers || {}) }
      });
      if (res.status === 404 && window.location.hostname === 'localhost') {
        url = `${API_BASE}${endpoint}`;
        res = await fetch(url, {
          ...options,
          headers: { ...defaultHeaders, ...(options.headers || {}) }
        });
      }
      return res;
    } catch (err) {
      if (window.location.hostname === 'localhost') {
        url = `${API_BASE}${endpoint}`;
        return await fetch(url, {
          ...options,
          headers: { ...defaultHeaders, ...(options.headers || {}) }
        });
      }
      throw err;
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchAllocatedTasks();
  }, []);

  // Lock background scroll while any modal is open
  useEffect(() => {
    const anyModalOpen = isModalOpen || Boolean(rejectModalItem) || Boolean(selectedRequest);
    document.body.style.overflow = anyModalOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isModalOpen, rejectModalItem, selectedRequest]);

  // Close active modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (rejectModalItem) setRejectModalItem(null);
        else if (selectedRequest) setSelectedRequest(null);
        else if (isModalOpen) closeCreateModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, rejectModalItem, selectedRequest]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError('');
      const queryParam = isAdmin || isFinance
        ? `?role=${user.role || 'ADMIN'}&department_id=${user.department_id || ''}&emp_id=${user.emp_id || ''}`
        : isManager
        ? `?role=MANAGER&department_id=${user.department_id || 1}&emp_id=${user.emp_id || ''}`
        : `?emp_id=${user.emp_id}&role=EMPLOYEE`;

      const res = await authenticatedFetch(`/api/petty-cash${queryParam}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load petty cash requests');
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error loading petty cash requests');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllocatedTasks = async () => {
    try {
      setTasksLoading(true);
      const queryParam = isAdmin
        ? '?role=ADMIN'
        : isManager
        ? `?role=MANAGER&department_id=${user.department_id || 1}&emp_id=${user.emp_id || ''}`
        : `?emp_id=${user.emp_id}&role=EMPLOYEE`;

      const res = await authenticatedFetch(`/api/petty-cash/allocated-tasks${queryParam}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setAllocatedTasks(data);
        if (data.length > 0 && !formData.task_id) {
          setFormData((prev) => ({ ...prev, task_id: String(data[0].task_id) }));
        }
      } else {
        setAllocatedTasks([]);
      }
    } catch (err) {
      console.error('Failed to load allocated tasks:', err);
      setAllocatedTasks([]);
    } finally {
      setTasksLoading(false);
    }
  };

  const openCreateModal = () => {
    setModalError('');
    setFormData({
      task_id: allocatedTasks[0] ? String(allocatedTasks[0].task_id) : '',
      amount: '',
      category: 'Travel & Transport',
      purpose: '',
      date_required: new Date().toISOString().split('T')[0]
    });
    setIsModalOpen(true);
  };

  const closeCreateModal = () => {
    setIsModalOpen(false);
    setModalError('');
  };

  const handleSubmitRequisition = async (e) => {
    e.preventDefault();
    setModalError('');
    setError('');
    setSuccessMsg('');

    if (allocatedTasks.length === 0) {
      setModalError('You must be allocated to an active task to request petty cash.');
      return;
    }

    if (!formData.task_id) {
      setModalError('Please select an allocated task.');
      return;
    }

    const numAmount = parseFloat(formData.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setModalError('Amount must be a positive number greater than 0.');
      return;
    }

    if (!formData.purpose.trim()) {
      setModalError('Please specify the exact business purpose for this petty cash.');
      return;
    }

    if (!formData.date_required) {
      setModalError('Please specify the date required.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await authenticatedFetch('/api/petty-cash', {
        method: 'POST',
        body: JSON.stringify({
          task_id: parseInt(formData.task_id),
          amount: numAmount,
          category: formData.category,
          purpose: formData.purpose.trim(),
          date_required: formData.date_required,
          emp_id: user.emp_id
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit petty cash request');

      setSuccessMsg(`Petty cash requisition of Rs. ${numAmount.toFixed(2)} submitted (Pending Manager Approval).`);
      closeCreateModal();
      await fetchRequests();
    } catch (err) {
      setModalError(err.message || 'Error submitting requisition');
    } finally {
      setSubmitting(false);
    }
  };

  const handleManagerApprove = async (id) => {
    try {
      setActionLoadingId(id);
      setError('');
      setSuccessMsg('');
      const res = await authenticatedFetch(`/api/petty-cash/${id}/approve`, {
        method: 'PUT',
        body: JSON.stringify({ emp_id: user.emp_id, role: user.role })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to verify and approve request');
      setSuccessMsg(`Request #${id} verified by Manager and forwarded to Finance for disbursement.`);
      if (selectedRequest?.petty_cash_id === id) setSelectedRequest(data);
      await fetchRequests();
    } catch (err) {
      setError(err.message || 'Error approving request');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleFinanceDisburse = async (id) => {
    try {
      setActionLoadingId(id);
      setError('');
      setSuccessMsg('');
      const res = await authenticatedFetch(`/api/petty-cash/${id}/disburse`, {
        method: 'PUT',
        body: JSON.stringify({ emp_id: user.emp_id, role: user.role, department_id: user.department_id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to disburse funds');
      setSuccessMsg(`Funds confirmed and disbursed for Request #${id}. Employee notified.`);
      if (selectedRequest?.petty_cash_id === id) setSelectedRequest(data);
      await fetchRequests();
    } catch (err) {
      setError(err.message || 'Error confirming disbursement');
    } finally {
      setActionLoadingId(null);
    }
  };

  const openRejectModal = (item) => {
    setRejectModalItem(item);
    setRejectionReason('');
    setRejectError('');
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      setRejectError('Please provide a reason for rejecting this request.');
      return;
    }

    try {
      setRejecting(true);
      setRejectError('');
      const res = await authenticatedFetch(`/api/petty-cash/${rejectModalItem.petty_cash_id}/reject`, {
        method: 'PUT',
        body: JSON.stringify({
          rejection_reason: rejectionReason.trim(),
          emp_id: user.emp_id,
          role: user.role,
          department_id: user.department_id
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reject request');

      setSuccessMsg(`Request #${rejectModalItem.petty_cash_id} has been rejected.`);
      if (selectedRequest?.petty_cash_id === rejectModalItem.petty_cash_id) {
        setSelectedRequest(data);
      }
      setRejectModalItem(null);
      await fetchRequests();
    } catch (err) {
      setRejectError(err.message || 'Error rejecting request');
    } finally {
      setRejecting(false);
    }
  };

  const handleSettle = async (id) => {
    try {
      setActionLoadingId(id);
      setError('');
      setSuccessMsg('');
      const res = await authenticatedFetch(`/api/petty-cash/${id}/settle`, {
        method: 'PUT',
        body: JSON.stringify({ emp_id: user.emp_id, role: user.role, department_id: user.department_id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to mark as settled');
      setSuccessMsg(`Request #${id} marked as Settled.`);
      if (selectedRequest?.petty_cash_id === id) setSelectedRequest(data);
      await fetchRequests();
    } catch (err) {
      setError(err.message || 'Error settling request');
    } finally {
      setActionLoadingId(null);
    }
  };

  const isPendingManagerStep = (status) => status === 'Pending Manager Approval' || status === 'Pending';
  const isPendingFinanceStep = (status) => status === 'Pending Finance Approval' || status === 'Approved';

  // Approval Queue count tailored to viewer role
  const pendingApprovalQueueCount = requests.filter((r) => {
    if (isAdmin) return isPendingManagerStep(r.status) || isPendingFinanceStep(r.status);
    if (isFinance) return isPendingFinanceStep(r.status);
    if (isManager) return isPendingManagerStep(r.status);
    return false;
  }).length;

  // Filter computation
  const filteredRequests = requests.filter((req) => {
    if (viewMode === 'APPROVALS') {
      if (isAdmin) {
        if (!isPendingManagerStep(req.status) && !isPendingFinanceStep(req.status)) return false;
      } else if (isFinance) {
        if (!isPendingFinanceStep(req.status)) return false;
      } else if (isManager) {
        if (!isPendingManagerStep(req.status)) return false;
      }
    }

    if (filterStatus !== 'ALL') {
      if (filterStatus === 'Pending Manager Approval') {
        if (!isPendingManagerStep(req.status)) return false;
      } else if (filterStatus === 'Pending Finance Approval') {
        if (!isPendingFinanceStep(req.status)) return false;
      } else if (req.status !== filterStatus) {
        return false;
      }
    }

    if (filterCategory !== 'ALL' && req.category !== filterCategory) return false;
    if (filterDate && req.date_required && !req.date_required.startsWith(filterDate)) return false;

    if (filterCompany) {
      const companyName = req.task?.job?.loe?.company?.name || '';
      if (!companyName.toLowerCase().includes(filterCompany.toLowerCase())) return false;
    }

    if (filterSearch) {
      const search = filterSearch.toLowerCase();
      const empName = req.employee?.name || '';
      const empEmail = req.employee?.email || '';
      const purpose = req.purpose || '';
      const taskCode = req.task?.task_code || '';
      const compName = req.task?.job?.loe?.company?.name || '';

      const match =
        empName.toLowerCase().includes(search) ||
        empEmail.toLowerCase().includes(search) ||
        purpose.toLowerCase().includes(search) ||
        taskCode.toLowerCase().includes(search) ||
        compName.toLowerCase().includes(search);

      if (!match) return false;
    }

    return true;
  });

  const clearFilters = () => {
    setFilterSearch('');
    setFilterCompany('');
    setFilterStatus('ALL');
    setFilterCategory('ALL');
    setFilterDate('');
    setViewMode('ALL');
  };

  // Metrics summary
  const pendingManagerCount = requests.filter((r) => isPendingManagerStep(r.status)).length;
  const pendingFinanceCount = requests.filter((r) => isPendingFinanceStep(r.status)).length;
  const disbursedCount = requests.filter((r) => r.status === 'Disbursed').length;
  const settledCount = requests.filter((r) => r.status === 'Settled').length;

  const renderStatusBadge = (status) => {
    if (isPendingManagerStep(status)) {
      return (
        <span style={{ ...styles.badge, background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }}>
          Pending Manager Approval
        </span>
      );
    }
    if (isPendingFinanceStep(status)) {
      return (
        <span style={{ ...styles.badge, background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd' }}>
          Pending Finance Approval
        </span>
      );
    }
    switch (status) {
      case 'Rejected':
        return <span style={{ ...styles.badge, background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3' }}>Rejected</span>;
      case 'Disbursed':
        return <span style={{ ...styles.badge, background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe' }}>Disbursed</span>;
      case 'Settled':
        return <span style={{ ...styles.badge, background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>Settled</span>;
      default:
        return <span style={{ ...styles.badge, background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>{status}</span>;
    }
  };

  const hasAllocatedTasks = allocatedTasks.length > 0;

  return (
    <div style={styles.pageContainer}>
      <Navbar />

      <div style={styles.container}>
        {/* Top Header Row matching CompanyManager pattern */}
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.pageTitle}>Petty Cash Management</h1>
            <p style={styles.subTitle}>
              Request and manage business operational expense disbursements with two-step Manager &amp; Finance verification.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            style={styles.primaryActionBtn}
          >
            + Request Petty Cash
          </button>
        </div>

        {/* Feedback Banners */}
        {error && (
          <div style={styles.errorBanner}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div style={styles.successBanner}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" style={{ flexShrink: 0 }}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>{successMsg}</span>
          </div>
        )}

        {/* Metrics Row */}
        <div style={styles.metricsGrid}>
          <div style={styles.metricCard}>
            <div style={styles.metricLabel}>Total Requests</div>
            <div style={styles.metricValue}>{requests.length}</div>
            <div style={styles.metricSub}>All submitted requisitions</div>
          </div>
          <div style={styles.metricCard}>
            <div style={styles.metricLabel}>Pending Manager Approval</div>
            <div style={{ ...styles.metricValue, color: '#d97706' }}>{pendingManagerCount}</div>
            <div style={styles.metricSub}>Step 1: Department manager review</div>
          </div>
          <div style={styles.metricCard}>
            <div style={styles.metricLabel}>Pending Finance Approval</div>
            <div style={{ ...styles.metricValue, color: '#0284c7' }}>{pendingFinanceCount}</div>
            <div style={styles.metricSub}>Step 2: Ready for Finance disbursement</div>
          </div>
          <div style={styles.metricCard}>
            <div style={styles.metricLabel}>Disbursed &amp; Settled</div>
            <div style={{ ...styles.metricValue, color: '#059669' }}>{disbursedCount + settledCount}</div>
            <div style={styles.metricSub}>{disbursedCount} in field &middot; {settledCount} settled</div>
          </div>
        </div>

        {/* Full-Width Directory & Filter Section */}
        <div style={styles.listSection}>
          {/* Filter Bar */}
          <div style={styles.filterBar}>
            <div style={styles.filterField}>
              <label style={styles.filterLabel}>Search Keywords</label>
              <input
                type="text"
                placeholder="Employee, purpose, code..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                style={styles.filterInput}
              />
            </div>

            <div style={styles.filterField}>
              <label style={styles.filterLabel}>Company</label>
              <input
                type="text"
                placeholder="Filter by company..."
                value={filterCompany}
                onChange={(e) => setFilterCompany(e.target.value)}
                style={styles.filterInput}
              />
            </div>

            <div style={styles.filterField}>
              <label style={styles.filterLabel}>Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={styles.filterSelect}
              >
                <option value="ALL">All Statuses</option>
                <option value="Pending Manager Approval">Pending Manager Approval</option>
                <option value="Pending Finance Approval">Pending Finance Approval</option>
                <option value="Disbursed">Disbursed</option>
                <option value="Settled">Settled</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            <div style={styles.filterField}>
              <label style={styles.filterLabel}>Category</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                style={styles.filterSelect}
              >
                <option value="ALL">All Categories</option>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div style={styles.filterField}>
              <label style={styles.filterLabel}>Date Required</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                style={styles.filterInput}
              />
            </div>

            <button type="button" onClick={clearFilters} style={styles.clearFilterBtn}>
              Reset
            </button>
          </div>

          {/* Requisitions Full-Width Card Table */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <h2 style={styles.cardTitle}>Petty Cash Requisitions</h2>
                <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
                  Showing {filteredRequests.length} of {requests.length} requests
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {canReviewApprovals && (
                  <div style={styles.toggleGroup}>
                    <button
                      type="button"
                      onClick={() => setViewMode('ALL')}
                      style={{
                        ...styles.toggleBtn,
                        ...(viewMode === 'ALL' ? styles.activeToggleBtn : {})
                      }}
                    >
                      All Requisitions
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('APPROVALS')}
                      style={{
                        ...styles.toggleBtn,
                        ...(viewMode === 'APPROVALS' ? styles.activeToggleBtn : {})
                      }}
                    >
                      Awaiting Approval ({pendingApprovalQueueCount})
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={fetchRequests}
                  style={styles.refreshBtn}
                  title="Reload requisitions"
                >
                  ↻ Refresh
                </button>
              </div>
            </div>

            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                Loading petty cash records...
              </div>
            ) : filteredRequests.length === 0 ? (
              <div style={{ padding: '50px 20px', textAlign: 'center', color: '#64748b' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" style={{ margin: '0 auto 12px' }}>
                  <rect width="20" height="14" x="2" y="5" rx="2" />
                  <line x1="2" x2="22" y1="10" y2="10" />
                  <circle cx="12" cy="15" r="2" />
                </svg>
                <p style={{ margin: 0, fontWeight: 'bold', fontSize: '14px', color: '#334155' }}>
                  No petty cash requisitions found
                </p>
                <p style={{ margin: '4px 0 0', fontSize: '13px' }}>
                  {requests.length === 0
                    ? 'Click "+ Request Petty Cash" above to submit your first petty cash request.'
                    : 'No records match the current filter criteria.'}
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>ID / Date</th>
                      <th style={styles.th}>Requester</th>
                      <th style={styles.th}>Allocated Task &amp; Company</th>
                      <th style={styles.th}>Category &amp; Purpose</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Amount (LKR)</th>
                      <th style={{ ...styles.th, textAlign: 'center' }}>Status</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map((req) => {
                      const isRequester = req.emp_id === user.emp_id;
                      const taskCode = req.task?.task_code || `TASK-${req.task_id}`;
                      const companyName = req.task?.job?.loe?.company?.name || 'N/A';
                      const serviceName = req.task?.service?.name || 'Service Deliverable';
                      const isBusy = actionLoadingId === req.petty_cash_id;

                      return (
                        <tr
                          key={req.petty_cash_id}
                          style={styles.tr}
                          onClick={() => setSelectedRequest(req)}
                        >
                          <td style={styles.td}>
                            <strong style={{ color: '#0f172a' }}>#{req.petty_cash_id}</strong>
                            <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                              Req: {req.date_required ? req.date_required.split('T')[0] : 'N/A'}
                            </div>
                          </td>

                          <td style={styles.td}>
                            <div style={{ fontWeight: '600', color: '#0f172a' }}>
                              {req.employee?.name || `Emp #${req.emp_id}`}
                            </div>
                            <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                              {req.employee?.department?.name || 'Staff'}
                            </div>
                          </td>

                          <td style={styles.td}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={styles.taskCodePill}>{taskCode}</span>
                            </div>
                            <div style={{ fontSize: '12px', color: '#0f172a', fontWeight: '500', marginTop: '3px' }}>
                              {companyName}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              {serviceName}
                            </div>
                          </td>

                          <td style={{ ...styles.td, maxWidth: '250px' }}>
                            <span style={styles.categoryPill}>{req.category}</span>
                            <div
                              style={{
                                fontSize: '12px',
                                color: '#475569',
                                marginTop: '4px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                              title={req.purpose}
                            >
                              {req.purpose}
                            </div>
                          </td>

                          <td style={{ ...styles.td, textAlign: 'right', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap' }}>
                            Rs. {Number(req.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          <td style={{ ...styles.td, textAlign: 'center' }}>
                            {renderStatusBadge(req.status)}
                            {req.status === 'Rejected' && req.rejection_reason && (
                              <div
                                style={{
                                  fontSize: '10.5px',
                                  color: '#e11d48',
                                  marginTop: '3px',
                                  maxWidth: '150px',
                                  margin: '3px auto 0',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                                title={`Reason: ${req.rejection_reason}`}
                              >
                                Reason: {req.rejection_reason}
                              </div>
                            )}
                          </td>

                          <td style={{ ...styles.td, textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                              {/* STEP 1: Manager Approval Actions */}
                              {isPendingManagerStep(req.status) && canManagerApprove && (
                                <>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleManagerApprove(req.petty_cash_id)}
                                    style={styles.approveBtn}
                                    title="Verify task & send to Finance Department"
                                  >
                                    {isBusy ? 'Approving...' : '✓ Approve (Send to Finance)'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => openRejectModal(req)}
                                    style={styles.rejectBtn}
                                    title="Reject Requisition"
                                  >
                                    ✕ Reject
                                  </button>
                                </>
                              )}

                              {/* STEP 2: Finance Approval & Disbursement Actions */}
                              {isPendingFinanceStep(req.status) && (
                                canFinanceDisburse ? (
                                  <>
                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() => handleFinanceDisburse(req.petty_cash_id)}
                                      style={styles.disburseBtn}
                                      title="Review approval and disburse funds"
                                    >
                                      {isBusy ? 'Processing...' : 'Confirm & Disburse Funds'}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() => openRejectModal(req)}
                                      style={styles.rejectBtn}
                                      title="Reject Requisition"
                                    >
                                      ✕ Reject
                                    </button>
                                  </>
                                ) : (
                                  <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                                    Awaiting Finance
                                  </span>
                                )
                              )}

                              {/* STEP 3: Settlement after Disbursement */}
                              {req.status === 'Disbursed' && (isRequester || canManagerApprove || canFinanceDisburse) && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleSettle(req.petty_cash_id)}
                                  style={styles.settleBtn}
                                  title="Submit Bills & Mark Settled"
                                >
                                  Settle
                                </button>
                              )}

                              {/* View details button */}
                              <button
                                type="button"
                                onClick={() => setSelectedRequest(req)}
                                style={styles.viewBtn}
                                title="View Full Details"
                              >
                                View
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

        {/* Popup Modal for Creating Petty Cash Requisition (Matches CompanyManager Pattern) */}
        {isModalOpen && (
          <div style={styles.modalOverlay} onClick={closeCreateModal}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <div>
                  <h2 style={styles.modalTitle}>Request Petty Cash</h2>
                  <p style={styles.modalSubtitle}>
                    Submit a new operational expense claim linked to an allocated task.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeCreateModal}
                  style={styles.closeModalBtn}
                  title="Close dialog"
                >
                  ✕
                </button>
              </div>

              {modalError && <div style={styles.modalErrorBox}>{modalError}</div>}

              {/* Mandatory Allocation Gate Notice */}
              {!tasksLoading && !hasAllocatedTasks && (
                <div style={styles.gateNotice}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}>
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <div>
                    <strong style={{ display: 'block', color: '#92400e', marginBottom: '4px' }}>
                      Allocation Requirement Gate
                    </strong>
                    You must be allocated to an active task to request petty cash. Contact your project manager to receive task assignment before submitting expense claims.
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmitRequisition} style={styles.form}>
                {/* 1. Allocated Task Dropdown */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Allocated Task <span style={{ color: '#e11d48' }}>*</span>
                  </label>
                  <select
                    value={formData.task_id}
                    onChange={(e) => setFormData({ ...formData, task_id: e.target.value })}
                    disabled={!hasAllocatedTasks || submitting}
                    required
                    style={{
                      ...styles.selectInput,
                      background: !hasAllocatedTasks ? '#f1f5f9' : '#ffffff',
                      cursor: !hasAllocatedTasks ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {!hasAllocatedTasks ? (
                      <option value="">-- No active tasks allocated --</option>
                    ) : (
                      <>
                        <option value="" disabled>-- Select Allocated Task --</option>
                        {allocatedTasks.map((t) => (
                          <option key={t.task_id} value={t.task_id}>
                            {t.task_code || `TASK-${t.task_id}`} — {t.company_name} ({t.service_name})
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                  <small style={styles.fieldHint}>
                    Displays only active tasks allocated to you ({allocatedTasks.length} available).
                  </small>
                </div>

                {/* 2. Amount (LKR) */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Amount (Rs. LKR) <span style={{ color: '#e11d48' }}>*</span>
                  </label>
                  <div style={styles.inputPrefixWrapper}>
                    <span style={styles.inputPrefix}>Rs.</span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      placeholder="e.g. 2500.00"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      disabled={!hasAllocatedTasks || submitting}
                      required
                      style={{
                        ...styles.selectInput,
                        paddingLeft: '44px',
                        background: !hasAllocatedTasks ? '#f1f5f9' : '#ffffff'
                      }}
                    />
                  </div>
                </div>

                {/* 3. Expense Category Dropdown */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Expense Category <span style={{ color: '#e11d48' }}>*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    disabled={!hasAllocatedTasks || submitting}
                    required
                    style={{
                      ...styles.selectInput,
                      background: !hasAllocatedTasks ? '#f1f5f9' : '#ffffff'
                    }}
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Date Required */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Date Required <span style={{ color: '#e11d48' }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.date_required}
                    onChange={(e) => setFormData({ ...formData, date_required: e.target.value })}
                    disabled={!hasAllocatedTasks || submitting}
                    required
                    style={{
                      ...styles.selectInput,
                      background: !hasAllocatedTasks ? '#f1f5f9' : '#ffffff'
                    }}
                  />
                </div>

                {/* 5. Business Purpose / Justification ("Why") */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Business Purpose / Justification ("Why") <span style={{ color: '#e11d48' }}>*</span>
                  </label>
                  <textarea
                    rows="3"
                    placeholder="Explain the exact business necessity (e.g. IRD filing transport, courier dispatch fees, client meeting materials)..."
                    value={formData.purpose}
                    onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                    disabled={!hasAllocatedTasks || submitting}
                    required
                    style={{
                      ...styles.selectInput,
                      minHeight: '85px',
                      resize: 'vertical',
                      background: !hasAllocatedTasks ? '#f1f5f9' : '#ffffff'
                    }}
                  />
                </div>

                <div style={styles.buttonGroup}>
                  <button
                    type="submit"
                    disabled={!hasAllocatedTasks || submitting}
                    style={{
                      ...styles.submitModalBtn,
                      opacity: !hasAllocatedTasks || submitting ? 0.55 : 1,
                      cursor: !hasAllocatedTasks || submitting ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {submitting ? 'Submitting Requisition...' : 'Submit Requisition'}
                  </button>
                  <button
                    type="button"
                    onClick={closeCreateModal}
                    style={styles.cancelModalBtn}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Rejection Reason Modal */}
        {rejectModalItem && (
          <div style={styles.modalOverlay} onClick={() => setRejectModalItem(null)}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <div>
                  <h2 style={styles.modalTitle}>
                    Reject Petty Cash #{rejectModalItem.petty_cash_id}
                  </h2>
                  <p style={styles.modalSubtitle}>
                    Provide a clear rejection justification for the requesting employee.
                  </p>
                </div>
                <button type="button" onClick={() => setRejectModalItem(null)} style={styles.closeModalBtn}>✕</button>
              </div>

              <form onSubmit={handleRejectSubmit}>
                <div style={styles.loeDetailsBox}>
                  <strong>Requester:</strong> {rejectModalItem.employee?.name || 'Employee'} |{' '}
                  <strong>Amount:</strong> Rs. {Number(rejectModalItem.amount).toFixed(2)} |{' '}
                  <strong>Task:</strong> {rejectModalItem.task?.task_code || `#${rejectModalItem.task_id}`}
                </div>

                {rejectError && (
                  <div style={styles.modalErrorBox}>{rejectError}</div>
                )}

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Rejection Reason <span style={{ color: '#e11d48' }}>*</span>
                  </label>
                  <textarea
                    rows="4"
                    required
                    placeholder="Provide specific justification for rejection (e.g., duplicate request, exceeds allowable budget, non-essential expense)..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    style={styles.selectInput}
                  />
                </div>

                <div style={styles.buttonGroup}>
                  <button
                    type="submit"
                    disabled={rejecting}
                    style={{ ...styles.rejectBtn, flex: 1, padding: '10px', fontSize: '13.5px', borderRadius: '6px' }}
                  >
                    {rejecting ? 'Rejecting...' : 'Confirm Rejection'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejectModalItem(null)}
                    style={styles.cancelModalBtn}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Request Details Modal */}
        {selectedRequest && (
          <div style={styles.modalOverlay} onClick={() => setSelectedRequest(null)}>
            <div style={{ ...styles.modalContent, maxWidth: '660px' }} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <div>
                  <h2 style={styles.modalTitle}>
                    Petty Cash Requisition #{selectedRequest.petty_cash_id}
                  </h2>
                  <p style={styles.modalSubtitle}>
                    Submitted on {selectedRequest.created_at ? new Date(selectedRequest.created_at).toLocaleString() : 'N/A'}
                  </p>
                </div>
                <button type="button" onClick={() => setSelectedRequest(null)} style={styles.closeModalBtn}>✕</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '14px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Current Workflow Status</span>
                    <div style={{ marginTop: '4px' }}>{renderStatusBadge(selectedRequest.status)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Total Claimed</span>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#0284c7', marginTop: '2px' }}>
                      Rs. {Number(selectedRequest.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                <div style={styles.detailsGrid}>
                  <div style={styles.detailItem}>
                    <span style={styles.detailLabel}>Requester</span>
                    <span style={styles.detailValue}>
                      {selectedRequest.employee?.name} ({selectedRequest.employee?.email})
                    </span>
                  </div>

                  <div style={styles.detailItem}>
                    <span style={styles.detailLabel}>Expense Category</span>
                    <span style={styles.detailValue}>{selectedRequest.category}</span>
                  </div>

                  <div style={styles.detailItem}>
                    <span style={styles.detailLabel}>Allocated Task</span>
                    <span style={styles.detailValue}>
                      {selectedRequest.task?.task_code || `TASK-${selectedRequest.task_id}`}
                    </span>
                  </div>

                  <div style={styles.detailItem}>
                    <span style={styles.detailLabel}>Client Company</span>
                    <span style={styles.detailValue}>
                      {selectedRequest.task?.job?.loe?.company?.name || 'Internal'}
                    </span>
                  </div>

                  <div style={styles.detailItem}>
                    <span style={styles.detailLabel}>Service Deliverable</span>
                    <span style={styles.detailValue}>
                      {selectedRequest.task?.service?.name || 'Service Task'}
                    </span>
                  </div>

                  <div style={styles.detailItem}>
                    <span style={styles.detailLabel}>Date Required</span>
                    <span style={styles.detailValue}>
                      {selectedRequest.date_required ? selectedRequest.date_required.split('T')[0] : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Purpose Box */}
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <span style={styles.detailLabel}>Business Purpose / Justification ("Why")</span>
                  <p style={{ margin: '6px 0 0', fontSize: '13.5px', color: '#0f172a', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {selectedRequest.purpose}
                  </p>
                </div>

                {/* Two-Tier Approval Audit Trail */}
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={styles.detailLabel}>Two-Step Approval Audit Trail</span>

                  <div style={{ fontSize: '12.5px', color: '#334155' }}>
                    <strong>1. Department Manager Review:</strong>{' '}
                    {selectedRequest.manager_approver ? (
                      <span>
                        Verified by <strong>{selectedRequest.manager_approver.name}</strong> ({selectedRequest.manager_approver.role}) on{' '}
                        {selectedRequest.manager_approved_at ? new Date(selectedRequest.manager_approved_at).toLocaleString() : 'N/A'}
                      </span>
                    ) : selectedRequest.approver && !isPendingManagerStep(selectedRequest.status) ? (
                      <span>
                        Reviewed by <strong>{selectedRequest.approver.name}</strong> ({selectedRequest.approver.role}) on{' '}
                        {selectedRequest.approved_at ? new Date(selectedRequest.approved_at).toLocaleString() : 'N/A'}
                      </span>
                    ) : (
                      <span style={{ color: '#d97706', fontWeight: '600' }}>Pending Department Manager Verification</span>
                    )}
                  </div>

                  <div style={{ fontSize: '12.5px', color: '#334155' }}>
                    <strong>2. Finance Approval &amp; Disbursement:</strong>{' '}
                    {selectedRequest.finance_approver ? (
                      <span style={{ color: '#059669' }}>
                        Disbursed by <strong>{selectedRequest.finance_approver.name}</strong> ({selectedRequest.finance_approver.role}) on{' '}
                        {selectedRequest.finance_approved_at ? new Date(selectedRequest.finance_approved_at).toLocaleString() : new Date(selectedRequest.disbursed_at).toLocaleString()}
                      </span>
                    ) : selectedRequest.disbursed_at ? (
                      <span style={{ color: '#059669' }}>
                        Disbursed on {new Date(selectedRequest.disbursed_at).toLocaleString()}
                      </span>
                    ) : isPendingFinanceStep(selectedRequest.status) ? (
                      <span style={{ color: '#0284c7', fontWeight: '600' }}>Awaiting Finance Department Review &amp; Disbursement</span>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>Pending Step 1 Completion</span>
                    )}
                  </div>
                </div>

                {selectedRequest.status === 'Rejected' && selectedRequest.rejection_reason && (
                  <div style={{ background: '#fff1f2', padding: '12px 14px', borderRadius: '6px', border: '1px solid #fecdd3', fontSize: '13px', color: '#9f1239' }}>
                    <strong>Rejection Justification:</strong>
                    <div style={{ marginTop: '4px' }}>{selectedRequest.rejection_reason}</div>
                  </div>
                )}

                <div style={{ ...styles.modalActions, justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {isPendingManagerStep(selectedRequest.status) && canManagerApprove && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleManagerApprove(selectedRequest.petty_cash_id)}
                          style={{ ...styles.approveBtn, padding: '8px 14px', fontSize: '12.5px' }}
                        >
                          ✓ Approve (Send to Finance)
                        </button>
                        <button
                          type="button"
                          onClick={() => openRejectModal(selectedRequest)}
                          style={{ ...styles.rejectBtn, padding: '8px 14px', fontSize: '12.5px' }}
                        >
                          ✕ Reject
                        </button>
                      </>
                    )}
                    {isPendingFinanceStep(selectedRequest.status) && canFinanceDisburse && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleFinanceDisburse(selectedRequest.petty_cash_id)}
                          style={{ ...styles.disburseBtn, padding: '8px 14px', fontSize: '12.5px' }}
                        >
                          Confirm &amp; Disburse Funds
                        </button>
                        <button
                          type="button"
                          onClick={() => openRejectModal(selectedRequest)}
                          style={{ ...styles.rejectBtn, padding: '8px 14px', fontSize: '12.5px' }}
                        >
                          ✕ Reject
                        </button>
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedRequest(null)}
                    style={styles.cancelBtn}
                  >
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
}

const styles = {
  pageContainer: {
    minHeight: '100vh',
    background: '#f8fafc',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    marginLeft: 'var(--sidebar-width, 260px)',
    transition: 'margin-left 300ms ease-in-out'
  },
  container: {
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
  pageTitle: {
    margin: 0,
    fontSize: '26px',
    color: '#0f172a',
    fontWeight: '800',
    letterSpacing: '-0.3px'
  },
  subTitle: {
    margin: '4px 0 0',
    fontSize: '14px',
    color: '#64748b'
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
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: '#fff1f2',
    color: '#e11d48',
    padding: '12px 16px',
    borderRadius: '6px',
    marginBottom: '20px',
    fontSize: '13.5px',
    border: '1px solid #fecdd3'
  },
  successBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: '#ecfdf5',
    color: '#059669',
    padding: '12px 16px',
    borderRadius: '6px',
    marginBottom: '20px',
    fontSize: '13.5px',
    border: '1px solid #a7f3d0'
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
    marginBottom: '24px'
  },
  metricCard: {
    background: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    padding: '16px 20px',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
  },
  metricLabel: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
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
    marginTop: '4px'
  },
  listSection: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  card: {
    background: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
    overflow: 'hidden'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #e2e8f0',
    background: '#ffffff',
    flexWrap: 'wrap',
    gap: '12px'
  },
  cardTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '700',
    color: '#0f172a'
  },
  toggleGroup: {
    display: 'inline-flex',
    background: '#f1f5f9',
    padding: '3px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    gap: '2px'
  },
  toggleBtn: {
    padding: '6px 12px',
    border: 'none',
    background: 'transparent',
    color: '#475569',
    fontSize: '12px',
    fontWeight: '600',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  activeToggleBtn: {
    background: '#0284c7',
    color: '#ffffff',
    boxShadow: '0 1px 2px rgba(2, 132, 199, 0.25)'
  },
  gateNotice: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    background: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: '6px',
    padding: '12px 14px',
    marginBottom: '16px',
    fontSize: '12.5px',
    color: '#92400e',
    lineHeight: 1.45
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px'
  },
  label: {
    display: 'block',
    fontSize: '12.5px',
    fontWeight: 'bold',
    color: '#334155'
  },
  fieldHint: {
    display: 'block',
    fontSize: '11.5px',
    color: '#64748b',
    marginTop: '2px'
  },
  inputPrefixWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  inputPrefix: {
    position: 'absolute',
    left: '12px',
    fontSize: '13px',
    fontWeight: '700',
    color: '#64748b',
    pointerEvents: 'none'
  },
  selectInput: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '13.5px',
    color: '#0f172a',
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'border-color 0.15s ease'
  },
  buttonGroup: {
    display: 'flex',
    gap: '10px',
    marginTop: '10px',
    paddingTop: '12px',
    borderTop: '1px solid #f1f5f9'
  },
  submitModalBtn: {
    flex: '1',
    padding: '10px',
    background: '#0284c7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '13.5px',
    cursor: 'pointer'
  },
  cancelModalBtn: {
    flex: '1',
    padding: '10px',
    background: '#f1f5f9',
    color: '#334155',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '13.5px',
    cursor: 'pointer'
  },
  filterBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    alignItems: 'flex-end',
    background: '#ffffff',
    padding: '16px 18px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)'
  },
  filterField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    flex: '1',
    minWidth: '150px'
  },
  filterLabel: {
    fontSize: '11.5px',
    fontWeight: '700',
    color: '#475569'
  },
  filterInput: {
    padding: '8px 10px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '12.5px',
    outline: 'none',
    background: '#ffffff'
  },
  filterSelect: {
    padding: '8px 10px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '12.5px',
    background: '#ffffff',
    outline: 'none'
  },
  clearFilterBtn: {
    padding: '8px 14px',
    background: '#f8fafc',
    color: '#e11d48',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontWeight: '700',
    fontSize: '12px',
    cursor: 'pointer',
    height: '35px'
  },
  refreshBtn: {
    padding: '6px 12px',
    background: '#f8fafc',
    color: '#334155',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px'
  },
  th: {
    textAlign: 'left',
    padding: '12px 16px',
    background: '#f8fafc',
    color: '#475569',
    fontWeight: '700',
    borderBottom: '1px solid #e2e8f0',
    fontSize: '12px',
    letterSpacing: '0.2px'
  },
  tr: {
    borderBottom: '1px solid #e2e8f0',
    cursor: 'pointer',
    transition: 'background 0.15s ease'
  },
  td: {
    padding: '14px 16px',
    color: '#334155',
    verticalAlign: 'middle'
  },
  badge: {
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '700',
    display: 'inline-block',
    whiteSpace: 'nowrap'
  },
  taskCodePill: {
    background: '#f1f5f9',
    color: '#0f172a',
    border: '1px solid #cbd5e1',
    padding: '2px 7px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '0.3px'
  },
  categoryPill: {
    background: '#f0fdf4',
    color: '#166534',
    border: '1px solid #bbf7d0',
    padding: '2px 7px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
    display: 'inline-block'
  },
  approveBtn: {
    padding: '6px 11px',
    background: '#059669',
    color: '#ffffff',
    border: 'none',
    borderRadius: '5px',
    fontSize: '11.5px',
    fontWeight: '700',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  rejectBtn: {
    padding: '6px 11px',
    background: '#e11d48',
    color: '#ffffff',
    border: 'none',
    borderRadius: '5px',
    fontSize: '11.5px',
    fontWeight: '700',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  disburseBtn: {
    padding: '6px 11px',
    background: '#0284c7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '5px',
    fontSize: '11.5px',
    fontWeight: '700',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  settleBtn: {
    padding: '6px 11px',
    background: '#0284c7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '5px',
    fontSize: '11.5px',
    fontWeight: '700',
    cursor: 'pointer'
  },
  viewBtn: {
    padding: '6px 10px',
    background: '#f1f5f9',
    color: '#475569',
    border: '1px solid #cbd5e1',
    borderRadius: '5px',
    fontSize: '11.5px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(15, 23, 42, 0.55)',
    backdropFilter: 'blur(2px)',
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
    maxWidth: '540px',
    maxHeight: '90vh',
    overflowY: 'auto',
    padding: '28px',
    boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.25)',
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
  closeModalBtn: {
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
  modalErrorBox: {
    padding: '10px 14px',
    background: '#fff1f2',
    color: '#e11d48',
    borderRadius: '4px',
    fontSize: '13px',
    border: '1px solid #fecdd3',
    marginBottom: '14px'
  },
  loeDetailsBox: {
    background: '#f8fafc',
    padding: '12px 14px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    fontSize: '13px',
    marginBottom: '15px',
    color: '#334155'
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    background: '#ffffff',
    padding: '14px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0'
  },
  detailItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px'
  },
  detailLabel: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.4px'
  },
  detailValue: {
    fontSize: '13px',
    color: '#0f172a',
    fontWeight: '600'
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '12px',
    borderTop: '1px solid #e2e8f0',
    paddingTop: '15px'
  },
  cancelBtn: {
    padding: '8px 16px',
    background: '#f1f5f9',
    color: '#334155',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '700',
    fontSize: '12.5px'
  }
};

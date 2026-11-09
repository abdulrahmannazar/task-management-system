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
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Requisition Form state
  const [formData, setFormData] = useState({
    task_id: '',
    amount: '',
    category: 'Travel & Transport',
    purpose: '',
    date_required: new Date().toISOString().split('T')[0]
  });

  // Rejection Modal state
  const [rejectModalItem, setRejectModalItem] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState('');

  // Details Modal state
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Filter States
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
  const canManage = hasPermission(user, 'MANAGE_PETTY_CASH') || isAdmin || isManager;

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
        // Fallback to onrender if local endpoint returns 404
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

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError('');
      const queryParam = isAdmin
        ? '?role=ADMIN'
        : isManager
        ? `?role=MANAGER&department_id=${user.department_id || 1}`
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
        ? `?role=MANAGER&department_id=${user.department_id || 1}`
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

  const handleSubmitRequisition = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (allocatedTasks.length === 0) {
      setError('You must be allocated to an active task to request petty cash.');
      return;
    }

    if (!formData.task_id) {
      setError('Please select an allocated task.');
      return;
    }

    const numAmount = parseFloat(formData.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Amount must be a positive number greater than 0.');
      return;
    }

    if (!formData.purpose.trim()) {
      setError('Please specify the exact business purpose for this petty cash.');
      return;
    }

    if (!formData.date_required) {
      setError('Please specify the date required.');
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

      setSuccessMsg(`Petty cash request of Rs. ${numAmount.toFixed(2)} submitted successfully!`);
      setFormData({
        task_id: allocatedTasks[0] ? String(allocatedTasks[0].task_id) : '',
        amount: '',
        category: 'Travel & Transport',
        purpose: '',
        date_required: new Date().toISOString().split('T')[0]
      });

      await fetchRequests();
    } catch (err) {
      setError(err.message || 'Error submitting requisition');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      setError('');
      setSuccessMsg('');
      const res = await authenticatedFetch(`/api/petty-cash/${id}/approve`, {
        method: 'PUT'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve request');
      setSuccessMsg(`Request #${id} approved successfully!`);
      await fetchRequests();
    } catch (err) {
      setError(err.message || 'Error approving request');
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
        body: JSON.stringify({ rejection_reason: rejectionReason.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reject request');

      setSuccessMsg(`Request #${rejectModalItem.petty_cash_id} has been rejected.`);
      setRejectModalItem(null);
      await fetchRequests();
    } catch (err) {
      setRejectError(err.message || 'Error rejecting request');
    } finally {
      setRejecting(false);
    }
  };

  const handleDisburse = async (id) => {
    try {
      setError('');
      setSuccessMsg('');
      const res = await authenticatedFetch(`/api/petty-cash/${id}/disburse`, {
        method: 'PUT'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to disburse funds');
      setSuccessMsg(`Cash disbursement confirmed for Request #${id}.`);
      await fetchRequests();
    } catch (err) {
      setError(err.message || 'Error confirming disbursement');
    }
  };

  const handleSettle = async (id) => {
    try {
      setError('');
      setSuccessMsg('');
      const res = await authenticatedFetch(`/api/petty-cash/${id}/settle`, {
        method: 'PUT'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to mark as settled');
      setSuccessMsg(`Request #${id} marked as Settled.`);
      await fetchRequests();
    } catch (err) {
      setError(err.message || 'Error settling request');
    }
  };

  // Filter computation
  const filteredRequests = requests.filter((req) => {
    if (filterStatus !== 'ALL' && req.status !== filterStatus) return false;
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
  };

  // Metrics summary
  const totalAmount = requests.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const pendingCount = requests.filter((r) => r.status === 'Pending').length;
  const approvedCount = requests.filter((r) => r.status === 'Approved').length;
  const disbursedCount = requests.filter((r) => r.status === 'Disbursed').length;
  const settledCount = requests.filter((r) => r.status === 'Settled').length;

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Pending':
        return <span style={{ ...styles.badge, background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }}>Pending</span>;
      case 'Approved':
        return <span style={{ ...styles.badge, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>Approved</span>;
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
        {/* Header */}
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.pageTitle}>Petty Cash Management</h1>
            <p style={styles.subTitle}>
              Request and manage business operational expense disbursements linked directly to active allocated tasks.
            </p>
          </div>
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
            <div style={styles.metricLabel}>Pending Approval</div>
            <div style={{ ...styles.metricValue, color: '#d97706' }}>{pendingCount}</div>
            <div style={styles.metricSub}>Awaiting manager/admin review</div>
          </div>
          <div style={styles.metricCard}>
            <div style={styles.metricLabel}>Approved / Disbursed</div>
            <div style={{ ...styles.metricValue, color: '#7c3aed' }}>{approvedCount + disbursedCount}</div>
            <div style={styles.metricSub}>{disbursedCount} active in field</div>
          </div>
          <div style={styles.metricCard}>
            <div style={styles.metricLabel}>Total Expenditure</div>
            <div style={{ ...styles.metricValue, color: '#0284c7' }}>
              Rs. {totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={styles.metricSub}>{settledCount} receipts settled</div>
          </div>
        </div>

        {/* Main Grid: Left Form (380px) & Right List */}
        <div style={styles.mainGrid}>
          {/* Left Column: Requisition Form Card */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h2 style={styles.cardTitle}>Request Petty Cash</h2>
              <span style={styles.cardBadge}>Requisition Form</span>
            </div>

            <div style={styles.cardBody}>
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

              <form onSubmit={handleSubmitRequisition}>
                {/* 1. Allocated Task */}
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

                {/* 2. Amount */}
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

                {/* 3. Expense Category */}
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

                {/* 4. Purpose / Reason */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Purpose / Business Necessity ("Why") <span style={{ color: '#e11d48' }}>*</span>
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

                {/* 5. Date Required */}
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

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={!hasAllocatedTasks || submitting}
                  style={{
                    ...styles.submitBtn,
                    opacity: !hasAllocatedTasks || submitting ? 0.6 : 1,
                    cursor: !hasAllocatedTasks || submitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  {submitting ? 'Submitting Requisition...' : 'Submit Petty Cash Request'}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Filter Bar & Petty Cash Requests Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Disbursed">Disbursed</option>
                  <option value="Settled">Settled</option>
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

            {/* Table Card */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <h2 style={styles.cardTitle}>Petty Cash Requisitions</h2>
                  <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
                    Showing {filteredRequests.length} of {requests.length} requests
                  </div>
                </div>
                <button
                  type="button"
                  onClick={fetchRequests}
                  style={styles.refreshBtn}
                  title="Reload requisitions"
                >
                  ↻ Refresh
                </button>
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
                      ? 'Submit your first petty cash request using the form on the left.'
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
                        <th style={styles.th}>Allocated Task & Company</th>
                        <th style={styles.th}>Category & Purpose</th>
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
                              <div style={{ fontWeight: '600', color: '#1e293b' }}>
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
                              <div style={{ fontSize: '12px', color: '#1e293b', fontWeight: '500', marginTop: '3px' }}>
                                {companyName}
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>
                                {serviceName}
                              </div>
                            </td>

                            <td style={{ ...styles.td, maxWidth: '240px' }}>
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

                            <td style={{ ...styles.td, textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                              Rs. {Number(req.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>

                            <td style={{ ...styles.td, textAlign: 'center' }}>
                              {renderStatusBadge(req.status)}
                              {req.status === 'Rejected' && req.rejection_reason && (
                                <div
                                  style={{
                                    fontSize: '10.5px',
                                    color: '#e11d48',
                                    marginTop: '2px',
                                    maxWidth: '120px',
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
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', flexWrap: 'wrap' }}>
                                {/* Pending: Manager/Admin can Approve or Reject */}
                                {req.status === 'Pending' && canManage && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleApprove(req.petty_cash_id)}
                                      style={styles.approveBtn}
                                      title="Approve Requisition"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openRejectModal(req)}
                                      style={styles.rejectBtn}
                                      title="Reject Requisition"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}

                                {/* Approved: Admin/Manager can Disburse */}
                                {req.status === 'Approved' && canManage && (
                                  <button
                                    type="button"
                                    onClick={() => handleDisburse(req.petty_cash_id)}
                                    style={styles.disburseBtn}
                                    title="Mark Physical Cash Disbursed"
                                  >
                                    Disburse
                                  </button>
                                )}

                                {/* Disbursed: Requester or Manager/Admin can mark Settle */}
                                {req.status === 'Disbursed' && (isRequester || canManage) && (
                                  <button
                                    type="button"
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
        </div>

        {/* Rejection Reason Modal */}
        {rejectModalItem && (
          <div style={styles.modalOverlay}>
            <div style={styles.modalContent}>
              <div style={styles.modalHeader}>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>
                  Reject Petty Cash Request #{rejectModalItem.petty_cash_id}
                </h3>
                <button onClick={() => setRejectModalItem(null)} style={styles.closeBtn}>✕</button>
              </div>

              <form onSubmit={handleRejectSubmit} style={{ marginTop: '16px' }}>
                <div style={styles.loeDetailsBox}>
                  <strong>Requester:</strong> {rejectModalItem.employee?.name || 'Employee'} |{' '}
                  <strong>Amount:</strong> Rs. {Number(rejectModalItem.amount).toFixed(2)} |{' '}
                  <strong>Task:</strong> {rejectModalItem.task?.task_code || `#${rejectModalItem.task_id}`}
                </div>

                {rejectError && (
                  <div style={{ background: '#fff1f2', color: '#e11d48', padding: '10px 12px', borderRadius: '6px', fontSize: '12.5px', marginBottom: '14px', border: '1px solid #fecdd3' }}>
                    {rejectError}
                  </div>
                )}

                <div style={{ marginBottom: '16px' }}>
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

                <div style={styles.modalActions}>
                  <button
                    type="button"
                    onClick={() => setRejectModalItem(null)}
                    style={styles.cancelBtn}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={rejecting}
                    style={{ ...styles.rejectBtn, padding: '9px 18px', fontSize: '13px' }}
                  >
                    {rejecting ? 'Rejecting...' : 'Confirm Rejection'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Request Details Modal */}
        {selectedRequest && (
          <div style={styles.modalOverlay}>
            <div style={{ ...styles.modalContent, maxWidth: '650px' }}>
              <div style={styles.modalHeader}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>
                    Petty Cash Details #{selectedRequest.petty_cash_id}
                  </h3>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    Submitted on {selectedRequest.created_at ? new Date(selectedRequest.created_at).toLocaleString() : 'N/A'}
                  </div>
                </div>
                <button onClick={() => setSelectedRequest(null)} style={styles.closeBtn}>✕</button>
              </div>

              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Requisition Status</span>
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
                  <span style={styles.detailLabel}>Business Purpose ("Why")</span>
                  <p style={{ margin: '6px 0 0', fontSize: '13.5px', color: '#1e293b', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {selectedRequest.purpose}
                  </p>
                </div>

                {/* Approval / Rejection Audit Trail */}
                {selectedRequest.approver && (
                  <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12.5px' }}>
                    <strong>Reviewed By:</strong> {selectedRequest.approver.name} ({selectedRequest.approver.role}){' '}
                    {selectedRequest.approved_at && (
                      <span style={{ color: '#64748b' }}>
                        on {new Date(selectedRequest.approved_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                )}

                {selectedRequest.status === 'Rejected' && selectedRequest.rejection_reason && (
                  <div style={{ background: '#fff1f2', padding: '12px 14px', borderRadius: '6px', border: '1px solid #fecdd3', fontSize: '13px', color: '#9f1239' }}>
                    <strong>Rejection Justification:</strong>
                    <div style={{ marginTop: '4px' }}>{selectedRequest.rejection_reason}</div>
                  </div>
                )}

                {selectedRequest.disbursed_at && (
                  <div style={{ fontSize: '12.5px', color: '#059669' }}>
                    ✓ Physical cash disbursed at {new Date(selectedRequest.disbursed_at).toLocaleString()}
                  </div>
                )}

                <div style={styles.modalActions}>
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
    gap: '15px'
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
    color: '#475569'
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
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '370px 1fr',
    gap: '24px',
    alignItems: 'start'
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
    background: '#ffffff'
  },
  cardTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '700',
    color: '#0f172a'
  },
  cardBadge: {
    fontSize: '11px',
    fontWeight: '700',
    padding: '3px 8px',
    borderRadius: '12px',
    background: '#f0f9ff',
    color: '#0284c7',
    border: '1px solid #bae6fd'
  },
  cardBody: {
    padding: '20px'
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
  formGroup: {
    marginBottom: '16px'
  },
  label: {
    display: 'block',
    fontSize: '12.5px',
    fontWeight: '700',
    marginBottom: '6px',
    color: '#334155'
  },
  fieldHint: {
    display: 'block',
    fontSize: '11.5px',
    color: '#64748b',
    marginTop: '4px'
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
    padding: '9px 12px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '13px',
    color: '#1e293b',
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'border-color 0.15s ease'
  },
  submitBtn: {
    width: '100%',
    padding: '11px 16px',
    background: '#0284c7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: '700',
    fontSize: '13.5px',
    cursor: 'pointer',
    marginTop: '8px',
    transition: 'background 0.15s ease'
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
    padding: '3px 9px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '700',
    display: 'inline-block'
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
    padding: '5px 10px',
    background: '#059669',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '11.5px',
    fontWeight: '700',
    cursor: 'pointer'
  },
  rejectBtn: {
    padding: '5px 10px',
    background: '#e11d48',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '11.5px',
    fontWeight: '700',
    cursor: 'pointer'
  },
  disburseBtn: {
    padding: '5px 10px',
    background: '#7c3aed',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '11.5px',
    fontWeight: '700',
    cursor: 'pointer'
  },
  settleBtn: {
    padding: '5px 10px',
    background: '#0284c7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '11.5px',
    fontWeight: '700',
    cursor: 'pointer'
  },
  viewBtn: {
    padding: '5px 9px',
    background: '#f1f5f9',
    color: '#475569',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
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
    background: 'rgba(15, 23, 42, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px'
  },
  modalContent: {
    background: '#ffffff',
    borderRadius: '8px',
    width: '100%',
    maxWidth: '560px',
    maxHeight: '90vh',
    overflowY: 'auto',
    padding: '24px',
    boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.2)',
    border: '1px solid #e2e8f0'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '12px'
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    color: '#64748b'
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
    marginTop: '20px',
    borderTop: '1px solid #e2e8f0',
    paddingTop: '15px'
  },
  cancelBtn: {
    padding: '8px 16px',
    background: '#f1f5f9',
    color: '#334155',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '700',
    fontSize: '12.5px'
  }
};

import React, { useState, useEffect } from 'react';
import { API_BASE } from '../utils/api';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { usePermissions } from '../utils/permissionHelper';
import BlobLoader from '../components/BlobLoader';

const CURRENCY_SYMBOLS = {
  LKR: 'Rs.',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'AED',
  SAR: 'SAR',
  INR: '₹',
  AUD: 'A$',
  CAD: 'C$',
  SGD: 'S$'
};

const formatOrdinalDate = (dateStr) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(d.getTime())) return 'N/A';
  const day = d.getDate();
  const month = d.toLocaleString('en-GB', { month: 'long' });
  const year = d.getFullYear();
  const getOrdinalSuffix = (n) => {
    if (n > 3 && n < 21) return 'th';
    switch (n % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };
  return `${day}${getOrdinalSuffix(day)} ${month} ${year}`;
};

const parseScopePoints = (customScope, defaultScope) => {
  const textToParse = customScope || defaultScope;
  if (!textToParse) return ['Standard Engagement Deliverable'];
  const points = String(textToParse)
    .split(/\r?\n|•|●|▪/)
    .map((line) => line.replace(/^[-*•●▪\s]+/, '').trim())
    .filter(Boolean)
    .map((line) => line.charAt(0).toUpperCase() + line.slice(1));

  return points.length > 0 ? points : ['Standard Engagement Deliverable'];
};

export default function LoeDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();

  const [loe, setLoe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [rejectingItemId, setRejectingItemId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [staffSignatoryName, setStaffSignatoryName] = useState('');
  const [staffSignatoryTitle, setStaffSignatoryTitle] = useState('');
  const [staffAcceptanceDate, setStaffAcceptanceDate] = useState(() => new Date().toISOString().split('T')[0]);

  // View modes: Detailed breakdown vs Official Document Preview (with DRAFT watermark)
  const [activeTab, setActiveTab] = useState('DETAILS'); // 'DETAILS' | 'PREVIEW'
  const [modalDeliverable, setModalDeliverable] = useState(null);

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};

  const canEdit = hasPermission(user, 'CREATE_LOE');
  const canApprove = hasPermission(user, 'APPROVE_LOE');
  const canDelete = hasPermission(user, 'DELETE_LOE');
  const isAdmin = user.role === 'ADMIN';
  const userDeptId = user.department_id || 1;

  useEffect(() => {
    fetchLoeDetails();
  }, [id]);

  const fetchLoeDetails = async () => {
    try {
      setLoading(true);
      if (!token) throw new Error('Authentication token missing.');

      const response = await fetch(`${API_BASE}/api/loes/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch LOE details');
      setLoe(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isLoeRejected = loe?.status === 'Rejected' || (loe?.loe_items || []).some(item => item.status === 'Rejected');

  const handleApproveItem = async (itemId) => {
    if (isLoeRejected) {
      setError('Cannot approve deliverables on a rejected LOE. Rejecting one line item rejects the entire LOE. Please edit and resubmit.');
      return;
    }
    try {
      setProcessingId(itemId);
      setError('');
      setSuccessMsg('');

      const response = await fetch(
        `${API_BASE}/api/loes/${id}/items/${itemId}/approve`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ emp_id: user.emp_id })
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to approve deliverable');

      setLoe(data);
      setSuccessMsg('Deliverable approved successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectItem = async (itemId) => {
    if (!rejectionReason.trim()) {
      setError('Please provide a rejection reason before submitting.');
      return;
    }

    try {
      setProcessingId(itemId);
      setError('');
      setSuccessMsg('');

      const response = await fetch(
        `${API_BASE}/api/loes/${id}/items/${itemId}/reject`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ reason: rejectionReason, emp_id: user.emp_id })
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to reject deliverable');

      setLoe(data);
      setRejectingItemId(null);
      setRejectionReason('');
      setSuccessMsg('Deliverable marked as Rejected. The entire LOE has been marked as Rejected.');
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveAll = async () => {
    if (isLoeRejected) {
      setError('Cannot approve deliverables on a rejected LOE. Rejecting one line item rejects the entire LOE. Please edit and resubmit.');
      return;
    }
    try {
      setProcessingId('ALL');
      setError('');
      setSuccessMsg('');

      const response = await fetch(
        `${API_BASE}/api/loes/${id}/approve-all`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ emp_id: user.emp_id })
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to approve all deliverables');

      setLoe(data);
      setSuccessMsg('All deliverables on this LOE have been approved!');
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDiscontinueLoe = async () => {
    if (!window.confirm('Are you sure you want to mark this Letter of Engagement as Discontinued? All uncompleted child tasks will be discontinued and further billing locked.')) return;
    try {
      setProcessingId('DISCONTINUE');
      setError('');
      setSuccessMsg('');
      const response = await fetch(`${API_BASE}/api/loes/${id}/discontinue`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ emp_id: user.emp_id })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to discontinue LOE');
      setLoe(data.loe || { ...loe, status: 'Discontinued' });
      setSuccessMsg('Letter of Engagement officially marked as Discontinued. Associated child tasks have been discontinued.');
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleStaffRecordClientAcceptance = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!staffSignatoryName.trim()) {
      setError('Please enter the authorized signatory name before saving.');
      return;
    }
    try {
      setProcessingId('CLIENT_ACCEPT');
      setError('');
      setSuccessMsg('');
      const response = await fetch(`${API_BASE}/api/loes/${id}/client-acceptance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          signatory_name: staffSignatoryName.trim(),
          signatory_title: staffSignatoryTitle.trim() || 'Authorized Representative',
          acceptance_date: staffAcceptanceDate || new Date().toISOString().split('T')[0]
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to record client acceptance');
      setLoe(data.loe || { ...loe, is_client_accepted: true, client_signatory_name: staffSignatoryName, client_signatory_title: staffSignatoryTitle, client_accepted_at: new Date(staffAcceptanceDate) });
      setSuccessMsg('Client acceptance officially recorded! Tasks can now be allocated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteLoe = async () => {
    if (!window.confirm(`Are you sure you want to permanently delete LOE #${id}?`)) return;
    try {
      setError('');
      const response = await fetch(`${API_BASE}/api/loes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to delete LOE');
      }

      navigate('/loes');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setDownloading(true);
      setError('');

      let response;
      const cacheBuster = `?t=${Date.now()}`;

      if (window.location.hostname === 'localhost') {
        try {
          response = await fetch(`http://localhost:3000/api/loes/${id}/pdf${cacheBuster}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch {
          response = null;
        }
      }

      if (!response || !response.ok) {
        response = await fetch(`${API_BASE}/api/loes/${id}/pdf${cacheBuster}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to generate PDF document');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `LOE-${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setError(err.message || 'Error generating PDF');
    } finally {
      setDownloading(false);
    }
  };

  const getStatusBadgeStyle = (status) => {
    if (status === 'Approved') return { background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' };
    if (status === 'Rejected') return { background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3' };
    if (status === 'Approval Pending') return { background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' };
    if (status === 'Discontinued') return { background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1' };
    return { background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' };
  };

  const getItemBadgeStyle = (status) => {
    if (status === 'Approved') return { background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' };
    if (status === 'Rejected') return { background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3' };
    return { background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' };
  };

  const relevantItems = isAdmin 
    ? (loe?.loe_items || [])
    : (loe?.loe_items || []).filter(item => item.service?.department_id === userDeptId);

  const hasPendingItems = relevantItems.some(item => item.status === 'Pending');

  if (user?.role === 'EMPLOYEE' || !hasPermission(user, 'VIEW_LOES')) {
    return (
      <div style={styles.pageContainer}>
        <Navbar />
        <div style={{ padding: '60px 20px', textAlign: 'center', fontFamily: "'Poppins', sans-serif" }}>
          <h2 style={{ color: '#0f172a', marginBottom: '8px' }}>Access Denied</h2>
          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>
            Employees do not have access to view Letter of Engagement (LOE) details.
          </p>
          <button onClick={() => navigate('/tasks')} style={styles.backBtn}>
            Go to My Tasks
          </button>
        </div>
      </div>
    );
  }

  const totalFee = (loe?.loe_items || []).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const loeCurrency = loe?.currency || 'LKR';
  const loeSymbol = CURRENCY_SYMBOLS[loeCurrency] || loeCurrency;

  return (
    <div style={styles.pageContainer}>
      <Navbar />
      <div style={styles.container}>
        
        {/* Navigation / Header Bar */}
        <div style={styles.headerBar}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => navigate(-1)} style={styles.backBtn}>
              ← Back
            </button>
            <button onClick={() => navigate('/loes')} style={styles.backBtn}>
              All LOEs
            </button>
          </div>
          
          <div style={styles.actionButtons}>
            {/* Assigned Tasks Button */}
            <button
              type="button"
              onClick={() => navigate('/tasks', { state: { filterCompany: loe?.company?.name, filterLoeId: loe?.loe_id } })}
              style={styles.assignedTasksBtn}
              title="View tasks allocated under this engagement"
            >
              Assigned Tasks →
            </button>

            <button
              type="button"
              onClick={() => navigate(`/loes/${id}/client-approval`)}
              style={styles.clientPortalBtn}
            >
              Client Approval Portal ↗
            </button>

            {canApprove && hasPendingItems && loe?.status !== 'Discontinued' && !isLoeRejected && (
              <button
                type="button"
                onClick={handleApproveAll}
                disabled={processingId === 'ALL'}
                style={styles.approveAllTopBtn}
              >
                {processingId === 'ALL' ? 'Approving...' : 'Approve All Deliverables'}
              </button>
            )}

            {canEdit && loe?.status !== 'Discontinued' && (
              <button 
                type="button"
                onClick={() => navigate('/loes', { state: { editLoeId: Number(id) } })}
                style={isLoeRejected ? styles.editResubmitBtn : styles.editBtn}
              >
                {isLoeRejected ? 'Edit & Resubmit' : 'Edit LOE'}
              </button>
            )}

            <button 
              type="button"
              onClick={handleDownloadPdf} 
              disabled={downloading} 
              style={styles.downloadBtn}
            >
              {downloading ? 'Generating PDF...' : 'Download LOE PDF'}
            </button>

            {(isAdmin || user?.role === 'MANAGER') && loe?.status !== 'Discontinued' && (
              <button
                type="button"
                onClick={handleDiscontinueLoe}
                disabled={processingId === 'DISCONTINUE'}
                style={styles.discontinueBtn}
                title="Mark engagement as Discontinued midway"
              >
                {processingId === 'DISCONTINUE' ? 'Discontinuing...' : 'Discontinue'}
              </button>
            )}

            {canDelete && (
              <button
                type="button"
                onClick={handleDeleteLoe}
                style={styles.deleteBtn}
              >
                Delete LOE
              </button>
            )}
          </div>
        </div>

        {error && <div style={styles.errorBanner}>{error}</div>}
        {successMsg && <div style={styles.successBanner}>{successMsg}</div>}

        {loading ? (
          <div style={styles.loadingBox}><BlobLoader message="Loading Letter of Engagement..." /></div>
        ) : !loe ? (
          <div style={styles.loadingBox}>LOE record not found.</div>
        ) : (
          <div style={styles.content}>
            
            {/* Top Overview Card */}
            <div style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: '24px', color: '#1a202c' }}>
                    {loe.loe_code || `Letter of Engagement #${loe.loe_id}`}
                  </h1>
                  <p style={{ margin: '4px 0 0', color: '#0284c7', fontWeight: 'bold', fontSize: '15px' }}>
                    Total Contract Value ({loeCurrency}): {loeSymbol} {totalFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <span style={{ ...styles.badge, ...getStatusBadgeStyle(loe.status) }}>
                  {loe.status}
                </span>
              </div>
              
              {/* Strict Rejection Notice Banner */}
              {isLoeRejected && (
                <div style={styles.rejectionNoticeBox}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px', color: '#be123c' }}>
                    Engagement Status: Rejected — Attention Required
                  </div>
                  <div style={{ fontSize: '13px', lineHeight: '1.5', color: '#9f1239' }}>
                    One or more deliverables were rejected with revision notes. Under system policy, rejecting any single line item rejects the entire LOE. Deliverable approvals are locked until the creator updates the scope and resubmits via <strong>Edit &amp; Resubmit</strong>.
                  </div>
                </div>
              )}

              {/* View Switcher Tabs (Details Workspace vs Official Document Preview) */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '18px', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('DETAILS')}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '6px',
                    border: activeTab === 'DETAILS' ? '1px solid #0284c7' : '1px solid #cbd5e1',
                    background: activeTab === 'DETAILS' ? '#0284c7' : '#ffffff',
                    color: activeTab === 'DETAILS' ? '#ffffff' : '#475569',
                    fontWeight: '700',
                    fontSize: '13px',
                    cursor: 'pointer',
                    boxShadow: activeTab === 'DETAILS' ? '0 1px 3px rgba(2,132,199,0.25)' : 'none'
                  }}
                >
                  Overview &amp; Deliverables
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('PREVIEW')}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '6px',
                    border: activeTab === 'PREVIEW' ? '1px solid #0284c7' : '1px solid #cbd5e1',
                    background: activeTab === 'PREVIEW' ? '#0284c7' : '#ffffff',
                    color: activeTab === 'PREVIEW' ? '#ffffff' : '#475569',
                    fontWeight: '700',
                    fontSize: '13px',
                    cursor: 'pointer',
                    boxShadow: activeTab === 'PREVIEW' ? '0 1px 3px rgba(2,132,199,0.25)' : 'none'
                  }}
                >
                  Official Document Preview {loe.status !== 'Approved' ? '(DRAFT)' : ''}
                </button>
              </div>
            </div>

            {/* TAB 1: DETAILS WORKSPACE */}
            {activeTab === 'DETAILS' && (
              <>
                {/* Split Details Section: Company & Engagement */}
                <div style={styles.gridTwoCol}>
                  {/* Company Info */}
                  <div style={styles.card}>
                    <h3 style={styles.sectionHeader}>Client &amp; Company Details</h3>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Company Name</span>
                      <span style={styles.detailValue}>{loe.company?.name || 'N/A'}</span>
                    </div>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Client Type</span>
                      <span style={styles.detailValue}>{loe.company?.client_type || 'Corporate'}</span>
                    </div>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Registration No.</span>
                      <span style={styles.detailValue}>{loe.company?.reg_no || loe.company?.reg_number || 'N/A'}</span>
                    </div>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Email Address</span>
                      <span style={styles.detailValue}>{loe.company?.email || 'N/A'}</span>
                    </div>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Phone Number</span>
                      <span style={styles.detailValue}>{loe.company?.phone || loe.company?.phone_number || 'N/A'}</span>
                    </div>

                    {/* Dedicated Primary Contact Subsection */}
                    <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#0284c7', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.4px' }}>
                        Primary Contact Details
                      </div>
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>Contact Name</span>
                        <span style={styles.detailValue}>{loe.company?.primary_contact_name || 'Not specified'}</span>
                      </div>
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>Contact Email</span>
                        <span style={styles.detailValue}>{loe.company?.primary_contact_email || 'Not specified'}</span>
                      </div>
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>Contact Phone</span>
                        <span style={styles.detailValue}>{loe.company?.primary_contact_phone || 'Not specified'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Engagement Info */}
                  <div style={styles.card}>
                    <h3 style={styles.sectionHeader}>Engagement Metadata</h3>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Billing Type</span>
                      <span style={styles.detailValue}>{loe.type || 'Adhoc'}</span>
                    </div>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Billing Cycle</span>
                      <span style={styles.detailValue}>{loe.billing_frequency || 'One-Time'}</span>
                    </div>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Payment Currency</span>
                      <span style={{ ...styles.detailValue, color: '#0369a1', fontWeight: 'bold' }}>
                        {loeCurrency} ({loeSymbol})
                      </span>
                    </div>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Start Date</span>
                      <span style={styles.detailValue}>
                        {loe.start_date ? new Date(loe.start_date).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Created By</span>
                      <span style={styles.detailValue}>{loe.creator?.name || `Employee #${loe.created_by}`}</span>
                    </div>
                    {loe.approver?.name && (
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>Approved By</span>
                        <span style={styles.detailValue}>{loe.approver.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Client Acceptance & Approval Card */}
                <div style={styles.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>
                        Client Acceptance &amp; Approval Status
                      </h3>
                      <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
                        Tasks cannot be allocated to team members until client approval is officially recorded
                      </p>
                    </div>
                    {loe.is_client_accepted ? (
                      <span style={styles.clientApprovedBadge}>Client Approved &amp; Accepted</span>
                    ) : (
                      <span style={styles.clientPendingBadge}>Client Acceptance Pending</span>
                    )}
                  </div>

                  {loe.is_client_accepted ? (
                    <div style={styles.acceptanceDetailsGrid}>
                      <div style={styles.acceptanceField}>
                        <span style={styles.accLabel}>Signatory Name:</span>
                        <strong style={styles.accVal}>{loe.client_signatory_name || 'N/A'}</strong>
                      </div>
                      <div style={styles.acceptanceField}>
                        <span style={styles.accLabel}>Title / Designation:</span>
                        <strong style={styles.accVal}>{loe.client_signatory_title || 'Authorized Signatory'}</strong>
                      </div>
                      <div style={styles.acceptanceField}>
                        <span style={styles.accLabel}>Accepted Date:</span>
                        <strong style={styles.accVal}>{loe.client_accepted_at ? new Date(loe.client_accepted_at).toLocaleDateString() : 'N/A'}</strong>
                      </div>
                      <div style={styles.acceptanceField}>
                        <span style={styles.accLabel}>Task Allocation Status:</span>
                        <span style={{ color: '#059669', fontWeight: 'bold' }}>Unlocked (Tasks Can Be Allocated)</span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={styles.acceptanceWarning}>
                        <strong>Task Allocation Gate Active:</strong> Tasks under this engagement are currently locked. Staff can record the client acceptance below, or the client can accept via the Client Approval Portal.
                      </div>

                      <form onSubmit={handleStaffRecordClientAcceptance} style={styles.staffAcceptForm}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                          <div>
                            <label style={styles.formInputLabel}>Signatory Full Name *</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. John Doe"
                              value={staffSignatoryName}
                              onChange={(e) => setStaffSignatoryName(e.target.value)}
                              style={styles.textInput}
                            />
                          </div>
                          <div>
                            <label style={styles.formInputLabel}>Designation / Title</label>
                            <input
                              type="text"
                              placeholder="e.g. Managing Director"
                              value={staffSignatoryTitle}
                              onChange={(e) => setStaffSignatoryTitle(e.target.value)}
                              style={styles.textInput}
                            />
                          </div>
                          <div>
                            <label style={styles.formInputLabel}>Acceptance Date</label>
                            <input
                              type="date"
                              value={staffAcceptanceDate}
                              onChange={(e) => setStaffAcceptanceDate(e.target.value)}
                              style={styles.textInput}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <button
                            type="submit"
                            disabled={processingId === 'CLIENT_ACCEPT' || !staffSignatoryName.trim()}
                            style={styles.recordAcceptBtn}
                          >
                            {processingId === 'CLIENT_ACCEPT' ? 'Recording...' : 'Record Client Acceptance & Unlock Tasks'}
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/loes/${id}/client-approval`)}
                            style={styles.openPortalLinkBtn}
                          >
                            Open Client-Facing Acceptance View →
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>

                {/* Deliverables, Scopes & Inside Approval Section */}
                <div style={styles.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>
                        Service Deliverables &amp; Scope Details ({loeCurrency})
                      </h3>
                      <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
                        Review deliverables descriptions, scopes of work, and department approvals
                      </p>
                    </div>
                    {canApprove && !isLoeRejected && (
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        Review and approve/reject individual deliverables below
                      </span>
                    )}
                  </div>

                  {relevantItems.length === 0 ? (
                    <p style={{ color: '#64748b' }}>No service items listed for your department.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {relevantItems.map((item) => {
                        const scopePoints = parseScopePoints(item.custom_scope, item.service?.scope);

                        return (
                          <div key={item.loe_item_id} style={styles.itemCard}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <strong style={{ fontSize: '15px', color: '#1e293b' }}>
                                  {item.service?.name || `Service #${item.service_id}`}
                                </strong>
                                {item.service?.sub_category && (
                                  <span style={styles.subCatBadge}>
                                    {item.service.sub_category}
                                  </span>
                                )}
                                <span style={{ fontSize: '12px', color: '#64748b' }}>
                                  ({item.service?.department?.name || 'Department'})
                                </span>
                                <span style={styles.billingTypeBadge}>
                                  {item.service?.billing_type || loe.billing_frequency || 'One-Time'}
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#0f172a' }}>
                                  {loeSymbol} {Number(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                <span style={{ ...styles.itemBadge, ...getItemBadgeStyle(item.status) }}>
                                  {item.status}
                                </span>
                              </div>
                            </div>

                            {/* Formatted Bulleted Scope List + View Full Description Modal Button */}
                            <div style={styles.scopeBox}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <div style={styles.scopeTitle}>Scope of Work &amp; Deliverables:</div>
                                <button
                                  type="button"
                                  onClick={() => setModalDeliverable(item)}
                                  style={styles.viewFullDescBtn}
                                >
                                  View Full Scope &amp; Description ↗
                                </button>
                              </div>
                              <ul style={styles.scopeBulletList}>
                                {scopePoints.map((pt, idx) => (
                                  <li key={idx} style={styles.scopeBulletItem}>
                                    {pt}
                                  </li>
                                ))}
                              </ul>
                              {item.service?.scope && item.custom_scope && (
                                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #e2e8f0', fontSize: '12px', color: '#64748b' }}>
                                  <span style={{ fontWeight: '600' }}>Service Catalogue Scope:</span> {item.service.scope.length > 180 ? item.service.scope.slice(0, 180) + '...' : item.service.scope}
                                </div>
                              )}
                            </div>

                            {item.status === 'Rejected' && item.rejection_reason && (
                              <div style={{ marginTop: '8px', fontSize: '12px', color: '#c53030', background: '#fff5f5', padding: '8px 12px', borderRadius: '4px', border: '1px solid #fecdd3' }}>
                                <strong>Rejection Note:</strong> {item.rejection_reason}
                              </div>
                            )}

                            {/* Approval Controls Inside LOE Details */}
                            {canApprove && (
                              <div style={styles.approvalActionRow}>
                                {isLoeRejected ? (
                                  <div style={{ fontSize: '12px', color: '#be123c', fontWeight: '600', padding: '4px 0' }}>
                                    Approval locked: Rejecting one line item rejects the entire LOE. Please edit and resubmit to resume approvals.
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    {item.status !== 'Approved' && (
                                      <button
                                        type="button"
                                        onClick={() => handleApproveItem(item.loe_item_id)}
                                        disabled={processingId === item.loe_item_id}
                                        style={styles.approveItemBtn}
                                      >
                                        {processingId === item.loe_item_id ? 'Saving...' : 'Approve Deliverable'}
                                      </button>
                                    )}

                                    {item.status !== 'Rejected' && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRejectingItemId(
                                            rejectingItemId === item.loe_item_id ? null : item.loe_item_id
                                          );
                                          setRejectionReason(item.rejection_reason || '');
                                        }}
                                        style={styles.rejectItemBtn}
                                      >
                                        Reject Deliverable
                                      </button>
                                    )}
                                  </div>
                                )}

                                {rejectingItemId === item.loe_item_id && (
                                  <div style={styles.rejectFormRow}>
                                    <input
                                      type="text"
                                      placeholder="Specify reason for rejecting this scope (rejects entire LOE)..."
                                      value={rejectionReason}
                                      onChange={(e) => setRejectionReason(e.target.value)}
                                      style={styles.rejectInput}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleRejectItem(item.loe_item_id)}
                                      disabled={processingId === item.loe_item_id}
                                      style={styles.confirmRejectBtn}
                                    >
                                      Submit Rejection
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRejectingItemId(null);
                                        setRejectionReason('');
                                      }}
                                      style={styles.cancelRejectBtn}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* TAB 2: OFFICIAL DOCUMENT PREVIEW (with DRAFT watermark if not approved) */}
            {activeTab === 'PREVIEW' && (
              <div style={styles.previewContainer}>
                {/* Diagonal DRAFT Watermark for non-approved LOEs */}
                {loe.status !== 'Approved' && (
                  <div style={styles.previewWatermark}>
                    DRAFT
                  </div>
                )}

                {/* Letterhead Top Banner */}
                <div style={{ textAlign: 'center', marginBottom: '24px', borderBottom: '2px solid #0f172a', paddingBottom: '14px' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    FRONTIER ADVISORY (PRIVATE) LIMITED
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                    Corporate Advisory • Tax &amp; Regulatory Services • Management Consulting
                  </div>
                </div>

                {/* Date and Ref */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '13px', color: '#334155' }}>
                  <div>{formatOrdinalDate(loe.start_date)},</div>
                  <div style={{ fontWeight: 'bold', color: '#0f172a' }}>{loe.loe_code || `#${String(loe.loe_id).padStart(7, '0')}`}</div>
                </div>

                {/* Recipient */}
                <div style={{ marginBottom: '20px', fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
                  <div>The Directors,</div>
                  <strong style={{ fontSize: '14px', color: '#0f172a' }}>{loe.company?.name || 'The Client'}</strong>
                  {loe.company?.reg_no && <div>Company Reg: {loe.company.reg_no}</div>}
                  {loe.company?.email && <div>Email: {loe.company.email}</div>}
                </div>

                {/* Engagement Subject & Salutation */}
                <div style={{ marginBottom: '16px', fontSize: '13px', color: '#334155', lineHeight: '1.6' }}>
                  <div style={{ marginBottom: '10px' }}>Dear Sirs,</div>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#0f172a', textDecoration: 'underline', marginBottom: '10px' }}>
                    ENGAGEMENT AS PROFESSIONAL CONSULTANTS FOR {String(loe.company?.name || 'THE COMPANY').toUpperCase()}
                  </div>
                  <p style={{ margin: '0 0 10px', textAlign: 'justify' }}>
                    We refer to your request and confirm our engagement to provide professional advisory and consulting services as outlined in the schedules and scope of work below.
                  </p>
                </div>

                {/* Deliverables Section */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '13.5px', color: '#0f172a', marginBottom: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                    1. SCOPE OF SERVICES &amp; DELIVERABLES
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', marginBottom: '16px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left', color: '#334155', fontWeight: 'bold' }}>#</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', color: '#334155', fontWeight: 'bold' }}>Service &amp; Sub-Category</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', color: '#334155', fontWeight: 'bold' }}>Scope of Work / Description</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', color: '#334155', fontWeight: 'bold' }}>Routine</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', color: '#334155', fontWeight: 'bold' }}>Amount ({loeCurrency})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(loe.loe_items || []).map((it, idx) => (
                        <tr key={it.loe_item_id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 10px', verticalAlign: 'top', color: '#64748b' }}>{idx + 1}</td>
                          <td style={{ padding: '10px 10px', verticalAlign: 'top' }}>
                            <strong style={{ color: '#0f172a' }}>{it.service?.name || `Service #${it.service_id}`}</strong>
                            {it.service?.sub_category && (
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                {it.service.sub_category}
                              </div>
                            )}
                            <div style={{ fontSize: '11px', color: '#0284c7', marginTop: '2px' }}>
                              {it.service?.department?.name || 'Department'}
                            </div>
                          </td>
                          <td style={{ padding: '10px 10px', verticalAlign: 'top', color: '#334155', lineHeight: '1.5' }}>
                            {it.custom_scope ? (
                              <div style={{ whiteSpace: 'pre-wrap' }}>{it.custom_scope}</div>
                            ) : it.service?.scope ? (
                              <div style={{ whiteSpace: 'pre-wrap' }}>{it.service.scope}</div>
                            ) : (
                              <div style={{ fontStyle: 'italic', color: '#94a3b8' }}>Standard Deliverables</div>
                            )}
                          </td>
                          <td style={{ padding: '10px 10px', verticalAlign: 'top', color: '#475569', whiteSpace: 'nowrap' }}>
                            {it.service?.billing_type || loe.billing_frequency || 'One-Time'}
                          </td>
                          <td style={{ padding: '10px 10px', verticalAlign: 'top', textAlign: 'right', fontWeight: 'bold', color: '#0f172a', whiteSpace: 'nowrap' }}>
                            {loeSymbol} {Number(it.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ borderTop: '2px solid #0f172a', background: '#f8fafc', fontWeight: 'bold' }}>
                        <td colSpan={4} style={{ padding: '10px', textAlign: 'right', color: '#0f172a' }}>
                          Total Professional Fees:
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', color: '#0284c7', fontSize: '14px' }}>
                          {loeSymbol} {totalFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Terms & Payment Routine */}
                <div style={{ marginBottom: '24px', fontSize: '13px', color: '#334155', lineHeight: '1.6' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '13.5px', color: '#0f172a', marginBottom: '8px' }}>
                    2. TERMS OF PAYMENT &amp; BILLING
                  </div>
                  <p style={{ margin: '0 0 8px', textAlign: 'justify' }}>
                    Professional fees shall be invoiced based on the agreed billing routine (<strong>{loe.billing_frequency || 'One-Time'}</strong>) in <strong>{loeCurrency}</strong>. Invoices are due and payable upon receipt or as specified on official tax invoices. Out-of-pocket expenses and government levies, if applicable, will be charged separately at actual cost.
                  </p>
                </div>

                {/* Signatures */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '36px', paddingTop: '20px', borderTop: '1px solid #cbd5e1' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '24px' }}>Yours faithfully,</div>
                    <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#0f172a' }}>Frontier Advisory (Pvt) Ltd</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>Authorized Signatory</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '24px' }}>Confirmed and Accepted by:</div>
                    <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#0f172a' }}>
                      {loe.client_signatory_name || 'Authorized Client Representative'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      {loe.client_signatory_title || 'Director / Officer'}
                    </div>
                    {loe.client_accepted_at && (
                      <div style={{ fontSize: '11.5px', color: '#059669', marginTop: '4px' }}>
                        Signed on: {new Date(loe.client_accepted_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FULL SCOPE & DESCRIPTION MODAL */}
      {modalDeliverable && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            {/* Modal Header */}
            <div style={styles.modalHeader}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a', fontWeight: 'bold' }}>
                  {modalDeliverable.service?.name || `Service #${modalDeliverable.service_id}`}
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  {modalDeliverable.service?.department?.name || 'Department'} {modalDeliverable.service?.sub_category ? `• ${modalDeliverable.service.sub_category}` : ''}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setModalDeliverable(null)}
                style={styles.closeModalBtn}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={styles.modalBody}>
              {/* Metadata Badges */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ background: '#f1f5f9', padding: '6px 12px', borderRadius: '6px', fontSize: '12px' }}>
                  <span style={{ color: '#64748b', fontWeight: '600' }}>Billing Type: </span>
                  <strong style={{ color: '#0f172a' }}>{modalDeliverable.service?.billing_type || loe?.billing_frequency || 'One-Time'}</strong>
                </div>
                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', padding: '6px 12px', borderRadius: '6px', fontSize: '12px' }}>
                  <span style={{ color: '#0284c7', fontWeight: '600' }}>Amount: </span>
                  <strong style={{ color: '#0284c7' }}>{loeSymbol} {Number(modalDeliverable.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </div>
                <div style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', ...getItemBadgeStyle(modalDeliverable.status) }}>
                  <strong>Status: {modalDeliverable.status}</strong>
                </div>
              </div>

              {/* Engagement Custom Scope */}
              <div>
                <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Engagement Scope &amp; Deliverables Description
                </h4>
                <div style={styles.modalScopeContent}>
                  {modalDeliverable.custom_scope || 'No custom scope entered for this deliverable. Refer to the catalogue scope below.'}
                </div>
              </div>

              {/* Service Catalogue Scope */}
              {modalDeliverable.service?.scope && (
                <div>
                  <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Service Catalogue Standard Scope
                  </h4>
                  <div style={styles.modalScopeContent}>
                    {modalDeliverable.service.scope}
                  </div>
                </div>
              )}

              {/* Rejection Note */}
              {modalDeliverable.rejection_reason && (
                <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', padding: '12px', borderRadius: '6px', color: '#e11d48', fontSize: '13px' }}>
                  <strong>Rejection Note:</strong> {modalDeliverable.rejection_reason}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={styles.modalFooter}>
              <button
                type="button"
                onClick={() => setModalDeliverable(null)}
                style={styles.modalCloseBtn}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  assignedTasksBtn: {
    padding: '8px 14px',
    background: '#0f172a',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px'
  },
  clientPortalBtn: {
    padding: '8px 14px',
    background: '#0284c7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer'
  },
  discontinueBtn: {
    padding: '8px 14px',
    background: '#f1f5f9',
    color: '#64748b',
    border: '1.5px solid #cbd5e1',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer'
  },
  clientApprovedBadge: {
    padding: '4px 12px',
    background: '#ecfdf5',
    color: '#059669',
    border: '1px solid #a7f3d0',
    borderRadius: '14px',
    fontWeight: 'bold',
    fontSize: '12px'
  },
  clientPendingBadge: {
    padding: '4px 12px',
    background: '#fffbeb',
    color: '#d97706',
    border: '1px solid #fde68a',
    borderRadius: '14px',
    fontWeight: 'bold',
    fontSize: '12px'
  },
  acceptanceDetailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '14px',
    background: '#f8fafc',
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0'
  },
  acceptanceField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  accLabel: {
    fontSize: '11px',
    color: '#64748b',
    textTransform: 'uppercase',
    fontWeight: 'bold'
  },
  accVal: {
    fontSize: '13.5px',
    color: '#0f172a'
  },
  acceptanceWarning: {
    background: '#fffbeb',
    color: '#b45309',
    border: '1px solid #fde68a',
    padding: '10px 14px',
    borderRadius: '6px',
    fontSize: '13px',
    marginBottom: '14px'
  },
  staffAcceptForm: {
    background: '#f8fafc',
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0'
  },
  formInputLabel: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: '4px'
  },
  textInput: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 10px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '13px'
  },
  recordAcceptBtn: {
    padding: '9px 18px',
    background: '#0284c7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer'
  },
  openPortalLinkBtn: {
    background: 'none',
    border: 'none',
    color: '#0284c7',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer',
    textDecoration: 'underline'
  },
  pageContainer: {
    minHeight: '100vh',
    background: '#f8fafc',
    fontFamily: "'Poppins', system-ui, -apple-system, sans-serif",
    marginLeft: 'var(--sidebar-width, 260px)',
    transition: 'margin-left 300ms ease-in-out'
  },
  container: {
    maxWidth: '1050px',
    margin: '0 auto',
    padding: '30px 20px'
  },
  headerBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '10px',
    paddingRight: '90px'
  },
  backBtn: {
    padding: '8px 14px',
    background: '#fff',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    color: '#334155'
  },
  actionButtons: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    alignItems: 'center'
  },
  approveAllTopBtn: {
    padding: '8px 16px',
    background: '#0284c7',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  editBtn: {
    padding: '8px 16px',
    background: '#059669',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  editResubmitBtn: {
    padding: '8px 16px',
    background: '#be123c',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  downloadBtn: {
    padding: '8px 16px',
    background: '#0891b2',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  deleteBtn: {
    padding: '8px 16px',
    background: '#e11d48',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  errorBanner: {
    background: '#fff1f2',
    color: '#e11d48',
    padding: '12px',
    borderRadius: '6px',
    marginBottom: '16px',
    fontSize: '13px',
    border: '1px solid #fecdd3'
  },
  successBanner: {
    background: '#ecfdf5',
    color: '#059669',
    padding: '12px',
    borderRadius: '6px',
    marginBottom: '16px',
    fontSize: '13px',
    border: '1px solid #a7f3d0'
  },
  loadingBox: {
    background: '#fff',
    padding: '40px',
    textAlign: 'center',
    borderRadius: '8px',
    color: '#64748b',
    border: '1px solid #e2e8f0'
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  card: {
    background: '#fff',
    padding: '22px',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
    border: '1px solid #e2e8f0'
  },
  badge: {
    padding: '6px 12px',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '12px'
  },
  rejectionNoticeBox: {
    marginTop: '14px',
    padding: '14px 16px',
    background: '#fff1f2',
    border: '1px solid #fecdd3',
    borderRadius: '6px'
  },
  gridTwoCol: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px'
  },
  sectionHeader: {
    margin: '0 0 14px',
    fontSize: '16px',
    color: '#0f172a',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '8px',
    fontWeight: '700'
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 0',
    fontSize: '13px',
    borderBottom: '1px dashed #f1f5f9'
  },
  detailLabel: {
    color: '#64748b',
    fontWeight: '600'
  },
  detailValue: {
    color: '#0f172a',
    fontWeight: '500'
  },
  itemCard: {
    padding: '16px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px'
  },
  itemBadge: {
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 'bold'
  },
  subCatBadge: {
    fontSize: '11px',
    background: '#e0f2fe',
    color: '#0369a1',
    padding: '2px 8px',
    borderRadius: '4px',
    fontWeight: '600'
  },
  billingTypeBadge: {
    fontSize: '11px',
    background: '#f1f5f9',
    color: '#475569',
    padding: '2px 8px',
    borderRadius: '4px'
  },
  scopeBox: {
    marginTop: '10px',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    padding: '12px 14px'
  },
  scopeTitle: {
    fontSize: '11.5px',
    fontWeight: 'bold',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.4px'
  },
  viewFullDescBtn: {
    background: 'none',
    border: 'none',
    color: '#0284c7',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
    padding: '2px 6px',
    textDecoration: 'underline'
  },
  scopeBulletList: {
    margin: '6px 0 0',
    paddingLeft: '18px',
    color: '#334155',
    fontSize: '13px',
    lineHeight: '1.55'
  },
  scopeBulletItem: {
    marginBottom: '3px'
  },
  approvalActionRow: {
    marginTop: '12px',
    paddingTop: '10px',
    borderTop: '1px dashed #cbd5e1'
  },
  approveItemBtn: {
    padding: '6px 14px',
    background: '#059669',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  rejectItemBtn: {
    padding: '6px 14px',
    background: '#e11d48',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  rejectFormRow: {
    display: 'flex',
    gap: '8px',
    marginTop: '10px'
  },
  rejectInput: {
    flex: 1,
    padding: '7px 10px',
    borderRadius: '5px',
    border: '1px solid #cbd5e1',
    fontSize: '13px'
  },
  confirmRejectBtn: {
    padding: '7px 14px',
    background: '#be123c',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  cancelRejectBtn: {
    padding: '7px 12px',
    background: '#f1f5f9',
    color: '#334155',
    border: '1px solid #cbd5e1',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  previewContainer: {
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    boxShadow: '0 4px 20px rgba(15, 23, 42, 0.08)',
    borderRadius: '8px',
    padding: '40px 48px',
    maxWidth: '900px',
    margin: '0 auto',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: "'Times New Roman', Times, serif"
  },
  previewWatermark: {
    position: 'absolute',
    top: '45%',
    left: '50%',
    transform: 'translate(-50%, -50%) rotate(-45deg)',
    fontSize: '84px',
    fontFamily: "'Times New Roman', Times, serif",
    fontWeight: '900',
    letterSpacing: '14px',
    color: 'rgba(225, 29, 72, 0.12)',
    textTransform: 'uppercase',
    pointerEvents: 'none',
    userSelect: 'none',
    zIndex: 10,
    whiteSpace: 'nowrap'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    padding: '20px'
  },
  modalBox: {
    background: '#ffffff',
    borderRadius: '8px',
    maxWidth: '650px',
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    overflow: 'hidden',
    fontFamily: "'Poppins', system-ui, -apple-system, sans-serif"
  },
  modalHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#f8fafc'
  },
  closeModalBtn: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    color: '#64748b',
    cursor: 'pointer',
    padding: '4px'
  },
  modalBody: {
    padding: '20px',
    overflowY: 'auto',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  modalScopeContent: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    padding: '14px',
    fontSize: '13.5px',
    color: '#1e293b',
    whiteSpace: 'pre-wrap',
    lineHeight: '1.6'
  },
  modalFooter: {
    padding: '12px 20px',
    borderTop: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'flex-end',
    background: '#f8fafc'
  },
  modalCloseBtn: {
    padding: '8px 18px',
    background: '#0f172a',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer'
  }
};

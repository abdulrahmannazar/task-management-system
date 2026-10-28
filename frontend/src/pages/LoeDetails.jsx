import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

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

// Helper to parse any custom or template scope into clean, capitalized bullet points
const parseScopePoints = (scopeText) => {
  if (!scopeText) return ['Standard Deliverable'];
  const points = String(scopeText)
    .split(/\r?\n|•|●|▪/)
    .map((line) => line.replace(/^[-*•●▪\s]+/, '').trim())
    .filter(Boolean)
    .map((line) => line.charAt(0).toUpperCase() + line.slice(1));

  return points.length > 0 ? points : ['Standard Deliverable'];
};

export default function LoeDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loe, setLoe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [rejectingItemId, setRejectingItemId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};
  
  const canEdit = user.role === 'ADMIN' || user.role === 'MANAGER';
  const isAdmin = user.role === 'ADMIN';
  const userDeptId = user.department_id || 1;

  useEffect(() => {
    fetchLoeDetails();
  }, [id]);

  const fetchLoeDetails = async () => {
    try {
      setLoading(true);
      if (!token) throw new Error('Authentication token missing.');

      const response = await fetch(`https://task-management-system-6ifq.onrender.com/api/loes/${id}`, {
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

  const handleApproveItem = async (itemId) => {
    try {
      setProcessingId(itemId);
      setError('');
      setSuccessMsg('');

      const response = await fetch(
        `https://task-management-system-6ifq.onrender.com/api/loes/${id}/items/${itemId}/approve`,
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
        `https://task-management-system-6ifq.onrender.com/api/loes/${id}/items/${itemId}/reject`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ reason: rejectionReason })
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to reject deliverable');

      setLoe(data);
      setRejectingItemId(null);
      setRejectionReason('');
      setSuccessMsg('Deliverable marked as Rejected.');
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveAll = async () => {
    try {
      setProcessingId('ALL');
      setError('');
      setSuccessMsg('');

      const response = await fetch(
        `https://task-management-system-6ifq.onrender.com/api/loes/${id}/approve-all`,
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

  const handleDownloadPdf = async () => {
    try {
      setDownloading(true);
      setError('');

      let response;
      const cacheBuster = `?t=${Date.now()}`;

      // If running on localhost, try local backend (port 3000) first so template edits show immediately
      if (window.location.hostname === 'localhost') {
        try {
          response = await fetch(`http://localhost:3000/api/loes/${id}/pdf${cacheBuster}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch {
          response = null;
        }
      }

      // Fallback to Render backend if local backend is not running
      if (!response || !response.ok) {
        response = await fetch(`https://task-management-system-6ifq.onrender.com/api/loes/${id}/pdf${cacheBuster}`, {
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
    if (status === 'Approved') return { background: '#28a745', color: '#fff' };
    if (status === 'Rejected') return { background: '#dc3545', color: '#fff' };
    if (status === 'Approval Pending') return { background: '#ffc107', color: '#000' };
    return { background: '#6c757d', color: '#fff' };
  };

  const getItemBadgeStyle = (status) => {
    if (status === 'Approved') return { background: '#e6fffa', color: '#234e52', border: '1px solid #b2f5ea' };
    if (status === 'Rejected') return { background: '#fff5f5', color: '#c53030', border: '1px solid #feb2b2' };
    return { background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' };
  };

  const relevantItems = isAdmin 
    ? (loe?.loe_items || [])
    : (loe?.loe_items || []).filter(item => item.service?.department_id === userDeptId);

  const hasPendingItems = relevantItems.some(item => item.status === 'Pending');
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
            {canEdit && hasPendingItems && (
              <button
                onClick={handleApproveAll}
                disabled={processingId === 'ALL'}
                style={styles.approveAllTopBtn}
              >
                {processingId === 'ALL' ? 'Approving...' : '✓ Approve All Deliverables'}
              </button>
            )}

            {canEdit && (
              <button 
                onClick={() => navigate('/loes', { state: { editLoeId: Number(id) } })}
                style={styles.editBtn}
              >
                {loe?.status === 'Rejected' ? 'Edit & Resubmit' : 'Edit LOE'}
              </button>
            )}

            <button 
              onClick={handleDownloadPdf} 
              disabled={downloading} 
              style={styles.downloadBtn}
            >
              {downloading ? 'Generating PDF...' : 'Download LOE PDF'}
            </button>
          </div>
        </div>

        {error && <div style={styles.errorBanner}>{error}</div>}
        {successMsg && <div style={styles.successBanner}>{successMsg}</div>}

        {loading ? (
          <div style={styles.loadingBox}>Loading LOE details...</div>
        ) : !loe ? (
          <div style={styles.loadingBox}>LOE record not found.</div>
        ) : (
          <div style={styles.content}>
            
            {/* Top Overview Card */}
            <div style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: '24px', color: '#1a202c' }}>
                    {loe.loe_code || `Letter of Engagement #${loe.loe_id}`}
                  </h1>
                  <p style={{ margin: '4px 0 0', color: '#2b6cb0', fontWeight: 'bold' }}>
                    Total Contract Value ({loeCurrency}): {loeSymbol} {totalFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <span style={{ ...styles.badge, ...getStatusBadgeStyle(loe.status) }}>
                  {loe.status}
                </span>
              </div>
              
              {loe.status === 'Rejected' && (
                <div style={styles.rejectedBanner}>
                  ⚠️ This LOE has rejected items requiring correction. Click <strong>Edit &amp; Resubmit</strong> above to update the scopes.
                </div>
              )}
            </div>

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
                  <span style={styles.detailValue}>{loe.company?.reg_no || 'N/A'}</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Email Address</span>
                  <span style={styles.detailValue}>{loe.company?.email || 'N/A'}</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Phone Number</span>
                  <span style={styles.detailValue}>{loe.company?.phone || 'N/A'}</span>
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
              </div>
            </div>

            {/* Deliverables, Scopes & Inside Approval Section */}
            <div style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>
                  Service Deliverables &amp; Approval Workspace ({loeCurrency})
                </h3>
                {canEdit && (
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
                    const scopePoints = parseScopePoints(item.custom_scope);

                    return (
                      <div key={item.loe_item_id} style={styles.itemCard}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                          <div>
                            <strong style={{ fontSize: '15px', color: '#1e293b' }}>
                              {item.service?.name || `Service #${item.service_id}`}
                            </strong>
                            <span style={{ marginLeft: '8px', fontSize: '12px', color: '#64748b' }}>
                              ({item.service?.department?.name || 'Department'})
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

                        {/* Formatted Bulleted Scope Block */}
                        <div style={styles.scopeBox}>
                          <div style={styles.scopeTitle}>Scope of Work:</div>
                          <ul style={styles.scopeBulletList}>
                            {scopePoints.map((pt, idx) => (
                              <li key={idx} style={styles.scopeBulletItem}>
                                {pt}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {item.status === 'Rejected' && item.rejection_reason && (
                          <div style={{ marginTop: '8px', fontSize: '12px', color: '#c53030', background: '#fff5f5', padding: '6px 10px', borderRadius: '4px' }}>
                            <strong>Rejection Note:</strong> {item.rejection_reason}
                          </div>
                        )}

                        {/* Approval Controls Inside LOE Details */}
                        {canEdit && (
                          <div style={styles.approvalActionRow}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              {item.status !== 'Approved' && (
                                <button
                                  type="button"
                                  onClick={() => handleApproveItem(item.loe_item_id)}
                                  disabled={processingId === item.loe_item_id}
                                  style={styles.approveItemBtn}
                                >
                                  {processingId === item.loe_item_id ? 'Saving...' : '✓ Approve Deliverable'}
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
                                  ✕ Reject Deliverable
                                </button>
                              )}
                            </div>

                            {rejectingItemId === item.loe_item_id && (
                              <div style={styles.rejectFormRow}>
                                <input
                                  type="text"
                                  placeholder="Specify reason for rejecting this scope..."
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

          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  pageContainer: { minHeight: '100vh', background: '#f4f6f8', fontFamily: 'system-ui' },
  container: { maxWidth: '1050px', margin: '0 auto', padding: '30px 20px' },
  headerBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' },
  backBtn: { padding: '8px 14px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', color: '#334155' },
  actionButtons: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  approveAllTopBtn: { padding: '8px 16px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  editBtn: { padding: '8px 16px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  downloadBtn: { padding: '8px 16px', background: '#17a2b8', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  errorBanner: { background: '#fed7d7', color: '#c53030', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' },
  successBanner: { background: '#d4edda', color: '#155724', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' },
  loadingBox: { background: '#fff', padding: '40px', textAlign: 'center', borderRadius: '8px', color: '#64748b' },
  content: { display: 'flex', flexDirection: 'column', gap: '20px' },
  card: { background: '#fff', padding: '22px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
  badge: { padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px' },
  rejectedBanner: { marginTop: '14px', padding: '10px 14px', background: '#fff5f5', color: '#c53030', border: '1px solid #feb2b2', borderRadius: '6px', fontSize: '13px' },
  gridTwoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' },
  sectionHeader: { margin: '0 0 14px', fontSize: '16px', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' },
  detailRow: { display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px', borderBottom: '1px dashed #f1f5f9' },
  detailLabel: { color: '#64748b', fontWeight: '600' },
  detailValue: { color: '#1e293b', fontWeight: '500' },
  itemCard: { padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' },
  itemBadge: { padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' },
  scopeBox: {
    marginTop: '10px',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    padding: '10px 14px'
  },
  scopeTitle: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    marginBottom: '6px'
  },
  scopeBulletList: {
    margin: 0,
    paddingLeft: '20px',
    color: '#334155',
    fontSize: '13.5px',
    lineHeight: '1.6'
  },
  scopeBulletItem: {
    marginBottom: '4px'
  },
  approvalActionRow: { marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1' },
  approveItemBtn: { padding: '6px 14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
  rejectItemBtn: { padding: '6px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
  rejectFormRow: { display: 'flex', gap: '8px', marginTop: '10px' },
  rejectInput: { flex: 1, padding: '7px 10px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '13px' },
  confirmRejectBtn: { padding: '7px 14px', background: '#991b1b', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
  cancelRejectBtn: { padding: '7px 12px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }
};
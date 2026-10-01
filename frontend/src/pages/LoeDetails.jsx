import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function LoeDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loe, setLoe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

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

  const handleDownloadPdf = async () => {
    try {
      setDownloading(true);
      setError('');

      const response = await fetch(`https://task-management-system-6ifq.onrender.com/api/loes/${id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      });

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

  // FILTER LOGIC: Restrict rendered items in the full details page to the user's department
  const relevantItems = isAdmin 
    ? (loe?.loe_items || [])
    : (loe?.loe_items || []).filter(item => item.service?.department_id === userDeptId);

  return (
    <div style={styles.pageContainer}>
      <Navbar />
      <div style={styles.container}>
        
        {/* Navigation / Header Bar */}
        <div style={styles.headerBar}>
          <button onClick={() => navigate('/loes')} style={styles.backBtn}>
            ← Back to LOE Manager
          </button>
          
          <div style={styles.actionButtons}>
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
              {downloading ? 'Generating PDF...' : 'Download PDF'}
            </button>
          </div>
        </div>

        {error && <div style={styles.errorBanner}>{error}</div>}

        {loading ? (
          <div style={styles.loadingBox}>Loading LOE details...</div>
        ) : !loe ? (
          <div style={styles.loadingBox}>LOE record not found.</div>
        ) : (
          <div style={styles.content}>
            
            {/* Top Overview Card */}
            <div style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ margin: 0, fontSize: '24px', color: '#1a202c' }}>
                  Letter of Engagement #{loe.loe_id}
                </h1>
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
                  <span style={styles.detailValue}>{loe.company?.reg_number || 'None provided'}</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>TIN</span>
                  <span style={styles.detailValue}>{loe.company?.tin_number || 'None provided'}</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Email</span>
                  <span style={styles.detailValue}>{loe.company?.email || 'None provided'}</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Phone</span>
                  <span style={styles.detailValue}>{loe.company?.phone_number || 'None provided'}</span>
                </div>
              </div>

              {/* Engagement Info */}
              <div style={styles.card}>
                <h3 style={styles.sectionHeader}>Engagement Overview</h3>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Engagement Type</span>
                  <span style={styles.detailValue}>{loe.type || 'Standard'}</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Commencement Date</span>
                  <span style={styles.detailValue}>
                    {loe.start_date ? new Date(loe.start_date).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Target End Date</span>
                  <span style={styles.detailValue}>
                    {loe.end_date ? new Date(loe.end_date).toLocaleDateString() : 'Ongoing'}
                  </span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Created By</span>
                  <span style={styles.detailValue}>
                    {loe.creator?.name ? `${loe.creator.name} (${loe.creator.email})` : `User #${loe.created_by}`}
                  </span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Approved By</span>
                  <span style={styles.detailValue}>
                    {loe.approver?.name ? `${loe.approver.name}` : loe.status === 'Approved' ? 'Management' : 'Pending final approval'}
                  </span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Services Count</span>
                  <span style={styles.detailValue}>{relevantItems.length} items</span>
                </div>
              </div>
            </div>

            {/* Services & Scopes Breakdown */}
            <div style={styles.card}>
              <h3 style={styles.sectionHeader}>Contracted Services &amp; Scope Requirements</h3>
              
              {relevantItems.length === 0 ? (
                <p style={{ color: '#718096', fontStyle: 'italic' }}>No services specified for your department.</p>
              ) : (
                <div style={styles.itemsList}>
                  {relevantItems.map((item, idx) => (
                    <div key={item.loe_item_id || idx} style={styles.itemCard}>
                      <div style={styles.itemHeader}>
                        <div>
                          <span style={styles.itemNumber}>#{idx + 1}</span>
                          <strong style={{ fontSize: '15px', color: '#2d3748' }}>
                            {item.service?.name || 'Custom Service'}
                          </strong>
                          <span style={styles.deptBadge}>
                            {item.service?.department?.name || `Dept #${item.service?.department_id}`}
                          </span>
                          {item.service?.sub_category && (
                            <span style={styles.categoryBadge}>{item.service.sub_category}</span>
                          )}
                        </div>

                        <span style={{ ...styles.itemStatusBadge, ...getItemBadgeStyle(item.status) }}>
                          {item.status === 'Approved' ? '✅' : item.status === 'Rejected' ? '❌' : '⏳'} {item.status}
                        </span>
                      </div>

                      <div style={styles.scopeBox}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#4a5568' }}>
                          Contracted Scope / Deliverables:
                        </span>
                        <p style={styles.scopeContent}>
                          {item.custom_scope || 'Standard service scope.'}
                        </p>
                      </div>

                      {item.status === 'Rejected' && item.rejection_reason && (
                        <div style={styles.reasonNotice}>
                          <strong>Manager Rejection Reason:</strong> {item.rejection_reason}
                        </div>
                      )}
                    </div>
                  ))}
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
  container: { maxWidth: '1100px', margin: '0 auto', padding: '30px 20px' },
  headerBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  backBtn: { padding: '8px 16px', background: '#e2e8f0', color: '#2d3748', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' },
  actionButtons: { display: 'flex', gap: '10px' },
  editBtn: { padding: '8px 16px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' },
  downloadBtn: { padding: '8px 16px', background: '#17a2b8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' },
  errorBanner: { padding: '12px 16px', background: '#fed7d7', color: '#c53030', borderRadius: '6px', marginBottom: '20px', border: '1px solid #feb2b2' },
  loadingBox: { padding: '40px', textAlign: 'center', color: '#718096', fontSize: '16px' },
  content: { display: 'flex', flexDirection: 'column', gap: '20px' },
  card: { background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  gridTwoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' },
  sectionHeader: { margin: '0 0 16px', fontSize: '16px', color: '#2b6cb0', borderBottom: '1px solid #edf2f7', paddingBottom: '8px' },
  detailRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f7fafc', fontSize: '13.5px' },
  detailLabel: { color: '#718096', fontWeight: '500' },
  detailValue: { color: '#1a202c', fontWeight: '600' },
  badge: { padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' },
  rejectedBanner: { marginTop: '14px', padding: '10px 14px', background: '#fff5f5', color: '#c53030', borderRadius: '4px', fontSize: '13px', border: '1px solid #feb2b2' },
  itemsList: { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' },
  itemCard: { border: '1px solid #e2e8f0', borderRadius: '6px', padding: '14px', background: '#fafbfc' },
  itemHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  itemNumber: { marginRight: '8px', background: '#e2e8f0', color: '#4a5568', padding: '2px 6px', borderRadius: '3px', fontSize: '11px', fontWeight: 'bold' },
  deptBadge: { marginLeft: '8px', background: '#edf2f7', color: '#4a5568', padding: '2px 6px', borderRadius: '3px', fontSize: '11px' },
  categoryBadge: { marginLeft: '6px', background: '#e2e8f0', color: '#718096', padding: '2px 6px', borderRadius: '3px', fontSize: '11px' },
  itemStatusBadge: { padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' },
  scopeBox: { marginTop: '10px', background: '#fff', padding: '10px 12px', borderRadius: '4px', border: '1px solid #edf2f7' },
  scopeContent: { margin: '4px 0 0', fontSize: '13px', color: '#2d3748', whiteSpace: 'pre-wrap' },
  reasonNotice: { marginTop: '8px', padding: '8px 12px', background: '#fff5f5', color: '#c53030', borderRadius: '4px', fontSize: '12px', border: '1px solid #fed7d7' }
};
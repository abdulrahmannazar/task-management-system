import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';

export default function ManagerDashboard() {
  const [approvalLoes, setApprovalLoes] = useState([]);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : null;
  
  const userDeptId = user?.department_id || 1;
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    fetchLoes();
  }, []);

  const fetchLoes = async () => {
    try {
      const url = `https://task-management-system-6ifq.onrender.com/api/loes/pending?department_id=${userDeptId}&role=${user?.role || 'MANAGER'}`;
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) setApprovalLoes(data);
    } catch (err) {
      setError('Failed to fetch LOEs.');
    }
  };

  const handleApproveItem = async (loeId, itemId) => {
    try {
      const response = await fetch(`https://task-management-system-6ifq.onrender.com/api/loes/${loeId}/items/${itemId}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ emp_id: user?.emp_id || 2 })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to approve service');
      }

      const updatedLoe = await response.json();

      // Check if this manager's department has any remaining pending items
      const hasPendingInDept = updatedLoe.loe_items.some(
        item => (isAdmin || item.service?.department_id === userDeptId) && item.status === 'Pending'
      );

      if (!hasPendingInDept) {
        setApprovalLoes(prev => prev.filter(l => l.loe_id !== loeId));
      } else {
        setApprovalLoes(prev => prev.map(l => l.loe_id === loeId ? updatedLoe : l));
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRejectItem = async (loeId, itemId) => {
    const reason = window.prompt("Enter reason for rejecting this service (optional):");
    if (reason === null) return; // User cancelled prompt

    try {
      const response = await fetch(`https://task-management-system-6ifq.onrender.com/api/loes/${loeId}/items/${itemId}/reject`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          emp_id: user?.emp_id || 2,
          reason: reason.trim() || 'Revision requested'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to reject service');
      }

      // Rejection immediately transitions LOE to 'Rejected', removing from pending queue
      setApprovalLoes(prev => prev.filter(l => l.loe_id !== loeId));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleApproveAll = async (loeId) => {
    try {
      const response = await fetch(`https://task-management-system-6ifq.onrender.com/api/loes/${loeId}/approve-all`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ emp_id: user?.emp_id || 2 })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to approve all services');
      }

      setApprovalLoes(prev => prev.filter(l => l.loe_id !== loeId));
    } catch (err) {
      setError(err.message);
    }
  };

  if (!user || (user.role !== 'MANAGER' && user.role !== 'ADMIN')) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Access Denied. Managers and Admins only.</div>;
  }

  const getItemStatusBadge = (status) => {
    if (status === 'Approved') return { bg: '#28a745', text: '#fff' };
    if (status === 'Rejected') return { bg: '#dc3545', text: '#fff' };
    return { bg: '#ffc107', text: '#000' };
  };

  return (
    <div style={styles.pageContainer}>
      <Navbar />
      <div style={styles.container}>
        <h2>{isAdmin ? 'Company-Wide Service Approvals (Admin View)' : `Department Approvals (Dept ID: ${userDeptId})`}</h2>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        
        {approvalLoes.length === 0 ? (
          <p>No services require your department's approval right now.</p>
        ) : (
          <div style={styles.grid}>
            {approvalLoes.map((loe) => (
              <div key={loe.loe_id} style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0 }}>LOE ID: {loe.loe_id}</h3>
                  <span style={styles.badge}>{loe.status}</span>
                </div>
                
                <p style={{ marginTop: '8px', marginBottom: '2px' }}>
                  <strong>Company:</strong> {loe.company?.name || `ID #${loe.company_id}`}
                </p>
                <p style={{ margin: '2px 0 10px 0' }}>
                  <strong>Engagement Type:</strong> {loe.type}
                </p>

                <div style={styles.servicesBox}>
                  <strong>Services for Review:</strong>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                    {loe.loe_items.map((item) => {
                      const isMyDept = isAdmin || item.service?.department_id === userDeptId;
                      const badge = getItemStatusBadge(item.status);

                      return (
                        <div key={item.loe_item_id} style={styles.serviceItemCard}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <strong style={{ fontSize: '14px' }}>{item.service?.name}</strong>
                              <span style={styles.deptTag}>
                                {item.service?.department?.name || `Dept #${item.service?.department_id}`}
                              </span>
                            </div>
                            <span style={{ 
                              background: badge.bg, 
                              color: badge.text, 
                              padding: '2px 8px', 
                              borderRadius: '4px', 
                              fontSize: '11px', 
                              fontWeight: 'bold' 
                            }}>
                              {item.status}
                            </span>
                          </div>

                          {item.custom_scope && (
                            <p style={styles.scopeText}>
                              <strong>Scope:</strong> {item.custom_scope}
                            </p>
                          )}

                          {item.rejection_reason && (
                            <p style={styles.rejectionReason}>
                              <strong>Reason:</strong> {item.rejection_reason}
                            </p>
                          )}

                          {/* Action buttons: Only active for pending items within manager's department */}
                          {isMyDept && item.status === 'Pending' && (
                            <div style={styles.itemActionGroup}>
                              <button 
                                onClick={() => handleApproveItem(loe.loe_id, item.loe_item_id)} 
                                style={styles.itemApproveBtn}
                              >
                                Approve Service
                              </button>
                              <button 
                                onClick={() => handleRejectItem(loe.loe_id, item.loe_item_id)} 
                                style={styles.itemRejectBtn}
                              >
                                Reject Service
                              </button>
                            </div>
                          )}

                          {!isMyDept && item.status === 'Pending' && (
                            <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#6c757d', fontStyle: 'italic' }}>
                              Awaiting {item.service?.department?.name || 'Department'} Manager review
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {isAdmin && (
                  <button 
                    onClick={() => handleApproveAll(loe.loe_id)} 
                    style={styles.adminApproveAllBtn}
                  >
                    ⚡ Approve All Services (Admin Super-Approval)
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  pageContainer: { minHeight: '100vh', background: '#f4f6f8', fontFamily: 'system-ui' },
  container: { padding: '40px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '20px', marginTop: '20px' },
  card: { background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' },
  badge: { background: '#ffc107', color: '#000', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' },
  servicesBox: { background: '#f8f9fa', padding: '12px', borderRadius: '6px', margin: '10px 0', border: '1px solid #e9ecef', flex: 1 },
  serviceItemCard: { background: '#fff', padding: '10px 12px', borderRadius: '4px', border: '1px solid #dee2e6' },
  deptTag: { marginLeft: '8px', background: '#e9ecef', color: '#495057', fontSize: '11px', padding: '2px 6px', borderRadius: '3px' },
  scopeText: { margin: '6px 0 4px', fontSize: '12.5px', color: '#495057' },
  rejectionReason: { margin: '4px 0', fontSize: '12px', color: '#dc3545', background: '#fff5f5', padding: '4px 6px', borderRadius: '3px', border: '1px solid #fed7d7' },
  itemActionGroup: { display: 'flex', gap: '8px', marginTop: '8px' },
  itemApproveBtn: { flex: 1, padding: '6px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' },
  itemRejectBtn: { flex: 1, padding: '6px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' },
  adminApproveAllBtn: { width: '100%', marginTop: '10px', padding: '10px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }
};
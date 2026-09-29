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

  const handleAction = async (loeId, action) => {
    try {
      const endpoint = action === 'approve' 
        ? `https://task-management-system-6ifq.onrender.com/api/loes/${loeId}/approve`
        : `https://task-management-system-6ifq.onrender.com/api/loes/${loeId}/reject`;

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          emp_id: user?.emp_id || 2,
          role: user?.role,
          department_id: userDeptId
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to ${action} LOE`);
      }
      
      // Remove from current queue immediately upon action
      setApprovalLoes(prev => prev.filter(loe => loe.loe_id !== loeId));
    } catch (err) {
      setError(err.message);
    }
  };

  if (!user || (user.role !== 'MANAGER' && user.role !== 'ADMIN')) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Access Denied. Managers and Admins only.</div>;
  }

  const getDeptStatusColor = (status) => {
    if (status === 'Approved') return '#28a745';
    if (status === 'Rejected') return '#dc3545';
    return '#ffc107';
  };

  return (
    <div style={styles.pageContainer}>
      <Navbar />
      <div style={styles.container}>
        <h2>{isAdmin ? 'Company-Wide Approvals (Admin View)' : `Department Approvals (Dept ID: ${userDeptId})`}</h2>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        
        {approvalLoes.length === 0 ? (
          <p>No LOEs require your department's attention right now.</p>
        ) : (
          <div style={styles.grid}>
            {approvalLoes.map((loe) => (
              <div key={loe.loe_id} style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0 }}>LOE ID: {loe.loe_id}</h3>
                  <span style={styles.badge}>{loe.status}</span>
                </div>
                
                <p><strong>Company:</strong> {loe.company?.name || `ID #${loe.company_id}`}</p>
                <p><strong>Engagement Type:</strong> {loe.type}</p>

                {/* Multi-Department Status Checklist */}
                {loe.department_approvals && loe.department_approvals.length > 0 && (
                  <div style={styles.deptProgressBox}>
                    <strong>Department Approval Status:</strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                      {loe.department_approvals.map((deptAppr) => (
                        <span 
                          key={deptAppr.approval_id} 
                          style={{
                            background: getDeptStatusColor(deptAppr.status),
                            color: deptAppr.status === 'Pending' ? '#000' : '#fff',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 'bold'
                          }}
                        >
                          {deptAppr.department?.name || `Dept #${deptAppr.department_id}`}: {deptAppr.status}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                <div style={styles.servicesBox}>
                  <strong>Services Requested:</strong>
                  <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
                    {loe.loe_items.map(item => (
                      <li key={item.loe_item_id}>
                        <strong>{item.service?.name}</strong>
                        {item.custom_scope && (
                          <div style={{ color: '#555', fontSize: '12px' }}>Scope: {item.custom_scope}</div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                <div style={styles.buttonGroup}>
                  <button onClick={() => handleAction(loe.loe_id, 'approve')} style={styles.approveBtn}>
                    {isAdmin ? 'Approve All (Admin)' : 'Approve My Department'}
                  </button>
                  <button onClick={() => handleAction(loe.loe_id, 'reject')} style={styles.rejectBtn}>
                    Reject
                  </button>
                </div>
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
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px', marginTop: '20px' },
  card: { background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
  badge: { background: '#ffc107', color: '#000', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' },
  deptProgressBox: { margin: '12px 0', padding: '8px', background: '#f1f5f9', borderRadius: '4px', fontSize: '13px' },
  servicesBox: { background: '#f8f9fa', padding: '10px', borderRadius: '4px', margin: '15px 0', fontSize: '14px' },
  buttonGroup: { display: 'flex', gap: '10px' },
  approveBtn: { flex: '1.2', padding: '10px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  rejectBtn: { flex: '0.8', padding: '10px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }
};
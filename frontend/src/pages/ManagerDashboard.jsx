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
      const url = `http://localhost:3000/api/loes/pending?department_id=${userDeptId}&role=${user?.role || 'MANAGER'}`;
      
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
        ? `http://localhost:3000/api/loes/${loeId}/approve`
        : `http://localhost:3000/api/loes/${loeId}/reject`;

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          emp_id: user?.emp_id || 2
        })
      });

      if (!response.ok) throw new Error(`Failed to ${action} LOE`);
      
      // Update the status on the screen without removing the card
      const newStatus = action === 'approve' ? 'Approved' : 'Rejected';
      setApprovalLoes(prev => prev.map(loe => 
        loe.loe_id === loeId ? { ...loe, status: newStatus } : loe
      ));
    } catch (err) {
      setError(err.message);
    }
  };

  if (!user || (user.role !== 'MANAGER' && user.role !== 'ADMIN')) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Access Denied. Managers and Admins only.</div>;
  }

  // Dynamic status color function
  const getStatusColor = (status) => {
    if (status === 'Approved') return '#28a745';
    if (status === 'Rejected') return '#dc3545';
    return '#ffc107'; // Yellow for pending
  };

  return (
    <div style={styles.pageContainer}>
      <Navbar />
      <div style={styles.container}>
        <h2>{isAdmin ? 'Company-Wide Approvals (Admin View)' : `Department Approvals (Dept ID: ${userDeptId})`}</h2>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        
        {approvalLoes.length === 0 ? <p>No LOEs require your attention.</p> : (
          <div style={styles.grid}>
            {approvalLoes.map((loe) => (
              <div key={loe.loe_id} style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0 }}>LOE ID: {loe.loe_id}</h3>
                  <span style={{ 
                    background: getStatusColor(loe.status), 
                    color: loe.status === 'Approval Pending' ? '#000' : '#fff', 
                    padding: '4px 8px', 
                    borderRadius: '4px', 
                    fontSize: '12px',
                    fontWeight: 'bold' 
                  }}>
                    {loe.status}
                  </span>
                </div>
                
                <p><strong>Company ID:</strong> {loe.company_id}</p>
                
                <div style={styles.servicesBox}>
                  <strong>Services Requested:</strong>
                  <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
                    {loe.loe_items.map(item => (
                      <li key={item.loe_item_id}>
                        {item.service?.name} - ${item.amount}
                        <br/>
                        <small style={{ color: '#666' }}>Scope: {item.custom_scope}</small>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Only show buttons if it is still pending */}
                {loe.status === 'Approval Pending' ? (
                  <div style={styles.buttonGroup}>
                    <button onClick={() => handleAction(loe.loe_id, 'approve')} style={styles.approveBtn}>Approve</button>
                    <button onClick={() => handleAction(loe.loe_id, 'reject')} style={styles.rejectBtn}>Reject</button>
                  </div>
                ) : (
                  <div style={styles.completedMessage}>
                    This LOE has been {loe.status.toLowerCase()}.
                  </div>
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
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px', marginTop: '20px' },
  card: { background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
  servicesBox: { background: '#f8f9fa', padding: '10px', borderRadius: '4px', margin: '15px 0', fontSize: '14px' },
  buttonGroup: { display: 'flex', gap: '10px' },
  approveBtn: { flex: '1', padding: '10px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  rejectBtn: { flex: '1', padding: '10px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  completedMessage: { textAlign: 'center', padding: '10px', background: '#e9ecef', borderRadius: '4px', color: '#495057', fontStyle: 'italic', fontSize: '14px' }
};
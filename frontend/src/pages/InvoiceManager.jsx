import React, { useState, useEffect, useMemo } from 'react';
import Navbar from '../components/Navbar';

export default function InvoiceManager() {
  const [invoices, setInvoices] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [remindingId, setRemindingId] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};
  
  const isAdmin = user.role === 'ADMIN';
  const userDeptId = user.department_id || 1;

  const [selectedCompany, setSelectedCompany] = useState('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState(isAdmin ? 'ALL' : String(userDeptId));
  const [selectedScope, setSelectedScope] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  useEffect(() => {
    fetchInvoices();
    fetchDepartments();
    fetchCompanies();
  }, []);

  const fetchInvoices = async () => {
    try {
      const url = isAdmin
        ? 'https://task-management-system-6ifq.onrender.com/api/invoices?role=ADMIN'
        : `https://task-management-system-6ifq.onrender.com/api/invoices?department_id=${userDeptId}&role=MANAGER`;

      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (response.ok) setInvoices(Array.isArray(data) ? data : []);
    } catch (err) { setError('Failed to load invoices'); }
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch('https://task-management-system-6ifq.onrender.com/api/auth/departments');
      const data = await response.json();
      if (response.ok) setDepartments(Array.isArray(data) ? data : []);
    } catch (err) {}
  };

  const fetchCompanies = async () => {
    try {
      const response = await fetch('https://task-management-system-6ifq.onrender.com/api/companies', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) setCompanies(Array.isArray(data) ? data : []);
    } catch (err) {}
  };

  const handleStatusChange = async (invoiceId, newStatus) => {
    setUpdatingId(invoiceId);
    setError(''); setSuccessMsg('');
    try {
      const response = await fetch(`https://task-management-system-6ifq.onrender.com/api/invoices/${invoiceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });
      const updated = await response.json();
      if (!response.ok) throw new Error(updated.error || 'Failed to update status');

      setInvoices(prev => prev.map(inv => inv.invoice_id === invoiceId ? updated : inv));
      if (selectedInvoice && selectedInvoice.invoice_id === invoiceId) setSelectedInvoice(updated);
    } catch (err) { setError(err.message); } finally { setUpdatingId(null); }
  };

  const handleRemindClient = async (invoiceId) => {
    setRemindingId(invoiceId);
    setError(''); setSuccessMsg('');
    try {
      const response = await fetch(`https://task-management-system-6ifq.onrender.com/api/invoices/${invoiceId}/remind`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send reminder');
      
      setSuccessMsg(`Reminder successfully dispatched for INV-${String(invoiceId).padStart(5, '0')}`);
      setInvoices(prev => prev.map(inv => inv.invoice_id === invoiceId ? data.invoice : inv));
      if (selectedInvoice && selectedInvoice.invoice_id === invoiceId) setSelectedInvoice(data.invoice);
    } catch (err) { setError(err.message); } finally { setRemindingId(null); }
  };

  const handleDownloadPdf = async (e, invoiceId) => {
    if (e) e.stopPropagation();
    try {
      setDownloadingId(invoiceId);
      const response = await fetch(`https://task-management-system-6ifq.onrender.com/api/invoices/${invoiceId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to generate PDF');
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `Invoice-${String(invoiceId).padStart(5, '0')}.pdf`);
      document.body.appendChild(link);
      link.click(); link.parentNode.removeChild(link);
    } catch (err) { setError(err.message); } finally { setDownloadingId(null); }
  };

  const handleResetFilters = () => {
    setSelectedCompany('ALL');
    setSelectedDepartment(isAdmin ? 'ALL' : String(userDeptId));
    setSelectedScope('ALL');
    setSelectedStatus('ALL');
  };

  const availableScopes = useMemo(() => {
    const scopesSet = new Set();
    invoices.forEach(inv => {
      (inv.job?.loe?.loe_items || []).forEach(item => {
        if (item.custom_scope) scopesSet.add(item.custom_scope.trim());
      });
    });
    return Array.from(scopesSet).sort();
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const companyId = inv.job?.loe?.company?.company_id || inv.job?.loe?.company_id;
      const loeItems = inv.job?.loe?.loe_items || [];
      if (selectedCompany !== 'ALL' && companyId !== Number(selectedCompany)) return false;
      if (selectedDepartment !== 'ALL' && !loeItems.some(item => item.service?.department_id === Number(selectedDepartment))) return false;
      if (selectedStatus !== 'ALL' && inv.status !== selectedStatus) return false;
      if (selectedScope !== 'ALL' && !loeItems.some(item => (item.custom_scope || '').trim().toLowerCase() === selectedScope.toLowerCase())) return false;
      return true;
    });
  }, [invoices, selectedCompany, selectedDepartment, selectedStatus, selectedScope]);

  const hasActiveFilters = selectedCompany !== 'ALL' || (isAdmin && selectedDepartment !== 'ALL') || selectedStatus !== 'ALL' || selectedScope !== 'ALL';
  const getStatusBadgeStyle = (status) => status === 'Paid' ? { background: '#28a745', color: '#fff' } : { background: '#dc3545', color: '#fff' };
  const totalInvoiced = filteredInvoices.reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0);
  const unpaidCount = filteredInvoices.filter(i => i.status !== 'Paid').length;

  return (
    <div style={styles.pageContainer}>
      <Navbar />
      <div style={styles.container}>
        <div style={styles.headerRow}>
          <div>
            <h2 style={{ margin: 0 }}>Invoice Management</h2>
            <p style={{ margin: '4px 0 0 0', color: '#6c757d', fontSize: '14px' }}>Track invoices, filter operations, and dispatch payment reminders.</p>
          </div>
          <div style={styles.metricsGroup}>
            <div style={styles.metricCard}><span style={styles.metricLabel}>Filtered Total</span><strong style={styles.metricValue}>${totalInvoiced.toLocaleString()}</strong></div>
            <div style={styles.metricCard}><span style={styles.metricLabel}>Pending Payment</span><strong style={{ ...styles.metricValue, color: '#dc3545' }}>{unpaidCount} Not Paid</strong></div>
          </div>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}
        {successMsg && <div style={styles.successBox}>{successMsg}</div>}

        <div style={styles.filterCard}>
          <div style={styles.filterHeader}>
            <span style={{ fontWeight: 'bold', fontSize: '13.5px', color: '#1a365d' }}>🔍 Filter Invoices</span>
            {hasActiveFilters && <button onClick={handleResetFilters} style={styles.clearFiltersBtn}>Reset Filters</button>}
          </div>
          <div style={styles.filterRow}>
            <div style={styles.filterCol}>
              <label style={styles.filterLabel}>Company</label>
              <select value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)} style={styles.filterSelect}>
                <option value="ALL">All Companies</option>
                {companies.map(comp => <option key={comp.company_id} value={comp.company_id}>{comp.name}</option>)}
              </select>
            </div>
            <div style={styles.filterCol}>
              <label style={styles.filterLabel}>Status</label>
              <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} style={styles.filterSelect}>
                <option value="ALL">All Statuses</option>
                <option value="Not Paid">Not Paid</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
            <div style={{ ...styles.filterCol, flex: 1.4 }}>
              <label style={styles.filterLabel}>Scope</label>
              <select value={selectedScope} onChange={(e) => setSelectedScope(e.target.value)} style={styles.filterSelect}>
                <option value="ALL">All Scopes</option>
                {availableScopes.map((scope, idx) => <option key={idx} value={scope}>{scope.substring(0, 50)}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={styles.tableCard}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thRow}>
                <th style={styles.th}>Invoice Ref</th>
                <th style={styles.th}>Billed Company</th>
                <th style={styles.th}>Issue / Due Date</th>
                <th style={styles.th}>Total Amount</th>
                <th style={styles.th}>Payment Status</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((inv) => (
                <tr key={inv.invoice_id} onClick={() => setSelectedInvoice(inv)} style={styles.tr}>
                  <td style={styles.td}><strong>INV-{String(inv.invoice_id).padStart(5, '0')}</strong></td>
                  <td style={styles.td}><strong>{inv.job?.loe?.company?.name || 'N/A'}</strong></td>
                  <td style={styles.td}>{new Date(inv.issued_date).toLocaleDateString()} - <strong style={{color: inv.status==='Paid'?'#495057':'#dc3545'}}>{new Date(inv.due_date).toLocaleDateString()}</strong></td>
                  <td style={styles.td}><strong>${Number(inv.total_amount).toLocaleString()}</strong></td>
                  <td style={styles.td} onClick={e => e.stopPropagation()}>
                    <select value={inv.status} disabled={updatingId === inv.invoice_id} onChange={(e) => handleStatusChange(inv.invoice_id, e.target.value)} style={{ ...styles.statusSelect, ...getStatusBadgeStyle(inv.status) }}>
                      <option value="Not Paid" style={{ background: '#fff', color: '#000' }}>Not Paid</option>
                      <option value="Paid" style={{ background: '#fff', color: '#000' }}>Paid</option>
                    </select>
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                    <button onClick={(e) => handleDownloadPdf(e, inv.invoice_id)} disabled={downloadingId === inv.invoice_id} style={styles.downloadPdfBtn}>
                      {downloadingId === inv.invoice_id ? 'Generating...' : 'Download PDF'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedInvoice && (
          <div style={styles.modalOverlay} onClick={() => setSelectedInvoice(null)}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <h3 style={{ margin: 0 }}>Invoice INV-{String(selectedInvoice.invoice_id).padStart(5, '0')}</h3>
                <button style={styles.closeBtn} onClick={() => setSelectedInvoice(null)}>✕</button>
              </div>

              <div style={styles.modalBody}>
                <div style={styles.infoGrid}>
                  <div style={styles.infoBox}>
                    <p><strong>Company:</strong> {selectedInvoice.job?.loe?.company?.name}</p>
                    <p><strong>Status:</strong> <span style={{ color: selectedInvoice.status === 'Paid' ? '#28a745' : '#dc3545', fontWeight: 'bold' }}>{selectedInvoice.status}</span></p>
                    <p><strong>Total Due:</strong> <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#1a365d' }}>${Number(selectedInvoice.total_amount).toLocaleString()}</span></p>
                  </div>
                </div>

                <div style={styles.modalActions}>
                  <select value={selectedInvoice.status} onChange={(e) => handleStatusChange(selectedInvoice.invoice_id, e.target.value)} style={{ ...styles.statusSelect, ...getStatusBadgeStyle(selectedInvoice.status) }}>
                    <option value="Not Paid" style={{ background: '#fff', color: '#000' }}>Not Paid</option>
                    <option value="Paid" style={{ background: '#fff', color: '#000' }}>Paid</option>
                  </select>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    {selectedInvoice.status !== 'Paid' && (
                      <button type="button" onClick={() => handleRemindClient(selectedInvoice.invoice_id)} disabled={remindingId === selectedInvoice.invoice_id} style={{ ...styles.saveBtn, background: '#17a2b8' }}>
                        {remindingId === selectedInvoice.invoice_id ? 'Sending...' : '📧 Send Reminder Email'}
                      </button>
                    )}
                    <button type="button" onClick={() => handleDownloadPdf(null, selectedInvoice.invoice_id)} style={styles.saveBtn}>Download PDF</button>
                  </div>
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
  pageContainer: { minHeight: '100vh', background: '#f4f6f8', fontFamily: 'system-ui' },
  container: { padding: '40px' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' },
  metricsGroup: { display: 'flex', gap: '15px' },
  metricCard: { background: '#fff', padding: '12px 18px', borderRadius: '6px', border: '1px solid #e2e8f0', minWidth: '130px' },
  metricLabel: { display: 'block', fontSize: '11.5px', color: '#718096', textTransform: 'uppercase', fontWeight: 'bold' },
  metricValue: { fontSize: '16px', color: '#1a202c', marginTop: '2px', display: 'block' },
  filterCard: { background: '#fff', padding: '16px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' },
  filterHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  clearFiltersBtn: { padding: '4px 10px', background: '#edf2f7', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
  filterRow: { display: 'flex', gap: '14px', flexWrap: 'wrap' },
  filterCol: { flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' },
  filterLabel: { fontSize: '12px', fontWeight: 'bold', color: '#4a5568' },
  filterSelect: { padding: '8px 10px', borderRadius: '4px', border: '1px solid #ced4da', fontSize: '13px' },
  tableCard: { background: '#fff', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' },
  thRow: { background: '#f8f9fa', borderBottom: '2px solid #dee2e6' },
  th: { padding: '14px 16px', color: '#495057', fontWeight: 'bold' },
  tr: { borderBottom: '1px solid #dee2e6', cursor: 'pointer' },
  td: { padding: '14px 16px', verticalAlign: 'middle' },
  statusSelect: { padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', border: 'none' },
  downloadPdfBtn: { padding: '6px 12px', background: '#6f42c1', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' },
  emptyCell: { textAlign: 'center', padding: '35px', color: '#6c757d' },
  errorBox: { background: '#fed7d7', color: '#c53030', padding: '10px 14px', borderRadius: '4px', marginBottom: '15px', border: '1px solid #feb2b2', fontSize: '13px' },
  successBox: { background: '#e6fffa', color: '#234e52', padding: '10px 14px', borderRadius: '4px', marginBottom: '15px', border: '1px solid #b2f5ea', fontSize: '13px', fontWeight: 'bold' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { background: '#fff', borderRadius: '8px', width: '90%', maxWidth: '600px', padding: '24px' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #dee2e6', paddingBottom: '12px' },
  closeBtn: { background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer' },
  modalBody: { marginTop: '16px' },
  infoGrid: { display: 'grid', gridTemplateColumns: '1fr', gap: '15px', marginBottom: '15px' },
  infoBox: { background: '#f8fafc', padding: '12px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px' },
  modalActions: { display: 'flex', justifyContent: 'space-between', marginTop: '20px', borderTop: '1px solid #dee2e6', paddingTop: '15px' },
  cancelBtn: { padding: '8px 16px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  saveBtn: { padding: '8px 18px', background: '#6f42c1', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }
};
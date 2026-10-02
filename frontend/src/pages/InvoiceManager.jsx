import React, { useState, useEffect, useMemo } from 'react';
import Navbar from '../components/Navbar';

export default function InvoiceManager() {
  const [invoices, setInvoices] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};
  
  const isAdmin = user.role === 'ADMIN';
  const userDeptId = user.department_id || 1;

  // Filter States
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

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) setInvoices(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError('Failed to load invoices');
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch('https://task-management-system-6ifq.onrender.com/api/auth/departments');
      const data = await response.json();
      if (response.ok && Array.isArray(data)) setDepartments(data);
    } catch (err) {
      console.error('Failed to load departments', err);
    }
  };

  const fetchCompanies = async () => {
    try {
      const response = await fetch('https://task-management-system-6ifq.onrender.com/api/companies', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setCompanies(Array.isArray(data) ? data : data.companies || []);
      }
    } catch (err) {
      console.error('Failed to load companies', err);
    }
  };

  const handleStatusChange = async (invoiceId, newStatus) => {
    setUpdatingId(invoiceId);
    setError('');

    try {
      const response = await fetch(`https://task-management-system-6ifq.onrender.com/api/invoices/${invoiceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      const updated = await response.json();
      if (!response.ok) throw new Error(updated.error || 'Failed to update invoice payment status');

      setInvoices(prev => prev.map(inv => inv.invoice_id === invoiceId ? updated : inv));
      if (selectedInvoice && selectedInvoice.invoice_id === invoiceId) {
        setSelectedInvoice(updated);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDownloadPdf = async (e, invoiceId) => {
    if (e) e.stopPropagation();
    try {
      setDownloadingId(invoiceId);
      setError('');

      const response = await fetch(`https://task-management-system-6ifq.onrender.com/api/invoices/${invoiceId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to generate invoice PDF');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `Invoice-${String(invoiceId).padStart(5, '0')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setError(err.message || 'Error downloading invoice PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleResetFilters = () => {
    setSelectedCompany('ALL');
    setSelectedDepartment(isAdmin ? 'ALL' : String(userDeptId));
    setSelectedScope('ALL');
    setSelectedStatus('ALL');
  };

  // ----------------------------------------------------------------------
  // DYNAMICALLY EXTRACT ALL AVAILABLE UNIQUE SCOPES ACROSS INVOICES
  // ----------------------------------------------------------------------
  const availableScopes = useMemo(() => {
    const scopesSet = new Set();
    invoices.forEach(inv => {
      const loeItems = inv.job?.loe?.loe_items || [];
      loeItems.forEach(item => {
        if (item.custom_scope && item.custom_scope.trim()) {
          scopesSet.add(item.custom_scope.trim());
        }
      });
    });
    return Array.from(scopesSet).sort();
  }, [invoices]);

  // ----------------------------------------------------------------------
  // FILTERING LOGIC
  // ----------------------------------------------------------------------
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const companyId = inv.job?.loe?.company?.company_id || inv.job?.loe?.company_id;
      const loeItems = inv.job?.loe?.loe_items || [];

      // 1. Company Filter
      if (selectedCompany !== 'ALL' && companyId !== Number(selectedCompany)) {
        return false;
      }

      // 2. Department Filter
      if (selectedDepartment !== 'ALL') {
        const matchesDept = loeItems.some(
          (item) => item.service?.department_id === Number(selectedDepartment)
        );
        if (!matchesDept) return false;
      }

      // 3. Payment Status Filter
      if (selectedStatus !== 'ALL' && inv.status !== selectedStatus) {
        return false;
      }

      // 4. Scope Dropdown Filter
      if (selectedScope !== 'ALL') {
        const matchesScope = loeItems.some(
          (item) => (item.custom_scope || '').trim().toLowerCase() === selectedScope.toLowerCase()
        );
        if (!matchesScope) return false;
      }

      return true;
    });
  }, [invoices, selectedCompany, selectedDepartment, selectedStatus, selectedScope]);

  const hasActiveFilters =
    selectedCompany !== 'ALL' ||
    (isAdmin && selectedDepartment !== 'ALL') ||
    selectedStatus !== 'ALL' ||
    selectedScope !== 'ALL';

  const getStatusBadgeStyle = (status) => {
    if (status === 'Paid') return { background: '#28a745', color: '#fff' };
    return { background: '#dc3545', color: '#fff' };
  };

  const getDepartmentName = (deptId) => {
    const found = departments.find(d => d.department_id === Number(deptId));
    return found ? found.name : `Dept #${deptId}`;
  };

  const getGroupedItems = (loeItems) => {
    const map = new Map();
    (loeItems || []).forEach(item => {
      const sId = item.service_id;
      if (!map.has(sId)) {
        map.set(sId, {
          name: item.service?.name,
          department: item.service?.department?.name,
          billingType: item.service?.billing_type,
          amount: Number(item.amount || 0),
          scopes: []
        });
      }
      if (item.custom_scope) map.get(sId).scopes.push(item.custom_scope);
    });
    return Array.from(map.values());
  };

  const totalInvoiced = filteredInvoices.reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0);
  const paidCount = filteredInvoices.filter(i => i.status === 'Paid').length;
  const unpaidCount = filteredInvoices.filter(i => i.status !== 'Paid').length;

  return (
    <div style={styles.pageContainer}>
      <Navbar />
      <div style={styles.container}>
        
        {/* Header & Metrics */}
        <div style={styles.headerRow}>
          <div>
            <h2 style={{ margin: 0 }}>Invoice Management &amp; Accounts Receivable</h2>
            <p style={{ margin: '4px 0 0 0', color: '#6c757d', fontSize: '14px' }}>
              Track invoices, filter by company or scope, and record payment receipts.
            </p>
          </div>

          <div style={styles.metricsGroup}>
            <div style={styles.metricCard}>
              <span style={styles.metricLabel}>Filtered Total</span>
              <strong style={styles.metricValue}>
                ${totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </div>
            <div style={styles.metricCard}>
              <span style={styles.metricLabel}>Pending Payment</span>
              <strong style={{ ...styles.metricValue, color: '#dc3545' }}>{unpaidCount} Not Paid</strong>
            </div>
            <div style={styles.metricCard}>
              <span style={styles.metricLabel}>Settled</span>
              <strong style={{ ...styles.metricValue, color: '#28a745' }}>{paidCount} Paid</strong>
            </div>
          </div>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        {/* Filter Controls Card */}
        <div style={styles.filterCard}>
          <div style={styles.filterHeader}>
            <span style={{ fontWeight: 'bold', fontSize: '13.5px', color: '#1a365d' }}>
              🔍 Filter Invoices
            </span>
            {hasActiveFilters && (
              <button onClick={handleResetFilters} style={styles.clearFiltersBtn}>
                Reset Filters
              </button>
            )}
          </div>

          <div style={styles.filterRow}>
            {/* 1. Filter by Company */}
            <div style={styles.filterCol}>
              <label style={styles.filterLabel}>Company / Client</label>
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                style={styles.filterSelect}
              >
                <option value="ALL">All Companies</option>
                {companies.map((comp) => (
                  <option key={comp.company_id} value={comp.company_id}>
                    {comp.name || comp.company_name || `Company #${comp.company_id}`}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Filter by Department */}
            <div style={styles.filterCol}>
              <label style={styles.filterLabel}>Department</label>
              {isAdmin ? (
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  style={styles.filterSelect}
                >
                  <option value="ALL">All Departments</option>
                  {departments.map((dept) => (
                    <option key={dept.department_id} value={dept.department_id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  disabled
                  value={getDepartmentName(userDeptId)}
                  style={{ ...styles.filterSelect, background: '#f8f9fa', color: '#495057' }}
                />
              )}
            </div>

            {/* 3. Filter by Scope Dropdown */}
            <div style={{ ...styles.filterCol, flex: 1.4 }}>
              <label style={styles.filterLabel}>Contracted Scope</label>
              <select
                value={selectedScope}
                onChange={(e) => setSelectedScope(e.target.value)}
                style={styles.filterSelect}
              >
                <option value="ALL">All Scopes ({availableScopes.length})</option>
                {availableScopes.map((scope, idx) => (
                  <option key={idx} value={scope}>
                    {scope.length > 55 ? `${scope.substring(0, 52)}...` : scope}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Filter by Payment Status */}
            <div style={styles.filterCol}>
              <label style={styles.filterLabel}>Payment Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                style={styles.filterSelect}
              >
                <option value="ALL">All Statuses</option>
                <option value="Not Paid">Not Paid</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results Counter */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', color: '#6c757d' }}>
            Showing <strong>{filteredInvoices.length}</strong> of <strong>{invoices.length}</strong> total invoices
          </span>
        </div>

        {/* Invoices List Table */}
        <div style={styles.tableCard}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thRow}>
                <th style={styles.th}>Invoice Ref</th>
                <th style={styles.th}>LOE Ref</th>
                <th style={styles.th}>Billed Company</th>
                <th style={styles.th}>Issue Date</th>
                <th style={styles.th}>Due Date</th>
                <th style={styles.th}>Total Amount</th>
                <th style={styles.th}>Payment Status</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan="8" style={styles.emptyCell}>
                    No invoices match the selected filter criteria.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const company = inv.job?.loe?.company;
                  const isPaid = inv.status === 'Paid';

                  return (
                    <tr 
                      key={inv.invoice_id} 
                      onClick={() => setSelectedInvoice(inv)}
                      style={styles.tr}
                    >
                      <td style={styles.td}>
                        <strong>INV-{String(inv.invoice_id).padStart(5, '0')}</strong>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.loeBadge}>LOE #{inv.job?.loe?.loe_id}</span>
                      </td>
                      <td style={styles.td}>
                        <strong>{company?.name || 'N/A'}</strong>
                        <div style={{ fontSize: '11.5px', color: '#6c757d' }}>{company?.client_type || 'Corporate'}</div>
                      </td>
                      <td style={styles.td}>
                        {inv.issued_date ? new Date(inv.issued_date).toLocaleDateString() : 'N/A'}
                      </td>
                      <td style={styles.td}>
                        <strong style={{ color: !isPaid ? '#c53030' : '#495057' }}>
                          {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'N/A'}
                        </strong>
                      </td>
                      <td style={styles.td}>
                        <strong style={{ fontSize: '14px', color: '#1a365d' }}>
                          ${Number(inv.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </strong>
                      </td>
                      <td style={styles.td} onClick={(e) => e.stopPropagation()}>
                        <select
                          value={inv.status}
                          disabled={updatingId === inv.invoice_id}
                          onChange={(e) => handleStatusChange(inv.invoice_id, e.target.value)}
                          style={{
                            ...styles.statusSelect,
                            ...getStatusBadgeStyle(inv.status)
                          }}
                        >
                          <option value="Not Paid" style={{ background: '#fff', color: '#000' }}>Not Paid</option>
                          <option value="Paid" style={{ background: '#fff', color: '#000' }}>Paid</option>
                        </select>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => handleDownloadPdf(e, inv.invoice_id)}
                          disabled={downloadingId === inv.invoice_id}
                          style={styles.downloadPdfBtn}
                        >
                          {downloadingId === inv.invoice_id ? 'Generating...' : 'Download PDF'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Invoice Detail Modal */}
        {selectedInvoice && (
          <div style={styles.modalOverlay} onClick={() => setSelectedInvoice(null)}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <div>
                  <h3 style={{ margin: 0 }}>Invoice INV-{String(selectedInvoice.invoice_id).padStart(5, '0')}</h3>
                  <span style={{ fontSize: '13px', color: '#6c757d' }}>Linked Contract: LOE #{selectedInvoice.job?.loe?.loe_id}</span>
                </div>
                <button style={styles.closeBtn} onClick={() => setSelectedInvoice(null)}>✕</button>
              </div>

              <div style={styles.modalBody}>
                {/* Client & Payment Info */}
                <div style={styles.infoGrid}>
                  <div style={styles.infoBox}>
                    <h4 style={styles.boxTitle}>Client Information</h4>
                    <p><strong>Company:</strong> {selectedInvoice.job?.loe?.company?.name || 'N/A'}</p>
                    <p><strong>Registration:</strong> {selectedInvoice.job?.loe?.company?.reg_number || 'N/A'}</p>
                    <p><strong>Email:</strong> {selectedInvoice.job?.loe?.company?.email || 'N/A'}</p>
                    <p><strong>Phone:</strong> {selectedInvoice.job?.loe?.company?.phone_number || 'N/A'}</p>
                  </div>

                  <div style={styles.infoBox}>
                    <h4 style={styles.boxTitle}>Billing &amp; Payment Status</h4>
                    <p><strong>Issue Date:</strong> {new Date(selectedInvoice.issued_date).toLocaleDateString()}</p>
                    <p><strong>Payment Due:</strong> {new Date(selectedInvoice.due_date).toLocaleDateString()}</p>
                    <p>
                      <strong>Status: </strong>
                      <span style={{ fontWeight: 'bold', color: selectedInvoice.status === 'Paid' ? '#28a745' : '#dc3545' }}>
                        {selectedInvoice.status}
                      </span>
                    </p>
                    <p>
                      <strong>Total Due: </strong>
                      <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#1a365d' }}>
                        ${Number(selectedInvoice.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Line Items Breakdown */}
                <h4 style={{ margin: '15px 0 8px 0', color: '#333' }}>Contracted Services Billed</h4>
                <div style={styles.lineItemsContainer}>
                  {getGroupedItems(selectedInvoice.job?.loe?.loe_items).map((srv, idx) => (
                    <div key={idx} style={styles.lineItemCard}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong>{srv.name}</strong> 
                          <span style={styles.deptBadge}>{srv.department}</span>
                          <span style={styles.billingBadge}>{srv.billingType}</span>
                        </div>
                        <strong style={{ fontSize: '14px', color: '#2d3748' }}>
                          ${Number(srv.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </strong>
                      </div>
                      {srv.scopes.length > 0 && (
                        <ul style={styles.scopeList}>
                          {srv.scopes.map((sc, i) => <li key={i}>{sc}</li>)}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>

                {/* Payment Status Switch & Download Actions */}
                <div style={styles.modalActions}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Payment Status:</label>
                    <select
                      value={selectedInvoice.status}
                      disabled={updatingId === selectedInvoice.invoice_id}
                      onChange={(e) => handleStatusChange(selectedInvoice.invoice_id, e.target.value)}
                      style={{
                        ...styles.statusSelect,
                        ...getStatusBadgeStyle(selectedInvoice.status)
                      }}
                    >
                      <option value="Not Paid" style={{ background: '#fff', color: '#000' }}>Not Paid</option>
                      <option value="Paid" style={{ background: '#fff', color: '#000' }}>Paid</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="button" onClick={() => setSelectedInvoice(null)} style={styles.cancelBtn}>
                      Close
                    </button>
                    <button 
                      type="button" 
                      onClick={(e) => handleDownloadPdf(e, selectedInvoice.invoice_id)} 
                      disabled={downloadingId === selectedInvoice.invoice_id}
                      style={styles.saveBtn}
                    >
                      {downloadingId === selectedInvoice.invoice_id ? 'Generating...' : 'Download Invoice PDF'}
                    </button>
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
  metricCard: { background: '#fff', padding: '12px 18px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', minWidth: '130px' },
  metricLabel: { display: 'block', fontSize: '11.5px', color: '#718096', textTransform: 'uppercase', fontWeight: 'bold' },
  metricValue: { fontSize: '16px', color: '#1a202c', marginTop: '2px', display: 'block' },
  
  // Filter Card
  filterCard: { background: '#fff', padding: '16px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: '20px' },
  filterHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  clearFiltersBtn: { padding: '4px 10px', background: '#edf2f7', color: '#4a5568', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
  filterRow: { display: 'flex', gap: '14px', flexWrap: 'wrap' },
  filterCol: { flex: 1, minWidth: '170px', display: 'flex', flexDirection: 'column', gap: '4px' },
  filterLabel: { fontSize: '12px', fontWeight: 'bold', color: '#4a5568' },
  filterSelect: { padding: '8px 10px', borderRadius: '4px', border: '1px solid #ced4da', fontSize: '13px', background: '#fff' },

  tableCard: { background: '#fff', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' },
  thRow: { background: '#f8f9fa', borderBottom: '2px solid #dee2e6' },
  th: { padding: '14px 16px', color: '#495057', fontWeight: 'bold' },
  tr: { borderBottom: '1px solid #dee2e6', cursor: 'pointer', transition: 'background-color 0.15s ease' },
  td: { padding: '14px 16px', verticalAlign: 'middle' },
  loeBadge: { background: '#e2e8f0', color: '#2d3748', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' },
  statusSelect: { padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer' },
  downloadPdfBtn: { padding: '6px 12px', background: '#6f42c1', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' },
  emptyCell: { textAlign: 'center', padding: '35px', color: '#6c757d' },
  errorBox: { background: '#fed7d7', color: '#c53030', padding: '10px 14px', borderRadius: '4px', marginBottom: '15px', border: '1px solid #feb2b2', fontSize: '13px' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { background: '#fff', borderRadius: '8px', width: '90%', maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #dee2e6', paddingBottom: '12px' },
  closeBtn: { background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#6c757d' },
  modalBody: { marginTop: '16px' },
  infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' },
  infoBox: { background: '#f8fafc', padding: '12px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px' },
  boxTitle: { margin: '0 0 8px 0', fontSize: '13px', color: '#2b6cb0', textTransform: 'uppercase' },
  lineItemsContainer: { display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' },
  lineItemCard: { border: '1px solid #e2e8f0', padding: '10px 12px', borderRadius: '4px', background: '#fafbfc', fontSize: '13px' },
  deptBadge: { marginLeft: '8px', background: '#edf2f7', color: '#4a5568', padding: '2px 6px', borderRadius: '3px', fontSize: '11px' },
  billingBadge: { marginLeft: '6px', background: '#e2e8f0', color: '#718096', padding: '2px 6px', borderRadius: '3px', fontSize: '11px' },
  scopeList: { margin: '6px 0 0 0', paddingLeft: '18px', color: '#718096', fontSize: '12px' },
  modalActions: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', borderTop: '1px solid #dee2e6', paddingTop: '15px' },
  cancelBtn: { padding: '8px 16px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  saveBtn: { padding: '8px 18px', background: '#6f42c1', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }
};
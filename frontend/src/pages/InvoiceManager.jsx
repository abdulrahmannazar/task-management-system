import React, { useState, useEffect } from 'react';
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

export default function InvoiceManager() {
  const [invoices, setInvoices] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [remindingId, setRemindingId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  // Filter States
  const [filterInvoiceNo, setFilterInvoiceNo] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterCurrency, setFilterCurrency] = useState('ALL');

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};

  const isAdmin = user.role === 'ADMIN';
  const canManage = user.role === 'ADMIN' || user.role === 'MANAGER';
  const userDeptId = user.department_id || 1;

  useEffect(() => {
    fetchInvoices();
    fetchCompanies();
    fetchDepartments();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError('');

      const url = isAdmin
        ? 'https://task-management-system-6ifq.onrender.com/api/invoices?role=ADMIN'
        : `https://task-management-system-6ifq.onrender.com/api/invoices?department_id=${userDeptId}&role=${user.role || 'EMPLOYEE'}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load invoices');

      setInvoices(Array.isArray(data) ? data : data.invoices || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      if (!token) return;
      const response = await fetch('https://task-management-system-6ifq.onrender.com/api/companies', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setCompanies(Array.isArray(data) ? data : data.companies || []);
      }
    } catch (err) {
      console.error('Failed to load companies:', err);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch('https://task-management-system-6ifq.onrender.com/api/auth/departments');
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setDepartments(data);
      }
    } catch (err) {
      console.error('Failed to load departments:', err);
    }
  };

  const handleStatusToggle = async (invoice) => {
    const newStatus = invoice.status === 'Paid' ? 'Not Paid' : 'Paid';
    try {
      setError('');
      const response = await fetch(`https://task-management-system-6ifq.onrender.com/api/invoices/${invoice.invoice_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update invoice status');
      await fetchInvoices();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSendReminder = async (invoiceId) => {
    try {
      setRemindingId(invoiceId);
      setError('');
      setSuccessMsg('');

      const response = await fetch(`https://task-management-system-6ifq.onrender.com/api/invoices/${invoiceId}/remind`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send reminder email');

      setSuccessMsg(`Reminder dispatched for INV-${String(invoiceId).padStart(5, '0')}`);
      await fetchInvoices();
    } catch (err) {
      setError(err.message);
    } finally {
      setRemindingId(null);
    }
  };

  const handleDownloadPdf = async (invoiceId) => {
    try {
      setDownloadingId(invoiceId);
      setError('');

      let response;
      const cacheBuster = `?t=${Date.now()}`;

      if (window.location.hostname === 'localhost') {
        try {
          response = await fetch(`http://localhost:3000/api/invoices/${invoiceId}/pdf${cacheBuster}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch {
          response = null;
        }
      }

      if (!response || !response.ok) {
        response = await fetch(`https://task-management-system-6ifq.onrender.com/api/invoices/${invoiceId}/pdf${cacheBuster}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      if (!response.ok) throw new Error('Failed to generate Invoice PDF');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `Invoice-${invoiceId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloadingId(null);
    }
  };

  const resetFilters = () => {
    setFilterInvoiceNo('');
    setFilterCompany('');
    setFilterDepartment('ALL');
    setFilterStatus('ALL');
    setFilterCurrency('ALL');
  };

  // Filter Logic
  const filteredInvoices = invoices.filter((inv) => {
    const invCode = `INV-${String(inv.invoice_id).padStart(5, '0')}`.toLowerCase();
    const rawId = String(inv.invoice_id);
    const company = inv.job?.loe?.company;
    const compName = (company?.name || company?.company_name || '').toLowerCase();
    const invStatus = inv.status || 'Not Paid';
    const invCurrency = inv.job?.loe?.currency || 'LKR';

    // 1. Filter by Invoice Number
    if (filterInvoiceNo.trim()) {
      const q = filterInvoiceNo.trim().toLowerCase();
      const strippedQ = q.replace(/^inv-?/i, '').replace(/^0+/, '');
      const matchesFullCode = invCode.includes(q);
      const matchesRawId = rawId.includes(q) || (strippedQ !== '' && rawId === strippedQ);

      if (!matchesFullCode && !matchesRawId) {
        return false;
      }
    }

    // 2. Filter by Company Name
    if (filterCompany.trim() && !compName.includes(filterCompany.trim().toLowerCase())) {
      return false;
    }

    // 3. Filter by Department
    if (filterDepartment !== 'ALL') {
      const loeItems = inv.job?.loe?.loe_items || [];
      const matchesDept = loeItems.some(
        (item) => Number(item.service?.department_id) === Number(filterDepartment)
      );
      if (!matchesDept) return false;
    }

    // 4. Filter by Payment Status
    if (filterStatus !== 'ALL' && invStatus !== filterStatus) {
      return false;
    }

    // 5. Filter by Currency
    if (filterCurrency !== 'ALL' && invCurrency !== filterCurrency) {
      return false;
    }

    return true;
  });

  const hasActiveFilters =
    filterInvoiceNo.trim() !== '' ||
    filterCompany.trim() !== '' ||
    filterDepartment !== 'ALL' ||
    filterStatus !== 'ALL' ||
    filterCurrency !== 'ALL';

  return (
    <div style={styles.pageContainer}>
      <Navbar />
      <div style={styles.container}>
        
        {/* Header Row */}
        <div style={styles.headerRow}>
          <div>
            <h1 style={{ margin: '0 0 6px', color: '#1e293b', fontSize: '26px' }}>
              Invoices &amp; Billing Management
            </h1>
            <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
              Manage client invoices, payment collections, and automated payment reminders.
            </p>
          </div>

          <span style={styles.countBadge}>
            {filteredInvoices.length} {filteredInvoices.length === 1 ? 'Invoice' : 'Invoices'}
          </span>
        </div>

        {/* Filter Bar */}
        <div style={styles.filterBar}>
          {/* Invoice Number Filter */}
          <div style={styles.filterField}>
            <label style={styles.filterLabel}>Invoice Number</label>
            <input
              type="text"
              placeholder="Search invoice # (e.g. 1 or INV-00001)..."
              value={filterInvoiceNo}
              onChange={(e) => setFilterInvoiceNo(e.target.value)}
              style={styles.filterInput}
            />
          </div>

          {/* Company Filter */}
          <div style={styles.filterField}>
            <label style={styles.filterLabel}>Company</label>
            <input
              type="text"
              list="invoice-company-filter-list"
              placeholder="Search company..."
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
              style={styles.filterInput}
            />
            <datalist id="invoice-company-filter-list">
              {companies.map((c) => (
                <option key={c.company_id} value={c.name || c.company_name} />
              ))}
            </datalist>
          </div>

          {/* Department Filter */}
          <div style={styles.filterField}>
            <label style={styles.filterLabel}>Dept</label>
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              style={styles.filterSelect}
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d.department_id} value={d.department_id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Status Filter */}
          <div style={styles.filterField}>
            <label style={styles.filterLabel}>Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={styles.filterSelect}
            >
              <option value="ALL">All Statuses</option>
              <option value="Not Paid">Not Paid</option>
              <option value="Paid">Paid</option>
            </select>
          </div>

          {/* Currency Filter */}
          <div style={styles.filterField}>
            <label style={styles.filterLabel}>Currency</label>
            <select
              value={filterCurrency}
              onChange={(e) => setFilterCurrency(e.target.value)}
              style={styles.filterSelect}
            >
              <option value="ALL">All Currencies</option>
              <option value="LKR">LKR (Rs.)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="AED">AED</option>
              <option value="SAR">SAR</option>
              <option value="INR">INR (₹)</option>
              <option value="AUD">AUD (A$)</option>
              <option value="CAD">CAD (C$)</option>
              <option value="SGD">SGD (S$)</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button type="button" onClick={resetFilters} style={styles.clearFilterBtn}>
              Reset Filters
            </button>
          )}
        </div>

        {error && <div style={styles.errorBanner}>{error}</div>}
        {successMsg && <div style={styles.successBanner}>{successMsg}</div>}

        {loading ? (
          <div style={styles.emptyCard}>Loading invoices...</div>
        ) : filteredInvoices.length === 0 ? (
          <div style={styles.emptyCard}>No invoices match your filter criteria.</div>
        ) : (
          <div style={styles.grid}>
            {filteredInvoices.map((inv) => {
              const company = inv.job?.loe?.company;
              const currencyCode = inv.job?.loe?.currency || 'LKR';
              const symbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode;
              const isPaid = inv.status === 'Paid';

              const loeItems = inv.job?.loe?.loe_items || [];
              const deptNames = Array.from(
                new Set(loeItems.map((item) => item.service?.department?.name).filter(Boolean))
              );

              return (
                <div key={inv.invoice_id} style={styles.invoiceCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>
                      INV-{String(inv.invoice_id).padStart(5, '0')}
                    </h3>
                    <span style={{
                      ...styles.badge,
                      background: isPaid ? '#d4edda' : '#fee2e2',
                      color: isPaid ? '#155724' : '#991b1b'
                    }}>
                      {inv.status}
                    </span>
                  </div>

                  <p style={{ margin: '10px 0 2px', fontSize: '14px' }}>
                    <strong>Company:</strong> {company?.name || 'N/A'}
                  </p>

                  {deptNames.length > 0 && (
                    <p style={{ margin: '2px 0 6px', fontSize: '12px', color: '#64748b' }}>
                      <strong>Dept:</strong> {deptNames.join(', ')}
                    </p>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '6px 0' }}>
                    <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#0369a1' }}>
                      {symbol} {Number(inv.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                      {currencyCode}
                    </span>
                  </div>

                  <p style={{ margin: '4px 0', fontSize: '12px', color: '#64748b' }}>
                    <strong>Issued:</strong> {inv.issued_date ? new Date(inv.issued_date).toLocaleDateString() : 'N/A'} |{' '}
                    <strong>Due:</strong> {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'N/A'}
                  </p>

                  <div style={styles.actionColumn}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {canManage && (
                        <button
                          onClick={() => handleStatusToggle(inv)}
                          style={{
                            ...styles.actionBtn,
                            background: isPaid ? '#6c757d' : '#28a745'
                          }}
                        >
                          {isPaid ? 'Mark Not Paid' : 'Mark as Paid'}
                        </button>
                      )}

                      <button
                        onClick={() => handleDownloadPdf(inv.invoice_id)}
                        disabled={downloadingId === inv.invoice_id}
                        style={{ ...styles.actionBtn, background: '#17a2b8' }}
                      >
                        {downloadingId === inv.invoice_id ? 'PDF...' : 'Download PDF'}
                      </button>
                    </div>

                    {!isPaid && canManage && (
                      <button
                        onClick={() => handleSendReminder(inv.invoice_id)}
                        disabled={remindingId === inv.invoice_id}
                        style={styles.remindBtn}
                      >
                        {remindingId === inv.invoice_id ? 'Sending Reminder...' : '📧 Send Reminder Email'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  pageContainer: { minHeight: '100vh', background: '#f4f6f8', fontFamily: 'system-ui' },
  container: { maxWidth: '1240px', margin: '0 auto', padding: '35px 40px' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', flexWrap: 'wrap', gap: '15px' },
  countBadge: { background: '#1e293b', color: '#fff', padding: '6px 14px', borderRadius: '18px', fontSize: '12.5px', fontWeight: 'bold' },
  filterBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    alignItems: 'flex-end',
    background: '#ffffff',
    padding: '16px 18px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    marginBottom: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
  },
  filterField: { display: 'flex', flexDirection: 'column', gap: '4px', flex: '1', minWidth: '150px' },
  filterLabel: { fontSize: '11.5px', fontWeight: 'bold', color: '#475569' },
  filterInput: { padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' },
  filterSelect: { padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px', background: '#fff' },
  clearFilterBtn: {
    padding: '8px 14px',
    background: '#f1f5f9',
    color: '#dc2626',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '12px',
    cursor: 'pointer',
    height: '35px'
  },
  emptyCard: { background: '#fff', padding: '40px', textAlign: 'center', borderRadius: '8px', color: '#64748b', border: '1px solid #e2e8f0' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '20px' },
  invoiceCard: { background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0' },
  badge: { padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' },
  actionColumn: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '14px' },
  actionBtn: { flex: 1, padding: '8px 10px', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' },
  remindBtn: { width: '100%', padding: '8px 10px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' },
  errorBanner: { background: '#fee2e2', color: '#b91c1c', padding: '12px 16px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' },
  successBanner: { background: '#d4edda', color: '#155724', padding: '12px 16px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }
};
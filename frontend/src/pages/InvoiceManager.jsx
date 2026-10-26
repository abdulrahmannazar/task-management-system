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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [remindingId, setRemindingId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};

  const isAdmin = user.role === 'ADMIN';
  const canManage = user.role === 'ADMIN' || user.role === 'MANAGER';
  const userDeptId = user.department_id || 1;

  useEffect(() => {
    fetchInvoices();
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

      const response = await fetch(`https://task-management-system-6ifq.onrender.com/api/invoices/${invoiceId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      });

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

  return (
    <div style={styles.pageContainer}>
      <Navbar />
      <div style={styles.container}>
        <h1 style={{ margin: '0 0 8px', color: '#1e293b' }}>Invoices &amp; Billing Management</h1>
        <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: '14px' }}>
          Manage client invoices, payment statuses, and automated reminders in each engagement's selected currency.
        </p>

        {error && <div style={styles.errorBanner}>{error}</div>}
        {successMsg && <div style={styles.successBanner}>{successMsg}</div>}

        {loading ? (
          <div style={styles.card}>Loading invoices...</div>
        ) : invoices.length === 0 ? (
          <div style={styles.card}>No invoices generated yet.</div>
        ) : (
          <div style={styles.grid}>
            {invoices.map((inv) => {
              const company = inv.job?.loe?.company;
              const currencyCode = inv.job?.loe?.currency || 'LKR';
              const symbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode;
              const isPaid = inv.status === 'Paid';

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

                  <p style={{ margin: '10px 0 4px', fontSize: '14px' }}>
                    <strong>Company:</strong> {company?.name || 'N/A'}
                  </p>

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
  container: { maxWidth: '1200px', margin: '0 auto', padding: '35px 40px' },
  card: { background: '#fff', padding: '30px', borderRadius: '8px', textAlign: 'center', color: '#64748b' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '20px' },
  invoiceCard: { background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' },
  badge: { padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' },
  actionColumn: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '14px' },
  actionBtn: { flex: 1, padding: '8px 10px', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' },
  remindBtn: { width: '100%', padding: '8px 10px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' },
  errorBanner: { background: '#fee2e2', color: '#b91c1c', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' },
  successBanner: { background: '#d4edda', color: '#155724', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }
};